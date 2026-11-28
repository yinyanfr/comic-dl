---
title: Develop the core
description: Guide agents through architecture boundaries, output safety, and offline core regressions.
---

## Load the skill

```sh
npx skills add yinyanfr/comic-dl --skill comic-dl-core-dev
```

[Read SKILL.md](https://github.com/yinyanfr/comic-dl/blob/main/skills/comic-dl-core-dev/SKILL.md) · [Installation](../)

For core library, CLI, tasks, shelf, and output. This is a fresh TypeScript rewrite, not a migration of the old downloader.

## Workflow

1. Read `AGENTS.md`, inspect the worktree, preserve user changes, and use Node.js 24 from `.node-version`.
2. Find the responsible module, reproduce offline, add a regression, and make the smallest fix.
3. Keep native ESM/NodeNext and `.js` relative imports; never hand-edit generated `dist/`.
4. Verify public results, cancellation, retries, durability, path protection, and no-clobber migration.
5. Run full checks/tests and update three-language documentation, specifications, and skills for public changes.

```sh
npm ci
npm run check
npm test
npm run build
node dist/index.js
```

## Example request

> Use comic-dl-core-dev to fix the cancellation regression I describe. Add an offline failing test first, preserve CLI stdout and exit codes, leave real shelves/download directories untouched, and do not commit or push.

## Safety and acceptance

- Keep site matching/authentication/parsing in extensions and WebUI implementation in its own repository.
- Preserve identity/completeness checks, atomic commits, NAS guards, and migration conflict checks.
- Database changes need migration/rollback tests; do not casually change schema or extension API versions.
- Husky does not replace full checks. Do not claim Windows, live-source, or NAS validation from local offline tests.
- Release, deployment, real archive migration, and discarding user changes are not default permissions.

See [contributing](../../development/contributing/), [local testing](../../development/local-testing/), and [service APIs](../../guide/service-api/).
