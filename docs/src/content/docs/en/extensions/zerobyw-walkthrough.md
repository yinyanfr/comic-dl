---
title: Build a Zerobyw sample extension
description: Practice metadata, trusted covers, canonical context, and library/CLI checks offline, then add site settings and authentication.
---

This walkthrough targets core 4.x (still extension API v1). Build an adapter with metadata, public covers, canonical direct-chapter context, and CBZ output. The sample runs locally without an account or a connection to the manga site. Later steps compare it with the `0.3.1` capabilities of the [published extension](https://github.com/yinyanfr/comic-dl-extensions/blob/main/extensions/zerobyw/src/index.ts), including settings and credential binding. Cover URLs are validated, not fetched.

## 1. Extract series and chapter IDs

Use Node.js 24. From the core repository root, install dependencies, build the CLI, and install the Cheerio HTML parser in a separate practice directory:

```sh
npm ci
npm run build
workshop="$(mktemp -d ./zerobyw-workshop.XXXXXX)"
npm install --prefix "$workshop" cheerio@1
```

Create `source.mjs` in `$workshop`. A series page uses `kuid` for the work ID, and a reader page uses `zjid` for the chapter ID. Keep site IDs as strings so a renamed or reordered chapter still has the same identity.

```js
import { load } from 'cheerio/slim';
import { Buffer } from 'node:buffer';

const origin = 'https://www.zerobyw33.com';
const sourceId = 'zerobyw-workshop';

function idFromUrl(url, kind) {
  if (!url || url.origin !== origin || url.username || url.password) return;
  const path = kind === 'series' ? '/pc/details/' : '/pc/view/';
  if (url.pathname !== path && url.pathname !== `${path}index.php`) return;
  const id = url.searchParams.get(kind === 'series' ? 'kuid' : 'zjid');
  if (id && /^[1-9]\d*$/.test(id)) return id;
}
```

The published extension shares its recognition rules across `siteUrl`, `pageId`, and `requestUrl`. `matchesUrl` checks only the URL; the read methods validate input again before constructing a canonical URL. The published implementation also normalizes recognized HTTP links to HTTPS.

## 2. Build chapters and pages from sample HTML

Append the following to the same file. Work `1` has chapters `101/102`; the second proves direct/selected downloads do not become chapter 1. The reader puts the actual image URL in `data-src`, while `src` points to a placeholder. An embedded GIF stands in for the image response.

```js
const workId = '1';
const seriesHtml = `
  <h1>Sample Manga</h1>
  <span class="author">Sample Author</span>
  <p class="summary">Local fixtures only.</p>
  <span class="tag">Slice of life</span>
  <img class="cover" src="http://tupa.zerobyw33.com/covers/1.jpg">
  <section>
    <header><h2>Chapter list</h2></header>
    <div>
      <a href="/pc/view/index.php?zjid=101">Opening</a>
      <a href="/pc/view/index.php?zjid=102">Chapter two</a>
    </div>
  </section>`;
const readerHtml = `
  <div id="image-container">
    <img class="manga-image" data-src="/images/cover.gif" src="/placeholder.gif">
  </div>`;
const image = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

function chaptersFromSample() {
  const $ = load(seriesHtml);
  return $('h2')
    .parent()
    .next()
    .find('a[href]')
    .toArray()
    .map((link) => {
      const id = idFromUrl(new URL($(link).attr('href'), origin), 'chapter');
      if (!id) throw new Error('Invalid chapter link');
      return {
        id,
        title: $(link).text().trim(),
        async getPages(signal) {
          signal.throwIfAborted();
          const reader = load(readerHtml);
          const src = reader('#image-container img.manga-image').attr(
            'data-src',
          );
          if (src !== '/images/cover.gif')
            throw new Error('Missing sample image');
          return [
            {
              id: `1:${src}`,
              extension: 'gif',
              async read(signal) {
                signal.throwIfAborted();
                return image;
              },
            },
          ];
        },
      };
    });
}
```

`chaptersFromSample` parses the chapter list. The CLI's `list` command does not call `getPages()`. A download reads the reader page and calls `Page.read()` for image bytes. The extension supplies the order; the core handles CBZ/ZIP, naming, and page progress.

Append the metadata parser. Only explicitly trusted site/image origins may be normalized to HTTPS. Revalidate origin (including ports), credentials, query, and fragment afterward. Do not trust domain suffixes or accept arbitrary upgraded hosts.

```js
const imageOrigin = 'https://tupa.zerobyw33.com';

function publicCover(value) {
  if (!value) return;
  const url = URL.parse(value, origin);
  if (!url) return;
  if (url.protocol === 'http:') url.protocol = 'https:';
  if (
    url.protocol !== 'https:' ||
    ![origin, imageOrigin].includes(url.origin) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    return;
  return url.href;
}

function metadataFromSample() {
  const $ = load(seriesHtml);
  return {
    title: $('h1').text().trim(),
    authors: [$('.author').text().trim()],
    summary: $('.summary').text().trim(),
    tags: $('.tag')
      .toArray()
      .map((node) => $(node).text().trim()),
    coverUrl: publicCover($('.cover').attr('src')),
  };
}
```

The published adapter builds trusted origins from current settings instead of hardcoding these two values. Omit missing metadata without breaking downloads. Extract search covers from cards without per-series detail requests. Protected covers use credential-free `coverId/readCover()`, never a cookie or Auth Key in `coverUrl`.

## 3. Register the extension and test it with the CLI

Add the API v1 default export to the end of the file. `getSeries` and `getChapter` share stable IDs so the core recognizes an existing archive whether it was created from a series or chapter link.

```js
/** @type {import('comic-dl/extension').SourceExtension} */
const extension = {
  apiVersion: 1,
  id: sourceId,
  matchesUrl(url, kind) {
    return idFromUrl(url, kind) !== undefined;
  },
  create() {
    return {
      id: sourceId,
      async getSeries(input, signal) {
        signal.throwIfAborted();
        if (idFromUrl(URL.parse(input), 'series') !== workId) {
          throw new Error('Expected sample work 1');
        }
        return {
          id: workId,
          metadata: metadataFromSample(),
          chapters: chaptersFromSample(),
        };
      },
      async getChapter(input, signal) {
        signal.throwIfAborted();
        const id = idFromUrl(URL.parse(input), 'chapter');
        const chapter = chaptersFromSample().find((item) => item.id === id);
        if (!chapter) throw new Error('Expected sample chapter 101 or 102');
        return {
          workId,
          chapter,
          seriesInput: new URL(`/pc/details/?kuid=${workId}`, origin).href,
        };
      },
    };
  },
};

export default extension;
```

Run these commands from the repository root in the same terminal. If you installed the published extension with `add`, both extensions recognize the same site's URLs. `--source` selects the sample.

```sh
work_url='https://www.zerobyw33.com/pc/details/?kuid=1'
chapter_url='https://www.zerobyw33.com/pc/view/index.php?zjid=102'
node dist/index.js sources --extension "$workshop/source.mjs"
node dist/index.js list "$work_url" --extension "$workshop/source.mjs" --source zerobyw-workshop
node dist/index.js list "$work_url" --extension "$workshop/source.mjs" --source zerobyw-workshop --details
node dist/index.js chapter "$chapter_url" --extension "$workshop/source.mjs" --source zerobyw-workshop -o "$workshop/output" --progress plain
node dist/index.js download "$work_url" --extension "$workshop/source.mjs" --source zerobyw-workshop -c 2-2 -o "$workshop/output"
node dist/index.js download "$work_url" --extension "$workshop/source.mjs" --source zerobyw-workshop -o "$workshop/output"
```

Expect `sources` to show `zerobyw-workshop`, `list` to return `101/102` in order, and `--details` to include metadata and the HTTPS cover URL. The direct link creates `Sample Manga/2-Chapter two.cbz` containing `1.gif`. Selecting `2-2` skips it; the final full-series command reports `1 downloaded, 1 skipped`. `--progress plain` writes page counts and archive stages to stderr without terminal controls. Default `auto` renders only in a terminal and stays quiet when redirected.

`seriesInput` lets the core reload the full catalog and verify identity, so direct chapters inherit the work title and position 2 rather than fabricating a single-chapter position.

## 4. Verify the same adapter through the public library

Create `$workshop/verify.mjs` and run `node "$workshop/verify.mjs"` from the repository root. The relative core import is for this repository exercise only; independently published projects use `import { createDownloader } from 'comic-dl'`.

```js
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createDownloader } from '../dist/library.js';
import extension from './source.mjs';

const app = createDownloader().use(extension);
const input = 'https://www.zerobyw33.com/pc/details/?kuid=1';
const series = await app.list(input);
assert.equal(
  series.metadata.coverUrl,
  'https://tupa.zerobyw33.com/covers/1.jpg',
);
assert.deepEqual(
  series.chapters.map(({ id }) => id),
  ['101', '102'],
);
const events = [];
const task = app.startDownload(
  'https://www.zerobyw33.com/pc/view/index.php?zjid=102',
  {
    direct: true,
    directory: fileURLToPath(new URL('./library-output', import.meta.url)),
    archive: { padding: 3, format: 'zip' },
    onEvent: (event) => events.push(event),
  },
);
await task.done;
assert.equal(task.snapshot()[0].number, 2);
assert.equal(task.snapshot()[0].state, 'downloaded');
assert.ok(
  events.some(
    ({ task }) => task.state === 'reading' && task.pagesDownloaded === 1,
  ),
);
assert.ok(events.some(({ task }) => task.state === 'archiving'));
const [result] = await app.download(input, {
  chapters: ['2-2'],
  directory: fileURLToPath(new URL('./library-output', import.meta.url)),
});
assert.equal(result.status, 'skipped');
assert.equal(result.number, 2);
```

This creates `Sample Manga/002-Chapter two.zip`. The later default CBZ policy still recognizes the ZIP by identity. Safe task snapshots can serve Web clients; `result.path/error` are server-side details and must not be forwarded directly. See [backend APIs](../../guide/service-api/) for cancellation and retry lifecycles.

## 5. Compare with the live-site implementation

Use the [published extension's source](https://github.com/yinyanfr/comic-dl-extensions/blob/main/extensions/zerobyw/src/index.ts) as a reference for replacing the fixed sample inputs:

1. **Declare settings, then set up two HTTP readers.** Define `site-url/image-url/previous-site-url` as HTTPS origins without paths, credentials, queries, or fragments. `matchesUrl` and `create(api, settings)` share configuration; old inputs supply stable IDs, but reads are rebuilt on the current site. In `createZerobywSource`, initialize `readHtml/readImage` with destination `allowedOrigins`. Read `COMIC_DL_ZEROBYW_COOKIE`, binding it to the current site with `COMIC_DL_ZEROBYW_COOKIE_ORIGIN`; if unset it binds only to the default site. Never automatically forward old cookies to a new host. `document()` explicitly enables authentication only for series/reader pages; public search and images remain anonymous. Credentials stay outside `settings`.
2. **Build the full chapter list.** `getSeries` verifies the login state and work ID, then reads the chapter cards in page order. Take the ID from a readable card's link. For a card explicitly marked VIP that has no link, get its ID from `mangaDownloadChapters`. Compare counts, titles, and readable card IDs so adjacent chapters are not mixed up. Parse embedded data with `JSON.parse` instead of executing page scripts.
3. **Read pages in order.** `readChapter` checks work and chapter identity against the breadcrumbs and `localTranslate`. Prefer `data-src` over `src`, and resolve relative paths against the final response URL. Validate image origins, formats, and page counts. If the page provides `data-page-index`, check for duplicates, gaps, and out-of-range indices before sorting. Otherwise keep DOM order. Use stable fields such as position and URL path for page IDs; omit changing signature parameters. Reload the reader page on retry to avoid expired image links.
4. **Distinguish restrictions from failures.** Use the injected `api.RestrictedChapterError` only if the site explicitly marks the chapter as VIP-only. A chapter confirmed as restricted can still appear in `list`; report the restriction from `getPages()`. An expired session, unknown `403`, missing page, or parse error is a failure. The HTTP helper marks retryable network failures as transient; the core handles retries.
5. **Add public search.** `search(query, page, signal)` sends `keyword` and `page` to `/pc/pc/`, reads links and titles, and deduplicates by work ID. Return `{ results, hasNext }`, with URLs that `getSeries()` accepts directly. An empty query browses the catalog. Determine `hasNext` from the next-page link.
6. **Add metadata and canonical context.** Reuse detail-page metadata and public catalog card covers, validating trusted origins from current settings and covering the `0.3.1` HTTP normalization fix. Return current-site `seriesInput` from verified chapter work IDs so the core can load the full catalog. Do not put cover fetching, archive policy, or terminal rendering inside chapter parsing.

## 6. Run offline regression tests before packaging

After installing dependencies in [comic-dl-extensions](https://github.com/yinyanfr/comic-dl-extensions/blob/main/README.en.md), run the published extension's regression tests:

```sh
npm test --workspace @comic-dl/zerobyw
```

The [tests](https://github.com/yinyanfr/comic-dl-extensions/blob/main/extensions/zerobyw/test/zerobyw.test.js) simulate the site and image host on loopback HTTP. Cover the same checks for your extension: stable IDs and reading order from `list`; the same archive identity and correct page order from series and chapter links; and origin-scoped cookies with distinct outcomes for restricted chapters, expired sessions, and parse failures. Use sanitized page variants to cover lazy-loaded images, restricted cards without links, and pagination.

Also cover missing optional metadata; catalog and authenticated-detail covers; trusted HTTP normalization, configured origins/ports, and rejected unknown hosts/credential/query/fragment URLs; old/current input mapping; mismatched cookie origins; canonical position 2 for direct/range downloads; and public task events containing page counts but no paths or cookies. Authenticated details can use fixtures without real accounts.

Load the sample with `--extension` while working on it. When it is ready to share, follow [package independently](../develop/#package-independently) to publish a standalone ESM package, declare its runtime dependencies, and check the [API v1 contract](../../specs/source-extension-v1/). See the [complete development guide](../develop/) for protected covers and the broader acceptance checklist.
