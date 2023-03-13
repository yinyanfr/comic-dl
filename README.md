# zerobyw-dl

[![npm](https://img.shields.io/npm/v/zerobyw-dl.svg)](https://www.npmjs.com/package/zerobyw-dl)
![license](https://img.shields.io/npm/l/zerobyw-dl.svg)
![size](https://img.shields.io/github/repo-size/yinyanfr/zerobyw-dl)

Yet another batch downloader for zerobyw.

This library is not for browsers.

## :green_book: Quick Start

```bash
npm i zerobyw-dl
# or
# CLI Upcoming
npx zerobyw-dl help
```

## :book: Library

### Initializing downloader

```typescript
import ZeroBywDownloader from "zerobyw-dl";

// Path for downloaded files
const destination = "~/Download/zerobyw";
// Configs
const configs = {
  // Get your cookie from the network inspector of your browser
  // Optional but highly recommanded, as ZeroByw partially blocks content for non-paid users
  cookie: "your_cookie",
  // Request timeout in ms (Optional: default to 10 seconds)
  timeout: 10000,
  // Silencing console output (Optional)
  silence: false,
  // numbers of images to be downloaded simultaneously (Optional: default to 10)
  batchSize: 10,
  // Display detailed error message, will override silence (Optional)
  verbose: false,
  // Output zip or cbz archives grouped by chapters (Optional)
  archive: "zip",
}; // Optional

const downloader = new ZeroBywDownloader(destination, configs);
```

### Getting serie info

```typescript
const info = await downloader.getSerieInfo("serie_url");
// info
// {
//   title: "Serie Title",
//   chapters: [{
//     index: 0,
//     name: "Chapter Name",
//     uri: "chapter_uri", // without baseUrl
//   }]
// }
```

### Downloading from a serie

```typescript
const options = {
  start: 10, // Optional: Starting chapter, inclusive, default to 0
  end: 20, // Optional: Ending chapter, inclusive, default to the last (length - 1)
  onProgress: (progress) => {
    console.log(progress);
  }, // Optional: Called when a chapter is downloaded or failed to do so
}; // Optional

// progress
// {
//   index: 0, // chapter index
//   name: "Chapter Name",
//   status: "completed", // or "failed"
//   failed: 1, // numbers of images failed to be downloaded
//   // status is completed as the download queue is cleared, even with failed images.
// }

// Download all chapters from a serie
await downloader.downloadSerie("serie_url");

// Download from the 10th to the 20th chapter (11 chapters in total)
await downloader.downloadSerie("serie_url", options);
```

### Downloading a chapter

```typescript
const options = {
  index: 0, // chapter index
  title: "Serie Title",
  onProgress: (progress) => {}, // Optional: Called when a chapter is downloaded or failed to do so, the same as in serie options
}; // Optional

await downloader.downloadChapter(
  "Chapter Name",
  "chapter_url_with_base",
  options
);
```

## :wrench: Cli (Upcoming)

The cli is not ready yet.

```
Usage: zerobyw-dl [options] [command]

Commands:
  chapter, c, ch   Download images from one chapter.
  download, d, dl  Download chapters from a manga serie.
  help             Display help
  list, l, ls      List all chapters of a manga serie.
  version          Display version

Options:
  -a, --archive  Optional: Output zip or cbz archive grouped by chapters.
  -b, --batch    Optional: Set the number or images to be downloaded simultaneously, default to 10.
  -c, --cookie   Optional (but recommanded): Provide the path to a text file that contains your cookie.
  -f, --from     Optional: Starting chapter when downloading a serie, default to 0.
  -h, --help     Output usage information
  -n, --name     The name to the serie or the chapter, optional for series.
  -o, --output   Optional: The path where downloaded files are saved (default to .).
  -s, --slience  Optional: Silence the console output.
  -T, --timeout  Optional: Override the default 10s request timeout
  -t, --to       Optional: Ending chapter when downloading a serie, defaults to chapter.length - 1.
  -u, --url      The url to the serie or the chapter.
  -v, --verbose  Optional: Display detailed error message.
  -V, --version  Output the version number

Examples:
  - Download a serie from its 10th chapter to 20th chapter to the given destination, output zip archives by chapter.
  $ npx zerobyw-dl dl -u serie_url -f 10 -t 20 -o ~/Download/zerobyw -a zip

  - List all chapters of the given serie.
  $ npx zerobyw-dl ls -u serie_url

  - Download a chapter named Chapter1.
  $ npx chapter -n Chapter1 -u chapter_url
```
