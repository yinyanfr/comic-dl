---
title: 离线下载示例
description: 使用内置 fixture 源从本地图片生成 CBZ。
---

内置 `fixture` 源可用本地图片测试下载，无需联网或登录。示例假定已[安装 comic-dl](../quickstart/)。

## 下载一章

在同一个目录下放置 `chapter.json` 和图片。`workId` 与 `chapterId` 是稳定标识，`pages` 按阅读顺序列出图片文件名。例如：

```json
{
  "workId": "demo",
  "chapterId": "1",
  "pages": ["cover.png", "page-2.jpg"]
}
```

```sh
comic-dl chapter --fixture ./demo --output ./downloads
```

缺页时命令返回非零，补齐文件后可重跑。已有 CBZ 只有在标识、页序和页面校验都通过时才会跳过。

## 列出和下载系列

在图片目录下放置 `series.json`。`workId` 标识作品，每个 `id` 在该作品内唯一；`chapters` 和每章的 `pages` 都按阅读顺序排列。图片文件名不含目录。

```json
{
  "workId": "demo",
  "chapters": [
    {
      "id": "1",
      "title": "第一章",
      "pages": ["01-cover.png", "01-page-2.jpg"]
    },
    { "id": "2", "title": "第二章", "pages": ["02-cover.png"] }
  ]
}
```

```sh
comic-dl sources
comic-dl list --fixture ./demo
comic-dl chapter --fixture ./demo --chapter 2 --output ./downloads
comic-dl download --fixture ./demo --output ./downloads --jobs 2 --retries 2
```

默认同时下载两章，每章按页序读取。暂态错误默认最多额外重试两次；`--retries 0` 可关闭重试。一章失败时会继续处理其他章节。按 `Ctrl+C` 会停止待处理章节、清理进行中的归档，并保留已完成的 CBZ。完整选项和退出码见 [CLI 命令参考](../../reference/cli/)。
