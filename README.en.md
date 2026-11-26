# comic-dl

[简体中文](README.md) · [Changelog](CHANGELOG.md)

comic-dl is a command-line tool and TypeScript library for downloading manga. Install extensions to add sources. Each chapter is saved as a separate CBZ archive.

```sh
comic-dl d "https://www.copy20.com/comic/xiangkanbaitiantongxuederuanruobiaoqing"
```

Once you've installed the CopyManga extension below, paste a series URL to select the source automatically and download the series to your current directory. `d` is short for `download`.

```sh
comic-dl d xiangkanbaitiantongxuederuanruobiaoqing --source copymanga -o ~/manga -c 2-4
```

You can also use a short series ID. `-o` sets the output directory, and `-c 2-4` selects the second through fourth chapters in reading order, inclusive. If the range exceeds the chapter list, the command fails before downloading anything.

CBZ files go straight into the output directory. If you download multiple series for a reader, use a separate directory for each series, such as `-o ~/manga/series-name`.

## Install

Use Node.js 24. The new version is in alpha. The core package does not bundle online sources; add them to the CLI separately:

```sh
npm install -g comic-dl@3.0.0-alpha
comic-dl add @comic-dl/copymanga
comic-dl sources
```

Run `comic-dl update @comic-dl/copymanga` to update one extension, `comic-dl update` to update all installed extensions, or `comic-dl remove @comic-dl/copymanga` to uninstall it. See [comic-dl-extensions](https://github.com/yinyanfr/comic-dl-extensions) for maintained sources. Third parties can publish their own npm packages.

## Use as a library

```sh
npm install comic-dl@3.0.0-alpha @comic-dl/zerobyw
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

## Documentation

- [Install comic-dl and add sources](https://yinyanfr.github.io/comic-dl/en/guide/quickstart/) and [basic usage](https://yinyanfr.github.io/comic-dl/en/guide/basic/)
- [Advanced usage](https://yinyanfr.github.io/comic-dl/en/guide/advanced/), [configuration files](https://yinyanfr.github.io/comic-dl/en/guide/config-tutorial/), and [CLI reference](https://yinyanfr.github.io/comic-dl/en/reference/cli/)
- [Use as a library](https://yinyanfr.github.io/comic-dl/en/guide/library/)
- [Upgrade from 2.x to 3.x alpha](https://yinyanfr.github.io/comic-dl/en/migration/v2-to-v3/)
- [Contribute to the project](https://yinyanfr.github.io/comic-dl/en/development/contributing/), [test locally](https://yinyanfr.github.io/comic-dl/en/development/local-testing/), or [build a source extension](https://yinyanfr.github.io/comic-dl/en/extensions/develop/)
