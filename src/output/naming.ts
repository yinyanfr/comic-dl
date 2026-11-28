import { createHash } from 'node:crypto';

export interface ArchiveOptions {
  /** Supported placeholders: {title}, {chapter}, {number}, {workId}, {chapterId}. */
  template?: string;
  padding?: number;
  format?: 'cbz' | 'zip';
}

export function validateArchive(
  options: ArchiveOptions = {},
): Required<ArchiveOptions> {
  const {
    template = '{title}/{number}-{chapter}',
    padding = 0,
    format = 'cbz',
  } = options;
  if (!Number.isSafeInteger(padding) || padding < 0 || padding > 12)
    throw new Error('Archive padding must be between 0 and 12');
  if (format !== 'cbz' && format !== 'zip')
    throw new Error('Archive format must be cbz or zip');
  if (
    typeof template !== 'string' ||
    template.length > 500 ||
    template.split('/').length > 4 ||
    template
      .split('/')
      .some((part) => !part || part === '.' || part === '..') ||
    /[\\:\0]/u.test(template) ||
    /[{}]/u.test(
      template.replace(/\{(?:title|chapter|number|workId|chapterId)\}/g, ''),
    )
  )
    throw new Error('Invalid archive naming template');
  return { template, padding, format };
}

export function filenamePart(input: string, limit = 160): string {
  let value = input
    .normalize('NFC')
    .replace(/[<>:"/\\|?*\p{Cc}]/gu, '_')
    .replace(/[. ]+$/g, '')
    .trim();
  if (!value || value === '.' || value === '..') value = '_';
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(value))
    value = `_${value}`;
  if (value.startsWith('.comic-dl-')) value = `_${value.slice(1)}`;
  if (Buffer.byteLength(value) > limit) {
    const suffix = createHash('sha256')
      .update(value)
      .digest('hex')
      .slice(0, 10);
    let short = '';
    for (const char of value) {
      if (Buffer.byteLength(short + char) > limit - 11) break;
      short += char;
    }
    value = `${short}-${suffix}`;
  }
  return value;
}

export function archiveName(
  values: {
    title: string;
    chapter: string;
    number?: number;
    workId: string;
    chapterId: string;
  },
  options?: ArchiveOptions,
) {
  const { template, padding, format } = validateArchive(options);
  const parts = template.split('/');
  const limit = Math.min(160, Math.floor(200 / parts.length));
  return (
    parts
      .map((part) =>
        filenamePart(
          part.replace(
            /\{(title|chapter|number|workId|chapterId)\}/g,
            (_, key: keyof typeof values) =>
              key === 'number'
                ? values.number === undefined
                  ? values.chapterId
                  : String(values.number).padStart(padding, '0')
                : String(values[key]),
          ),
          limit,
        ),
      )
      .join('/') + `.${format}`
  );
}
