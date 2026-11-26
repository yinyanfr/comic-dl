import { createSourceHttp, SourceHttpError } from './sources/http.js';
import {
  imageExtensions,
  RestrictedChapterError,
  TransientSourceError,
} from './sources/source.js';
import type { ChapterSource } from './sources/source.js';

export type {
  Chapter,
  ChapterSource,
  ImageExtension,
  Page,
  SearchPage,
  Series,
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
  matchesUrl?(url: URL, kind: 'series' | 'chapter'): boolean;
  create(api: SourceExtensionApi): ChapterSource;
}
