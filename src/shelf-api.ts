import { join } from 'node:path';
import { isOutputMarker, outputPath, userDataDirectory } from './config.js';
import { defaultJobs } from './download.js';
import type { DownloaderOptions } from './library.js';
import type {
  CheckEvent,
  ShelfHandle,
  ShelfOptions,
  ShelfReadOptions,
} from './shelf-types.js';
import { Shelf } from './shelf.js';
import { checkSubscriptions, watchShelf } from './shelf-updates.js';
import type { SourceRegistry } from './sources/index.js';
import type { DownloadTaskSnapshot } from './tasks.js';
import { validateArchive } from './output/naming.js';

export function openShelf(
  sources: SourceRegistry,
  resolveSource: (input: string, kind: 'series', source?: string) => string,
  defaults: DownloaderOptions,
  {
    file = join(userDataDirectory(), 'shelf.sqlite'),
    intervalSeconds,
  }: ShelfOptions = {},
): ShelfHandle {
  const shelf = new Shelf(outputPath(file));
  const { tracking } = shelf;
  if (intervalSeconds !== undefined)
    tracking.setDefaultInterval(intervalSeconds);
  const live = new Map<string, DownloadTaskSnapshot>();
  let watching = false;

  function readOptions({
    signal = new AbortController().signal,
    retries = defaults.retries,
  }: ShelfReadOptions = {}) {
    signal.throwIfAborted();
    if (
      retries !== undefined &&
      (!Number.isSafeInteger(retries) || retries < 0)
    )
      throw new RangeError('retries must be a non-negative integer');
    sources.validateOverrides();
    return { signal, retries };
  }

  return {
    close: () => {
      if (watching)
        throw new Error('Stop and await the watcher before closing the shelf');
      shelf.close();
    },
    list: () => shelf.list(),
    async add(
      input: string,
      options: ShelfReadOptions & { source?: string; title?: string } = {},
    ) {
      const read = readOptions(options);
      const source = resolveSource(input, 'series', options.source);
      return shelf.add(sources, source, input, {
        ...read,
        title: options.title,
      });
    },
    async setInput(id: string, input: string, options?: ShelfReadOptions) {
      return shelf.setInput(sources, id, input, readOptions(options));
    },
    follow: (id: string) => shelf.setFollowing(id, true),
    unfollow: (id: string) => shelf.setFollowing(id, false),
    remove: (id: string) => shelf.remove(id),
    status: (id?: string) => tracking.status(id),
    needsAttention: (id: string) => tracking.needsAttention(id),
    retry: (id: string, chapterId: string) => tracking.retry(id, chapterId),
    configure: (id, options) => shelf.configure(id, options),
    setDefaultInterval: (seconds) => tracking.setDefaultInterval(seconds),
    chapters: (id) => tracking.chapters(id),
    enqueue: (id, chapterId) => tracking.enqueue(id, chapterId),
    cancel: (id, chapterId) => tracking.cancel(id, chapterId),
    tasks: (id) =>
      tracking.snapshots(id).map((snapshot) => {
        const current = live.get(snapshot.id);
        if (
          current &&
          ['starting', 'reading', 'archiving'].includes(current.state) &&
          ['queued', 'retry', 'restricted'].includes(snapshot.state)
        )
          return { ...current };
        if (
          current &&
          (current.state === snapshot.state ||
            (snapshot.state === 'downloaded' && current.state === 'skipped'))
        )
          return { ...current, readyAt: snapshot.readyAt };
        return snapshot;
      }),
    async check({ entryId, includeHistory, onCheck, ...options } = {}) {
      if (includeHistory && !entryId)
        throw new Error('includeHistory requires a specific shelf entry');
      const read = readOptions(options);
      const entries = tracking.subscriptions(entryId);
      if (entryId !== undefined && !entries.length)
        throw new Error('Shelf entry not found.');
      const events: CheckEvent[] = [];
      const summary = await checkSubscriptions(tracking, sources, entries, {
        ...read,
        includeHistory,
        onCheck(event) {
          events.push(event);
          onCheck?.(event);
        },
      });
      return { checked: entries.length, ...summary, events };
    },
    async watch({
      signal,
      directory = defaults.output,
      jobs = defaults.jobs ?? defaultJobs,
      intervalSeconds,
      outputMarker,
      onCheck = () => {},
      onTask = () => {},
      onOutputUnavailable,
      retries,
      outputRoot,
      archive = defaults.archive,
      onEvent,
    }) {
      if (watching)
        throw new Error('This shelf handle already has a running watcher');
      if (!signal) throw new Error('Provide an AbortSignal for watch');
      if (!directory?.trim())
        throw new Error('Provide a watch output directory');
      if (!Number.isSafeInteger(jobs) || jobs < 1)
        throw new RangeError('jobs must be a positive integer');
      if (intervalSeconds !== undefined)
        tracking.setDefaultInterval(intervalSeconds);
      validateArchive(archive);
      if (outputMarker !== undefined && !isOutputMarker(outputMarker))
        throw new Error(
          'outputMarker must be a filename inside the output directory',
        );
      const read = readOptions({ signal, retries });
      watching = true;
      try {
        await watchShelf(tracking, (run) => run(sources), {
          ...read,
          directory: outputPath(directory),
          jobs,
          interval:
            intervalSeconds === undefined ? undefined : intervalSeconds * 1000,
          outputMarker,
          onCheck,
          onTask,
          onOutputUnavailable,
          outputRoot:
            outputRoot === undefined ? undefined : outputPath(outputRoot),
          archive,
          onEvent(event) {
            live.set(event.task.id, { ...event.task });
            onEvent?.(event);
          },
        });
      } finally {
        watching = false;
        live.clear();
      }
    },
  };
}
