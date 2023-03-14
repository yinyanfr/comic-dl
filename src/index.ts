import axios from "axios";
import type { AxiosInstance } from "axios";
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";
import type { ReadStream } from "node:fs";
import archiver from "archiver";
import type { Archiver } from "archiver";
import yesno from "yesno";

const Selectors = {
  chapters: ".uk-grid-collapse .muludiv a",
  page: ".wp",
  auth: ".jameson_manhua",
  images: ".uk-zjimg img",
};

export default class ZeroBywDownloader {
  private axios: AxiosInstance;

  constructor(private destination: string, private configs: Configs = {}) {
    this.axios = axios.create({
      timeout: configs?.timeout ?? 10000,
      headers: {
        Cookie: configs?.cookie,
        ...(configs?.headers || {}),
      },
    });
  }

  private log(content: string) {
    if (this.configs?.verbose || !this.configs?.silence) {
      console.log(content);
    }
  }

  private detectBaseUrl(url: string) {
    const match = url.match(/^https?:\/\/[^.]+\.[^/]+/);
    if (match?.[0]) {
      this.axios.defaults.baseURL = match?.[0];
    }
  }

  setConfig(key: keyof typeof this.configs, value: any) {
    this.configs[key] = value;
  }

  setConfigs(configs: Record<keyof typeof this.configs, any>) {
    // Will merge
    this.configs = { ...this.configs, ...configs };
  }

  /**
   * Get title and chapter list
   * @param url Series Url
   * @returns Promise, title and list of chapters with array index, name and url
   */
  async getSerieInfo(url: string) {
    const res = await this.axios.get<string>(url);
    if (!res?.data) throw new Error("Request Failed.");

    const dom = new JSDOM(res.data);
    const document = dom.window.document;
    const title =
      document.querySelector("title")?.innerHTML.replace(/[ \s]+/g, "") ??
      "Untitled";
    this.log(`Found ${title}.`);

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
    return { title, chapters };
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
      throw new Error("Unauthorized: Please log in.");
    }
    const imageElements = document.querySelectorAll<HTMLImageElement>(
      Selectors.images
    );
    if (!imageElements?.length) {
      throw new Error("Forbidden: This chapter requires a VIP user rank.");
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
    options: ImageDownloadOptions = {}
  ) {
    const res = await this.axios.get<ReadStream>(imageUri, {
      responseType: "stream",
    });
    if (!res?.data) {
      throw new Error("Image Request Failed");
    }
    const filenameMatch = imageUri.match(/[^./]+\.[^.]+$/);
    const filename = options?.imageName ?? filenameMatch?.[0];

    if (filename) {
      if (options?.archive) {
        options.archive.append(res.data, { name: filename });
        return Promise.resolve();
      } else {
        const writePath = path.join(
          this.destination,
          options?.title ? "Untitled" : ".",
          chapterName,
          filename
        );
        const writer = fs.createWriteStream(writePath);
        res.data.pipe(writer);
        return new Promise((resolve, reject) => {
          writer.on("finish", resolve);
          writer.on("error", (err) => {
            if (this.configs?.verbose) {
              console.error(err);
            }
            reject();
          });
        });
      }
    } else {
      throw new Error("Cannot Detect Filename.");
    }
  }

  private async downloadSegment(
    name: string,
    segment: (string | null)[],
    title?: string,
    archive?: Archiver
  ) {
    const reqs = segment.map((e) =>
      e ? this.downloadImage(name, e, { title, archive }) : Promise.reject()
    );
    const res = await Promise.allSettled(reqs);
    return res.filter((e) => e.status === "rejected");
  }

  /**
   * Download and write all images from a chapter
   * @param name Chapter name
   * @param uri Chapter uri
   * @param options title, index, onProgress
   */
  async downloadChapter(
    name: string,
    uri?: string | null,
    options: ChapterDownloadOptions = {}
  ) {
    if (!uri) {
      options?.onProgress?.({ index: options?.index, name, status: "failed" });
      throw new Error("Invalid Chapter Uri");
    }
    if (!this.axios.defaults.baseURL) {
      this.detectBaseUrl(uri);
    }
    const imgList = await this.getImageList(uri);
    if (!imgList?.length) {
      options?.onProgress?.({ index: options?.index, name, status: "failed" });
      throw new Error("Cannot get image list.");
    }
    const chapterWritePath = path.join(
      this.destination,
      options?.title ? options.title : ".",
      this.configs?.archive ? "." : name
    );
    if (!fs.existsSync(chapterWritePath)) {
      fs.mkdirSync(chapterWritePath, { recursive: true });
    }
    const archive = this.configs?.archive
      ? archiver("zip", { zlib: { level: 5 } })
      : undefined;

    if (this.configs?.archive) {
      const archiveStream = fs.createWriteStream(
        path.join(
          chapterWritePath,
          `${name}.${this.configs?.archive === "cbz" ? "cbz" : "zip"}`
        )
      );
      archive?.pipe(archiveStream);
    }

    let failures = 0;
    const step = this.configs?.batchSize ?? 10;
    for (let i = 0; i < imgList.length; i += step) {
      const failed = await this.downloadSegment(
        name,
        imgList.slice(i, Math.min(i + step, imgList.length)),
        options?.title,
        archive
      );
      if (failed?.length) {
        failures += failed.length;
        this.log(
          `Failed: Chapter ${name} - ${failed.length} images not downloaded`
        );
      }
    }
    archive?.finalize();
    this.log(`Saved Chapter: [${options?.index}] ${name}`);
    options?.onProgress?.({
      index: options?.index,
      name,
      status: "completed",
      failed: failures,
    });
  }

  /**
   * Download from a serie
   * @param url serie url
   * @param options start, end, confirm, onProgress
   */
  async downloadSerie(url: string, options: SerieDownloadOptions = {}) {
    this.detectBaseUrl(url);
    const info = await this.getSerieInfo(url);

    if (options?.confirm) {
      const ok = await yesno({
        question: `Downloading ${info.title} to ${this.destination}, Proceed? (Y/n)`,
        defaultValue: true,
      });
      if (!ok) {
        console.log("Abort.");
        return 0;
      }
    }

    this.log("Start Downloading...");
    for (const chapter of info.chapters.slice(
      options?.start ?? 0,
      options?.end ? options.end + 1 : info.chapters.length
    )) {
      await this.downloadChapter(chapter.name, chapter.uri, {
        index: chapter.index,
        title: info.title,
        onProgress: options?.onProgress,
      });
    }
    this.log("Download Success.");
  }
}
