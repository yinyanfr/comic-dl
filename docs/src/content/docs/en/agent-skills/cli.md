---
title: Use the CLI
description: Guide agents through safe comic-dl discovery, downloads, shelf management, and troubleshooting.
---

## Load the skill

```sh
npx skills add yinyanfr/comic-dl --skill comic-dl-cli
```

[Read SKILL.md](https://github.com/yinyanfr/comic-dl/blob/main/skills/comic-dl-cli/SKILL.md) · [Installation](../)

For shell operations and troubleshooting. Use the [library skill](../library/) for server integrations.

## Workflow

1. Check Node.js 24, `comic-dl --version`, command help, source, and output directory.
2. Install only authorized trusted adapters; distinguish npm package names from source IDs.
3. Inspect `search --json` and `list --details` before choosing chapters from the full reading order.
4. Consume discovery JSON, keep progress on stderr, and use `--progress plain` for logs. Inspect chapter results, not only exit codes.
5. Identify the shelf database and any existing watcher before changing automation. Check extension updates with `update --check` first.

## Example request

> Use comic-dl-cli to inspect installed sources and list chapters for my URL. After confirmation, download positions 2–4 into `./downloads`. Keep existing archives, install no extra sources, enable no automatic following, and report each chapter's result.

## Safety and acceptance

- First checks normally establish a baseline; history downloads and persistent watchers need explicit intent.
- Only one watcher per shelf; `shelf tasks` does not expose another process's live page counts.
- Never manufacture a mount marker or empty directory to bypass NAS protection.
- Migration requires backup, stopped writers, a reviewed preview, and approval to apply that same plan without overwriting conflicts.
- Use the offline `hello-extension.mjs` when live access is unavailable; do not claim real-site verification.

See [CLI reference](../../reference/cli/), [shelf](../../shelf/manage/), and [updates](../../shelf/updates/).
