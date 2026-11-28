import { realpathSync } from 'node:fs';
import Database from 'better-sqlite3';
import type {
  CheckProblem,
  ShelfAttention,
  ShelfStatus,
} from './shelf-types.js';
import { safeText, taskId } from './tasks.js';
import type { DownloadTaskSnapshot } from './tasks.js';

export const trackingSchema = `
  ALTER TABLE shelf_entries ADD COLUMN catalog_version INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE shelf_entries ADD COLUMN check_version INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE shelf_entries ADD COLUMN last_check INTEGER;
  ALTER TABLE shelf_entries ADD COLUMN last_success INTEGER;
  ALTER TABLE shelf_entries ADD COLUMN check_result TEXT;
  ALTER TABLE shelf_entries ADD COLUMN check_failures INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE shelf_entries ADD COLUMN next_check INTEGER NOT NULL DEFAULT 0;

  CREATE TABLE shelf_chapters (
    entry_id TEXT NOT NULL REFERENCES shelf_entries(id) ON DELETE CASCADE,
    catalog_version INTEGER NOT NULL,
    chapter_id TEXT NOT NULL,
    present INTEGER NOT NULL DEFAULT 1 CHECK (present IN (0, 1)),
    state TEXT NOT NULL CHECK (state IN ('seen', 'queued', 'retry', 'restricted', 'complete', 'blocked')),
    failures INTEGER NOT NULL DEFAULT 0,
    ready_at INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (entry_id, catalog_version, chapter_id)
  ) STRICT;
  CREATE INDEX shelf_chapters_due ON shelf_chapters (entry_id, catalog_version, present, ready_at)
    WHERE state IN ('queued', 'retry', 'restricted');

`;

export interface TrackedEntry {
  id: string;
  sourceId: string;
  workId: string;
  input: string;
  revision: number;
  catalogVersion: number;
  checkVersion: number;
  lastSuccess: number | null;
  checkFailures: number;
  title: string;
  autoCheck: number;
  autoDownload: number;
  intervalSeconds: number;
  nextCheck: number;
}

type TaskState = 'queued' | 'retry' | 'restricted' | 'complete' | 'blocked';
type TaskResult = Exclude<TaskState, 'queued'>;

export interface ShelfTask {
  id: string;
  state: TaskState;
  failures: number;
  readyAt: number;
  revision: number;
}

type CheckData =
  | { problem: CheckProblem }
  | {
      chapterIds: readonly string[];
      includeHistory: boolean;
      chapters?: readonly { id: string; title: string; number?: number }[];
    };

const runnableStates = "state IN ('queued', 'retry', 'restricted')";
const selectEntries = `
  SELECT id, source_id AS sourceId, work_id AS workId, input, revision,
    catalog_version AS catalogVersion, check_version AS checkVersion,
    last_success AS lastSuccess, check_failures AS checkFailures, title,
    auto_check AS autoCheck, auto_download AS autoDownload, next_check AS nextCheck,
    coalesce(interval_seconds,(SELECT interval_seconds FROM shelf_settings WHERE id = 1)) AS intervalSeconds
  FROM shelf_entries AS entry WHERE 1 = 1
`;
const dueTime = `
    min(CASE WHEN auto_check = 1 THEN next_check ELSE 9007199254740991 END, coalesce((
      SELECT min(ready_at) FROM shelf_chapters AS chapter
      WHERE chapter.entry_id = entry.id AND chapter.catalog_version = entry.catalog_version
         AND ${runnableStates}
    ), 9007199254740991))
`;

export class ShelfTracking {
  constructor(private readonly db: Database.Database) {}

  subscriptions(id?: string) {
    return this.db
      .prepare<{ id: string | null }, TrackedEntry>(
        `${selectEntries} AND (@id IS NULL OR id = @id) ORDER BY created_at, id`,
      )
      .all({ id: id ?? null });
  }

  due(now: number) {
    return this.db
      .prepare<[number], TrackedEntry>(
        `${selectEntries} AND (${dueTime}) <= ? ORDER BY source_id, created_at, id`,
      )
      .all(now);
  }

  nextDue() {
    return this.db
      .prepare<[], { time: number | null }>(
        `
         SELECT min(${dueTime}) AS time FROM shelf_entries AS entry
      `,
      )
      .get()?.time;
  }

  status(id?: string) {
    return this.db
      .prepare<{ id: string | null }, ShelfStatus>(
        `
         SELECT entry.id, source_id AS sourceId, following, last_check AS lastCheck,
           auto_check AS autoCheck, auto_download AS autoDownload,
           coalesce(interval_seconds,(SELECT interval_seconds FROM shelf_settings WHERE id = 1)) AS intervalSeconds,
           CASE WHEN auto_check = 1 THEN next_check END AS nextCheck,
          last_success AS lastSuccess, check_result AS result,
          count(*) FILTER (WHERE state IN ('queued', 'retry', 'restricted')) AS pending,
          count(*) FILTER (WHERE state = 'restricted') AS restricted,
          count(*) FILTER (WHERE state = 'blocked') AS blocked,
           count(*) FILTER (WHERE state = 'complete') AS complete,
           count(*) FILTER (WHERE state = 'discovered') AS discovered
        FROM shelf_entries AS entry LEFT JOIN shelf_chapters AS chapter
          ON chapter.entry_id = entry.id AND chapter.catalog_version = entry.catalog_version
        WHERE @id IS NULL OR entry.id = @id
        GROUP BY entry.id ORDER BY entry.created_at, entry.id
      `,
      )
      .all({ id: id ?? null });
  }

  needsAttention(id: string) {
    return this.db
      .prepare<[string], ShelfAttention>(
        `
        SELECT chapter_id AS id, state FROM shelf_chapters AS chapter
        JOIN shelf_entries AS entry ON entry.id = chapter.entry_id
          AND entry.catalog_version = chapter.catalog_version
        WHERE entry.id = ? AND state IN ('restricted', 'blocked')
        ORDER BY chapter_id
      `,
      )
      .all(id);
  }

  recordCheck(entry: TrackedEntry, data: CheckData, now: number, next: number) {
    return this.db
      .transaction(() => {
        const problem = 'problem' in data ? data.problem : null;
        const updated = this.db
          .prepare(
            `
        UPDATE shelf_entries
        SET check_version = check_version + 1, last_check = @now,
            last_success = CASE WHEN @problem IS NULL THEN @now ELSE last_success END,
            check_result = coalesce(@problem, 'ok'),
            check_failures = CASE WHEN @problem IS NULL THEN 0 ELSE check_failures + 1 END,
            next_check = @next
         WHERE id = @id AND revision = @revision AND check_version = @checkVersion
      `,
          )
          .run({ ...entry, now, problem, next });
        if (!updated.changes) return;
        if ('problem' in data) return 0;

        const catalog = {
          entryId: entry.id,
          catalogVersion: entry.catalogVersion,
          chapterIds: JSON.stringify(data.chapterIds),
        };
        this.db
          .prepare(
            `
         UPDATE shelf_chapters SET present = 0
         WHERE entry_id = @entryId AND catalog_version = @catalogVersion AND present = 1
           AND chapter_id NOT IN (SELECT value FROM json_each(@chapterIds))
       `,
          )
          .run(catalog);
        this.db
          .prepare(
            `
            UPDATE shelf_chapters SET present = 1
            WHERE entry_id = @entryId AND catalog_version = @catalogVersion AND present = 0
              AND chapter_id IN (SELECT value FROM json_each(@chapterIds))
          `,
          )
          .run(catalog);
        const queueNew =
          (entry.lastSuccess !== null && entry.autoDownload === 1) ||
          data.includeHistory;
        const inserted = this.db
          .prepare(
            `
            INSERT INTO shelf_chapters (entry_id, catalog_version, chapter_id, state, discovered_at)
            SELECT @entryId, @catalogVersion, value, @state, @discoveredAt FROM json_each(@chapterIds) WHERE true
            ON CONFLICT (entry_id, catalog_version, chapter_id) DO NOTHING
          `,
          )
          .run({
            ...catalog,
            state: queueNew
              ? 'queued'
              : entry.lastSuccess === null
                ? 'seen'
                : 'discovered',
            discoveredAt: entry.lastSuccess === null ? null : now,
          }).changes;
        for (const [index, chapterId] of data.chapterIds.entries()) {
          const chapter = data.chapters?.find(
            (chapter) => chapter.id === chapterId,
          );
          this.db
            .prepare(
              `UPDATE shelf_chapters SET title = @title, number = @number
            WHERE entry_id = @entryId AND catalog_version = @catalogVersion AND chapter_id = @chapterId`,
            )
            .run({
              entryId: entry.id,
              catalogVersion: entry.catalogVersion,
              chapterId,
              title: safeText(chapter?.title ?? chapterId),
              number: chapter?.number ?? index + 1,
            });
        }
        let queued = queueNew ? inserted : 0;
        if (data.includeHistory) {
          queued += this.db
            .prepare(
              `
            UPDATE shelf_chapters SET state = 'queued'
            WHERE entry_id = @entryId AND catalog_version = @catalogVersion
               AND present = 1 AND state IN ('seen','discovered')
          `,
            )
            .run(catalog).changes;
        }
        return queued;
      })
      .immediate();
  }

  tasks(entry: TrackedEntry, now: number) {
    return this.db
      .prepare<{ id: string; catalogVersion: number; now: number }, ShelfTask>(
        `
         SELECT chapter_id AS id, state, failures, ready_at AS readyAt, revision FROM shelf_chapters
       WHERE entry_id = @id AND catalog_version = @catalogVersion AND present = 1
          AND ${runnableStates} AND ready_at <= @now
      `,
      )
      .all({ id: entry.id, catalogVersion: entry.catalogVersion, now });
  }

  refreshPresence(entry: TrackedEntry, ids: readonly string[], now: number) {
    this.db
      .prepare(
        `UPDATE shelf_chapters SET
      present = chapter_id IN (SELECT value FROM json_each(@ids)),
      ready_at = CASE WHEN chapter_id NOT IN (SELECT value FROM json_each(@ids)) THEN max(ready_at, @next) ELSE ready_at END
      WHERE entry_id = @id AND catalog_version = @catalogVersion
      AND EXISTS (SELECT 1 FROM shelf_entries WHERE id = @id AND catalog_version = @catalogVersion)`,
      )
      .run({ ...entry, ids: JSON.stringify(ids), next: now + 60000 });
  }

  isActive(entry: TrackedEntry) {
    return !!this.db
      .prepare(
        `
       SELECT 1 FROM shelf_entries WHERE id = @id AND catalog_version = @catalogVersion
    `,
      )
      .get({ id: entry.id, catalogVersion: entry.catalogVersion });
  }

  deferDownloads(entry: TrackedEntry, now: number, next: number) {
    this.db
      .prepare(
        `
      UPDATE shelf_chapters SET ready_at = @next
      WHERE entry_id = @id AND catalog_version = @catalogVersion
        AND ${runnableStates} AND ready_at <= @now
         AND EXISTS (SELECT 1 FROM shelf_entries WHERE id = @id AND catalog_version = @catalogVersion)
    `,
      )
      .run({ ...entry, now, next });
  }

  finishTask(
    entry: TrackedEntry,
    task: ShelfTask,
    result: TaskResult,
    next: number,
  ) {
    return !!this.db
      .prepare(
        `
      UPDATE shelf_chapters SET state = @result, ready_at = @next,
        failures = CASE WHEN @result = 'complete' THEN 0 ELSE failures + 1 END
      WHERE entry_id = @entryId AND catalog_version = @catalogVersion AND chapter_id = @id
         AND state = @state AND ready_at = @readyAt AND failures = @failures AND revision = @taskRevision
         AND EXISTS (SELECT 1 FROM shelf_entries WHERE id = @entryId AND catalog_version = @catalogVersion)
    `,
      )
      .run({
        ...task,
        entryId: entry.id,
        catalogVersion: entry.catalogVersion,
        revision: entry.revision,
        result,
        next,
        taskRevision: task.revision,
      }).changes;
  }

  retry(id: string, chapterId: string) {
    return this.db
      .transaction(() => {
        const updated = this.db
          .prepare(
            `
         UPDATE shelf_chapters SET state = 'queued', ready_at = 0, failures = 0, revision = revision + 1
         WHERE entry_id = @id AND chapter_id = @chapterId AND state IN ('blocked', 'restricted', 'retry', 'cancelled')
           AND catalog_version = (SELECT catalog_version FROM shelf_entries WHERE id = @id)
      `,
          )
          .run({ id, chapterId });
        if (!updated.changes) return false;
        return true;
      })
      .immediate();
  }

  validateInterval(seconds: number) {
    if (!Number.isSafeInteger(seconds) || seconds < 1 || seconds > 31536000)
      throw new Error('intervalSeconds must be between 1 and 31536000');
  }

  setDefaultInterval(seconds: number) {
    this.validateInterval(seconds);
    this.db
      .transaction(() => {
        const previous = this.db
          .prepare<[], { interval_seconds: number }>(
            'SELECT interval_seconds FROM shelf_settings WHERE id = 1',
          )
          .get()!;
        if (previous.interval_seconds === seconds) return;
        this.db
          .prepare(
            'UPDATE shelf_settings SET interval_seconds = ? WHERE id = 1',
          )
          .run(seconds);
        this.db
          .prepare(
            `UPDATE shelf_entries SET next_check = ? + ? * 1000, revision = revision + 1
        WHERE interval_seconds IS NULL`,
          )
          .run(Date.now(), seconds);
      })
      .immediate();
  }

  chapters(id: string): import('./shelf-types.js').ShelfChapter[] {
    return this.db
      .prepare<[string], import('./shelf-types.js').ShelfChapter>(
        `
      SELECT chapter_id AS chapterId, shelf_chapters.title AS chapterTitle, number, discovered_at AS discoveredAt, state
      FROM shelf_chapters JOIN shelf_entries AS entry ON entry.id = entry_id AND entry.catalog_version = shelf_chapters.catalog_version
      WHERE entry_id = ? ORDER BY number, chapter_id`,
      )
      .all(id)
      .map((chapter) => ({
        ...chapter,
        number: chapter.number ?? undefined,
        chapterTitle: chapter.chapterTitle || chapter.chapterId,
      }));
  }

  enqueue(id: string, chapterId: string) {
    return !!this.db
      .prepare(
        `UPDATE shelf_chapters SET state = 'queued', ready_at = 0, failures = 0, revision = revision + 1
      WHERE entry_id = @id AND chapter_id = @chapterId AND state IN ('seen','discovered','cancelled')
      AND catalog_version = (SELECT catalog_version FROM shelf_entries WHERE id = @id)`,
      )
      .run({ id, chapterId }).changes;
  }

  cancel(id: string, chapterId: string) {
    return !!this.db
      .prepare(
        `UPDATE shelf_chapters SET state = 'cancelled', revision = revision + 1
      WHERE entry_id = @id AND chapter_id = @chapterId AND state IN ('queued','retry','restricted','blocked')
      AND catalog_version = (SELECT catalog_version FROM shelf_entries WHERE id = @id)`,
      )
      .run({ id, chapterId }).changes;
  }

  taskActive(
    id: string,
    chapterId: string,
    catalogVersion: number,
    revision: number,
  ) {
    return !!this.db
      .prepare(
        `SELECT 1 FROM shelf_chapters AS chapter JOIN shelf_entries AS entry
      ON entry.id = chapter.entry_id AND entry.catalog_version = chapter.catalog_version
      WHERE entry_id = @id AND chapter_id = @chapterId AND chapter.catalog_version = @catalogVersion
      AND state IN ('queued','retry','restricted') AND chapter.revision = @revision`,
      )
      .get({ id, chapterId, catalogVersion, revision });
  }

  snapshots(id?: string): DownloadTaskSnapshot[] {
    type Row = {
      entryId: string;
      sourceId: string;
      workId: string;
      workTitle: string;
      chapterId: string;
      chapterTitle: string;
      number: number;
      state: string;
      failures: number;
      readyAt: number;
    };
    return this.db
      .prepare<{ id: string | null }, Row>(
        `SELECT entry.id AS entryId, source_id AS sourceId, work_id AS workId,
       entry.title AS workTitle, chapter_id AS chapterId, chapter.title AS chapterTitle, number, state, failures, ready_at AS readyAt
      FROM shelf_chapters AS chapter JOIN shelf_entries AS entry ON entry.id = entry_id
      AND entry.catalog_version = chapter.catalog_version
      WHERE state NOT IN ('seen','discovered') AND (@id IS NULL OR entry.id = @id) ORDER BY entry.created_at, number`,
      )
      .all({ id: id ?? null })
      .map((row): DownloadTaskSnapshot => ({
        id: taskId(row.sourceId, row.workId, row.chapterId, row.entryId),
        origin: 'shelf',
        entryId: row.entryId,
        sourceId: safeText(row.sourceId),
        workId: safeText(row.workId),
        workTitle: safeText(row.workTitle),
        chapterId: safeText(row.chapterId),
        chapterTitle: safeText(row.chapterTitle || row.chapterId),
        number: row.number ?? undefined,
        state:
          row.state === 'complete'
            ? 'downloaded'
            : row.state === 'blocked'
              ? 'failed'
              : (row.state as DownloadTaskSnapshot['state']),
        pagesDownloaded: 0,
        attempt: row.failures,
        readyAt: row.readyAt,
        problem:
          row.state === 'blocked'
            ? 'download-failed'
            : row.state === 'restricted'
              ? 'access-restricted'
              : undefined,
        retryable: ['blocked', 'restricted', 'retry', 'cancelled'].includes(
          row.state,
        ),
      }));
  }

  acquireWatcher() {
    // A separate database lets SQLite hold an OS lock without blocking shelf edits.
    const lock = new Database(`${realpathSync(this.db.name)}.watch-lock`, {
      timeout: 0,
    });
    try {
      lock.exec('BEGIN IMMEDIATE');
    } catch (error) {
      lock.close();
      if (
        error instanceof Database.SqliteError &&
        error.code === 'SQLITE_BUSY'
      ) {
        throw new Error('This shelf already has a running watcher.', {
          cause: error,
        });
      }
      throw error;
    }
    return () => {
      lock.close();
    };
  }
}
