---
name: comic-dl-cli
description: Use comic-dl CLI to discover sources, search and list chapters, download authorized comics, manage a shelf and watcher, check extension updates, and preview archive migration. Use for shell automation and CLI troubleshooting, not library integrations or source parsing.
---

# comic-dl CLI

## Establish context

1. Read the project's `AGENTS.md` if working in a checkout. Use Node.js 24.
2. Check `comic-dl --version` and the relevant command's `--help`. These instructions target 4.1+; do not assume all flags exist on older versions.
3. Identify the source, trusted extension package, authorized input, output directory, configuration, and shelf database. Never invent a working site URL or credentials.
4. Read the [CLI reference](https://yinyanfr.github.io/comic-dl/en/reference/cli/) and [configuration reference](https://yinyanfr.github.io/comic-dl/en/reference/config/) for exact flags.

When working from source, run `npm ci` and `npm run build`, then replace `comic-dl` with `node dist/index.js`. Outside a checkout, install `comic-dl` only if requested; the core does not bundle online sources.

## Discover before downloading

With permission to install the selected trusted source:

```sh
comic-dl add @comic-dl/copymanga
comic-dl sources
comic-dl sources --source copymanga --options
comic-dl search 'title' --source copymanga --json
```

Use the real input supplied by the user or returned by search:

```sh
comic-dl list "$series_url" --details
comic-dl download "$series_url" -c 2-4 -o ./downloads --progress plain
```

- Package names such as `@comic-dl/copymanga` are not source IDs such as `copymanga`.
- Full URLs can auto-select registered sources; short IDs and search require a source or a configured default.
- Chapter ranges are 1-based, inclusive, and follow the complete listing. Stable IDs take precedence over positional selection. Validate the requested selection before downloading.
- JSON discovery is for automation; progress goes to stderr. `auto` renders only on a terminal, `plain` is suitable for logs, and `off` disables it.
- Exit codes: `0` success, `1` runtime/download failure, `2` invalid usage/configuration/selection, `130` interrupted. A series with successful/skipped chapters and only restricted remainder can exit `0`; do not report every chapter downloaded based on the exit code alone.

## Shelf and persistent work

Read [shelf management](https://yinyanfr.github.io/comic-dl/en/shelf/manage/) and [updates](https://yinyanfr.github.io/comic-dl/en/shelf/updates/) before changing automation. Use the same explicit `--shelf-db` path across commands.

- The first successful check establishes a baseline, not a full historical download. Historical enqueueing requires explicit user intent.
- Automatic checking and automatic downloading are independent; enabling download does not enqueue previously discovered chapters retroactively.
- Disabling automation does not cancel queued work. Cancel tasks separately.
- Run only one watcher per shelf. `shelf tasks` reads persistent state, not another process's live page counts.
- Stop the watcher gracefully; completed archives remain.

## Output, updates, and migration

- For NAS, verify the real mount and existing selected directory. Use `--output-root` and `--require-output-marker` when appropriate. Never create a marker or empty directory to disguise a missing mount.
- Archives are skipped by identity and completeness, not filename alone. Template changes do not rename existing archives.
- Inspect `comic-dl extensions` and `comic-dl update --check` before proposing updates. Apply only with authorization; saved ranges/tags constrain resolution.
- Before migration, back up and stop other writers. Preview first:

```sh
comic-dl migrate "$series_url" -o ./downloads > migration.json
```

Inspect every `from/to/status`; only after explicit approval:

```sh
comic-dl migrate --apply migration.json -o ./downloads
```

Apply the reviewed file with the same output root. Do not regenerate it silently, overwrite conflicts, or describe migration as an all-or-nothing transaction.

## Verify and report

Use the offline example in a checkout when no authorized live input exists:

```sh
node dist/index.js list --extension ./examples/hello-extension.mjs --source hello demo
```

For downloads, verify per-chapter results and archive integrity; distinguish downloaded, skipped, restricted, and failed. Redact cookies, keys, and URL queries. Do not bypass site access controls, publish packages, delete archives, or start a permanent background service without authorization.
