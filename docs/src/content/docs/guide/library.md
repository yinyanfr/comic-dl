---
title: 作为库使用
description: 在 Node.js 项目中注册漫画源、列出章节并将漫画下载为 CBZ。
---

在 Node.js 24 的 ESM 项目中（例如使用 `.mjs`，或在 `package.json` 中设置 `"type": "module"`），安装核心和选用的扩展作为项目依赖：

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

将示例地址换成真实作品的链接，并按 [Zerobyw 扩展说明](https://github.com/yinyanfr/comic-dl-extensions/tree/main/extensions/zerobyw)在运行应用的环境中提供会话。完整 URL 会在已注册扩展中匹配；传短 ID 或有多个扩展识别同一 URL 时，传入 `{ source: 'zerobyw' }` 选择源 ID。`download()` 处理整个作品，当前库接口没有 CLI `-c` 的章节选择选项。

`download()` 返回每章的结果：`downloaded` 和 `skipped` 包含归档路径，`restricted` 和 `failed` 包含错误信息。脚本应检查这些状态；单章失败不等于整个 Promise 被拒绝。选源、列章或参数校验失败，或传入的 `signal` 被取消时，调用会拒绝。`directory` 默认是当前目录，`retries` 默认额外重试 2 次。每章结束时也可以从 `onResult` 得到同样的结果。

默认导出适合简单脚本。若多个任务需要独立的源注册表，使用 `createDownloader()`：

```ts
import { createDownloader } from 'comic-dl';
import zerobyw from '@comic-dl/zerobyw';

const downloader = createDownloader().use(zerobyw);
console.log(downloader.sources()); // ['zerobyw']
```

库只使用应用通过 `.use()` 注册的扩展。CLI 的 `add` 和 JSON 配置不会影响库实例。
