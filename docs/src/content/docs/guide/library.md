---
title: 在项目中使用
description: 在 Node.js 项目中注册漫画源、列出章节并将漫画下载为 CBZ。
---

在 Node.js 24 的 ESM 项目中，安装核心和你准备使用的扩展：

```sh
npm install comic-dl@3.0.0-alpha @comic-dl/zerobyw
```

```ts
import downloader from 'comic-dl';
import zerobyw from '@comic-dl/zerobyw';

downloader.use(zerobyw);

const url = 'https://www.zerobyw33.com/pc/details/?kuid=123';
const series = await downloader.list(url);
console.log(series.chapters.map(({ id, title }) => ({ id, title })));

const results = await downloader.download(url, {
  directory: './downloads',
  jobs: 2,
  onResult: (result) => console.log(result),
});
```

将示例地址换成真实作品的链接，并按[快速入门](../quickstart/#登录并配置-cookie)在运行应用的环境中提供 Zerobyw 会话。完整 URL 会自动选源；传短 ID 或有多个扩展识别同一 URL 时，传入 `{ source: 'zerobyw' }` 选择源 ID。

`download()` 返回每章的结果：`downloaded` 和 `skipped` 包含归档路径，`restricted` 和 `failed` 包含错误信息。请求或输入本身有误、或者传入的 `signal` 被取消时，方法会拒绝。`directory` 默认是当前目录，`retries` 默认额外重试 2 次。每章结束时也可以从 `onResult` 得到同样的结果。

默认导出适合简单脚本。若多个任务需要独立的源注册表，使用 `createDownloader()`：

```ts
import { createDownloader } from 'comic-dl';
import zerobyw from '@comic-dl/zerobyw';

const downloader = createDownloader().use(zerobyw);
console.log(downloader.sources()); // ['zerobyw']
```

库只使用应用通过 `.use()` 注册的扩展。CLI 的 `add` 和 JSON 配置不会影响库实例。
