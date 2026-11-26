import { Uint8ArrayReader, Uint8ArrayWriter, ZipReader } from '@zip.js/zip.js';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { execFile } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { env, execPath } from 'node:process';
import { test } from 'node:test';
import { fileURLToPath, URL } from 'node:url';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const cli = fileURLToPath(new URL('../dist/index.js', import.meta.url));
const site = 'https://www.zerobyw33.com';
const cdn = 'https://tupa.zerobyw33.com';
const signed = '?signature=never-log-this';
const cookie = 'session=test-only';

function chapterLink(id) {
  return `/pc/view/index.php?zjid=${id}`;
}

function seriesHtml(cards, guest, includeMetadata = true) {
  const metadata = cards.map(([zjid, zjname]) => ({ zjid, zjname }));
  return `
    <script>var discuz_uid = '${guest ? 0 : 123}';</script>
    ${includeMetadata ? `<script>const mangaDownloadChapters = ${JSON.stringify(metadata)};</script>` : ''}
    <section>
      <header><h2>章节列表</h2></header>
      <div>${cards
        .map(([id, title, locked]) =>
          locked
            ? `<div onclick="app.showLockTip('vip')">${title}</div>`
            : `<a href="${chapterLink(id)}">${title}</a>`,
        )
        .join('')}</div>
    </section>`;
}

function chapterHtml(
  id,
  {
    locked = false,
    guest = false,
    workId = 1,
    broken = false,
    domOrder = false,
  } = {},
) {
  const metadata = {
    chapterTitle: `Chapter ${id}`,
    kuid: workId,
    zjid: id,
    lockType: guest ? 'login' : 'vip',
  };
  const images = locked
    ? '<h3>VIP 专属章节</h3>'
    : domOrder
      ? `
    <img class="manga-image" src="../images/1.jpg">
    <img class="manga-image" src="http://tupa.zerobyw33.com/2.jpg${signed}">
  `
      : `
    <img class="manga-image" data-page-index="1" src="//tupa.zerobyw33.com/2.jpg${signed}">
    <img class="manga-image" data-page-index="0" data-src="../images/1.jpg" src="placeholder.gif">
  `;
  return `
    <script>
      const localTranslate = ${JSON.stringify(metadata)};
      ${domOrder ? '' : `const imageCount = ${locked ? 0 : broken ? 3 : 2};`}
    </script>
    <nav class="reader-breadcrumb"><a href="/pc/pc/">Browse</a>
    <a href="../details/?kuid=${workId}">Series</a></nav>
    <img class="manga-image" src="ignored.jpg">
    <div id="image-container">${images}</div>`;
}

async function serve(t, handle) {
  const server = createServer(handle);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}

async function setup(t) {
  const output = await mkdtemp(join(tmpdir(), 'comic-dl-zerobyw-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  const requests = [];
  const siteServer = await serve(t, (req, res) => {
    const url = new URL(req.url, site);
    requests.push(['site', url.pathname + url.search, req.headers.cookie]);
    const guest = req.headers.cookie !== cookie;
    if (url.pathname === '/pc/pc/') {
      if (url.searchParams.get('keyword') === 'missing') {
        res.end('<main>没有找到相关漫画</main>');
        return;
      }
      const page = Number(url.searchParams.get('page'));
      res.end(`<main>
        <a href="http://www.zerobyw33.com/pc/details/?kuid=${page}"><h3>示例 ${page}【1-2话】</h3></a>
        <a href="../details/?kuid=${page}"><h3>重复</h3></a>
        <a href="https://example.invalid/pc/details/?kuid=99"><h3>外部链接</h3></a>
        ${page === 1 ? '<a href="?page=2">下一页</a>' : ''}
      </main>`);
    } else if (url.pathname === '/pc/details/') {
      const id = url.searchParams.get('kuid');
      if (id === '4') {
        res.writeHead(302, { location: `${cdn}/unexpected${signed}` }).end();
        return;
      }
      const cards = {
        1: [
          ['101', 'Opening'],
          ['102', 'Limited', true],
        ],
        2: [['102', 'Limited', true]],
        3: [
          ['103', 'Unknown error'],
          ['104', 'Bad layout'],
        ],
        5: [
          ['105', 'DOM reader'],
          ['106', 'Site restriction'],
        ],
      };
      res.end(seriesHtml(cards[id], guest, id !== '5'));
    } else if (url.pathname === '/pc/view/index.php') {
      const id = Number(url.searchParams.get('zjid'));
      if (id === 103) {
        res.writeHead(403).end();
      } else if (id === 106) {
        res.end('<div id="messagetext"><p>VIP 专属章节</p></div>');
      } else if (id === 107) {
        res.end('<div id="messagetext"><p>请先登录后继续</p></div>');
      } else if (id === 108) {
        res.end(`<main></main><div><p>请求失败 ${signed}</p></div>`);
      } else {
        res.end(
          chapterHtml(id, {
            guest,
            locked: id === 102,
            workId: id === 104 ? 3 : id === 105 ? 5 : 1,
            broken: id === 104,
            domOrder: id === 105,
          }),
        );
      }
    } else if (url.pathname === '/pc/images/1.jpg') {
      res.writeHead(200, { 'content-type': 'image/jpeg' }).end('first page');
    } else {
      res.writeHead(404).end();
    }
  });
  const cdnServer = await serve(t, (req, res) => {
    requests.push(['cdn', req.url, req.headers.cookie]);
    res.writeHead(200, { 'content-type': 'image/jpeg' }).end('second page');
  });
  // Route the production URLs only to the loopback fixtures in the CLI process.
  const preload = `
    const routes = ${JSON.stringify({ [site]: siteServer, [cdn]: cdnServer })};
    const fetch = globalThis.fetch;
    globalThis.fetch = (input, init) => {
      const url = new URL(input);
      const target = routes[url.origin];
      if (!target) throw new Error('Unexpected test request');
      return fetch(new URL(url.pathname + url.search, target), init);
    };
  `;
  const run = (command, input, session = cookie, extra = []) =>
    exec(
      execPath,
      [
        '--import',
        `data:text/javascript;base64,${Buffer.from(preload).toString('base64')}`,
        cli,
        command,
        '--extension',
        '@comic-dl/zerobyw',
        '--source',
        'zerobyw',
        input.startsWith('/') ? site + input : input,
        ...(['chapter', 'download'].includes(command)
          ? ['--output', output]
          : []),
        ...extra,
      ],
      { env: { ...env, COMIC_DL_ZEROBYW_COOKIE: session } },
    );
  return { output, requests, run };
}

test('Zerobyw lists locked chapters, downloads readable pages in order and skips complete CBZs', async (t) => {
  const { output, requests, run } = await setup(t);
  const work = '/pc/details/?kuid=1';
  assert.equal(
    (await run('list', work)).stdout,
    '101\tOpening\n102\tLimited\n',
  );

  const first = await run('chapter', chapterLink(101));
  assert.match(first.stdout, /^Downloaded:/);
  const [name] = await readdir(output);
  const reader = new ZipReader(
    new Uint8ArrayReader(await readFile(join(output, name))),
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
      pages.map((bytes) => Buffer.from(bytes).toString()),
      ['first page', 'second page'],
    );
  } finally {
    await reader.close();
  }
  const resumed = await run('download', work);
  assert.match(
    resumed.stdout,
    /0 downloaded, 1 skipped, 1 restricted, 0 failed/,
  );
  assert.match(resumed.stderr, /Restricted: chapter 102 .*VIP-only/);
  await rm(join(output, name));
  const mixed = await run('download', work);
  assert.match(mixed.stdout, /1 downloaded, 0 skipped, 1 restricted, 0 failed/);
  assert.deepEqual(await readdir(output), [name]);
  assert.equal(
    requests.some(([, path]) => path === chapterLink(102)),
    false,
  );
  assert.equal(requests.filter(([host]) => host === 'cdn').length, 2);
  for (const [host, path, credential] of requests) {
    const isHtml =
      host === 'site' &&
      (path.startsWith('/pc/details/') || path.startsWith('/pc/view/'));
    assert.equal(credential, isHtml ? cookie : undefined);
  }
});

test('Zerobyw searches the public catalog, normalizes result URLs, and reports pagination', async (t) => {
  const { requests, run } = await setup(t);
  const first = await run('search', '甲 & 乙');
  assert.equal(first.stdout, `${site}/pc/details/?kuid=1\t示例 1\n`);
  assert.equal(first.stderr, 'Next page: 2\n');
  const next = await run('search', '甲 & 乙', '', ['--page', '2']);
  assert.equal(next.stdout, `${site}/pc/details/?kuid=2\t示例 2\n`);
  assert.equal(next.stderr, '');
  assert.equal((await run('search', 'missing')).stdout, '');
  assert.deepEqual(
    requests.map(([, path, credential]) => {
      const url = new URL(path, site);
      return [
        url.searchParams.get('keyword'),
        url.searchParams.get('page'),
        credential,
      ];
    }),
    [
      ['甲 & 乙', '1', undefined],
      ['甲 & 乙', '2', undefined],
      ['missing', '1', undefined],
    ],
  );
  await assert.rejects(run('search', 'demo', '', ['--page', '0']), { code: 2 });
});

test('Zerobyw accepts chapter links without download metadata and classifies reader notices', async (t) => {
  const { output, run } = await setup(t);
  const mixed = await run(
    'download',
    'http://www.zerobyw33.com/pc/details/?kuid=5',
  );
  assert.match(mixed.stdout, /1 downloaded, 0 skipped, 1 restricted, 0 failed/);
  assert.match(mixed.stderr, /Restricted: chapter 106/);
  assert.equal((await readdir(output)).length, 1);
  await assert.rejects(run('chapter', chapterLink(107)), {
    code: 1,
    stderr: /session missing or expired/,
  });
  await assert.rejects(run('chapter', chapterLink(108)), {
    code: 1,
    stderr: /^comic-dl: Zerobyw refused to open the chapter \(site notice\)\n$/,
  });
});

test('Zerobyw separates access restrictions from login, HTTP or parsing failures', async (t) => {
  const { output, requests, run } = await setup(t);
  await assert.rejects(run('download', '/pc/details/?kuid=2'), {
    code: 1,
    stdout: /0 downloaded, 0 skipped, 1 restricted, 0 failed/,
  });
  await assert.rejects(run('chapter', chapterLink(102)), {
    code: 1,
    stderr: /Restricted: chapter 102/,
  });
  await assert.rejects(run('download', '/pc/details/?kuid=3'), (error) => {
    assert.equal(error.code, 1);
    assert.match(error.stdout, /0 restricted, 2 failed/);
    assert.match(error.stderr, /HTTP 403/);
    assert.match(error.stderr, /missing or empty page list/);
    return true;
  });
  await assert.rejects(run('list', '/pc/details/?kuid=1', 'session=expired'), {
    code: 1,
    stderr: /session missing or expired/,
  });
  await assert.rejects(run('chapter', chapterLink(101), 'session=expired'), {
    code: 1,
    stderr: /session missing or expired/,
  });
  await assert.rejects(run('list', '/pc/details/?kuid=1', ''), {
    code: 1,
    stderr: /COMIC_DL_ZEROBYW_COOKIE/,
  });
  await assert.rejects(run('list', '/pc/details/?kuid=4'), (error) => {
    assert.equal(error.code, 1);
    assert.match(error.stderr, /redirected to an unrecognized origin/);
    assert.doesNotMatch(error.stderr, /never-log-this|session=test-only/);
    return true;
  });
  assert.equal(
    requests.some(([host]) => host === 'cdn'),
    false,
  );
  const before = requests.length;
  await assert.rejects(
    run('list', `https://www.zerobyw33.com.invalid/pc/details/${signed}`),
    (error) => {
      assert.equal(error.code, 1);
      assert.match(error.stderr, /Expected a Zerobyw series URL/);
      assert.doesNotMatch(error.stderr, /never-log-this|session=test-only/);
      return true;
    },
  );
  assert.equal(requests.length, before);
  assert.deepEqual(await readdir(output), []);
});
