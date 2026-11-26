# comic-dl

comic-dl 正在从零重写。目前可从本地测试源生成单章 CBZ。旧实现在 `legacy` 分支。

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

## 开发

使用 Node.js 24 和 npm：

```sh
npm ci
npm run check
npm test
```

`npm run check` 检查格式、lint 和类型；用 `npm run format` 修正格式。`npm test` 构建并运行离线 CLI 回归测试。安装依赖时会设置 Husky，提交时只检查暂存文件；GitHub Actions 会运行完整检查和测试。
