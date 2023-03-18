import axios from "axios";
import type { AxiosInstance } from "axios";
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";
import type { ReadStream } from "node:fs";
import archiver from "archiver";
import type { Archiver } from "archiver";
import yesno from "yesno";
import { isString } from "./lib";

const Selectors = {
  chapters: ".uk-grid-collapse .muludiv a",
  page: ".wp",
  auth: ".jameson_manhua",
  images: ".uk-zjimg img",
  tags1: "div.cl > a.uk-label",
  tags2: "div.cl > span.uk-label",
};

const ComicInfoFilename = "ComicInfo.xml";

export default class ZeroBywDownloader {
  private axios: AxiosInstance;

  constructor(private destination: string, private configs: Configs = {}) {
    this.axios = axios.create({
      timeout: configs.timeout ?? 10000,
      headers: {
        Cookie: configs.cookie,
        ...(configs.headers || {}),
      },
    });
  }

  private log(content: string) {
    if (this.configs.verbose || !this.configs.silence) {
      console.log(content);
    }
  }

  private generateComicInfoXMLString(info: ComicInfo) {
    // the xml module somehow doesn't work as intended
    // TODO: find a reliable module for possible more complicated structures
    const identifier = `<?xml version="1.0"?>`;
    const open = `<ComicInfo xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">`;
    const close = "</ComicInfo>";
    const content = Object.keys(info)
      .map((key) => `\t<${key}>${info[key]?.replace?.("\n", "")}</${key}>`)
      .join("\n");
    return `${identifier}\n${open}\n${content}\n${close}\n`;
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
  async getSerieInfo(
    url: string,
    options: SerieInfoOptions = {}
  ): Promise<SerieInfo> {
    const res = await this.axios.get<string>(url);
    if (!res?.data) throw new Error("Request Failed.");

    const dom = new JSDOM(res.data);
    const document = dom.window.document;
    const info: ComicInfo = { Manga: "YesAndRightToLeft", Web: url };

    const title =
      document.querySelector("title")?.textContent?.replace(/[ \s]+/g, "") ??
      "Untitled";
    info.Serie = title;
    this.log(`Found ${title}.`);

    const chapterElements = document.querySelectorAll<HTMLAnchorElement>(
      Selectors.chapters
    );

    const chapters: Chapter[] = [];
    chapterElements.forEach((e, i) => {
      chapters.push({
        index: i,
        name: e.textContent ?? `${i}`,
        uri: (e.getAttribute("href") as string) ?? undefined,
      });
    });
    info.Count = chapters.length;
    this.log(`Chapter Length: ${chapters.length}`);

    const tagGroup1 = document.querySelectorAll<HTMLAnchorElement>(
      Selectors.tags1
    );
    const tags: string[] = [];
    tagGroup1?.forEach((tag, i) => {
      if (i == 0) {
        // plugin.php?id=jameson_manhua&a=zz&zuozhe_name=陈某
        const match = tag.getAttribute("href")?.match(/zuozhe_name=(.+)$/);
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
      info.Tags = tags.join(",");
    }

    const tagGroup2 = document.querySelectorAll<HTMLSpanElement>(
      Selectors.tags2
    );
    const lang = tagGroup2[0]?.textContent;
    info.Language = lang === "全生肉" ? "jp" : "zh";
    info.Location = tagGroup2[1]?.textContent ?? undefined;
    const status = tagGroup2[2]?.textContent;
    if (status === "连载中") {
      info.Status = "Ongoing";
    }
    if (status === "已完结") {
      info.Status = "End";
    }

    const summary = document.querySelector("li > div.uk-alert");
    info.Summary = summary?.textContent ?? undefined;

    const serieInfo: SerieInfo = {
      title: this.configs?.maxTitleLength
        ? title.slice(0, this.configs?.maxTitleLength)
        : title,
      chapters,
      info,
    };
    if (options.output) {
      const xmlString = this.generateComicInfoXMLString(info);
      const chapterPath = path.join(
        isString(options.output)
          ? (options.output as string)
          : this.destination,
        options.rename ?? title
      );
      if (!fs.existsSync(chapterPath)) {
        fs.mkdirSync(chapterPath, { recursive: true });
      }
      const writePath = path.join(
        chapterPath,
        options.filename ?? ComicInfoFilename
      );
      await fs.promises.writeFile(writePath, xmlString);
      this.log(`Written: ${writePath}`);
    }

    return serieInfo;
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
   * @returns DownloadProgress
   */
  async downloadChapter(
    name: string,
    uri?: string,
    options: ChapterDownloadOptions = {}
  ) {
    if (!uri) {
      options?.onProgress?.({
        index: options?.index,
        name,
        uri,
        status: "failed",
      });
      throw new Error("Invalid Chapter Uri");
    }
    if (!this.axios.defaults.baseURL) {
      this.detectBaseUrl(uri);
    }
    const imgList = await this.getImageList(uri);
    if (!imgList?.length) {
      options?.onProgress?.({
        index: options?.index,
        name,
        uri,
        status: "failed",
      });
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
      ? archiver("zip", { zlib: { level: this.configs?.zipLevel ?? 5 } })
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

    if (options.info) {
      const xmlString = this.generateComicInfoXMLString(options.info);
      if (archive) {
        archive.append(xmlString, { name: ComicInfoFilename });
      } else {
        await fs.promises.writeFile(
          path.join(chapterWritePath, ComicInfoFilename),
          xmlString
        );
      }
    }

    archive?.finalize();
    this.log(`Saved Chapter: [${options?.index}] ${name}`);
    const progress = {
      index: options?.index,
      name,
      status: "completed" as const,
      failed: failures,
    };
    options?.onProgress?.(progress);

    return progress;
  }

  /**
   * Download from a serie
   * @param url serie url
   * @param options start, end, confirm, onProgress
   */
  async downloadSerie(url: string, options: SerieDownloadOptions = {}) {
    this.detectBaseUrl(url);
    const serie = await this.getSerieInfo(url);

    if (options?.confirm) {
      let queue = "the entire serie";
      if (options.start || options.end) {
        queue = `from ${options.start ?? 0} to ${options.end || "the end"}`;
      }
      if (options.chapters?.length) {
        queue = `chapters ${options.chapters?.join(", ")}`;
      }
      const ok = await yesno({
        question: `Downloading ${serie.title} to ${this.destination}, ${queue}, Proceed? (Y/n)`,
        defaultValue: true,
      });
      if (!ok) {
        console.log("Abort.");
        return 0;
      }
    }

    this.log("Start Downloading...");
    const summary: DownloadProgress[] = [];
    const start = options.start ?? 0;
    const end =
      options.end !== undefined ? options.end + 1 : serie.chapters.length;

    for (let i = start; i < end; i++) {
      const chapter = serie.chapters[i];
      if (!options.chapters || options.chapters?.includes(i)) {
        const progress = await this.downloadChapter(chapter.name, chapter.uri, {
          index: chapter.index,
          title: options.rename ?? serie.title,
          info: options.info ? serie.info : undefined,
          onProgress: options?.onProgress,
        });
        summary.push(progress);
      }
    }

    const failed = summary.filter((e) => e.failed);
    if (failed.length) {
      this.log(`Download completed with failures.`);
      failed.forEach((e) => {
        this.log(`Index: ${e.index}, pages not downloaded: ${e.failed}.`);
      });
      if (options.retry) {
        this.log("Retrying...");
        for (const chapter of failed) {
          await this.downloadChapter(chapter.name, chapter.uri, {
            index: chapter.index,
            title: options.rename ?? serie.title,
            info: options.info ? serie.info : undefined,
            onProgress: options?.onProgress,
          });
        }
      }
    } else {
      this.log("Download Success.");
    }
  }
}
