import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { env, execPath } from 'node:process';
import { test } from 'node:test';
import { fileURLToPath, URL } from 'node:url';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
const cli = join(root, 'dist/index.js');
const hello = './examples/hello-extension.mjs';
const zerobyw = '@comic-dl/zerobyw';

function run(...args) {
  return exec(execPath, [cli, ...args], {
    cwd: root,
    env: { ...env, COMIC_DL_ZEROBYW_COOKIE: '' },
  });
}

async function makeDirectory(t) {
  const directory = await mkdtemp(join(tmpdir(), 'comic-dl-extension-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

test('the CLI loads multiple explicit extensions and downloads through an independent source', async (t) => {
  const directory = await makeDirectory(t);
  assert.equal((await run('sources')).stdout, 'fixture\n');
  await assert.rejects(run('list', '--source', 'hello', 'demo'), {
    code: 1,
    stderr: /Unknown source: hello/,
  });
  assert.equal(
    (await run('sources', '--extension', hello, '--extension', zerobyw)).stdout,
    'fixture\nhello\nzerobyw\n',
  );
  const options = ['--extension', hello, '--source', 'hello'];
  assert.equal(
    (await run('list', ...options, 'demo')).stdout,
    'welcome\tWelcome\n',
  );
  const output = ['--output', directory];
  assert.match(
    (await run('chapter', ...options, 'welcome', ...output)).stdout,
    /^Downloaded: /,
  );
  assert.match(
    (await run('download', ...options, 'demo', ...output)).stdout,
    /0 downloaded, 1 skipped, 0 restricted, 0 failed/,
  );
  assert.match(
    (await readdir(directory)).join('\n'),
    /^chapter-welcome-[a-f0-9]+\.cbz$/,
  );
});

test('extensions with an unsupported version, a duplicate ID or an invalid source are rejected', async (t) => {
  const directory = await makeDirectory(t);
  const file = join(directory, 'extension.mjs');
  await writeFile(
    file,
    'export default {apiVersion: 2, id: "other", create() {}};',
  );
  await assert.rejects(run('sources', '--extension', file), {
    code: 1,
    stderr: /Invalid source extension .* API version 1/,
  });
  await writeFile(
    file,
    'export default {apiVersion: 1, id: "fixture", create() {}};',
  );
  await assert.rejects(run('sources', '--extension', file), {
    code: 1,
    stderr: /Duplicate source ID: fixture/,
  });
  await writeFile(
    file,
    'export default {apiVersion: 1, id: "other", create() { return {}; }};',
  );
  await assert.rejects(
    run('list', '--extension', file, '--source', 'other', 'demo'),
    {
      code: 1,
      stderr: /Extension other returned an invalid source/,
    },
  );
  await assert.rejects(
    run('sources', '--extension', 'https://example.invalid/extension.mjs'),
    {
      code: 1,
      stderr: /installed package name or a local extension file path/,
    },
  );
});
