#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import ZeroBywDownloader from ".";

function buildDownloader(options: Partial<CliOptions> = {}) {
  const {
    output,
    cookie,
    archive,
    timeout,
    silence,
    batch,
    verbose,
    maxTitleLength,
    zipLevel,
  } = options;

  const downloader = new ZeroBywDownloader(output ?? ".", {
    cookie: cookie && fs.readFileSync(path.resolve(cookie)).toString(),
    timeout,
    silence,
    batchSize: batch,
    verbose,
    archive,
    maxTitleLength,
    zipLevel,
  });

  return downloader;
}

export const listCommand: Command = async (name, sub, options = {}) => {
  const { url, verbose } = options;
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
    if (verbose) {
      console.error(error);
    } else {
      console.log(
        "Failed to get serie info. (Use -v or --verbose flag for detailed error messages.)"
      );
    }
  }
};

export const downloadCommand: Command = async (name, sub, options = {}) => {
  const {
    url,
    from,
    to,
    yes,
    verbose,
    name: rename,
    retry,
    chapters,
  } = options;
  const downloader = buildDownloader(options);
  let current: Partial<DownloadProgress> = {};

  try {
    if (url) {
      await downloader.downloadSerie(url, {
        start: from,
        end: to,
        confirm: !yes,
        rename,
        retry,
        chapters: chapters
          ? chapters.split(",").map((e) => parseInt(e))
          : undefined,
      });
    } else {
      console.log("Please Provide URL.");
    }
  } catch (error) {
    if (verbose) {
      console.error(error);
    } else {
      console.log(
        "Download Failed. (Use -v or --verbose flag for detailed error messages.)"
      );
    }

    if (current.index) {
      console.log(`Latest download: [${current.index}] ${current.name}.`);
      console.log(
        `Status: ${current.status}, Pages not downloaded: ${current.failed}.`
      );
      console.log(
        `Retry from the next chapter: Use -f ${
          current.status === "completed" ? current.index + 1 : current.index
        } ${to ? `-t ${to}` : ""}`
      );
    } else {
      console.log(
        "No chapter is downloaded, please check the availabiliy of zerobyw or your Internet connection."
      );
    }
  }
};

export const chapterCommand: Command = async (name, sub, options = {}) => {
  const { url, name: chapterName, verbose } = options;
  const downloader = buildDownloader(options);

  try {
    if (url) {
      await downloader.downloadChapter(chapterName ?? "Untitled", url);
    } else {
      console.log("Please Provide URL.");
    }
  } catch (error) {
    if (verbose) {
      console.error(error);
    } else {
      console.log(
        `Failed to download ${name}. (Use -v or --verbose flag for detailed error messages.)`
      );
    }
  }
};
