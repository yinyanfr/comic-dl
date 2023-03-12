import axios from "axios";
import type { AxiosInstance } from "axios";
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";
import type { Stream } from "node:stream";

interface Configs {
  baseUrl?: string;
  cookie?: string;
  timeout?: number;
  silence?: boolean;
  batchSize?: number;
}

interface Chapter {
  index: number;
  name: string;
  uri: string | null;
}

const Selectors = {
  chapters: ".uk-grid-collapse .muludiv a",
  page: ".wp",
  auth: ".jameson_manhua",
  images: ".uk-zjimg img",
};

export default class ZeroBywDownloader {
  private axios: AxiosInstance;
  private title: string = "Untitled";

  constructor(private destination: string, private configs: Configs = {}) {
    this.axios = axios.create({
      baseURL: configs?.baseUrl,
      timeout: configs?.timeout ?? 10000,
      headers: {
        Cookie: configs?.cookie,
      },
    });
  }

  private log(content: string) {
    if (!this.configs?.silence) {
      console.log(content);
    }
  }

  private detectBaseUrl(url: string) {
    const match = url.match(/^https?:\/\/[^.]+\.[^/]+/);
    if (match?.[0]) {
      this.axios.defaults.baseURL = match?.[0];
    }
  }

  /**
   * Get chapter list
   * @param url Series Url
   * @returns Promise, list of chapters with array index, name and url
   */
  async getChapterList(url: string) {
    const res = await this.axios.get<string>(url);
    if (!res?.data) throw new Error("Request Failed.");

    const dom = new JSDOM(res.data);
    const document = dom.window.document;
    this.title =
      document.querySelector("title")?.innerHTML.replace(/[ \s]+/g, "") ??
      "Untitled";
    this.log(`Found ${this.title}.`);

    const chapterElements = document.querySelectorAll<HTMLAnchorElement>(
      Selectors.chapters
    );

    const chapters: Chapter[] = [];
    chapterElements.forEach((e, i) => {
      chapters.push({
        index: i,
        name: e.innerHTML,
        uri: e.getAttribute("href"),
      });
    });
    this.log(`Chapter Length: ${chapters.length}`);
    return chapters;
  }

  private async getImageList(url: string) {
    const res = await this.axios.get<string>(url);
    if (!res?.data) throw new Error("Request Failed.");

    const dom = new JSDOM(res.data);
    const document = dom.window.document;
    if (!document.querySelectorAll(Selectors.page)?.length) {
      throw new Error("Invalid Page.");
    }
    if (!document.querySelectorAll(Selectors.auth)?.length) {
      throw new Error("Unauthorized.");
    }
    const imageElements = document.querySelectorAll<HTMLImageElement>(
      Selectors.images
    );
    if (!imageElements?.length) {
      throw new Error("Forbidden.");
    }

    const imageList: (string | null)[] = [];
    imageElements.forEach((e) => {
      imageList.push(e.getAttribute("src"));
    });
    return imageList;
  }

  private async downloadImage(
    chapterName: string,
    imageUri: string,
    imageName?: string
  ) {
    const res = await this.axios.get<Stream>(imageUri, {
      responseType: "stream",
    });
    if (!res?.data) {
      throw new Error("Image Request Failed");
    }
    const filenameMatch = imageUri.match(/[^./]+\.[^.]+$/);
    const filename = imageName ?? filenameMatch?.[0];
    if (filename) {
      const writePath = path.join(
        this.destination,
        this.title,
        chapterName,
        filename
      );
      const writer = fs.createWriteStream(writePath);
      res.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on("finish", resolve);
        writer.on("error", (err) => {
          console.error(err);
          reject();
        });
      });
    }
    throw new Error("Cannot Detect Filename.");
  }

  private async downloadSegment(name: string, segment: (string | null)[]) {
    const reqs = segment.map((e) =>
      e ? this.downloadImage(name, e) : Promise.reject()
    );
    const res = await Promise.allSettled(reqs);
    return res.filter((e) => e.status === "rejected");
  }

  /**
   * Download and write all images from a chapter
   * @param name Chapter name
   * @param uri Chapter uri
   */
  async downloadChapter(name: string, uri?: string | null) {
    if (!uri) throw new Error("Invalid Chapter Uri");
    if (!this.axios.defaults.baseURL) {
      this.detectBaseUrl(uri);
    }
    const imgList = await this.getImageList(uri);
    if (!imgList?.length) {
      throw new Error("Cannot get image list.");
    }
    const chapterWritePath = path.join(this.destination, this.title, name);
    if (!fs.existsSync(chapterWritePath)) {
      fs.mkdirSync(chapterWritePath, { recursive: true });
    }
    const step = this.configs?.batchSize ?? 10;
    for (let i = 0; i < imgList.length; i += step) {
      const failed = await this.downloadSegment(
        name,
        imgList.slice(i, Math.min(i + step, imgList.length))
      );
      if (failed?.length) {
        this.log(
          `Failed: Chapter ${name} - ${failed.length} images not downloaded`
        );
      }
    }
    this.log(`Finished Chapter: ${name}`);
  }

  /**
   * Download the entire series
   * @param url Serie Url
   * @param start Starting chapter index (default to 0, included)
   * @param end Ending chapter index (default to chapters.length, included)
   */
  async downloadSerie(url: string, start?: number, end?: number) {
    this.detectBaseUrl(url);
    const chapters = await this.getChapterList(url);
    for (const chapter of chapters.slice(
      start ?? 0,
      end ? end + 1 : chapters.length
    )) {
      await this.downloadChapter(chapter.name, chapter.uri);
    }
    this.log("Download Success.");
  }
}
