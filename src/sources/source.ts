export type ImageExtension = 'jpg' | 'jpeg' | 'png' | 'gif' | 'webp';

export interface Page {
  readonly id: string;
  readonly extension: ImageExtension;
  read(): Promise<Uint8Array>;
}

export interface Chapter {
  readonly workId: string;
  readonly id: string;
  readonly pages: readonly Page[];
}

export interface ChapterSource {
  readonly id: string;
  getChapter(input: string): Promise<Chapter>;
}
