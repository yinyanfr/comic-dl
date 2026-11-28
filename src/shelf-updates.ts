import { lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { nonempty } from './config.js';
import {
  defaultRetries,
  downloadSeries,
  retrySourceRead,
  numberedChapter,
} from './download.js';
import { OutputUnavailableError } from './output/cbz.js';
import { createOutputGuard } from './output/guard.js';
import type { ShelfTracking, TrackedEntry } from './shelf-tracking.js';
import type { CheckEvent, CheckProblem, TaskEvent } from './shelf-types.js';
import { hasUrlCredentials } from './shelf.js';
import { SourceHttpError } from './sources/http.js';
import type { SourceRegistry } from './sources/index.js';
import {
  RestrictedChapterError,
  TransientSourceError,
} from './sources/source.js';
import type { Chapter, Series } from './sources/source.js';

const minute = 60_000;
const hour = 60 * minute;
const restrictedDelay = 24 * hour;
const catalogTimeout = minute;
const shelfPoll = 1000;
const maxChaptersPerBatch = 16;

interface CheckOptions {
  signal: AbortSignal;
  retries?: number;
  interval?: number;
  includeHistory?: boolean;
  now?: () => number;
  onCheck: (event: CheckEvent) => void;
}

interface WatchOptions extends CheckOptions {
  directory: string;
  jobs: number;
  outputMarker?: string;
  onOutputUnavailable?: () => void;
  onTask: (event: TaskEvent) => void;
  outputRoot?: string;
  archive?: import('./output/naming.js').ArchiveOptions;
  onEvent?: (event: import('./tasks.js').DownloadEvent) => void;
}

function retryDelay(failures: number) {
  return Math.min(hour, minute * 2 ** Math.min(failures, 6));
}

async function readCatalog(
  sources: SourceRegistry,
  entry: TrackedEntry,
  { signal, retries }: CheckOptions,
): Promise<
  { series: Series; chapterIds: string[] } | { problem: CheckProblem }
> {
  if (!sources.ids().includes(entry.sourceId)) {
    return { problem: 'source-unavailable' };
  }
  const timeout = AbortSignal.timeout(catalogTimeout);
  const readSignal = AbortSignal.any([signal, timeout]);
  let series: Series;
  try {
    const source = sources.create(entry.sourceId);
    series = await retrySourceRead(
      () => source.getSeries(entry.input, readSignal),
      readSignal,
      retries,
    );
    readSignal.throwIfAborted();
  } catch (error) {
    signal.throwIfAborted();
    if (timeout.aborted || error instanceof TransientSourceError) {
      return { problem: 'temporary-failure' };
    }
    if (
      error instanceof RestrictedChapterError ||
      (error instanceof SourceHttpError && [401, 403].includes(error.status))
    ) {
      return { problem: 'authorization-failed' };
    }
    return { problem: 'catalog-failed' };
  }

  if (!series || !Array.isArray(series.chapters)) {
    return { problem: 'invalid-catalog' };
  }
  if (series.id !== entry.workId) return { problem: 'wrong-work' };
  if (!series.chapters.length) return { problem: 'empty-catalog' };
  const chapterIds = new Set<string>();
  for (const chapter of series.chapters as readonly Chapter[]) {
    const id = chapter?.id;
    if (!nonempty(id) || hasUrlCredentials(id) || chapterIds.has(id)) {
      return { problem: 'invalid-catalog' };
    }
    chapterIds.add(id);
  }
  return { series, chapterIds: [...chapterIds] };
}

async function checkEntry(
  tracking: ShelfTracking,
  sources: SourceRegistry,
  entry: TrackedEntry,
  options: CheckOptions,
): Promise<{ event: CheckEvent; series?: Series }> {
  options.signal.throwIfAborted();
  const known = new Set(
    tracking.chapters(entry.id).map((chapter) => chapter.chapterId),
  );
  const result = await readCatalog(sources, entry, options);
  options.signal.throwIfAborted();
  const now = (options.now ?? Date.now)();
  const identity = { id: entry.id, sourceId: entry.sourceId };
  if ('problem' in result) {
    const delay = retryDelay(entry.checkFailures);
    const accepted = tracking.recordCheck(entry, result, now, now + delay);
    return {
      event:
        accepted === undefined
          ? { ...identity, status: 'changed' }
          : { ...identity, status: 'failed', problem: result.problem },
    };
  }

  // A successful manual check makes the watcher eligible to refresh this entry.
  const queued = tracking.recordCheck(
    entry,
    {
      chapterIds: result.chapterIds,
      chapters: result.series.chapters,
      includeHistory: options.includeHistory ?? false,
    },
    now,
    now + entry.intervalSeconds * 1000,
  );
  if (queued === undefined)
    return { event: { ...identity, status: 'changed' } };
  const discovered =
    entry.lastSuccess === null
      ? 0
      : result.chapterIds.filter((id) => !known.has(id)).length;
  const status =
    entry.lastSuccess === null
      ? 'baseline'
      : queued || discovered
        ? 'updated'
        : 'unchanged';
  return {
    event: { ...identity, status, queued, discovered },
    series: result.series,
  };
}

export async function checkSubscriptions(
  tracking: ShelfTracking,
  sources: SourceRegistry,
  entries: readonly TrackedEntry[],
  options: CheckOptions,
) {
  let failures = 0;
  let queued = 0;
  for (const entry of entries) {
    let { event } = await checkEntry(tracking, sources, entry, options);
    if (options.includeHistory) {
      for (
        let attempt = 0;
        event.status === 'changed' && attempt < 2;
        attempt++
      ) {
        const [current] = tracking.subscriptions(entry.id);
        if (!current || current.revision !== entry.revision) break;
        ({ event } = await checkEntry(tracking, sources, current, options));
      }
      if (event.status === 'changed') {
        event = {
          id: entry.id,
          sourceId: entry.sourceId,
          status: 'failed',
          problem: 'check-conflict',
        };
      }
    }
    options.onCheck(event);
    if (event.status === 'failed') failures++;
    if ('queued' in event) queued += event.queued;
  }
  return { failures, queued };
}

async function verifyOutputMarker(file: string) {
  const marker = await lstat(file).catch(() => undefined);
  if (!marker?.isFile()) {
    throw new OutputUnavailableError('Output marker unavailable.');
  }
}

async function downloadPending(
  tracking: ShelfTracking,
  entry: TrackedEntry,
  series: Series,
  options: WatchOptions,
) {
  if (!tracking.isActive(entry)) return;
  const now = options.now ?? Date.now;
  tracking.refreshPresence(
    entry,
    series.chapters.map((chapter) => chapter.id),
    now(),
  );
  const tasks = new Map(
    tracking.tasks(entry, now()).map((task) => [task.id, task]),
  );
  const chapters = series.chapters
    .map((chapter, index) => numberedChapter(chapter, index + 1))
    .filter((chapter) => tasks.has(chapter.id))
    .slice(0, maxChaptersPerBatch);
  if (!chapters.length) return;

  const changed = new AbortController();
  const signal = AbortSignal.any([options.signal, changed.signal]);
  const validateOutput = options.outputRoot
    ? createOutputGuard(
        options.outputRoot,
        options.directory,
        options.outputMarker,
      )
    : options.outputMarker
      ? () => verifyOutputMarker(join(options.directory, options.outputMarker!))
      : undefined;
  const cancellations = new Map(
    chapters.map((chapter) => [chapter.id, new AbortController()]),
  );
  const outputAvailable = async () => {
    try {
      await validateOutput?.();
      return !signal.aborted;
    } catch (error) {
      if (!(error instanceof OutputUnavailableError)) throw error;
      if (!signal.aborted) {
        changed.abort();
        const time = now();
        tracking.deferDownloads(entry, time, time + minute);
        options.onOutputUnavailable?.();
      }
      return false;
    }
  };
  if (!(await outputAvailable())) return;
  const monitor = setInterval(() => {
    try {
      if (!tracking.isActive(entry)) changed.abort();
      for (const [chapterId, control] of cancellations) {
        if (
          !tracking.taskActive(
            entry.id,
            chapterId,
            entry.catalogVersion,
            tasks.get(chapterId)!.revision,
          )
        )
          control.abort();
      }
    } catch (error) {
      changed.abort(error);
    }
  }, 250).unref();
  try {
    await downloadSeries(
      entry.sourceId,
      { ...series, chapters },
      {
        directory: options.directory,
        jobs: options.jobs,
        retries: options.retries ?? defaultRetries,
        signal,
        validateOutput,
        archive: options.archive,
        requireExistingDirectory: options.outputRoot !== undefined,
        origin: 'shelf',
        entryId: entry.id,
        workTitle: series.metadata?.title ?? entry.title,
        taskSignal: (id) => {
          const control = cancellations.get(id);
          if (
            !tracking.taskActive(
              entry.id,
              id,
              entry.catalogVersion,
              tasks.get(id)!.revision,
            )
          )
            control?.abort();
          return control?.signal;
        },
        onEvent: options.onEvent,
        async onResult(result, retryable) {
          if (validateOutput && !(await outputAvailable())) return;
          const task = tasks.get(result.chapterId)!;
          let state: TaskEvent['state'];
          let delay = 0;
          switch (result.status) {
            case 'downloaded':
            case 'skipped':
              state = 'complete';
              break;
            case 'restricted':
              state = 'restricted';
              delay = restrictedDelay;
              break;
            default:
              state = retryable ? 'retry' : 'blocked';
              if (retryable) delay = retryDelay(task.failures);
          }
          if (tracking.finishTask(entry, task, state, now() + delay)) {
            options.onTask({ entryId: entry.id, chapterId: task.id, state });
          } else if (!tracking.isActive(entry)) {
            changed.abort();
          }
        },
      },
    );
  } finally {
    clearInterval(monitor);
  }
}

export async function runShelfCycle(
  tracking: ShelfTracking,
  sources: SourceRegistry,
  entries: readonly TrackedEntry[],
  options: WatchOptions,
) {
  for (const entry of entries) {
    const now = (options.now ?? Date.now)();
    if (entry.autoCheck && entry.nextCheck <= now) {
      const { series, event } = await checkEntry(
        tracking,
        sources,
        entry,
        options,
      );
      options.onCheck(event);
      if (series) await downloadPending(tracking, entry, series, options);
    } else {
      const result = await readCatalog(sources, entry, options);
      if ('series' in result)
        await downloadPending(tracking, entry, result.series, options);
      else
        tracking.deferDownloads(
          entry,
          now,
          now + retryDelay(entry.checkFailures),
        );
    }
  }
}

export async function watchShelf(
  tracking: ShelfTracking,
  withSources: (
    run: (sources: SourceRegistry) => Promise<void>,
  ) => Promise<void>,
  options: WatchOptions,
) {
  if (options.outputRoot)
    createOutputGuard(
      options.outputRoot,
      options.directory,
      options.outputMarker,
    );
  const release = tracking.acquireWatcher();
  try {
    for (;;) {
      options.signal.throwIfAborted();
      const now = (options.now ?? Date.now)();
      const entries = tracking.due(now);
      if (entries.length) {
        await withSources((sources) =>
          runShelfCycle(tracking, sources, entries, options),
        );
      } else {
        const next = tracking.nextDue();
        // A different CLI process can follow or retry work without waking this process.
        const wait =
          next == null
            ? shelfPoll
            : Math.min(shelfPoll, Math.max(0, next - now));
        await setTimeout(wait, undefined, { signal: options.signal });
      }
    }
  } finally {
    release();
  }
}
