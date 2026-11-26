---
title: Configuration file v1
description: CLI JSON configuration fields, validation, precedence, and path resolution.
---

`--config <file>` specifies a UTF-8 JSON file. The top level must be an object, and `version` must be the number `1`. Unknown fields are rejected. Every field except `version` is optional.

| Field        | Type and constraints                       | Purpose                                                     |
| ------------ | ------------------------------------------ | ----------------------------------------------------------- |
| `version`    | The number `1`                             | Configuration format version                                |
| `extensions` | Array of nonempty strings; may be empty    | Extensions to load by npm package name or local ESM path    |
| `source`     | String matching `[a-z0-9]+(?:-[a-z0-9]+)*` | Default source ID; must be registered before it can be used |
| `output`     | Nonempty string                            | Default download directory                                  |
| `jobs`       | Safe integer greater than or equal to `1`  | Maximum parallel chapters for `download`                    |
| `retries`    | Safe integer greater than or equal to `0`  | Additional retry attempts for `chapter` and `download`      |

1. Explicit CLI options take precedence, followed by configuration and then built-in defaults. With no output path, `download` uses the current working directory. An explicit CLI extension list replaces the entire configured list. Extensions installed with `add` still load.
2. `~` and `~/` in `output` refer to your home directory. Other relative output paths and local extension paths starting with `./` or `../` are resolved relative to the configuration file. Absolute paths remain absolute, and package names follow module resolution rules.
3. Options apply only to relevant commands; for example, `list` does not use `output`. All field types and constraints are validated when loading the file.
4. Credentials are outside the configuration format. An unreadable file, invalid JSON, invalid field, or unsupported version exits with `2`.
