import { isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { extensionApiVersion, sourceExtensionApi } from '../extension.js';
import type { SourceExtension } from '../extension.js';
import { fixtureSource } from './fixture.js';
import type { ChapterSource } from './source.js';

function moduleSpecifier(input: string) {
  if (isAbsolute(input) || /^\.\.?(\/|\\)/.test(input)) {
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
    typeof value.id === 'string' &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.id) &&
    'create' in value &&
    typeof value.create === 'function'
  );
}

export async function loadSources(
  extensions: readonly string[],
  signal: AbortSignal,
) {
  const sources = new Map<string, () => ChapterSource>([
    [fixtureSource.id, () => fixtureSource],
  ]);
  for (const input of extensions) {
    signal.throwIfAborted();
    const specifier = moduleSpecifier(input);
    let extension: unknown;
    try {
      const module = (await import(specifier)) as { default?: unknown };
      extension = module.default;
    } catch (cause) {
      throw new Error(`Could not load extension ${input}`, { cause });
    }
    signal.throwIfAborted();
    if (!isExtension(extension)) {
      throw new Error(
        `Invalid source extension ${input}: expected API version ${extensionApiVersion} and a default export with id and create()`,
      );
    }
    const { id } = extension;
    if (sources.has(id)) {
      throw new Error(`Duplicate source ID: ${id}`);
    }
    sources.set(id, () => {
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
    });
  }
  return sources;
}
