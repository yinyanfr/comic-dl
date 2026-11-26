---
title: CLI commands
description: Look up commands, options, standard output, and exit codes.
---

Run `comic-dl --help` to see available commands, or `comic-dl <command> --help` for command-specific options. `-h` is short for `--help`, and `-V` for `--version`. When running from the repository, replace `comic-dl` with `node dist/index.js`.

| Command                   | Alias | Purpose                                                                |
| ------------------------- | ----- | ---------------------------------------------------------------------- |
| `sources`                 | `src` | List built-in and loaded source IDs without opening source sessions    |
| `search [query]`          | `s`   | Search titles, or omit the query to browse; `--page <n>` starts at `1` |
| `list <series-input>`     | `l`   | List stable chapter IDs and titles for a series                        |
| `chapter <chapter-input>` | `c`   | Download one chapter from a direct link or a source-defined identifier |
| `download <series-input>` | `d`   | Download a series or selected chapters                                 |
| `add <package>`           | `a`   | Install an npm extension, optionally with `@version` or `@tag`         |
| `update [package]`        | `u`   | Update one or all installed extensions within saved version ranges     |
| `remove <package>`        | `rm`  | Uninstall a CLI-managed extension                                      |

### Options

| Option                      | Commands                      | Meaning                                                                                                     |
| --------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `--config <file>`           | `sources` and manga commands  | Load an explicit JSON file; see [configuration](../config/)                                                 |
| `--extension <name>`        | `sources` and manga commands  | Load a resolvable npm package or local ESM file; repeat as needed                                           |
| `--source <id>`             | Manga commands                | Choose a registered source; may come from configuration                                                     |
| `--fixture <directory>`     | `list`, `chapter`, `download` | Use local test data; cannot be combined with positional input or explicit `--source`                        |
| `-o, --output <directory>`  | `chapter`, `download`         | May come from configuration; defaults to the current directory for `download` and is required for `chapter` |
| `-c, --chapter <selection>` | `download`                    | A chapter ID or inclusive range such as `2-4`; repeat as needed                                             |
| `-c, --chapter <id>`        | `chapter --fixture`           | Select a single stable chapter ID                                                                           |
| `--jobs <n>`                | `download`                    | Maximum concurrent chapters; defaults to `2`                                                                |
| `--retries <n>`             | `chapter`, `download`         | Additional attempts for transient errors; defaults to `2`; `0` disables retries                             |

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

### Select chapters

`-c 2-4` selects entries 2 through 4, inclusive. Positions start at `1`, follow the order shown by `list`, and are independent of titles or stable IDs. Pass `-c <id>` to use an ID from the first column of `list`. An exact ID match takes precedence over a range. Repeat `-c` to combine IDs and ranges: the CLI validates all selections before downloading, then processes each selected chapter once in reading order. Reversed or out-of-bounds ranges and unknown IDs exit with `2` before downloading.

### Script output and exit codes

`sources` prints one source ID per line. `list` prints `chapter ID<TAB>title` and `search` prints `series URL<TAB>title`. Pagination hints and errors go to stderr. Download progress and summaries are intended for people, not scripts.

| Exit code | Meaning                                                                                                                                                            |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `0`       | The command completed. A series download also succeeds if at least one chapter was downloaded or already complete and the remaining chapters were only restricted. |
| `1`       | The command failed, a chapter failed to download, or all selected chapters were restricted.                                                                        |
| `2`       | Invalid CLI usage, configuration, source selection, or chapter selection.                                                                                          |
| `130`     | Interrupted by the user. Completed archives are kept.                                                                                                              |
