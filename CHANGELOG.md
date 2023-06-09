# Changelog

## 2.4.0

`2023-05-01`

### Module

- Changed the base url for Zerobyw. ([#12](https://github.com/yinyanfr/comic-dl/pull/12))

### Feature

- [CLI] Simplify input ([#21](https://github.com/yinyanfr/comic-dl/pull/21))

  ```bash
  # From 2.4.0, this is now valid
  npx comic-dl https://www.copymanga.site/comic/hulishaonvmuye
  ```

  - Now if you don't input command, the CLI will execute the `download` command by default.
  - You can now directly add url without the `-u, --url` flag
  - You still need to wrap your urls in quotation marks if it contains special characters
  - The `download` command now has a new alias `serie`.

- [CLI] comic-dl now reads presets and cookies from `~/.comic-dl`. ([#13](https://github.com/yinyanfr/comic-dl/pull/13))

  - You need to create this folder by yourself under your personal folder.
  - comic-dl reads presets from `~/.comic-dl/presets.json`.
  - comic-dl reads cookies from `~/.comic-dl/cookies/[module_name].txt`.
  - The `-p, --presets` flag and the `-c, --cookie` flag have higher priorties.
  - The tree structure of `.comic-dl`:

    ```
    .comic-dl
    ├─ cookies
    │  └─ zerobyw.txt
    └─ presets.json
    ```

- [core] `options.retry` now can accept a number as its value, which indicates the number of retrys (default to 1 when `true`). ([#19](https://github.com/yinyanfr/comic-dl/pull/19))
- _Experimental_ Added the `option.kavita` option and the `-k, --kavita` flag for the compatibility of [kavita](https://github.com/Kareadita/Kavita). ([#22](https://github.com/yinyanfr/comic-dl/pull/22))
  - When organizing manga series, Kavita ignores the folder structure and treat chapters with a name like `17-21` as a standalone serie.
  - So this option / flag will rename such chapter by one single number (i.e. `17-21` to `17`).
  - This option / flag is experimental, it may add to or change its behaviors to future discovered Kavita compatibility issues.

### Fix

- [core] Fixed the bug where special characters are not escaped in ComicInfo.xml. ([#11](https://github.com/yinyanfr/comic-dl/pull/11))
- [core] Fixed the bug where `options.retry` is losing `chapter.uri`. ([#18](https://github.com/yinyanfr/comic-dl/pull/19))
- [CLI] Fixed the bug that the CLI is not correctly reading paths with a `~` in presets. ([#14](https://github.com/yinyanfr/comic-dl/pull/15))

## 2.3.0

`2023-04-18`

### Deprecation

- [Dev] Import ComicDownloader from 'comic-downloader.ts' is deprecated, and will be removed in the next major version.
  - This is only for module developers, the usage of the library and the CLI is unaffected.

```typescript
// Your module

// <= 2.2.0 and < 3.0.0
import ComicDownloader from '../../comic-downloader';

// >= 2.3.0
import ComicDownloader from '../../core';
```

### Feature

- [CLI] New `-S, --shorthand-url` flag is added, please refer to the documentation of each module.
  - The `-m, --module` flag is required when using this flag.
  - When using the `-h, --history` flag, the url registered will still be the completed url.
  - A `static urlCompletion` method is added to modules for developers.
  - The `-u, --url` flag has a higher priorty than this flag.
- [CLI] _Experimental_ New `-l, --list` flag is added, that can download a list of urls.
  - This flag only applies to the `dl, download` command.
  - Please note that due to the stability of each module, you may end up with multiple failures.
  - You can use the `-h, --history` flag added in the `version 2.2.0` to register your download history, so that you can use this flag as a "sync" functionality.
  - You can use the `-S, --shorthand-url` flag without value if the list your list is composed of shorthand urls.

### Fix

- [core] Fixed a bug that causes index 0 to display improperly.
- [core] To prevent unnecessary network requests, the check for chapter existence has been moved ahead of the network requests.

### Dev

- The `comic-downloader.ts` is moved to `core/index.ts`, causing the deprecation, but `comic-downloader.ts` will still exist for a while until the next major version.
- A `static urlCompletion` method is added to modules in order to parse the shorthand urls.

## 2.2.0

`2023-04-08`

### Site Support

- Fixed Ganma: `downloadChapter` not working as intended

### Feature

- New `configs.indexedChapters` config and `-I, --indexed-chapters` flag, that will add chapter index to the folder / archive file name.
- [CLI] _Experimental_ New `-h, --history` flag, that will add the serie url to a given text file when using the `download` command, its value is default to a `history.txt` file under the same path of `--output`.
- New `options.group` option and `-g, --group` flag, for sites like Copymanga, that offers series in multiple groups, default to `default`.

### Dev

- A second paramenter `options?: Partial<SerieDownloadOptions | CliOptions>` is added to `getSerieInfo` that receive the options passed to `downloadSerie`

### Misc

- [CLI] Added spinners using `ora`

## 2.1.0

`2023-04-02`

### Site Support

- Added [Ganma](https://ganma.jp/)

Ganma is a non-pirate site where contents are behind the paywall, you need a subscription purchased via Google Play Store and App Store and link it to your Ganma account, then log in to the website, open the Network inspector (F12 for mainstream browsers) and get your cookie from the request header.

Ganma provides official Japanese manga series.

### Feature

- [Library] Added getter and setter for `baseUrl`
- New `-A, --auth` that accepts a string that contains token or cookie, having a lower priority than `cookie`.
- [CLI] New `-p, --presets` flags, loading a JSON file that contains a set of parameters for sites.
  - Each site can have its own presets, use `"module"` to declare site, if `"module"` is not set, it's used for all sites.
  - Rules written below overrides those above.
  - Rule names are the same as CLI flags, full names using camelCase, e.g. `maxTitleLength`, `zipLevel`
  - You can still use flags, and flags come with higher priorities.

```json
[
  {
    "archive": "cbz",
    "batch": 5,
    "retry:" true,
    "info": true,
    "output": "~/Downloads/manga",
    "zipLevel": 5
  },
  {
    "module": "zerobyw",
    "batch": 10,
    "cookie": "./cookie.txt",
    "maxTitleLength": 30
  },
  {
    "module": "copymanga",
    "format": "webp"
  },
  {
    "module": "ganma",
    "auth": "your_cookie_string"
  }
]
```

```bash
npx comic-dl -p presets.json -u serie_url
```

- [CLI] New `generate, g, gen` command for generating a new module.

```bash
# Using in the project root
# Using -m, --module flag for module name, starting with lowercase, camelCase
npx . gen --module ganma
```

- [CLI] You can also generate a presets.json using the `generate` command

```bash
npx comic-dl gen --presets > presets.json
```

### Fix

- Fixed multiple bugs when downloading as images
  - Incorrect chapter names
  - Wrongly determination of existing chapters

### Docs

- Added docs of
  - [User] Site introductions
  - [User] Using presets
  - [Dev] Creating a new module

### Dev

- Added `options` to `Chapter` type, which is the returning value of `getSerieInfo` and gets passed to `getImageList`
- `getImageList` now accepts a 2nd parameter `options` which is passed from the returning value of `getSerieInfo`
- Added `static preferredCLIPresets` function to `ComicDownloader` that returns the CLIOptions to be written when `gen --presets`

```typescript
class MySiteDownloader extends ComicDownloader {
  // ...

  getSerieInfo(url: string) {
    // ...
    return {
      // ...
      chapters: [
        {
          index: 0,
          name: 'chapter_name',
          uri: 'uri',
          options: {
            key: 'value', // put anything here
          },
        },
      ],
    };
  }

  getImageList(
    url: string,
    options?: Record<string, any>, // this options is that options above
  ) {
    // ...
  }
}
```

### Misc

- [CLI] CLI source codes are moved to `src/cli`, where `cli.ts` is renamed to `index.ts`
- Added eslint and prettier

## 2.0.0

`2023-03-31`

:tada: **`zerobyw-dl` now becomes `comic-dl`.**

Now this library is designed to be used with multiple manga / comic sites.

### Site Support

- Added [Copymanga](https://www.copymanga.site/)

### Changes

- [Library] The code has been refactored and can now add sites as plugins.

```typescript
// Before
import ZeroBywDownloader from 'zerobyw-dl';
const downloader = new ZeroBywDownloader(destination, configs);

// Now
import { ZeroBywDownloader } from 'comic-dl';
const downloader = new ZeroBywDownloader(destination, configs);
```

- [CLI] The `-b, --batch` flag is now default to 1 when not set.
- Downloaded images are now renamed by index (01 ~ ).
- Downloaders now ignores downloaded chapters by default, set `options.override` option to `true` or for CLI use `-O, --override` if you want to override.
- [Library] Writing ComicInfo.xml to file is removed from `getSerieInfo`, thus a seperate function `writeComicInfo` has taken place, options from `getSerieInfo` is moved to `writeComicinfo`, and the typedef is renamed `WriteInfoOptions`.

```typescript
// Before
const serie = await downloader.getSerieInfo('url', { output: true });

// Now
const serie = await downloader.getSerieInfo('url');
await writeComicInfo(serie, { output: true });
```

- [CLI] New flag `-m, --module` is added to specify the module (site) to use, as a matter of which, the short-hand flag to `--max-title-length` is changed to `-M`. If `--module` is not defined, comic-dl will attempt to detect the matching module by url.

```bash
# Before
npx zerobyw-dl dl -c cookie.txt -o ~/Download/zerobyw -a zip -r -i -u serie_url

# Now
npx comic-dl dl -m zerobyw -c cookie.txt -o ~/Download/zerobyw -a zip -r -i -u serie_url -b 10
# You can skip -m flag unless comic-dl fails to detect the site module
# Batch download is now default to 1, set it manually to control downloading speed
```

- [CLI] the `-s, --silence` flag now skips the confirm prompt when downloading series.

### Fix

- [CLI] Fixed an error that causes the downloader to download the entire serie when `-C, --chapters` is set to `0`.

## 1.5.1

`2023-03-18`

### Fix

- [CLI] Fixed the error when using `--chapters` with one single index
- [Library] Fixed the bug where tags are not added to ComicInfo.xml

## 1.5.0

`2023-03-18`

### Features

- You can now download or embbed a ComicInfo.xml in chapters
  - `getSerieInfo` and `list`(CLI) now displays ComicInfo fields
  - [Library] Added `info` (boolean) as an option for serie, you can also pass it to chapter download, but you need to provide the info object
  - [Library] Added options for list so that you can generate and write ComicInfo.xml
  - [CLI] Added `-i, --info` flag for `download` to write ComicInfo.xml and for `list` to display it, use `-o` for `ls` to write the ComicInfo.xml

### Fix

- [CLI] Fixed a bug that would cause folder name to be wrongly set when downloading a single chapter

## 1.4.1

`2023-03-17`

### Features

- New Serie Download Options
  - rename: Override the serie title, for CLI: reusing -n, --name
  - retry: Automatically redownload failed chapters, for CLI: -r, --retry
  - chapters: Only downloading given list of chapter indexes, for CLI: -c, --chapters 1,2,4,7
- Better logs when partially downloading serie
- Improved type consistency
- Added uri to `DownloadProgress`

## 1.3.0

`2023-03-15`

### Features

- New configs
  - maxTitleLength (-m, --max-title-length): Restrict length of titles as folder names, default to undefined.
  - zipLevel (-z, --zip-level): Zip level for archive files, default to 5

### Fix

- Fixed a bug that would cause downloading chapters from 0 to 0 not working as intended.

## 1.2.0

`2023-03-14`

### Features

- [CLI] Added a summary of failed pages when downloading a serie

## 1.1.0

`2023-03-14`

### Fix

- [CLI] Enforcing silence and verbose flags in cli
- Better error messages

### Features

- [Library] config setter

```typescript
// change one config
downloader.setConfig('archive', 'cbz');
// merge configs
downloader.setConfigs({ archive: 'cbz' }); // Will merge
```

- show chapter index in chapter progress

### Misc

- Moved all type definitions to `global.d.ts`

## 1.0.0

`2023-03-13`

:tada: Version 1.0.0 released!

### Features

- Now you can find this package on npm
- [CLI] Added a confirmation prompt when downloading a serie (can be skipped by -y flag on cli)

## 0.3.0

`2023-03-13`

### Features

- cli
- download as zip/cbz

## 0.2.0

`2023-03-13`

### Changes

- Removed baseURL from the constructor, now baseURL can be automatically detected from serie/chapter url
- end in chapter range when downloading a serie is now inclusive.

### Misc

- Changed the package name to zerobyw-dl
- Added manifest for the upcoming cli

## 0.1.0

`2023-03-13`

First release
