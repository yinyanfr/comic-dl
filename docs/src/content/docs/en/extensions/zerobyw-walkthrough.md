---
title: Build a Zerobyw sample extension
description: Build an offline adapter from sanitized Zerobyw HTML, then see how the published extension adds authentication, search, and tests.
---

This walkthrough builds an extension that lists chapters and creates a CBZ from a Zerobyw series page and reader page. The sample runs locally without an account or a connection to the manga site. The final steps compare it with the [published extension's source](https://github.com/yinyanfr/comic-dl-extensions/blob/main/extensions/zerobyw/src/index.ts).

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

Append the following to the same file. In the sample, work `1` has one chapter, `101`. The reader puts the actual image URL in `data-src`, while `src` points to a placeholder. An embedded GIF stands in for the image response.

```js
const workId = '1';
const seriesHtml = `
  <section>
    <header><h2>Chapter list</h2></header>
    <div><a href="/pc/view/index.php?zjid=101">Opening</a></div>
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

`chaptersFromSample` parses the chapter list. The CLI's `list` command does not call `getPages()`. A download reads the reader page and calls `Page.read()` for image bytes. The extension supplies the order; the core creates the CBZ.

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
        return { id: workId, chapters: chaptersFromSample() };
      },
      async getChapter(input, signal) {
        signal.throwIfAborted();
        const id = idFromUrl(URL.parse(input), 'chapter');
        const chapter = chaptersFromSample().find((item) => item.id === id);
        if (!chapter) throw new Error('Expected sample chapter 101');
        return { workId, chapter };
      },
    };
  },
};

export default extension;
```

Run these commands from the repository root in the same terminal. If you installed the published extension with `add`, both extensions recognize the same site's URLs. `--source` selects the sample.

```sh
work_url='https://www.zerobyw33.com/pc/details/?kuid=1'
chapter_url='https://www.zerobyw33.com/pc/view/index.php?zjid=101'
node dist/index.js sources --extension "$workshop/source.mjs"
node dist/index.js list "$work_url" --extension "$workshop/source.mjs" --source zerobyw-workshop
node dist/index.js chapter "$chapter_url" --extension "$workshop/source.mjs" --source zerobyw-workshop -o "$workshop/output"
node dist/index.js download "$work_url" --extension "$workshop/source.mjs" --source zerobyw-workshop -o "$workshop/output"
```

Expect `sources` to show `zerobyw-workshop`, `list` to print ID `101` and title `Opening`, and `chapter` to create a CBZ containing `1.gif`. The last command should report `1 skipped`.

## 4. Compare with the live-site implementation

Use the [published extension's source](https://github.com/yinyanfr/comic-dl-extensions/blob/main/extensions/zerobyw/src/index.ts) as a reference for replacing the fixed sample inputs:

1. **Set up two HTTP readers.** In `createZerobywSource`, `api.createSourceHttp` creates `readHtml` and `readImage`. Read the session from `COMIC_DL_ZEROBYW_COOKIE`. `document()` only attaches the cookie to the allowed site origin when reading a series or chapter page. Public search and image requests stay anonymous.
2. **Build the full chapter list.** `getSeries` verifies the login state and work ID, then reads the chapter cards in page order. Take the ID from a readable card's link. For a card explicitly marked VIP that has no link, get its ID from `mangaDownloadChapters`. Compare counts, titles, and readable card IDs so adjacent chapters are not mixed up. Parse embedded data with `JSON.parse` instead of executing page scripts.
3. **Read pages in order.** `readChapter` checks work and chapter identity against the breadcrumbs and `localTranslate`. Prefer `data-src` over `src`, and resolve relative paths against the final response URL. Validate image origins, formats, and page counts. If the page provides `data-page-index`, check for duplicates, gaps, and out-of-range indices before sorting. Otherwise keep DOM order. Use stable fields such as position and URL path for page IDs; omit changing signature parameters. Reload the reader page on retry to avoid expired image links.
4. **Distinguish restrictions from failures.** Use the injected `api.RestrictedChapterError` only if the site explicitly marks the chapter as VIP-only. A chapter confirmed as restricted can still appear in `list`; report the restriction from `getPages()`. An expired session, unknown `403`, missing page, or parse error is a failure. The HTTP helper marks retryable network failures as transient; the core handles retries.
5. **Add public search.** `search(query, page, signal)` sends `keyword` and `page` to `/pc/pc/`, reads links and titles, and deduplicates by work ID. Return `{ results, hasNext }`, with URLs that `getSeries()` accepts directly. An empty query browses the catalog. Determine `hasNext` from the next-page link.

## 5. Run offline regression tests before packaging

After installing dependencies in [comic-dl-extensions](https://github.com/yinyanfr/comic-dl-extensions/blob/main/README.en.md), run the published extension's regression tests:

```sh
npm test --workspace @comic-dl/zerobyw
```

The [tests](https://github.com/yinyanfr/comic-dl-extensions/blob/main/extensions/zerobyw/test/zerobyw.test.js) simulate the site and image host on loopback HTTP. Cover the same checks for your extension: stable IDs and reading order from `list`; the same archive identity and correct page order from series and chapter links; and origin-scoped cookies with distinct outcomes for restricted chapters, expired sessions, and parse failures. Use sanitized page variants to cover lazy-loaded images, restricted cards without links, and pagination.

Load the sample with `--extension` while working on it. When it is ready to share, follow [package independently](../develop/#package-independently) to publish a standalone ESM package, declare its runtime dependencies, and check the [API v1 contract](../../specs/source-extension-v1/).
