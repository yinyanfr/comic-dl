---
name: comic-dl-core-dev
description: Develop, test, and review the comic-dl TypeScript core, public library APIs, CLI, task lifecycle, shelf, and safe archive output. Use for core changes and regressions, not source-specific parsing or WebUI implementation.
---

# Develop comic-dl core

## Start with the repository

Read all applicable `AGENTS.md`, inspect `git status`, and preserve existing user changes. This is a TypeScript rewrite from scratch, not a migration of the old ComicDownloader or reuse of Kindlegarten's GUI.

Use `.node-version` (Node.js 24), native Node ESM, TypeScript NodeNext, and `.js` relative imports. `dist/` is generated; edit `src/` instead. Read the [contributor guide](https://yinyanfr.github.io/comic-dl/en/development/contributing/), [offline testing guide](https://yinyanfr.github.io/comic-dl/en/development/local-testing/), and relevant public API/spec pages before changing behavior.

## Find the right boundary

- CLI/configuration/rendering/exit codes: `src/index.ts`, CLI helpers, `src/config.ts`.
- Public application API and managed adapters: `src/library.ts`, `src/extension-store.ts`.
- Extension contracts/loading/HTTP and test fixture: `src/extension.ts`, `src/sources/`.
- Download orchestration: `src/download.ts`; task lifecycle in `src/tasks.ts`.
- Output safety, identity, archives, migration: `src/output/`.
- Shelf persistence and automation: inspect the current `src/shelf*` files.

Source recognition, site authentication, and parsing stay in independent adapters. Do not add source-specific behavior to the scheduler, output layer, CLI, or a monolithic base class. WebUI belongs to its own repository.

## Make the smallest compatible change

1. Reproduce the issue offline using the existing tests, explicit fixture source, or a minimal contract-compliant test adapter.
2. Add a failing regression that asserts the public behavior. Keep tests independent of real comic sites and private credentials.
3. Preserve stable IDs, full-directory ordering, mixed per-chapter results, cancellation, retry semantics, and existing stdout/exit-code behavior unless changing them is explicitly intended.
4. Preserve output root/marker checks, no-symlink traversal, identity/completeness checks before skipping, atomic commit and no-clobber migration checks. Never treat a matching filename as a complete archive.
5. Keep raw errors, filesystem paths, and secrets out of safe events/browser DTOs. Unknown totals and retry page resets are valid states.
6. Keep manual tasks in-process and watcher queues durable. One watcher owns a shelf; abort and await it before closing SQLite. Automation toggles must not silently cancel or retroactively enqueue tasks.
7. Database migrations require transaction/rollback tests and preserved baselines/queues. Do not bump schema or extension API versions casually.

## Validate

```sh
npm ci
npm run check
npm test
npm run build
node dist/index.js
```

Use targeted tests during development, then the full checks. Husky's staged-file checks are not a substitute. For CLI smoke tests, use `examples/hello-extension.mjs` and temporary output directories; do not write into the user's comics.

When public behavior changes, update corresponding Chinese, English, and Japanese documentation and relevant specifications. For docs changes:

```sh
npm ci --prefix docs
npm run build --prefix docs
```

Verify localized links and anchors. For skills changes, keep `skills/*/SKILL.md` and the three-language Agent Skills guides consistent. Do not claim Windows tests, NAS hardware, live sources, or deployed services were tested unless they actually were.

## Review and deliver

Inspect the diff for generated artifacts, unrelated changes, credential leaks, compatibility changes, and missing tests/docs. Report the public outcome, files changed, checks actually run, and unresolved risks.

Do not discard user work, commit/push, change release versions, publish npm packages, deploy, or migrate real archives unless explicitly requested. When authorized to release, follow the existing GitHub Actions workflow, not an improvised local publication.
