---
title: Use as a library
description: Register sources, list chapters, and download CBZ archives in a Node.js project.
---

In a Node.js 24 ESM project (for example, with an `.mjs` file or `"type": "module"` in `package.json`), install the core and the extension as project dependencies:

```sh
npm install comic-dl@3.0.0-alpha @comic-dl/zerobyw
```

```ts
import downloader from 'comic-dl';
import zerobyw from '@comic-dl/zerobyw';

downloader.use(zerobyw);

const url = 'https://www.zerobyw33.com/pc/details/?kuid=123';
const series = await downloader.list(url);
console.log(series.chapters.map(({ id, title }) => ({ id, title })));

const results = await downloader.download(url, {
  directory: './downloads',
  jobs: 2,
  onResult: (result) => console.log(result),
});
```

Replace the example URL with a real series and follow the [Zerobyw README](https://github.com/yinyanfr/comic-dl-extensions/blob/main/extensions/zerobyw/README.en.md) to supply a session in your app's environment. A full URL is matched against registered sources. For a short ID or a URL that matches multiple sources, pass `{ source: 'zerobyw' }`. The library downloads the whole series; it does not expose the CLI's `-c` selector.

`download()` returns a result for each chapter. `downloaded` and `skipped` include an archive path; `restricted` and `failed` include an error. Check these statuses: a failed chapter does not by itself reject the whole promise. Invalid options, source selection or chapter listing errors, and cancellation of the supplied `signal` reject the call. `directory` defaults to the current directory and `retries` defaults to two additional attempts. `onResult` receives the same result as each chapter finishes.

The default export is convenient for a script. If different tasks need independent source registries, use `createDownloader()`:

```ts
import { createDownloader } from 'comic-dl';
import zerobyw from '@comic-dl/zerobyw';

const downloader = createDownloader().use(zerobyw);
console.log(downloader.sources()); // ['zerobyw']
```

The library only uses extensions registered through `.use()`. The CLI's `add` command and JSON configuration do not affect library instances.
