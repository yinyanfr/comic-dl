import ComicDownloader from "../../comic-downloader";

export default class DMZJDownloader extends ComicDownloader {
  static readonly siteName = "dmzj";

  getSerieInfo(url: string): Promise<SerieInfo> {
    throw new Error("Method not implemented.");
  }
  protected getImageList(url: string): Promise<(string | null)[]> {
    throw new Error("Method not implemented.");
  }
}
