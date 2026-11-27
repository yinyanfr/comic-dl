export interface ShelfEntry {
  id: string;
  sourceId: string;
  workId: string;
  input: string;
  title: string;
  following: 0 | 1;
  createdAt: string;
  updatedAt: string;
  revision: number;
  autoCheck: 0 | 1;
  autoDownload: 0 | 1;
  intervalSeconds: number | null;
}

export type CheckProblem =
  | 'source-unavailable'
  | 'authorization-failed'
  | 'temporary-failure'
  | 'catalog-failed'
  | 'wrong-work'
  | 'invalid-catalog'
  | 'empty-catalog'
  | 'check-conflict';

export type CheckEvent = { id: string; sourceId: string } & (
  | {
      status: 'baseline' | 'updated' | 'unchanged';
      queued: number;
      discovered: number;
    }
  | { status: 'changed' }
  | { status: 'failed'; problem: CheckProblem }
);

export interface TaskEvent {
  entryId: string;
  chapterId: string;
  state: 'retry' | 'restricted' | 'complete' | 'blocked';
}

export interface ShelfStatus {
  id: string;
  sourceId: string;
  following: 0 | 1;
  lastCheck: number | null;
  lastSuccess: number | null;
  result: 'ok' | CheckProblem | null;
  pending: number;
  restricted: number;
  blocked: number;
  complete: number;
  autoCheck: 0 | 1;
  autoDownload: 0 | 1;
  nextCheck: number | null;
  discovered: number;
  intervalSeconds: number;
}

export interface ShelfAttention {
  id: string;
  state: 'restricted' | 'blocked';
}

export interface ShelfOptions {
  file?: string;
  intervalSeconds?: number;
}

export interface ShelfReadOptions {
  signal?: AbortSignal;
  retries?: number;
}

export interface ShelfCheckOptions extends ShelfReadOptions {
  entryId?: string;
  includeHistory?: boolean;
  onCheck?: (event: CheckEvent) => void;
}

export interface ShelfCheckResult {
  checked: number;
  failures: number;
  queued: number;
  events: CheckEvent[];
}

export interface ShelfWatchOptions extends ShelfReadOptions {
  signal: AbortSignal;
  directory?: string;
  jobs?: number;
  intervalSeconds?: number;
  outputMarker?: string;
  onCheck?: (event: CheckEvent) => void;
  onTask?: (event: TaskEvent) => void;
  onOutputUnavailable?: () => void;
  outputRoot?: string;
  archive?: import('./output/naming.js').ArchiveOptions;
  onEvent?: (event: import('./tasks.js').DownloadEvent) => void;
}

export interface ShelfAutomation {
  autoCheck?: boolean;
  autoDownload?: boolean;
  /** null restores the global default. */
  intervalSeconds?: number | null;
}

export interface ShelfChapter {
  chapterId: string;
  chapterTitle: string;
  number?: number;
  discoveredAt: number | null;
  state:
    | 'seen'
    | 'discovered'
    | 'queued'
    | 'retry'
    | 'restricted'
    | 'complete'
    | 'blocked'
    | 'cancelled';
}

export interface ShelfHandle {
  close(): void;
  list(): ShelfEntry[];
  add(
    input: string,
    options?: ShelfReadOptions & { source?: string; title?: string },
  ): Promise<ShelfEntry>;
  setInput(
    id: string,
    input: string,
    options?: ShelfReadOptions,
  ): Promise<ShelfEntry>;
  follow(id: string): ShelfEntry;
  unfollow(id: string): ShelfEntry;
  remove(id: string): void;
  status(id?: string): ShelfStatus[];
  needsAttention(id: string): ShelfAttention[];
  retry(id: string, chapterId: string): boolean;
  check(options?: ShelfCheckOptions): Promise<ShelfCheckResult>;
  watch(options: ShelfWatchOptions): Promise<void>;
  configure(id: string, options: ShelfAutomation): ShelfEntry;
  setDefaultInterval(intervalSeconds: number): void;
  chapters(id: string): ShelfChapter[];
  enqueue(id: string, chapterId: string): boolean;
  cancel(id: string, chapterId: string): boolean;
  tasks(id?: string): import('./tasks.js').DownloadTaskSnapshot[];
}
