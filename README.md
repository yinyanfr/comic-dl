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
```

### Cli (Upcoming)

```bash
# TODO
```
