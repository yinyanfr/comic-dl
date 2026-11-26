---
title: CopyManga（拷贝漫画）
description: 添加 CopyManga，匿名搜索和浏览，并在站点允许时下载章节。
---

CopyManga 的当前站点是 `https://www.copy20.com/`。在仓库根目录运行 `npm ci` 和 `npm run build` 后，加载独立扩展 `@comic-dl/copymanga`。已安装打包产物时，可用 `npm exec -- comic-dl` 替换 `node dist/index.js`。

```sh
node dist/index.js sources --extension @comic-dl/copymanga
node dist/index.js search '漫画标题' --extension @comic-dl/copymanga --source copymanga
```

省略关键词可浏览公开目录，用 `--page 2` 翻页。将搜索结果第一列的作品 URL 传给 `list` 或 `download`。系列命令也接受 `doityourself` 这样的作品短 ID。

```sh
series_url='https://www.copy20.com/comic/doityourself'
node dist/index.js list "$series_url" --extension @comic-dl/copymanga --source copymanga
node dist/index.js download "$series_url" --extension @comic-dl/copymanga --source copymanga --output ./downloads
```

默认使用 `default` 章节分组。如果站点为该作品提供单行本等分组，可在作品 URL 上指定 `?group=tankobon`。使用 `--chapter <id>` 可选择 `list` 输出的章节 ID；已有章节直链时可用 `chapter <chapter-url>`。

列章与下载使用「熱辣漫畫 線路 2」（`https://api.manga2025.com`）。所有请求均为匿名，无须配置登录凭据。

## 站点限制

公开搜索、目录和默认匿名线路的列章与单章 CBZ 已在真实站点验证。若接口返回业务码 `210`，CLI 会报告本次请求被拒绝。

接口行为参考了项目的旧版适配器与 [LittleSurvival 的 Mihon 扩展 v1.6.87](https://github.com/LittleSurvival/copymanga-copy20/blob/main/apk/tachiyomi-zh.copymanga-v1.6.87.apk)。
