import axios from "axios";
import type { AxiosInstance } from "axios";
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";
import type { Stream } from "node:stream";

interface Configs {
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

export default class ZeroBywDownloader {
  private axios: AxiosInstance;
  private title: string = "Untitled";

  constructor(
    baseURL: string,
    private destination: string,
    private configs: Configs = {}
  ) {
    this.axios = axios.create({
      baseURL,
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
      ".uk-grid-collapse .muludiv a"
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

  async getImageList(url: string) {
    const res = await this.axios.get<string>(url);
    if (!res?.data) throw new Error("Request Failed.");

    const dom = new JSDOM(res.data);
    const document = dom.window.document;
    if (!document.querySelectorAll(".wp")?.length) {
      throw new Error("Invalid Page.");
    }
    if (!document.querySelectorAll(".jameson_manhua")?.length) {
      throw new Error("Unauthorized.");
    }
    const imageElements =
      document.querySelectorAll<HTMLImageElement>(".uk-zjimg img");
    if (!imageElements?.length) {
      throw new Error("Forbidden.");
    }

    const imageList: (string | null)[] = [];
    imageElements.forEach((e) => {
      imageList.push(e.getAttribute("src"));
    });
    return imageList;
  }

  async downloadImage(
    chapterName: string,
    imageUri: string,
    imageName?: string
  ) {
    const writePath = path.join(this.destination, this.title, chapterName);
    if (!fs.existsSync(writePath)) {
      fs.mkdirSync(writePath, { recursive: true });
    }
    const res = await this.axios.get<Stream>(imageUri, {
      responseType: "stream",
    });
    if (!res?.data) {
      throw new Error("Image Request Failed");
    }
    const filenameMatch = imageUri.match(/[^./]+\.[^.]+$/);
    const filename = imageName ?? filenameMatch?.[0];
    if (filename) {
      const writer = fs.createWriteStream(path.join(writePath, filename));
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

  async downloadChapter(name: string, uri?: string | null) {
    if (!uri) throw new Error("Invalid Chapter Uri");
    const imgList = await this.getImageList(uri);
    const step = this.configs?.batchSize ?? 10;
    for (let i = 0; i < imgList.length; i += step) {
      const failed = await this.downloadSegment(
        name,
        imgList.slice(i, Math.min(i + step, imgList.length))
      );
      if (failed?.length) {
        this.log(`Failed: ${failed.length}`);
      }
    }
    this.log(`Finished Chapter: ${name}`);
  }

  async downloadSeries(url: string, start?: number, end?: number) {
    const chapters = await this.getChapterList(url);
    for (const chapter of chapters.slice(start ?? 0, end ?? chapters.length)) {
      await this.downloadChapter(chapter.name, chapter.uri);
    }
    this.log("Download Success.");
  }
}
