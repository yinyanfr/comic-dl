---
title: Contribute to comic-dl
description: Local development, testing, code boundaries, and maintenance of the documentation site.
---

## Environment and checks

Use Node.js 24. The core uses native ESM and TypeScript `NodeNext`; relative module imports use the runtime `.js` extension.

```sh
npm ci
npm run check
npm test
node dist/index.js --help
```

`npm run check` checks formatting, types, and lint. `npm test` builds the core and runs offline regression tests. See [local development testing](../local-testing/) to manually verify chapter listings and CBZ output. Source extensions and their tests live in [comic-dl-extensions](https://github.com/yinyanfr/comic-dl-extensions/blob/main/README.en.md). They use local mock servers and fixtures without live-site credentials. Husky checks staged files only; run the full checks before committing.

## Code boundaries

| Path                                       | Responsibility                                                          |
| ------------------------------------------ | ----------------------------------------------------------------------- |
| `src/index.ts`, `src/config.ts`            | CLI, configuration, display, and exit codes                             |
| `src/library.ts`, `src/extension-store.ts` | Library entry point and CLI extension management                        |
| `src/extension.ts`, `src/sources/`         | Public extension API, source loading, HTTP helper, fixture source       |
| `src/download.ts`                          | Download orchestration, concurrency, retries, cancellation, and results |
| `src/output/`                              | Safe output paths, CBZ writing, and integrity checks                    |
| `test/`                                    | Regression tests for the CLI, downloads, and output                     |

Keep site identification, authentication, and parsing in extensions. The download service accepts chapters and ordered pages without interpreting site URLs. The output layer writes a temporary file and moves the completed CBZ into place. It checks the archive marker, page order, and CRC before skipping an existing archive. File names and marker formats are implementation details.

## Maintain the documentation site

Simplified Chinese Markdown lives in `docs/src/content/docs/`, and English in `docs/src/content/docs/en/`. Use the same relative filename in both languages so the language picker can switch between matching pages. When an interface changes, update both locales and check the corresponding reference and specification pages.

The CLI and site have separate dependencies:

```sh
npm ci --prefix docs
npm run dev --prefix docs
npm run build --prefix docs
npm run preview --prefix docs
```

Preview at `/comic-dl/` or `/comic-dl/en/` to match the [GitHub Pages](https://yinyanfr.github.io/comic-dl/en/) base path. Documentation PRs run the site build, and pushes to `main` deploy it. Set the repository's **Settings → Pages → Source** to **GitHub Actions**.

## Publish to npm

Bump the version with `npm version <version> --no-git-tag-version` and commit both `package.json` and `package-lock.json`. On a push to `main`, the [release workflow](https://github.com/yinyanfr/comic-dl/actions/workflows/publish-npm.yml) compares the version before and after the push. It checks, tests, and packages a release only when the version changes. On npm, prereleases use `next` and stable releases use `latest`. Once the npm version is published or verified to exist, the workflow creates a GitHub Release with generated notes and tags the push commit with the version number. It marks prereleases as such and skips releases that already exist.

Once the workflow is on `main`, configure a [GitHub Actions trusted publisher](https://docs.npmjs.com/trusted-publishers/) in the `comic-dl` npm package settings. Use owner `yinyanfr`, repository `comic-dl`, and workflow filename `publish-npm.yml`. Leave the environment blank and allow direct publishing (`npm publish`). No npm token is needed. Set this up before the next release; a new trusted publisher must complete its first successful publish within two days.
