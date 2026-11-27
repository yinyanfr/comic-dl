import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import lockfile from 'proper-lockfile';

/** Serialize cooperating writers using mkdir locks, including on SMB/exFAT. */
export async function withOutputLock<T>(
  directory: string,
  key: string,
  signal: AbortSignal,
  run: (assertOwned: () => void) => Promise<T>,
): Promise<T> {
  const name = `.comic-dl-lock-${createHash('sha256').update(key).digest('hex')}`;
  const path = join(directory, name);
  let compromised: Error | undefined;
  let release: (() => Promise<void>) | undefined;
  while (!release) {
    signal.throwIfAborted();
    try {
      release = await lockfile.lock(path, {
        realpath: false,
        lockfilePath: path,
        retries: 0,
        stale: 60_000,
        update: 10_000,
        onCompromised(error) {
          compromised = error;
        },
      });
    } catch (error) {
      if (!(
        error instanceof Error &&
        'code' in error &&
        error.code === 'ELOCKED'
      ))
        throw error;
      await setTimeout(50, undefined, { signal });
    }
  }
  const assertOwned = () => {
    signal.throwIfAborted();
    if (compromised)
      throw new Error('Output lock lost', { cause: compromised });
  };
  try {
    assertOwned();
    return await run(assertOwned);
  } finally {
    // A compromised lock is already released by proper-lockfile.
    if (!compromised) await release();
  }
}
