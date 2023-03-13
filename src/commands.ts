#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import ZeroBywDownloader from ".";

interface CliOptions {
  url: string;
  name: string;
  output: string;
  cookie: string;
  from: number;
  to: number;
  archive: "zip" | "cbz" | boolean;
  timeout: number;
  silence: boolean;
  batch: number;
  verbose: boolean;
}

type Command = (
  name: string,
  sub: string[],
  options?: Partial<CliOptions>
) => void;

function buildDownloader(options: Partial<CliOptions> = {}) {
  const { output, cookie, archive, timeout, silence, batch, verbose } = options;

  const downloader = new ZeroBywDownloader(output ?? ".", {
    cookie: cookie && fs.readFileSync(path.resolve(cookie)).toString(),
    timeout,
    silence,
    batchSize: batch,
    verbose,
    archive,
  });

  return downloader;
}

export const listCommand: Command = async (name, sub, options = {}) => {
  const { url } = options;
  const downloader = buildDownloader(options);

  try {
    if (url) {
      const info = await downloader.getSerieInfo(url);
      if (info) {
        console.log(`Title: ${info.title}`);
        console.log("----");
        info.chapters?.forEach((e) => {
          console.log(`${e.index}  ${e.name}`);
          console.log(`${e.uri}`);
          console.log("----");
        });
      } else {
        console.log("Please Provide URL.");
      }
    }
  } catch (error) {
    console.error(error);
  }
};

export const downloadCommand: Command = async (name, sub, options = {}) => {
  const { url, from, to } = options;
  const downloader = buildDownloader(options);

  try {
    if (url) {
      await downloader.downloadSerie(url, { start: from, end: to });
    } else {
      console.log("Please Provide URL.");
    }
  } catch (error) {
    console.error(error);
  }
};

export const chapterCommand: Command = async (name, sub, options = {}) => {
  const { url, name: chapterName } = options;
  const downloader = buildDownloader(options);

  try {
    if (url) {
      await downloader.downloadChapter(chapterName ?? "Untitled", url);
    } else {
      console.log("Please Provide URL.");
    }
  } catch (error) {
    console.error(error);
  }
};
