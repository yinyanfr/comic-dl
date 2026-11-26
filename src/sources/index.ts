import { existsSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { extensionApiVersion, sourceExtensionApi } from '../extension.js';
import type { SourceExtension } from '../extension.js';
import { fixtureSource } from './fixture.js';
import type { ChapterSource } from './source.js';

const officialPackages = {
  copymanga: '@comic-dl/copymanga',
  zerobyw: '@comic-dl/zerobyw',
};

export function isLocalExtensionPath(value: string) {
  return /^\.\.?(\/|\\)/.test(value);
}

export function isSourceId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function moduleSpecifier(input: string) {
  if (isAbsolute(input) || isLocalExtensionPath(input)) {
    return pathToFileURL(resolve(input)).href;
  }
  if (/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(input)) {
    return input;
  }
  throw new Error(
    'Use an installed package name or a local extension file path',
  );
}

function isExtension(value: unknown): value is SourceExtension {
  return (
    typeof value === 'object' &&
    value !== null &&
    'apiVersion' in value &&
    value.apiVersion === extensionApiVersion &&
    'id' in value &&
    isSourceId(value.id) &&
    'create' in value &&
    typeof value.create === 'function' &&
    (!('matchesUrl' in value) ||
      value.matchesUrl === undefined ||
      typeof value.matchesUrl === 'function')
  );
}

async function importExtension(specifier: string, label: string) {
  let extension: unknown;
  try {
    const module = (await import(specifier)) as { default?: unknown };
    extension = module.default;
  } catch (cause) {
    throw new Error(`Could not load extension ${label}`, { cause });
  }
  if (!isExtension(extension)) {
    throw new Error(
      `Invalid source extension ${label}: expected API version ${extensionApiVersion} and a default export with id and create()`,
    );
  }
  return extension;
}

function installedPackage(name: string) {
  try {
    const entry = import.meta.resolve(name);
    if (existsSync(new URL(entry))) {
      return entry;
    }
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      error.code === 'ERR_MODULE_NOT_FOUND'
    ) {
      return;
    }
    throw error;
  }
}

export async function loadSources(
  extensions: readonly string[],
  signal: AbortSignal,
) {
  const sources = new Map<
    string,
    {
      create: () => ChapterSource;
      matchesUrl?: SourceExtension['matchesUrl'];
    }
  >([[fixtureSource.id, { create: () => fixtureSource }]]);

  function register(extension: SourceExtension) {
    const { id } = extension;
    if (sources.has(id)) {
      throw new Error(`Duplicate source ID: ${id}`);
    }
    sources.set(id, {
      matchesUrl: extension.matchesUrl?.bind(extension),
      create() {
        const source = extension.create(sourceExtensionApi);
        if (
          source?.id !== id ||
          typeof source.getSeries !== 'function' ||
          typeof source.getChapter !== 'function' ||
          (source.search !== undefined && typeof source.search !== 'function')
        ) {
          throw new Error(`Extension ${id} returned an invalid source`);
        }
        return source;
      },
    });
  }
  for (const input of extensions) {
    signal.throwIfAborted();
    register(await importExtension(moduleSpecifier(input), input));
  }
  for (const [id, name] of Object.entries(officialPackages)) {
    signal.throwIfAborted();
    if (sources.has(id)) {
      continue;
    }
    const specifier = installedPackage(name);
    if (specifier) {
      register(await importExtension(specifier, name));
    }
  }
  signal.throwIfAborted();
  return sources;
}
