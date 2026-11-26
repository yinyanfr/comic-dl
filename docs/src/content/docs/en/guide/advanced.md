---
title: Advanced usage
description: Choose a source explicitly, select specific chapters, and control concurrency, retries, and cancellation.
---

## Choose between multiple sources

`list`, `chapter`, and `download` select a source in this order:

1. The CLI option `--source <source-id>`.
2. The `source` field in the [configuration file](../config-tutorial/).
3. Full URL matching against loaded extensions. The CLI reports an error if none or multiple match.

A search query or short ID does not identify its source, so supply `--source` or set the default in your configuration. A configured `source` takes precedence even when you pass a full URL for a different site. Use `--source` to override it for a single command.

## Select specific chapters

Run `comic-dl list "$series_url"` and check the order and the stable IDs in the first column. In the example below, replace `101` with an actual ID:

```sh
comic-dl download "$series_url" -c 101 -c 2-4 -o ./downloads
```

- **By ID:** Select the chapter with that ID. If a value matches an existing ID, it is treated as an ID even when it looks like `2-4`.
- **By position:** `2-4` selects entries 2 through 4 in the current list, inclusive. Positions start at `1` and are independent of the numbers in chapter titles.
- **Combine selections:** Repeat `-c` to mix IDs and ranges. The CLI validates all selections, removes duplicates, and processes the selected chapters in reading order. An unknown ID, reversed range, or out-of-bounds range exits with `2` before downloading.

Use stable IDs in scripts that repeatedly target the same chapters. Positions can change when a source updates its chapter list.

## Control concurrency and retries

```sh
comic-dl download "$series_url" -o ./downloads --jobs 1 --retries 2
```

`--jobs` is the number of chapters processed concurrently (default `2`). `--retries` is the number of additional attempts after transient errors (default `2`); set it to `0` to disable retries.

During downloads, resolving the series or chapter and processing each chapter each get their own retry budget. Standalone `list` and `search` allow two additional attempts for transient errors.

If some chapters fail or are restricted, the remaining chapters are still processed. Press `Ctrl+C` to stop; completed archives are kept. After addressing the problem, rerun with the same source and output directory. CBZ files that pass the integrity checks are skipped.

## Use the CLI in scripts

`list` and `search` write tab-separated results to stdout. Pagination hints and errors go to stderr. Check the exit code instead of parsing human-readable progress or summaries. A download can succeed even when some chapters are restricted; see [CLI output and exit codes](../../reference/cli/#script-output-and-exit-codes).
