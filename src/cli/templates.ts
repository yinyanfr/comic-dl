/**
 * MIT License
 * Copyright (c) 2023 Yan
 */

import { capitalizeFirstLetter } from "../lib";

export function indexDts(name: string) {
  return `declare namespace ${capitalizeFirstLetter(name)}API {
  
  }
  `;
}

export function indexTs(name: string) {
  return `/// <reference path="./index.d.ts" />

  import ComicDownloader from "../../comic-downloader";
  
  export default class ${capitalizeFirstLetter(
    name
  )}Downloader extends ComicDownloader {
    static readonly siteName = "${name}";
  
    static canHandleUrl(url: string): boolean {
      return /${name}/.test(url);
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
  return `export { default as ${capitalizeFirstLetter(
    name
  )}Downloader } from "./ganma";`;
}
