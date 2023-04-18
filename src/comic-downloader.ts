/**
 * MIT License
 * Copyright (c) 2023 Yan
 */
console.warn(
  `\x1b[33m [Deprecation] Import ComicDownloader from 'comic-downloader.ts' is deprecated, and will be removed in the next major version. \x1b[0m`,
);
console.warn(
  `\x1b[33m Please use import ComicDownloader from 'core' instead. \x1b[0m`,
);

export { default as default } from './core';
