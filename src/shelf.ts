import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import { nonempty, outputPath } from './config.js';
import { retrySourceRead } from './download.js';
import { ShelfTracking, trackingSchema } from './shelf-tracking.js';
import type { ShelfEntry } from './shelf-types.js';
import type { SourceRegistry } from './sources/index.js';

const schemaVersion = 2;
const columns = `
  id, source_id AS sourceId, work_id AS workId, input, title, following,
  created_at AS createdAt, updated_at AS updatedAt, revision
`;

export function hasUrlCredentials(value: string) {
  const url = URL.parse(value);
  if (!url) return false;
  const authParameter =
    /^(?:auth(?:orization)?|(?:access|auth|refresh|id)[_-]?token|token|api[_-]?key|key|password|passwd|cookie|session(?:[_-]?id)?|signature|sig|x-amz-.+|x-goog-.+)$/i;
  return (
    !!(url.username || url.password) ||
    [url.searchParams, new URLSearchParams(url.hash.slice(1))].some((params) =>
      [...params.keys()].some((key) => authParameter.test(key)),
    )
  );
}

export class Shelf {
  readonly #db: Database.Database;
  readonly tracking: ShelfTracking;

  constructor(file: string) {
    mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
    const db = new Database(file, { timeout: 3000 });
    this.#db = db;
    this.tracking = new ShelfTracking(db);
    try {
      db.pragma('foreign_keys = ON');
      if (this.#schemaVersion() < schemaVersion) {
        db.transaction(() => {
          const version = this.#schemaVersion();
          if (version === schemaVersion) return;
          if (version === 0) {
            db.exec(`
              CREATE TABLE shelf_entries (
                id TEXT PRIMARY KEY NOT NULL,
                source_id TEXT NOT NULL,
                work_id TEXT NOT NULL,
                input TEXT NOT NULL,
                title TEXT NOT NULL,
                following INTEGER NOT NULL DEFAULT 0 CHECK (following IN (0, 1)),
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                revision INTEGER NOT NULL DEFAULT 0,
                UNIQUE (source_id, work_id)
              ) STRICT;
            `);
          }
          db.exec(trackingSchema);
          db.pragma(`user_version = ${schemaVersion}`);
        }).immediate();
      }
    } catch (error) {
      db.close();
      throw error;
    }
  }

  #schemaVersion() {
    const version = this.#db.pragma('user_version', { simple: true });
    if (version === 0 || version === 1 || version === schemaVersion)
      return version;
    throw new Error(`Unsupported shelf database version: ${String(version)}.`);
  }

  close() {
    this.#db.close();
  }

  list() {
    return this.#db
      .prepare<[], ShelfEntry>(
        `SELECT ${columns} FROM shelf_entries ORDER BY created_at, id`,
      )
      .all();
  }

  #get(id: string) {
    const entry = this.#db
      .prepare<[string], ShelfEntry>(
        `SELECT ${columns} FROM shelf_entries WHERE id = ?`,
      )
      .get(id);
    if (!entry)
      throw new Error('Shelf entry not found. Run comic-dl shelf list.');
    return entry;
  }

  async #resolve(
    sources: SourceRegistry,
    sourceId: string,
    input: string,
    signal: AbortSignal,
    retries?: number,
  ) {
    if (!nonempty(input) || hasUrlCredentials(input)) {
      throw new Error('Provide a reusable series input without credentials.');
    }
    const locator = sourceId === 'fixture' ? outputPath(input) : input;
    let workId;
    try {
      const source = sources.create(sourceId);
      ({ id: workId } = await retrySourceRead(
        () => source.getSeries(locator, signal),
        signal,
        retries,
      ));
    } catch (cause) {
      signal.throwIfAborted();
      throw new Error(
        `${sourceId}: could not resolve the series. Check the input, source configuration and access.`,
        { cause },
      );
    }
    signal.throwIfAborted();
    if (!nonempty(workId) || hasUrlCredentials(workId)) {
      throw new Error(
        `${sourceId}: expected a stable work ID without credentials.`,
      );
    }
    return { locator, workId };
  }

  async add(
    sources: SourceRegistry,
    sourceId: string,
    input: string,
    options: { title?: string; signal: AbortSignal; retries?: number },
  ) {
    const { locator, workId } = await this.#resolve(
      sources,
      sourceId,
      input,
      options.signal,
      options.retries,
    );
    const description = {
      id: randomUUID(),
      sourceId,
      workId,
      input: locator,
      title: options.title ?? workId,
      now: new Date().toISOString(),
    };
    return this.#db.transaction(() => {
      this.#db
        .prepare(
          `
          INSERT INTO shelf_entries (id, source_id, work_id, input, title, created_at, updated_at)
          VALUES (@id, @sourceId, @workId, @input, @title, @now, @now)
          ON CONFLICT (source_id, work_id) DO NOTHING
        `,
        )
        .run(description);
      return this.#db
        .prepare<{ sourceId: string; workId: string }, ShelfEntry>(
          `
          SELECT ${columns} FROM shelf_entries
          WHERE source_id = @sourceId AND work_id = @workId
        `,
        )
        .get({ sourceId, workId })!;
    })();
  }

  async setInput(
    sources: SourceRegistry,
    id: string,
    input: string,
    options: { signal: AbortSignal; retries?: number },
  ) {
    const entry = this.#get(id);
    if (!sources.ids().includes(entry.sourceId)) {
      throw new Error(
        `Source ${entry.sourceId} is not loaded. Restore it before changing this entry.`,
      );
    }
    const { locator, workId } = await this.#resolve(
      sources,
      entry.sourceId,
      input,
      options.signal,
      options.retries,
    );
    if (workId !== entry.workId) {
      throw new Error('The new input resolves to a different work.');
    }
    const updated = this.#db
      .prepare<
        { id: string; input: string; now: string; revision: number },
        ShelfEntry
      >(
        `
        UPDATE shelf_entries
        SET updated_at = CASE WHEN input = @input THEN updated_at ELSE @now END,
            catalog_version = catalog_version + (input <> @input),
            last_check = CASE WHEN input = @input THEN last_check END,
            last_success = CASE WHEN input = @input THEN last_success END,
            check_result = CASE WHEN input = @input THEN check_result END,
            check_failures = CASE WHEN input = @input THEN check_failures ELSE 0 END,
            next_check = CASE WHEN input = @input THEN next_check ELSE 0 END,
            revision = revision + (input <> @input), input = @input
        WHERE id = @id AND revision = @revision
        RETURNING ${columns}
      `,
      )
      .get({
        id,
        input: locator,
        now: new Date().toISOString(),
        revision: entry.revision,
      });
    if (!updated)
      throw new Error(
        'The shelf entry changed. Run comic-dl shelf list and try again.',
      );
    return updated;
  }

  setFollowing(id: string, following: boolean) {
    const entry = this.#db
      .prepare<{ id: string; following: number; now: string }, ShelfEntry>(
        `
        UPDATE shelf_entries
        SET updated_at = CASE WHEN following = @following THEN updated_at ELSE @now END,
            next_check = CASE WHEN following = @following THEN next_check ELSE 0 END,
            revision = revision + (following <> @following), following = @following
        WHERE id = @id
        RETURNING ${columns}
      `,
      )
      .get({ id, following: Number(following), now: new Date().toISOString() });
    if (!entry)
      throw new Error('Shelf entry not found. Run comic-dl shelf list.');
    return entry;
  }

  remove(id: string) {
    const result = this.#db
      .prepare('DELETE FROM shelf_entries WHERE id = ?')
      .run(id);
    if (!result.changes)
      throw new Error('Shelf entry not found. Run comic-dl shelf list.');
  }
}
