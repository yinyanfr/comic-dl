# comic-dl

comic-dl 是一个支持漫画源扩展的 CLI 下载器，输出为每章一个 CBZ。核心提供本地测试源；Zerobyw 需要加载独立扩展。旧实现在 `legacy` 分支。

访问 [comic-dl 文档站](https://yinyanfr.github.io/comic-dl/) 查看使用指南、扩展与项目开发、参考手册和规范。首次使用可从[快速入门](docs/quickstart.md)开始；旧用户请看 [legacy 迁移指南](docs/migration.md)。已安装时也可运行 `comic-dl --help`。

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
- 退出码：`0` 完成，`1` 运行或下载失败，`2` 参数、配置或章节选择错误，`130` 用户中断。

## Zerobyw

在本仓库运行 `npm ci` 和 `npm run build` 后，可以通过 `--extension @comic-dl/zerobyw` 加载扩展。Zerobyw 需要有效的会话 Cookie。登录 `https://www.zerobyw33.com/` 后，把浏览器请求中的 `Cookie` 头值保存到本地文件，通过 `COMIC_DL_ZEROBYW_COOKIE` 提供给 CLI。会话失效时，重新登录并更新该变量。

```sh
node dist/index.js sources --extension @comic-dl/zerobyw
node dist/index.js search --extension @comic-dl/zerobyw --source zerobyw '关键词' --page 1
export COMIC_DL_ZEROBYW_COOKIE="$(cat /path/to/zerobyw-cookie.txt)"
node dist/index.js list --extension @comic-dl/zerobyw --source zerobyw 'https://www.zerobyw33.com/pc/details/?kuid=作品ID'
node dist/index.js chapter --extension @comic-dl/zerobyw --source zerobyw 'https://www.zerobyw33.com/pc/view/index.php?zjid=章节ID' --output ./downloads
node dist/index.js download --extension @comic-dl/zerobyw --source zerobyw 'https://www.zerobyw33.com/pc/details/?kuid=作品ID' --output ./downloads
```

搜索公开目录不需要 Cookie。省略关键词可浏览目录；有后续结果时会提示下一页。搜索结果中的作品 URL 可以直接传给 `list` 或 `download`。同一站点的 `http://` 旧链接会改用 HTTPS。

目录和阅读器的站点行为参考了 [Keiyoushi 的 Zerobyw 扩展](https://github.com/keiyoushi/extensions-source/tree/main/src/zh/zerobyw)。

用站点实际的完整 URL 替换示例地址。系列下载继续处理其他章节，并把「无权限跳过」（`restricted`）和「已有完整归档」（`skipped`）分别统计。仅因权限跳过部分章节且其余章节已完成时返回 `0`；全部受限、指定的单章受限或遇到其他错误时返回 `1`。

### 按章节 ID 下载与复用配置

用 `list` 输出的第一列选择章节。每个 `--chapter` 指定一个 ID；不指定就下载整个系列。可将重复使用的参数保存在 `zerobyw.json`：

```json
{
  "version": 1,
  "extensions": ["@comic-dl/zerobyw"],
  "source": "zerobyw",
  "output": "./downloads"
}
```

```sh
comic-dl list "$series_url" --config ./zerobyw.json
comic-dl download "$series_url" --config ./zerobyw.json --chapter 101 --chapter 105
```

命令行选项优先于配置，配置优先于默认值。配置也可包含整数 `jobs` 和 `retries`；没有默认源时，用 `--source` 显式指定。配置文件里的相对路径以文件所在目录为基准，本地扩展路径用 `./` 或 `../` 开头。Cookie 仍从环境变量读取。

## 开发

使用 Node.js 24 和 npm：

```sh
npm ci
npm run check
npm test
```

`npm run check` 检查格式、lint 和类型；用 `npm run format` 修正格式。`npm test` 构建并运行本地回归测试（包括回环 HTTP 测试，不访问真实漫画站）。安装依赖时会设置 Husky，提交时只检查暂存文件；GitHub Actions 会运行完整检查和测试。

编写新源、加载本地模块或单独打包扩展，见[漫画源扩展开发指南](docs/extensions.md)。
