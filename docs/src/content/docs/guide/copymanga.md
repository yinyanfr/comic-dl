---
title: CopyManga（拷贝漫画）
description: 用 CopyManga 匿名搜索、浏览和下载章节。
---

CopyManga 的当前站点是 `https://www.copy20.com/`。按[快速入门](../quickstart/)安装 CLI 后，运行 `comic-dl add @comic-dl/copymanga` 安装漫画源。

```sh
comic-dl sources
comic-dl search '漫画标题' --source copymanga
```

省略关键词可浏览公开目录，用 `--page 2` 翻页。将搜索结果第一列的作品 URL 传给 `list` 或 `download`。系列命令也接受 `doityourself` 这样的作品短 ID。

```sh
series_url='https://www.copy20.com/comic/doityourself'
comic-dl l "$series_url"
comic-dl d "$series_url" -o ./downloads
```

默认使用 `default` 章节分组。如果站点为该作品提供单行本等分组，可在作品 URL 上指定 `?group=tankobon`。使用 `-c <id>` 可选择 `list` 输出的章节 ID，也可用 `-c 2-4` 选择当前分组的第 2 至第 4 个章节。已有章节直链时可用 `comic-dl chapter <chapter-url> -o ./downloads`。

列章与下载使用「熱辣漫畫 線路 2」（`https://api.manga2025.com`）。所有请求均为匿名，无须配置登录凭据。

## 站点限制

公开搜索、目录和默认匿名线路的列章与单章 CBZ 已在真实站点验证。若接口返回业务码 `210`，CLI 会报告本次请求被拒绝。

接口行为参考了 [LittleSurvival 的 Mihon 扩展 v1.6.87](https://github.com/LittleSurvival/copymanga-copy20/blob/main/apk/tachiyomi-zh.copymanga-v1.6.87.apk)。
