import type { CatalogOptions, OptionChoice } from '../source-options.js';

export const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'] as const;
export type ImageExtension = (typeof imageExtensions)[number];

export interface Page {
  readonly id: string;
  readonly extension: ImageExtension;
  read(signal: AbortSignal): Promise<Uint8Array>;
}

export interface Chapter {
  readonly id: string;
  readonly title: string;
  /** One-based position in the complete canonical catalog, never a selection. */
  readonly number?: number;
  getPages(signal: AbortSignal): Promise<readonly Page[]>;
}

export interface Series {
  readonly id: string;
  readonly metadata?: SeriesMetadata;
  readonly chapters: readonly Chapter[];
}

export interface SeriesMetadata {
  readonly title?: string;
  readonly authors?: readonly string[];
  readonly summary?: string;
  readonly tags?: readonly string[];
  readonly coverUrl?: string;
  /** Opaque source-owned identifier, usable with readCover(), never a credential. */
  readonly coverId?: string;
}

export interface CoverImage {
  readonly contentType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
  readonly bytes: Uint8Array;
}

export interface SearchPage {
  readonly results: readonly {
    title: string;
    url: string;
    coverUrl?: string;
    coverId?: string;
  }[];
  readonly hasNext: boolean;
}

export interface ChapterSource {
  readonly id: string;
  readCover?(id: string, signal: AbortSignal): Promise<CoverImage>;
  search?(
    query: string,
    page: number,
    signal: AbortSignal,
    options?: CatalogOptions,
  ): Promise<SearchPage>;
  catalogChoices?(
    filter: string,
    mode: 'browse' | 'search',
    signal: AbortSignal,
  ): Promise<readonly OptionChoice[]>;
  getSeries(input: string, signal: AbortSignal): Promise<Series>;
  getChapter(
    input: string,
    signal: AbortSignal,
  ): Promise<{
    workId: string;
    chapter: Chapter;
    seriesInput?: string;
    metadata?: SeriesMetadata;
  }>;
}

export class TransientSourceError extends Error {}
export class RestrictedChapterError extends Error {}
