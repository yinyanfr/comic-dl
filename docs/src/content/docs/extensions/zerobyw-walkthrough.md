---
title: 动手制作 Zerobyw 扩展
description: 用 Zerobyw 的脱敏页面写一个可离线运行的扩展，再对照正式实现添加会话、搜索和测试。
---

本教程从 Zerobyw 的作品页和阅读页出发，写一个能列章、下载并生成 CBZ 的扩展。前半段只读本地样本，不需要账号或连接漫画站；后半段对照[正式扩展源码](https://github.com/yinyanfr/comic-dl/blob/main/extensions/zerobyw/src/index.ts)，了解如何换成真实请求。

## 1. 从链接提取作品和章节 ID

使用 Node.js 24。在仓库根目录安装依赖、构建 CLI，并创建一个练习目录。这里直接写 `.mjs`，用仓库 workspace 安装的 Cheerio 解析 HTML。

```sh
npm ci
npm run build
workshop="$(mktemp -d ./zerobyw-workshop.XXXXXX)"
```

在 `$workshop` 下创建 `source.mjs`，写入下面的代码。作品页的 `kuid` 是作品 ID，阅读页的 `zjid` 是章节 ID。保留站点 ID 作为字符串，章节改名或调整顺序时也能定位同一章。

```js
import { load } from 'cheerio/slim';
import { Buffer } from 'node:buffer';

const origin = 'https://www.zerobyw33.com';
const sourceId = 'zerobyw-workshop';

function idFromUrl(url, kind) {
  if (!url || url.origin !== origin || url.username || url.password) return;
  const path = kind === 'series' ? '/pc/details/' : '/pc/view/';
  if (url.pathname !== path && url.pathname !== `${path}index.php`) return;
  const id = url.searchParams.get(kind === 'series' ? 'kuid' : 'zjid');
  if (id && /^[1-9]\d*$/.test(id)) return id;
}
```

正式扩展的 `siteUrl`、`pageId` 和 `requestUrl` 共用这套识别规则：`matchesUrl` 只检查地址，不发请求；实际读取入口再次验证输入，再构造规范 URL。正式实现还会把已识别站点的 HTTP 链接转换为 HTTPS。

## 2. 从样本 HTML 构造章节和页面

继续把下面的代码追加到同一个文件。练习里的作品 `1` 有一章 `101`；阅读器用 `data-src` 指定实际图片，`src` 是占位图。这里用一张内嵌 GIF 代替真实图片响应。

```js
const workId = '1';
const seriesHtml = `
  <section>
    <header><h2>章节列表</h2></header>
    <div><a href="/pc/view/index.php?zjid=101">开篇</a></div>
  </section>`;
const readerHtml = `
  <div id="image-container">
    <img class="manga-image" data-src="/images/cover.gif" src="/placeholder.gif">
  </div>`;
const image = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

function chaptersFromSample() {
  const $ = load(seriesHtml);
  return $('h2')
    .parent()
    .next()
    .find('a[href]')
    .toArray()
    .map((link) => {
      const id = idFromUrl(new URL($(link).attr('href'), origin), 'chapter');
      if (!id) throw new Error('Invalid chapter link');
      return {
        id,
        title: $(link).text().trim(),
        async getPages(signal) {
          signal.throwIfAborted();
          const reader = load(readerHtml);
          const src = reader('#image-container img.manga-image').attr(
            'data-src',
          );
          if (src !== '/images/cover.gif')
            throw new Error('Missing sample image');
          return [
            {
              id: `1:${src}`,
              extension: 'gif',
              async read(signal) {
                signal.throwIfAborted();
                return image;
              },
            },
          ];
        },
      };
    });
}
```

`chaptersFromSample` 只解析章节列表。CLI 执行 `list` 时不会调用 `getPages()`；下载时才读取阅读页，再调用 `Page.read()` 获取图片字节。扩展负责返回正确顺序，CBZ 打包由核心负责。

## 3. 注册扩展并用 CLI 验证

在文件末尾加上 API v1 的默认导出。`getSeries` 和 `getChapter` 复用同一批稳定 ID：从作品列表下载与从章节直链下载时，核心才能识别已有归档。

```js
/** @type {import('comic-dl/extension').SourceExtension} */
const extension = {
  apiVersion: 1,
  id: sourceId,
  matchesUrl(url, kind) {
    return idFromUrl(url, kind) !== undefined;
  },
  create() {
    return {
      id: sourceId,
      async getSeries(input, signal) {
        signal.throwIfAborted();
        if (idFromUrl(URL.parse(input), 'series') !== workId) {
          throw new Error('Expected sample work 1');
        }
        return { id: workId, chapters: chaptersFromSample() };
      },
      async getChapter(input, signal) {
        signal.throwIfAborted();
        const id = idFromUrl(URL.parse(input), 'chapter');
        const chapter = chaptersFromSample().find((item) => item.id === id);
        if (!chapter) throw new Error('Expected sample chapter 101');
        return { workId, chapter };
      },
    };
  },
};

export default extension;
```

在同一个终端、从仓库根目录依次运行。因为练习扩展和正式扩展识别同一站点，这里用 `--source` 选中练习版本。

```sh
work_url='https://www.zerobyw33.com/pc/details/?kuid=1'
chapter_url='https://www.zerobyw33.com/pc/view/index.php?zjid=101'
node dist/index.js sources --extension "$workshop/source.mjs"
node dist/index.js list "$work_url" --extension "$workshop/source.mjs" --source zerobyw-workshop
node dist/index.js chapter "$chapter_url" --extension "$workshop/source.mjs" --source zerobyw-workshop -o "$workshop/output"
node dist/index.js download "$work_url" --extension "$workshop/source.mjs" --source zerobyw-workshop -o "$workshop/output"
```

预期：源列表有 `zerobyw-workshop`；`list` 输出 ID `101` 和标题 `开篇`；`chapter` 生成一个包含 `1.gif` 的 CBZ；最后一次 `download` 显示 `1 skipped`。

## 4. 对照正式扩展接入真实站点

打开[正式扩展源码](https://github.com/yinyanfr/comic-dl/blob/main/extensions/zerobyw/src/index.ts)，按下面的顺序把练习中的固定样本换成站点实现。

1. **建立两套 HTTP 读取器。** 在 `createZerobywSource` 里用 `api.createSourceHttp` 初始化 `readHtml` 和 `readImage`。从 `COMIC_DL_ZEROBYW_COOKIE` 读取会话；`document()` 仅在读取作品详情页或阅读页时为指定站点 Origin 附加 Cookie。公开搜索和图片请求保持匿名。
2. **还原完整章节列表。** 在 `getSeries` 中确认详情页的登录状态与作品 ID，再从「章节列表」按页面顺序提取卡片。可读卡片的 ID 来自链接；明确标记为 VIP 且无链接的卡片才从 `mangaDownloadChapters` 补 ID。需要校对列表长度、标题以及可读卡片的 ID，避免把相邻章节配错。脚本中的数据用 `JSON.parse` 读取，不执行网页脚本。
3. **读取有序页面。** `readChapter` 用面包屑和 `localTranslate` 交叉检查作品、章节身份。图片优先取 `data-src`，其次取 `src`；相对地址按响应的最终 URL 解析。校验图片 Origin、格式和页数。有 `data-page-index` 时校验重复、缺失和越界后排序，否则保留 DOM 顺序。给 page ID 用页序和 URL 的路径等稳定字段，去掉可能变化的签名查询参数。重试时重新读取阅读页，避免复用过期图片链接。
4. **区分访问受限与失败。** 只有站点明确表示章节为 VIP 专属时才用注入的 `api.RestrictedChapterError`。series 中已经确认受限的章节仍可列出，调用该章的 `getPages()` 时再报告受限。会话过期、未知 `403`、缺页或解析失败是普通失败。HTTP 助手会把可重试的网络故障标记为暂态错误，下载服务负责重试。
5. **最后加入公开搜索。** `search(query, page, signal)` 对 `/pc/pc/` 设置 `keyword` 和 `page`，解析链接和标题，按作品 ID 去重。返回 `{ results, hasNext }`；每项的 URL 都应能直接交给 `getSeries()`。空关键词用于浏览目录，`hasNext` 由目录中的下一页链接决定。

## 5. 用离线回归验证，再打包

运行正式扩展的回归测试：

```sh
npm test --workspace @comic-dl/zerobyw
```

[测试源码](https://github.com/yinyanfr/comic-dl/blob/main/extensions/zerobyw/test/zerobyw.test.js)用回环 HTTP 服务模拟站点和图片主机。写自己的扩展时，可以沿用三组断言：`list` 返回预期的稳定 ID 和阅读顺序；单章与系列路径使用同一归档身份且页序正确；Cookie 只到指定站点，受限章节、登录过期和解析失败能区分。还可以加入真实页面变体的脱敏样本，覆盖懒加载、无链接的受限卡片和分页。

练习文件适合用 `--extension` 加载。准备分享时，按[独立打包指南](../develop/#独立打包)改成独立 ESM 包，声明自己的运行时依赖，并用 [API v1 规范](../../specs/source-extension-v1/)核对接口。
