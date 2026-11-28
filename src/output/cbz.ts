import { Reader, Uint8ArrayReader, ZipReader, ZipWriter } from '@zip.js/zip.js';
import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import type { Stats } from 'node:fs';
import {
  lstat,
  mkdir,
  mkdtemp,
  open,
  realpath,
  rm,
  rmdir,
  readdir,
  readFile,
  writeFile,
  rename,
} from 'node:fs/promises';
import type { FileHandle } from 'node:fs/promises';
import {
  dirname,
  basename,
  join,
  parse,
  resolve,
  relative,
  sep,
} from 'node:path';
import { WritableStream } from 'node:stream/web';
import { imageExtensions } from '../sources/source.js';
import type { Page } from '../sources/source.js';
import { archiveName } from './naming.js';
import type { ArchiveOptions } from './naming.js';
import { withOutputLock } from './lock.js';

interface CbzChapter {
  identity: readonly [sourceId: string, workId: string, chapterId: string];
  pages: readonly Pick<Page, 'id' | 'extension'>[];
  contents: AsyncIterable<Uint8Array>;
  title?: string;
  workTitle?: string;
  number?: number;
  archive?: ArchiveOptions;
  requireExistingDirectory?: boolean;
  index?: ArchiveIndex;
}

export interface ArchiveIndex {
  entries?: Promise<Map<string, string[]>>;
  signal?: AbortSignal;
}

/** Enumerate only real directories and regular archives, never follow symlinks. */
export async function archiveFiles(directory: string): Promise<string[]> {
  if (!(await lstat(directory)).isDirectory())
    throw new Error('Archive root is not a real directory');
  const files: string[] = [];
  async function walk(path: string, depth: number) {
    if (depth > 5) return;
    let entries;
    try {
      entries = await readdir(path, { withFileTypes: true });
    } catch (error) {
      // Root errors still matter. Unrelated folders may have different ACLs or
      // disappear during a scan; neither should poison the shared batch index.
      if (
        depth > 0 &&
        ['EACCES', 'EPERM', 'ENOENT', 'ENOTDIR'].some((code) =>
          hasCode(error, code),
        )
      )
        return;
      throw error;
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.comic-dl-')) continue;
      const child = join(path, entry.name);
      if (entry.isDirectory()) await walk(child, depth + 1);
      else if (entry.isFile() && /\.(cbz|zip)$/i.test(entry.name))
        files.push(child);
    }
  }
  await walk(directory, 0);
  return files.sort();
}

export async function archiveIdentity(
  path: string,
  signal: AbortSignal,
  verify = true,
): Promise<string | undefined> {
  await using file = await open(
    path,
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
  );
  const stat = await file.stat();
  if (!stat.isFile()) return;
  const reader = new ZipReader(new ArchiveReader(file, stat.size, signal), {
    useWebWorkers: false,
  });
  try {
    const entries = await reader.getEntries();
    const match = /^comic-dl:v1:([a-f0-9]{64}):[a-f0-9]{64}$/.exec(
      Buffer.from(reader.comment).toString(),
    );
    if (!match || !entries.length) return;
    if (!verify) return match[1];
    for (const entry of entries) {
      if (entry.directory || entry.encrypted || entry.uncompressedSize <= 0)
        return;
      await entry.getData(new WritableStream(), {
        checkSignature: true,
        signal,
      });
    }
    return match[1];
  } catch {
    signal.throwIfAborted();
    return;
  } finally {
    await reader.close();
  }
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

export async function getOutputDirectory(
  path: string,
  protectedRoot?: string,
): Promise<string> {
  const { root } = parse(path);
  let current = root;
  const parts = path.slice(root.length).split(sep).filter(Boolean);
  for (const part of parts) {
    const child = join(current, part);
    let stat = await statIfPresent(child);
    if (!stat) {
      if (
        protectedRoot &&
        (protectedRoot === child || protectedRoot.startsWith(`${child}${sep}`))
      )
        throw new OutputUnavailableError('Output directory unavailable');
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
  onArchive?: () => void,
): Promise<CbzResult> {
  signal.throwIfAborted();
  const key = hash(chapter.identity);
  let filename = archiveName(
    {
      title: chapter.workTitle ?? chapter.identity[1],
      chapter: chapter.title ?? chapter.identity[2],
      number: chapter.number,
      workId: chapter.identity[1],
      chapterId: chapter.identity[2],
    },
    chapter.archive,
  );
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
  let protectedRoot: string | undefined;
  if (chapter.requireExistingDirectory) {
    try {
      if (!(await lstat(resolve(directory))).isDirectory())
        throw new Error('Unavailable');
      protectedRoot = await realpath(directory);
    } catch {
      throw new OutputUnavailableError('Output directory unavailable');
    }
  }
  const base = await getOutputDirectory(resolve(directory), protectedRoot);
  const displayPath = (path: string) =>
    resolve(directory, relative(base, path));
  // Identity is independent of names, ordering and extension. Read and CRC-check
  // existing archives, including the legacy hash-based layout.
  const index = chapter.index ?? {};
  const scanSignal = index.signal ?? signal;
  index.entries ??= (async () => {
    const entries = new Map<string, string[]>();
    for (const file of await archiveFiles(base)) {
      try {
        const identity = await archiveIdentity(file, scanSignal, false);
        if (identity)
          entries.set(identity, [...(entries.get(identity) ?? []), file]);
      } catch {
        scanSignal.throwIfAborted();
      }
    }
    return entries;
  })();
  const known = await index.entries;
  signal.throwIfAborted();
  for (const existing of known.get(key) ?? []) {
    await validateOutput?.();
    if (await isComplete(existing, marker, names, signal))
      return { status: 'skipped', path: displayPath(existing) };
  }
  if (filename.includes('/')) {
    const parts = filename.split('/');
    const owner = hash(chapter.identity.slice(0, 2));
    for (let attempt = 0; ; attempt++) {
      const name =
        attempt === 0 ? parts[0] : `${parts[0]}-${owner.slice(0, 12)}`;
      const workDirectory = await getOutputDirectory(
        join(base, name),
        protectedRoot,
      );
      const ownership = join(workDirectory, '.comic-dl-owner');
      const matches = await withOutputLock(
        workDirectory,
        'ownership',
        signal,
        async (assertOwned) => {
          await validateOutput?.();
          const existing = await statIfPresent(ownership);
          if (existing) {
            if (!existing.isFile())
              throw new Error('Unsafe work ownership marker');
            return (await readFile(ownership, 'utf8')) === owner;
          }
          const ownershipTemp = join(
            workDirectory,
            `.comic-dl-owner-${randomUUID()}`,
          );
          try {
            await writeFile(ownershipTemp, owner, { flag: 'wx' });
            await validateOutput?.();
            assertOwned();
            await rename(ownershipTemp, ownership);
            return true;
          } finally {
            await rm(ownershipTemp, { force: true });
          }
        },
      );
      if (matches) {
        filename = [name, ...parts.slice(1)].join('/');
        break;
      }
      if (attempt) throw new Error('Work directory is occupied');
    }
  }
  let path = resolve(base, filename);
  const pathLimit =
    process.platform === 'win32'
      ? 240
      : process.platform === 'darwin'
        ? 1024
        : 4096;
  if (Buffer.byteLength(path) > pathLimit - 50)
    throw new Error('Archive path is too long');
  let targetName = basename(path);
  const root = await getOutputDirectory(dirname(path), protectedRoot);
  if (await statIfPresent(path)) {
    await checkArchivePath(path);
    if (await isComplete(path, marker, names, signal))
      return { status: 'skipped', path: displayPath(path) };
    targetName = `${targetName.slice(0, targetName.lastIndexOf('.'))}-${key.slice(0, 12)}-${randomUUID().slice(0, 8)}${targetName.slice(targetName.lastIndexOf('.'))}`;
    path = join(root, targetName);
    if (await statIfPresent(path)) {
      if (await isComplete(path, marker, names, signal))
        return { status: 'skipped', path: displayPath(path) };
      throw new Error('Archive destination is occupied');
    }
  }
  const rootStat = await lstat(root);
  if (!rootStat.isDirectory()) {
    throw new Error(`Output directory is not a real directory: ${root}`);
  }
  await validateOutput?.();
  const target = path;
  if (await isComplete(target, marker, names, signal)) {
    return { status: 'skipped', path: displayPath(path) };
  }

  signal.throwIfAborted();
  await checkDirectoryIdentity(root, rootStat);
  const tempDirectory = await mkdtemp(join(root, '.comic-dl-'));
  const tempStat = await lstat(tempDirectory);
  const tempPath = join(tempDirectory, 'chapter.cbz');
  try {
    onArchive?.();
    await writeCbz(tempPath, marker, names, chapter.contents, signal);
    onArchive?.();
    return await withOutputLock(
      root,
      `archive:${basename(target)}`,
      signal,
      async (assertOwned) => {
        await validateOutput?.();
        await checkDirectoryIdentity(root, rootStat);
        await checkDirectoryIdentity(tempDirectory, tempStat);
        if (await checkArchivePath(target)) {
          if (await isComplete(target, marker, names, signal))
            return { status: 'skipped', path: displayPath(path) };
          throw new Error('Archive destination changed');
        }
        await validateOutput?.();
        assertOwned();
        await rename(tempPath, target);
        known.set(key, [...(known.get(key) ?? []), target]);
        return { status: 'downloaded', path: displayPath(path) };
      },
    );
  } finally {
    await checkDirectoryIdentity(root, rootStat);
    await checkDirectoryIdentity(tempDirectory, tempStat);
    await rm(tempPath, { force: true });
    await rmdir(tempDirectory);
  }
}
