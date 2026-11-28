import { setTimeout } from 'node:timers/promises';
import { OutputUnavailableError, saveCbz } from './output/cbz.js';
import type { ArchiveIndex } from './output/cbz.js';
import {
  RestrictedChapterError,
  TransientSourceError,
} from './sources/source.js';
import type { Chapter, ChapterSource, Page, Series } from './sources/source.js';
import { safeText, taskId } from './tasks.js';
import type { DownloadEvent, DownloadTaskSnapshot } from './tasks.js';
import type { ArchiveOptions } from './output/naming.js';

export type ChapterResult = {
  chapterId: string;
  attempts: number;
  sourceId: string;
  workId: string;
  workTitle: string;
  chapterTitle: string;
  number?: number;
} & (
  | { status: 'downloaded' | 'skipped'; path: string }
  | { status: 'failed' | 'restricted'; error: string }
);

export const defaultRetries = 2;
export const defaultJobs = 2;

export function numberedChapter(chapter: Chapter, number: number): Chapter {
  return {
    id: chapter.id,
    title: chapter.title,
    number,
    getPages: (signal) => chapter.getPages(signal),
  };
}

export async function resolveDownloadSeries(
  source: ChapterSource,
  input: string,
  direct: boolean,
  signal: AbortSignal,
): Promise<Series> {
  if (!direct) {
    const series = await source.getSeries(input, signal);
    return {
      ...series,
      chapters: series.chapters.map((chapter, index) =>
        numberedChapter(chapter, index + 1),
      ),
    };
  }
  const resolved = await source.getChapter(input, signal);
  const { workId, chapter } = resolved;
  if (resolved.seriesInput) {
    const series = await source.getSeries(resolved.seriesInput, signal);
    if (series.id !== workId)
      throw new Error('Chapter resolved to a different work');
    const index = series.chapters.findIndex((item) => item.id === chapter.id);
    if (index < 0)
      throw new Error('Chapter is missing from the canonical catalog');
    return {
      ...series,
      chapters: [numberedChapter(series.chapters[index], index + 1)],
    };
  }
  return { id: workId, metadata: resolved.metadata, chapters: [chapter] };
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
    chapters: series.chapters
      .map((chapter, index) =>
        numberedChapter(chapter, chapter.number ?? index + 1),
      )
      .filter((_, index) => selected.has(index)),
  };
}

interface DownloadOptions {
  directory: string;
  jobs: number;
  retries: number;
  signal: AbortSignal;
  onResult: (result: ChapterResult, retryable: boolean) => void | Promise<void>;
  validateOutput?: () => Promise<void>;
  archive?: ArchiveOptions;
  onEvent?: (event: DownloadEvent) => void;
  origin?: 'manual' | 'shelf';
  entryId?: string;
  workTitle?: string;
  taskScope?: string;
  taskSignal?: (chapterId: string) => AbortSignal | undefined;
  requireExistingDirectory?: boolean;
  archiveIndex?: ArchiveIndex;
}

async function* readPages(
  pages: readonly Page[],
  signal: AbortSignal,
  progress?: (count: number) => void,
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
      progress?.(index + 1);
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
  options: DownloadOptions,
): Promise<{ result: ChapterResult; retryable: boolean }> {
  const chapterId = chapter.id;
  const { directory, retries, signal } = options;
  const validateOutput = async () => {
    options.taskSignal?.(chapter.id)?.throwIfAborted();
    signal.throwIfAborted();
    await options.validateOutput?.();
  };
  const snapshot: DownloadTaskSnapshot = {
    id: taskId(
      sourceId,
      workId,
      chapterId,
      options.taskScope ?? options.entryId,
    ),
    origin: options.origin ?? 'manual',
    entryId: options.entryId,
    sourceId: safeText(sourceId),
    workId: safeText(workId),
    workTitle: safeText(options.workTitle ?? workId),
    chapterId: safeText(chapterId),
    chapterTitle: safeText(chapter.title),
    number: chapter.number,
    state: 'queued',
    pagesDownloaded: 0,
    attempt: 0,
    retryable: false,
  };
  const emit = (change: Partial<DownloadTaskSnapshot>) => {
    Object.assign(snapshot, change);
    options.onEvent?.({ type: 'task', task: { ...snapshot } });
  };
  const description = {
    sourceId: snapshot.sourceId,
    workId: snapshot.workId,
    workTitle: snapshot.workTitle,
    chapterTitle: snapshot.chapterTitle,
    number: snapshot.number,
  };
  for (let attempts = 1; ; attempts++) {
    if (signal.aborted) emit({ state: 'cancelled', retryable: true });
    signal.throwIfAborted();
    try {
      emit({
        state: 'starting',
        attempt: attempts,
        pagesDownloaded: 0,
        totalPages: undefined,
      });
      const pages = await chapter.getPages(signal);
      if (!pages.length) {
        throw new Error('Chapter has no pages');
      }
      const result = await saveCbz(
        directory,
        {
          identity: [sourceId, workId, chapterId],
          pages,
          contents: readPages(pages, signal, (count) =>
            emit({
              state: 'reading',
              pagesDownloaded: count,
              totalPages: pages.length,
            }),
          ),
          title: chapter.title,
          workTitle: options.workTitle ?? workId,
          number: chapter.number,
          archive: options.archive,
          requireExistingDirectory: options.requireExistingDirectory,
          index: options.archiveIndex,
        },
        signal,
        validateOutput,
        () => emit({ state: 'archiving' }),
      );
      emit({
        state: result.status,
        totalPages: pages.length,
        pagesDownloaded: pages.length,
      });
      return {
        result: { ...result, ...description, chapterId, attempts },
        retryable: false,
      };
    } catch (error) {
      if (signal.aborted) {
        emit({ state: 'cancelled', retryable: true });
        signal.throwIfAborted();
      }
      if (!(await waitForRetry(error, attempts, retries, signal))) {
        emit({
          state:
            error instanceof RestrictedChapterError ? 'restricted' : 'failed',
          retryable: true,
          problem:
            error instanceof RestrictedChapterError
              ? 'access-restricted'
              : error instanceof OutputUnavailableError
                ? 'output-unavailable'
                : 'download-failed',
        });
        return {
          result: {
            ...description,
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
  const archiveIndex: ArchiveIndex = { signal };
  const normalized = series.chapters;
  for (const chapter of normalized)
    options.onEvent?.({
      type: 'task',
      task: {
        id: taskId(
          sourceId,
          series.id,
          chapter.id,
          options.taskScope ?? options.entryId,
        ),
        origin: options.origin ?? 'manual',
        entryId: options.entryId,
        sourceId: safeText(sourceId),
        workId: safeText(series.id),
        workTitle: safeText(
          options.workTitle ?? series.metadata?.title ?? series.id,
        ),
        chapterId: safeText(chapter.id),
        chapterTitle: safeText(chapter.title),
        number: chapter.number,
        state: 'queued',
        pagesDownloaded: 0,
        attempt: 0,
        retryable: false,
      },
    });
  const chapters = normalized.values();
  let callbackFailure: { error: unknown } | undefined;
  async function worker() {
    while (!signal.aborted && !callbackFailure) {
      const next = chapters.next();
      if (next.done) {
        return;
      }
      let result;
      try {
        result = await downloadChapter(sourceId, series.id, next.value, {
          ...options,
          archiveIndex,
          workTitle: options.workTitle ?? series.metadata?.title,
          signal: options.taskSignal?.(next.value.id)
            ? AbortSignal.any([signal, options.taskSignal(next.value.id)!])
            : signal,
        });
      } catch (error) {
        if (signal.aborted) {
          return;
        }
        if (options.taskSignal?.(next.value.id)?.aborted) continue;
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
