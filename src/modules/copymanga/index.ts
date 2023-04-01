/// <reference path="./index.d.ts" />

/**
 * MIT License
 * Copyright (c) 2023 Yan
 */

import dayjs from "dayjs";
import ComicDownloader from "../../comic-downloader";

const API_HEADERS = {
  "User-Agent":
    '"User-Agent" to "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/102.0.5005.124 Safari/537.36 Edg/102.0.1245.44"',
  version: dayjs().format("YYYY.MM.DD"),
  platform: "1",
  region: "0",
};

const API_URL = "https://api.copymanga.org/";

export default class CopymangaDownloader extends ComicDownloader {
  static readonly siteName = "copymanga";

  static canHandleUrl(url: string): boolean {
    return /copymanga/.test(url);
  }

  constructor(protected destination: string, protected configs: Configs = {}) {
    super(destination, configs);
    this.axios.defaults.baseURL = API_URL;
    Object.keys(API_HEADERS).forEach((key) => {
      this.axios.defaults.headers[key] =
        API_HEADERS[key as keyof typeof API_HEADERS] ?? "";
    });
    this.axios.defaults.headers.webp = configs.format === "jpg" ? 0 : 1;
  }

  async getSegmentedChapters(
    mangaId: string,
    page: number
  ): Promise<Chapter[]> {
    const res = await this.axios.get<CopymangaAPI.Chapter.Data>(
      `/api/v3/comic/${mangaId}/group/default/chapters?limit=500&offset=${
        page * 500
      }&platform=3`
    );
    return res?.data?.results?.list?.map((item) => {
      const uri = `/api/v3/comic/${mangaId}/chapter/${item.uuid}?platform=3`;
      return {
        index: item.index,
        name: item.name,
        uri,
      };
    });
  }

  getMangaId(url: string) {
    return new URL(url).pathname.split("/").pop();
  }

  async getSerieInfo(url: string): Promise<SerieInfo> {
    const mangaId = this.getMangaId(url);
    if (!mangaId) {
      throw new Error("Invalid URL.");
    }
    const res = await this.axios.get<CopymangaAPI.Serie.Data>(
      `/api/v3/comic2/${mangaId}`
    );
    const data = res?.data?.results?.comic;
    const count = res?.data?.results?.groups?.default?.count ?? 0;
    const title = data?.name;
    const info: ComicInfo = {
      Manga: "YesAndRightToLeft",
      Serie: title,
      Summary: data?.brief,
      Location: data?.region?.display,
      Count: count,
      Web: url,
      Status: data?.status?.value === 0 ? "Ongoing" : "End",
      Penciller: data?.author?.map((e) => e.name)?.join(","),
      Tags: data?.theme?.map((e) => e.name)?.join(","),
    };

    const chapters: Chapter[] = [];
    const pagination = 500;
    const pages = Math.ceil((count || 1) / pagination);
    for (let page = 0; page < pages; page += pagination) {
      const segment = await this.getSegmentedChapters(mangaId, page);
      chapters.push(...segment);
    }

    return { title, chapters, info };
  }

  protected async getImageList(url: string): Promise<(string | null)[]> {
    const res = await this.axios.get<CopymangaAPI.Images.Data>(url);
    const data = res?.data?.results?.chapter;
    /**
     * Copymanga now messes up the order of images,
     * but in the API data, there's a chapter.words array that contains the correct page order.
     */
    const imageUrls = data?.contents.map((item) => item.url);
    const imageOrder = data?.words;
    const orderedPages: string[] = [];
    if (imageOrder?.length) {
      imageOrder.forEach((order, index) => {
        orderedPages[order] = imageUrls[index];
      });
      return orderedPages;
    }
    return imageUrls;
  }
}
