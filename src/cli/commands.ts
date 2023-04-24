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
  isString,
  mergeOptions,
  parseTilda,
  writeHistory,
} from './lib';

function buildDownloader(options: Partial<CliOptions> = {}) {
  const {
    module,
    output: _output = '.',
    cookie: _cookie,
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
    indexedChapters,
  } = options;
  const output = parseTilda(_output);
  const cookie = _cookie && parseTilda(_cookie);

  const Downloader = module?.length ? findModule(module) : detectModule(url);
  if (!Downloader) {
    throw new Error('Module not found.');
  }
  if (!silence || verbose) {
    console.log(`Using ${Downloader.siteName}.`);
  }

  const localCookiePath = parseTilda(
    `~/.comic-dl/cookies/${Downloader.siteName}.txt`,
  );
  let cookiePath = cookie;
  if (!cookie && fs.existsSync(localCookiePath)) {
    cookiePath = localCookiePath;
  }

  const downloader = new Downloader(output, {
    cookie: cookiePath
      ? fs.readFileSync(path.resolve(cookiePath)).toString()
      : auth,
    timeout,
    silence,
    batchSize: batch ?? 1,
    verbose,
    archive,
    maxTitleLength,
    zipLevel,
    format,
    indexedChapters,
  });

  return { downloader, Downloader };
}

export const listCommand: Command = async (name, sub, _options = {}) => {
  if (sub?.[0]?.length) {
    _options.url = sub[0];
  }
  const options = mergeOptions(_options);
  const { url, shorthandUrl, verbose, silence, output, name: rename } = options;

  try {
    if (!url && !shorthandUrl) {
      console.warn('Please Provide URL.');
    }

    const { downloader, Downloader } = buildDownloader(options);
    const completeUrl = shorthandUrl
      ? Downloader.urlCompletion(shorthandUrl as string)
      : (url as string);
    const serie = await downloader.getSerieInfo(completeUrl, options);
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
        await downloader.writeComicInfo(serie, {
          output: parseTilda(output),
          rename,
        });
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

export const _downloadCommand: Command = async (name, sub, _options = {}) => {
  if (sub?.[0]?.length) {
    _options.url = sub[0];
  }
  const options = mergeOptions(_options);
  const {
    url,
    shorthandUrl,
    from,
    to,
    yes,
    verbose,
    name: rename,
    retry,
    chapters,
    info,
    override,
    history,
    output: _output = '.',
  } = options;
  const output = parseTilda(_output);

  const current: Partial<DownloadProgress> = {};

  try {
    if (!url && !shorthandUrl) {
      console.warn('Please Provide URL.');
    }

    const { downloader, Downloader } = buildDownloader(options);
    const completeUrl = shorthandUrl
      ? Downloader.urlCompletion(shorthandUrl as string)
      : (url as string);
    if (history) {
      const historyPath = isString(history)
        ? (history as string)
        : path.resolve(output, 'history.txt');
      writeHistory(historyPath, completeUrl);
    }

    await downloader.downloadSerie(completeUrl, {
      ...options,
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

export const downloadCommand: Command = async (name, sub, _options = {}) => {
  const { list, shorthandUrl } = _options;
  if (!list) {
    await _downloadCommand(name, sub, _options);
  } else {
    const urlListReader = await fs.promises.readFile(path.resolve(list));
    const urlList = urlListReader.toString().split('\n');
    for (let u = 0; u < urlList.length; u++) {
      const url = urlList[u];
      const options = { ..._options };
      if (shorthandUrl) {
        options.shorthandUrl = url;
      } else {
        options.url = url;
      }
      await _downloadCommand(name, sub, options);
    }
  }
};

export const chapterCommand: Command = async (name, sub, _options = {}) => {
  if (sub?.[0]?.length) {
    _options.url = sub[0];
  }
  const options = mergeOptions(_options);
  const {
    url,
    shorthandUrl,
    name: chapterName,
    verbose,
    output: _output = '.',
    override,
  } = options;
  const output = parseTilda(_output);

  try {
    if (!url && !shorthandUrl) {
      console.warn('Please Provide URL.');
    }

    const { downloader, Downloader } = buildDownloader(options);
    const completeUrl = shorthandUrl
      ? Downloader.urlCompletion(shorthandUrl as string)
      : (url as string);
    let serie: SerieInfo | undefined;
    if (output) {
      serie = await downloader.getSerieInfo(completeUrl, options);
    }
    await downloader.downloadChapter(chapterName ?? 'Untitled', url, {
      info: serie?.info,
      override,
    });
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
