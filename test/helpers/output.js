import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

// Include unexpected files and temporary directories, but not ownership metadata.
export async function outputFiles(directory) {
  const files = [];
  async function walk(path, prefix = '') {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      if (entry.name === '.comic-dl-owner') continue;
      const name = prefix + entry.name;
      if (entry.isDirectory() && !entry.name.startsWith('.comic-dl-'))
        await walk(join(path, entry.name), name + '/');
      else files.push(name);
    }
  }
  await walk(directory);
  return files.sort();
}
