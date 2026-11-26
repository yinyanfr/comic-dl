---
title: Install comic-dl and add manga sources
description: Install the comic-dl CLI, then add, update, or remove source extensions.
---

## Install comic-dl

Install Node.js 24 (which includes npm), then install the CLI.

```sh
node --version
npm install -g comic-dl
comic-dl --version
```

The core package does not bundle online manga sources. Add an extension for the site or self-hosted library you want to use.

## Add a manga source

Find maintained extensions in [comic-dl-extensions](https://github.com/yinyanfr/comic-dl-extensions/blob/main/README.en.md), or use a compatible third-party extension. Look up the npm package name in the extension's README, then run:

```sh
comic-dl add @comic-dl/copymanga
comic-dl sources
```

The CLI loads extensions installed with `add` automatically. In the `sources` output, `copymanga` is the source ID you pass to `--source`. The `add`, `update`, and `remove` commands take the npm package name, `@comic-dl/copymanga`. The `fixture` source is for [local development testing](../../development/local-testing/).

## Set up authentication

Some sources require additional setup. [Zerobyw](https://github.com/yinyanfr/comic-dl-extensions/blob/main/extensions/zerobyw/README.en.md) requires a session cookie to list or download chapters. [Komga](https://github.com/yinyanfr/comic-dl-extensions/blob/main/extensions/komga/README.en.md) and [Kavita](https://github.com/yinyanfr/comic-dl-extensions/blob/main/extensions/kavita/README.en.md) require a server URL and key. CopyManga works anonymously, so you can go straight to [basic usage](../basic/).

## Update or remove a source

```sh
comic-dl update @comic-dl/copymanga
comic-dl update
comic-dl remove @comic-dl/copymanga
```

Pass a package name to `update` to update one extension, or omit it to update all installed extensions. Updates stay within the saved npm version range. To move outside that range, run `comic-dl add 'package@version'` again with the desired version. Removing an extension leaves downloaded CBZ files in place.
