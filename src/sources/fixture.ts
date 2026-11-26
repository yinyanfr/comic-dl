import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import type { ChapterSource, ImageExtension, Page } from './source.js';

function readPage(directory: string, filename: unknown): Page {
  if (
    typeof filename !== 'string' ||
    !/^[a-z0-9_-][a-z0-9_.-]*$/i.test(filename)
  ) {
    throw new Error('Fixture pages must be plain image filenames');
  }

  const extension = extname(filename).slice(1).toLowerCase();
  const supportedExtensions: readonly ImageExtension[] = [
    'jpg',
    'jpeg',
    'png',
    'gif',
    'webp',
  ];
  const imageExtension = supportedExtensions.find(
    (value) => value === extension,
  );
  if (!imageExtension) {
    throw new Error(`Unsupported fixture page type: ${filename}`);
  }

  return {
    id: filename,
    extension: imageExtension,
    read: () => readFile(join(directory, filename)),
  };
}

export const fixtureSource: ChapterSource = {
  id: 'fixture',
  async getChapter(directory) {
    const manifest: unknown = JSON.parse(
      await readFile(join(directory, 'chapter.json'), 'utf8'),
    );
    if (
      !manifest ||
      typeof manifest !== 'object' ||
      !('workId' in manifest) ||
      typeof manifest.workId !== 'string' ||
      !manifest.workId.trim() ||
      !('chapterId' in manifest) ||
      typeof manifest.chapterId !== 'string' ||
      !manifest.chapterId.trim() ||
      !('pages' in manifest) ||
      !Array.isArray(manifest.pages)
    ) {
      throw new Error('chapter.json must contain workId, chapterId and pages');
    }

    return {
      workId: manifest.workId,
      id: manifest.chapterId,
      pages: manifest.pages.map((filename) => readPage(directory, filename)),
    };
  },
};
