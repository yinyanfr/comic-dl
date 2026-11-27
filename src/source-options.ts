export type OptionValue = string | number | boolean;
export type OptionValues = Readonly<Record<string, OptionValue>>;

export interface OptionChoice {
  readonly id: string;
  readonly label: string;
}

export type OptionDefinition = {
  readonly label: string;
  readonly description?: string;
} & (
  | { readonly type: 'text' | 'url' | 'boolean' }
  | { readonly type: 'integer'; readonly min?: number; readonly max?: number }
  | { readonly type: 'select'; readonly choices: readonly OptionChoice[] }
);

export type SettingDefinition = OptionDefinition & {
  readonly default?: OptionValue;
  /** For existing non-secret environment settings only. */
  readonly env?: string;
};

export interface CatalogMode {
  readonly sorts?: readonly OptionChoice[];
  readonly filters?: Readonly<
    Record<
      string,
      | OptionDefinition
      | {
          readonly type: 'dynamic-select';
          readonly label: string;
          readonly description?: string;
        }
    >
  >;
}

export type CatalogCapabilities = Readonly<
  Partial<Record<'browse' | 'search', CatalogMode>>
>;

export interface CatalogOptions {
  readonly sort?: string;
  readonly filters?: OptionValues;
}

export type SettingsBySource = Readonly<Record<string, OptionValues>>;

export class SourceOptionError extends Error {}

export function isOptionValue(value: unknown): value is OptionValue {
  return (
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isSafeInteger(value))
  );
}

export function isOptionKey(key: string) {
  return /^[a-z][a-z0-9-]*$/u.test(key);
}

export function assignment(input: string, option: string) {
  const index = input.indexOf('=');
  if (index < 1) throw new Error(`${option} requires a key=value assignment`);
  return [input.slice(0, index), input.slice(index + 1)] as const;
}

export function readOption(
  definition: OptionDefinition,
  value: OptionValue,
  label: string,
  fromText = false,
): OptionValue {
  if (fromText && typeof value === 'string') {
    if (definition.type === 'integer' && /^-?\d+$/u.test(value))
      value = Number(value);
    if (
      definition.type === 'boolean' &&
      (value === 'true' || value === 'false')
    )
      value = value === 'true';
  }
  const url =
    definition.type === 'url' && typeof value === 'string'
      ? URL.parse(value)
      : null;
  const valid = (() => {
    switch (definition.type) {
      case 'text':
        return typeof value === 'string' && value.trim().length > 0;
      case 'url':
        return (
          url &&
          /^https?:$/u.test(url.protocol) &&
          !url.username &&
          !url.password &&
          !url.search &&
          !url.hash
        );
      case 'boolean':
        return typeof value === 'boolean';
      case 'integer':
        return (
          typeof value === 'number' &&
          Number.isSafeInteger(value) &&
          value >= (definition.min ?? -Infinity) &&
          value <= (definition.max ?? Infinity)
        );
      case 'select':
        return definition.choices.some((choice) => choice.id === value);
    }
  })();
  if (!valid)
    throw new SourceOptionError(
      `Invalid ${label}: expected ${definition.type}`,
    );
  return value;
}
