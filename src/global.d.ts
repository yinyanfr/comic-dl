/**
 * MIT License
 * Copyright (c) 2023 Yan
 */

interface Configs {
  cookie?: string;
  timeout?: number;
  silence?: boolean;
  batchSize?: number;
  verbose?: boolean;
  archive?: 'zip' | 'cbz' | boolean;
  headers?: Record<string, any>;
  maxTitleLength?: number;
  zipLevel?: number;
  format?: string;
  indexedChapters?: boolean;
}

interface CliOptions {
  module: string;
  url: string;
  name: string;
  output: string;
  cookie: string;
  from: number;
  to: number;
  archive: 'zip' | 'cbz' | boolean;
  timeout: number;
  silence: boolean;
  batch: number;
  verbose: boolean;
  yes: boolean;
  maxTitleLength: number; // max-title-length
  zipLevel: number; // zip-level
  retry: boolean | number;
  chapters: string | number; // 1,2,4,7 as string or a single number
  info: boolean;
  format: string;
  override: boolean;
  presets: string; // path
  auth: string;
  group: string;
  indexedChapters: boolean; // indexed-chapters
  history: boolean | string; // path
  shorthandUrl: boolean | string;
  list: string;
  kavita: boolean;
  [key: string]: any; // for future modules
}

interface Chapter {
  index: number;
  name: string;
  uri?: string;
  options?: Record<string, any>; // this passes to getImageList
}

/**
 * ComicInfo.xml
 * https://anansi-project.github.io/docs/comicinfo/documentation
 */
interface ComicInfo {
  Serie?: string; // serie title
  Summary?: string;
  Writer?: string;
  Penciller?: string;
  Language?: string;
  Genre?: string;
  Year?: string;
  Month?: string;
  Day?: string;
  Location?: string;
  Count?: string | number;
  Tags?: string;
  Web?: string;
  Note?: string;
  Manga?: 'YesAndRightToLeft';
  Status?: 'Ongoing' | 'End' | 'Abandoned' | 'Hiatus'; // This one isn't in the schema but it should
  [Key: string]: any; // and many more
}

interface WriteInfoOptions {
  output?: boolean | string;
  rename?: string;
  filename?: string;
}

/**
 * This is what getSerieInfo returns
 */
interface SerieInfo {
  title: string;
  chapters: Chapter[];
  info?: ComicInfo;
}

interface DownloadProgress {
  index?: number;
  name: string;
  uri?: string;
  status: 'completed' | 'failed' | 'skipped';
  failed?: number;
  options?: Record<string, any>; // options from Chapter
}

interface SerieDownloadOptions {
  start?: number;
  end?: number;
  rename?: string;
  retry?: boolean | number;
  chapters?: number[];
  confirm?: boolean;
  info?: boolean;
  override?: boolean;
  group?: string;
  kavita?: boolean;
  onProgress?: (progress: DownloadProgress) => void;
}

interface ImageDownloadOptions {
  imageName?: string;
  title?: string;
  archive?: Archiver;
}

interface ChapterDownloadOptions {
  index?: number;
  title?: string;
  info?: ComicInfo;
  override?: boolean;
  onProgress?: (progress: DownloadProgress) => void;
}

interface SegmentDownloadOptions {
  offset?: number;
  title?: string;
  archive?: Archiver;
}

type Command = (
  name: string,
  sub: string[],
  options?: Partial<CliOptions>,
) => void;
