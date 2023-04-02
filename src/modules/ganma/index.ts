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

  constructor(protected destination: string, protected configs: Configs = {}) {
    super(destination, configs);
  }

  async getSerieInfo(url: string): Promise<SerieInfo> {
    throw new Error('Method not implemented.');
  }
  protected async getImageList(url: string): Promise<(string | null)[]> {
    throw new Error('Method not implemented.');
  }
}
