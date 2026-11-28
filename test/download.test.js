import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { outputFiles } from './helpers/output.js';
import { downloadSeries } from '../dist/download.js';
import { TransientSourceError } from '../dist/sources/source.js';

async function outputDirectory(t) {
  const directory = await mkdtemp(join(tmpdir(), 'comic-dl-service-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

function chapter(id, ...reads) {
  return {
    id,
    title: id,
    getPages: () =>
      Promise.resolve(
        reads.map((read, index) => ({
          id: String(index),
          extension: 'gif',
          read,
        })),
      ),
  };
}

const image = Uint8Array.of(1, 2, 3);

test(
  'limits chapter concurrency and processes remaining work as slots open',
  { timeout: 5_000 },
  async (t) => {
    const directory = await outputDirectory(t);
    const started = [];
    const results = [];
    const slots = Promise.withResolvers();
    const release = Promise.withResolvers();
    const chapters = ['one', 'two', 'three', 'four'].map((id) =>
      chapter(id, async () => {
        started.push(id);
        if (started.length === 2) {
          slots.resolve();
        }
        await release.promise;
        return image;
      }),
    );
    const finished = downloadSeries(
      'test',
      { id: 'work', chapters },
      {
        directory,
        jobs: 2,
        retries: 0,
        signal: t.signal,
        onResult: (result) => results.push(result),
      },
    );
    try {
      await Promise.race([slots.promise, finished]);
      assert.deepEqual([...started].sort(), ['one', 'two']);
    } finally {
      release.resolve();
      await finished;
    }
    assert.deepEqual(started.slice(2).sort(), ['four', 'three']);
    assert.equal(results.length, 4);
    assert.ok(
      results.every(
        ({ status, attempts }) => status === 'downloaded' && attempts === 1,
      ),
    );
  },
);

test('retries only transient errors within budget and restarts the chapter from its first page', async (t) => {
  const directory = await outputDirectory(t);
  const counts = { firstPage: 0, transient: 0, exhausted: 0, permanent: 0 };
  const results = [];
  const chapters = [
    chapter(
      'recovers',
      () => {
        counts.firstPage++;
        return Promise.resolve(image);
      },
      () => {
        if (++counts.transient === 1) {
          throw new TransientSourceError('try later');
        }
        return Promise.resolve(image);
      },
    ),
    chapter('exhausted', () => {
      counts.exhausted++;
      throw new TransientSourceError('rate limited');
    }),
    chapter('permanent', () => {
      counts.permanent++;
      throw new Error('missing page');
    }),
  ];
  const series = { id: 'work', chapters };
  const options = {
    directory,
    jobs: 1,
    retries: 2,
    signal: t.signal,
    onResult: (result) => results.push(result),
  };
  await downloadSeries('test', series, options);
  assert.deepEqual(counts, {
    firstPage: 2,
    transient: 2,
    exhausted: 3,
    permanent: 1,
  });
  assert.deepEqual(
    results.map(({ chapterId, status, attempts }) => [
      chapterId,
      status,
      attempts,
    ]),
    [
      ['recovers', 'downloaded', 2],
      ['exhausted', 'failed', 3],
      ['permanent', 'failed', 1],
    ],
  );
  assert.match(results[1].error, /Page 1: rate limited/);
  assert.match(
    (await outputFiles(directory)).join('\n'),
    /^work\/recovers-recovers\.cbz$/,
  );

  await downloadSeries(
    'test',
    { ...series, chapters: [chapters[1]] },
    { ...options, retries: 0 },
  );
  assert.equal(counts.exhausted, 4);
  assert.equal(results.at(-1).attempts, 1);
});
