#!/usr/bin/env node

/**
 * MIT License
 * Copyright (c) 2023 Yan
 */

import fs from "node:fs";
import path from "node:path";
import * as plugins from "./modules";

function findModule(name: string) {
  const downloaders = Object.values(plugins);
  for (let j = 0; j < downloaders.length; j++) {
    const Downloader = downloaders[j];
    if (Downloader.siteName === name) {
      return Downloader;
    }
  }
}

function buildDownloader(options: Partial<CliOptions> = {}) {
  const {
    module,
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
  if (!module?.length) {
    throw "Please specify module name, i.e. zerobyw";
  }
  const Downloader = findModule(module);
  if (!Downloader) {
    throw "This module is not found.";
  }

  const downloader = new Downloader(output ?? ".", {
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
  const { url, verbose, silence, output, name: rename } = options;

  try {
    if (url) {
      const downloader = buildDownloader(options);
      const serie = await downloader.getSerieInfo(url);
      if (serie) {
        if (!silence) {
          console.log(`Title: ${serie.title}`);
          console.log("----");
          serie.chapters?.forEach((e) => {
            console.log(`${e.index}  ${e.name}`);
            console.log(`${e.uri}`);
            console.log("----");
          });

          if (serie?.info) {
            Object.keys(serie.info).forEach((e) => {
              console.log(`${e}: ${serie.info?.[e]}`);
            });
          }
        }

        // if(output) {
        //   await downloader.writeCominInfo(serie, { output, rename })
        // }
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
    info,
  } = options;

  let current: Partial<DownloadProgress> = {};

  try {
    if (url) {
      const downloader = buildDownloader(options);
      await downloader.downloadSerie(url, {
        start: from,
        end: to,
        confirm: !yes,
        rename,
        retry,
        info,
        chapters: chapters
          ? `${chapters}`.split(",").map((e) => parseInt(e))
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
        "No chapter is downloaded, please check the availabiliy of the module (site) or your Internet connection."
      );
    }
  }
};

export const chapterCommand: Command = async (name, sub, options = {}) => {
  const { url, name: chapterName, verbose, output } = options;

  try {
    if (url) {
      const downloader = buildDownloader(options);
      let serie: SerieInfo | undefined;
      if (output) {
        serie = await downloader.getSerieInfo(url);
      }
      await downloader.downloadChapter(chapterName ?? "Untitled", url, {
        info: serie?.info,
      });
    } else {
      console.log("Please Provide URL.");
    }
  } catch (error) {
    if (verbose) {
      console.error(error);
    } else {
      console.log(
        `Failed to download ${chapterName}. (Use -v or --verbose flag for detailed error messages.)`
      );
    }
  }
};
