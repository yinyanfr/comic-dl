---
title: Source extension API v1
description: Adapter exports, stable identifiers, reading order, authentication, and error conventions.
---

Import the public TypeScript interfaces from `comic-dl/extension`. See [`src/extension.ts`](https://github.com/yinyanfr/comic-dl/blob/main/src/extension.ts) for their definitions and the [extension development guide](../../extensions/develop/) for an implementation walkthrough.

## Module contract

- The extension's default export is `{ apiVersion: 1, id, create }`. Its `id` must match `[a-z0-9]+(?:-[a-z0-9]+)*` and must not duplicate a loaded source ID. `fixture` is reserved by the core.
- `create(api)` synchronously returns a `ChapterSource` with the same `id`. The CLI can load the module merely to inspect its declaration for `sources`; initialize sessions in `create()` or later.
- Optional `matchesUrl(url, kind)` synchronously decides whether the extension handles a full URL. `kind` is `'series'` or `'chapter'`. Matching does not make network requests or create a session. Extensions without this method can still be selected with `--source`.

## Series, chapters, and pages

| Interface                     | Contract                                                                                                                                                                                                              |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getSeries(input, signal)`    | Return `{ id, chapters }`, with chapters in reading order.                                                                                                                                                            |
| `getChapter(input, signal)`   | Return `{ workId, chapter }`. A direct chapter and the same chapter in its series must use the same work and chapter IDs.                                                                                             |
| `search(query, page, signal)` | Optional. An empty query can browse the catalog; page numbers start at `1`. Return `{ results: [{ title, url }], hasNext }`. Each URL can be used as a series input. Return an empty array when there are no results. |
| `chapter.getPages(signal)`    | Return pages in reading order. Retries may call this again, so support refreshing temporary links.                                                                                                                    |
| `page.read(signal)`           | Return raw image bytes as a `Uint8Array`. Supported extensions: `jpg`, `jpeg`, `png`, `gif`, `webp`.                                                                                                                  |

A work ID identifies a work within its source, a chapter ID within its work, and a page ID within its chapter. These stable IDs determine chapter selection, archive identity, and page order. Do not derive IDs from changing titles, temporary signatures, credentials, or a chapter's current position in the list.

## Optional runtime settings and catalog capabilities

- `settings` is a map keyed by stable IDs matching `[a-z][a-z0-9-]*`. Each definition has a `label` and `type`, with optional `description` and `default`. Types are `text`, `url`, `boolean`, `integer` (with optional `min` and `max`), and `select` (with `{ id, label }` choices). Use `env` only for compatibility with an existing non-secret environment variable.
- The core validates values and passes the same read-only settings to `matchesUrl(url, kind, settings)` and `create(api, settings)`. An optional synchronous `validateSettings(settings)` can enforce site-specific rules. Extensions should retain their existing defaults when an older caller omits `settings`. Cookies, passwords and API keys are outside this interface.
- `catalog.browse` and `catalog.search` declare `sorts` and `filters` for browsing and keyword search respectively. Sorts have stable `{ id, label }` values. Filters share the setting types and can additionally declare `dynamic-select` to load choices from `catalogChoices(key, mode, signal)`.
- Validated options reach the extension as the optional fourth argument to `search(query, page, signal, { sort, filters })`. The extension translates options into the upstream query and calculates `hasNext` for those same conditions.

## HTTP and errors

Honor the supplied `AbortSignal` in read operations. `api.createSourceHttp({ requestHeaders, credentialHeaders, credentialOrigins, allowedOrigins })` returns a function `(url, signal, authenticated = false)` that resolves to `{ bytes, url, contentType }`. `requestHeaders` and `allowedOrigins` are optional. Use `requestHeaders` for non-credential headers sent with each request. Credential headers are attached only when authentication is explicitly requested and the destination origin is allowed; they are not reattached after a cross-origin redirect.

- Use the injected `api.TransientSourceError` for retryable failures. The HTTP helper maps timeouts and some transient HTTP statuses to this type.
- Throw the injected `api.RestrictedChapterError` from `getPages()` only when the site explicitly denies access to that chapter. An expired login, unknown HTTP error, or parse failure is not a chapter restriction.
- The HTTP helper exposes `status` through `api.SourceHttpError` for non-transient HTTP failures. Keep credentials, signed URLs, and sensitive response data out of user logs and archive identifiers.
