import {
  BlobReader,
  Uint8ArrayReader,
  ZipReader,
  ZipWriter,
} from '@zip.js/zip.js';
import { createHash } from 'node:crypto';
import { openAsBlob } from 'node:fs';
import { lstat, mkdir, mkdtemp, open, rename, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { WritableStream } from 'node:stream/web';
import type { Page } from '../sources/source.js';

interface CbzChapter {
  identity: readonly [sourceId: string, workId: string, chapterId: string];
  pages: readonly Pick<Page, 'id' | 'extension'>[];
  contents: AsyncIterable<Uint8Array>;
}

interface CbzResult {
  status: 'downloaded' | 'skipped';
  path: string;
}

function hash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

async function isComplete(path: string, marker: Buffer, names: string[]) {
  const stat = await lstat(path).catch((error: unknown) => {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return undefined;
    }
    throw error;
  });
  if (!stat) {
    return false;
  }
  if (!stat.isFile()) {
    throw new Error(`Output path is not a regular file: ${path}`);
  }

  const reader = new ZipReader(new BlobReader(await openAsBlob(path)), {
    useWebWorkers: false,
  });
  try {
    const entries = await reader.getEntries();
    if (!marker.equals(reader.comment) || entries.length !== names.length) {
      return false;
    }
    for (const [index, entry] of entries.entries()) {
      if (
        entry.directory ||
        entry.filename !== names[index] ||
        entry.encrypted ||
        entry.compressionMethod !== 0 ||
        entry.uncompressedSize <= 0
      ) {
        return false;
      }
      // Read each page to verify its CRC without retaining the image in memory.
      await entry.getData(new WritableStream(), { checkSignature: true });
    }
    return true;
  } catch {
    return false;
  } finally {
    await reader.close();
  }
}

async function writeCbz(
  path: string,
  marker: Buffer,
  names: string[],
  contents: AsyncIterable<Uint8Array>,
) {
  await using file = await open(path, 'wx');
  const writer = new ZipWriter(
    new WritableStream<Uint8Array>({
      async write(chunk) {
        let offset = 0;
        while (offset < chunk.byteLength) {
          const { bytesWritten } = await file.write(
            chunk,
            offset,
            chunk.byteLength - offset,
          );
          if (!bytesWritten) {
            throw new Error('Could not write CBZ data');
          }
          offset += bytesWritten;
        }
      },
    }),
    { level: 0, useWebWorkers: false },
  );

  let index = 0;
  for await (const bytes of contents) {
    const name = names[index++];
    if (!name) {
      throw new Error('More pages received than expected');
    }
    await writer.add(name, new Uint8ArrayReader(bytes));
  }
  if (index !== names.length) {
    throw new Error('Fewer pages received than expected');
  }
  await writer.close(marker);
}

export async function saveCbz(
  directory: string,
  chapter: CbzChapter,
): Promise<CbzResult> {
  const key = hash(chapter.identity);
  const chapterId = chapter.identity[2]
    .replace(/[^a-z0-9_-]/gi, '_')
    .slice(0, 40);
  const path = resolve(directory, `chapter-${chapterId}-${key}.cbz`);
  const marker = Buffer.from(
    `comic-dl:v1:${key}:${hash(chapter.pages.map(({ id, extension }) => [id, extension]))}`,
  );
  const width = String(chapter.pages.length).length;
  const names = chapter.pages.map(
    ({ extension }, index) =>
      `${String(index + 1).padStart(width, '0')}.${extension}`,
  );
  if (await isComplete(path, marker, names)) {
    return { status: 'skipped', path };
  }

  await mkdir(directory, { recursive: true });
  const tempDirectory = await mkdtemp(resolve(directory, '.comic-dl-'));
  try {
    const tempPath = join(tempDirectory, 'chapter.cbz');
    await writeCbz(tempPath, marker, names, chapter.contents);
    await rename(tempPath, path);
    return { status: 'downloaded', path };
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
}
