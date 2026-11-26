---
title: 简单的使用
description: 从作品链接或短 ID 下载漫画，也可先搜索、列章或直接下载单章。
---

下面的命令假设已[安装 CLI 并添加 CopyManga](../quickstart/#添加漫画源)，示例适用于 Bash / Zsh。

## 用作品链接下载

进入保存漫画的目录，然后传入完整的作品 URL：

```sh
comic-dl d "https://www.copy20.com/comic/xiangkanbaitiantongxuederuanruobiaoqing"
```

CLI 会根据链接自动选择已安装的源，把整部作品下载到当前目录，每章保存为一个 CBZ。`d` 是 `download` 的简写。

## 用短 ID 下载部分章节

```sh
comic-dl d xiangkanbaitiantongxuederuanruobiaoqing --source copymanga -o ~/manga -c 2-4
```

短 ID 没有域名，用 `--source copymanga` 指定来源。`-o` 指定保存目录，`-c 2-4` 按列章顺序选择第 2 到第 4 项，包含两端。范围超出可用章节时，命令会报错，不会开始下载。

## 搜索、列章与下载单章

```sh
comic-dl search '漫画标题' --source copymanga
```

复制结果第一列的作品 URL 来列章。支持浏览目录的源可以省略关键词；提示有下一页时，用 `--page 2` 等选项翻页。

```sh
series_url='https://www.copy20.com/comic/xiangkanbaitiantongxuederuanruobiaoqing'
comic-dl l "$series_url"
```

`l` 是 `list` 的简写，第一列是章节 ID，第二列是章节标题。已有该源支持的章节直链时，把下一条命令中的占位内容换成实际链接，并用 `-o` 指定目录：

```sh
comic-dl chapter '<章节 URL>' -o ./downloads
```

要按章节 ID 下载、混用范围或设置并发，请看[复杂的使用](../advanced/)。CopyManga 的分组选择等站点选项见 [CopyManga 扩展 README](https://github.com/yinyanfr/comic-dl-extensions/tree/main/extensions/copymanga)。
