---
title: Upgrade from 2.x to 3.x
description: Migrate commands, scripts, presets, and credentials from 2.4.0 and keep prior downloads.
---

Version 3.x is a TypeScript rewrite. This guide uses `2.4.0` as the baseline. Keep your original scripts and downloads, and try one series in a new output directory first. Scripts that still depend on old behavior can stay pinned to `comic-dl@2.4.0`.

## Install the new CLI and its sources

Install the latest version and verify that the CLI has been updated:

```sh
npm install -g comic-dl@latest
comic-dl --version
comic-dl add @comic-dl/copymanga
comic-dl sources
```

The new CLI requires Node.js 24. CopyManga and Zerobyw were bundled in 2.x; in 3.x they are provided by `@comic-dl/copymanga` and `@comic-dl/zerobyw`. Install each once and the CLI loads it automatically. The old Ganma module is not bundled in 3.x. See the [extensions repository](https://github.com/yinyanfr/comic-dl-extensions/blob/main/README.en.md) for available sources, current URLs, and login requirements.

Pin the version explicitly if your scripts use `npx comic-dl`. To save series and subscribe to new chapters after upgrading, see the [shelf guide](../../shelf/manage/).

## Update commands and chapter selection

Verify the current series and chapter URLs first. In the examples, `$series_url` and `$chapter_url` stand for those verified URLs.

| Old command or option                                         | New equivalent                                                                                                                                        |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `comic-dl ls -u "$series_url"`                                | `comic-dl list "$series_url"`, or use `l`.                                                                                                            |
| `comic-dl -u "$series_url"` or `comic-dl dl -u "$series_url"` | `comic-dl download "$series_url"`, or use `d`. A subcommand is required, and the URL is a positional argument.                                        |
| `comic-dl ch -u "$chapter_url"`                               | `comic-dl chapter "$chapter_url" -o ./new-downloads`. A single-chapter download requires an output directory, which can also come from configuration. |
| `comic-dl dl --module copymanga --shorthand-url "$short_id"`  | `comic-dl download "$short_id" --source copymanga`, if the new extension supports that ID.                                                            |
| CopyManga's `--group tankobon`                                | Append `?group=tankobon` to the series URL if the new source offers that group. For other sources, see their own documentation.                       |

The numbers in the old `--chapters 0,4` option were zero-based positions. The endpoints in `--from 0 --to 4` were also zero-based and inclusive. The new `-c` gives priority to stable IDs, so `-c 0 -c 4` does not select those old positions. If both versions return the same chapters in the same order, the old range `--from 0 --to 4` corresponds to `-c 1-5`, unless `1-5` itself is a chapter ID.

List the chapters again, identify the ones you want, and pass the IDs from the first column. Replace `101` and `105` with actual IDs:

```sh
comic-dl list "$series_url"
comic-dl download "$series_url" -c 101 -c 105 -o ./new-downloads
```

Omitting `-c` processes the entire series. The new CLI no longer prompts for confirmation, so `--yes` is unnecessary. `list` prints `chapter ID<TAB>title` on each line. It no longer outputs chapter URLs in the previous format or writes `ComicInfo.xml`. Update any parsers and check the [new exit codes](../../reference/cli/#script-output-and-exit-codes).

## Migrate presets and credentials

The old CLI could merge general and site rules from `--presets` or `~/.comic-dl/presets.json`. The new CLI does not discover or merge those files. Move the settings you want to keep into separate JSON files per source. For example, run `comic-dl add @comic-dl/zerobyw`, then create `./profiles/zerobyw.json`:

```json
{
  "version": 1,
  "source": "zerobyw",
  "output": "./new-downloads",
  "jobs": 2,
  "retries": 2
}
```

The core no longer reads `--cookie`, `~/.comic-dl/cookies/`, or `--auth`. If your old Zerobyw Cookie is still valid, pass its text to the extension through an environment variable. Follow each extension's README for other sources.

```sh
export COMIC_DL_ZEROBYW_COOKIE="$(cat ./cookie.txt)"
comic-dl list "$zerobyw_url" --config ./profiles/zerobyw.json
comic-dl download "$zerobyw_url" --config ./profiles/zerobyw.json -c 101
```

Use an actual series URL and a chapter ID from the new listing. Keep credentials out of JSON; if your session has expired, renew it as described in the [Zerobyw README](https://github.com/yinyanfr/comic-dl-extensions/blob/main/extensions/zerobyw/README.en.md). This writes to `./profiles/new-downloads/` because config output paths are relative to the file. A CLI `-o` is relative to the current working directory and takes precedence.

You can keep an old output path that starts with `~/`. For example, `"~/Downloads/manga"` in JSON still resolves from your home directory.

The old `batch` controlled image concurrency; `jobs` controls chapter concurrency and is not a direct equivalent. The old `retry` retried chapters with failed images; `retries` counts additional attempts for transient errors. Set it to `0` to disable retries. See [use a configuration file](../../guide/config-tutorial/) for more.

## Keep prior downloads and check removed options

You can keep image folders, ZIPs, and CBZs in your current reader. The new CLI always creates one CBZ per chapter and names it using the chapter's identity. Reruns verify identity, the page-order marker, and archive integrity. A legacy CBZ is not considered complete just because its name matches. Use a new output directory and separate directories for different series. Readers that import by filename, such as Calibre, show the archive name; add titles and series information in the reader.

- `--archive`, `--zip-level`, `--format`, `--info`, and `list -o` are no longer output options. There are no equivalents for renaming, indexed chapter filenames, or the old `--kavita` naming flag. The new Kavita extension is a library source.
- There is no `--override` option. Rerunning skips archives that pass the integrity checks.
- There are no built-in replacements for `--list` URL files or `--history`. Check the current URLs before using your old lists in an external script that calls the new CLI for each URL.
- The old library classes and `generate` module template command have no compatibility entry point. See [use as a library](../../guide/library/) for applications and [extension development](../../extensions/develop/) for custom sources.
