---
title: Use a configuration file
description: Save a default source, output directory, and retry settings, and override them for one command.
---

Save settings in JSON and pass `--config` to reuse them. This example uses an [installed CopyManga extension](../quickstart/#add-a-manga-source).

## Save default settings

Create `./profiles/copymanga.json`:

```json
{
  "version": 1,
  "source": "copymanga",
  "output": "./manga",
  "jobs": 2,
  "retries": 2
}
```

`version` must be the number `1`. For `source`, use an ID from `comic-dl sources`. `jobs` controls chapter concurrency, and `retries` controls the number of additional attempts after a transient error. Extensions installed with `add` load automatically, so you don't need to list them in this file.

## Load the settings

Run these commands from the parent directory of `profiles/`:

```sh
comic-dl l xiangkanbaitiantongxuederuanruobiaoqing --config ./profiles/copymanga.json
comic-dl d xiangkanbaitiantongxuederuanruobiaoqing --config ./profiles/copymanga.json -c 2-4
```

The CLI does not look for a config file automatically; pass `--config` each time. A relative output path in JSON is resolved from the **directory containing the config file**, so this writes to `./profiles/manga/`. With no output directory set in the CLI or config, `download` writes to the current working directory.

An output path like `"~/manga"` instead starts at your home directory.

## Override settings for one command

```sh
comic-dl d xiangkanbaitiantongxuederuanruobiaoqing --config ./profiles/copymanga.json -c 2-4 -o ./preview --jobs 1
```

CLI options take precedence and do not rewrite the config file. Relative paths passed on the command line start at the **current working directory**, so this writes to `./preview/` instead of `./profiles/preview/`. You can also override the default source with `--source`.

Keep separate config files for different sources or output directories. Set cookies and API keys as directed by the [extension's README](https://github.com/yinyanfr/comic-dl-extensions/blob/main/README.en.md). See [configuration and environment variables](../../reference/config/) for all supported settings.

## Readable filenames and ZIP

Save this as `naming.json`:

```json
{
  "version": 1,
  "source": "copymanga",
  "output": "~/manga",
  "archive": {
    "template": "{title}/{number}-{chapter}",
    "padding": 3,
    "format": "zip"
  }
}
```

```sh
comic-dl d xiangkanbaitiantongxuederuanruobiaoqing --config naming.json -c 2-4
```

Output resembles `~/manga/Work title/002-Chapter title.zip`, retaining full-catalog positions. Omitting `archive` uses the default template, no padding, and CBZ. The same configuration works with `shelf watch`. Changing settings never renames completed archives; use the [server migration API](../service-api/) to preview and explicitly apply renames. See the [configuration specification](../../specs/config-v1/) for constraints.
