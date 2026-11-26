---
title: 开发漫画源扩展
description: 编写、测试和打包由 comic-dl 显式加载的漫画源。
---

漫画源扩展是由 `comic-dl` 显式加载的 Node.js 24 ESM 模块。扩展负责输入识别、登录会话和站点解析；核心负责并发、章节重试、取消、CBZ 和退出码。

## 运行最小原型

仓库中的 [hello-extension.mjs](https://github.com/yinyanfr/comic-dl/blob/revive/examples/hello-extension.mjs) 只有一部作品、一章和一张 GIF，不需要联网。运行：

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

实现前请阅读[源扩展 API v1 规范](../../specs/source-extension-v1/)，了解章节和页面标识、顺序、HTTP 会话和错误约定。

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

[Zerobyw](https://github.com/yinyanfr/comic-dl/tree/revive/extensions/zerobyw) 是完整实例。它用独立的 npm 包声明 HTML 解析依赖，核心包不依赖 Zerobyw 或该解析库。从仓库测试独立安装：

```sh
npm run build
npm pack
npm pack --workspace @comic-dl/zerobyw
```

在另一个 npm 项目安装生成的两个包（用实际文件路径），然后运行：

```sh
npm install /path/to/comic-dl-0.0.0.tgz /path/to/comic-dl-zerobyw-0.0.0.tgz
npm exec -- comic-dl sources --extension @comic-dl/zerobyw
```

扩展自己的回归测试宜用脱敏样本和回环 HTTP 服务覆盖页面顺序、认证过期、访问受限及重定向。仓库里的 [Zerobyw 测试](https://github.com/yinyanfr/comic-dl/blob/revive/extensions/zerobyw/test/zerobyw.test.js) 通过真实 CLI 加载扩展，不使用账号，也不访问真实站点。根目录的 `npm test` 会运行这些测试，也可用 `npm test --workspace @comic-dl/zerobyw` 单独运行。
