/**
 * MIT License
 * Copyright (c) 2023 Yan
 */

import fs from 'node:fs';
import path from 'node:path';
import { indexDts, indexTs, exportDefault } from './templates';
import defaultPresets from './presets.json';
import * as plugins from '../modules';

export function detectModule(url?: string) {
  if (!url) return undefined;
  const downloaders = Object.values(plugins);
  for (let j = 0; j < downloaders.length; j++) {
    const Downloader = downloaders[j];
    if (Downloader.canHandleUrl(url)) {
      return Downloader;
    }
  }
}

export function findModule(name: string) {
  const downloaders = Object.values(plugins);
  for (let j = 0; j < downloaders.length; j++) {
    const Downloader = downloaders[j];
    if (Downloader.siteName === name) {
      return Downloader;
    }
  }
}

/**
 * capitalize the first letter of a string
 * @param s string
 * @returns string
 */
export function cap1(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export async function genModule(name: string) {
  // This will be running from dist/
  const modulePath = path.join(__dirname, '..', '..', 'src', 'modules', name);
  const exportPath = path.join(
    __dirname,
    '..',
    '..',
    'src',
    'modules',
    'index.ts',
  );
  await fs.promises.mkdir(modulePath);
  await fs.promises.writeFile(
    path.join(modulePath, 'index.d.ts'),
    indexDts(name),
  );
  await fs.promises.writeFile(path.join(modulePath, 'index.ts'), indexTs(name));

  const exportDefaultReader = await fs.promises.readFile(exportPath);
  const defaults = exportDefaultReader
    .toString()
    .split('\n')
    .filter(e => e.length);
  defaults.push(exportDefault(name));
  await fs.promises.writeFile(exportPath, `${defaults.join('\n')}\n`);

  console.log(`Module ${name} is created at ${modulePath}`);
}

export function genPresets() {
  const presets: Partial<CliOptions>[] = [
    defaultPresets as Partial<CliOptions>,
  ];

  const downloaders = Object.values(plugins);
  for (let j = 0; j < downloaders.length; j++) {
    const Downloader = downloaders[j];
    presets.push({
      module: Downloader.siteName,
      ...Downloader.preferredCLIPresets,
    });
  }

  console.log(JSON.stringify(presets, null, 2));
}

/**
 * Returning a new object with all values that are not undefined
 * @param obj Object
 * @returns Object
 */
function purgeObj(obj: Record<string, any>) {
  const purged: Record<string, any> = {};
  Object.keys(obj).forEach(key => {
    if (obj[key] !== undefined) {
      purged[key] = obj[key];
    }
  });
  return purged;
}

/**
 * Merging an array of object into 1 object
 * @param objects Array<Object>
 * @returns Object
 */
function mergeObj(objects: Record<string, any>[]) {
  return objects.reduce((prev, curr) => ({ ...prev, curr }));
}

export function mergeOptions(
  options: Partial<CliOptions> = {},
): Partial<CliOptions> {
  if (!options.presets) {
    return options;
  }
  const moduleName = options.module ?? detectModule(options.url)?.siteName;
  const presetsReader = fs.readFileSync(options.presets);
  const presets: Partial<CliOptions>[] = JSON.parse(presetsReader.toString());
  const generals = presets.filter(e => !e.module);
  const thisModule = presets.filter(e => e.module === moduleName);

  return {
    ...mergeObj(generals),
    ...mergeObj(thisModule),
    ...purgeObj(options),
  };
}
