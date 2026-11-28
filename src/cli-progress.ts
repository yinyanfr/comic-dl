import type { DownloadEvent } from './tasks.js';

export type ProgressMode = 'auto' | 'plain' | 'off';

interface ProgressOutput {
  isTTY?: boolean;
  columns?: number;
  write(text: string): unknown;
}

/** Keep human progress on stderr; redirected output stays unchanged by default. */
export function createProgress(
  mode: ProgressMode,
  output: ProgressOutput = process.stderr,
) {
  const enabled = mode === 'plain' || (mode === 'auto' && output.isTTY);
  const interactive = mode === 'auto' && output.isTTY;
  let visible = false;
  let lastDraw = 0;
  const clean = (value: string) => value.replace(/[\p{Cc}\p{Cf}]/gu, ' ');
  const clip = (text: string, columns: number) => {
    let result = '';
    let width = 0;
    for (const character of text) {
      // Conservatively budget non-ASCII glyphs as two cells, including emoji.
      const cells = /\p{Mark}/u.test(character)
        ? 0
        : /[^\x20-\x7e]/u.test(character)
          ? 2
          : 1;
      if (width + cells > columns) break;
      result += character;
      width += cells;
    }
    return result;
  };
  return {
    onEvent: ({ task }: DownloadEvent) => {
      if (!enabled || task.state === 'queued') return;
      const terminal = [
        'downloaded',
        'skipped',
        'failed',
        'restricted',
        'cancelled',
      ].includes(task.state);
      if (interactive && task.state === 'reading' && Date.now() - lastDraw < 80)
        return;
      const pages =
        task.totalPages === undefined
          ? `${task.pagesDownloaded} pages`
          : `${task.pagesDownloaded}/${task.totalPages} pages`;
      const percent = task.totalPages
        ? ` (${Math.floor((task.pagesDownloaded / task.totalPages) * 100)}%)`
        : '';
      const title = `${clean(task.workTitle)} / ${clean(task.chapterTitle)}`;
      const text = `${task.state}: ${title} — ${pages}${percent} [attempt ${task.attempt}]`;
      if (interactive) {
        // A single bounded line works with concurrent chapters without moving the cursor up.
        output.write(
          `\r\x1b[2K${clip(`${task.state}: ${pages}${percent} [attempt ${task.attempt}] — ${title}`, Math.max(1, (output.columns ?? 80) - 1))}${terminal ? '\n' : ''}`,
        );
        visible = !terminal;
        lastDraw = Date.now();
      } else {
        output.write(`${text}\n`);
      }
    },
    finish() {
      if (visible) output.write('\r\x1b[2K');
      visible = false;
    },
  };
}
