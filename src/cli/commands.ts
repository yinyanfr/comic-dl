#!/usr/bin/env node

/**
 * MIT License
 * Copyright (c) 2023 Yan
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  detectModule,
  findModule,
  genModule,
  genPresets,
  mergeOptions,
} from './lib';

function buildDownloader(options: Partial<CliOptions> = {}) {
  const {
    module,
    output = '.',
    cookie,
    archive,
    timeout,
    silence,
    batch,
    verbose,
    maxTitleLength,
    zipLevel,
    url,
    format,
    auth,
  } = options;
  const Downloader = module?.length ? findModule(module) : detectModule(url);
  if (!Downloader) {
    throw new Error('Module not found.');
  }
  if (!silence || verbose) {
    console.log(`Using ${Downloader.siteName}.`);
  }

  const downloader = new Downloader(output, {
    cookie: cookie ? fs.readFileSync(path.resolve(cookie)).toString() : auth,
    timeout,
    silence,
    batchSize: batch ?? 1,
    verbose,
    archive,
    maxTitleLength,
    zipLevel,
    format,
  });

  return downloader;
}

export const listCommand: Command = async (name, sub, _options = {}) => {
  const options = mergeOptions(_options);
  const { url, verbose, silence, output, name: rename } = options;

  try {
    if (url) {
      const downloader = buildDownloader(options);
      const serie = await downloader.getSerieInfo(url);
      if (serie) {
        if (!silence) {
          console.log(`Title: ${serie.title}`);
          console.log('----');
          serie.chapters?.forEach(e => {
            console.log(`${e.index}  ${e.name}`);
            console.log(`${e.uri}`);
            console.log('----');
          });

          if (serie?.info) {
            Object.keys(serie.info).forEach(e => {
              console.log(`${e}: ${serie.info?.[e]}`);
            });
          }
        }

        if (output) {
          await downloader.writeComicInfo(serie, { output, rename });
        }
      } else {
        console.log('Please Provide URL.');
      }
    }
  } catch (error) {
    if (verbose) {
      console.error(error);
    } else {
      console.log(
        'Failed to get serie info. (Use -v or --verbose flag for detailed error messages.)',
      );
    }
  }
};

export const downloadCommand: Command = async (name, sub, _options = {}) => {
  const options = mergeOptions(_options);
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
    override,
  } = options;

  const current: Partial<DownloadProgress> = {};

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
        override,
        chapters:
          chapters !== undefined
            ? `${chapters}`.split(',').map(e => parseInt(e))
            : undefined,
      });
    } else {
      console.log('Please Provide URL.');
    }
  } catch (error) {
    if (verbose) {
      console.error(error);
    } else {
      console.log(
        'Download Failed. (Use -v or --verbose flag for detailed error messages.)',
      );
    }

    if (current.index) {
      console.log(`Latest download: [${current.index}] ${current.name}.`);
      console.log(
        `Status: ${current.status}, Pages not downloaded: ${current.failed}.`,
      );
      console.log(
        `Retry from the next chapter: Use -f ${
          current.status === 'completed' ? current.index + 1 : current.index
        } ${to ? `-t ${to}` : ''}`,
      );
    } else {
      console.log(
        'No chapter is downloaded, please check the availabiliy of the module (site) or your Internet connection.',
      );
    }
  }
};

export const chapterCommand: Command = async (name, sub, _options = {}) => {
  const options = mergeOptions(_options);
  const { url, name: chapterName, verbose, output, override } = options;

  try {
    if (url) {
      const downloader = buildDownloader(options);
      let serie: SerieInfo | undefined;
      if (output) {
        serie = await downloader.getSerieInfo(url);
      }
      await downloader.downloadChapter(chapterName ?? 'Untitled', url, {
        info: serie?.info,
        override,
      });
    } else {
      console.log('Please Provide URL.');
    }
  } catch (error) {
    if (verbose) {
      console.error(error);
    } else {
      console.log(
        `Failed to download ${chapterName}. (Use -v or --verbose flag for detailed error messages.)`,
      );
    }
  }
};

export const genCommand: Command = async (_, sub, options = {}) => {
  const { module, presets } = options;

  if (module) {
    await genModule(module);
  } else if (presets) {
    await genPresets();
  } else {
    throw new Error(
      'The gen command is used to generate a module or a presets file, please use the --module or --presets flag.',
    );
  }
};
