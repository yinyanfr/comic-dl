import { saveCbz } from './output/cbz.js';
import type { ChapterSource, Page } from './sources/source.js';

async function* readPages(pages: readonly Page[]): AsyncIterable<Uint8Array> {
  for (const [index, page] of pages.entries()) {
    try {
      const bytes = await page.read();
      if (!bytes.byteLength) {
        throw new Error('Empty image');
      }
      yield bytes;
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : String(cause);
      throw new Error(`Page ${index + 1} (${page.id}): ${reason}`, { cause });
    }
  }
}

export async function downloadChapter(
  source: ChapterSource,
  input: string,
  directory: string,
) {
  const chapter = await source.getChapter(input);
  if (!chapter.pages.length) {
    throw new Error('Chapter has no pages');
  }

  return saveCbz(directory, {
    identity: [source.id, chapter.workId, chapter.id],
    pages: chapter.pages,
    contents: readPages(chapter.pages),
  });
}
