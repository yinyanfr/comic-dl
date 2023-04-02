/**
 * MIT License
 * Copyright (c) 2023 Yan
 */

import axios from 'axios';
import type { AxiosInstance } from 'axios';
import fs from 'node:fs';
import path from 'node:path';
import type { ReadStream } from 'node:fs';
import archiver from 'archiver';
import yesno from 'yesno';
import { formatImageName, isString } from './lib';
import mime from 'mime-types';

const ComicInfoFilename = 'ComicInfo.xml';

export default abstract class ComicDownloader {
  static readonly siteName: string;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  static canHandleUrl(url: string): boolean {
    return false;
  }

  static readonly preferredCLIPresets: Partial<CliOptions> = {};

  protected axios: AxiosInstance;

  constructor(protected destination: string, protected configs: Configs = {}) {
    this.axios = axios.create({
      timeout: configs.timeout ?? 10000,
      headers: {
        Cookie: configs.cookie,
        ...(configs.headers || {}),
      },
    });
  }

  get baseUrl() {
    return this.axios.defaults.baseURL;
  }

  set baseUrl(url: string | undefined) {
    this.axios.defaults.baseURL = url;
  }

  /**
   * -------------------------------------------------
   * For children
   */

  /**
   * Get title and chapter list
   * @param url Series Url
   * @returns Promise, title and list of chapters with array index, name and url
   */
  abstract getSerieInfo(url: string): Promise<SerieInfo>;

  /**
   *
   * @param url
   * @param options the options from Chapter
   * @returns list of string or null
   */
  protected abstract getImageList(
    url: string,
    options?: Record<string, any>,
  ): Promise<(string | null)[]>;

  /**
   * End for children
   * -------------------------------------------------
   */

  protected log(content: string) {
    if (this.configs.verbose || !this.configs.silence) {
      console.log(content);
    }
  }

  protected generateComicInfoXMLString(info: ComicInfo) {
    // TODO: find a reliable module for possible more complicated structures
    const identifier = `<?xml version="1.0"?>`;
    const open = `<ComicInfo xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">`;
    const close = '</ComicInfo>';
    const content = Object.keys(info)
      .map(key => `\t<${key}>${info[key]?.replace?.('\n', '')}</${key}>`)
      .join('\n');
    return `${identifier}\n${open}\n${content}\n${close}\n`;
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function, @typescript-eslint/no-unused-vars
  protected detectBaseUrl(url: string): void {}

  setConfig(key: keyof typeof this.configs, value: any) {
    this.configs[key] = value;
  }

  setConfigs(configs: Record<keyof typeof this.configs, any>) {
    // Will merge
    this.configs = { ...this.configs, ...configs };
  }

  async writeComicInfo(serie: SerieInfo, options: WriteInfoOptions) {
    if (serie.info) {
      const xmlString = this.generateComicInfoXMLString(serie.info);
      const chapterPath = path.join(
        isString(options.output)
          ? (options.output as string)
          : this.destination,
        options.rename ?? serie.title,
      );
      if (!fs.existsSync(chapterPath)) {
        fs.mkdirSync(chapterPath, { recursive: true });
      }
      const writePath = path.join(
        chapterPath,
        options.filename ?? ComicInfoFilename,
      );
      await fs.promises.writeFile(writePath, xmlString);
      this.log(`Written: ${writePath}`);
    }
  }

  protected async downloadImage(
    chapterName: string,
    imageUri: string,
    options: ImageDownloadOptions = {},
  ) {
    const res = await this.axios.get<ReadStream>(imageUri, {
      responseType: 'stream',
    });
    if (!res?.data) {
      throw new Error('Image Request Failed');
    }
    const ext = mime.extension(res.headers['content-type']);
    const filenameMatch = imageUri.match(/[^./]+\.[^.]+$/);
    const filename = options?.imageName
      ? `${options.imageName}.${ext ?? 'jpg'}`
      : filenameMatch?.[0];

    if (filename) {
      if (options?.archive) {
        options.archive.append(res.data, { name: filename });
        return Promise.resolve();
      } else {
        const writePath = path.join(
          this.destination,
          options?.title ? 'Untitled' : '.',
          chapterName,
          filename,
        );
        const writer = fs.createWriteStream(writePath);
        res.data.pipe(writer);
        return new Promise((resolve, reject) => {
          writer.on('finish', resolve);
          writer.on('error', err => {
            if (this.configs?.verbose) {
              console.error(err);
            }
            reject();
          });
        });
      }
    } else {
      throw new Error('Cannot Detect Filename.');
    }
  }

  protected async downloadSegment(
    name: string,
    segment: (string | null)[],
    options: SegmentDownloadOptions = {},
  ) {
    const reqs = segment.map((e, i) =>
      e
        ? this.downloadImage(name, e, {
            title: options.title,
            archive: options.archive,
            imageName: formatImageName((options.offset ?? 0) + i + 1),
          })
        : Promise.reject(),
    );
    const res = await Promise.allSettled(reqs);
    return res.filter(e => e.status === 'rejected');
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
    options: ChapterDownloadOptions = {},
    chapterOptions: Record<string, any> = {},
  ) {
    if (!uri) {
      options?.onProgress?.({
        index: options?.index,
        name,
        uri,
        status: 'failed',
      });
      throw new Error('Invalid Chapter Uri');
    }
    if (!this.axios.defaults.baseURL) {
      this.detectBaseUrl(uri);
    }
    const imgList = await this.getImageList(uri, chapterOptions);
    if (!imgList?.length) {
      options?.onProgress?.({
        index: options?.index,
        name,
        uri,
        status: 'failed',
      });
      throw new Error('Cannot get image list.');
    }
    const chapterWritePath = path.join(
      this.destination,
      options?.title ? options.title : '.',
      this.configs?.archive ? '.' : name,
    );
    if (!fs.existsSync(chapterWritePath)) {
      fs.mkdirSync(chapterWritePath, { recursive: true });
    }

    const archive = this.configs?.archive
      ? archiver('zip', { zlib: { level: this.configs?.zipLevel ?? 5 } })
      : undefined;

    const skippedProgress = {
      index: options?.index,
      name,
      status: 'skipped' as const,
      failures: 0,
    };

    if (this.configs?.archive) {
      const archiveWritePath = path.join(
        chapterWritePath,
        `${name}.${this.configs?.archive === 'cbz' ? 'cbz' : 'zip'}`,
      );
      if (!options.override && fs.existsSync(archiveWritePath)) {
        this.log(
          `Skipped: ${options?.index} - ${name} has already been downloaded`,
        );
        return skippedProgress;
      } else {
        const archiveStream = fs.createWriteStream(archiveWritePath);
        archive?.pipe(archiveStream);
      }
    } else {
      if (!options.override && fs.existsSync(chapterWritePath)) {
        this.log(
          `Skipped: ${options?.index} - ${name} has already been downloaded`,
        );
        return skippedProgress;
      }
    }

    let failures = 0;
    const step = this.configs?.batchSize ?? 10;
    for (let i = 0; i < imgList.length; i += step) {
      const failed = await this.downloadSegment(
        name,
        imgList.slice(i, Math.min(i + step, imgList.length)),
        {
          offset: i,
          title: options?.title,
          archive,
        },
      );
      if (failed?.length) {
        failures += failed.length;
        this.log(
          `Failed: Chapter ${name} - ${failed.length} images not downloaded`,
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
          xmlString,
        );
      }
    }

    archive?.finalize();
    this.log(`Saved Chapter: [${options?.index}] ${name}`);
    const progress = {
      index: options?.index,
      name,
      status: 'completed' as const,
      failed: failures,
      options: chapterOptions,
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
    this.log(`Found ${serie.title}`);
    this.log(`Chapters Count: ${serie.chapters?.length}`);

    if (options?.confirm || !this.configs.silence) {
      let queue = 'the entire serie';
      if (options.start || options.end) {
        queue = `from ${options.start ?? 0} to ${options.end || 'the end'}`;
      }
      if (options.chapters?.length) {
        queue = `chapters ${options.chapters?.join(', ')}`;
      }
      const ok = await yesno({
        question: `Downloading ${serie.title} to ${this.destination}, ${queue}, Proceed? (Y/n)`,
        defaultValue: true,
      });
      if (!ok) {
        console.log('Abort.');
        return 0;
      }
    }

    this.log('Start Downloading...');
    const summary: DownloadProgress[] = [];
    const start = options.start ?? 0;
    const end =
      options.end !== undefined ? options.end + 1 : serie.chapters.length;

    for (let i = start; i < end; i++) {
      const chapter = serie.chapters[i];
      if (!options.chapters || options.chapters?.includes(i)) {
        const progress = await this.downloadChapter(
          chapter.name,
          chapter.uri,
          {
            index: chapter.index,
            title: options.rename ?? serie.title,
            info: options.info ? serie.info : undefined,
            override: options.override,
            onProgress: options?.onProgress,
          },
          chapter.options,
        );
        summary.push(progress);
      }
    }

    const failed = summary.filter(e => e.failed);
    if (failed.length) {
      this.log(`Download completed with failures.`);
      failed.forEach(e => {
        this.log(`Index: ${e.index}, pages not downloaded: ${e.failed}.`);
      });
      if (options.retry) {
        this.log('Retrying...');
        for (const chapter of failed) {
          await this.downloadChapter(
            chapter.name,
            chapter.uri,
            {
              index: chapter.index,
              title: options.rename ?? serie.title,
              info: options.info ? serie.info : undefined,
              onProgress: options?.onProgress,
            },
            chapter.options,
          );
        }
      }
    } else {
      this.log('Download Success.');
    }
  }
}
