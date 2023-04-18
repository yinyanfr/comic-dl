/**
 * MIT License
 * Copyright (c) 2023 Yan
 */

console.warn(
  "[Deprecation] Import ComicDownloader from 'comic-downloader.ts' is deprecated, and will be removed in the next major version.",
);
console.warn("Please use import ComicDownloader from 'core' instead.");

export { default as default } from './core';
