# zerobyw-dl

[![npm](https://img.shields.io/npm/v/zerobyw-dl.svg)](https://www.npmjs.com/package/zerobyw-dl)
![license](https://img.shields.io/npm/l/zerobyw-dl.svg)
![size](https://img.shields.io/github/repo-size/yinyanfr/zerobyw-dl)

又一个用于 Zero 搬运网 [zerobyw](https://zerobyw.github.io/) 的批量下载器。

本工具不适用于浏览器。

[English Documentation](https://github.com/yinyanfr/zerobyw-dl/blob/main/README.en.md)

## :star2: 特性

- 提供命令行工具
- 查看章节列表和漫画信息
- 下载为图片，或压缩包（ZIP 或 CBZ）
- 报告下载进度
- 生成 [ComicInfo.xml](https://anansi-project.github.io/docs/comicinfo/intro)

## :framed_picture: 示例

### 查看章节列表

![List of chapters](asset/ls.png)

### 下载漫画

![Downloading](asset/dl.png)

## :green_book: 快速开始

需要 Node.js (LTS 或当前版本) 以运行此工具.

```bash
npm i zerobyw-dl
# or
# CLI
npx zerobyw-dl help
```

## :wrench: 命令行工具

```
用法：zerobyw-dl [选项] [命令]

命令：
  chapter, c, ch 从一章节下载图片。
  download, d, dl 从漫画系列下载章节。
  help 显示帮助信息
  list, l, ls 列出漫画系列的所有章节。
  version 显示版本号

选项：
  -a, --archive 可选：按章节输出 zip 或 cbz 归档文件。
  -b, --batch 可选：同时下载的图片数量，默认为 10。
  -C, --chapters 可选：仅下载指定的章节列表，示例：-C 1,2,4,7
  -c, --cookie 可选（但建议使用）：提供包含 cookie 的文本文件的路径。
  -f, --from 可选：在下载系列时设置起始章节，默认为 0。
  -h, --help 显示帮助信息
  -i, --info 可选：生成 ComicInfo.xml。
  -m, --max-title-length 可选：将标题长度限制为文件夹名称。
  -n, --name 可选：提供系列标题并覆盖文件夹名称。
  -o, --output 可选：下载文件保存的路径（默认为当前目录）。在使用列表时设置此标志将在路径中保存 ComicInfo.xml。
  -r, --retry 可选：自动重新下载下载失败的章节。
  -s, --slience 可选：静默输出控制台。
  -T, --timeout 可选：覆盖默认的 10 秒请求超时时间。
  -t, --to 可选：在下载系列时设置结束章节，默认为 chapter.length - 1。
  -u, --url 系列或章节的 URL。
  -v, --verbose 可选：显示详细的错误消息，覆盖静默。
  -V, --version 显示版本号
  -y, --yes 可选：跳过下载系列时的确认提示。
  -z, --zip-level 可选：归档 zip 的级别，默认为 5。

示例：
  - 从第 10 章到第 20 章下载一个系列到指定目的地，按章节输出 zip 归档文件，并生成 ComicInfo.xml，自动重新下载下载失败的章节。
  $ npx zerobyw-dl dl -c cookie.txt -f 10 -t 20 -o ~/Download/zerobyw -a zip -r -i -u serie_url

  - 列出给定系列的所有章节。
  $ npx zerobyw-dl ls -u serie_url

  - 下载名为Chapter1的章节到当前目录。
  $ npx zerobyw-dl ch -n Chapter1 -u chapter_url -c cookie.txt
```

## :book: 库

### 初始化下载器

```typescript
import ZeroBywDownloader from "zerobyw-dl";

// 下载文件的路径
const destination = "~/Download/zerobyw";
// 配置文件
const configs = {
  // 从您的浏览器的网络检查器中获取Cookie
  // 可选项，但强烈建议使用，因为ZeroByw部分内容对非付费用户进行了阻止
  cookie: "your_cookie",
  // 请求超时时间（可选，默认为10秒）
  timeout: 10000,
  // 禁止在控制台输出日志（可选）
  silence: false,
  // 同时下载的图像数量（可选，默认为10）
  batchSize: 10,
  // 显示详细的错误消息，将覆盖silence（可选）
  verbose: false,
  // 将输出按章节分组的zip或cbz存档文件（可选）
  archive: "zip",
  // HTTP请求的附加标头（在内部使用axios）（可选）
  headers: {},
  // 限制标题的长度，在文件系统具有此限制的情况下使用（可选，默认为undefined）
  maxTitleLength: 30,
  // 档案的压缩级别 (可选: 默认为5)
}; // 可选

const downloader = new ZeroBywDownloader(destination, configs);
```

### :scroll: 获取漫画信息

```typescript
const options = {
  output: "output_path", // 可选。设置这个来写一个ComicInfo.xml到路径上，使用true来输出到继承的目标文件夹中。
  // 默认情况下，文件被下载到 destination/serie_title/ComicInfo.xml。
  rename: "serie_title", // 可选。覆盖serie title文件夹的名称
  filename: "ComicInfo.xml", // Optional: 覆盖默认的文件名
};

const info = await downloader.getSerieInfo("serie_url");
// info
// {
//   title: "Serie Title",
//   chapters: [{
//     index: 0,
//     name: "Chapter Name",
//     uri: "chapter_uri", // 不含 baseUrl
//   }],
//   info: {} // 参见 ComicInfo 的文档
// }
```

### :books: 下载漫画

```typescript
const options = {
  start: 10, // 可选。起始章节，包括在内，默认为0
  end: 20, // 可选。结束的章节，包括在内，默认为最后一个（长度-1）。
  confirm: false, // 可选。在开始下载之前，启动一个控制台提示，要求用户确认，默认为false
  rename: undefined, // 可选。改变文件夹的名称，默认为未定义
  retry: false, // 可选。自动重新下载有失败图片的章节。
  info: true, // 可选。生成ComicInfo.xml，默认为**false**。
  chapters: 未定义, // 可选。自动重新下载有失败图片的章节。
  onProgress: (progress) => {
    console.log(progress);
  }, // 可选。当一个章节被下载或下载失败时被调用
}; // 可选的

// progress
// {
//   index: 0, // 章节序号
//   name: "Chapter Name",
//   uri: "chapter_uri",
//   status: "completed", // 或 "failed"
//   failed: 1, // 未能下载的图像数量
//   // 状态完成，因为下载队列被清除了，即使有失败的图像。
// }

// 下载一个系列的所有章节
await downloader.downloadSerie("serie_url");

// 下载从第10章到第20章（共11章）。
await downloader.downloadSerie("serie_url", options);
```

### :bookmark: 下载单个章节

```typescript
const options = {
  index: 0, // 章节索引
  title: "系列标题"。
  info: ComicInfo, // 可选。生成 ComicInfo.xml，请参考 ComicInfo的文档。
  onProgress: (progress) => {}, // 可选。当一个章节被下载或下载失败时被调用，与serie选项中相同
}; // 可选的

await downloader.downloadChapter(
  "Chapter Name",
  "chapter_url_with_base",
  options
);
```

### :pencil2: 修改配置

```typescript
// 改变一个配置
downloader.setConfig("archive", "cbz")。
// 合并配置
downloader.setConfigs({ archive: "cbz" }); // 将合并配置。
```

## :information_source: 信息

- [ComicInfo.xml 文档](https://anansi-project.github.io/docs/comicinfo/intro)
