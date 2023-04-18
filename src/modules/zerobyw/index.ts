import { JSDOM } from 'jsdom';
import ComicDownloader from '../../core';

const Selectors = {
  chapters: '.uk-grid-collapse .muludiv a',
  page: '.wp',
  auth: '.jameson_manhua',
  images: '.uk-zjimg img',
  tags1: 'div.cl > a.uk-label',
  tags2: 'div.cl > span.uk-label',
};

export default class ZeroBywDownloader extends ComicDownloader {
  static readonly siteName = 'zerobyw';

  static canHandleUrl(url: string): boolean {
    return /zerobyw/.test(url);
  }

  static readonly preferredCLIPresets: Partial<CliOptions> = {
    cookie: './zerobyw-cookie.txt',
  };

  protected detectBaseUrl(url: string): void {
    const match = url.match(/^https?:\/\/[^.]+\.[^/]+/);
    if (match?.[0]) {
      this.axios.defaults.baseURL = match?.[0];
    }
  }

  async getSerieInfo(url: string): Promise<SerieInfo> {
    const res = await this.axios.get<string>(url);
    if (!res?.data) throw new Error('Request Failed.');

    const dom = new JSDOM(res.data);
    const document = dom.window.document;
    const info: ComicInfo = { Manga: 'YesAndRightToLeft', Web: url };

    const title =
      document.querySelector('title')?.textContent?.replace(/[ \s]+/g, '') ??
      'Untitled';
    info.Serie = title;

    const chapterElements = document.querySelectorAll<HTMLAnchorElement>(
      Selectors.chapters,
    );

    const chapters: Chapter[] = [];
    chapterElements.forEach((e, i) => {
      chapters.push({
        index: i,
        name: e.textContent ?? `${i}`,
        uri: (e.getAttribute('href') as string) ?? undefined,
      });
    });
    info.Count = chapters.length;

    const tagGroup1 = document.querySelectorAll<HTMLAnchorElement>(
      Selectors.tags1,
    );
    const tags: string[] = [];
    tagGroup1?.forEach((tag, i) => {
      if (i == 0) {
        // plugin.php?id=jameson_manhua&a=zz&zuozhe_name=陈某
        const match = tag.getAttribute('href')?.match(/zuozhe_name=(.+)$/);
        if (match) {
          info.Penciller = match[1];
        } else {
          if (tag.textContent) {
            tags.push(tag.textContent);
          }
        }
      }
    });
    if (tags.length) {
      info.Tags = tags.join(',');
    }

    const tagGroup2 = document.querySelectorAll<HTMLSpanElement>(
      Selectors.tags2,
    );
    const lang = tagGroup2[0]?.textContent;
    info.Language = lang === '全生肉' ? 'jp' : 'zh';
    info.Location = tagGroup2[1]?.textContent ?? undefined;
    const status = tagGroup2[2]?.textContent;
    if (status === '连载中') {
      info.Status = 'Ongoing';
    }
    if (status === '已完结') {
      info.Status = 'End';
    }

    const summary = document.querySelector('li > div.uk-alert');
    info.Summary = summary?.textContent ?? undefined;

    const serieInfo: SerieInfo = {
      title: this.configs?.maxTitleLength
        ? title.slice(0, this.configs?.maxTitleLength)
        : title,
      chapters,
      info,
    };

    return serieInfo;
  }

  protected async getImageList(url: string) {
    const res = await this.axios.get<string>(url);
    if (!res?.data) throw new Error('Request Failed.');

    const dom = new JSDOM(res.data);
    const document = dom.window.document;
    if (!document.querySelectorAll(Selectors.page)?.length) {
      throw new Error('Invalid Page.');
    }
    if (!document.querySelectorAll(Selectors.auth)?.length) {
      throw new Error('Unauthorized: Please log in.');
    }
    const imageElements = document.querySelectorAll<HTMLImageElement>(
      Selectors.images,
    );
    if (!imageElements?.length) {
      throw new Error('Forbidden: This chapter requires a VIP user rank.');
    }

    const imageList: (string | null)[] = [];
    imageElements.forEach(e => {
      imageList.push(e.getAttribute('src'));
    });
    return imageList;
  }
}
