---
title: Manage a cross-source shelf
description: Save series from different manga sources, manage subscriptions, and choose a local shelf database.
---

The shelf keeps series from different sources in one local database. Saving a series and subscribing to it are separate actions: you can keep it on the shelf, or subscribe so comic-dl can [check for and download new chapters](../updates/).

These Bash / Zsh examples assume you have [installed the CLI and added a source](../../guide/quickstart/). If you installed `3.0.0` from npm, run `npm ci` and `npm run build` from the repository root, then replace `comic-dl` in these examples with `node dist/index.js`. Run `comic-dl shelf --help` to check whether your CLI has the shelf commands.

## Save a series

Use `search` to find a series or use a series URL you already have. Pass the URL from the first column of the search results to `shelf add`:

```sh
comic-dl search '想看白天同学的软弱表情' --source copymanga

series_url='https://www.copy20.com/comic/xiangkanbaitiantongxuederuanruobiaoqing'
comic-dl shelf add "$series_url" --title '想看白天同学的软弱表情'
comic-dl shelf list
```

A full URL can select the source automatically. For a short ID, pass `--source copymanga` or use a default source from configuration. If you omit `--title`, the shelf displays the work ID returned by the source. The CLI verifies the series with the source before saving it. Use reusable inputs without credentials and follow the extension's instructions for signing in.

If two inputs from the same source resolve to the same work ID, adding the second input returns the existing entry and keeps its title, series input, and subscription state. Versions from different sources stay separate, so you can follow just the one you want.

## Subscribe, pause, or remove a series

`shelf list` prints four columns: **shelf entry ID, source ID, subscription state, and title**. Use the first column for shelf commands. The entry ID is different from the short series ID and from the chapter IDs returned by `comic-dl list`.

```sh
entry_id='paste-the-first-column-from-shelf-list'
comic-dl shelf follow "$entry_id"
comic-dl shelf list
```

New entries are `not-following`. `follow` switches the entry to `following`; `unfollow` pauses updates and keeps the entry, its baseline, and pending chapters. Follow it again to resume and check for chapters added during the pause.

```sh
comic-dl shelf unfollow "$entry_id"
# Run this only if you no longer want the series on the shelf:
comic-dl shelf remove "$entry_id"
```

Removing an entry deletes its subscription and task records. Downloaded CBZ files stay in place. You can still list, follow, unfollow, or remove shelf entries offline after uninstalling a source extension. Reinstall it before checking that source for updates.

## Change a series URL or chapter group

```sh
comic-dl shelf set-input "$entry_id" "$new_series_url"
```

Set `new_series_url` to a new series URL or another input supported by the source. `set-input` saves the change only if the original source resolves the input to the same work ID. After an input change, the next successful check sets a baseline for the new catalog. Pending tasks from the old catalog are disabled and existing CBZ files remain in place. See the extension's documentation for source-specific options such as chapter groups.

## Choose a shelf database

The default database is `$XDG_DATA_HOME/comic-dl/shelf.sqlite`, or `~/.local/share/comic-dl/shelf.sqlite` if that variable is unset. On Windows, the default is `%LOCALAPPDATA%\comic-dl\shelf.sqlite`. To try an isolated shelf or set an explicit path for a service, pass the same `--shelf-db <file>` to each shelf command:

```sh
comic-dl shelf list --shelf-db "$HOME/test-shelf.sqlite"
```

Keep the database on the machine running the CLI. CBZ output can go to a mounted NAS share. Next, [check for updates manually or start automatic downloads](../updates/).
