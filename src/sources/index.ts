import { isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { retrySourceRead } from '../download.js';
import { extensionApiVersion, sourceExtensionApi } from '../extension.js';
import type { SourceExtension } from '../extension.js';
import {
  isOptionKey,
  readOption,
  SourceOptionError,
} from '../source-options.js';
import type {
  CatalogOptions,
  OptionValues,
  SettingsBySource,
} from '../source-options.js';
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

export class DuplicateSourceError extends Error {
  constructor(
    readonly id: string,
    previous: string,
    next: string,
  ) {
    super(`Duplicate source ID: ${id} (${previous}, ${next})`);
  }
}

export class SourceRegistry {
  #sources = new Map<
    string,
    {
      label: string;
      settings: (candidate?: OptionValues) => OptionValues;
      extension: SourceExtension;
    }
  >();
  #ambiguous = new Set<string>();

  constructor(
    private readonly configured: SettingsBySource = {},
    private readonly overrides: SettingsBySource = {},
  ) {}

  excludeAmbiguous(id: string) {
    this.#sources.delete(id);
    this.#ambiguous.add(id);
  }

  use(extension: SourceExtension, label?: string, options: OptionValues = {}) {
    if (!isExtension(extension)) {
      throw new Error(
        `Invalid source extension${label ? ` ${label}` : ''}: expected API version ${extensionApiVersion} and a default export with id and create()`,
      );
    }
    const { id } = extension;
    const previous = this.#sources.get(id);
    if (previous || this.#ambiguous.has(id)) {
      throw new DuplicateSourceError(id, previous?.label ?? id, label ?? id);
    }
    const configured = {
      ...(Object.hasOwn(this.configured, id) && this.configured[id]),
      ...options,
    };
    const overrides = Object.hasOwn(this.overrides, id)
      ? this.overrides[id]
      : {};
    let resolved: OptionValues | undefined;
    this.#sources.set(id, {
      label: label ?? id,
      extension,
      settings(candidate) {
        if (!candidate && resolved) return resolved;
        const input = candidate ? { ...configured, ...candidate } : configured;
        const definitions = extension.settings ?? {};
        for (const key of [...Object.keys(input), ...Object.keys(overrides)]) {
          if (!isOptionKey(key) || !Object.hasOwn(definitions, key)) {
            throw new SourceOptionError(`Unknown setting ${id}.${key}`);
          }
        }
        const values = Object.create(null) as Record<
          string,
          string | boolean | number
        >;
        for (const [key, definition] of Object.entries(definitions)) {
          const env = definition.env && process.env[definition.env];
          const typed = Object.hasOwn(input, key) ? input[key] : undefined;
          const override = Object.hasOwn(overrides, key)
            ? overrides[key]
            : undefined;
          const value = override ?? typed ?? env ?? definition.default;
          if (value !== undefined) {
            values[key] = readOption(
              definition,
              value,
              `setting ${id}.${key}`,
              override !== undefined ||
                (typed === undefined && env !== undefined),
            );
          }
        }
        const snapshot = Object.freeze(values);
        try {
          extension.validateSettings?.(snapshot);
        } catch (cause) {
          throw new SourceOptionError(
            cause instanceof Error
              ? cause.message
              : `Invalid settings for ${id}`,
            { cause },
          );
        }
        if (!candidate) resolved = snapshot;
        return snapshot;
      },
    });
    return this;
  }

  ids() {
    return [...this.#sources.keys()];
  }

  validateOverrides() {
    for (const id of Object.keys(this.overrides)) {
      const entry = this.#sources.get(id);
      if (!entry)
        throw new SourceOptionError(`--set refers to an unknown source: ${id}`);
      entry.settings();
    }
  }

  match(input: string, kind: 'series' | 'chapter') {
    const url = URL.parse(input);
    const unavailable: string[] = [];
    const matches =
      url && /^https?:$/.test(url.protocol)
        ? [...this.#sources].filter(([id, { extension, settings }]) => {
            if (!extension.matchesUrl) return false;
            let values;
            try {
              values = settings();
            } catch {
              unavailable.push(id);
              return false;
            }
            return extension.matchesUrl(url, kind, values);
          })
        : [];
    if (matches.length !== 1) {
      throw new Error(
        matches.length
          ? `Multiple sources match this URL (${matches.map(([id]) => id).join(', ')}). Select a source explicitly.`
          : `No source matches this URL.${unavailable.length ? ` Check the settings for ${unavailable.join(', ')}.` : ''}`,
      );
    }
    return matches[0][0];
  }

  #entry(id: string) {
    const entry = this.#sources.get(id);
    if (!entry) {
      throw new Error(`Unknown source: ${id}.`);
    }
    return entry;
  }

  settings(id: string) {
    return structuredClone(this.#entry(id).extension.settings ?? {});
  }

  resolvedSettings(id: string, candidate?: OptionValues) {
    return { ...this.#entry(id).settings(candidate) };
  }

  create(id: string) {
    const { extension, settings } = this.#entry(id);
    const source = extension.create(sourceExtensionApi, settings());
    if (
      source?.id !== id ||
      typeof source.getSeries !== 'function' ||
      typeof source.getChapter !== 'function' ||
      (source.search !== undefined && typeof source.search !== 'function') ||
      (source.catalogChoices !== undefined &&
        typeof source.catalogChoices !== 'function')
    ) {
      throw new Error(`Extension ${id} returned an invalid source`);
    }
    return source;
  }

  async catalog(id: string, query: string, signal: AbortSignal) {
    signal.throwIfAborted();
    const mode = query.trim() ? 'search' : 'browse';
    const { sorts = [], filters = {} } =
      this.#entry(id).extension.catalog?.[mode] ?? {};
    const dynamic = Object.entries(filters).filter(
      ([, filter]) => filter.type === 'dynamic-select',
    );
    if (!dynamic.length) return structuredClone({ sorts, filters });
    const source = this.create(id);
    const entries = await Promise.all(
      dynamic.map(
        async ([key, filter]) =>
          [
            key,
            {
              ...filter,
              type: 'select' as const,
              choices: await this.#choices(source, key, mode, signal),
            },
          ] as const,
      ),
    );
    return structuredClone({
      sorts,
      filters: { ...filters, ...Object.fromEntries(entries) },
    });
  }

  async #choices(
    source: ChapterSource,
    key: string,
    mode: 'browse' | 'search',
    signal: AbortSignal,
  ) {
    const load = source.catalogChoices?.bind(source);
    if (!load)
      throw new Error(`Source ${source.id} cannot load choices for ${key}`);
    try {
      return await retrySourceRead(() => load(key, mode, signal), signal);
    } catch (cause) {
      signal.throwIfAborted();
      throw new Error(`Could not load ${key} choices from ${source.id}`, {
        cause,
      });
    }
  }

  async prepareSearch(
    id: string,
    query: string,
    page: number,
    signal: AbortSignal,
    options: CatalogOptions = {},
    fromText = false,
  ) {
    signal.throwIfAborted();
    if (!Number.isSafeInteger(page) || page < 1)
      throw new RangeError('page must be a positive integer');
    const mode = query.trim() ? 'search' : 'browse';
    const catalog = this.#entry(id).extension.catalog?.[mode];
    const { sort } = options;
    if (
      sort !== undefined &&
      !catalog?.sorts?.some((choice) => choice.id === sort)
    ) {
      throw new SourceOptionError(
        `Source ${id} does not support that sort for ${mode}`,
      );
    }
    const source = this.create(id);
    if (!source.search) throw new Error(`Source ${id} does not support search`);
    const filters = Object.create(null) as Record<
      string,
      string | boolean | number
    >;
    for (const [key, value] of Object.entries(options.filters ?? {})) {
      const filter =
        catalog?.filters &&
        Object.hasOwn(catalog.filters, key) &&
        catalog.filters[key];
      if (!filter)
        throw new SourceOptionError(
          `Source ${id} does not support filter ${key} for ${mode}`,
        );
      const definition =
        filter.type === 'dynamic-select'
          ? {
              ...filter,
              type: 'select' as const,
              choices: await this.#choices(source, key, mode, signal),
            }
          : filter;
      filters[key] = readOption(definition, value, `filter ${key}`, fromText);
    }
    const search = source.search.bind(source);
    if (sort === undefined && !Object.keys(filters).length) {
      return () => search(query, page, signal);
    }
    return () => search(query, page, signal, { sort, filters });
  }
}
