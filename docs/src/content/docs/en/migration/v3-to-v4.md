---
title: Upgrade from 3.x to 4.x
description: Migrate shelf automation, readable archives, and Web backend APIs.
---

Stop watchers and back up the shelf SQLite database before installing `comic-dl@latest`. Node.js 24 and extension `apiVersion: 1` are unchanged. Version 4 transactionally upgrades v1/v2 shelves to schema v3. Older cores cannot open the upgraded database; restore a backup to roll back.

- Old `following=1` maps to both automatic checking and downloading enabled; `0` maps to both disabled. Baselines, existing tasks, failures, and completed results survive.
- `shelf check` now checks the entire shelf, including entries with automation disabled. `follow/unfollow` switch both settings but do not cancel existing tasks. Configure them independently with `shelf configure <id> --auto-check on --auto-download off --interval 1800`.
- Default archives are `{work title}/{canonical number}-{chapter title}.cbz`, not flat hashed filenames. Configure `archive` to change the template, padding, or CBZ/ZIP format. Existing 3.x identity-marked archives are validated and skipped without automatic renaming. Historical guidance for 2.4.0 remains in the [2.x migration guide](../v2-to-v3/).
- Old extensions without metadata display work IDs. Direct links without canonical catalog context have unknown numbers and use chapter IDs for filenames. Update extensions for complete context. Missing optional metadata does not prevent older extensions from downloading.
- Existing results remain suitable for server scripts. Web clients should use safe snapshots and `onEvent`, not serialize `onResult` paths or diagnostics.
- Separate the NAS root marker and existing selected directory with `outputRoot`. The CLI equivalent is `--output-root /mnt/comics -o /mnt/comics/Manga --require-output-marker .nas-ready`.

See [Web backends and task APIs](../../guide/service-api/) for complete interfaces, cancellation and retry semantics, explicit archive migration, and extension update previews.
