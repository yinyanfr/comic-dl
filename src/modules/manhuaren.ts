import MD5 from "crypto-js/md5";
import { URL } from "url";
import ComicDownloader from "../comic-downloader";

const PrivateKey = "4e0a48e1c0b54041bce9c8f0e036124d";

function generateGSNHash(url: string) {
  const parsed = new URL(url);
  let s = `${PrivateKey}GET`;
  parsed.searchParams.forEach((key) => {
    if (key !== "gsn") {
      s += key;
      const value = parsed.searchParams.get(key);
      if (value) {
        s += encodeURI(value);
      }
    }
  });
  s += PrivateKey;
  return MD5(s);
}

export default class ManhuarenDownloader extends ComicDownloader {
  static readonly siteName = "manhuaren";
  static readonly baseUrl = "http://mangaapi.manhuaren.com";

  constructor(destination: string, configs: Configs) {
    super(destination, configs);
    this.axios.defaults.headers["X-Yq-Yqci"] = '{"le": "zh"}';
    this.axios.defaults.headers["User-Agent"] = "okhttp/3.11.0";
    this.axios.defaults.headers["Referer"] = "http://www.dm5.com/dm5api/";
    this.axios.defaults.headers["clubReferer"] =
      "http://mangaapi.manhuaren.com/";
  }

  getSerieInfo(url: string): Promise<SerieInfo> {
    throw new Error("Method not implemented.");
  }
  protected getImageList(url: string): Promise<(string | null)[]> {
    throw new Error("Method not implemented.");
  }
}
