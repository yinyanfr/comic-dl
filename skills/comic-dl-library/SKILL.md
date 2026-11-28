---
name: comic-dl-library
description: Integrate comic-dl public Node.js and TypeScript APIs for downloads, task progress, authenticated covers, shelf automation, and managed extensions. Use when writing scripts or a server backend instead of parsing CLI output.
---

# comic-dl library integration

## Establish context

Use Node.js 24 and ESM. Read the application's `AGENTS.md`, installed package version, and public types before editing. Use [the library guide](https://yinyanfr.github.io/comic-dl/en/guide/library/), [service guide](https://yinyanfr.github.io/comic-dl/en/guide/service-api/), and [API reference](https://yinyanfr.github.io/comic-dl/en/reference/library-api/). Instructions target core 4.1+; verify signatures against the installed version.

Ask which source, credentials channel, output root, shelf database, and lifecycle the application requires. Do not install dependencies or contact real sources unless within the user's request.

## Register and download

Install the core and a trusted source as application dependencies when authorized. Prefer isolated instances:

```js
import { createDownloader } from 'comic-dl';
import copymanga from '@comic-dl/copymanga';

const app = createDownloader().use(copymanga);
const series = await app.list(input, { source: 'copymanga' });
const results = await app.download(input, {
  source: 'copymanga',
  chapters: ['2-4'],
  directory: './downloads',
  signal,
  onEvent: handleTaskEvent,
});
```

`input`, `signal`, and `handleTaskEvent` above are supplied by the application. Inspect `series.chapters` before selecting chapters. Ranges are inclusive positions in the complete directory; stable chapter IDs take precedence.

- `.use()` registers only the given source. `createDownloader()` does not automatically load CLI configuration or installed CLI extensions.
- Use `readConfig()` and `withManagedDownloader()` for explicit managed loading. Await all operations inside its callback.
- Do not import private `dist/` modules, duplicate interfaces, shell out to parse CLI text, or directly edit SQLite.
- Inspect every result: `downloaded`, `skipped`, `restricted`, and `failed`. Per-chapter failure does not necessarily reject the batch Promise; setup, validation, and cancellation can reject.

## Tasks and server boundaries

Use `startDownload()` for a retained manual handle with `snapshot()`, `cancel()`, `done`, and `retry()`. Handle Promise rejections; await `retry()` for subsequent attempts rather than reusing the initial `done`.

- Use `onEvent` and safe task snapshots for progress. Total pages can be unknown; retries reset attempt-local page counts.
- Manual handles/queues are in memory. Watcher queues persist, but live page counts do not. Reconnecting clients should fetch a fresh snapshot.
- Raw results, archive paths, and low-level errors are server-only. Do not serialize them to browsers. Authenticate pages, APIs, cover routes, and event streams in the application's own transport layer.
- Read authenticated covers through `readCover(coverId, { source, signal })`, not an arbitrary-URL proxy. Never expose source credentials in metadata or public cover URLs.

## Shelf lifecycle

1. Open via `await app.openShelf({ file })` after registering sources.
2. Keep `autoCheck` and `autoDownload` independent with `configure()`. First checks create baselines; only explicit history requests should queue old chapters.
3. Run one `shelf.watch({ signal, directory, onEvent })` per shelf. Do not also run a CLI watcher on the same database.
4. On shutdown, abort the watcher, await its termination, then call `shelf.close()` in cleanup. Never close while the watcher is active.

## Storage and maintenance

Use `outputRoot`/`outputMarker` for real NAS mounts and existing selected directories. Never recreate a missing mount to make a download pass. Use public `planArchiveMigration()` and `applyArchiveMigration()` only after backup, stopping other writers, reviewing the plan, and obtaining apply authorization. Migration is not a batch transaction.

Use `listManagedExtensions()` and `checkExtensionUpdates()` for inspection; `manageExtensions()` mutates trusted code installations. Restart long-lived instances after changing adapters/settings.

## Verify and report

Test with explicitly registered `fixtureExtension` and local fixtures; it has no search capability, so use a contract-compliant test source for search. Test mixed results, cancellation, unknown totals, retry, shutdown ordering, and output protection. Report offline checks separately from real-source/NAS acceptance. Never log credentials or claim a deployment was validated by fixture tests.
