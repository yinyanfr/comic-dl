# Changelog

## Unreleased

- Reorganized the documentation around installation, basic and advanced CLI usage, configuration, and library integration.
- Moved fixture examples to the project development guide and expanded the migration guide with command and chapter-selection comparisons against 2.4.0.
- Added an English README and a complete English documentation site. Existing Simplified Chinese URLs remain available.
- Retry transient interruptions during source lookups, chapter resolution, and image reads, with diagnostics that omit request paths and query strings.
- Recover abandoned extension-store write locks, expand home-relative output paths, and return exit code `2` for unknown source IDs.
- Stop scheduling new chapters when a library result callback fails and wait for active work before rejecting.

## 3.0.0-alpha — 2026-11-26

This prerelease is available on npm under the `next` tag. The stable `latest` tag still points to 2.4.0.

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
