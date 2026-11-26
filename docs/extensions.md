# 漫画源扩展开发指南

漫画源扩展是由 `comic-dl` 显式加载的 Node.js 24 ESM 模块。扩展负责输入识别、登录会话和站点解析；核心负责并发、章节重试、取消、CBZ 和退出码。

## 运行最小原型

仓库中的 [hello-extension.mjs](../examples/hello-extension.mjs) 只有一部作品、一章和一张 GIF，不需要联网。运行：

```sh
npm ci
npm run build
node dist/index.js sources --extension ./examples/hello-extension.mjs
node dist/index.js list --extension ./examples/hello-extension.mjs --source hello demo
node dist/index.js chapter --extension ./examples/hello-extension.mjs --source hello welcome --output ./downloads
node dist/index.js download --extension ./examples/hello-extension.mjs --source hello demo --output ./downloads
```

单次命令可重复指定 `--extension`。提供 `./`、`../` 开头的相对文件路径时，从当前工作目录解析；也可传绝对路径或与 CLI 装在同一 npm 项目中的包名。不支持远程模块 URL、搜索目录或自动发现。扩展在 CLI 进程内执行，有本地进程的权限，因此只加载信任的代码。`sources` 会加载模块读取扩展声明，但不会调用 `create()`。

## API v1

从 `comic-dl/extension` 导入公开类型，模块默认导出一个 `SourceExtension`：

```ts
import type { SourceExtension } from 'comic-dl/extension';

export default {
  apiVersion: 1,
  id: 'hello',
  create(api) {
    // 此处返回适配器；完整可运行示例见 hello-extension.mjs。
    return createHelloSource(api);
  },
} satisfies SourceExtension;
```

- `id` 由小写字母、数字和单个连字符分隔的段组成，例如 `my-source`。注册 ID 必须唯一，`fixture` 已由核心占用。`create(api)` 同步返回同一个 ID 的 `ChapterSource`，适合读取源专属环境变量和组装会话。模块顶层不应读凭据、发请求或写文件。
- `getSeries(input, signal)` 返回 `{ id, chapters }`，章节数组按阅读顺序。`getChapter(input, signal)` 返回 `{ workId, chapter }`；同一章节从系列和单章入口返回的作品 ID 与章节 ID 必须一致。ID 应来自站点稳定标识，避免使用标题、排序位置、Cookie 或临时签名。
- 可选的 `search(query, page, signal)` 启用 CLI 的 `search` 命令。`query` 为空字符串时可浏览公开目录；`page` 从 `1` 开始。返回 `{ results: [{ title, url }], hasNext }`，其中 `url` 可传给 `getSeries`。没有结果时返回空数组；站点结构异常应报错。
- 每个 `Chapter` 提供 `id`、`title` 和 `getPages(signal)`。后者按阅读顺序返回 `Page[]`；每页带稳定 `id`、受支持的 `extension` 和 `read(signal)`，后者返回原始图片字节 `Uint8Array`。支持 `jpg`、`jpeg`、`png`、`gif`、`webp`。核心会用作品、章节和页面标识校验并跳过已完成的 CBZ。
- 所有网络或文件读取都应传递 `AbortSignal`。`getPages()` 可以在重试时再次调用，应能刷新临时 URL 且不累积状态。用 `api.TransientSourceError` 标记可重试错误；仅当站点明确表示单个章节不允许访问时，在 `getPages()` 抛出 `api.RestrictedChapterError`。登录失效、未知 HTTP 错误和解析错误应正常报错。

`create(api)` 注入核心的错误类和 `createSourceHttp()`。使用注入的类可让同一进程的下载服务识别错误。HTTP 助手接受 `credentialHeaders`、`credentialOrigins` 和可选的 `allowedOrigins`；返回的读取函数参数是 `(url, signal, authenticated = false)`，结果为 `{ bytes, url, contentType }`。需要认证时显式开启，认证头只发往允许的 Origin，跨 Origin 重定向会移除认证头。`api.SourceHttpError.status` 可用于区分站点明确返回的状态。凭据由扩展从源专属环境变量读取；错误、页面 ID 和日志不应包含凭据或签名链接。

## 独立打包

自有扩展可以放在单独的 npm 项目中。TypeScript 项目使用 `module` 和 `moduleResolution` 为 `NodeNext`，安装 `@types/node@24` 并设置 `types: ["node"]`。开发时安装提供 `comic-dl/extension` 类型的核心包，并使用 `import type`。运行时能力由 `create(api)` 注入。扩展包需要 `type: "module"`、指向已编译入口的 `exports`，并声明其自身的运行时依赖。例如：

```json
{
  "name": "@example/comic-dl-source",
  "version": "0.1.0",
  "type": "module",
  "exports": "./dist/index.js",
  "files": ["dist"]
}
```

[Zerobyw](../extensions/zerobyw/src/index.ts) 是完整实例。它用独立的 npm 包声明 HTML 解析依赖，核心包不依赖 Zerobyw 或该解析库。从仓库测试独立安装：

```sh
npm run build
npm pack
npm pack --workspace @comic-dl/zerobyw
```

在另一个 npm 项目安装生成的 `comic-dl-0.0.0.tgz` 和 `comic-dl-zerobyw-0.0.0.tgz`（用实际文件路径），然后运行：

```sh
npm exec -- comic-dl sources --extension @comic-dl/zerobyw
```

扩展自己的回归测试宜用脱敏样本和回环 HTTP 服务覆盖页面顺序、认证过期、访问受限及重定向。仓库里的 [Zerobyw 测试](../test/zerobyw.test.js) 通过真实 CLI 加载扩展，不使用账号，也不访问真实站点。
