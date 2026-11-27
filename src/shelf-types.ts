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
  | { status: 'baseline' | 'updated' | 'unchanged'; queued: number }
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
}

export interface ShelfAttention {
  id: string;
  state: 'restricted' | 'blocked';
}

export interface ShelfOptions {
  file?: string;
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
}
