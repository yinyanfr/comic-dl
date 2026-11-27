import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { execFile, spawn } from 'node:child_process';
import { once } from 'node:events';
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { env as parentEnv, execPath } from 'node:process';
import { test } from 'node:test';
import { fileURLToPath, URL } from 'node:url';
import { promisify } from 'node:util';
import Database from 'better-sqlite3';
import { Shelf } from '../dist/shelf.js';
import { checkSubscriptions, runShelfCycle } from '../dist/shelf-updates.js';
import { SourceRegistry } from '../dist/sources/index.js';
import {
  RestrictedChapterError,
  TransientSourceError,
} from '../dist/sources/source.js';

const exec = promisify(execFile);
const cli = fileURLToPath(new URL('../dist/index.js', import.meta.url));
const image = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

async function setup(t) {
  const directory = await mkdtemp(join(tmpdir(), 'comic-dl-shelf-updates-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = join(directory, 'shelf.db');
  const env = {
    ...parentEnv,
    COMIC_DL_EXTENSION_DIR: join(directory, 'extensions'),
  };
  const args = (action, ...rest) => [
    cli,
    'shelf',
    action,
    '--shelf-db',
    file,
    ...rest,
  ];
  const run = (action, ...rest) =>
    exec(execPath, args(action, ...rest), { env });
  return { directory, file, args, run, env };
}

async function catalogExtension(directory, id) {
  const path = join(directory, `${id}.mjs`);
  const input = join(directory, `${id}.json`);
  await writeFile(
    path,
    `
    import { readFile } from 'node:fs/promises';
    import { setTimeout } from 'node:timers/promises';
    export default {
      id: '${id}', apiVersion: 1,
      create(api) {
        return {
          id: '${id}',
          async getChapter() { throw new Error('unused'); },
          async getSeries(input, signal) {
            const { work = 'work', chapters, error, wait } = JSON.parse(await readFile(input, 'utf8'));
            if (wait) await setTimeout(wait, undefined, { signal });
            if (error === 'transient') throw new api.TransientSourceError('https://example.invalid?token=secret');
            if (error === 'auth') throw new api.SourceHttpError(401);
            return {
              id: work,
              chapters: chapters.map(([id, title = id]) => ({
                id, title, get getPages() { throw new Error('Check accessed pages'); },
              })),
            };
          },
        };
      },
    };`,
  );
  return {
    path,
    input,
    write: (chapters, extras) =>
      writeFile(input, JSON.stringify({ chapters, ...extras })),
  };
}

function createV1(file, id, source, input) {
  const db = new Database(file);
  try {
    db.exec(`
      CREATE TABLE shelf_entries (
        id TEXT PRIMARY KEY NOT NULL, source_id TEXT NOT NULL, work_id TEXT NOT NULL,
        input TEXT NOT NULL, title TEXT NOT NULL,
        following INTEGER NOT NULL DEFAULT 0 CHECK (following IN (0, 1)),
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        revision INTEGER NOT NULL DEFAULT 0, UNIQUE (source_id, work_id)
      ) STRICT;
      PRAGMA user_version = 1;
    `);
    db.prepare(
      `
      INSERT INTO shelf_entries VALUES (?, ?, 'work', ?, 'Title', 1, '2026-01-01', '2026-01-01', 4)
    `,
    ).run(id, source, input);
  } finally {
    db.close();
  }
}

test('shelf checks migrate v1, keep a baseline of all seen IDs and isolate source failures', async (t) => {
  const { directory, file, run } = await setup(t);
  const a = await catalogExtension(directory, 'reader-a');
  const b = await catalogExtension(directory, 'reader-b');
  const config = join(directory, 'config.json');
  await writeFile(
    config,
    JSON.stringify({
      version: 1,
      retries: 0,
      extensions: [join(directory, 'broken.mjs'), a.path, b.path],
    }),
  );
  const options = ['--config', config];
  await a.write([['1'], ['3']]);
  await b.write([['01']]);
  createV1(file, 'migrated', 'reader-a', a.input);
  assert.match(
    (await run('list')).stdout,
    /migrated\treader-a\tfollowing\tTitle/,
  );
  const second = (
    await run('add', b.input, '--source', 'reader-b', '--extension', b.path)
  ).stdout.split('\t')[0];
  await run('follow', second);
  assert.match(
    (await run('status', 'migrated')).stdout,
    /unchecked\t0 pending/,
  );

  const first = await run('check', ...options);
  assert.match(first.stderr, /Could not load a source extension/);
  assert.match(first.stdout, /migrated\treader-a\tbaseline\t0 queued/);
  assert.match(first.stdout, /Summary: 2 checked, 0 queued, 0 failed/);

  await a.write([['3', 'Renamed'], ['2']]);
  await b.write([], { error: 'transient' });
  await assert.rejects(run('check', ...options), {
    code: 1,
    stdout:
      /migrated\treader-a\tupdated\t1 queued[\s\S]*2 checked, 1 queued, 1 failed/,
    stderr:
      /^comic-dl: Could not load a source extension[^\n]*\n[^\n]*\treader-b\tfailed\ttemporary-failure\n$/,
  });
  assert.match(
    (await run('status', second)).stdout,
    /last success: 20[^\t]+\ttemporary-failure/,
  );

  await a.write([['1'], ['2'], ['3']]);
  assert.match(
    (await run('check', 'migrated', ...options)).stdout,
    /unchanged\t0 queued/,
  );
  assert.match(
    (await run('check', 'migrated', '--include-history', ...options)).stdout,
    /updated\t2 queued/,
  );
  assert.match(
    (await run('check', 'migrated', '--include-history', ...options)).stdout,
    /unchanged\t0 queued/,
  );
  assert.match((await run('status', 'migrated')).stdout, /3 pending/);
  assert.doesNotMatch(await readFile(file, 'latin1'), /token=secret/);

  for (const [chapters, extras, error] of [
    [[], {}, 'empty-catalog'],
    [[['1'], ['1']], {}, 'invalid-catalog'],
    [[['4']], { work: 'wrong' }, 'wrong-work'],
    [[], { error: 'auth' }, 'authorization-failed'],
  ]) {
    await a.write(chapters, extras);
    await assert.rejects(run('check', 'migrated', ...options), {
      code: 1,
      stderr: new RegExp(`failed\\t${error}`),
    });
    assert.match((await run('status', 'migrated')).stdout, /3 pending/);
  }
  await assert.rejects(run('check', 'migrated'), {
    code: 1,
    stderr: /source-unavailable/,
  });
  await run('unfollow', 'migrated');
  await assert.rejects(run('check', 'migrated', ...options), { code: 2 });
  await a.write([['1'], ['2'], ['3'], ['4']]);
  await run('follow', 'migrated');
  const checks = await Promise.all([
    run('check', 'migrated', ...options),
    run('check', 'migrated', ...options),
  ]);
  assert.equal(
    checks.filter(({ stdout }) => stdout.includes('updated\t1 queued')).length,
    1,
  );
  assert.match((await run('status', 'migrated')).stdout, /4 pending/);

  await run('set-input', 'migrated', a.input, '--extension', a.path);
  assert.match((await run('status', 'migrated')).stdout, /4 pending/);
  const replacement = join(directory, 'replacement.json');
  await writeFile(replacement, JSON.stringify({ chapters: [['5']] }));
  await run('set-input', 'migrated', replacement, '--extension', a.path);
  assert.match(
    (await run('check', 'migrated', ...options)).stdout,
    /baseline\t0 queued/,
  );
  assert.match((await run('status', 'migrated')).stdout, /0 pending/);
  await run('remove', 'migrated');
  const db = new Database(file, { readonly: true });
  try {
    assert.equal(db.pragma('user_version', { simple: true }), 2);
    assert.equal(
      db
        .prepare(
          'SELECT count(*) AS total FROM shelf_chapters WHERE entry_id = ?',
        )
        .get('migrated').total,
      0,
    );
  } finally {
    db.close();
  }
});

test(
  'a check finishing after another process pauses the subscription discards its results',
  { timeout: 10_000 },
  async (t) => {
    const { directory, args, run, env, file } = await setup(t);
    const extension = join(directory, 'pending.mjs');
    await writeFile(
      extension,
      `
    export default { id: 'reader', apiVersion: 1, create() { return {
      id: 'reader', async getChapter() {},
      async getSeries() {
        if (process.send) {
          process.send('ready');
          await new Promise((resolve) => process.once('message', resolve));
        }
        return { id: 'work', chapters: [{ id: 'chapter' }] };
      },
    }; } };`,
    );
    const { stdout } = await run(
      'add',
      'work',
      '--source',
      'reader',
      '--extension',
      extension,
    );
    const [id] = stdout.split('\t');
    await run('follow', id);
    const child = spawn(execPath, args('check', id, '--extension', extension), {
      env,
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    });
    t.after(() => child.kill());
    const closed = once(child, 'close');
    assert.equal(
      (await Promise.race([once(child, 'message'), closed]))[0],
      'ready',
    );
    await run('unfollow', id);
    child.send('continue');
    assert.deepEqual(await closed, [0, null]);
    const db = new Database(file, { readonly: true });
    try {
      assert.equal(
        db.prepare('SELECT count(*) AS total FROM shelf_chapters').get().total,
        0,
      );
    } finally {
      db.close();
    }
    assert.match(
      (await run('status', id)).stdout,
      /not-following[\s\S]*unchecked/,
    );
  },
);

test('watch cycles retry only eligible chapters, defer missing ones and recover a committed archive', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'comic-dl-watch-cycle-'));
  const shelf = new Shelf(join(directory, 'shelf.db'));
  t.after(async () => {
    shelf.close();
    await rm(directory, { recursive: true, force: true });
  });
  let now = 1_000_000;
  const output = join(directory, 'archives');
  const interval = 3_600_000;
  const tracking = shelf.tracking;
  const signal = new globalThis.AbortController().signal;
  const pagesRead = [];
  const states = new Map();
  let catalog = ['base'];
  const sources = new SourceRegistry().use({
    apiVersion: 1,
    id: 'reader',
    create: () => ({
      id: 'reader',
      async getChapter() {},
      async getSeries() {
        return {
          id: 'work',
          chapters: catalog.map((id) => ({
            id,
            title: id,
            async getPages() {
              const state = states.get(id);
              if (state === 'retry')
                throw new TransientSourceError('internal-only');
              if (state === 'restricted')
                throw new RestrictedChapterError('internal-only');
              if (state === 'blocked') throw new Error('internal-only');
              return [
                {
                  id: '1',
                  extension: 'gif',
                  async read() {
                    pagesRead.push(id);
                    return image;
                  },
                },
              ];
            },
          })),
        };
      },
    }),
  });
  const row = await shelf.add(sources, 'reader', 'work', { signal });
  shelf.setFollowing(row.id, true);
  const cycle = () =>
    runShelfCycle(tracking, sources, tracking.due(now), {
      directory: output,
      interval,
      jobs: 2,
      retries: 0,
      signal,
      now: () => now,
      onCheck: () => {},
      onTask: () => {},
    });
  await cycle();
  assert.equal(tracking.nextDue(), now + interval);
  assert.deepEqual(pagesRead, []);
  catalog = ['base', 'retry', 'restricted', 'blocked'];
  for (const id of catalog.slice(1)) states.set(id, id);
  now += interval;
  await cycle();
  assert.equal(tracking.nextDue(), now + 60_000);
  assert.deepEqual(tracking.needsAttention(row.id), [
    { id: 'blocked', state: 'blocked' },
    { id: 'restricted', state: 'restricted' },
  ]);
  assert.equal(tracking.retry(row.id, 'blocked'), true);
  now += 60_000;
  catalog = ['base', 'blocked'];
  states.clear();
  await cycle();
  assert.deepEqual(pagesRead, ['blocked']);
  assert.equal(tracking.nextDue(), now + interval);
  assert.equal(tracking.status(row.id)[0].pending, 2);

  now += interval;
  catalog = ['base', 'blocked', 'retry', 'restricted'];
  const finishTask = tracking.finishTask;
  tracking.finishTask = () => {
    throw new Error('interrupted after archive commit');
  };
  await assert.rejects(cycle(), /interrupted after archive commit/);
  assert.deepEqual(pagesRead, ['blocked', 'retry']);
  assert.equal((await readdir(output)).length, 2);
  tracking.finishTask = finishTask;
  await cycle();
  assert.deepEqual(pagesRead, ['blocked', 'retry']);
  assert.equal(tracking.status(row.id)[0].complete, 2);

  now += 24 * interval;
  await cycle();
  assert.deepEqual(pagesRead, ['blocked', 'retry', 'restricted']);
  assert.equal(tracking.status(row.id)[0].complete, 3);
  assert.equal(tracking.status(row.id)[0].pending, 0);
});

test('an explicit history check retries if a normal check commits first', async (t) => {
  const { file } = await setup(t);
  const shelf = new Shelf(file);
  try {
    const signal = new globalThis.AbortController().signal;
    const series = { id: 'work', chapters: [{ id: '1' }] };
    const registry = (getSeries) =>
      new SourceRegistry().use({
        apiVersion: 1,
        id: 'reader',
        create: () => ({ id: 'reader', getSeries, async getChapter() {} }),
      });
    const normal = registry(async () => series);
    const row = await shelf.add(normal, 'reader', 'work', { signal });
    shelf.setFollowing(row.id, true);
    const { promise, resolve } = Promise.withResolvers();
    const slower = registry(async () => {
      await promise;
      return series;
    });
    const entries = shelf.tracking.subscriptions(row.id);
    const options = { signal, onCheck: () => {} };
    const backfill = checkSubscriptions(shelf.tracking, slower, entries, {
      ...options,
      includeHistory: true,
    });
    await checkSubscriptions(shelf.tracking, normal, entries, options);
    resolve();
    assert.deepEqual(await backfill, { failures: 0, queued: 1 });
    assert.equal(shelf.tracking.status(row.id)[0].pending, 1);

    const pending = checkSubscriptions(
      shelf.tracking,
      normal,
      shelf.tracking.subscriptions(row.id),
      {
        ...options,
        includeHistory: true,
      },
    );
    shelf.setFollowing(row.id, false);
    assert.deepEqual(await pending, { failures: 1, queued: 0 });
  } finally {
    shelf.close();
  }
});

test('a missing output marker defers downloads before writing and before archive commit', async (t) => {
  const { file, directory } = await setup(t);
  const shelf = new Shelf(file);
  try {
    const signal = new globalThis.AbortController().signal;
    const output = join(directory, 'mounted');
    const marker = join(output, '.nas-ready');
    let now = 1_000_000;
    let reads = 0;
    let chapterIds = ['1'];
    const sources = new SourceRegistry().use({
      apiVersion: 1,
      id: 'reader',
      create: () => ({
        id: 'reader',
        async getChapter() {},
        async getSeries() {
          return {
            id: 'work',
            chapters: chapterIds.map((id) => ({
              id,
              async getPages() {
                return [
                  {
                    id: 'p1',
                    extension: 'gif',
                    async read() {
                      if (++reads === 1) await rm(marker);
                      return image;
                    },
                  },
                ];
              },
            })),
          };
        },
      }),
    });
    const row = await shelf.add(sources, 'reader', 'work', { signal });
    shelf.setFollowing(row.id, true);
    const cycle = () =>
      runShelfCycle(shelf.tracking, sources, shelf.tracking.due(now), {
        directory: output,
        outputMarker: '.nas-ready',
        now: () => now,
        signal,
        interval: 3_600_000,
        jobs: 1,
        onCheck: () => {},
        onTask: () => {},
      });
    await cycle();
    chapterIds = ['1', '2'];
    now += 3_600_000;
    await cycle();
    await assert.rejects(readdir(output), { code: 'ENOENT' });
    assert.equal(reads, 0);
    assert.equal(shelf.tracking.nextDue(), now + 60_000);
    assert.equal(shelf.tracking.status(row.id)[0].pending, 1);

    await mkdir(output);
    await writeFile(marker, '');
    now += 60_000;
    await cycle();
    assert.deepEqual(await readdir(output), []);
    assert.equal(shelf.tracking.status(row.id)[0].pending, 1);

    await writeFile(marker, '');
    now += 60_000;
    await cycle();
    assert.equal(shelf.tracking.status(row.id)[0].complete, 1);
    assert.equal(
      (await readdir(output)).filter((name) => name.endsWith('.cbz')).length,
      1,
    );
  } finally {
    shelf.close();
  }
});

test(
  'watch holds a single process lock and a replacement resumes after a killed watcher',
  { timeout: 10_000 },
  async (t) => {
    const { directory, args, run, env } = await setup(t);
    const output = join(directory, 'archives');
    const fixture = join(directory, 'series.json');
    const write = (chapters) =>
      writeFile(
        fixture,
        JSON.stringify({
          workId: 'fixture',
          chapters: chapters.map((id) => ({
            id,
            title: id,
            pages: ['image.gif'],
          })),
        }),
      );
    await writeFile(join(directory, 'image.gif'), image);
    await write(['1']);
    const { stdout } = await run('add', directory, '--source', 'fixture');
    const [id] = stdout.split('\t');
    await run('follow', id);
    const options = ['--output', output, '--interval', '1'];
    const start = (expected) => {
      const child = spawn(execPath, args('watch', ...options), { env });
      const close = once(child, 'close');
      t.after(() => child.kill());
      let printed = '';
      const ready = new Promise((resolve, reject) => {
        child.stdout.on('data', (chunk) => {
          printed += chunk;
          if (expected.test(printed)) resolve();
        });
        child.stderr.on('data', (chunk) => {
          printed += chunk;
        });
        void close.then(([code]) =>
          reject(new Error(`Watcher exited (${code}): ${printed}`)),
        );
      });
      return { child, close, ready };
    };
    const first = start(/baseline\t0 queued/);
    await first.ready;
    await assert.rejects(run('watch', ...options), {
      code: 1,
      stderr: /already has a running watcher/,
    });
    first.child.kill('SIGKILL');
    await first.close;
    await write(['1', '2']);
    const second = start(/chapter "2"\tcomplete/);
    await second.ready;
    assert.equal((await readdir(output)).length, 1);
    assert.match((await run('status', id)).stdout, /0 pending.*1 complete/);
    second.child.kill('SIGKILL');
    await second.close;
  },
);
