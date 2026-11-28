---
title: Use the library API
description: Guide agents through public download APIs, task events, covers, and shelf automation.
---

## Load the skill

```sh
npx skills add yinyanfr/comic-dl --skill comic-dl-library
```

[Read SKILL.md](https://github.com/yinyanfr/comic-dl/blob/main/skills/comic-dl-library/SKILL.md) · [Installation](../)

For Node.js 24 ESM scripts and long-lived backends. Browsers must not load the core, adapters, or SQLite directly.

## Workflow

1. Inspect installed public types and explicitly register trusted sources with `createDownloader().use()`.
2. List chapters, call `download()`/`downloadChapter()`, and inspect each result; Promise completion does not imply all chapters succeeded.
3. Use `onEvent` and safe snapshots for progress, and `startDownload()` for cancellation/retry handles.
4. Use public shelf methods for independent automation settings. Abort and await the watcher before closing the shelf.
5. Explicitly register `fixtureExtension` for download tests; use a search-capable test source for discovery.

## Example request

> Use comic-dl-library to add downloads and cancellation to my Node.js 24 backend. Use public APIs only and expose safe snapshots to the frontend. Add offline tests for partial failures, unknown page totals, and graceful shutdown.

## Safety and acceptance

- `createDownloader()` does not automatically load CLI configuration or managed adapters.
- Do not parse CLI text, import private `dist/` modules, or edit SQLite directly.
- Raw results can contain local paths or diagnostics; do not send them directly to browsers. Protect authenticated cover endpoints.
- Manual tasks do not survive restarts; watcher queues persist, but live page counts do not.
- Test cancellation, retries, output protection, and cleanup. Report remaining live-source/NAS acceptance separately.

See [library guide](../../guide/library/), [service APIs](../../guide/service-api/), and [API reference](../../reference/library-api/).
