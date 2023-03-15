interface Configs {
  cookie?: string;
  timeout?: number;
  silence?: boolean;
  batchSize?: number;
  verbose?: boolean;
  archive?: "zip" | "cbz" | boolean;
  headers?: Record<string, any>;
  maxTitleLength?: number;
  zipLevel?: number;
}

interface Chapter {
  index: number;
  name: string;
  uri: string | null;
}

interface DownloadProgress {
  index?: number;
  name: string;
  status: "completed" | "failed";
  failed?: number;
}

interface SerieDownloadOptions {
  start?: number;
  end?: number;
  confirm?: boolean;
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
  onProgress?: (progress: DownloadProgress) => void;
}

interface CliOptions {
  url: string;
  name: string;
  output: string;
  cookie: string;
  from: number;
  to: number;
  archive: "zip" | "cbz" | boolean;
  timeout: number;
  silence: boolean;
  batch: number;
  verbose: boolean;
  yes: boolean;
  m: number; // max-title-length
  z: number; // zip-level
}

type Command = (
  name: string,
  sub: string[],
  options?: Partial<CliOptions>
) => void;
