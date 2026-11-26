import { load } from 'cheerio/slim';
import type { CheerioAPI } from 'cheerio/slim';
import { createHash } from 'node:crypto';
import { extname } from 'node:path/posix';
import type {
  Chapter,
  ChapterSource,
  Page,
  SourceExtension,
  SourceExtensionApi,
} from 'comic-dl/extension';

const origin = 'https://www.zerobyw33.com';
const imageOrigin = 'https://tupa.zerobyw33.com';
const imageOrigins = [origin, imageOrigin];
const catalogPath = '/pc/pc/';
const cookieVariable = 'COMIC_DL_ZEROBYW_COOKIE';
const loginMessage = `Zerobyw session missing or expired; set ${cookieVariable} to a fresh Cookie`;

function siteId(value: unknown): string | undefined {
  const id =
    typeof value === 'number' && Number.isSafeInteger(value)
      ? String(value)
      : value;
  return typeof id === 'string' && /^[1-9]\d*$/.test(id) ? id : undefined;
}

function siteUrl(
  input: string,
  base?: URL,
  origins: readonly string[] = [origin],
) {
  const url = URL.parse(input, base?.href);
  if (!url || url.username || url.password) {
    return null;
  }
  if (
    url.protocol === 'http:' &&
    !url.port &&
    origins.includes(`https://${url.hostname}`)
  ) {
    url.protocol = 'https:';
  }
  return origins.includes(url.origin) ? url : null;
}

function pageId(url: URL | null, page: 'details' | 'view') {
  const base = `/pc/${page}/`;
  if (url && (url.pathname === base || url.pathname === `${base}index.php`)) {
    return siteId(url.searchParams.get(page === 'details' ? 'kuid' : 'zjid'));
  }
}

function requestUrl(input: string, page: 'details' | 'view') {
  const url = siteUrl(input);
  const id = pageId(url, page);
  if (!id) {
    throw new Error(
      `Expected a Zerobyw ${page === 'details' ? 'series' : 'chapter'} URL on ${origin}`,
    );
  }
  const path =
    page === 'details'
      ? `/pc/details/?kuid=${id}`
      : `/pc/view/index.php?zjid=${id}`;
  return { id, url: new URL(path, origin) };
}

function scriptValue($: CheerioAPI, declaration: RegExp): unknown {
  for (const element of $('script').toArray()) {
    const value = declaration.exec($(element).text())?.[1];
    if (value) {
      try {
        return JSON.parse(value) as unknown;
      } catch (cause) {
        throw new Error('Could not parse Zerobyw page metadata', { cause });
      }
    }
  }
}

function fields(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid Zerobyw page metadata');
  }
  return value as Record<string, unknown>;
}

function createZerobywSource(
  value: string | undefined,
  {
    createSourceHttp,
    imageExtensions,
    RestrictedChapterError,
    SourceHttpError,
  }: SourceExtensionApi,
): ChapterSource {
  function restricted() {
    return new RestrictedChapterError('Zerobyw marks this chapter as VIP-only');
  }

  const cookie = value?.trim().replace(/^Cookie:[ \t]*/i, '');
  const hasCookie =
    cookie && !/[^\x20-\x7e]/.test(cookie) && cookie.includes('=');
  const readHtml = createSourceHttp({
    credentialHeaders: hasCookie ? { Cookie: cookie } : {},
    credentialOrigins: [origin],
    allowedOrigins: [origin],
  });
  const readImage = createSourceHttp({
    credentialHeaders: {},
    credentialOrigins: [],
    allowedOrigins: imageOrigins,
  });

  async function document(url: URL, signal: AbortSignal, authenticated = true) {
    if (authenticated && !hasCookie) {
      throw new Error(loginMessage);
    }
    try {
      const response = await readHtml(url, signal, authenticated);
      if (
        response.url.pathname === '/member.php' &&
        response.url.searchParams.get('action') === 'login'
      ) {
        throw new Error(loginMessage);
      }
      return {
        $: load(new TextDecoder().decode(response.bytes)),
        url: response.url,
      };
    } catch (error) {
      if (error instanceof SourceHttpError && error.status === 401) {
        throw new Error(loginMessage, { cause: error });
      }
      throw error;
    }
  }

  async function readChapter(url: URL, id: string, signal: AbortSignal) {
    const { $, url: finalUrl } = await document(url, signal);
    const images = $('#image-container img.manga-image').toArray();
    const notice = $('#messagetext > p, main + div p').text().trim();
    if (!images.length && notice) {
      if (/(?:请先登录|請先登入|请登录后|請登入後)/.test(notice)) {
        throw new Error(loginMessage);
      }
      if (/VIP\s*(?:专属章节|專屬章節|会员专属|會員專屬)/i.test(notice)) {
        throw restricted();
      }
    }
    const bootstrap = scriptValue(
      $,
      /^\s*const localTranslate = (\{[^\r\n]*\});[ \t]*$/m,
    );
    if (bootstrap === undefined && notice && !images.length) {
      throw new Error('Zerobyw refused to open the chapter (site notice)');
    }
    const reader = fields(bootstrap);
    // The reader bootstrap distinguishes guests even for previews that render images.
    if (reader.lockType === 'login') {
      throw new Error(loginMessage);
    }
    const workId = $('.reader-breadcrumb a')
      .toArray()
      .map((anchor) =>
        pageId(siteUrl($(anchor).attr('href') ?? '', finalUrl), 'details'),
      )
      .find((id) => id !== undefined);
    const title =
      typeof reader.chapterTitle === 'string' ? reader.chapterTitle.trim() : '';
    if (
      !workId ||
      siteId(reader.kuid) !== workId ||
      siteId(reader.zjid) !== id ||
      typeof reader.lockType !== 'string' ||
      !title
    ) {
      throw new Error('Could not identify the Zerobyw chapter');
    }
    const locked =
      images.length === 0 &&
      $('h3')
        .toArray()
        .some((heading) => $(heading).text().trim() === 'VIP 专属章节');
    return {
      workId,
      title,
      getPages(): readonly Page[] {
        if (locked) {
          throw restricted();
        }
        const count = scriptValue($, /^\s*const imageCount = (\d+);[ \t]*$/m);
        if (
          !images.length ||
          (count !== undefined && images.length !== count)
        ) {
          throw new Error('Zerobyw chapter has a missing or empty page list');
        }
        const usesIndices = images.some(
          (image) => $(image).attr('data-page-index') !== undefined,
        );
        const pages = new Map<number, Page>();
        for (const [position, image] of images.entries()) {
          const rawIndex = $(image).attr('data-page-index');
          const index = usesIndices ? Number(rawIndex) : position;
          const src = $(image).attr('data-src') || $(image).attr('src');
          const url = src && siteUrl(src, finalUrl, imageOrigins);
          if (
            (usesIndices && (!rawIndex || !/^\d+$/.test(rawIndex))) ||
            index >= images.length ||
            pages.has(index) ||
            !url
          ) {
            throw new Error(
              'Invalid or unsupported Zerobyw image link or page index',
            );
          }
          const extension = imageExtensions.find(
            (ext) => `.${ext}` === extname(url.pathname).toLowerCase(),
          );
          if (!extension) {
            throw new Error('Unsupported Zerobyw image format');
          }
          const key = createHash('sha256')
            .update(url.origin + url.pathname)
            .digest('hex');
          pages.set(index, {
            id: `${index + 1}:${key}`,
            extension,
            async read(signal) {
              const { bytes, contentType } = await readImage(url, signal);
              const type = contentType?.split(';')[0].trim().toLowerCase();
              if (
                type !== `image/${extension === 'jpg' ? 'jpeg' : extension}`
              ) {
                throw new Error(
                  'Zerobyw image request did not return the expected image type',
                );
              }
              return bytes;
            },
          });
        }
        return Array.from({ length: images.length }, (_, index) =>
          pages.get(index)!,
        );
      },
    };
  }

  return {
    id: 'zerobyw',
    async search(query, page, signal) {
      const url = new URL(catalogPath, origin);
      const keyword = query.trim();
      if (keyword) {
        url.searchParams.set('keyword', keyword);
      }
      url.searchParams.set('page', String(page));
      const { $, url: finalUrl } = await document(url, signal, false);
      const main = $('main');
      const links = main.find('a[href]').toArray();
      const results = new Map<string, { title: string; url: string }>();
      for (const link of links) {
        const id = pageId(
          siteUrl($(link).attr('href') ?? '', finalUrl),
          'details',
        );
        const heading = $(link).find('h3').first().text().trim();
        if (id && heading && !results.has(id)) {
          const title = heading.split(/【\s*\d/)[0].trim() || heading;
          results.set(id, {
            title,
            url: new URL(`/pc/details/?kuid=${id}`, origin).href,
          });
        }
      }
      if (
        !results.size &&
        !/没有找到相关漫画|沒有找到相關漫畫/.test(main.text())
      ) {
        throw new Error('Could not parse the Zerobyw catalog');
      }
      const hasNext =
        results.size > 0 &&
        links.some((link) => {
          const next = siteUrl($(link).attr('href') ?? '', finalUrl);
          return (
            next?.pathname === catalogPath &&
            /下一[页頁]/.test($(link).text()) &&
            next.searchParams.get('page') === String(page + 1)
          );
        });
      return { results: [...results.values()], hasNext };
    },
    async getSeries(input, signal) {
      const { id, url } = requestUrl(input, 'details');
      const { $, url: finalUrl } = await document(url, signal);
      const uid = $('script')
        .toArray()
        .map((script) => $(script).text())
        .join('\n')
        .match(/\bdiscuz_uid\s*=\s*['"](\d+)['"]/)?.[1];
      if (uid === '0') {
        throw new Error(loginMessage);
      }
      if (!uid || pageId(finalUrl, 'details') !== id) {
        throw new Error(
          'Could not identify the Zerobyw series or its login state',
        );
      }
      const heading = $('h2').filter((_, element) =>
        /^(章节列表|章節列表)$/.test($(element).text().trim()),
      );
      const cards = heading
        .parent()
        .next()
        .children()
        .toArray()
        .map((element) => {
          const href = $(element).attr('href');
          return {
            title: $(element).text().trim(),
            id: href ? pageId(siteUrl(href, finalUrl), 'view') : undefined,
            locked:
              !href &&
              /^app\.showLockTip\(['"]vip['"]\);?$/.test(
                $(element).attr('onclick') ?? '',
              ),
          };
        });
      if (heading.length !== 1 || !cards.length) {
        throw new Error('Could not match the Zerobyw chapter list');
      }
      // VIP cards have no links; only these need IDs from the companion metadata.
      let metadataList: readonly unknown[] | undefined;
      if (cards.some((card) => card.locked)) {
        const list = scriptValue(
          $,
          /^\s*const mangaDownloadChapters = (\[[^\r\n]*\]);[ \t]*$/m,
        );
        if (!Array.isArray(list) || list.length !== cards.length) {
          throw new Error('Could not identify the restricted Zerobyw chapters');
        }
        metadataList = list;
      }
      const ids = new Set<string>();
      const chapters: Chapter[] = cards.map(
        ({ id: linkId, locked, title }, index) => {
          let chapterId = linkId;
          if (metadataList) {
            const metadata = fields(metadataList[index]);
            const metadataId = siteId(metadata.zjid);
            if (
              title !== metadata.zjname ||
              (!locked && linkId !== metadataId)
            ) {
              throw new Error(
                'Could not match an entry in the Zerobyw chapter list',
              );
            }
            chapterId = locked ? metadataId : linkId;
          }
          if (!chapterId || ids.has(chapterId) || !title) {
            throw new Error(
              'Could not match an entry in the Zerobyw chapter list',
            );
          }
          ids.add(chapterId);
          return {
            id: chapterId,
            title,
            async getPages(signal) {
              if (locked) {
                throw restricted();
              }
              const url = new URL(
                `/pc/view/index.php?zjid=${chapterId}`,
                origin,
              );
              const reader = await readChapter(url, chapterId, signal);
              if (reader.workId !== id) {
                throw new Error(
                  'Zerobyw chapter belongs to a different series',
                );
              }
              return reader.getPages();
            },
          };
        },
      );
      return { id, chapters };
    },
    async getChapter(input, signal) {
      const { id, url } = requestUrl(input, 'view');
      let reader = await readChapter(url, id, signal);
      const { workId, title } = reader;
      let used = false;
      return {
        workId,
        chapter: {
          id,
          title,
          async getPages(signal) {
            if (used) {
              reader = await readChapter(url, id, signal);
              if (reader.workId !== workId) {
                throw new Error(
                  'Zerobyw chapter belongs to a different series',
                );
              }
            }
            used = true;
            return reader.getPages();
          },
        },
      };
    },
  };
}

export default {
  apiVersion: 1,
  id: 'zerobyw',
  matchesUrl(url, kind) {
    return !!pageId(siteUrl(url.href), kind === 'series' ? 'details' : 'view');
  },
  create(api) {
    return createZerobywSource(process.env[cookieVariable], api);
  },
} satisfies SourceExtension;
