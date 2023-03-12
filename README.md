# zerobyw-dl

[![npm](https://img.shields.io/npm/v/zerobyw-downloader.svg)](https://www.npmjs.com/package/zerobyw-downloader)
![license](https://img.shields.io/npm/l/zerobyw-downloader.svg)
![size](https://img.shields.io/github/repo-size/yinyanfr/zerobyw-downloader)

Yet another batch downloader for zerobyw.

This library is not for browsers.

## Quick Start

```bash
npm i zerobyw-dl
# or
# CLI Upcoming
npx zerobyw-downloader help
```

### Library

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
  // Silencing console output (Optional: default to false)
  silence: false,
  // numbers of images to be downloaded simultaneously (Optional: default to 10)
  batchSize: 10,
  // Base Url of ZeroByw site (Optional: Normally would be detected from the serie or chapter url.)
  baseURL: "http://zerobyw1060.com",
};

const downloader = new ZeroBywDownloader(destination, configs);

/**
 * Download the entire manga serie
 * @param url Serie Url
 * @param start Starting chapter index (default to 0, included)
 * @param end Ending chapter index (default to chapters.length, included)
 */
// Download all chapters of this manga
await downloader.downloadSerie("some_manga_url");
// Download this manga from the 2nd chapter (index 1) to the 9th (index 8) chapter ordered on the webpage
await downloader.downloadSerie("some_manga_url", 1, 8);

/**
 * Get chapter list
 * @param url Series Url
 * @returns Promise, list of chapters with array index, name and url
 */
const chapterList = await downloader.getChapterList("some_manga_url");

// chapterList
// [{
//   index: 0,
//   name: "1",
//   uri: "chapter_uri"
// }]

/**
 * Download and write all images from a chapter
 * @param name Chapter name
 * @param url Chapter url
 */
await downloader.downloadChapter("1", "chapter_url");
```

### Cli (Upcoming)

The cli is not ready yet.

```bash
  Usage: zerobyw downloader [options] [command]

  Commands:
    chapter   Download images from one chapter.
    download  Download chapters from a manga serie.
    help      Display help
    list      List all chapters of a manga serie.
    version   Display version

  Options:
    -b, --batch    Optional: Set the number or images to be downloaded simultaneously, default to 10.
    -c, --cookie   Optional (but recommanded): Provide the path to a text file that contains your cookie.
    -h, --help     Output usage information
    -n, --name     The name to the serie or the chapter, optional for series.
    -o, --output   Optional: The path where downloaded files are saved (default to .).
    -s, --slience  Optional: Silence the console output.
    -t, --timeout  Optional: Override the default 10s request timeout
    -u, --url      The url to the serie or the chapter.
    -v, --version  Output the version number
```
