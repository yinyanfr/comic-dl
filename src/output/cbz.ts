import { Reader, Uint8ArrayReader, ZipReader, ZipWriter } from '@zip.js/zip.js';
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import type { Stats } from 'node:fs';
import {
  lstat,
  mkdir,
  mkdtemp,
  open,
  realpath,
  rename,
  rm,
  rmdir,
} from 'node:fs/promises';
import type { FileHandle } from 'node:fs/promises';
import { join, parse, resolve, sep } from 'node:path';
import { WritableStream } from 'node:stream/web';
import { imageExtensions } from '../sources/source.js';
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

export class OutputUnavailableError extends Error {}

function hash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function hasCode(error: unknown, code: string) {
  return error instanceof Error && 'code' in error && error.code === code;
}

async function statIfPresent(path: string) {
  try {
    return await lstat(path);
  } catch (error) {
    if (!hasCode(error, 'ENOENT')) {
      throw error;
    }
  }
}

async function getOutputDirectory(path: string): Promise<string> {
  const { root } = parse(path);
  let current = root;
  const parts = path.slice(root.length).split(sep).filter(Boolean);
  for (const part of parts) {
    const child = join(current, part);
    let stat = await statIfPresent(child);
    if (!stat) {
      try {
        await mkdir(child);
      } catch (error) {
        if (!hasCode(error, 'EEXIST')) {
          throw error;
        }
      }
      stat = await lstat(child);
    }

    if (stat.isDirectory()) {
      current = child;
      continue;
    }
    // macOS exposes its system temp directories through these fixed aliases.
    if (
      process.platform === 'darwin' &&
      (child === '/tmp' || child === '/var') &&
      stat.isSymbolicLink() &&
      (await realpath(child)) === `/private${child}`
    ) {
      current = `/private${child}`;
      continue;
    }
    throw new Error(`Output directory is not a real directory: ${child}`);
  }
  return current;
}

async function checkDirectoryIdentity(path: string, expected: Stats) {
  const actual = await lstat(path);
  if (
    !actual.isDirectory() ||
    actual.dev !== expected.dev ||
    actual.ino !== expected.ino
  ) {
    throw new Error(`Output directory changed: ${path}`);
  }
}

async function checkArchivePath(path: string) {
  const stat = await statIfPresent(path);
  if (stat && !stat.isFile()) {
    throw new Error(`Output path is not a regular file: ${path}`);
  }
  return stat;
}

class ArchiveReader extends Reader<FileHandle> {
  constructor(
    private readonly file: FileHandle,
    size: number,
    private readonly signal: AbortSignal,
  ) {
    super(file);
    this.size = size;
  }

  async readUint8Array(index: number, length: number) {
    this.signal.throwIfAborted();
    const buffer = Buffer.alloc(
      Math.max(0, Math.min(length, this.size - index)),
    );
    const { bytesRead } = await this.file.read(buffer, 0, buffer.length, index);
    return buffer.subarray(0, bytesRead);
  }
}

async function isComplete(
  path: string,
  marker: Buffer,
  names: string[],
  signal: AbortSignal,
) {
  if (!(await checkArchivePath(path))) {
    return false;
  }

  await using file = await open(
    path,
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
  );
  const stat = await file.stat();
  if (!stat.isFile()) {
    throw new Error(`Output path is not a regular file: ${path}`);
  }
  const reader = new ZipReader(new ArchiveReader(file, stat.size, signal), {
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
      await entry.getData(new WritableStream(), {
        checkSignature: true,
        signal,
      });
    }
    signal.throwIfAborted();
    return true;
  } catch {
    signal.throwIfAborted();
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
  signal: AbortSignal,
) {
  await using file = await open(path, 'wx');
  const writer = new ZipWriter(
    new WritableStream<Uint8Array>({
      async write(chunk) {
        let offset = 0;
        while (offset < chunk.byteLength) {
          signal.throwIfAborted();
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
    await writer.add(name, new Uint8ArrayReader(bytes), { signal });
  }
  if (index !== names.length) {
    throw new Error('Fewer pages received than expected');
  }
  await writer.close(marker);
}

export async function saveCbz(
  directory: string,
  chapter: CbzChapter,
  signal: AbortSignal,
  validateOutput?: () => Promise<void>,
): Promise<CbzResult> {
  signal.throwIfAborted();
  const key = hash(chapter.identity);
  const chapterId = chapter.identity[2]
    .replace(/[^a-z0-9_-]/gi, '_')
    .slice(0, 40);
  const filename = `chapter-${chapterId}-${key}.cbz`;
  const path = resolve(directory, filename);
  const marker = Buffer.from(
    `comic-dl:v1:${key}:${hash(chapter.pages.map(({ id, extension }) => [id, extension]))}`,
  );
  const width = String(chapter.pages.length).length;
  const names = chapter.pages.map(({ extension }, index) => {
    if (!imageExtensions.includes(extension)) {
      throw new Error(`Unsupported image extension: ${String(extension)}`);
    }
    return `${String(index + 1).padStart(width, '0')}.${extension}`;
  });
  await validateOutput?.();
  const root = await getOutputDirectory(resolve(directory));
  const rootStat = await lstat(root);
  if (!rootStat.isDirectory()) {
    throw new Error(`Output directory is not a real directory: ${root}`);
  }
  await validateOutput?.();
  const target = join(root, filename);
  if (await isComplete(target, marker, names, signal)) {
    return { status: 'skipped', path };
  }

  signal.throwIfAborted();
  await checkDirectoryIdentity(root, rootStat);
  const tempDirectory = await mkdtemp(join(root, '.comic-dl-'));
  const tempStat = await lstat(tempDirectory);
  const tempPath = join(tempDirectory, 'chapter.cbz');
  try {
    await writeCbz(tempPath, marker, names, chapter.contents, signal);
    await checkArchivePath(target);
    await validateOutput?.();
    await checkDirectoryIdentity(root, rootStat);
    await checkDirectoryIdentity(tempDirectory, tempStat);
    signal.throwIfAborted();
    await rename(tempPath, target);
    return { status: 'downloaded', path };
  } finally {
    await checkDirectoryIdentity(root, rootStat);
    await checkDirectoryIdentity(tempDirectory, tempStat);
    await rm(tempPath, { force: true });
    await rmdir(tempDirectory);
  }
}
