# Changelog

## 1.4.0

`2023-03-17`

### Features

- New Serie Download Options
  - rename: Override the serie title, for CLI: reusing -n, --name
  - retry: Automatically redownload failed chapters, for CLI: -r, --retry
  - chapters: Only downloading given list of chapter indexes, for CLI: -c, --chapters 1,2,4,7
- Better logs when partially downloading series

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
downloader.setConfig("archive", "cbz");
// merge configs
downloader.setConfigs({ archive: "cbz" }); // Will merge
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