/**
 * MIT License
 * Copyright (c) 2023 Yan
 */

import { cap1 } from './lib';

export function indexDts(name: string) {
  return `declare namespace ${cap1(name)}API {
  
  }
  `;
}

export function indexTs(name: string) {
  return `/// <reference path="./index.d.ts" />

  import ComicDownloader from "../../core";
  
  export default class ${cap1(name)}Downloader extends ComicDownloader {
    static readonly siteName = "${name}";
  
    static canHandleUrl(url: string): boolean {
      return /${name}/.test(url);
    }

    static readonly preferredCLIPresets: Partial<CliOptions> = {};

    static urlCompletion(shorthandUrl: string): string {
      return shorthandUrl;
    }

    constructor(protected destination: string, protected configs: Configs = {}) {
      super(destination, configs);
    }
  
    async getSerieInfo(url: string): Promise<SerieInfo> {
      throw new Error("Method not implemented.");
    }
    protected async getImageList(url: string): Promise<(string | null)[]> {
      throw new Error("Method not implemented.");
    }
  }
  `;
}

export function exportDefault(name: string) {
  return `export { default as ${cap1(name)}Downloader } from "./ganma";`;
}
