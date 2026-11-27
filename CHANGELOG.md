# Changelog

For each version bump, add an English `## <version> — YYYY-MM-DD` entry here. Start with a short summary, then group the changes under `###` headings such as Features, Breaking changes, and Fixes. Include examples or migration links when commands or APIs change. The publish workflow uses this entry as the GitHub release body and checks it before publishing to npm.

## 3.1.0 — 2026-11-27

comic-dl now has a local shelf for saving series across sources and a foreground watcher that downloads new chapters as CBZ files. Existing download commands and source extensions still work.

### Cross-source shelf

- Use `shelf add` and `shelf list` to save and view series in a local SQLite database. A work is saved once per source; editions from different sources stay separate.
- Use `shelf follow` to subscribe and `shelf unfollow` to pause without losing check history or queued chapters. `shelf set-input` verifies that a new URL or chapter group still points to the same work. Removing an entry keeps downloaded CBZ files.
- Use `--shelf-db <file>` to select a separate local shelf.

### Automatic chapter updates

- `shelf check` checks subscriptions and queues newly seen stable chapter IDs. The first successful check only records the current catalog by default. Add `--include-history` when checking a single subscription to queue existing chapters as well.
- `shelf watch` checks hourly by default and downloads queued chapters to the specified output directory. It resumes the saved queue after a restart and skips existing CBZs that pass integrity checks. On a NAS, `--require-output-marker` defers downloads when the share's marker file is unavailable.
- `shelf status` shows recent checks and download counts offline. Temporary failures retry automatically; use `shelf retry` to requeue a blocked or restricted chapter after resolving the problem.

```sh
npm install -g comic-dl@3.1.0
comic-dl add @comic-dl/copymanga
comic-dl shelf add "https://www.copy20.com/comic/xiangkanbaitiantongxuederuanruobiaoqing"
# Set entry_id to the first column printed by shelf add.
comic-dl shelf follow "$entry_id"
comic-dl shelf check "$entry_id"
comic-dl shelf watch --output ~/manga
```

### Documentation and publishing

- Added dedicated shelf and automatic update guides in [English](https://yinyanfr.github.io/comic-dl/en/shelf/manage/) and [简体中文](https://yinyanfr.github.io/comic-dl/shelf/manage/), covering subscriptions, history, retries, and NAS output.
- GitHub Releases now use the matching changelog entry, with validation before npm publishing.

[Compare 3.0.0 to 3.1.0](https://github.com/yinyanfr/comic-dl/compare/3.0.0...3.1.0).

## 3.0.0 — 2026-11-26

The first stable release of the TypeScript rewrite. comic-dl now runs on Node.js 24, loads independently published manga sources, and saves each chapter as a CBZ archive.

### Features

- **CLI:** Install source extensions with `add`, update one or all with `update`, and uninstall with `remove`. The CLI can select a source from a full series URL. Use `search` to find a series, `list` to see its chapters, and `download` or `chapter` to save it.
- **Chapter selection:** `-c` accepts stable chapter IDs or inclusive, one-based reading-order ranges. The CLI validates selections before starting a download.
- **Downloads:** Set chapter concurrency and transient retries on the command line or in a versioned JSON configuration file. Reruns verify chapter identity, page order, and archive integrity before skipping a CBZ. Cancelling preserves completed archives.
- **TypeScript library:** Register extensions with `downloader.use(extension)`, or use `createDownloader()` for an independent instance. Source authors can use the public API at `comic-dl/extension`.

```sh
npm install -g comic-dl@3.0.0
comic-dl add @comic-dl/copymanga
comic-dl d "https://www.copy20.com/comic/xiangkanbaitiantongxuederuanruobiaoqing"
comic-dl d xiangkanbaitiantongxuederuanruobiaoqing --source copymanga -o ~/manga -c 2-4
```

The first download writes the whole series to the current directory. The second selects chapters 2 through 4 by reading position.

### Breaking changes from 2.4.0

- **Sources:** The core no longer bundles online sources. Install `@comic-dl/copymanga` or `@comic-dl/zerobyw` with `comic-dl add`. See the [source extensions repository](https://github.com/yinyanfr/comic-dl-extensions/blob/main/README.en.md) for available sources and login instructions. The old Ganma module is not included.
- **Commands and settings:** Pass an explicit subcommand and a positional series or chapter input. Use `--source` for a source ID and `--config` for JSON settings. Extensions manage authentication; the CLI no longer discovers 2.x presets or cookie files.
- **Output:** Each chapter is written as one CBZ directly into the output directory. The old image-folder and ZIP output modes and `ComicInfo.xml` generation have been removed. Existing downloads can stay in your reader.
- **Library:** The old downloader classes and module API are incompatible with the new library and extension APIs.

See the migration guide for command replacements, credential setup, chapter numbering, and how to keep earlier downloads: [English](https://yinyanfr.github.io/comic-dl/en/migration/v2-to-v3/) · [简体中文](https://yinyanfr.github.io/comic-dl/migration/v2-to-v3/).

### Fixes since 3.0.0-alpha

- Retry transient interruptions during source lookups, chapter resolution, and image reads. Network diagnostics omit request paths and query strings.
- Recover abandoned extension-store write locks, expand `~/` in output paths, and return exit code `2` for unknown source IDs.
- If a library result callback rejects, stop scheduling chapters and wait for active downloads before propagating the error.

### Documentation and publishing

- Added an English README and a complete English documentation site alongside the Simplified Chinese guides. The migration guide compares commands and chapter selection with 2.4.0, and fixture examples now live in the development guide.
- Added Windows CLI checks and automated npm publishing and GitHub releases.

[Compare 2.4.0 to 3.0.0](https://github.com/yinyanfr/comic-dl/compare/2.4.0...3.0.0).

## 3.0.0-alpha — 2026-11-26

First public preview of the 3.x rewrite, published under the `next` tag.

### Added

- A TypeScript rewrite using native ESM and Node.js 24.
- Independently published source extensions with a public API at `comic-dl/extension`. Use `comic-dl add`, `update`, and `remove` to manage CLI extensions.
- A library API for registering sources with `.use()`, listing chapters, and downloading series. `createDownloader()` provides an independent source registry.
- URL-based source selection, search with pagination on supported sources, and chapter selection by stable ID or inclusive reading-order range.
- Explicit versioned JSON configuration, chapter-level concurrency, retries for transient errors, and cancellation that preserves completed archives.

### Changed

- Online sources are installed separately. The core bundles only the local `fixture` test source.
- The CLI requires a subcommand and takes the series or chapter as a positional argument. Old presets and credential flags are replaced by explicit configuration and extension-specific authentication.
- Downloads produce one CBZ per chapter. Existing archives are skipped only after chapter identity, page order, and archive integrity checks pass.
- The old downloader classes and module API are incompatible with the new extension and library APIs.

See the [migration guide](https://yinyanfr.github.io/comic-dl/en/migration/v2-to-v3/) for command replacements and how to preserve earlier downloads.

## Earlier releases

See the [historical changelog through 2.4.0](https://github.com/yinyanfr/comic-dl/blob/2.4.0/CHANGELOG.md).
