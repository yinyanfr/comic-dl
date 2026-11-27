import { createHash } from 'node:crypto';

export type DownloadState =
  | 'queued'
  | 'retry'
  | 'starting'
  | 'reading'
  | 'archiving'
  | 'downloaded'
  | 'skipped'
  | 'failed'
  | 'restricted'
  | 'cancelled';

/** Browser-safe projection: no paths, raw exceptions, or page request objects. */
export interface DownloadTaskSnapshot {
  id: string;
  origin: 'manual' | 'shelf';
  entryId?: string;
  sourceId: string;
  workId: string;
  workTitle: string;
  chapterId: string;
  chapterTitle: string;
  number?: number;
  state: DownloadState;
  pagesDownloaded: number;
  totalPages?: number;
  attempt: number;
  retryable: boolean;
  readyAt?: number;
  problem?: 'download-failed' | 'access-restricted' | 'output-unavailable';
}

export interface DownloadEvent {
  type: 'task';
  task: DownloadTaskSnapshot;
}

export function taskId(
  source: string,
  work: string,
  chapter: string,
  scope = '',
) {
  return createHash('sha256')
    .update(JSON.stringify([scope, source, work, chapter]))
    .digest('hex');
}

export function safeText(value: string): string {
  if (typeof value !== 'string') return '';
  if (/^(?:\/|[a-z]:[\\/]|\\\\)/i.test(value)) return '[redacted]';
  // Never emit credential-bearing locators or control characters as UI metadata.
  if (
    /(?:token|password|cookie|api[_-]?key|signature|sig)=|https?:\/\/[^/\s]*@/i.test(
      value,
    )
  )
    return '[redacted]';
  return value.replace(/\p{Cc}/gu, '').slice(0, 1000);
}

export interface DownloadTaskHandle {
  snapshot(): DownloadTaskSnapshot[];
  cancel(): void;
  retry(): Promise<void>;
  readonly done: Promise<void>;
}
