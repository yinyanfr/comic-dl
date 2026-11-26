---
title: 本地开发测试
description: 用本地样本验证列章、CBZ 生成和归档完整性。
---

核心的 `fixture` 是内置测试源。输入是事先准备好的本地图片和 JSON，它不访问漫画网站。用它可以在不联网的情况下验证 CLI、页面顺序和 CBZ 输出。开发时从仓库根目录运行：

```sh
npm ci
npm test
node dist/index.js sources
```

`npm test` 构建核心并运行回归测试；`sources` 应列出 `fixture`。以下步骤可用于手动复现测试场景。

## 验证单章归档

在 `./demo` 目录下准备 `cover.png`、`page-2.jpg` 两张测试图片和 `chapter.json`。`workId` 与 `chapterId` 是稳定标识，`pages` 按阅读顺序列出同目录下的图片文件名。例如：

```json
{
  "workId": "demo",
  "chapterId": "1",
  "pages": ["cover.png", "page-2.jpg"]
}
```

```sh
node dist/index.js chapter --fixture ./demo -o ./downloads
```

用 `unzip -l ./downloads/*.cbz` 检查归档条目，用 `unzip -t ./downloads/*.cbz` 检查完整性。原样重跑应显示 `Skipped`。要验证缺页行为，先临时移走一张图片，并改用空的输出目录：命令应返回非零，且不会留下半成品 CBZ。放回图片后可重跑。

## 验证系列列章和章节选择

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
node dist/index.js list --fixture ./demo
node dist/index.js chapter --fixture ./demo -c 2 -o ./series-output
node dist/index.js download --fixture ./demo -o ./series-output
```

`list` 应按清单顺序列出章节 `1`、`2`。第二条命令只生成章节 `2` 的归档；第三条应生成章节 `1` 并跳过已完成的章节 `2`。`--fixture` 替代作品或章节位置参数，也不能和显式 `--source` 同时使用。完整选项和退出码见 [CLI 命令参考](../../reference/cli/)。
