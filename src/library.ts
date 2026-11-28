import { outputPath } from './config.js';
import { randomUUID } from 'node:crypto';
import { createOutputGuard } from './output/guard.js';
import { validateArchive } from './output/naming.js';
import type { ArchiveOptions } from './output/naming.js';
import type {
  DownloadEvent,
  DownloadTaskHandle,
  DownloadTaskSnapshot,
} from './tasks.js';
import { taskId } from './tasks.js';
import {
  defaultJobs,
  defaultRetries,
  downloadSeries,
  resolveDownloadSeries,
  retrySourceRead,
  selectChapters,
} from './download.js';
import type { ChapterResult } from './download.js';
import { withExtensions } from './extension-store.js';
import {
  importExtension,
  moduleSpecifier,
  SourceRegistry,
} from './sources/index.js';
import type { SearchPage, Series, SourceExtension } from './extension.js';
import type { ShelfHandle, ShelfOptions } from './shelf-types.js';
import type {
  CatalogMode,
  CatalogOptions,
  OptionChoice,
  OptionValues,
  SettingDefinition,
  SettingsBySource,
} from './source-options.js';

export { readConfig, sourceOverrides } from './config.js';
export type { CliConfig as ComicDlConfig } from './config.js';
export type { ChapterResult } from './download.js';
export type { ArchiveOptions } from './output/naming.js';
export {
  planArchiveMigration,
  applyArchiveMigration,
} from './output/migration.js';
export type {
  ArchiveMigrationEntry,
  ArchiveMigrationItem,
} from './output/migration.js';
export type {
  DownloadEvent,
  DownloadTaskSnapshot,
  DownloadTaskHandle,
  DownloadState,
} from './tasks.js';
export type { SeriesMetadata, CoverImage } from './extension.js';
export {
  manageExtensions,
  listManagedExtensions,
  checkExtensionUpdates,
} from './extension-store.js';
export type {
  ExtensionAction,
  ExtensionChange,
  ExtensionStoreOptions,
  ManagedExtension,
  ExtensionUpdate,
} from './extension-store.js';
export type {
  CheckEvent,
  CheckProblem,
  ShelfAttention,
  ShelfCheckOptions,
  ShelfCheckResult,
  ShelfEntry,
  ShelfHandle,
  ShelfOptions,
  ShelfReadOptions,
  ShelfStatus,
  ShelfWatchOptions,
  TaskEvent,
  ShelfAutomation,
  ShelfChapter,
} from './shelf-types.js';
export type { SettingsBySource } from './source-options.js';
export { fixtureExtension } from './sources/fixture.js';
export { SourceOptionError } from './source-options.js';

export interface SourceOptions {
  source?: string;
  signal?: AbortSignal;
}

export interface DownloadOptions extends SourceOptions {
  directory?: string;
  jobs?: number;
  retries?: number;
  onResult?: (result: ChapterResult) => void;
  onEvent?: (event: DownloadEvent) => void;
  archive?: ArchiveOptions;
  outputRoot?: string;
  outputMarker?: string;
  /** Distinguish simultaneous manual submissions of the same chapter. */
  taskScope?: string;
}

export interface SeriesDownloadOptions extends DownloadOptions {
  chapters?: readonly string[];
}

export interface ChapterDownloadOptions extends DownloadOptions {
  /** Select a single chapter ID from a fixture series manifest. */
  chapterId?: string;
}

export interface DownloaderOptions {
  source?: string;
  sourceSettings?: SettingsBySource;
  overrides?: SettingsBySource;
  output?: string;
  jobs?: number;
  retries?: number;
  archive?: ArchiveOptions;
}

export interface ManagedDownloaderOptions extends DownloaderOptions {
  extensions?: readonly string[];
  extensionDirectory?: string;
  signal?: AbortSignal;
  onLoadError?: (cause: unknown) => void;
}

export interface SearchOptions extends CatalogOptions, SourceOptions {
  page?: number;
}

export interface CatalogDescription {
  sorts: readonly OptionChoice[];
  filters: NonNullable<CatalogMode['filters']>;
}

export interface Downloader {
  use(extension: SourceExtension, settings?: OptionValues): Downloader;
  sources(): string[];
  sourceSettings(source: string): Readonly<Record<string, SettingDefinition>>;
  resolveSource(
    input: string,
    kind?: 'series' | 'chapter',
    explicit?: string,
  ): string;
  validateSourceSettings(
    source: string,
    candidate?: OptionValues,
  ): OptionValues;
  validateOverrides(): void;
  catalogOptions(
    source?: string,
    query?: string,
    signal?: AbortSignal,
  ): Promise<CatalogDescription>;
  search(query: string, options?: SearchOptions): Promise<SearchPage>;
  list(input: string, options?: SourceOptions): Promise<Series>;
  download(
    input: string,
    options?: SeriesDownloadOptions,
  ): Promise<ChapterResult[]>;
  downloadChapter(
    input: string,
    options?: ChapterDownloadOptions,
  ): Promise<ChapterResult>;
  openShelf(options?: ShelfOptions): Promise<ShelfHandle>;
  readCover(
    id: string,
    options?: SourceOptions,
  ): Promise<import('./extension.js').CoverImage>;
  startDownload(
    input: string,
    options?: SeriesDownloadOptions & { direct?: boolean },
  ): DownloadTaskHandle;
}

export async function loadExtension(input: string | URL) {
  if (typeof input !== 'string' && input.protocol !== 'file:')
    throw new Error('Extension URLs must use the file: protocol');
  return importExtension(
    typeof input === 'string' ? moduleSpecifier(input) : input.href,
    String(input),
  );
}

function bindDownloader(
  sources: SourceRegistry,
  defaults: DownloaderOptions,
): Downloader {
  function resolveSource(
    input: string,
    kind: 'series' | 'chapter' = 'series',
    explicit?: string,
  ) {
    sources.validateOverrides();
    const id = explicit ?? defaults.source ?? sources.match(input, kind);
    if (!sources.ids().includes(id)) throw new Error(`Unknown source: ${id}.`);
    return id;
  }

  async function download(
    input: string,
    kind: 'series' | 'chapter',
    {
      source,
      directory = defaults.output ?? (kind === 'series' ? '.' : undefined),
      jobs = defaults.jobs ?? defaultJobs,
      retries = defaults.retries ?? defaultRetries,
      signal = new AbortController().signal,
      onResult,
      onEvent,
      archive = defaults.archive,
      outputRoot,
      outputMarker,
      taskScope,
    }: DownloadOptions,
    selections?: readonly string[],
    fixtureChapter = false,
    onResolvedChapter?: (id: string, rawChapterId: string) => void,
  ) {
    if (directory === undefined)
      throw new Error('Provide a chapter output directory');
    if (!Number.isSafeInteger(jobs) || jobs < 1) {
      throw new RangeError('jobs must be a positive integer');
    }
    if (!Number.isSafeInteger(retries) || retries < 0) {
      throw new RangeError('retries must be a non-negative integer');
    }
    signal.throwIfAborted();
    validateArchive(archive);
    const validateOutput =
      outputRoot === undefined
        ? undefined
        : createOutputGuard(
            outputPath(outputRoot),
            outputPath(directory),
            outputMarker,
          );
    if (outputMarker && !outputRoot)
      throw new Error('Manual downloads require outputRoot with outputMarker');
    await validateOutput?.();
    const adapter = sources.create(resolveSource(input, kind, source));
    if (fixtureChapter && adapter.id !== 'fixture')
      throw new Error('chapterId is only supported for a fixture series');
    const locator = adapter.id === 'fixture' ? outputPath(input) : input;
    const series = await retrySourceRead(
      () =>
        resolveDownloadSeries(
          adapter,
          locator,
          kind === 'chapter' && !fixtureChapter,
          signal,
        ),
      signal,
      retries,
    );
    const selected = selections?.length
      ? selectChapters(series, selections, !fixtureChapter)
      : series;
    const results: ChapterResult[] = [];
    for (const chapter of selected.chapters)
      onResolvedChapter?.(
        taskId(adapter.id, selected.id, chapter.id, taskScope),
        chapter.id,
      );
    await downloadSeries(adapter.id, selected, {
      directory: outputPath(directory),
      archive,
      onEvent,
      validateOutput,
      taskScope,
      requireExistingDirectory: outputRoot !== undefined,
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
  }

  return {
    use(extension: SourceExtension, settings?: OptionValues) {
      sources.use(extension, undefined, settings);
      return this;
    },
    sources() {
      sources.validateOverrides();
      return sources.ids();
    },
    sourceSettings(source: string) {
      sources.validateOverrides();
      return sources.settings(source);
    },
    resolveSource,
    validateSourceSettings(source: string, candidate?: OptionValues) {
      return sources.resolvedSettings(source, candidate);
    },
    validateOverrides() {
      sources.validateOverrides();
    },
    async catalogOptions(
      source = defaults.source,
      query = '',
      signal: AbortSignal = new AbortController().signal,
    ) {
      sources.validateOverrides();
      if (!source) throw new Error('Provide a source for catalog options');
      return sources.catalog(source, query, signal);
    },
    async search(
      query: string,
      {
        source = defaults.source,
        page = 1,
        sort,
        filters,
        signal = new AbortController().signal,
      }: SearchOptions = {},
    ) {
      sources.validateOverrides();
      if (!source) throw new Error('Provide a source for search');
      const search = await sources.prepareSearch(source, query, page, signal, {
        sort,
        filters,
      });
      return retrySourceRead(search, signal);
    },
    async list(
      input: string,
      { source, signal = new AbortController().signal }: SourceOptions = {},
    ) {
      signal.throwIfAborted();
      const adapter = sources.create(resolveSource(input, 'series', source));
      const locator = adapter.id === 'fixture' ? outputPath(input) : input;
      return retrySourceRead(
        () => adapter.getSeries(locator, signal),
        signal,
        defaults.retries,
      );
    },
    download(
      input: string,
      { chapters, ...options }: SeriesDownloadOptions = {},
    ) {
      return download(input, 'series', options, chapters && [...chapters]);
    },
    async downloadChapter(
      input: string,
      { chapterId, ...options }: ChapterDownloadOptions = {},
    ) {
      const [result] = await download(
        input,
        'chapter',
        options,
        chapterId === undefined ? undefined : [chapterId],
        chapterId !== undefined,
      );
      return result;
    },
    async openShelf(options?: ShelfOptions): Promise<ShelfHandle> {
      const { openShelf } = await import('./shelf-api.js');
      return openShelf(sources, resolveSource, defaults, options);
    },
    async readCover(
      id,
      { source = defaults.source, signal = new AbortController().signal } = {},
    ) {
      signal.throwIfAborted();
      sources.validateOverrides();
      if (!source) throw new Error('Provide a source for cover reading');
      const adapter = sources.create(source);
      if (!adapter.readCover)
        throw new Error('Source does not support cover reading');
      const image = await adapter.readCover(id, signal);
      signal.throwIfAborted();
      if (
        !['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(
          image.contentType,
        ) ||
        !(image.bytes instanceof Uint8Array) ||
        !image.bytes.length ||
        image.bytes.length > 10 * 1024 * 1024
      )
        throw new Error('Invalid cover image');
      return { contentType: image.contentType, bytes: image.bytes };
    },
    startDownload(input, options = {}) {
      const snapshots = new Map<string, DownloadTaskSnapshot>();
      const chapterIds = new Map<string, string>();
      const scope = randomUUID();
      let control = new AbortController();
      let running = false;
      let selections = options.chapters;
      const run = async () => {
        if (running) throw new Error('Download task is already running');
        running = true;
        try {
          await download(
            input,
            options.direct ? 'chapter' : 'series',
            {
              ...options,
              taskScope: scope,
              signal: options.signal
                ? AbortSignal.any([options.signal, control.signal])
                : control.signal,
              onEvent(event) {
                snapshots.set(event.task.id, { ...event.task });
                options.onEvent?.(event);
              },
            },
            selections,
            false,
            (id, chapterId) => chapterIds.set(id, chapterId),
          );
        } finally {
          for (const [id, snapshot] of snapshots) {
            if (
              ['queued', 'starting', 'reading', 'archiving'].includes(
                snapshot.state,
              )
            ) {
              const task: DownloadTaskSnapshot = {
                ...snapshot,
                state:
                  control.signal.aborted || options.signal?.aborted
                    ? 'cancelled'
                    : 'failed',
                retryable: true,
              };
              snapshots.set(id, task);
              options.onEvent?.({ type: 'task', task: { ...task } });
            }
          }
          running = false;
        }
      };
      const done = run();
      return {
        done,
        snapshot: () =>
          [...snapshots.values()].map((snapshot) => ({ ...snapshot })),
        cancel: () => control.abort(),
        async retry() {
          if (running) throw new Error('Download task is already running');
          selections = [...snapshots.entries()]
            .filter(([, task]) => task.retryable)
            .map(([id]) => {
              const chapterId = chapterIds.get(id);
              if (chapterId === undefined)
                throw new Error('Missing private chapter identity');
              return chapterId;
            });
          if (!selections.length) throw new Error('No retryable chapters');
          control = new AbortController();
          await run();
        },
      };
    },
  };
}

export function createDownloader(options: DownloaderOptions = {}) {
  const defaults = structuredClone(options);
  const sources = new SourceRegistry(
    defaults.sourceSettings,
    defaults.overrides,
  );
  return bindDownloader(sources, defaults);
}

export async function withManagedDownloader<T>(
  {
    extensions = [],
    extensionDirectory,
    signal = new AbortController().signal,
    onLoadError,
    ...defaults
  }: ManagedDownloaderOptions,
  run: (downloader: Downloader) => Promise<T>,
): Promise<T> {
  const sources = new SourceRegistry(
    defaults.sourceSettings,
    defaults.overrides,
  );
  return withExtensions(
    sources,
    [...extensions],
    signal,
    () => {
      sources.validateOverrides();
      return run(bindDownloader(sources, defaults));
    },
    onLoadError,
    extensionDirectory,
  );
}

export default createDownloader();
