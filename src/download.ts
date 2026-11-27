import { setTimeout } from 'node:timers/promises';
import { OutputUnavailableError, saveCbz } from './output/cbz.js';
import {
  RestrictedChapterError,
  TransientSourceError,
} from './sources/source.js';
import type { Chapter, ChapterSource, Page, Series } from './sources/source.js';

export type ChapterResult = { chapterId: string; attempts: number } & (
  | { status: 'downloaded' | 'skipped'; path: string }
  | { status: 'failed' | 'restricted'; error: string }
);

export const defaultRetries = 2;
export const defaultJobs = 2;

export async function resolveDownloadSeries(
  source: ChapterSource,
  input: string,
  direct: boolean,
  signal: AbortSignal,
): Promise<Series> {
  if (!direct) return source.getSeries(input, signal);
  const { workId, chapter } = await source.getChapter(input, signal);
  return { id: workId, chapters: [chapter] };
}

export function selectChapters(
  series: Series,
  selections: readonly string[],
  allowRanges = true,
): Series {
  const byId = new Map(
    series.chapters.map((chapter, index) => [chapter.id, index]),
  );
  const selected = new Set<number>();
  const unknown = new Set<string>();
  for (const selection of selections) {
    const index = byId.get(selection);
    if (index !== undefined) {
      selected.add(index);
      continue;
    }
    const range = allowRanges && /^(\d+)-(\d+)$/.exec(selection);
    if (!range) {
      unknown.add(selection);
      continue;
    }
    const first = Number(range[1]);
    const last = Number(range[2]);
    if (first < 1 || first > last || last > series.chapters.length) {
      throw new Error(
        `Invalid chapter range ${JSON.stringify(selection)}: use an ascending range within 1-${series.chapters.length}.`,
      );
    }
    for (let index = first - 1; index < last; index++) {
      selected.add(index);
    }
  }
  if (unknown.size) {
    throw new Error(
      `Unknown chapter ID(s): ${[...unknown].map((id) => JSON.stringify(id)).join(', ')}.`,
    );
  }
  return {
    ...series,
    chapters: series.chapters.filter((_, index) => selected.has(index)),
  };
}

interface DownloadOptions {
  directory: string;
  jobs: number;
  retries: number;
  signal: AbortSignal;
  onResult: (result: ChapterResult, retryable: boolean) => void | Promise<void>;
  validateOutput?: () => Promise<void>;
}

async function* readPages(
  pages: readonly Page[],
  signal: AbortSignal,
): AsyncIterable<Uint8Array> {
  for (const [index, page] of pages.entries()) {
    signal.throwIfAborted();
    try {
      const bytes = await page.read(signal);
      signal.throwIfAborted();
      if (!bytes.byteLength) {
        throw new Error('Empty image');
      }
      yield bytes;
    } catch (cause) {
      signal.throwIfAborted();
      const reason = cause instanceof Error ? cause.message : String(cause);
      const PageError =
        cause instanceof TransientSourceError ? TransientSourceError : Error;
      throw new PageError(`Page ${index + 1}: ${reason}`, {
        cause,
      });
    }
  }
}

async function waitForRetry(
  error: unknown,
  attempts: number,
  retries: number,
  signal: AbortSignal,
) {
  signal.throwIfAborted();
  if (!(error instanceof TransientSourceError) || attempts > retries) {
    return false;
  }
  await setTimeout(100 * 2 ** Math.min(attempts - 1, 4), undefined, { signal });
  return true;
}

export async function retrySourceRead<T>(
  read: () => Promise<T>,
  signal: AbortSignal,
  retries = defaultRetries,
): Promise<T> {
  for (let attempts = 1; ; attempts++) {
    signal.throwIfAborted();
    try {
      return await read();
    } catch (error) {
      if (!(await waitForRetry(error, attempts, retries, signal))) throw error;
    }
  }
}

async function downloadChapter(
  sourceId: string,
  workId: string,
  chapter: Chapter,
  { directory, retries, signal, validateOutput }: DownloadOptions,
): Promise<{ result: ChapterResult; retryable: boolean }> {
  const chapterId = chapter.id;
  for (let attempts = 1; ; attempts++) {
    signal.throwIfAborted();
    try {
      const pages = await chapter.getPages(signal);
      if (!pages.length) {
        throw new Error('Chapter has no pages');
      }
      const result = await saveCbz(
        directory,
        {
          identity: [sourceId, workId, chapterId],
          pages,
          contents: readPages(pages, signal),
        },
        signal,
        validateOutput,
      );
      return { result: { ...result, chapterId, attempts }, retryable: false };
    } catch (error) {
      if (!(await waitForRetry(error, attempts, retries, signal))) {
        return {
          result: {
            chapterId,
            attempts,
            status:
              error instanceof RestrictedChapterError ? 'restricted' : 'failed',
            error: error instanceof Error ? error.message : String(error),
          },
          retryable:
            error instanceof TransientSourceError ||
            error instanceof OutputUnavailableError,
        };
      }
    }
  }
}

export async function downloadSeries(
  sourceId: string,
  series: Series,
  options: DownloadOptions,
) {
  const { jobs, signal, onResult } = options;
  const chapters = series.chapters.values();
  let callbackFailure: { error: unknown } | undefined;
  async function worker() {
    while (!signal.aborted && !callbackFailure) {
      const next = chapters.next();
      if (next.done) {
        return;
      }
      let result;
      try {
        result = await downloadChapter(
          sourceId,
          series.id,
          next.value,
          options,
        );
      } catch (error) {
        if (signal.aborted) {
          return;
        }
        throw error;
      }
      if (!callbackFailure) {
        try {
          await Promise.resolve(onResult(result.result, result.retryable));
        } catch (error) {
          callbackFailure ??= { error };
        }
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(jobs, series.chapters.length) }, worker),
  );
  if (callbackFailure) throw callbackFailure.error;
}
