import assert from 'node:assert/strict';
import { execFile, fork } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { outputFiles as readdir } from './helpers/output.js';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { env as parentEnv, execPath } from 'node:process';
import { test } from 'node:test';
import { fileURLToPath, URL } from 'node:url';
import { promisify } from 'node:util';
import Database from 'better-sqlite3';

const exec = promisify(execFile);
const cli = fileURLToPath(new URL('../dist/index.js', import.meta.url));

async function setup(t) {
  const directory = await mkdtemp(join(tmpdir(), 'comic-dl-shelf-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const env = {
    ...parentEnv,
    XDG_DATA_HOME: directory,
    LOCALAPPDATA: directory,
    COMIC_DL_EXTENSION_DIR: join(directory, 'extensions'),
  };
  const file = join(directory, 'comic-dl', 'shelf.sqlite');
  const extensions = [];
  for (const id of ['reader-a', 'reader-b']) {
    const path = join(directory, `${id}.mjs`);
    await writeFile(
      path,
      `export default {
        apiVersion: 1, id: '${id}',
        matchesUrl(url) { return url.hostname === '${id}.invalid'; },
        create() {
          return {
            id: '${id}',
            async getChapter() { throw new Error('No direct chapters'); },
            async getSeries(input) {
              if (input === 'pending') {
                process.send?.('resolving');
                await new Promise((resolve) => process.once('message', resolve));
              }
              if (input.startsWith('bad')) throw new Error(input);
              return {
                id: input === 'other-work' || ('${id}' === 'reader-b' && input.includes('group=default'))
                  ? 'other' : 'shared',
                chapters: [{
                  id: 'first', title: 'Opening',
                  async getPages() {
                    return [{
                      id: 'first', extension: 'gif',
                      async read() {
                        return Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
                      },
                    }];
                  },
                }],
              };
            },
          };
        },
      };`,
    );
    extensions.push('--extension', path);
  }
  const config = join(directory, 'config.json');
  await writeFile(
    config,
    JSON.stringify({
      version: 1,
      source: 'reader-b',
      extensions: extensions.filter((_, index) => index % 2 === 1),
    }),
  );
  const run = (...args) => exec(execPath, [cli, ...args], { env });
  const shelf = (...args) => run('shelf', ...args);
  const rows = () => {
    const db = new Database(file, { readonly: true });
    try {
      return db.prepare('SELECT * FROM shelf_entries ORDER BY source_id').all();
    } finally {
      db.close();
    }
  };
  return { shelf, run, rows, config, extensions, directory, file, env };
}

test('shelf persists source identity and subscriptions, and manages entries without extensions', async (t) => {
  const { shelf, run, rows, config, extensions, directory, file } =
    await setup(t);
  const url = 'https://reader-a.invalid/series?group=tankobon';
  const first = await shelf('add', url, '--title', 'Same', ...extensions);
  const firstId = first.stdout.split('\t')[0];
  assert.equal(first.stdout, `${firstId}\treader-a\tnot-following\tSame\n`);
  const second = await shelf('add', url, '--title', 'Same', '--config', config);
  const secondId = second.stdout.split('\t')[0];
  assert.notEqual(firstId, secondId);
  assert.equal(second.stdout, `${secondId}\treader-b\tnot-following\tSame\n`);
  const followed = await shelf('follow', firstId);
  assert.equal(followed.stdout, `${firstId}\treader-a\tfollowing\tSame\n`);
  assert.deepEqual(await shelf('follow', firstId), followed);
  const before = rows();

  const duplicate = await shelf(
    'add',
    'short-id',
    '--source',
    'reader-a',
    '--title',
    'Different',
    '--config',
    config,
  );
  assert.deepEqual(duplicate, followed);
  assert.deepEqual(rows(), before);
  assert.equal(before[0].input, url);
  assert.equal(before[0].work_id, before[1].work_id);

  const replacement = 'https://reader-a.invalid/series?group=default';
  await shelf('set-input', firstId, replacement, '--config', config);
  assert.equal(rows()[0].input, replacement);
  const revised = rows();
  await assert.rejects(
    shelf('set-input', firstId, 'other-work', ...extensions),
    { code: 1, stderr: /different work/ },
  );
  await assert.rejects(
    shelf('set-input', firstId, 'bad-sensitive-message', ...extensions),
    {
      code: 1,
      stderr:
        /^comic-dl: reader-a: could not resolve the series\. Check the input, source configuration and access\.\n$/,
    },
  );
  await assert.rejects(shelf('set-input', firstId, 'short-id'), {
    code: 1,
    stderr: /Source reader-a is not loaded/,
  });
  for (const input of [
    'https://username:password@reader-a.invalid/series',
    'https://reader-a.invalid/series?group=default&access%5Ftoken=secret',
  ]) {
    await assert.rejects(
      shelf('add', input, '--source', 'reader-a', ...extensions),
      {
        code: 1,
        stderr:
          /^comic-dl: Provide a reusable series input without credentials\.\n$/,
      },
    );
  }
  assert.deepEqual(rows(), revised);

  const output = join(directory, 'output');
  await run('download', url, '--output', output, ...extensions);
  const archives = await readdir(output);
  assert.equal(archives.length, 1);
  const archive = await readFile(join(output, archives[0]));
  await Promise.all(
    extensions.filter((_, index) => index % 2 === 1).map((file) => rm(file)),
  );
  assert.equal((await shelf('unfollow', firstId)).stdout, first.stdout);
  assert.deepEqual(
    (await shelf('list')).stdout.trimEnd().split('\n').sort(),
    [first.stdout.trimEnd(), second.stdout.trimEnd()].sort(),
  );
  const isolated = join(directory, 'other', 'shelf.sqlite');
  assert.equal((await shelf('list', '--shelf-db', isolated)).stdout, '');
  assert.equal(
    (await shelf('list', '--shelf-db', file)).stdout,
    (await shelf('list')).stdout,
  );
  await shelf('remove', firstId);
  assert.equal((await shelf('list')).stdout, second.stdout);
  assert.deepEqual(await readFile(join(output, archives[0])), archive);
  await assert.rejects(shelf('follow', firstId), {
    code: 1,
    stderr: /not found/,
  });
});

test('concurrent shelf initialization and adds share one entry', async (t) => {
  const { shelf, rows, extensions } = await setup(t);
  const results = await Promise.all(
    Array.from({ length: 6 }, () =>
      shelf('add', 'shared', '--source', 'reader-a', ...extensions),
    ),
  );
  assert.equal(rows().length, 1);
  assert.equal(new Set(results.map(({ stdout }) => stdout)).size, 1);
});

test('interrupted and stale input changes preserve the existing entry', async (t) => {
  const { shelf, rows, extensions, env } = await setup(t);
  const { stdout } = await shelf(
    'add',
    'original',
    '--source',
    'reader-a',
    ...extensions,
  );
  const [id] = stdout.split('\t');
  const startChange = async () => {
    const child = fork(
      cli,
      ['shelf', 'set-input', id, 'pending', ...extensions],
      { env, silent: true },
    );
    t.after(() => child.kill());
    const exit = once(child, 'exit');
    const status = await Promise.race([once(child, 'message'), exit]);
    assert.equal(status[0], 'resolving');
    return { child, exit };
  };
  const interrupted = await startChange();
  interrupted.child.kill('SIGKILL');
  await interrupted.exit;
  assert.equal(rows()[0].input, 'original');

  const stale = await startChange();
  await shelf('follow', id);
  stale.child.send('continue');
  assert.deepEqual(await stale.exit, [1, null]);
  assert.equal(rows()[0].input, 'original');
  assert.equal(rows()[0].following, 1);
});

test('a newer database is rejected without modifying it', async (t) => {
  const { shelf, directory } = await setup(t);
  const file = join(directory, 'newer.sqlite');
  const db = new Database(file);
  db.exec('CREATE TABLE other (data TEXT); PRAGMA user_version = 4');
  db.close();
  const before = await readFile(file);
  await assert.rejects(shelf('list', '--shelf-db', file), {
    code: 1,
    stderr: /Unsupported shelf database version: 4/,
  });
  assert.deepEqual(await readFile(file), before);
});
