import { createSourceHttp, SourceHttpError } from './sources/http.js';
import {
  imageExtensions,
  RestrictedChapterError,
  TransientSourceError,
} from './sources/source.js';
import type { ChapterSource } from './sources/source.js';
import type {
  CatalogCapabilities,
  OptionValues,
  SettingDefinition,
} from './source-options.js';

export type {
  CatalogCapabilities,
  CatalogMode,
  CatalogOptions,
  OptionChoice,
  OptionDefinition,
  OptionValue,
  OptionValues,
  SettingDefinition,
} from './source-options.js';

export type {
  Chapter,
  ChapterSource,
  ImageExtension,
  Page,
  SearchPage,
  Series,
  SeriesMetadata,
  CoverImage,
} from './sources/source.js';

export const extensionApiVersion = 1;

export const sourceExtensionApi = Object.freeze({
  createSourceHttp,
  SourceHttpError,
  imageExtensions,
  RestrictedChapterError,
  TransientSourceError,
});

export type SourceExtensionApi = typeof sourceExtensionApi;

export interface SourceExtension {
  readonly apiVersion: typeof extensionApiVersion;
  readonly id: string;
  readonly settings?: Readonly<Record<string, SettingDefinition>>;
  readonly catalog?: CatalogCapabilities;
  /** Optional site-specific validation of resolved, non-secret settings. */
  validateSettings?(settings: OptionValues): void;
  matchesUrl?(
    url: URL,
    kind: 'series' | 'chapter',
    settings?: OptionValues,
  ): boolean;
  create(api: SourceExtensionApi, settings?: OptionValues): ChapterSource;
}
