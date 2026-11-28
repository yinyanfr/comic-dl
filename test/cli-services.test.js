import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { execFile, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL, URL } from 'node:url';
import { promisify } from 'node:util';
import { createProgress } from '../dist/cli-progress.js';

const exec = promisify(execFile);
const cli = fileURLToPath(new URL('../dist/index.js', import.meta.url));
const image = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

async function setup(t) {
  const root = await mkdtemp(join(tmpdir(), 'comic-dl-cli-services-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const env = {
    ...process.env,
    COMIC_DL_EXTENSION_DIR: join(root, 'extensions'),
  };
  const run = (...args) => exec(process.execPath, [cli, ...args], { env });
  const output = join(root, 'output');
  await writeFile(join(root, 'page.gif'), image);
  await writeFile(
    join(root, 'series.json'),
    JSON.stringify({
      workId: 'work',
      metadata: { title: 'Example' },
      chapters: [
        { id: 'first', title: 'Opening', pages: ['page.gif', 'page.gif'] },
      ],
    }),
  );
  return { root, output, env, run };
}

test('CLI page progress stays on stderr, is opt-in for pipes, and archive flags preserve stdout', async (t) => {
  const { root, output, run } = await setup(t);
  const args = ['download', '--fixture', root, '-o', output];
  const result = await run(
    ...args,
    '--progress',
    'plain',
    '--archive-padding',
    '3',
    '--archive-format',
    'zip',
  );
  assert.match(result.stdout, /Example[/\\]001-Opening\.zip/);
  assert.match(
    result.stderr,
    /reading: Example \/ Opening — 1\/2 pages \(50%\)/,
  );
  assert.match(
    result.stderr,
    /reading: Example \/ Opening — 2\/2 pages \(100%\)/,
  );
  assert.match(result.stderr, /archiving:/);
  assert.match(result.stderr, /downloaded:/);
  assert.equal(result.stderr.includes('\x1b'), false);
  assert.equal((await run(...args)).stderr, '');
  assert.equal((await run(...args, '--progress', 'off')).stderr, '');
  await assert.rejects(run(...args, '--progress', 'yes'), { code: 2 });
  await assert.rejects(run(...args, '--archive-padding', '13'), { code: 2 });
  await assert.rejects(run(...args, '--archive-format', 'tar'), { code: 2 });
  const config = join(root, 'config.json');
  await writeFile(
    config,
    JSON.stringify({
      version: 1,
      output: './configured',
      archive: { template: '{workId}/{chapterId}', padding: 4, format: 'zip' },
    }),
  );
  const merged = await run(
    'download',
    '--fixture',
    root,
    '--config',
    config,
    '--archive-template',
    '{title}/{number}',
  );
  assert.match(merged.stdout, /Example[/\\]0001\.zip/);
});

test('terminal progress cleans untrusted titles, handles unknown totals and clears interrupted lines', () => {
  let text = '';
  const progress = createProgress('auto', {
    isTTY: true,
    columns: 200,
    write: (value) => {
      text += value;
    },
  });
  const task = {
    state: 'starting',
    workTitle: 'Title\x1b\n',
    chapterTitle: 'Chapter',
    pagesDownloaded: 0,
    attempt: 1,
  };
  progress.onEvent({ type: 'task', task });
  assert.match(text, /0 pages/);
  assert.equal(text.includes('Title\x1b'), false);
  progress.finish();
  assert.ok(text.endsWith('\r\x1b[2K'));
  text = '';
  progress.onEvent({ type: 'task', task: { ...task, state: 'failed' } });
  assert.ok(text.endsWith('\n'));
  let narrow = '';
  createProgress('auto', {
    isTTY: true,
    columns: 60,
    write(value) {
      narrow += value;
    },
  }).onEvent({
    type: 'task',
    task: {
      ...task,
      state: 'downloaded',
      totalPages: 2,
      pagesDownloaded: 2,
      workTitle: '漫画'.repeat(100),
    },
  });
  assert.match(narrow, /2\/2 pages \(100%\)/);
  const line = narrow.replace('\r\x1b[2K', '').trimEnd();
  const cells = [...line].reduce(
    (count, character) => count + (/[^\x20-\x7e]/u.test(character) ? 2 : 1),
    0,
  );
  assert.ok(cells < 60);
});

test('manual CLI NAS guards refuse missing markers and never recreate selected directories', async (t) => {
  const { root, output, run } = await setup(t);
  const args = [
    'download',
    '--fixture',
    root,
    '-o',
    output,
    '--output-root',
    root,
    '--require-output-marker',
    '.ready',
  ];
  await assert.rejects(run(...args), { code: 1 });
  await assert.rejects(readdir(output), { code: 'ENOENT' });
  await mkdir(output);
  await assert.rejects(run(...args), { code: 1 });
  await writeFile(join(root, '.ready'), '');
  await run(...args);
  await rm(output, { recursive: true });
  await assert.rejects(run(...args), { code: 1 });
  await assert.rejects(readdir(output), { code: 'ENOENT' });
  await assert.rejects(
    run(
      'download',
      '--fixture',
      root,
      '-o',
      output,
      '--require-output-marker',
      '.ready',
    ),
    { code: 2 },
  );
});

test('CLI migration previews are read-only and applying requires the reviewed, root-bound plan', async (t) => {
  const { root, output, run } = await setup(t);
  await run('download', '--fixture', root, '-o', output);
  const oldPath = join(output, 'Example', '1-Opening.cbz');
  const original = await readFile(oldPath);
  const preview = JSON.parse(
    (
      await run(
        'migrate',
        '--fixture',
        root,
        '-o',
        output,
        '--archive-template',
        '{workId}/{chapterId}',
        '--archive-format',
        'zip',
      )
    ).stdout,
  );
  assert.equal(preview.items[0].status, 'move');
  assert.deepEqual(await readFile(oldPath), original);
  const file = join(root, 'preview.json');
  await writeFile(file, JSON.stringify(preview));
  await assert.rejects(run('migrate', '--apply', file, '-o', root), {
    code: 1,
  });
  await writeFile(join(root, 'outside'), 'sentinel');
  const unsafe = {
    ...preview,
    items: [{ ...preview.items[0], to: '../outside' }],
  };
  await writeFile(file, JSON.stringify(unsafe));
  await assert.rejects(run('migrate', '--apply', file, '-o', output), {
    code: 1,
  });
  assert.equal(await readFile(join(root, 'outside'), 'utf8'), 'sentinel');
  await writeFile(file, JSON.stringify({ ...preview, items: [null] }));
  await assert.rejects(run('migrate', '--apply', file, '-o', output), {
    code: 1,
  });
  await writeFile(file, JSON.stringify(preview));
  await mkdir(join(output, 'work'));
  await writeFile(join(output, 'work', 'first.zip'), 'occupied');
  await assert.rejects(run('migrate', '--apply', file, '-o', output), {
    code: 1,
  });
  assert.deepEqual(await readFile(oldPath), original);
  assert.equal(
    await readFile(join(output, 'work', 'first.zip'), 'utf8'),
    'occupied',
  );
  await rm(join(output, 'work', 'first.zip'));
  await run('migrate', '--apply', file, '-o', output);
  assert.deepEqual(await readFile(join(output, 'work', 'first.zip')), original);
  await assert.rejects(readFile(oldPath), { code: 'ENOENT' });
  assert.equal(
    (await run('download', '--fixture', root, '-o', output)).stderr,
    '',
  );
});

test('CLI JSON discovery retains metadata and covers without serializing source methods', async (t) => {
  const { root, run } = await setup(t);
  const details = JSON.parse(
    (await run('list', '--fixture', root, '--details')).stdout,
  );
  assert.equal(details.metadata.title, 'Example');
  assert.deepEqual(details.chapters, [
    { id: 'first', title: 'Opening', number: 1 },
  ]);
  const file = join(root, 'search.mjs');
  await writeFile(
    file,
    `export default { id: 'sample', apiVersion: 1, create() { return {
    id: 'sample', search: async () => ({ results: [{title:'Example',url:'https://example.invalid/1',coverUrl:'https://example.invalid/cover.jpg'}],hasNext:false }),
    getSeries(){throw Error('unused')}, getChapter(){throw Error('unused')}
  } } }`,
  );
  const page = JSON.parse(
    (await run('search', '--source', 'sample', '--extension', file, '--json'))
      .stdout,
  );
  assert.equal(page.results[0].coverUrl, 'https://example.invalid/cover.jpg');
});

test('CLI managed inventory and check-only updates isolate failures and never switch versions', async (t) => {
  const { root, env, run } = await setup(t);
  assert.deepEqual(JSON.parse((await run('extensions')).stdout), []);
  const generation = randomUUID();
  const project = join(env.COMIC_DL_EXTENSION_DIR, generation);
  await mkdir(join(project, 'readers'), { recursive: true });
  const dependencies = { '@test/good': '^1.0.0', '@test/bad': 'latest' };
  await writeFile(
    join(project, 'package.json'),
    JSON.stringify({ dependencies }),
  );
  for (const name of Object.keys(dependencies)) {
    const directory = join(project, 'node_modules', name);
    await mkdir(directory, { recursive: true });
    await writeFile(
      join(directory, 'package.json'),
      JSON.stringify({ name, version: '1.0.0' }),
    );
    await writeFile(
      join(directory, 'index.mjs'),
      name.endsWith('bad')
        ? 'throw Error("secret")'
        : 'export default {id:"sample",apiVersion:1,create(){throw Error("Should not create a session")}}',
    );
  }
  await writeFile(
    join(project, 'resolve.mjs'),
    `export const resolvePackage = name => ${JSON.stringify(pathToFileURL(join(project, 'node_modules/')).href)} + name + '/index.mjs'`,
  );
  await writeFile(join(env.COMIC_DL_EXTENSION_DIR, 'current'), generation);
  const registry = createServer((request, response) => {
    if (!decodeURIComponent(request.url).startsWith('/@test/good')) {
      response.writeHead(404).end();
      return;
    }
    response.setHeader('content-type', 'application/json');
    response.end(
      JSON.stringify({
        name: '@test/good',
        'dist-tags': { latest: '2.0.0' },
        versions: {
          '1.0.0': { version: '1.0.0' },
          '1.1.0': { version: '1.1.0' },
          '2.0.0': { version: '2.0.0' },
        },
      }),
    );
  });
  await new Promise((resolve) => registry.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => registry.close(resolve)));
  env.npm_config_registry = `http://127.0.0.1:${registry.address().port}`;
  env.npm_config_fetch_retries = '0';
  env.npm_config_cache = join(root, 'cache');
  const inventory = JSON.parse((await run('extensions')).stdout);
  assert.equal(inventory[0].status, 'failed');
  assert.equal(inventory[1].sourceId, 'sample');
  const updates = JSON.parse(
    (await run('update', '@test/good', '--check')).stdout,
  );
  assert.equal(updates[0].availableVersion, '1.1.0');
  await assert.rejects(run('update', '--check'), (error) => {
    assert.equal(error.code, 1);
    const results = JSON.parse(error.stdout);
    assert.equal(results[0].updateStatus, 'failed');
    assert.equal(results[1].updateStatus, 'available');
    assert.doesNotMatch(error.stdout, /secret/);
    return true;
  });
  assert.equal(
    await readFile(join(env.COMIC_DL_EXTENSION_DIR, 'current'), 'utf8'),
    generation,
  );
  assert.equal(
    JSON.parse((await run('extensions')).stdout)[1].version,
    '1.0.0',
  );
});

for (const transport of ['ipc', 'signal'])
  test(
    `CLI watcher consumes page events and stops cleanly via ${transport}`,
    {
      timeout: 15000,
      skip: transport === 'signal' && process.platform === 'win32',
    },
    async (t) => {
      const { root, output, env, run } = await setup(t);
      const db = join(root, 'shelf.sqlite');
      const entry = (
        await run('shelf', 'add', root, '--source', 'fixture', '--shelf-db', db)
      ).stdout.split('\t')[0];
      await run('shelf', 'check', entry, '--include-history', '--shelf-db', db);
      const child = spawn(
        process.execPath,
        [
          ...(transport === 'ipc'
            ? [
                '--import',
                `data:text/javascript;base64,${Buffer.from(
                  `
            import process from 'node:process';
            process.once('message', (message) => {
              if (message === 'interrupt') {
                process.emit('SIGTERM');
                process.disconnect();
              }
            });
          `,
                ).toString('base64')}`,
              ]
            : []),
          cli,
          'shelf',
          'watch',
          '--shelf-db',
          db,
          '-o',
          output,
          '--progress',
          'plain',
        ],
        {
          env,
          stdio: [
            'ignore',
            'pipe',
            'pipe',
            ...(transport === 'ipc' ? ['ipc'] : []),
          ],
        },
      );
      t.after(() => {
        if (child.exitCode === null) child.kill('SIGTERM');
      });
      let stderr = '';
      let stdout = '';
      const closed = once(child, 'close');
      let interrupted = false;
      child.stdout.on('data', (chunk) => {
        stdout += chunk;
      });
      child.stderr.on('data', (chunk) => {
        stderr += chunk;
        if (!interrupted && stderr.includes('downloaded:')) {
          interrupted = true;
          if (transport === 'ipc') child.send('interrupt');
          else child.kill('SIGTERM');
        }
      });
      const [code, signal] = await closed;
      assert.equal(code, 130, stderr);
      assert.equal(signal, null);
      assert.match(stderr, /2\/2 pages/);
      assert.equal(stderr.includes('\x1b'), false);
      assert.match(stdout, /Watching shelf/);
    },
  );
