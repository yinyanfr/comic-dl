import { isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { extensionApiVersion, sourceExtensionApi } from '../extension.js';
import type { SourceExtension } from '../extension.js';
import type { ChapterSource } from './source.js';

export function isLocalExtensionPath(value: string) {
  return /^\.\.?(\/|\\)/.test(value);
}

export function isSourceId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

export function isPackageName(input: string) {
  return /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(input);
}

export function moduleSpecifier(input: string) {
  if (isAbsolute(input) || isLocalExtensionPath(input)) {
    return pathToFileURL(resolve(input)).href;
  }
  if (isPackageName(input)) {
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

export async function importExtension(specifier: string, label: string) {
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

export class SourceRegistry {
  #sources = new Map<
    string,
    { label: string; create: () => ChapterSource; extension: SourceExtension }
  >();

  use(extension: SourceExtension, label?: string) {
    if (!isExtension(extension)) {
      throw new Error(
        `Invalid source extension${label ? ` ${label}` : ''}: expected API version ${extensionApiVersion} and a default export with id and create()`,
      );
    }
    const { id } = extension;
    const previous = this.#sources.get(id);
    if (previous) {
      throw new Error(
        `Duplicate source ID: ${id} (${previous.label}, ${label ?? id})`,
      );
    }
    this.#sources.set(id, {
      label: label ?? id,
      extension,
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
    return this;
  }

  ids() {
    return [...this.#sources.keys()];
  }

  match(input: string, kind: 'series' | 'chapter') {
    const url = URL.parse(input);
    const matches =
      url && /^https?:$/.test(url.protocol)
        ? [...this.#sources].filter(([, { extension }]) =>
            extension.matchesUrl?.(url, kind),
          )
        : [];
    if (matches.length !== 1) {
      throw new Error(
        matches.length
          ? `Multiple sources match this URL (${matches.map(([id]) => id).join(', ')}). Select a source explicitly.`
          : 'No source matches this URL.',
      );
    }
    return matches[0][0];
  }

  create(id: string) {
    const entry = this.#sources.get(id);
    if (!entry) {
      throw new Error(`Unknown source: ${id}.`);
    }
    return entry.create();
  }
}
