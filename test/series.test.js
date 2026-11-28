import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { execFile, fork } from 'node:child_process';
import { once } from 'node:events';
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execPath } from 'node:process';
import { test } from 'node:test';
import { fileURLToPath, URL } from 'node:url';
import { promisify } from 'node:util';
import { createDownloader, fixtureExtension } from 'comic-dl';
import { outputFiles as readdir } from './helpers/output.js';

const exec = promisify(execFile);
const cli = fileURLToPath(new URL('../dist/index.js', import.meta.url));
const page = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

async function makeFixture(t, chapters, workId = 'work') {
  const directory = await mkdtemp(join(tmpdir(), 'comic-dl-series-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const output = join(directory, 'output');
  const manifest = { workId, chapters };
  const writeManifest = () =>
    writeFile(join(directory, 'series.json'), JSON.stringify(manifest));
  await writeManifest();
  await writeFile(join(directory, 'page.gif'), page);
  return { directory, output, manifest, writeManifest };
}

function run(...args) {
  return exec(execPath, [cli, ...args]);
}

test('the public download API validates selections and supports direct chapters', async (t) => {
  const { directory, output } = await makeFixture(
    t,
    ['1-2', 'second', 'third'].map((id) => ({
      id,
      title: id,
      pages: ['page.gif'],
    })),
  );
  const app = createDownloader({ source: 'fixture', output, jobs: 1 }).use(
    fixtureExtension,
  );
  await assert.rejects(
    app.download(directory, { chapters: ['second', 'missing'] }),
    /Unknown chapter ID/,
  );
  await assert.rejects(readdir(output), { code: 'ENOENT' });
  assert.equal(
    (await app.downloadChapter(directory, { chapterId: '1-2' })).chapterId,
    '1-2',
  );
  const selected = await app.download(directory, {
    chapters: ['2-3', '1-2', 'second'],
  });
  assert.deepEqual(
    selected.map(({ chapterId, status }) => [chapterId, status]),
    [
      ['1-2', 'skipped'],
      ['second', 'downloaded'],
      ['third', 'downloaded'],
    ],
  );
  await writeFile(
    join(directory, 'chapter.json'),
    JSON.stringify({
      workId: 'work',
      chapterId: 'direct',
      pages: ['page.gif'],
    }),
  );
  assert.equal((await app.downloadChapter(directory)).chapterId, 'direct');
});

test('the public shelf API checks and watches the same database as the CLI', async (t) => {
  const { directory, output, manifest, writeManifest } = await makeFixture(t, [
    { id: 'first', title: 'First', pages: ['page.gif'] },
  ]);
  const file = join(directory, 'shelf.sqlite');
  const app = createDownloader({ source: 'fixture', output }).use(
    fixtureExtension,
  );
  const shelf = await app.openShelf({ file });
  t.after(() => shelf.close());
  const entry = await shelf.add(directory, { title: 'Series' });
  shelf.follow(entry.id);
  const baseline = await shelf.check({ entryId: entry.id });
  assert.equal(baseline.events[0].status, 'baseline');
  assert.equal(baseline.queued, 0);

  manifest.chapters.push({ id: 'new', title: 'New', pages: ['page.gif'] });
  await writeManifest();
  assert.equal((await shelf.check({ entryId: entry.id })).queued, 1);
  assert.equal(shelf.status(entry.id)[0].pending, 1);

  const controller = new globalThis.AbortController();
  const signal = globalThis.AbortSignal.any([
    controller.signal,
    globalThis.AbortSignal.timeout(5000),
  ]);
  await shelf
    .watch({
      signal,
      onTask(event) {
        assert.equal(event.chapterId, 'new');
        assert.equal(event.state, 'complete');
        controller.abort();
      },
    })
    .catch((error) => {
      if (error !== controller.signal.reason) throw error;
    });
  assert.equal(shelf.status(entry.id)[0].complete, 1);
  assert.equal((await readdir(output)).length, 1);
  assert.match(
    (await run('shelf', 'status', entry.id, '--shelf-db', file)).stdout,
    /1 complete/,
  );
  shelf.unfollow(entry.id);
  shelf.remove(entry.id);
  assert.deepEqual(shelf.list(), []);
  assert.equal((await readdir(output)).length, 1);
});

test('lists chapters; series continues past a failure and can resume', async (t) => {
  const { directory, output } = await makeFixture(t, [
    { id: '3', title: 'Opening', pages: ['page.gif'] },
    { id: '1', title: 'Middle', pages: ['missing.gif'] },
    { id: '2', title: 'Finale', pages: ['page.gif'] },
  ]);
  assert.equal(
    (await run('l', '--fixture', directory)).stdout,
    '3\tOpening\n1\tMiddle\n2\tFinale\n',
  );
  const options = ['--fixture', directory, '--output', output];
  assert.match((await run('c', ...options, '-c', '3')).stdout, /^Downloaded: /);
  await assert.rejects(run('download', ...options, '--jobs', '1'), {
    code: 1,
    stderr: /Failed: chapter 1 \(attempts: 1, source: fixture\).*missing\.gif/,
    stdout:
      /^Skipped: .+\nDownloaded: .+\nSummary: 1 downloaded, 1 skipped, 1 failed, 0 cancelled\n$/,
  });
  assert.equal((await readdir(output)).length, 2);
  await writeFile(join(directory, 'missing.gif'), page);
  assert.match(
    (await run('download', ...options)).stdout,
    /Summary: 1 downloaded, 2 skipped, 0 failed, 0 cancelled/,
  );
  assert.match(
    (await run('download', ...options)).stdout,
    /Summary: 0 downloaded, 3 skipped, 0 failed, 0 cancelled/,
  );
  await assert.rejects(run('download', ...options, '--jobs', '0'), { code: 2 });
  await assert.rejects(run('download', ...options, '--retries=-1'), {
    code: 2,
  });
  await assert.rejects(run('chapter', '--fixture', directory), { code: 2 });
  await assert.rejects(run('lists'), { code: 2 });
});

test('downloads inclusive reading positions and validates every selection before writing', async (t) => {
  const { directory, output } = await makeFixture(
    t,
    ['1-2', '10', '20', '30', '40'].map((id) => ({
      id,
      title: id,
      pages: ['page.gif'],
    })),
  );
  const args = ['d', '--fixture', directory, '-o', output, '--jobs', '1'];
  for (const range of ['0-2', '4-2', '2-6', '2-999999999999999999']) {
    await assert.rejects(run(...args, '-c', '10', '-c', range), {
      code: 2,
      stdout: '',
      stderr: /Invalid chapter range/,
    });
  }
  await assert.rejects(readdir(output), { code: 'ENOENT' });

  const { stdout } = await run(...args, '-c', '2-4', '-c', '1-2', '-c', '20');
  assert.deepEqual(
    [...stdout.matchAll(/^Downloaded: .*\/\d+-(.+)\.cbz$/gm)].map(
      ([, id]) => id,
    ),
    ['1-2', '10', '20', '30'],
  );
});

test('selects stable chapter IDs in reading order and rejects unknown IDs before writing', async (t) => {
  const { directory, output } = await makeFixture(t, [
    { id: '30', title: 'Opening', pages: ['page.gif'] },
    { id: '10', title: 'Middle', pages: ['missing.gif'] },
    { id: '20', title: 'Finale', pages: ['page.gif'] },
  ]);
  const args = [
    'download',
    '--fixture',
    directory,
    '--output',
    output,
    '--jobs',
    '1',
  ];
  await assert.rejects(run(...args, '--chapter', '20', '--chapter', '1'), {
    code: 2,
    stdout: '',
    stderr: /Unknown chapter ID.*"1"/,
  });
  await assert.rejects(readdir(output), { code: 'ENOENT' });

  const selection = ['--chapter', '20', '--chapter', '30', '--chapter', '20'];
  assert.match(
    (await run(...args, ...selection)).stdout,
    /^Downloaded: .*1-Opening\.cbz\nDownloaded: .*3-Finale\.cbz\nSummary: 2 downloaded, 0 skipped, 0 failed, 0 cancelled\n$/,
  );
  assert.equal((await readdir(output)).length, 2);
  assert.match(
    (await run(...args, ...selection)).stdout,
    /0 downloaded, 2 skipped/,
  );
});

test('handles identical chapter titles and rejects path traversal and unsafe output links', async (t) => {
  const { directory, output, manifest, writeManifest } = await makeFixture(t, [
    { id: '../same', title: 'Same', pages: ['page.gif'] },
    { id: '___same', title: 'Same', pages: ['page.gif'] },
  ]);
  const args = ['download', '--fixture', directory, '--output'];
  await run(...args, output);
  const archives = await readdir(output);
  assert.equal(archives.length, 2);
  assert.ok(archives.every((name) => /^work\/[12]-Same\.cbz$/.test(name)));

  manifest.workId = 'other-work';
  await writeManifest();
  await run(...args, output);
  assert.equal((await readdir(output)).length, 4);

  const outside = join(directory, 'outside');
  await mkdir(outside);
  const outputLink = join(directory, 'output-link');
  await symlink(outside, outputLink, 'dir');
  await assert.rejects(run(...args, outputLink), {
    code: 1,
    stderr: /not a real directory/,
  });
  await assert.rejects(run(...args, join(outputLink, 'nested')), {
    code: 1,
    stderr: /not a real directory/,
  });
  assert.deepEqual(await readdir(outside), []);
  await mkdir(join(outside, 'nested'));
  await assert.rejects(run(...args, join(outputLink, 'nested')), {
    code: 1,
    stderr: /not a real directory/,
  });
  assert.deepEqual(await readdir(join(outside, 'nested')), []);

  manifest.workId = 'work';
  await writeManifest();
  const archive = join(output, archives[0]);
  const sentinel = join(outside, 'sentinel');
  await writeFile(sentinel, 'keep');
  await rm(archive);
  await symlink(sentinel, archive, 'file');
  await assert.rejects(run(...args, output), {
    code: 1,
    stderr: /not a regular file/,
  });
  assert.equal(await readFile(sentinel, 'utf8'), 'keep');

  manifest.chapters[0].pages = ['../page.gif'];
  await writeManifest();
  await assert.rejects(run(...args, output), {
    code: 1,
    stderr: /must be plain image filenames/,
  });
});

test(
  'SIGINT stops the series, cleans up the current chapter and preserves completed chapters',
  { timeout: 10_000 },
  async (t) => {
    const { directory, output } = await makeFixture(t, [
      { id: 'first', title: 'First', pages: ['page.gif'] },
      { id: 'second', title: 'Second', pages: ['page.gif', 'blocked.gif'] },
      { id: 'third', title: 'Third', pages: ['page.gif'] },
    ]);
    // Block one disk read until the normal CLI signal reaches it.
    const preload = `
    import fs from 'node:fs/promises';
    import { syncBuiltinESMExports } from 'node:module';
    import process from 'node:process';
    import { setTimeout } from 'node:timers/promises';
    const readFile = fs.readFile;
    fs.readFile = async (path, options) => {
      if (String(path).endsWith('blocked.gif')) {
        process.send('reading');
        await setTimeout(30_000, undefined, { signal: options.signal });
      }
      return readFile(path, options);
    };
    syncBuiltinESMExports();
  `;
    const args = [
      'download',
      '--fixture',
      directory,
      '--output',
      output,
      '--jobs',
      '1',
    ];
    const child = fork(cli, args, {
      execArgv: [
        '--import',
        `data:text/javascript;base64,${Buffer.from(preload).toString('base64')}`,
      ],
      silent: true,
    });
    t.after(() => child.kill());
    let stdout = '';
    child.stdout.setEncoding('utf8').on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.resume();
    const closed = once(child, 'close');
    const [message] = await Promise.race([
      once(child, 'message', { signal: t.signal }),
      closed.then(([code]) => {
        throw new Error(`CLI exited before reading: ${code}`);
      }),
    ]);
    assert.equal(message, 'reading');
    child.kill('SIGINT');
    assert.deepEqual(await closed, [130, null]);
    assert.match(
      stdout,
      /Summary: 1 downloaded, 0 skipped, 0 failed, 2 cancelled/,
    );
    assert.match((await readdir(output)).join('\n'), /^work\/1-First\.cbz$/);

    await writeFile(join(directory, 'blocked.gif'), page);
    assert.match(
      (await run(...args)).stdout,
      /Summary: 2 downloaded, 1 skipped, 0 failed, 0 cancelled/,
    );
  },
);
