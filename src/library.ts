import { defaultRetries, downloadSeries, retrySourceRead } from './download.js';
import type { ChapterResult } from './download.js';
import { SourceRegistry } from './sources/index.js';
import type { SourceExtension } from './extension.js';

export type { ChapterResult } from './download.js';

export interface SourceOptions {
  source?: string;
  signal?: AbortSignal;
}

export interface DownloadOptions extends SourceOptions {
  directory?: string;
  jobs?: number;
  retries?: number;
  onResult?: (result: ChapterResult) => void;
}

export function createDownloader() {
  const sources = new SourceRegistry();

  return {
    use(extension: SourceExtension) {
      sources.use(extension);
      return this;
    },
    sources() {
      return sources.ids();
    },
    async list(
      input: string,
      { source, signal = new AbortController().signal }: SourceOptions = {},
    ) {
      signal.throwIfAborted();
      const adapter = sources.create(source ?? sources.match(input, 'series'));
      return retrySourceRead(() => adapter.getSeries(input, signal), signal);
    },
    async download(input: string, options: DownloadOptions = {}) {
      const {
        source,
        directory = '.',
        jobs = 2,
        retries = defaultRetries,
        signal = new AbortController().signal,
        onResult,
      } = options;
      if (!Number.isSafeInteger(jobs) || jobs < 1) {
        throw new RangeError('jobs must be a positive integer');
      }
      if (!Number.isSafeInteger(retries) || retries < 0) {
        throw new RangeError('retries must be a non-negative integer');
      }
      signal.throwIfAborted();
      const adapter = sources.create(source ?? sources.match(input, 'series'));
      const series = await retrySourceRead(
        () => adapter.getSeries(input, signal),
        signal,
        retries,
      );
      const results: ChapterResult[] = [];
      await downloadSeries(adapter.id, series, {
        directory,
        jobs,
        retries,
        signal,
        onResult(result) {
          results.push(result);
          return onResult?.(result);
        },
      });
      signal.throwIfAborted();
      return results;
    },
  };
}

export default createDownloader();
