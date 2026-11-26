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
  getPages(signal: AbortSignal): Promise<readonly Page[]>;
}

export interface Series {
  readonly id: string;
  readonly chapters: readonly Chapter[];
}

export interface ChapterSource {
  readonly id: string;
  getSeries(input: string, signal: AbortSignal): Promise<Series>;
  getChapter(
    input: string,
    signal: AbortSignal,
  ): Promise<{ workId: string; chapter: Chapter }>;
}

export class TransientSourceError extends Error {}
