import { setTimeout } from 'node:timers/promises';
import { saveCbz } from './output/cbz.js';
import { TransientSourceError } from './sources/source.js';
import type { Chapter, Page, Series } from './sources/source.js';

export type ChapterResult = { chapterId: string; attempts: number } & (
  | { status: 'downloaded' | 'skipped'; path: string }
  | { status: 'failed'; error: string }
);

interface DownloadOptions {
  directory: string;
  jobs: number;
  retries: number;
  signal: AbortSignal;
  onResult: (result: ChapterResult) => void;
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
      throw new PageError(`Page ${index + 1} (${page.id}): ${reason}`, {
        cause,
      });
    }
  }
}

async function downloadChapter(
  sourceId: string,
  workId: string,
  chapter: Chapter,
  { directory, retries, signal }: DownloadOptions,
): Promise<ChapterResult> {
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
      );
      return { ...result, chapterId, attempts };
    } catch (error) {
      signal.throwIfAborted();
      if (!(error instanceof TransientSourceError) || attempts > retries) {
        return {
          chapterId,
          attempts,
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
        };
      }
      await setTimeout(100 * 2 ** Math.min(attempts - 1, 4), undefined, {
        signal,
      });
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
  async function worker() {
    while (!signal.aborted) {
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
      onResult(result);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(jobs, series.chapters.length) }, worker),
  );
}
