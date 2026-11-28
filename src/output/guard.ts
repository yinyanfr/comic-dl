import { lstat } from 'node:fs/promises';
import { relative, resolve, sep, join, isAbsolute } from 'node:path';
import { OutputUnavailableError } from './cbz.js';

/** Existing selected directories are never recreated when a mount disappears. */
export function createOutputGuard(
  root: string,
  directory: string,
  marker?: string,
) {
  root = resolve(root);
  directory = resolve(directory);
  const child = relative(root, directory);
  if (isAbsolute(child) || child === '..' || child.startsWith(`..${sep}`))
    throw new Error('Output directory must be inside outputRoot');
  if (
    marker &&
    (marker.includes('/') ||
      marker.includes('\\') ||
      marker === '.' ||
      marker === '..')
  )
    throw new Error('Output marker must be a filename');
  return async () => {
    try {
      const paths = [root];
      let current = root;
      for (const part of child.split(sep).filter(Boolean)) {
        current = join(current, part);
        paths.push(current);
      }
      for (const path of paths) {
        const stat = await lstat(path);
        if (!stat.isDirectory() || stat.isSymbolicLink())
          throw new Error('Unavailable directory');
      }
      if (marker && !(await lstat(join(root, marker))).isFile())
        throw new Error('Unavailable marker');
    } catch {
      throw new OutputUnavailableError('Output unavailable');
    }
  };
}
