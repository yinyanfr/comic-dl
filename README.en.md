<p align="center">
  <img src="assets/readme-icon.svg" alt="comic-dl icon: a comic book and download arrow" width="144" height="144" />
</p>

<h1 align="center">comic-dl</h1>

<p align="center">
  <strong>Your favorite manga. Your own library.</strong><br />
  An extensible manga downloader CLI and TypeScript library<br />
  Multiple sources · Automatic updates · CBZ / ZIP archives
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/comic-dl"><img src="https://img.shields.io/npm/v/comic-dl?style=flat-square&amp;logo=npm&amp;label=npm&amp;color=0F766E" alt="npm version" /></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-24-5FA04E?style=flat-square&amp;logo=nodedotjs&amp;logoColor=white" alt="Node.js 24" /></a>
  <a href="https://github.com/yinyanfr/comic-dl/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/yinyanfr/comic-dl/ci.yml?branch=main&amp;style=flat-square&amp;label=CI" alt="CI status" /></a>
  <a href="https://github.com/yinyanfr/comic-dl/actions/workflows/publish-npm.yml"><img src="https://img.shields.io/github/actions/workflow/status/yinyanfr/comic-dl/publish-npm.yml?branch=main&amp;style=flat-square&amp;label=Publish" alt="npm publishing status" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-A96927?style=flat-square" alt="MIT license" /></a>
</p>

<p align="center">
  <a href="#quick-start">Quick start</a> ·
  <a href="https://yinyanfr.github.io/comic-dl/en/">Documentation</a> ·
  <a href="https://github.com/yinyanfr/comic-dl-extensions">Source extensions</a> ·
  <a href="https://github.com/yinyanfr/comic-dl-web">Web UI</a> ·
  <a href="CHANGELOG.md">Changelog</a> ·
  <a href="README.md">简体中文</a>
</p>

## Quick start

Install the core and a source extension to save each chapter as a separate CBZ archive:

```sh
comic-dl d "https://www.copy20.com/comic/xiangkanbaitiantongxuederuanruobiaoqing"
```

Once you've installed the CopyManga extension below, paste a series URL to select the source automatically and download the series to your current directory. `d` is short for `download`.

```sh
comic-dl d xiangkanbaitiantongxuederuanruobiaoqing --source copymanga -o ~/manga -c 2-4
```

You can also use a short series ID. `-o` sets the output directory, and `-c 2-4` selects the second through fourth chapters in reading order, inclusive. If the range exceeds the chapter list, the command fails before downloading anything.

Archives default to `work title/number-chapter title.cbz` within the output directory. Templates, zero-padding, and ZIP are configurable. Legacy hashed CBZs remain recognized by identity and are not renamed automatically. See the [4.x migration guide](https://yinyanfr.github.io/comic-dl/en/migration/v3-to-v4/).

## Install

Use Node.js 24. The core package does not bundle online sources; add them to the CLI separately:

```sh
npm install -g comic-dl@latest
comic-dl add @comic-dl/copymanga
comic-dl sources
```

Run `comic-dl update @comic-dl/copymanga` to update one extension, `comic-dl update` to update all installed extensions, or `comic-dl remove @comic-dl/copymanga` to uninstall it. See [comic-dl-extensions](https://github.com/yinyanfr/comic-dl-extensions) for maintained sources. Third parties can publish their own npm packages.

## Prefer a browser?

[comic-dl-web](https://github.com/yinyanfr/comic-dl-web) is an independent, self-hosted Web UI built on this project for NAS and local manga collections. Browse sources, start downloads, and manage your shelf and automatic updates. The core handles downloads and archives; extensions provide sources. See the Web repository for deployment and configuration.

## Cross-source shelf and automatic updates

Since 3.1.0, you can use `comic-dl shelf add` to save series from different sources to one local shelf and `shelf follow <entry-id>` to subscribe. Run `shelf check` to check manually and queue new chapters, or `shelf watch --output ~/manga` to check periodically and download queued chapters as CBZ files. The first successful check only records existing chapters by default. To queue them too, use `shelf check <entry-id> --include-history`.

See [Manage your shelf](https://yinyanfr.github.io/comic-dl/en/shelf/manage/) and [Check updates and download automatically](https://yinyanfr.github.io/comic-dl/en/shelf/updates/).

## Use as a library

```sh
npm install comic-dl@latest @comic-dl/zerobyw
```

```typescript
import downloader from 'comic-dl';
import zerobyw from '@comic-dl/zerobyw';

downloader.use(zerobyw);

// Replace the URL with a real series. Zerobyw requires a valid session.
const results = await downloader.download(
  'https://www.zerobyw33.com/pc/details/?kuid=123',
  { directory: './downloads' },
);
console.log(results);
```

See the [Zerobyw extension README](https://github.com/yinyanfr/comic-dl-extensions/blob/main/extensions/zerobyw/README.en.md) for session setup.

Independent Node.js services and Web UI backends can use the library API to search, download selected chapters, manage the shelf and subscriptions, run automatic updates, and install, update, or remove extensions. They can share the CLI's shelf and extension store or use separate paths. See the [library guide](https://yinyanfr.github.io/comic-dl/en/guide/library/).

Version 4 also provides independent automation switches, safe task snapshots and page events, protected covers, extension inventory, and check-only update APIs. See [Web backends and task APIs](https://yinyanfr.github.io/comic-dl/en/guide/service-api/).

## Documentation

- [Install comic-dl and add sources](https://yinyanfr.github.io/comic-dl/en/guide/quickstart/) and [basic usage](https://yinyanfr.github.io/comic-dl/en/guide/basic/)
- [Advanced usage](https://yinyanfr.github.io/comic-dl/en/guide/advanced/), [configuration files](https://yinyanfr.github.io/comic-dl/en/guide/config-tutorial/), and [CLI reference](https://yinyanfr.github.io/comic-dl/en/reference/cli/)
- [Use as a library](https://yinyanfr.github.io/comic-dl/en/guide/library/): CLI-to-API reference, shelf updates, and extension management examples
- [Upgrade from 2.x to 3.x](https://yinyanfr.github.io/comic-dl/en/migration/v2-to-v3/)
- [Contribute to the project](https://yinyanfr.github.io/comic-dl/en/development/contributing/), [test locally](https://yinyanfr.github.io/comic-dl/en/development/local-testing/), or [build a source extension](https://yinyanfr.github.io/comic-dl/en/extensions/develop/)
