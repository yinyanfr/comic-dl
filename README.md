# comic-dl

comic-dl 正在从零重写。目前可从本地测试源下载单章或整个系列，输出为每章一个 CBZ。旧实现在 `legacy` 分支。

## 离线下载一章

在同一个目录下放置 `chapter.json` 和图片。`workId` 与 `chapterId` 是稳定标识，`pages` 按阅读顺序列出图片文件名。例如：

```json
{
  "workId": "demo",
  "chapterId": "1",
  "pages": ["cover.png", "page-2.jpg"]
}
```

```sh
npm run build
node dist/index.js chapter --fixture ./demo --output ./downloads
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
node dist/index.js sources
node dist/index.js list --fixture ./demo
node dist/index.js chapter --fixture ./demo --chapter 2 --output ./downloads
node dist/index.js download --fixture ./demo --output ./downloads --jobs 2 --retries 2
```

- `--jobs` 默认同时处理两章，每章按页序读取。一章失败不影响其他章节，系列命令会汇总结果。
- `--retries` 默认最多额外重试两次，只重试暂态错误；设为 `0` 可关闭重试。按 `Ctrl+C` 会停止待处理章节并清理进行中的归档，保留已完成的 CBZ。
- 退出码：`0` 全部下载或跳过，`1` 运行或下载失败，`2` 参数错误，`130` 用户中断。

## 开发

使用 Node.js 24 和 npm：

```sh
npm ci
npm run check
npm test
```

`npm run check` 检查格式、lint 和类型；用 `npm run format` 修正格式。`npm test` 构建并运行本地回归测试（包括回环 HTTP 测试，不访问真实漫画站）。安装依赖时会设置 Husky，提交时只检查暂存文件；GitHub Actions 会运行完整检查和测试。
