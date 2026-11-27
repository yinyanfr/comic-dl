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

export function openShelf(
  sources: SourceRegistry,
  resolveSource: (input: string, kind: 'series', source?: string) => string,
  defaults: DownloaderOptions,
  { file = join(userDataDirectory(), 'shelf.sqlite') }: ShelfOptions = {},
): ShelfHandle {
  const shelf = new Shelf(outputPath(file));
  const { tracking } = shelf;

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
    close: () => shelf.close(),
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
    async check({ entryId, includeHistory, onCheck, ...options } = {}) {
      if (includeHistory && !entryId)
        throw new Error('includeHistory requires a specific subscription');
      const read = readOptions(options);
      const entries = tracking.subscriptions(entryId);
      if (entryId !== undefined && !entries.length)
        throw new Error('Subscription not found.');
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
      intervalSeconds = 3600,
      outputMarker,
      onCheck = () => {},
      onTask = () => {},
      onOutputUnavailable,
      retries,
    }) {
      if (!signal) throw new Error('Provide an AbortSignal for watch');
      if (!directory?.trim())
        throw new Error('Provide a watch output directory');
      if (!Number.isSafeInteger(jobs) || jobs < 1)
        throw new RangeError('jobs must be a positive integer');
      if (
        !Number.isSafeInteger(intervalSeconds) ||
        intervalSeconds < 1 ||
        intervalSeconds > 365 * 24 * 3600
      )
        throw new RangeError('intervalSeconds must be between 1 and 31536000');
      if (outputMarker !== undefined && !isOutputMarker(outputMarker))
        throw new Error(
          'outputMarker must be a filename inside the output directory',
        );
      const read = readOptions({ signal, retries });
      await watchShelf(tracking, (run) => run(sources), {
        ...read,
        directory: outputPath(directory),
        jobs,
        interval: intervalSeconds * 1000,
        outputMarker,
        onCheck,
        onTask,
        onOutputUnavailable,
      });
    },
  };
}
