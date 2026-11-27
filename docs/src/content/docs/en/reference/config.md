---
title: Configuration and environment variables
description: Save CLI defaults and configure authentication for manga sources.
---

See [use a configuration file](../../guide/config-tutorial/) for a walkthrough. For example, run `comic-dl add @comic-dl/copymanga` and save this as `copymanga.json`:

```json
{
  "version": 1,
  "source": "copymanga",
  "output": "./downloads",
  "jobs": 2,
  "retries": 2
}
```

Pass `--config` explicitly. CLI options take precedence over configuration values, which in turn take precedence over defaults. For example, `--jobs 1` affects only the current command. Supplying any `--extension` replaces the entire configured extension list; extensions installed through `add` still load. Local extension paths beginning with `./` or `../`, like output paths, are relative to the config file's directory. CLI paths are relative to the current working directory.

See the [configuration v1 specification](../../specs/config-v1/) for supported fields and validation rules.

## Runtime source settings

Run `comic-dl sources --source <id> --options` to see the extension's settings, defaults, and allowed choices. Save overrides by source ID under `sourceSettings`, for example:

```json
{
  "version": 1,
  "sourceSettings": {
    "copymanga": { "site-url": "https://www.copy20.com" }
  }
}
```

Load the file with `--config <file>`, or repeat `--set <id>.<key>=<value>` to override individual settings for one invocation. Precedence is `--set`, the config file, any legacy environment variable declared by the extension, then the extension default. Cookies, passwords, and API keys are still managed by extensions.

These settings also apply to URL matching and online shelf actions. Restart `shelf watch` after changing its config.

## Environment variables

Version 4 accepts `"archive": { "template": "{title}/{number}-{chapter}", "padding": 3, "format": "zip" }` for manual and watcher downloads. Defaults are CBZ without padding. Changing settings never renames existing archives automatically; see [naming and migration](../../guide/service-api/).

`COMIC_DL_EXTENSION_DIR` overrides the CLI's [extension installation directory](../cli/#install-and-manage-sources). Each source defines its own authentication variables; for example, Zerobyw uses `COMIC_DL_ZEROBYW_COOKIE`. Keep credentials out of the CLI config and consult the [extension README](https://github.com/yinyanfr/comic-dl-extensions/blob/main/README.en.md) for setup and renewal.
