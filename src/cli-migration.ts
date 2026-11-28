import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { applyArchiveMigration } from './output/migration.js';
import type { ArchiveMigrationItem } from './output/migration.js';

/** Apply the reviewed preview, bound to its original output root. */
export async function applyMigrationFile(
  file: string,
  directory: string,
  signal: AbortSignal,
) {
  const preview: unknown = JSON.parse(
    await readFile(file, { encoding: 'utf8', signal }),
  );
  if (
    !preview ||
    typeof preview !== 'object' ||
    !('version' in preview) ||
    preview.version !== 1 ||
    !('directory' in preview) ||
    preview.directory !== resolve(directory) ||
    !('items' in preview) ||
    !Array.isArray(preview.items)
  ) {
    throw new Error(
      'Invalid migration preview or output directory does not match preview',
    );
  }
  const items: ArchiveMigrationItem[] = [];
  for (const item of preview.items as unknown[]) {
    if (
      !item ||
      typeof item !== 'object' ||
      !('from' in item) ||
      typeof item.from !== 'string' ||
      !('to' in item) ||
      typeof item.to !== 'string' ||
      !('identity' in item) ||
      typeof item.identity !== 'string' ||
      !/^[a-f0-9]{64}$/.test(item.identity) ||
      !('status' in item) ||
      typeof item.status !== 'string' ||
      !['move', 'unchanged', 'conflict'].includes(item.status) ||
      ('workIdentity' in item &&
        (typeof item.workIdentity !== 'string' ||
          !/^[a-f0-9]{64}$/.test(item.workIdentity)))
    ) {
      throw new Error('Invalid migration item');
    }
    items.push({
      from: item.from,
      to: item.to,
      identity: item.identity,
      status: item.status as ArchiveMigrationItem['status'],
      ...('workIdentity' in item
        ? { workIdentity: item.workIdentity as string }
        : {}),
    });
  }
  await applyArchiveMigration(directory, items, signal);
}
