---
title: CLI commands
description: Look up commands, options, standard output, and exit codes.
---

Run `comic-dl --help` to see available commands, or `comic-dl <command> --help` for command-specific options. `-h` is short for `--help`, and `-V` for `--version`. When running from the repository, replace `comic-dl` with `node dist/index.js`.

This page covers 4.1.0. Progress, `extensions`, `update --check`, `migrate`, detail JSON, archive overrides, and manual NAS protection are available starting with 4.1.0; upgrade with `npm install -g comic-dl@latest`. Node.js 24 and extension API v1 requirements are unchanged.

| Command                   | Alias | Purpose                                                                                   |
| ------------------------- | ----- | ----------------------------------------------------------------------------------------- |
| `sources`                 | `src` | List built-in and loaded source IDs without opening source sessions                       |
| `search [query]`          | `s`   | Search titles, or omit the query to browse; `--page <n>` starts at `1`                    |
| `list <series-input>`     | `l`   | List stable chapter IDs and titles for a series                                           |
| `chapter <chapter-input>` | `c`   | Download one chapter from a direct link or a source-defined identifier                    |
| `download <series-input>` | `d`   | Download a series or selected chapters                                                    |
| `shelf <action>`          |       | Save works from multiple sources, manage subscriptions, and follow updates                |
| `add <package>`           | `a`   | Install an npm extension, optionally with `@version` or `@tag`                            |
| `update [package]`        | `u`   | Update one or all installed extensions within saved version ranges                        |
| `remove <package>`        | `rm`  | Uninstall a CLI-managed extension                                                         |
| `extensions`              |       | List managed packages, actual versions, saved ranges, source IDs, and load status as JSON |
| `migrate <series-input>`  |       | Preview renames of existing archives without downloading                                  |

### Options

| Option                           | Commands                              | Meaning                                                                                                     |
| -------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `--config <file>`                | `sources` and manga commands          | Load an explicit JSON file; see [configuration](../config/)                                                 |
| `--extension <name>`             | `sources` and manga commands          | Load a resolvable npm package or local ESM file; repeat as needed                                           |
| `--source <id>`                  | Manga commands                        | Choose a registered source; may come from configuration                                                     |
| `--fixture <directory>`          | `list`, `chapter`, `download`         | Use local test data; cannot be combined with positional input or explicit `--source`                        |
| `-o, --output <directory>`       | `chapter`, `download`                 | May come from configuration; defaults to the current directory for `download` and is required for `chapter` |
| `-c, --chapter <selection>`      | `download`                            | A chapter ID or inclusive range such as `2-4`; repeat as needed                                             |
| `-c, --chapter <id>`             | `chapter --fixture`                   | Select a single stable chapter ID                                                                           |
| `--jobs <n>`                     | `download`                            | Maximum concurrent chapters; defaults to `2`                                                                |
| `--retries <n>`                  | `chapter`, `download`                 | Additional attempts for transient errors; defaults to `2`; `0` disables retries                             |
| `--progress auto\|plain\|off`    | `chapter`, `download`, `shelf watch`  | stderr progress; default `auto` only renders in a terminal                                                  |
| `--archive-template <template>`  | Downloads, watcher, migration preview | Relative path template without an extension                                                                 |
| `--archive-padding <0-12>`       | Downloads, watcher, migration preview | Zero-pad canonical chapter numbers                                                                          |
| `--archive-format cbz\|zip`      | Downloads, watcher, migration preview | Override archive format                                                                                     |
| `--output-root <dir>`            | Downloads, watcher                    | Require an existing real output directory inside this root                                                  |
| `--require-output-marker <name>` | Downloads, watcher                    | Marker filename; manual downloads also require a root                                                       |
| `--details`                      | `list`                                | JSON metadata and chapter descriptors, without read methods                                                 |
| `--json`                         | `search`                              | Full `{ results, hasNext }` with optional covers; incompatible with `--options`                             |

### Install and manage sources

Get the npm package name from the extension author's documentation or npm. For example:

```sh
comic-dl add @comic-dl/zerobyw
comic-dl update @comic-dl/zerobyw
comic-dl update
comic-dl remove @comic-dl/zerobyw
```

`update` stays within the saved version range. To move outside that range, use `add 'package@version'`. Management commands take npm package names; `--source` takes a source ID such as `zerobyw`. The CLI installs extensions with npm in a separate project in your user data directory. Installation skips npm lifecycle scripts, but loaded extensions run with the CLI process's permissions; only add extensions you trust.

On Unix the default directory is `$XDG_DATA_HOME/comic-dl/extensions`, or `~/.local/share/comic-dl/extensions` if unset. On Windows it is `%LOCALAPPDATA%\comic-dl\extensions`. Set `COMIC_DL_EXTENSION_DIR` to override it.

Run one extension management command at a time. If it reports a lock, wait for the other command to finish and retry. The next management command clears write locks left by exited processes. Manage an extension directory from one machine; do not share it across hosts.

### Select a source

Extensions installed with `add` load automatically. `--extension` or configuration can also load local files or packages installed in the same npm project as the CLI, without installing or registering them in the CLI's extension store. Explicitly loading an already registered package of the same name loads it only once. If different packages claim the same source ID, the CLI reports an error.

See [local development testing](../../development/local-testing/) for the `--fixture` format and test steps.

`--source` takes precedence over the configured `source`. If neither is set, `list`, `chapter`, and `download` ask loaded extensions to match the full URL. If none or several match, check the installed extensions or select a source explicitly. Short series IDs and search queries require a source ID on the command line or in configuration.

### Browse, sort, and filter

`search --source <id> --options` lists catalog sorts and filters as JSON. Include a keyword to see the options available for keyword search instead. Choose a sort with `--sort <id>` and pass `--filter <key>=<value>` once per filter key. Keep the query, sort, and filters when requesting another `--page <n>`. Options the source does not declare are rejected. `list` still prints chapters in reading order.

Use `sources --source <id> --options` to discover source settings. See the [configuration reference](../config/) for overrides.

### Select chapters

`-c 2-4` selects entries 2 through 4, inclusive. Positions start at `1`, follow the order shown by `list`, and are independent of titles or stable IDs. Pass `-c <id>` to use an ID from the first column of `list`. An exact ID match takes precedence over a range. Repeat `-c` to combine IDs and ranges: the CLI validates all selections before downloading, then processes each selected chapter once in reading order. Reversed or out-of-bounds ranges and unknown IDs exit with `2` before downloading.

### Manage a shelf across sources

| Command                              | Purpose                                                                  |
| ------------------------------------ | ------------------------------------------------------------------------ |
| `shelf add <series-input>`           | Save a series, optionally with `--source <id>` and `--title <title>`     |
| `shelf list`                         | Print entry ID, source, subscription state, and title, separated by tabs |
| `shelf follow <entry-id>`            | Subscribe to a saved series                                              |
| `shelf unfollow <entry-id>`          | Pause updates and keep the entry and its check history                   |
| `shelf set-input <entry-id> <input>` | Change the input for the same work                                       |
| `shelf remove <entry-id>`            | Remove the entry and subscription while keeping downloaded CBZ files     |

All shelf commands accept `--shelf-db <file>`. `shelf add`, `set-input`, `check`, and `watch` also accept `--config`, `--extension`, and `--set`; other shelf commands work offline. See [Manage a cross-source shelf](../../shelf/manage/) for the full workflow.

### Check updates and download automatically

| Command                               | Purpose                                                                                          |
| ------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `shelf check [entry-id]`              | Check the whole shelf or any entry regardless of automation; `--include-history` requires one ID |
| `shelf status [entry-id]`             | Show check and download status offline                                                           |
| `shelf watch`                         | Check and download in the foreground; set `--output <dir>` or use config                         |
| `shelf retry <entry-id> <chapter-id>` | Requeue a failed or restricted chapter                                                           |

`watch` accepts `--interval <seconds>` (default `3600`), `--jobs <n>` (default `2`), and `--require-output-marker <name>` (defer downloads when the marker is unavailable). See [Check updates and download automatically](../../shelf/updates/).

Version 4 adds `shelf configure <id> --auto-check on/off --auto-download on/off --interval <seconds/default>`, `shelf chapters <id>`, `shelf tasks [id]`, `shelf enqueue <id> <chapter-id>`, and `shelf cancel <id> <chapter-id>`. Chapters/tasks print JSON. Disabling automation preserves existing tasks; retry restores cancelled tasks. Omitting `--interval` retains the saved global default (initially `3600`). `--output-root <dir>` separates a root marker from an existing selected output subdirectory. See the [backend API](../../guide/service-api/) for archive configuration and public contracts.

### Archive overrides, NAS protection, and migration

Download/chapter/watch and migration previews accept `--archive-template <template>`, `--archive-padding <0-12>`, and `--archive-format cbz|zip`. Explicit fields override config `archive` individually; unspecified fields retain config defaults. Templates omit the extension. Default output is `{title}/{number}-{chapter}.cbz` without padding.

```sh
comic-dl download "$series_url" --archive-padding 3 --archive-format zip -o ./downloads
comic-dl chapter "$chapter_url" -o /mnt/comics/Manga \
  --output-root /mnt/comics --require-output-marker .nas-ready
```

Manual downloads now accept the same root/marker protection as watchers. Root and target must be existing real directories; the marker lives at the root. Unavailable manual targets fail with exit code 1 and are not recreated; watchers defer tasks. Availability is rechecked before commit.

Changing policy never renames existing archives implicitly. Stop writers/watchers, back up archives, and keep the mount stable:

```sh
comic-dl migrate "$series_url" -o ./downloads \
  --archive-padding 3 --archive-format zip > migration.json
# Review from/to/status, then apply this exact preview.
comic-dl migrate --apply migration.json -o ./downloads
```

Preview uses the complete series catalog and emits `{ version: 1, directory, items }` without modifying archives. `directory` is the absolute output root. Apply requires the same explicit root, rejects source/config options, and does not regenerate the plan. Only `move` items are applied; `unchanged/conflict` remain. The core revalidates identity, paths, and occupied destinations, refusing overwrites. Apply is not a batch transaction: completed moves survive a later failure; preview again before continuing. Plans contain local relative paths for administrators, not browser DTOs. Use library APIs for multi-work batch migration.

### JSON discovery and managed extension queries

`list --details` returns series ID, optional metadata, and chapter descriptors with canonical positions, never read methods. `search --json` returns `{ results, hasNext }`, including optional covers; it cannot be combined with `--options`. Without these flags the original tab-separated output remains.

```sh
comic-dl extensions
comic-dl update --check
comic-dl update @comic-dl/zerobyw --check
# After explicit confirmation, apply:
comic-dl update @comic-dl/zerobyw
```

`extensions` prints managed packages, actual versions, saved ranges/tags, source IDs, and loading status as JSON, including broken packages. Unlike `sources`, it does not list temporary `--extension` modules; `loaded` does not mean valid credentials. `update --check` never installs or switches generations. It returns `current/available/failed` results following saved ranges/tags and registry settings. Partial failures retain other results and exit 1; available updates alone exit 0.

### Live progress

`chapter`, `download`, and `shelf watch` accept `--progress auto|plain|off`. Default `auto` draws a bounded stderr line only in a terminal, showing the latest active chapter, stage, page count, percentage when the total is known, and attempt number. Concurrent chapters share that line; it is not a series-wide percentage. `plain` writes stage/page lines without ANSI controls for logs; `off` disables it. Retries reset the current attempt's count; unknown totals show count and stage only. Results and summaries remain on stdout.

`shelf tasks` reads persistent queue projections across processes, not another watcher's live page counts. Current watcher output has live events; resident Web backends use their held shelf handle's `tasks()/onEvent`. Manual CLI tasks remain process-scoped: Ctrl+C cancels them; there is no library-handle-style reconnect/retry API.

### Script output and exit codes

`sources` prints one source ID per line. Default `list` prints `chapter ID<TAB>title` and `search` prints `series URL<TAB>title`. Pagination hints and errors go to stderr. The JSON entry points above support scripts; progress and summaries are human-readable. Default redirected progress is silent; opt in with `--progress plain` for logs.

| Exit code | Meaning                                                                                                                                                            |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `0`       | The command completed. A series download also succeeds if at least one chapter was downloaded or already complete and the remaining chapters were only restricted. |
| `1`       | The command failed, a chapter failed to download, or all selected chapters were restricted.                                                                        |
| `2`       | Invalid CLI usage, configuration, source selection, or chapter selection.                                                                                          |
| `130`     | Interrupted by the user. Completed archives are kept.                                                                                                              |
