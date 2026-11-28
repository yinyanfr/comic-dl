---
title: 动手制作 Zerobyw 扩展
description: 离线实践元数据、可信封面、规范目录与库/CLI 验证，再接入站点设置和认证。
---

本教程使用核心 4.x（扩展 API 仍为 v1），从 Zerobyw 的作品页和阅读页出发，写一个能列章、返回元数据/封面、解析直链规范目录并生成 CBZ 的扩展。前半段只读本地样本，不需要账号或连接漫画站；后半段对照[正式扩展源码](https://github.com/yinyanfr/comic-dl-extensions/blob/main/extensions/zerobyw/src/index.ts)的 `0.3.1` 能力，学习设置、认证和封面安全。示例封面只验证 URL，不实际下载。

## 1. 从链接提取作品和章节 ID

使用 Node.js 24。在核心仓库根目录安装依赖、构建 CLI，再为练习目录单独安装解析 HTML 的 Cheerio。

```sh
npm ci
npm run build
workshop="$(mktemp -d ./zerobyw-workshop.XXXXXX)"
npm install --prefix "$workshop" cheerio@1
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

继续把下面的代码追加到同一个文件。练习里的作品 `1` 有两章 `101/102`；第二章用于验证直链和选章不会被错误编号为 1。阅读器用 `data-src` 指定实际图片，`src` 是占位图。这里用一张内嵌 GIF 代替真实图片响应。

```js
const workId = '1';
const seriesHtml = `
  <h1>示例漫画</h1>
  <span class="author">示例作者</span>
  <p class="summary">只读取本地样本。</p>
  <span class="tag">日常</span>
  <img class="cover" src="http://tupa.zerobyw33.com/covers/1.jpg">
  <section>
    <header><h2>章节列表</h2></header>
    <div>
      <a href="/pc/view/index.php?zjid=101">开篇</a>
      <a href="/pc/view/index.php?zjid=102">第二话</a>
    </div>
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

`chaptersFromSample` 只解析章节列表。CLI 执行 `list` 时不会调用 `getPages()`；下载时才读取阅读页，再调用 `Page.read()` 获取图片字节。扩展负责返回正确顺序，CBZ/ZIP 打包、命名和逐页进度都由核心负责。

继续追加元数据解析。只有显式信任的站点/图片 origin 可以规范化为 HTTPS；修改协议后仍须检查 origin（包括端口），拒绝凭据和查询/片段。不要仅按域名后缀判断，也不要对任意主机升级后直接接受。

```js
const imageOrigin = 'https://tupa.zerobyw33.com';

function publicCover(value) {
  if (!value) return;
  const url = URL.parse(value, origin);
  if (!url) return;
  if (url.protocol === 'http:') url.protocol = 'https:';
  if (
    url.protocol !== 'https:' ||
    ![origin, imageOrigin].includes(url.origin) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    return;
  return url.href;
}

function metadataFromSample() {
  const $ = load(seriesHtml);
  return {
    title: $('h1').text().trim(),
    authors: [$('.author').text().trim()],
    summary: $('.summary').text().trim(),
    tags: $('.tag')
      .toArray()
      .map((node) => $(node).text().trim()),
    coverUrl: publicCover($('.cover').attr('src')),
  };
}
```

正式实现从当前配置构造可信 origin，不是永远硬编码上述两个地址。缺失元数据时省略字段即可，不应影响下载；公共搜索封面直接取卡片，不逐本请求详情。受保护封面另用不含凭据的 `coverId/readCover()`，不要把 Cookie 或 Auth Key 填入 `coverUrl`。

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
        return {
          id: workId,
          metadata: metadataFromSample(),
          chapters: chaptersFromSample(),
        };
      },
      async getChapter(input, signal) {
        signal.throwIfAborted();
        const id = idFromUrl(URL.parse(input), 'chapter');
        const chapter = chaptersFromSample().find((item) => item.id === id);
        if (!chapter) throw new Error('Expected sample chapter 101 or 102');
        return {
          workId,
          chapter,
          seriesInput: new URL(`/pc/details/?kuid=${workId}`, origin).href,
        };
      },
    };
  },
};

export default extension;
```

在同一个终端、从仓库根目录依次运行。若已用 `add` 安装正式扩展，它和练习扩展会识别同一站点；这里用 `--source` 选中练习版本。

```sh
work_url='https://www.zerobyw33.com/pc/details/?kuid=1'
chapter_url='https://www.zerobyw33.com/pc/view/index.php?zjid=102'
node dist/index.js sources --extension "$workshop/source.mjs"
node dist/index.js list "$work_url" --extension "$workshop/source.mjs" --source zerobyw-workshop
node dist/index.js list "$work_url" --extension "$workshop/source.mjs" --source zerobyw-workshop --details
node dist/index.js chapter "$chapter_url" --extension "$workshop/source.mjs" --source zerobyw-workshop -o "$workshop/output" --progress plain
node dist/index.js download "$work_url" --extension "$workshop/source.mjs" --source zerobyw-workshop -c 2-2 -o "$workshop/output"
node dist/index.js download "$work_url" --extension "$workshop/source.mjs" --source zerobyw-workshop -o "$workshop/output"
```

预期：源列表有 `zerobyw-workshop`；`list` 按顺序输出 `101/102`；`--details` 包含元数据和 HTTPS 封面。直链生成 `示例漫画/2-第二话.cbz`，其中包含 `1.gif`；范围 `2-2` 下载显示跳过；最后的整部下载显示 `1 downloaded, 1 skipped`。`--progress plain` 把页数和归档阶段写到标准错误，没有终端控制字符。默认 `auto` 仅在终端显示，重定向保持安静。

核心根据 `seriesInput` 重新读取完整目录并校验身份，所以直链也能得到作品名和第 2 章序号；扩展不需要在单章返回值中伪造位置。

## 4. 用同一个样本验证公开库 API

在 `$workshop` 创建 `verify.mjs`，从仓库根目录运行 `node "$workshop/verify.mjs"`。这里相对导入核心的本地构建是仓库练习路径；独立发布的项目应改用 `import { createDownloader } from 'comic-dl'`。

```js
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createDownloader } from '../dist/library.js';
import extension from './source.mjs';

const app = createDownloader().use(extension);
const input = 'https://www.zerobyw33.com/pc/details/?kuid=1';
const series = await app.list(input);
assert.equal(
  series.metadata.coverUrl,
  'https://tupa.zerobyw33.com/covers/1.jpg',
);
assert.deepEqual(
  series.chapters.map(({ id }) => id),
  ['101', '102'],
);
const events = [];
const task = app.startDownload(
  'https://www.zerobyw33.com/pc/view/index.php?zjid=102',
  {
    direct: true,
    directory: fileURLToPath(new URL('./library-output', import.meta.url)),
    archive: { padding: 3, format: 'zip' },
    onEvent: (event) => events.push(event),
  },
);
await task.done;
assert.equal(task.snapshot()[0].number, 2);
assert.equal(task.snapshot()[0].state, 'downloaded');
assert.ok(
  events.some(
    ({ task }) => task.state === 'reading' && task.pagesDownloaded === 1,
  ),
);
assert.ok(events.some(({ task }) => task.state === 'archiving'));
const [result] = await app.download(input, {
  chapters: ['2-2'],
  directory: fileURLToPath(new URL('./library-output', import.meta.url)),
});
assert.equal(result.status, 'skipped');
assert.equal(result.number, 2);
```

库生成 `示例漫画/002-第二话.zip`；后续使用默认 CBZ 策略仍通过身份识别已有 ZIP。安全任务快照可用于 Web；`result.path/error` 是服务端信息，不直接发给浏览器。取消与重试的完整生命周期见[服务指南](../../guide/service-api/)。

## 5. 对照正式扩展接入真实站点

打开[正式扩展源码](https://github.com/yinyanfr/comic-dl-extensions/blob/main/extensions/zerobyw/src/index.ts)，按下面的顺序把练习中的固定样本换成站点实现。

1. **先声明设置，再建立两套 HTTP 读取器。** `settings` 声明 `site-url/image-url/previous-site-url`，均为无路径、凭据、查询或片段的 HTTPS origin。`matchesUrl` 和 `create(api, settings)` 读取同一配置；旧输入只提供稳定 ID，实际请求重建到当前站点。在 `createZerobywSource` 中初始化 `readHtml/readImage`，用 `allowedOrigins` 限制目的地。从 `COMIC_DL_ZEROBYW_COOKIE` 读取会话，以 `COMIC_DL_ZEROBYW_COOKIE_ORIGIN` 绑定当前站点；未设置时只绑定默认站点，绝不把旧 Cookie 自动发到新域名。`document()` 仅在详情/阅读页显式启用认证，公开搜索和图片保持匿名。凭据不进入 `settings`。
2. **还原完整章节列表。** 在 `getSeries` 中确认详情页的登录状态与作品 ID，再从「章节列表」按页面顺序提取卡片。可读卡片的 ID 来自链接；明确标记为 VIP 且无链接的卡片才从 `mangaDownloadChapters` 补 ID。需要校对列表长度、标题以及可读卡片的 ID，避免把相邻章节配错。脚本中的数据用 `JSON.parse` 读取，不执行网页脚本。
3. **读取有序页面。** `readChapter` 用面包屑和 `localTranslate` 交叉检查作品、章节身份。图片优先取 `data-src`，其次取 `src`；相对地址按响应的最终 URL 解析。校验图片 Origin、格式和页数。有 `data-page-index` 时校验重复、缺失和越界后排序，否则保留 DOM 顺序。给 page ID 用页序和 URL 的路径等稳定字段，去掉可能变化的签名查询参数。重试时重新读取阅读页，避免复用过期图片链接。
4. **区分访问受限与失败。** 只有站点明确表示章节为 VIP 专属时才用注入的 `api.RestrictedChapterError`。series 中已经确认受限的章节仍可列出，调用该章的 `getPages()` 时再报告受限。会话过期、未知 `403`、缺页或解析失败是普通失败。HTTP 助手会把可重试的网络故障标记为暂态错误，下载服务负责重试。
5. **最后加入公开搜索。** `search(query, page, signal)` 对 `/pc/pc/` 设置 `keyword` 和 `page`，解析链接和标题，按作品 ID 去重。返回 `{ results, hasNext }`；每项的 URL 都应能直接交给 `getSeries()`。空关键词用于浏览目录，`hasNext` 由目录中的下一页链接决定。
6. **补齐元数据和规范上下文。** 复用详情页资料和公共目录卡片封面；按当前配置校验可信 HTTPS origin，覆盖 `0.3.1` 的 HTTP 封面规范化。`getChapter()` 用已核对的作品 ID 返回当前站点的 `seriesInput`，让核心取得完整目录。不要把封面请求、归档策略或终端进度塞进章节解析。

## 6. 用离线回归验证，再打包

在 [comic-dl-extensions](https://github.com/yinyanfr/comic-dl-extensions) 仓库安装依赖后运行正式扩展的回归测试：

```sh
npm test --workspace @comic-dl/zerobyw
```

[测试源码](https://github.com/yinyanfr/comic-dl-extensions/blob/main/extensions/zerobyw/test/zerobyw.test.js)用回环 HTTP 服务模拟站点和图片主机。写自己的扩展时，可以沿用三组断言：`list` 返回预期的稳定 ID 和阅读顺序；单章与系列路径使用同一归档身份且页序正确；Cookie 只到指定站点，受限章节、登录过期和解析失败能区分。还可以加入真实页面变体的脱敏样本，覆盖懒加载、无链接的受限卡片和分页。

还应覆盖：可选元数据缺失；目录和鉴权详情返回封面；可信 HTTP 升级、自定义 origin/端口、拒绝未知主机及凭据/查询/片段；当前站点和旧输入映射；Cookie origin 不匹配时不发送凭据；直链/范围保留第 2 章序号；公开库任务事件含页数但不泄露路径或 Cookie。带认证详情用离线响应验证即可，无需真实账号。

练习文件适合用 `--extension` 加载。准备分享时，按[独立打包指南](../develop/#独立打包)改成独立 ESM 包，声明自己的运行时依赖，并用 [API v1 规范](../../specs/source-extension-v1/)核对接口。更多来源的受保护封面和测试清单见[完整扩展开发指南](../develop/)。
