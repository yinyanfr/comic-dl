---
title: Check updates and download automatically
description: Check subscriptions manually, queue older chapters, and run automatic downloads locally or on a NAS.
---

First [add a series and subscribe to it](../manage/). In these examples, `entry_id` is the shelf entry ID from the first column of `shelf list`.

## Check for updates manually

```sh
comic-dl shelf check
comic-dl shelf check "$entry_id"
comic-dl shelf status
```

`shelf check` scans all active subscriptions, or just the one you specify. It reads the catalog and queues chapters without downloading images. `baseline` means the first check succeeded, `updated` means chapters were queued, and `unchanged` means there are no new tasks. If a source check fails, the CLI continues checking other subscriptions and exits with `1`. If the specified entry is not followed or does not exist, it exits with `2`.

By default, the first successful check only records the current catalog. Later checks queue chapter IDs that have never been seen. Renaming, reordering, or restoring an existing chapter does not queue it again. A new ID still counts if it appears earlier in the reading order.

### Queue existing chapters

```sh
comic-dl shelf check "$entry_id" --include-history
```

`--include-history` applies to one subscription, on the first check or a later one. It queues chapters from the current catalog that have not been queued before. Running it again does not duplicate tasks. Run `shelf watch` to download the queued chapters.

## Start automatic updates

```sh
comic-dl shelf watch --output "$HOME/manga" --interval 1800 --jobs 2
```

`watch` runs in the foreground. It handles checks and downloads that are due when it starts. Press `Ctrl+C` to stop it. `--interval` is in seconds and defaults to one hour. `--jobs` controls how many chapters download at once and defaults to `2`. Pass `--config <file>` to read `output`, `jobs`, and `retries` from a [configuration file](../../guide/config-tutorial/). The command-line `--output` and `--jobs` take precedence. An output directory is required. All subscriptions write their CBZ files directly to that directory, without creating series subdirectories.

Run one watcher per shelf database. On restart, it continues processing the saved queue and skips existing CBZ files that pass integrity checks. To keep the watcher running on a server, use its service manager to launch the foreground command. Use the same shelf database for the service and manual commands. If an extension requires authentication, provide its credentials to the service process as described by the extension.

### Write to a NAS

Confirm the share is mounted, then create a regular file such as `.nas-ready` in the actual output directory on the share. The marker must only exist on the mounted share.

```sh
comic-dl shelf watch --output /mnt/manga --require-output-marker .nas-ready
```

If the marker is unavailable, `watch` continues checking for updates and leaves downloads queued until it can retry. `--require-output-marker` takes a filename within the output directory. Keep the shelf SQLite database on the local machine.

## Check status and retry

```sh
comic-dl shelf status "$entry_id"
```

`shelf status` shows the last check, the last successful check, and the pending count offline. Specify an entry ID to see individual restricted or blocked chapters:

| State        | What to do                                                                                            |
| ------------ | ----------------------------------------------------------------------------------------------------- |
| `pending`    | Wait for download or automatic retry. If a chapter disappears from the catalog, it must return first. |
| `restricted` | The source explicitly restricts access to this chapter. `watch` rechecks it less often.               |
| `blocked`    | Resolve the problem, such as a bad output path or loss of source access, then retry manually.         |
| `complete`   | The CBZ was written successfully or an existing archive passed integrity checks.                      |

If the check itself reports `source-unavailable` or `authorization-failed`, restore the extension or update its credentials, then run `shelf check` to verify. To requeue a failed or restricted chapter, use its chapter ID rather than its title or reading position:

```sh
chapter_id='paste-the-chapter-id-to-retry'
comic-dl shelf retry "$entry_id" "$chapter_id"
```

This only requeues the chapter. See the [CLI reference](../../reference/cli/#check-updates-and-download-automatically) for a command and option summary.
