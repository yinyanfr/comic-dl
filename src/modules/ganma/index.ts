/// <reference path="./index.d.ts" />

/**
 * MIT License
 * Copyright (c) 2023 Yan
 */

import ComicDownloader from '../../comic-downloader';

export default class GanmaDownloader extends ComicDownloader {
  static readonly siteName = 'ganma';

  static canHandleUrl(url: string): boolean {
    return /ganma\.jp/.test(url);
  }

  static readonly preferredCLIPresets: Partial<CliOptions> = {
    cookie: './ganma-cookie.txt',
  };

  getMangaId(url: string) {
    return new URL(url).pathname.split('/').pop();
  }

  protected detectBaseUrl(url: string): string {
    const baseURL = new URL(url).origin;
    this.axios.defaults.baseURL = baseURL;
    return baseURL;
  }

  async getSerieInfo(url: string): Promise<SerieInfo> {
    this.axios.defaults.headers['x-from'] = this.detectBaseUrl(url);
    const mangaId = this.getMangaId(url);
    if (!mangaId) {
      throw new Error('Invalid URL.');
    }
    const res = await this.axios.get<GanmaAPI.Serie.Data>(
      `/api/1.0/magazines/web/${mangaId}`,
    );
    const data = res?.data?.root ?? {};
    const title = data.title;
    const count = data.items?.length;
    const summary = `${data.overview}\n${data.description}\n${data.lead}`;
    const info: ComicInfo = {
      Manga: 'YesAndRightToLeft',
      Serie: title,
      Count: count,
      Summary: summary,
      Web: url,
      Location: 'Japan',
      Penciller: data.author?.penName,
      Status: data.flags?.isFinish ? 'End' : 'Ongoing',
    };
    const chapters: Chapter[] = data.items?.map((e, i) => ({
      index: i,
      name: `${e.title} ${e.subtitle ?? ''}`,
      uri: url,
      options: {
        pageUrls: e?.page?.files?.map(
          file => `${e?.page?.baseUrl}${file}?${e?.page?.token}`,
        ),
      },
    }));

    return {
      title,
      chapters,
      info,
    };
  }

  protected getImageList(
    url: string,
    options: Record<string, any> = {},
  ): Promise<(string | null)[]> {
    return Promise.resolve(options.pageUrls);
  }
}
