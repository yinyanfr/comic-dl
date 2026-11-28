---
title: Build a manga source extension
description: Write, test, and package a source extension for comic-dl.
---

Source extensions are independently published Node.js 24 ESM packages. CLI users install them with `comic-dl add <package>`; library users register them with `.use()`. During development, use `--extension` or configuration to load a local module. An extension handles input recognition, login sessions, and site parsing. The core handles concurrency, chapter retries, cancellation, CBZ/ZIP archives, naming, and task progress; the CLI handles terminal rendering and exit codes. Extensions can expose `matchesUrl` for automatic source selection from full URLs.

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

## Grow a minimal adapter into a complete source

Version 4 retains API v1. These capabilities are optional; older extensions need not implement them all. Develop against `comic-dl@4.0.0` or a compatible newer version, not copied core declarations or private `dist/` imports.

### Metadata, search covers, and direct chapter context

`getSeries()` returns stable IDs and the complete reading order. Include page-provided metadata when available:

```ts
return {
  id: workId,
  metadata: {
    title,
    authors,
    summary,
    tags,
    coverUrl, // A validated public image URL; omit when unavailable.
  },
  chapters,
};
```

Search results may also include `coverUrl` or `coverId`, without a detail request for every result. Missing metadata must not break browsing, listing, or downloading. DM5 catalog covers use `.mh-cover` CSS `background-image`, while search may use `img/data-src`: extract URLs from known nodes without executing styles or scripts, and test each layout.

Direct chapter reads return `{ workId, chapter, seriesInput }`. `seriesInput` must be a reusable canonical series locator on the configured site, retaining any required chapter group. The core loads the complete catalog and verifies work/chapter identity. Do not assign a direct chapter position 1 or renumber a selection. If context is unavailable, omit it and allow a stable chapter-ID filename fallback. Direct reads may also include `metadata`.

### Public and protected covers

- Public `coverUrl` values must not contain cookies, passwords, API keys, or credential-bearing query strings. Restrict destinations to the source's configuration. Omit unsafe/missing values so clients can show placeholders.
- Zerobyw upgrades HTTP covers only for explicitly trusted, configured site/image origins, then revalidates protocol, origin, ports, credentials, query, and fragment. Upgrading an arbitrary HTTP host does not make it trusted.
- Protected services such as Komga/Kavita return credential-free `coverId` values and implement `readCover(id, signal)`. Validate IDs and read from a fixed cover endpoint on the bound service; never accept arbitrary proxy URLs or expose Auth Key URLs.
- Return `{ contentType, bytes }`. The core accepts nonempty JPEG/PNG/GIF/WebP up to 10 MiB; adapters should also bound response reads. Web applications supply authenticated image endpoints and private caching.

### Settings, credentials, and catalog capabilities

Declare non-secret `settings`. Use the same resolved values in `matchesUrl(url, kind, settings)` and `create(api, settings)`, with source-specific constraints in `validateSettings()`. Recognize default/current/explicit previous sites as appropriate, but rebuild read URLs on the current site using stable IDs.

Keep cookies/keys out of settings, search results, and metadata. Changing a server must not forward old credentials automatically: Zerobyw binds cookies with `COMIC_DL_ZEROBYW_COOKIE_ORIGIN`; Komga/Kavita bind the full service URL, including reverse-proxy paths. Recreate instances after configuration changes and stop old watchers first.

Use separate readers for public search, documents, and images where needed. Authenticated reads are explicit and destination-constrained; cross-origin redirects must not reattach credentials. Zerobyw search and images remain anonymous.

Declare sorting/filtering independently in `catalog.browse/search`, with dynamic choices from `catalogChoices()`. Translate the validated fourth search argument `{ sort, filters }` into upstream queries, retaining conditions across pages. Site-specific logic stays in the adapter.

### Progress is not an extension protocol

Implement cancellable `getPages()` and `Page.read()` only. The core emits start, page progress, archiving, and result events. Do not build a CLI progress renderer, SSE transport, persistent queue, or archive writer inside an extension. Libraries consume safe `onEvent` events; the CLI uses `--progress auto|plain|off`. Consumers show stages for unknown totals; retries reset the current attempt's page count. See [backend APIs](../../guide/service-api/) for lifecycle rules.

## Offline acceptance checklist

Alongside CLI smoke tests, exercise the same adapter through public `createDownloader().use(extension, settings)`:

| Scenario                               | Expected behavior                                                                                                       |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Full series, selection, direct chapter | Same stable identity; canonical numbering survives selection/direct input; valid archives are skipped                   |
| Metadata and search                    | Optional values appear when available; missing fields work; no per-series requests for discovery                        |
| Public covers                          | HTTPS, trusted HTTP normalization, configured origins/ports; unsafe hosts and credential URLs rejected                  |
| Protected covers                       | Valid opaque IDs work; arbitrary URLs, invalid IDs, credential leaks, and untrusted destinations rejected               |
| Settings and authentication            | Old/current inputs map to the configured site; credentials reach only the bound service; anonymous reads stay anonymous |
| Pages and failures                     | Correct order, lazy images, cancellation, transient retries, and distinct expired-session/restricted outcomes           |
| Core tasks                             | Public `onEvent` provides page and archive stages without exposing raw errors or local paths to browsers                |

Core acceptance must not depend on live sites. Report real-site, NAS, and self-hosted deployment checks separately; loopback tests are not live deployment acceptance.

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
npm install comic-dl@latest /path/to/example-comic-dl-source-0.1.0.tgz
npm exec -- comic-dl sources --extension @example/comic-dl-source
```

Use sanitized fixtures and loopback HTTP servers to cover page order, expired credentials, restricted access, and redirects. The [Zerobyw tests](https://github.com/yinyanfr/comic-dl-extensions/blob/main/extensions/zerobyw/test/zerobyw.test.js) exercise the real CLI without an account or a live manga site. In the `comic-dl-extensions` repository, run `npm test --workspace @comic-dl/zerobyw` to test just that extension.
