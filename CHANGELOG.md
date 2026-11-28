# Changelog

For each version bump, add an English `## <version> — YYYY-MM-DD` entry here. Start with a short summary, then group the changes under `###` headings such as Features, Breaking changes, and Fixes. Include examples or migration links when commands or APIs change. The publish workflow uses this entry as the GitHub release body and checks it before publishing to npm.

## 4.1.0 — 2026-11-28

Bring the CLI up to date with the 4.x backend APIs, add terminal page progress, and provide complete Japanese documentation alongside English and Simplified Chinese. Node.js 24, extension API v1, and the shelf schema introduced in 4.0 remain unchanged.

### CLI parity and progress

- Render shared core task events for manual and watcher downloads on stderr. `--progress auto` draws a bounded terminal line, `plain` emits page/stage lines without terminal controls, and `off` disables rendering. Redirected output stays quiet by default; existing stdout results and exit codes remain unchanged.
- Add `extensions` JSON inventory and `update [package] --check` for read-only update checks with saved npm ranges/tags and per-package failures.
- Add `search --json`, `list --details`, archive template/padding/format overrides, and NAS output-root/marker protection for manual downloads as well as watchers.
- Add `migrate` JSON previews and explicit `migrate --apply <preview.json>` using the reviewed root-bound plan, with core identity and no-clobber revalidation.

```sh
comic-dl download "$series_url" -o ./downloads --progress plain --archive-padding 3
comic-dl extensions
comic-dl update --check
comic-dl migrate "$series_url" -o ./downloads --archive-padding 3 > migration.json
# Stop writers, back up archives, and review the preview before applying.
comic-dl migrate --apply migration.json -o ./downloads
```

Migration applies the saved plan without regenerating it, refuses occupied destinations, and is not a batch transaction. See the [CLI reference](https://yinyanfr.github.io/comic-dl/en/reference/cli/) and [4.x migration guide](https://yinyanfr.github.io/comic-dl/en/migration/v3-to-v4/). Existing archives are still recognized by identity and are never renamed implicitly.

### Documentation and verification

- Add a Japanese README and all 23 matching documentation pages, with a Japanese language picker, translated navigation, and a searchable Japanese site at `/comic-dl/ja/`.
- Expand extension development guides and API contracts in all three languages for metadata, public/protected covers, canonical direct links, source settings, credential binding, and offline acceptance.
- Update Zerobyw walkthroughs with trusted HTTP covers, metadata, two-chapter canonical numbering, and executable CLI/library examples. Document remaining intentional CLI/library differences and the Web backend requirements.
- Replace the project icon in READMEs and the documentation site's header, homepages, and favicon. Add a WebUI navigation section with usage and deployment placeholders in all three languages; these pages intentionally have no body content yet.
- Include the Japanese README and shared project icon in the npm package.
- Add offline CLI regressions for page rendering, pipe compatibility, watcher interruption, JSON discovery, extension queries, NAS guards, and migration preview/apply.
- Verify watcher interruption through cross-platform test IPC while retaining a separate non-Windows real-SIGTERM test; Windows live-signal behavior is not inferred from macOS results.

[Compare 4.0.0 to 4.1.0](https://github.com/yinyanfr/comic-dl/compare/4.0.0...4.1.0).

## 4.0.0 — 2026-11-28

Provide the public backend capabilities requested by comic-dl-web in issues #26–#32. The extension API remains version 1; new source capabilities are optional.

### Breaking changes and migration

- Manual shelf checks now include every saved work, not only followed works. Automatic checking and automatic downloading are independent, and disabling either no longer cancels existing tasks. `follow` and `unfollow` remain shortcuts for switching both.
- Upgrade shelf databases transactionally to schema v3, preserving baselines, pending work, failures, and completed results. Back up before upgrading: older cores cannot open the new schema.
- Default archives use `{title}/{number}-{chapter}.cbz`. Existing identity-marked hashed CBZs remain recognized and are never renamed implicitly. See the [migration guide](https://yinyanfr.github.io/comic-dl/en/migration/v3-to-v4/).

### Shelf automation and tasks

- Configure global and per-entry check intervals without resetting baselines. Record discovered but unqueued chapters and their discovery times; expose chapter states, next checks, manual enqueue, persistent cancellation, and retry.
- Separate due catalog checks from queue consumption. Existing tasks continue with automatic checks disabled, including bounded rechecks for temporarily missing chapters.
- Add manual download handles and common browser-safe task snapshots/events for direct, series, selected, and watcher downloads. Report canonical identity, display metadata, page progress, archive finalization, cancellation, and safe problems without filesystem paths or raw errors.
- Keep durable watcher tasks across restarts and prevent stale results after cancellation/retry or catalog changes.

### Archives, metadata, and NAS

- Add validated naming templates, zero-padding, and CBZ/ZIP formats. Preserve full-catalog numbering before selection; updated extensions can associate direct links with their canonical series.
- Disambiguate work directories, sanitize and bound names, validate existing archives by identity/page order/CRC, and commit complete archives without clobbering occupied destinations. Preview and apply archive renames explicitly through public migration APIs.
- Check a mount marker at `outputRoot` while writing to an existing child directory. Missing markers or selected directories defer tasks without recreating the selected directory, with availability checked again before commit.
- Add optional search covers and series metadata, plus a constrained server-side cover reader that rejects unsupported or oversized results.

### Managed extensions

- Add `listManagedExtensions()` for actual versions, saved ranges/tags, source mappings, and isolated loading failures.
- Add check-only `checkExtensionUpdates()` for one package or all packages, resolving npm ranges/tags without installing or changing the active generation. Partial registry failures remain per-package results.
- Preserve explicitly supplied tags and ranges during installation. Document all new APIs, CLI automation controls, and migration behavior in English and Simplified Chinese.

### Review fixes

- Use portable directory locks and atomic renames for work ownership, archive commits, and migrations instead of requiring filesystem hardlinks. Serialize cooperating writers and recheck occupied destinations under the lock.
- Isolate permission and disappearing-directory errors in unrelated archive-index subdirectories while preserving errors on the selected output root.
- Keep raw chapter identities private to manual task handles so retries continue to work when browser-facing IDs are redacted.

## 3.2.0 — 2026-11-27

Source extensions can now expose editable runtime settings and define server-side sorting and filtering for manga catalogs. Existing API v1 extensions remain supported.

### Source settings and catalog discovery

- Discover settings with `comic-dl sources --source <id> --options`, save values under `sourceSettings` in a CLI config, or override them for one run with `--set <source-id>.<key>=<value>`. URL matching and shelf checks use the same settings as downloads.
- Discover a source's browse or keyword-search options with `comic-dl search [query] --source <id> --options`, then pass `--sort` and `--filter` to select from the available options.
- Library callers can supply settings to `.use()` and use `sourceSettings()`, `catalogOptions()`, and `search()` independently of the CLI. The TypeScript extension contract supports per-mode capabilities and dynamic filter choices.

### Programmatic access to CLI capabilities

- Download direct chapter links or select chapters by stable ID and inclusive reading-order range through the library.
- Open the same SQLite shelf from Node.js to manage subscriptions, check and watch for updates, inspect status, and retry chapters.
- Load and manage npm extensions, read CLI configuration, and validate runtime source settings through public APIs.

[Compare 3.1.0 to 3.2.0](https://github.com/yinyanfr/comic-dl/compare/3.1.0...3.2.0).

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
