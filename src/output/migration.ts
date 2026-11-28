import { createHash, randomUUID } from 'node:crypto';
import { rename, lstat, readFile, writeFile, rm } from 'node:fs/promises';
import {
  dirname,
  basename,
  relative,
  resolve,
  sep,
  isAbsolute,
} from 'node:path';
import { archiveFiles, archiveIdentity, getOutputDirectory } from './cbz.js';
import { archiveName } from './naming.js';
import type { ArchiveOptions } from './naming.js';
import { withOutputLock } from './lock.js';

export interface ArchiveMigrationEntry {
  identity: readonly [sourceId: string, workId: string, chapterId: string];
  title: string;
  chapter: string;
  number?: number;
}

export interface ArchiveMigrationItem {
  from: string;
  to: string;
  identity: string;
  workIdentity?: string;
  status: 'move' | 'unchanged' | 'conflict';
}

export async function planArchiveMigration(
  directory: string,
  entries: readonly ArchiveMigrationEntry[],
  archive?: ArchiveOptions,
  signal: AbortSignal = new AbortController().signal,
): Promise<ArchiveMigrationItem[]> {
  const byIdentity = new Map(
    entries.map((entry) => [
      createHash('sha256').update(JSON.stringify(entry.identity)).digest('hex'),
      entry,
    ]),
  );
  const plans: ArchiveMigrationItem[] = [];
  for (const file of await archiveFiles(resolve(directory))) {
    signal.throwIfAborted();
    const identity = await archiveIdentity(file, signal);
    const entry = identity && byIdentity.get(identity);
    if (!entry || !identity) continue;
    const from = relative(resolve(directory), file);
    let to = archiveName(
      { ...entry, workId: entry.identity[1], chapterId: entry.identity[2] },
      archive,
    );
    const workIdentity = createHash('sha256')
      .update(JSON.stringify(entry.identity.slice(0, 2)))
      .digest('hex');
    if (to.includes('/')) {
      const parts = to.split('/');
      const ownership = await readFile(
        resolve(directory, parts[0], '.comic-dl-owner'),
        'utf8',
      ).catch(() => undefined);
      if (ownership !== undefined && ownership !== workIdentity)
        to = [
          `${parts[0]}-${workIdentity.slice(0, 12)}`,
          ...parts.slice(1),
        ].join('/');
    }
    const exists = await lstat(resolve(directory, to)).then(
      () => true,
      () => false,
    );
    plans.push({
      from,
      to,
      identity,
      workIdentity,
      status: from === to ? 'unchanged' : exists ? 'conflict' : 'move',
    });
  }
  for (const item of plans)
    if (plans.some((other) => item !== other && other.to === item.to))
      item.status = 'conflict';
  return plans;
}

/** Apply only an explicit preview; revalidate identity and no-clobber each move. */
export async function applyArchiveMigration(
  directory: string,
  plan: readonly ArchiveMigrationItem[],
  signal: AbortSignal = new AbortController().signal,
): Promise<void> {
  const root = resolve(directory);
  const safe = async (value: string) => {
    const path = resolve(root, value),
      child = relative(root, path);
    if (
      isAbsolute(value) ||
      !child ||
      child === '..' ||
      child.startsWith(`..${sep}`)
    )
      throw new Error('Migration path must be inside the output directory');
    let parent = root;
    for (const part of child.split(sep).slice(0, -1)) {
      parent = resolve(parent, part);
      const stat = await lstat(parent).catch(() => undefined);
      if (stat && !stat.isDirectory())
        throw new Error('Unsafe migration directory');
    }
    return path;
  };
  for (const item of plan) {
    signal.throwIfAborted();
    if (item.status !== 'move') continue;
    const from = await safe(item.from),
      to = await safe(item.to);
    if ((await archiveIdentity(from, signal)) !== item.identity)
      throw new Error('Archive identity changed since preview');
    await getOutputDirectory(dirname(to));
    if (item.workIdentity && item.to.includes('/')) {
      const workIdentity = item.workIdentity;
      const ownerFile = resolve(root, item.to.split('/')[0], '.comic-dl-owner');
      await withOutputLock(
        dirname(ownerFile),
        'ownership',
        signal,
        async (assertOwned) => {
          const existing = await lstat(ownerFile).catch((error: unknown) => {
            if (
              error instanceof Error &&
              'code' in error &&
              error.code === 'ENOENT'
            )
              return undefined;
            throw error;
          });
          if (existing) {
            if (
              !existing.isFile() ||
              (await readFile(ownerFile, 'utf8')) !== workIdentity
            )
              throw new Error('Work directory ownership changed since preview');
            return;
          }
          const temp = resolve(
            dirname(ownerFile),
            `.comic-dl-owner-${randomUUID()}`,
          );
          try {
            await writeFile(temp, workIdentity, { flag: 'wx' });
            assertOwned();
            await rename(temp, ownerFile);
          } finally {
            await rm(temp, { force: true });
          }
        },
      );
    }
    await withOutputLock(
      dirname(to),
      `archive:${basename(to)}`,
      signal,
      async (assertOwned) => {
        const occupied = await lstat(to).catch((error: unknown) => {
          if (
            error instanceof Error &&
            'code' in error &&
            error.code === 'ENOENT'
          )
            return undefined;
          throw error;
        });
        if (occupied)
          throw new Error('Archive migration destination is occupied');
        if ((await archiveIdentity(from, signal)) !== item.identity)
          throw new Error('Archive identity changed since preview');
        assertOwned();
        await rename(from, to);
      },
    );
  }
}
