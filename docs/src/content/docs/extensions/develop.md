---
title: 开发漫画源扩展
description: 编写、测试和打包由 comic-dl 显式加载的漫画源。
---

漫画源扩展是独立发布的 Node.js 24 ESM 包。CLI 用户用 `comic-dl add <包名>` 安装，库用户通过 `.use()` 注册；开发时可用 `--extension` 或配置加载本地模块。扩展负责输入识别、登录会话和站点解析；核心负责并发、章节重试、取消、CBZ/ZIP、命名和任务进度，CLI 负责终端显示与退出码。扩展可以实现 `matchesUrl`，让核心根据完整 URL 自动选源。

想边写边跑，可以先跟着 [Zerobyw 动手教程](../zerobyw-walkthrough/)做一遍，从解析样本到生成第一个 CBZ。

## 运行最小原型

仓库中的 [hello-extension.mjs](https://github.com/yinyanfr/comic-dl/blob/main/examples/hello-extension.mjs) 只有一部作品、一章和一张 GIF，不需要联网。运行：

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

## 从最小适配器到完整来源

4.x 仍使用 API v1；以下均为可选能力，旧扩展不必一次全部实现。面向这些类型开发时，使用 `comic-dl@4.0.0` 或更新的兼容版本，不要在扩展内复制核心接口或导入 `dist/` 私有文件。

### 作品元数据、搜索封面与直链目录

`getSeries()` 返回完整阅读顺序和稳定 ID；页面有资料时附带：

```ts
return {
  id: workId,
  metadata: {
    title,
    authors,
    summary,
    tags,
    coverUrl, // 经过来源校验的公开图片地址；无数据时省略
  },
  chapters,
};
```

搜索结果也可以附带 `coverUrl` 或 `coverId`，但不要为每条搜索结果额外请求详情页。缺失资料不应导致浏览、列章或下载失败。DM5 的目录封面来自 `.mh-cover` 的 CSS `background-image`，而搜索可能使用 `img/data-src`；从限定节点提取 URL，不执行样式或脚本，不假定全站使用同一种 HTML。

章节直链返回 `{ workId, chapter, seriesInput }`。`seriesInput` 必须是当前配置站点可再次读取的规范作品输入，保留必要的章节组；核心用它加载完整目录并交叉验证作品与章节身份。不要把单章当作目录第 1 章，也不要按选章结果重新编号。无法取得目录上下文时省略它，允许核心以稳定章节 ID 回退；直链还可附带 `metadata`。

### 公共与鉴权封面

- 公共 `coverUrl` 不含 Cookie、密码、API key 或带凭据的查询串；只允许来源配置范围内的地址。缺失或不安全时省略，调用方显示占位。
- ZeroByw 的 HTTP 封面只对明确配置的可信站点/图片 origin 升级到 HTTPS，随后重新校验协议、origin、端口、凭据及查询/片段；不能把任意 HTTP 主机变成可信地址。
- Komga/Kavita 等受保护图片返回不含凭据的 `coverId`，实现 `readCover(id, signal)`。校验 ID 后在绑定服务的固定封面端点读取，不接受任意 URL，不将 Auth Key URL 暴露给浏览器。
- `readCover()` 返回 `{ contentType, bytes }`。核心只接受非空 JPEG/PNG/GIF/WebP，最大 10 MiB；扩展也宜在读取时限制响应体。Web 使用自己的受认证图片端点和私有缓存。

### 设置、认证和目录能力

非敏感设置声明在 `settings` 中，`matchesUrl(url, kind, settings)` 和 `create(api, settings)` 使用同一组值；站点特有约束放在 `validateSettings()`。真实来源需同时考虑默认站点、当前配置和用于识别的旧站点，读取时仍将稳定 ID 映射到当前站点。

Cookie/key 不放进 `settings`、搜索结果或元数据。改变服务器不能自动把旧凭据发送给新服务器：ZeroByw 使用 `COMIC_DL_ZEROBYW_COOKIE_ORIGIN` 绑定 origin；Komga/Kavita 按完整服务 URL（包括反向代理路径）绑定。配置变化后重建实例，先停止旧 watcher。

公开搜索、详情与图片可以使用不同 HTTP 读取器。认证请求须显式启用；只到允许的目的地，跨 origin 重定向不重新附加凭据。ZeroByw 搜索和图片始终匿名。

需要浏览排序或筛选时，分别声明 `catalog.browse/search`，动态选项由 `catalogChoices()` 返回。把校验后的第四参数 `{ sort, filters }` 转换为上游查询，分页保留相同条件，不在核心内硬编码站点逻辑。

### 进度不属于扩展协议

扩展只实现可取消的 `getPages()` 和 `Page.read()`。核心据此发出开始、页进度、归档和结果事件；不要自行创建 CLI 进度条、SSE、持久队列或归档文件。库通过 `onEvent` 消费安全事件；CLI 使用 `--progress auto|plain|off`。无总数时调用方展示阶段，重试时当前尝试页数归零。完整生命周期见[服务 API](../../guide/service-api/)。

## 离线验收清单

除最小 CLI 冒烟外，使用公开 `createDownloader().use(extension, settings)` 验证同一扩展：

| 场景                     | 应验证的行为                                                          |
| ------------------------ | --------------------------------------------------------------------- |
| 完整目录、选章、章节直链 | 稳定身份相同；选章/直链保持完整目录序号；重跑跳过有效归档             |
| 元数据与搜索             | 资料存在时返回，缺失时仍可使用；分页和筛选无逐作品请求                |
| 公共封面                 | HTTPS、可信 HTTP 规范化、自定义 origin/端口；拒绝不可信主机与凭据 URL |
| 鉴权封面                 | 合法 opaque ID 可读；任意 URL、非法 ID、凭据泄露和越界目的地被拒绝    |
| 设置与认证               | 新旧输入映射当前站点；Cookie/key 仅到绑定服务，搜索/图片按约定匿名    |
| 页面与错误               | 页序正确、懒加载、取消、暂态重试、凭据过期与明确受限能区分            |
| 核心任务                 | 经公开 `onEvent` 取得页数与归档阶段，不把原始异常或路径送给浏览器     |

核心验证不依赖真实站点；真实站点、NAS 和自托管服务的在线联调另行记录，不能把回环测试写成真实部署验收。

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

[Zerobyw](https://github.com/yinyanfr/comic-dl-extensions/tree/main/extensions/zerobyw) 是完整实例。你可以在自己的仓库和 npm scope 下发布，也可以把多个扩展放在同一个 workspace，分别打包。CLI 安装时不运行生命周期脚本，发布的包应包含已编译入口。

发布前在扩展项目运行 `npm pack`，再到一个临时 npm 项目测试生成的包：

```sh
npm install comic-dl@latest /path/to/example-comic-dl-source-0.1.0.tgz
npm exec -- comic-dl sources --extension @example/comic-dl-source
```

扩展自己的回归测试宜用脱敏样本和回环 HTTP 服务覆盖页面顺序、认证过期、访问受限及重定向。[Zerobyw 测试](https://github.com/yinyanfr/comic-dl-extensions/blob/main/extensions/zerobyw/test/zerobyw.test.js)通过真实 CLI 加载扩展，无需账号或访问真实漫画站。在 `comic-dl-extensions` 仓库运行 `npm test --workspace @comic-dl/zerobyw` 可单独验证该扩展。
