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

## Environment variables

`COMIC_DL_EXTENSION_DIR` overrides the CLI's [extension installation directory](../cli/#install-and-manage-sources). Each source defines its own authentication variables; for example, Zerobyw uses `COMIC_DL_ZEROBYW_COOKIE`. Keep credentials out of the CLI config and consult the [extension README](https://github.com/yinyanfr/comic-dl-extensions/blob/main/README.en.md) for setup and renewal.
