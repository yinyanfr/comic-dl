---
title: Build a manga source extension
description: Write, test, and package a source extension for comic-dl.
---

Source extensions are independently published Node.js 24 ESM packages. CLI users install them with `comic-dl add <package>`; library users register them with `.use()`. During development, use `--extension` or configuration to load a local module. An extension handles input recognition, login sessions, and site parsing. The core handles concurrency, chapter retries, cancellation, CBZ output, and exit codes. Extensions can expose `matchesUrl` to support automatic source selection from full URLs.

For a hands-on example, follow the [Zerobyw walkthrough](../zerobyw-walkthrough/) from parsing fixtures to generating your first CBZ.

## Run a minimal prototype

The repository's [hello-extension.mjs](https://github.com/yinyanfr/comic-dl/blob/main/examples/hello-extension.mjs) contains one series, one chapter, and one GIF. No network access is needed to run it after installing dependencies:

```sh
npm ci
npm run build
node dist/index.js sources --extension ./examples/hello-extension.mjs
node dist/index.js list --extension ./examples/hello-extension.mjs --source hello demo
node dist/index.js chapter --extension ./examples/hello-extension.mjs --source hello welcome --output ./downloads
node dist/index.js download --extension ./examples/hello-extension.mjs --source hello demo --output ./downloads
```

Repeat `--extension` to load multiple extensions in one command. Paths beginning with `./` or `../` are resolved from the current working directory. You can also use an absolute path or a package installed in the same npm project as the CLI. Remote module URLs and directory scanning are unsupported. Extensions run with the CLI process's permissions, so only load code you trust. `sources` loads the module to inspect its declaration without calling `create()`.

## API v1

Import the public type from `comic-dl/extension` and default-export a `SourceExtension`:

```ts
import type { SourceExtension } from 'comic-dl/extension';

export default {
  apiVersion: 1,
  id: 'hello',
  create(api) {
    // Return your adapter here. See hello-extension.mjs for a complete example.
    return createHelloSource(api);
  },
} satisfies SourceExtension;
```

Read the [source extension API v1 specification](../../specs/source-extension-v1/) for chapter and page identifiers, reading order, HTTP sessions, and error conventions.

## Package independently

Use a separate npm project for your extension. For TypeScript, set `module` and `moduleResolution` to `NodeNext`, install `@types/node@24`, and set `types: ["node"]`. Install the core during development for the `comic-dl/extension` types and use `import type`. The core provides runtime APIs through `create(api)`. Set `type: "module"`, point `exports` at the compiled entry point, and declare your extension's own runtime dependencies. For example:

```json
{
  "name": "@example/comic-dl-source",
  "version": "0.1.0",
  "type": "module",
  "exports": "./dist/index.js",
  "files": ["dist"]
}
```

[Zerobyw](https://github.com/yinyanfr/comic-dl-extensions/tree/main/extensions/zerobyw) is a complete example. Publish under your own repository and npm scope, or package multiple extensions independently from a workspace. The CLI skips lifecycle scripts during installation, so publish the compiled entry point with the package.

Before publishing, run `npm pack` in the extension project and test the archive in a temporary npm project:

```sh
npm install comic-dl /path/to/example-comic-dl-source-0.1.0.tgz
npm exec -- comic-dl sources --extension @example/comic-dl-source
```

Use sanitized fixtures and loopback HTTP servers to cover page order, expired credentials, restricted access, and redirects. The [Zerobyw tests](https://github.com/yinyanfr/comic-dl-extensions/blob/main/extensions/zerobyw/test/zerobyw.test.js) exercise the real CLI without an account or a live manga site. In the `comic-dl-extensions` repository, run `npm test --workspace @comic-dl/zerobyw` to test just that extension.
