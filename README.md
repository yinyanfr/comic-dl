# zerobyw-downloader

[![npm](https://img.shields.io/npm/v/zerobyw-downloader.svg)](https://www.npmjs.com/package/zerobyw-downloader)
![license](https://img.shields.io/npm/l/zerobyw-downloader.svg)
![size](https://img.shields.io/github/repo-size/yinyanfr/zerobyw-downloader)

Yet another batch downloader for zerobyw.

This library is not for browsers.

## Quick Start

```bash
npm i zerobyw-downloader
# or
# CLI Upcoming
npx zerobyw-downloader ...
```

### Library

```typescript
import ZeroBywDownloader from "zerobyw-downloader";

// Base Url of ZeroByw site
const baseURL = "http://zerobyw1060.com";
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
  // numbers of images to be downloaded simutanously (Optional: default to 10)
  batchSize: 10,
};

const downloader = new ZeroBywDownloader(baseURL, destination, configs);

/**
 * Download the entire series
 * @param url Serie Url
 * @param start Starting chapter index (default to 0, included)
 * @param end Ending chapter index (default to chapters.length, not included)
 */
// Download all chapters of this manga
await downloader.downloadSeries("some_manga_url");
// Download this manga from the 2nd chapter (index 1) to the 9th (index 8) chapter ordered on the webpage
await downloader.downloadSeries("some_manga_url", 1, 9);

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
 * @param uri Chapter uri
 */
await downloader.downloadChapter("1", "chapter_uri");
```

### Cli (Upcoming)

```bash
# TODO
```
