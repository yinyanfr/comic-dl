#!/usr/bin/env node

/**
 * MIT License
 * Copyright (c) 2023 Yan
 */

import args from 'args';
import {
  chapterCommand,
  downloadCommand,
  genCommand,
  listCommand,
} from './commands';

args
  .command('list', 'List all chapters of a manga serie.', listCommand, [
    'l',
    'ls',
  ])
  .command(
    'download',
    'Download chapters from a manga serie.',
    downloadCommand,
    ['d', 'dl', 'serie'],
  )
  .command('chapter', 'Download images from one chapter.', chapterCommand, [
    'c',
    'ch',
  ])
  .command('generate', 'Generate template for your module.', genCommand, [
    'g',
    'gen',
  ])
  .option(
    'module',
    'Optional: Specify the module (site) name. Will attempt to detect module by url if not set.',
  )
  .option('url', 'Optional: The url to the serie or the chapter.')
  .option(
    'name',
    'Optional: Proride the serie title and override the folder name.',
  )
  .option(
    'output',
    'Optional: The path where downloaded files are saved (default to .), setting this flag when using list will save a ComicInfo.xml to the path.',
  )
  .option(
    'cookie',
    'Optional (but recommanded): Provide the path to a text file that contains your cookie.',
  )
  .option(
    'from',
    'Optional: Starting chapter when downloading a serie, default to 0.',
  )
  .option(
    'to',
    'Optional: Ending chapter when downloading a serie, defaults to chapter.length - 1.',
  )
  .option('archive', 'Optional: Output zip or cbz archive grouped by chapters.')
  .option('timeout', 'Optional: Override the default 10s request timeout.')
  .option(
    'slience',
    'Optional: Silence the console output, including the confirm prompt.',
  )
  .option(
    'batch',
    'Optional: Set the number or images to be downloaded simultaneously.',
    1,
  )
  .option(
    'verbose',
    'Optional: Display detailed error message, overrides silence.',
  )
  .option(
    'yes',
    'Optional: Skipping confirmation prompt when downloading series.',
  )
  .option(
    'max-title-length',
    'Optional: restrict the length of title as the folder name.',
  )
  .option('zip-level', 'Optional: zip level for archive, default to 5.')
  .option(
    'retry',
    'Optional: Automatically re-download chapters with failed images.',
    1,
  )
  .option(
    'chapters',
    'Optional: Only downloading given list of chapters, example: -C 1,2,4,7',
  )
  .option('info', 'Optional: Generate ComicInfo.xml.')
  .option(
    'format',
    'Optional: the format of downloaded picture, depending on the modules, example: webp / jpg.',
  )
  .option('override', 'Optional: overrides downloaded chapters.')
  .option('presets', 'Optional: loading a JSON file of site presets.')
  .option('auth', 'Optional: A string that contains token or cookie.')
  .option(
    'group',
    'Optional: For sites that provides series in groups, please refer to the site info docs, default to default.',
  )
  .option(
    'indexed-chapters',
    'Optional: Add index to the folder / archive file name of chapters.',
  )
  .option(
    'history',
    'Optional: (Experimental) Add the serie url to a given text file when using the `download` command, its value is default to a `history.txt` file under the same path of `--output`.',
  )
  .option(
    'shorthand-url',
    'Optional: The shorthand url, please refer to the module docs.',
  )
  .option(
    'list',
    'Optional: (Experimental) The path to a text file that contains a list of URLs.',
  )
  .example(
    'npx comic-dl dl -c cookie.txt -f 10 -t 20 -o ~/Download/manga -a zip -r -i -b 10 -u serie_url',
    'Download a serie from its 10th chapter to 20th chapter to the given destination, 10 images at a time, output zip archives with ComicInfo.xml by chapter, retry if a chapter is not properly downloaded.',
  )
  .example(
    'npx comic-dl dl -c cookie.txt -o ~/Download/manga -i -O -u serie_url -c 0,4,12',
    'Download chapter index 0, 4, 12 from a serie, overriding downloaded files.',
  )
  .example(
    'npx comic-dl -u serie_url -g tankobon',
    'Download from the group tankobon from a site that provide series in different groups.',
  )
  .example(
    'npx comic-dl -p presets.json -u serie_url',
    'Download a serie with presets',
  )
  .example(
    'npx comic-dl ls -u serie_url',
    'List all chapters of the given serie.',
  )
  .example('npx comic-dl -m zerobyw -S 12345', 'Using shorthand URLs.')
  .example(
    'npx comic-dl ch -n Chapter1 -u chapter_url -c cookie.txt',
    'Download a chapter named Chapter1 to current path.',
  )
  .example('npx . gen --module mySite', 'Generate a new module named mySite.')
  .example('npx . gen --presets > presets.json', 'Generate a presets json.');

const flags = args.parse(process.argv);
const subs = args.sub;

if (Object.keys(flags).length && subs.length) {
  downloadCommand('download', subs, flags);
}
