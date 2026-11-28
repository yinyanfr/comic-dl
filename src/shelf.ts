import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import { nonempty, outputPath } from './config.js';
import { retrySourceRead } from './download.js';
import { ShelfTracking, trackingSchema } from './shelf-tracking.js';
import type { ShelfEntry } from './shelf-types.js';
import type { SourceRegistry } from './sources/index.js';

const schemaVersion = 3;
const columns = `
  id, source_id AS sourceId, work_id AS workId, input, title, following,
  created_at AS createdAt, updated_at AS updatedAt, revision,
  auto_check AS autoCheck, auto_download AS autoDownload, interval_seconds AS intervalSeconds
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
          if (version < 2) db.exec(trackingSchema);
          db.exec(`
            ALTER TABLE shelf_entries ADD COLUMN auto_check INTEGER NOT NULL DEFAULT 0 CHECK (auto_check IN (0,1));
            ALTER TABLE shelf_entries ADD COLUMN auto_download INTEGER NOT NULL DEFAULT 0 CHECK (auto_download IN (0,1));
            ALTER TABLE shelf_entries ADD COLUMN interval_seconds INTEGER;
            UPDATE shelf_entries SET auto_check = following, auto_download = following;
            CREATE TABLE shelf_settings (id INTEGER PRIMARY KEY CHECK (id = 1), interval_seconds INTEGER NOT NULL);
            INSERT INTO shelf_settings VALUES (1, 3600);
            ALTER TABLE shelf_chapters RENAME TO shelf_chapters_old;
            DROP INDEX shelf_chapters_due;
            CREATE TABLE shelf_chapters (
              entry_id TEXT NOT NULL REFERENCES shelf_entries(id) ON DELETE CASCADE,
              catalog_version INTEGER NOT NULL, chapter_id TEXT NOT NULL,
              present INTEGER NOT NULL DEFAULT 1 CHECK (present IN (0,1)),
              state TEXT NOT NULL CHECK (state IN ('seen','discovered','queued','retry','restricted','complete','blocked','cancelled')),
              failures INTEGER NOT NULL DEFAULT 0, ready_at INTEGER NOT NULL DEFAULT 0,
              revision INTEGER NOT NULL DEFAULT 0,
              title TEXT NOT NULL DEFAULT '', number INTEGER, discovered_at INTEGER,
              PRIMARY KEY (entry_id,catalog_version,chapter_id)
            ) STRICT;
            INSERT INTO shelf_chapters (entry_id,catalog_version,chapter_id,present,state,failures,ready_at)
              SELECT entry_id,catalog_version,chapter_id,present,state,failures,ready_at FROM shelf_chapters_old;
            DROP TABLE shelf_chapters_old;
            CREATE INDEX shelf_chapters_due ON shelf_chapters (entry_id,catalog_version,present,ready_at)
              WHERE state IN ('queued','retry','restricted');
          `);
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
    if (
      version === 0 ||
      version === 1 ||
      version === 2 ||
      version === schemaVersion
    )
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
    let title: string | undefined;
    try {
      const source = sources.create(sourceId);
      const series = await retrySourceRead(
        () => source.getSeries(locator, signal),
        signal,
        retries,
      );
      workId = series.id;
      title = series.metadata?.title;
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
    return { locator, workId, title };
  }

  async add(
    sources: SourceRegistry,
    sourceId: string,
    input: string,
    options: { title?: string; signal: AbortSignal; retries?: number },
  ) {
    const { locator, workId, title } = await this.#resolve(
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
      title: options.title ?? title ?? workId,
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
    return this.configure(id, {
      autoCheck: following,
      autoDownload: following,
    });
  }

  configure(id: string, options: import('./shelf-types.js').ShelfAutomation) {
    if (
      (options.autoCheck !== undefined &&
        typeof options.autoCheck !== 'boolean') ||
      (options.autoDownload !== undefined &&
        typeof options.autoDownload !== 'boolean')
    )
      throw new Error('Automation switches must be booleans');
    const current = this.#get(id);
    if (
      options.intervalSeconds !== undefined &&
      options.intervalSeconds !== null
    )
      this.tracking.validateInterval(options.intervalSeconds);
    const autoCheck =
      options.autoCheck === undefined
        ? current.autoCheck
        : Number(options.autoCheck);
    const autoDownload =
      options.autoDownload === undefined
        ? current.autoDownload
        : Number(options.autoDownload);
    const interval =
      options.intervalSeconds === undefined
        ? current.intervalSeconds
        : options.intervalSeconds;
    if (
      autoCheck === current.autoCheck &&
      autoDownload === current.autoDownload &&
      interval === current.intervalSeconds
    )
      return current;
    const now = Date.now();
    const entry = this.#db
      .prepare<Record<string, string | number | null>, ShelfEntry>(
        `
        UPDATE shelf_entries
        SET updated_at = @updated, auto_check = @autoCheck, auto_download = @autoDownload,
            interval_seconds = @interval, following = @autoCheck,
            next_check = CASE WHEN auto_check = 0 AND @autoCheck = 1 THEN 0
              WHEN interval_seconds IS NOT @interval THEN @now + 1000 * coalesce(@interval,
                (SELECT interval_seconds FROM shelf_settings WHERE id = 1)) ELSE next_check END,
            revision = revision + 1
        WHERE id = @id
        RETURNING ${columns}
      `,
      )
      .get({
        id,
        autoCheck,
        autoDownload,
        interval,
        now,
        updated: new Date(now).toISOString(),
      });
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
