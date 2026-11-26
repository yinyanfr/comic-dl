import { load } from 'cheerio/slim';
import type {
  Chapter,
  ImageExtension,
  Page,
  SourceExtension,
  SourceExtensionApi,
} from 'comic-dl/extension';
import JSON5 from 'json5';
import { createHash } from 'node:crypto';
import { extname } from 'node:path/posix';

const site = 'https://www.copy20.com';
const apiOrigin = 'https://api.manga2025.com';
const apiHeaders = {
  Accept: 'application/json',
  platform: '1',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/114.0',
};
const segment = /^[a-z0-9_-]+$/i;
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const decoder = new TextDecoder();

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid CopyManga response object');
  }
  return value as Record<string, unknown>;
}

function list(value: unknown): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new Error('Invalid CopyManga result list');
  }
  return value;
}

function text(value: unknown, field: string, pattern?: RegExp): string {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    (pattern && !pattern.test(value))
  ) {
    throw new Error(`Invalid CopyManga ${field}`);
  }
  return value;
}

function integer(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Invalid CopyManga ${field}`);
  }
  return value;
}

function workUrl(slug: string) {
  return `${site}/comic/${slug}`;
}

function parseInput(input: string) {
  if (segment.test(input)) {
    return { slug: input, group: 'default' };
  }
  const url = URL.parse(input);
  const path = url?.pathname.match(
    /^\/comic\/([a-z0-9_-]+)(?:\/chapter\/([a-f0-9-]+))?\/?$/i,
  );
  const group = url?.searchParams.get('group') ?? 'default';
  if (
    !url ||
    url.origin !== site ||
    url.username ||
    url.password ||
    !path ||
    (path[2] && !uuid.test(path[2])) ||
    !segment.test(group)
  ) {
    throw new Error(
      'Expected a CopyManga work ID, copy20.com series URL or chapter URL',
    );
  }
  return { slug: path[1], chapterId: path[2]?.toLowerCase(), group };
}

function searchResults(items: readonly unknown[]) {
  const results = new Map<string, { title: string; url: string }>();
  for (const item of items) {
    const comic = record(item);
    const slug = text(comic.path_word, 'work ID', segment);
    const title = text(comic.name, 'work title');
    results.set(slug, { title, url: workUrl(slug) });
  }
  return [...results.values()];
}

function offsetFor(page: number, size: number) {
  return integer((page - 1) * size, 'search offset');
}

function create(
  api: SourceExtensionApi,
): ReturnType<SourceExtension['create']> {
  const readApi = api.createSourceHttp({
    requestHeaders: apiHeaders,
    credentialHeaders: {},
    credentialOrigins: [],
    allowedOrigins: [apiOrigin],
  });
  const readWeb = api.createSourceHttp({
    credentialHeaders: {},
    credentialOrigins: [],
    allowedOrigins: [site],
  });

  async function readResults(url: URL, signal: AbortSignal) {
    const read = url.origin === apiOrigin ? readApi : readWeb;
    const { bytes } = await read(url, signal);
    let payload: unknown;
    try {
      payload = JSON.parse(decoder.decode(bytes));
    } catch {
      throw new Error('CopyManga did not return JSON');
    }
    const envelope = record(payload);
    const code = integer(envelope.code, 'API status');
    if (code === 210) {
      throw new Error('CopyManga refused this request (API code 210)');
    }
    if (code !== 200) {
      if ([408, 429, 500, 502, 503, 504].includes(code)) {
        throw new api.TransientSourceError(
          `CopyManga API returned code ${code}`,
        );
      }
      throw new Error(`CopyManga API returned code ${code}`);
    }
    return record(envelope.results);
  }

  async function readChapter(slug: string, id: string, signal: AbortSignal) {
    const data = await readResults(
      new URL(`/api/v3/comic/${slug}/chapter/${id}`, apiOrigin),
      signal,
    );
    if (data.is_banned === true || data.is_lock === true) {
      throw new api.RestrictedChapterError(
        'CopyManga marked this chapter as restricted',
      );
    }
    const comic = record(data.comic);
    const chapter = record(data.chapter);
    const workId = text(comic.uuid, 'work UUID', uuid).toLowerCase();
    if (
      comic.path_word !== slug ||
      text(chapter.uuid, 'chapter UUID', uuid).toLowerCase() !== id ||
      (chapter.comic_id !== undefined &&
        text(chapter.comic_id, 'chapter work UUID', uuid).toLowerCase() !==
          workId)
    ) {
      throw new Error('CopyManga returned a different work or chapter');
    }
    return { chapter, workId };
  }

  function getPages(chapter: Record<string, unknown>): Page[] {
    const contents = list(chapter.contents);
    const words = chapter.words == null ? [] : list(chapter.words);
    if (
      !contents.length ||
      (words.length && words.length !== contents.length)
    ) {
      throw new Error('Incomplete CopyManga page list');
    }
    const pages = new Map<number, Page>();
    for (const [index, item] of contents.entries()) {
      const number = words.length ? integer(words[index], 'page order') : index;
      if (number >= contents.length || pages.has(number)) {
        throw new Error('Invalid CopyManga page order');
      }
      const url = URL.parse(text(record(item).url, 'page URL'));
      if (
        !url ||
        url.protocol !== 'https:' ||
        url.username ||
        url.password ||
        url.port ||
        !url.hostname.endsWith('.mangafunb.fun')
      ) {
        throw new Error('Unrecognized CopyManga image origin');
      }
      const extension = extname(url.pathname)
        .slice(1)
        .toLowerCase() as ImageExtension;
      if (!api.imageExtensions.includes(extension)) {
        throw new Error('Unsupported CopyManga image extension');
      }
      const read = api.createSourceHttp({
        credentialHeaders: {},
        credentialOrigins: [],
        allowedOrigins: [url.origin],
      });
      pages.set(number, {
        id: createHash('sha256')
          .update(`${number}:${url.pathname}`)
          .digest('hex'),
        extension,
        async read(signal) {
          const { bytes, contentType } = await read(url, signal);
          if (!contentType?.toLowerCase().startsWith('image/')) {
            throw new Error('CopyManga did not return an image');
          }
          return bytes;
        },
      });
    }
    return [...pages]
      .sort(([left], [right]) => left - right)
      .map(([, page]) => page);
  }

  return {
    id: 'copymanga',
    async search(query, page, signal) {
      const keyword = query.trim();
      if (keyword) {
        const size = 12;
        const offset = offsetFor(page, size);
        const url = new URL('/api/kb/web/searchcl/comics', site);
        url.search = new URLSearchParams({
          q: keyword,
          q_type: '',
          platform: '2',
          limit: String(size),
          offset: String(offset),
        }).toString();
        const data = await readResults(url, signal);
        const items = list(data.list);
        return {
          results: searchResults(items),
          hasNext:
            items.length > 0 &&
            offset + items.length < integer(data.total, 'search total'),
        };
      }
      const size = 50;
      const offset = offsetFor(page, size);
      const url = new URL(
        `/comics?ordering=-datetime_updated&limit=${size}&offset=${offset}`,
        site,
      );
      const { bytes } = await readWeb(url, signal);
      const box = load(decoder.decode(bytes))('.exemptComic-box').first();
      const raw = box.attr('list');
      const total = box.attr('total');
      if (!raw || !total || !/^\d+$/.test(total)) {
        throw new Error('Could not read the CopyManga catalog');
      }
      let payload: unknown;
      try {
        payload = JSON5.parse(raw);
      } catch {
        throw new Error('Could not parse the CopyManga catalog');
      }
      const items = list(payload);
      return {
        results: searchResults(items),
        hasNext:
          items.length > 0 &&
          offset + items.length < integer(Number(total), 'catalog total'),
      };
    },
    async getSeries(input, signal) {
      const { slug, chapterId, group } = parseInput(input);
      if (chapterId) {
        throw new Error(
          'Expected a CopyManga series URL; use chapter for a direct chapter URL',
        );
      }
      const data = await readResults(
        new URL(`/api/v3/comic2/${slug}`, apiOrigin),
        signal,
      );
      const comic = record(data.comic);
      const workId = text(comic.uuid, 'work UUID', uuid).toLowerCase();
      if (comic.path_word !== slug) {
        throw new Error('CopyManga returned a different work');
      }
      if (!Object.hasOwn(record(data.groups), group)) {
        throw new Error('CopyManga chapter group was not found');
      }
      const chapters = new Map<string, { order: number; chapter: Chapter }>();
      let offset = 0;
      for (;;) {
        const path = `/api/v3/comic/${slug}/group/${group}/chapters?limit=100&offset=${offset}&_update=true`;
        const result = await readResults(new URL(path, apiOrigin), signal);
        const total = integer(result.total, 'chapter total');
        const items = list(result.list);
        if (
          (result.offset !== undefined && result.offset !== offset) ||
          offset + items.length > total
        ) {
          throw new Error('Invalid CopyManga chapter pagination');
        }
        for (const item of items) {
          const fields = record(item);
          const id = text(fields.uuid, 'chapter UUID', uuid).toLowerCase();
          if (chapters.has(id)) {
            throw new Error('Duplicate chapter in CopyManga chapter list');
          }
          chapters.set(id, {
            order: integer(fields.index, 'chapter index'),
            chapter: {
              id,
              title: text(fields.name, 'chapter title'),
              async getPages(signal) {
                const reader = await readChapter(slug, id, signal);
                if (reader.workId !== workId) {
                  throw new Error('CopyManga chapter belongs to another work');
                }
                return getPages(reader.chapter);
              },
            },
          });
        }
        offset += items.length;
        if (offset === total) {
          break;
        }
        if (!items.length) {
          throw new Error('Incomplete CopyManga chapter list');
        }
      }
      if (!chapters.size) {
        throw new Error('CopyManga did not return any chapters');
      }
      return {
        id: workId,
        chapters: [...chapters.values()]
          .sort((a, b) => a.order - b.order)
          .map(({ chapter }) => chapter),
      };
    },
    async getChapter(input, signal) {
      const { slug, chapterId } = parseInput(input);
      if (!chapterId) {
        throw new Error('Expected a CopyManga chapter URL');
      }
      const { chapter, workId } = await readChapter(slug, chapterId, signal);
      let initial: Record<string, unknown> | undefined = chapter;
      return {
        workId,
        chapter: {
          id: chapterId,
          title: text(chapter.name, 'chapter title'),
          async getPages(signal) {
            signal.throwIfAborted();
            if (initial) {
              const data = initial;
              initial = undefined;
              return getPages(data);
            }
            const reader = await readChapter(slug, chapterId, signal);
            if (reader.workId !== workId) {
              throw new Error('CopyManga chapter belongs to another work');
            }
            return getPages(reader.chapter);
          },
        },
      };
    },
  };
}

export default {
  apiVersion: 1,
  id: 'copymanga',
  create,
} satisfies SourceExtension;
