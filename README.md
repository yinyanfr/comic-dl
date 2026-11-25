# comic-dl

comic-dl 正在从零重写。当前只有 TypeScript/ESM 工程骨架，没有可用的下载命令或漫画源。旧实现在 `legacy` 分支。

## 开发

使用 Node.js 24 和 npm：

```sh
npm ci
npm run check
npm run build
node dist/index.js
```

`npm run check` 检查格式、lint 和类型；用 `npm run format` 修正格式。安装依赖时会设置 Husky，提交时只检查暂存文件；GitHub Actions 会检查整个项目并构建。
