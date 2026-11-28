import { validateArchive } from './output/naming.js';
import type { ArchiveOptions } from './output/naming.js';
import type { ProgressMode } from './cli-progress.js';

export const archiveFlags = {
  'archive-template': { type: 'string' },
  'archive-padding': { type: 'string' },
  'archive-format': { type: 'string' },
} as const;

export const outputFlags = {
  ...archiveFlags,
  'output-root': { type: 'string' },
  'require-output-marker': { type: 'string' },
  progress: { type: 'string' },
} as const;

export const outputHelp = `
  --archive-template <template> Archive path without extension (e.g. {title}/{number}-{chapter})
  --archive-padding <0-12>      Zero-pad canonical chapter numbers
  --archive-format <cbz|zip>    Archive format
  --output-root <dir>           Require an existing output directory within this root
  --require-output-marker <name> Require a marker at output-root (manual downloads need both)
  --progress <auto|plain|off>   stderr progress; auto only draws in a terminal`;

export function archiveOptions(
  values: {
    'archive-template'?: string;
    'archive-padding'?: string;
    'archive-format'?: string;
  },
  defaults?: ArchiveOptions,
): ArchiveOptions | undefined {
  if (
    values['archive-template'] === undefined &&
    values['archive-padding'] === undefined &&
    values['archive-format'] === undefined
  )
    return defaults;
  const archive = { ...defaults };
  if (values['archive-template'] !== undefined)
    archive.template = values['archive-template'];
  if (values['archive-padding'] !== undefined) {
    const padding = values['archive-padding'];
    if (!/^\d+$/.test(padding))
      throw new Error('--archive-padding requires an integer from 0 to 12');
    archive.padding = Number(padding);
  }
  if (values['archive-format'] !== undefined) {
    const format = values['archive-format'];
    if (format !== 'cbz' && format !== 'zip')
      throw new Error('--archive-format must be cbz or zip');
    archive.format = format;
  }
  validateArchive(archive);
  return archive;
}

export function progressMode(value?: string): ProgressMode {
  if (value === undefined) return 'auto';
  if (value !== 'auto' && value !== 'plain' && value !== 'off')
    throw new Error('--progress must be auto, plain or off');
  return value;
}
