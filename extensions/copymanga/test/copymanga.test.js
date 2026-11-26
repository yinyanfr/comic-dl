import { Uint8ArrayReader, Uint8ArrayWriter, ZipReader } from '@zip.js/zip.js';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execPath } from 'node:process';
import { test } from 'node:test';
import { fileURLToPath, URL } from 'node:url';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const cli = fileURLToPath(new URL('../../../dist/index.js', import.meta.url));
const site = 'https://www.copy20.com';
const hotApi = 'https://api.manga2025.com';
const userAgent =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/114.0';
const image = 'https://s3.mangafunb.fun';
const work = `${site}/comic/example`;
const comic = {
  uuid: '01234567-1234-1234-1234-0123456789ab',
  path_word: 'example',
};
const first = '11111111-1234-1234-1234-0123456789ab';
const second = '22222222-1234-1234-1234-0123456789ab';
const refusalMessage = 'Untrusted message from the site';
const query = '示例 & 漫画';

function mockFetch(config, fixtures) {
  const { Headers, Response, URL } = globalThis;
  const {
    site,
    hotApi,
    userAgent,
    image,
    first,
    second,
    comic,
    refusalMessage,
    query,
  } = fixtures;
  const ok = (results) => Response.json({ code: 200, results });
  globalThis.fetch = async (input, init) => {
    const url = new URL(input);
    const headers = new Headers(init.headers);
    if (headers.has('authorization') || headers.has('cookie')) {
      throw new Error('Unexpected authorization header');
    }
    const onHotApi = url.origin === hotApi;
    if (
      headers.get('platform') !== (onHotApi ? '1' : null) ||
      headers.get('user-agent') !== (onHotApi ? userAgent : null) ||
      headers.get('accept') !== (onHotApi ? 'application/json' : null)
    ) {
      throw new Error('Unexpected CopyManga API headers');
    }
    if (url.origin === site && url.pathname === '/api/kb/web/searchcl/comics') {
      if (url.searchParams.get('q') !== query) {
        throw new Error('Invalid query encoding');
      }
      const title =
        url.searchParams.get('offset') === '12' ? 'Second page' : 'Example';
      return ok({ total: 13, list: [{ path_word: 'example', name: title }] });
    }
    if (url.origin === site && url.pathname === '/comics') {
      return new Response(`<div class="exemptComic-box" total="1"
        list="[{&#x27;path_word&#x27;: &#x27;example&#x27;, &#x27;name&#x27;: &#x27;Catalog example&#x27;}]"></div>`);
    }
    if (onHotApi) {
      if (config.denied) {
        return Response.json(
          { code: 210, message: refusalMessage },
          { status: config.denied },
        );
      }
      if (url.pathname === '/api/v3/comic2/example') {
        return ok({ comic, groups: { default: {}, tankobon: {} } });
      }
      if (
        /^\/api\/v3\/comic\/example\/group\/(?:default|tankobon)\/chapters$/.test(
          url.pathname,
        )
      ) {
        const offset = Number(url.searchParams.get('offset'));
        const item =
          offset === 0
            ? { uuid: second, name: 'Second', index: 2 }
            : { uuid: first, name: 'First', index: 1 };
        return ok({ total: 2, offset, list: [item] });
      }
      if (url.pathname === `/api/v3/comic/example/chapter/${first}`) {
        return ok({
          comic,
          chapter: {
            uuid: first,
            name: 'First',
            contents: [
              { url: `${image}/second.jpg` },
              { url: `${image}/first.jpg?signature=private` },
            ],
            words: config.invalidOrder ? [0, 0] : [1, 0],
          },
        });
      }
      if (url.pathname === `/api/v3/comic/example/chapter/${second}`) {
        return ok({ is_lock: true });
      }
    }
    if (url.origin === image) {
      return new Response(url.pathname, {
        headers: { 'Content-Type': 'image/jpeg' },
      });
    }
    throw new Error('Unexpected test request');
  };
}

function runCli(args, config = {}, cwd) {
  const preload = `(${mockFetch.toString()})(${JSON.stringify(config)}, ${JSON.stringify({ site, hotApi, userAgent, image, first, second, comic, refusalMessage, query })});`;
  return exec(
    execPath,
    [
      '--import',
      `data:text/javascript;base64,${Buffer.from(preload).toString('base64')}`,
      cli,
      ...args,
    ],
    { cwd },
  );
}

function run(args, config) {
  return runCli(
    [...args, '--extension', '@comic-dl/copymanga', '--source', 'copymanga'],
    config,
  );
}

test('CopyManga searches and browses the public website anonymously', async () => {
  const result = await runCli([
    's',
    query,
    '--source',
    'copymanga',
    '--page',
    '2',
  ]);
  assert.equal(result.stdout, `${work}\tSecond page\n`);
  assert.equal(result.stderr, '');
  assert.match((await run(['search', query])).stderr, /Next page: 2/);
  assert.equal((await run(['search'])).stdout, `${work}\tCatalog example\n`);
});

test('CopyManga URLs select the source and download to the working directory by default', async (t) => {
  const cwd = await mkdtemp(join(tmpdir(), 'comic-dl-copy-default-'));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  const result = await runCli(['d', work], {}, cwd);
  assert.match(
    result.stdout,
    /1 downloaded, 0 skipped, 1 restricted, 0 failed/,
  );
  const [filename] = await readdir(cwd);
  assert.match(filename, /^chapter-.*\.cbz$/);
  assert.deepEqual(await readdir(cwd), [filename]);

  await assert.rejects(
    runCli(['d', `${site}.invalid/comic/example`], {}, cwd),
    {
      code: 2,
      stderr: /No source matches this URL/,
    },
  );
});

test('CopyManga paginates a chapter group and uses the same ordered CBZ for chapter and series inputs', async (t) => {
  const output = await mkdtemp(join(tmpdir(), 'comic-dl-copy-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  const series = `${work}?group=tankobon`;
  const listed = await run(['list', series]);
  assert.equal(listed.stdout, `${first}\tFirst\n${second}\tSecond\n`);

  const chapter = ['chapter', `${work}/chapter/${first}`, '--output', output];
  await assert.rejects(run(chapter, { invalidOrder: true }), {
    code: 1,
    stderr: /Invalid CopyManga page order/,
  });
  assert.deepEqual(await readdir(output), []);
  assert.match((await run(chapter)).stdout, /^Downloaded:/);
  const [filename] = await readdir(output);
  const reader = new ZipReader(
    new Uint8ArrayReader(await readFile(join(output, filename))),
  );
  try {
    const entries = await reader.getEntries();
    assert.deepEqual(
      entries.map(({ filename }) => filename),
      ['1.jpg', '2.jpg'],
    );
    const pages = await Promise.all(
      entries.map((entry) => entry.getData(new Uint8ArrayWriter())),
    );
    assert.deepEqual(
      pages.map((page) => Buffer.from(page).toString()),
      ['/first.jpg', '/second.jpg'],
    );
  } finally {
    await reader.close();
  }
  const resumed = await run(['download', series, '--output', output]);
  assert.match(
    resumed.stdout,
    /0 downloaded, 1 skipped, 1 restricted, 0 failed/,
  );
  assert.match(resumed.stderr, /CopyManga marked this chapter as restricted/);
  assert.deepEqual(await readdir(output), [filename]);
});

test('CopyManga reports requests refused by the site without printing its message', async () => {
  for (const status of [210, 200]) {
    await assert.rejects(run(['list', work], { denied: status }), (error) => {
      assert.equal(error.code, 1);
      assert.match(
        error.stderr,
        /CopyManga refused this request \(API code 210\)/,
      );
      assert.ok(!error.stderr.includes(refusalMessage));
      return true;
    });
  }
  await assert.rejects(run(['list', `${site}.invalid/comic/example`]), {
    code: 1,
    stderr: /Expected a CopyManga/,
  });
});
