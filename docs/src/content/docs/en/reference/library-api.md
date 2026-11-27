---
title: Public library API reference
description: Public downloader, shelf, task, cover, archive, and managed extension contracts.
---

Use Node.js 24 ESM. Import values and server-side types from `comic-dl`; extension authors import types from `comic-dl/extension`. Do not read core SQLite tables or managed-store internals. The [library guide](../../guide/library/) covers registration; the [backend guide](../../guide/service-api/) shows combined workflows.

## Downloader

`createDownloader({ source, sourceSettings, overrides, output, jobs, retries, archive })` creates an isolated instance; the default export is a convenience instance. Source selection uses an explicit source, then the instance default, then URL matching. CLI configuration and extensions are not loaded implicitly.

| Method                                        | Result and purpose                                                                                  |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `.use(extension, settings?)`                  | Current instance; register an API v1 extension and non-secret settings                              |
| `.sources()`                                  | Registered source IDs                                                                               |
| `.sourceSettings(source)`                     | Setting declarations, never credentials                                                             |
| `.validateSourceSettings(source, candidate?)` | Validate and return resolved non-secret settings without changing the instance                      |
| `.validateOverrides()`                        | Validate instance overrides                                                                         |
| `.resolveSource(input, kind?, explicit?)`     | Source ID; kind is `series` (default) or `chapter`                                                  |
| `.catalogOptions(source?, query?, signal?)`   | Async sorts and filters for the current browse/search mode                                          |
| `.search(query, options?)`                    | `Promise<SearchPage>`; `source/page/sort/filters/signal`, one-based pages, empty query browses      |
| `.list(input, options?)`                      | `Promise<Series>`; `source/signal`, preserving the full source reading order                        |
| `.download(input, options?)`                  | `Promise<ChapterResult[]>`; optional `chapters`, stable IDs taking precedence over inclusive ranges |
| `.downloadChapter(input, options?)`           | `Promise<ChapterResult>` for a direct link; `chapterId` only selects a fixture chapter              |
| `.startDownload(input, options?)`             | `DownloadTaskHandle`; series options plus `direct: true`                                            |
| `.readCover(id, options?)`                    | `Promise<CoverImage>`; requires an explicit or default source                                       |
| `.openShelf(options?)`                        | `Promise<ShelfHandle>`; optional `file` and global default `intervalSeconds`                        |

Download options are `source/directory/jobs/retries/signal/onResult/onEvent/archive/outputRoot/outputMarker/taskScope`, plus `chapters` for series. Defaults are two concurrent chapters and two additional retries. Series output defaults to the working directory; direct chapters require a directory or instance `output`. Invalid options, source/catalog resolution, and cancellation reject the promise. Individual chapter failures return results while remaining chapters continue.

`Series.chapters` contains server-side read methods and should not be sent directly to browsers. Map only required IDs, titles, positions, and optional metadata; omit `getPages()`, page reader objects, and source instances.

`ChapterResult` includes `sourceId/workId/chapterId/workTitle/chapterTitle/number?/attempts` and either `downloaded/skipped` with `path`, or `failed/restricted` with `error`. It is a server-side result, not a browser DTO. `onResult` receives chapter results; throwing stops new work and waits for in-flight chapters. `onEvent` is synchronous: return quickly and do not launch unhandled asynchronous work inside it.

`taskScope` distinguishes simultaneous submissions of the same chapter; `startDownload()` creates its own scope. Its handle exposes copied `snapshot()` values, batch `cancel()`, an initial `done` promise, and subsequent `retry()` promises. Snapshots may be empty before resolution. Manual tasks are not durable. Source settings are fixed when an instance is created; create a new instance for changed settings.

## Shelf and automation

| Method                                                               | Result and purpose                                                                     |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `list()`                                                             | Local `ShelfEntry[]`                                                                   |
| `add(input, { source?, title?, signal?, retries? }?)`                | Resolve then save; deduplicate by source/work ID without overwriting an existing entry |
| `setInput(id, input, options?)`                                      | Resolve the same source/work; a real change starts a fresh catalog baseline            |
| `configure(id, { autoCheck?, autoDownload?, intervalSeconds? })`     | Update settings and return the entry; omitted fields retain their values               |
| `setDefaultInterval(seconds)`                                        | Persist the global default and recalculate schedules of entries using it               |
| `follow(id)` / `unfollow(id)`                                        | Switch both automation settings, without cancelling existing work                      |
| `remove(id)`                                                         | Remove the entry and task records, keeping archives                                    |
| `check({ entryId?, includeHistory?, signal?, retries?, onCheck? }?)` | Check any entry or the whole shelf; `{ checked, failures, queued, events }`            |
| `status(id?)`                                                        | Local `ShelfStatus[]`: times, result, and counts                                       |
| `chapters(id)`                                                       | Local `ShelfChapter[]`: canonical number, discovery time, and state                    |
| `tasks(id?)`                                                         | Safe local snapshots, merged with live progress in a running handle                    |
| `needsAttention(id)`                                                 | Restricted/blocked chapter IDs and states                                              |
| `enqueue(id, chapterId)`                                             | Queue `seen/discovered/cancelled`; return `true` when changed                          |
| `cancel(id, chapterId)`                                              | Persist cancellation of pending/active work; keep already committed archives           |
| `retry(id, chapterId)`                                               | Requeue `blocked/restricted/retry/cancelled`; return `true` when changed               |
| `watch(options)`                                                     | Long-running promise; one consumer per database                                        |
| `close()`                                                            | Close the handle, only after aborting and awaiting its watcher                         |

Intervals are integers from 1 to 31,536,000 seconds. Per-entry `intervalSeconds: null` uses the global default, initially 3600. Entry fields `autoCheck/autoDownload/following` use `0/1`, while configuration inputs are booleans; `following` is a compatibility projection of automatic checking. `ShelfEntry.intervalSeconds` is the nullable override, and `ShelfStatus.intervalSeconds` is the effective value. `createdAt/updatedAt` are ISO strings; `lastCheck/lastSuccess/nextCheck/discoveredAt/readyAt` use Unix milliseconds, with unknown values null or omitted. `readyAt: 0` means immediately eligible.

The first successful check establishes a `seen` baseline. Later new chapters are `discovered` with automatic downloading off, or `queued` when enabled. Ordinary checks do not requeue known chapters. Explicit history requires `entryId` and queues previously unqueued baseline/discovered chapters. Turning either switch off preserves queued work. Missing chapters are deferred and can resume when they return.

`enqueue/cancel/retry` return `false` when no eligible chapter exists; `chapters/tasks` return empty arrays for unknown entries. `check/configure/follow/unfollow/setInput/remove` reject unknown entries rather than creating placeholders.

Successful `CheckEvent` states are `baseline/updated/unchanged`, with `queued/discovered`. Concurrent changes that invalidate the write produce `changed`. Failures produce `failed` and `problem`: `source-unavailable/authorization-failed/temporary-failure/catalog-failed/wrong-work/invalid-catalog/empty-catalog/check-conflict`, never raw source errors.

## Watchers and task events

`watch()` requires `signal` and an output directory or instance `output`. It also accepts `jobs/retries/intervalSeconds/archive/outputRoot/outputMarker/onCheck/onTask/onEvent/onOutputUnavailable`. Its interval saves the global default; omitting it retains the saved value and entry overrides. Network calls run outside transactions. The core restores durable tasks; Web backends should not duplicate this queue.

Legacy `onTask` results are `{ entryId, chapterId, state: retry|restricted|complete|blocked }`. New clients use `onEvent: ({ type: 'task', task }) => ...`:

| Snapshot field                         | Meaning                                                                                                                               |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `id`, `origin`, `entryId?`             | Opaque task ID; `manual/shelf` origin, shelf entry ID when applicable                                                                 |
| `sourceId`, `workId`, `chapterId`      | Display identities; sensitive or path-like text is redacted. Keep operation identities on the server; never reverse-engineer task IDs |
| `workTitle`, `chapterTitle`, `number?` | Names and one-based full-catalog position, not selection position                                                                     |
| `state`                                | `queued/retry/starting/reading/archiving/downloaded/skipped/failed/restricted/cancelled`                                              |
| `pagesDownloaded`, `totalPages?`       | Current attempt's progress; omit unknown totals and reset on retry                                                                    |
| `attempt`                              | Current attempt number; offline shelf snapshots retain failure counts, not lifetime execution totals                                  |
| `retryable`, `readyAt?`                | Explicit retry eligibility, not a promise of automatic retry; optional shelf eligibility time                                         |
| `problem?`                             | Safe `download-failed/access-restricted/output-unavailable` code                                                                      |

Database `complete/blocked` map to snapshot `downloaded/failed`. Page counts are not durable and live counts clear when the watcher stops. Events are not a persistent log: fetch snapshots on SSE reconnect, and do not stop background work when a browser disconnects. Do not pass redacted display fields back as operation inputs; retain or resolve original identities on the server. Cancelling and immediately retrying invalidates old executions so late results cannot overwrite new tasks.

## Archives and covers

`ArchiveOptions` is `{ template?, padding?, format? }`, defaulting to `{title}/{number}-{chapter}`, padding 0, format `cbz`. Placeholders are `{title}/{chapter}/{number}/{workId}/{chapterId}`. Templates allow at most four relative segments, no absolute paths, traversal, or expressions. Padding is 0–12 and format `cbz/zip`. Names are sanitized/truncated by UTF-8 bytes and platform path limits are checked. Conflicts never overwrite other chapters. Changing settings still identifies and validates existing identity-marked archives within the selected output root.

`outputRoot` separates a root marker from an existing selected subdirectory. Without it, watchers retain same-directory markers; manual downloads using a marker must also supply a root. Missing protected directories are not created. Directory locks do not require hardlinks; after a crash, expiry may take about a minute. Do not delete active locks.

`planArchiveMigration(directory, entries, archive?, signal?)` takes entries with `identity: [sourceId, workId, chapterId]` and `title/chapter/number?`, returning relative paths, identity, and `move/unchanged/conflict`. `applyArchiveMigration(directory, plan, signal?)` applies only `move`, revalidating identity and refusing occupied destinations. A batch is not transactional: completed moves survive later errors; preview again before continuing. Both formats are ZIP containers; migration never downloads pages again.

Search results may have `coverUrl/coverId`; optional series `metadata` has `title/authors/summary/tags/coverUrl/coverId`. Missing fields do not block downloads. Protected covers use `readCover(coverId, { source, signal })` and return `{ contentType, bytes }`: nonempty JPEG/PNG/GIF/WebP, at most 10 MiB. Web backends provide authentication, private caching, and response headers. No arbitrary URL proxy is exposed. A source's optional direct-link `seriesInput` lets the core load and verify the canonical catalog; old extensions without it report an unknown number.

## Top-level helpers and lifecycle

| Export                                         | Purpose                                                                            |
| ---------------------------------------------- | ---------------------------------------------------------------------------------- |
| `readConfig(file?, signal?)`                   | Read explicit CLI v1 configuration; no implicit config discovery                   |
| `sourceOverrides(inputs?)`                     | Parse `source.key=value` overrides                                                 |
| `loadExtension(input)`                         | Load an npm package or local ESM default export; URLs must use `file:`             |
| `fixtureExtension`                             | Explicit offline test source, not a production catalog                             |
| `withManagedDownloader(options, callback)`     | Load explicit/managed extensions and pin a generation throughout an async callback |
| `manageExtensions(action, package?, options?)` | `add/update/remove`, with `directory/signal/stdio` options                         |
| `listManagedExtensions(options?)`              | Read-only inventory with `directory/signal`; absent stores return an empty array   |
| `checkExtensionUpdates(package?, options?)`    | Check one/all packages without installation; uninstalled explicit packages reject  |

Inventory fields are `package/version/requested/sourceId/status`; unknown versions/mappings are null and status is `loaded/failed`. Importing a definition does not create a working source session. Updates add `updateStatus: current/available/failed`: success includes the saved range/tag's resolved `availableVersion`, failure includes `query-failed/not-installed`. Only `available` means a newer version exists. Per-package failures retain other results; cancellation rejects the call. Applying updates resolves again within saved constraints and need not match an earlier candidate. Default stores are shared with the CLI; specify a directory to isolate them.

Await every manual task and watcher inside `withManagedDownloader()` before returning, rather than returning a still-running handle. Stop old work, await generation release, and reload after extension/settings changes. Extensions manage credentials; never expose credentials in configuration, snapshots, or logs. Deploy a persistent Node.js process, not a request-scoped Serverless function.
