---
title: Use as a library
description: Use source discovery, downloads, and automatic shelf updates in a Node.js project.
---

For 4.x task snapshots, page progress, independent automation, covers, archive migration, and read-only extension queries, see [Web backends and task APIs](../service-api/). Back up older shelf databases before upgrading.

In a Node.js 24 ESM project (for example, with an `.mjs` file or `"type": "module"` in `package.json`), install the core and the extension as project dependencies:

```sh
npm install comic-dl@latest @comic-dl/zerobyw
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

Replace the example URL with a real series and follow the [Zerobyw README](https://github.com/yinyanfr/comic-dl-extensions/blob/main/extensions/zerobyw/README.en.md) to supply a session in your app's environment. A full URL is matched against registered sources. For a short ID or a URL that matches multiple sources, pass `{ source: 'zerobyw' }`.

Pass `chapters: ['2-4', 'chapter-id']` to `download()` to download only selected chapters. Stable IDs take precedence over inclusive, one-based ranges; every selection is validated before files are written. Use `downloadChapter(chapterUrl, { directory })` for a direct chapter link. It returns a single chapter result and requires an output directory, which can also be set as the downloader's `output` default.

`download()` returns a result for each chapter. `downloaded` and `skipped` include an archive path; `restricted` and `failed` include an error. Check these statuses: a failed chapter does not by itself reject the whole promise. Invalid options, source selection or chapter listing errors, and cancellation of the supplied `signal` reject the call. `directory` defaults to the current directory and `retries` defaults to two additional attempts. `onResult` receives the same result as each chapter finishes.

If `onResult` throws or returns a rejected promise, the downloader stops starting new chapters and waits for in-flight work to finish before rejecting. Completed archives are kept.

The default export is convenient for a script. If different tasks need independent source registries, use `createDownloader()`:

```ts
import { createDownloader } from 'comic-dl';
import zerobyw from '@comic-dl/zerobyw';

const downloader = createDownloader().use(zerobyw);
console.log(downloader.sources()); // ['zerobyw']
```

`createDownloader()` only uses extensions registered through `.use()`. It does not automatically load the CLI's extensions or configuration. Pass `{ source, sourceSettings, overrides, output, jobs, retries }` to set instance defaults. Explicit `source` arguments take precedence over the default source, then URL matching. `validateSourceSettings(id, candidate)` validates candidate changes and returns the resolved non-secret settings without modifying the instance.

Pass `.use(extension, settings)` to override source settings for that instance. Use `sourceSettings(source)` to inspect setting definitions and `await catalogOptions(source, query)` to discover sorts and filters for browsing or keyword search. An empty query browses the catalog:

```js
const page = await downloader.search('', {
  source: 'copymanga',
  sort: 'popular',
});
```

This assumes the instance has registered a CopyManga extension with catalog sorting. `search()` also accepts `page`, `filters`, and `signal`, and returns `{ results, hasNext }`.

## CLI-to-library reference

| CLI                                               | Library API                                                                                                      |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `sources`, `sources --options`                    | `app.sources()`, `app.sourceSettings(source)`                                                                    |
| `search`, `search --options`                      | `app.search(query, options)`, `app.catalogOptions(source, query)`                                                |
| `list`, `download`, `chapter`                     | `app.list()`, `app.download()`, `app.downloadChapter()`                                                          |
| `shelf add/list/set-input/follow/unfollow/remove` | `shelf.add()`, `list()`, `setInput()`, `follow()`, `unfollow()`, `remove()` on the handle from `app.openShelf()` |
| `shelf check/status/watch/retry`                  | `shelf.check()`, `status()` with `needsAttention()`, `watch()`, `retry()`                                        |
| `add`, `update`, `remove`                         | `manageExtensions(action, packageName, options)`                                                                 |
| `--extension`, `--config`, `--set`                | `loadExtension()` or `withManagedDownloader()`, `readConfig()`, `sourceOverrides()`                              |

For a separate Web UI project, call these APIs from a long-running Node.js backend. The backend runs the watcher, so updates continue when the browser is closed.

## Shelf and automatic updates

Use the same SQLite database as the CLI, or pass a separate file for your server. Open the shelf on an instance that has already registered the sources it needs:

```ts
const shelf = await downloader.openShelf({ file: './data/shelf.sqlite' });
try {
  const entry = await shelf.add(url, { title: 'Example' });
  shelf.follow(entry.id);
  const check = await shelf.check({ entryId: entry.id });
  console.log(check.events, shelf.status(entry.id));
} finally {
  shelf.close();
}
```

`list()`, `status()`, and `needsAttention(entryId)` read saved data without calling the sources. Use `setInput()`, `unfollow()`, `remove()`, and `retry(entryId, chapterId)` to manage saved works and failed or restricted chapters. The first successful `check()` records a baseline; pass `includeHistory: true` and an `entryId` to queue existing chapters.

Run `await shelf.watch({ signal, directory, onCheck, onTask })` in a long-lived Node.js process. It shares the CLI's watcher lock. To stop it, abort the signal and wait for the returned promise to settle before closing the shelf. `intervalSeconds`, `jobs`, `retries`, `outputMarker`, and `onOutputUnavailable` configure scheduling and NAS output. See the [automatic updates guide](../../shelf/updates/) for queue and NAS behavior.

## Managed extensions and CLI configuration

```ts
import { manageExtensions, readConfig, withManagedDownloader } from 'comic-dl';

const extensionDirectory = './data/extensions';
await manageExtensions('add', '@comic-dl/copymanga', {
  directory: extensionDirectory,
});
const config = await readConfig('./comic-dl.json');
const page = await withManagedDownloader(
  { ...config, extensionDirectory },
  (app) => app.search('', { source: 'copymanga' }),
);
```

Use `manageExtensions('update', undefined, options)` to update all packages within their saved ranges, or `'remove'` with a package name to uninstall it. Omit the directory to use the same extension store as the CLI. `withManagedDownloader()` keeps the current generation installed for the duration of the callback. Await all work inside it; a long-lived watcher uses that generation until it stops. Restart the watcher after changing its extensions or settings.

For explicit registration, use `loadExtension(pathOrPackage)` or import the extension directly. The built-in `fixtureExtension` can be registered explicitly for [local testing](../../development/local-testing/). Use `sourceOverrides()` if you need to parse CLI-style `source.key=value` strings; pass its return value as `overrides`.
