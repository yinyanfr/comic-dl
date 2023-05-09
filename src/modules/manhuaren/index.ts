/// <reference path="./index.d.ts" />

  import ComicDownloader from "../../core";
  
  export default class ManhuarenDownloader extends ComicDownloader {
    static readonly siteName = "manhuaren";
  
    static canHandleUrl(url: string): boolean {
      return /manhuaren/.test(url);
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
  