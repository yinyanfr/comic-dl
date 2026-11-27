import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { extensionApiVersion } from '../extension.js';
import type { SourceExtension } from '../extension.js';
import { imageExtensions } from './source.js';
import type { Chapter, ChapterSource, Page } from './source.js';

function readPage(directory: string, filename: unknown): Page {
  if (
    typeof filename !== 'string' ||
    !/^[a-z0-9_-][a-z0-9_.-]*$/i.test(filename)
  ) {
    throw new Error('Fixture pages must be plain image filenames');
  }

  const extension = extname(filename).slice(1).toLowerCase();
  const imageExtension = imageExtensions.find((value) => value === extension);
  if (!imageExtension) {
    throw new Error(`Unsupported fixture page type: ${filename}`);
  }

  return {
    id: filename,
    extension: imageExtension,
    read: (signal) => readFile(join(directory, filename), { signal }),
  };
}

function record(value: unknown, context: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${context} must be an object`);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, context: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${context} must be a non-empty string`);
  }
  return value;
}

async function readManifest(
  directory: string,
  name: string,
  signal: AbortSignal,
) {
  const json: unknown = JSON.parse(
    await readFile(join(directory, name), { encoding: 'utf8', signal }),
  );
  return record(json, name);
}

function chapter(
  directory: string,
  id: string,
  title: string,
  pages: unknown,
): Chapter {
  return {
    id,
    title,
    getPages(signal) {
      signal.throwIfAborted();
      if (!Array.isArray(pages)) {
        throw new Error('Fixture chapter pages must be an array');
      }
      return Promise.resolve(
        pages.map((filename) => readPage(directory, filename)),
      );
    },
  };
}

async function getChapter(directory: string, signal: AbortSignal) {
  const manifest = await readManifest(directory, 'chapter.json', signal);
  const id = text(manifest.chapterId, 'chapter.json chapterId');
  return {
    workId: text(manifest.workId, 'chapter.json workId'),
    chapter: chapter(directory, id, id, manifest.pages),
  };
}

export const fixtureSource: ChapterSource = {
  id: 'fixture',
  getChapter,
  async getSeries(directory, signal) {
    let manifest;
    try {
      manifest = await readManifest(directory, 'series.json', signal);
    } catch (error) {
      if (
        error instanceof Error &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        const { workId, chapter } = await getChapter(directory, signal);
        return { id: workId, chapters: [chapter] };
      }
      throw error;
    }

    const id = text(manifest.workId, 'series.json workId');
    if (!Array.isArray(manifest.chapters)) {
      throw new Error('series.json chapters must be an array');
    }
    const ids = new Set<string>();
    const chapters = manifest.chapters.map((value: unknown, index: number) => {
      const context = `series.json chapter ${index + 1}`;
      const { id, title, pages } = record(value, context);
      const chapterId = text(id, `${context} id`);
      if (ids.has(chapterId)) {
        throw new Error(`Duplicate chapter ID: ${chapterId}`);
      }
      ids.add(chapterId);
      return chapter(
        directory,
        chapterId,
        text(title, `${context} title`),
        pages,
      );
    });
    return { id, chapters };
  },
};

export const fixtureExtension: SourceExtension = {
  apiVersion: extensionApiVersion,
  id: fixtureSource.id,
  create: () => fixtureSource,
};
