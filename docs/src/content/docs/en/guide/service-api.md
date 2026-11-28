---
title: Web backends and task APIs
description: Independent automation, safe task snapshots, archive migration, covers, and managed extension queries.
---

These APIs are available from 4.0 and run only in a Node.js 24 backend. Do not load the core, extensions, or SQLite in the browser. See the [library guide](../library/) for registration and the [migration guide](../../migration/v3-to-v4/) before upgrading.

## Shelf checks and automation

```ts
const shelf = await app.openShelf({ file: './data/shelf.sqlite' });
shelf.setDefaultInterval(3600);
shelf.configure(entryId, {
  autoCheck: true,
  autoDownload: false,
  intervalSeconds: 1800,
});
await shelf.check(); // Entire shelf, including entries with automation disabled.
await shelf.check({ entryId });
const chapters = shelf.chapters(entryId);
shelf.enqueue(entryId, chapterId);
shelf.cancel(entryId, chapterId);
shelf.retry(entryId, chapterId);
```

`autoCheck` enables scheduled checks. `autoDownload` controls whether newly discovered chapters enter the queue, including during manual checks. Disabling either switch does not cancel existing work; call `cancel()` explicitly. `follow/unfollow` remain compatibility shortcuts for switching both. Set an entry's `intervalSeconds` to `null` to use the global default. Changing an interval recalculates the next check without clearing the baseline.

The first successful check only establishes a baseline. Later chapters not queued automatically remain `discovered` with a `discoveredAt` time. Repeated checks retain them. Enabling automatic downloading does not retroactively queue them: use `enqueue()` or explicit `check({ entryId, includeHistory: true })`. Ordinary checks never requeue cancelled chapters.

`chapters()` exposes stable chapter IDs, titles, canonical numbers, discovery times, and `seen/discovered/queued/retry/restricted/complete/blocked/cancelled` states. `status()` includes last check/success, next automatic check (`null` when disabled), effective interval, and counts. Shelf and task reads work offline; `chapters()` and `tasks()` return empty arrays for unknown entries.

## Manual and watcher tasks

```ts
const task = app.startDownload(input, {
  chapters: ['2-4'],
  directory: './downloads',
  onEvent: publishSafeEvent,
});
task.snapshot();
// Another server handler can call task.cancel() when cancellation is requested.
try {
  await task.done;
} catch (error) {
  if (!(error instanceof Error && error.name === 'AbortError')) throw error;
}
if (task.snapshot().some((chapter) => chapter.retryable)) {
  await task.retry();
}
```

Use `startDownload(input, { direct: true, directory })` for direct chapter links. A snapshot may be empty until catalog resolution finishes. Manual handles live only in the current process: retain them on the server and handle promise rejections. `done` tracks the initial run; await the promise returned by `retry()` for subsequent runs. Retry selects only failed, restricted, or cancelled chapters. Individual chapter failures are task results, not batch promise rejections.

Existing `download()` and `downloadChapter()` also accept `onEvent`. Results now include source/work/chapter identity, display titles, and canonical position when known. Existing download results and `onResult` still include server paths or diagnostics: **do not serialize them directly to browsers**.

Watchers accept the same `onEvent`. `shelf.tasks(entryId?)` returns the same `DownloadTaskSnapshot[]` shape as manual handles, so clients can merge them. Fields include `id`, `origin`, optional `entryId`, `sourceId/workId/chapterId`, work/chapter titles, optional number, `state`, `pagesDownloaded/totalPages`, `attempt`, `retryable`, and a safe `problem`. Events are `{ type: 'task', task: snapshot }`. Stages cover queued, starting, reading, archiving, and terminal results. Page counts reset for each attempt; show a phase when the total is unknown.

Snapshots and events do not expose paths, request objects, credentials, or raw exceptions. SQLite persists the watcher queue; live page counts belong to the running shelf handle and reset after process restart. Reconnect by fetching a fresh snapshot rather than assuming complete event replay. Aborting a watcher stops the service, not its durable tasks. Per-chapter `cancel()` persists cancellation; `retry()` requeues it.

See the [public API reference](../../reference/library-api/) for the complete methods, state fields, timestamp units, and lifecycle restrictions.

## Readable archives and mount protection

```ts
const archive = {
  template: '{title}/{number}-{chapter}',
  padding: 3,
  format: 'zip' as const,
};
await app.download(input, { directory: './downloads', archive });
await shelf.watch({
  signal,
  directory: '/mnt/comics/Manga',
  outputRoot: '/mnt/comics',
  outputMarker: '.nas-ready',
  archive,
  onEvent: publishSafeEvent,
});
```

Defaults are no zero-padding and CBZ format. Templates allow `{title}`, `{chapter}`, `{number}`, `{workId}`, and `{chapterId}`, with at most four relative path segments and no expressions. The core sanitizes reserved names and special characters, truncates long names, disambiguates same-named works by identity, and never overwrites a conflicting file. Positions come from the full catalog before selection. Old extensions unable to resolve a direct link's catalog report an unknown number and fall back to the chapter ID in filenames.

With `outputRoot`, the selected output directory must already exist inside that root as a real directory; the marker is checked at the root. Missing markers or selected directories defer tasks without recreating the selected directory or committing archives. Template-generated work subdirectories may be created. Manual downloads accept the same protection options. Watchers without `outputRoot` retain the original same-directory marker behavior.

Changing templates or format does not rename files. Stable identity and integrity checks locate existing archives, including legacy hashed CBZs.

Ownership and archive commits use directory locks to coordinate concurrent comic-dl writers, recheck occupied destinations inside the lock, and rename atomically without requiring filesystem hardlinks. Stale locks recover after abnormal exits; pause other tools that modify archives during migration. Index scans isolate permission/disappearance errors in unrelated subdirectories, but an inaccessible selected output root remains an error.

Rename explicitly:

```ts
import { planArchiveMigration, applyArchiveMigration } from 'comic-dl';

const series = await app.list(input, { source });
const entries = series.chapters.map((chapter, index) => ({
  identity: [source, series.id, chapter.id] as const,
  title: series.metadata?.title ?? series.id,
  chapter: chapter.title,
  number: index + 1,
}));
const preview = await planArchiveMigration(directory, entries, archive);
// Show from/to/status to the administrator; conflicts are not applied.
await applyArchiveMigration(directory, preview);
```

Migration records contain relative filesystem paths for server-side administration only. Preview does not write; applying revalidates identity and rejects traversal, symlinks, and destination overwrites. CBZ and ZIP use the same ZIP container, so changing the suffix does not download pages again. Pause writers and ensure the mount is stable while migrating.

## Metadata and covers

Search results may include `coverUrl/coverId`. `Series.metadata` may include `title/authors/summary/tags/coverUrl/coverId`. All are optional; show placeholders when absent. Public cover URLs must not contain credentials. Fetch protected covers with `await app.readCover(coverId, { source, signal })`, returning `{ contentType, bytes }`, and serve them through your authenticated image endpoint. Sources constrain IDs and endpoints; the core is not an arbitrary URL proxy and rejects unsupported types, empty images, and results over 10 MiB.

## Managed extension inspection

```ts
import {
  listManagedExtensions,
  checkExtensionUpdates,
  manageExtensions,
} from 'comic-dl';
const options = { directory: './data/extensions' };
const installed = await listManagedExtensions(options);
const updates = await checkExtensionUpdates(undefined, options);
const one = await checkExtensionUpdates('@comic-dl/copymanga', options);
// Apply only after user confirmation:
await manageExtensions('update', '@comic-dl/copymanga', options);
```

Inventory returns `package/version/requested/sourceId/status` from the current generation. Broken packages remain listed, unknown mappings are `null`, and duplicate source IDs are failures. `loaded` means the definition can be registered, not that authentication or the site works. Inspection imports trusted extension modules but does not create source sessions, install packages, or switch versions.

Update checks add `updateStatus: current/available/failed`, with `availableVersion` on success or a safe `problem` on failure. Resolution follows the saved range/tag and npm registry configuration, including npm's prerelease rules. Exact versions remain pinned. One package's failure does not discard others. Omit the package to check all; specifying an uninstalled package rejects. Both queries support `signal` and avoid persistent inventory caches. Checks are point-in-time snapshots; applying updates resolves the registry again. Restart watchers after extension changes as before.
