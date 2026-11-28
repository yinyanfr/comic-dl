---
title: 源扩展 API v1
description: 适配器导出、稳定标识、读取顺序、认证和错误约定。
---

公开 TypeScript 接口来自 `comic-dl/extension`，入口源码见 [`src/extension.ts`](https://github.com/yinyanfr/comic-dl/blob/main/src/extension.ts)。完整实现流程见[扩展开发指南](../../extensions/develop/)。

## 模块契约

- 扩展默认导出 `{ apiVersion: 1, id, create }`。`id` 匹配 `[a-z0-9]+(?:-[a-z0-9]+)*`，不得与已加载的源重名，`fixture` 由核心占用。
- `create(api)` 同步返回具有同一 `id` 的 `ChapterSource`。模块加载阶段可能只为了 `sources` 查询声明；在 `create()` 或之后初始化会话。
- 可选的 `matchesUrl(url, kind)` 同步判断扩展能否处理完整 URL。`kind` 是 `'series'` 或 `'chapter'`；匹配阶段不发网络请求，也不创建会话。未提供该方法的扩展仍可用 `--source` 选择。

## 漫画、章节和页面

| 接口                                    | 约定                                                                                                                          |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `getSeries(input, signal)`              | 返回 `{ id, chapters, metadata? }`，章节数组按完整阅读顺序排列                                                                |
| `getChapter(input, signal)`             | 返回 `{ workId, chapter, seriesInput?, metadata? }`；直链和目录必须使用相同作品/章节 ID                                       |
| `search(query, page, signal, options?)` | 可选；空查询浏览目录，页码从 `1` 开始。返回 `{ results: [{ title, url, coverUrl?, coverId? }], hasNext }`；URL 可作为作品输入 |
| `readCover(id, signal)`                 | 可选；读取来源限定的鉴权封面，返回 `{ contentType, bytes }`，不是任意 URL 代理                                                |
| `chapter.getPages(signal)`              | 返回按阅读顺序排列的页面；重试时可能重新调用，应支持刷新临时链接                                                              |
| `page.read(signal)`                     | 返回原始图片字节 `Uint8Array`；支持 `jpg`、`jpeg`、`png`、`gif`、`webp`                                                       |

作品 ID 在源内标识作品，章节 ID 在作品内唯一，页面 ID 在章节内唯一且稳定。选择章节、归档身份和页面顺序都依赖这些标识。不要用可能改变的标题、临时签名或认证信息作为 ID；也不要把章节列表位置当作章节 ID。

## 4.x 的可选元数据与目录上下文

4.x 保留 API v1，新增可选 `Series.metadata`（`title/authors/summary/tags/coverUrl/coverId`）和搜索结果 `coverUrl/coverId`。`getChapter()` 可附带可复用的 `seriesInput`，核心据此加载完整目录、核对作品与章节身份，并取得标题和规范序号；旧扩展缺失时序号未知，不假造为 1。鉴权封面实现 `readCover(id, signal): Promise<{ contentType, bytes }>`，扩展限制 ID 与请求目的地并保管凭据，不能接受任意代理 URL。字段缺失不影响旧扩展。详见[服务端接口](../../guide/service-api/)。

`title/summary/coverUrl/coverId` 为字符串，`authors/tags` 为字符串数组。`Chapter.number` 可选，为完整规范目录中的一基序号，不是稳定 ID，也不是选中子集的位置。直链的 `metadata` 可提供目录不可用时的显示资料。公共封面不得带凭据，`coverId` 是来源拥有的不透明标识；图片类型为 JPEG/PNG/GIF/WebP、非空且最多 10 MiB。完整示例与离线验收见[扩展开发](../../extensions/develop/#从最小适配器到完整来源)。

## 可选的运行时设置与目录能力

- `settings` 是设置声明，键匹配 `[a-z][a-z0-9-]*`。每项包含 `label`、`type`，可附带 `description` 和 `default`。支持 `text`、`url`、`boolean`、`integer`（可声明 `min`、`max`）和 `select`（提供 `{ id, label }` 选项）。`env` 只用于兼容既有的非敏感环境变量。
- 核心做通用校验后，将只读的生效设置传给 `matchesUrl(url, kind, settings)` 和 `create(api, settings)`。扩展可通过同步的 `validateSettings(settings)` 检查站点约束。保持现有调用兼容：扩展应当能在缺省 `settings` 时使用原有默认值。Cookie、密码和 API key 不通过这个接口声明。
- `catalog.browse` 和 `catalog.search` 分别声明无关键词浏览和关键词搜索的 `sorts`、`filters`。排序用稳定的 `{ id, label }`；筛选用设置支持的类型，还可以声明 `dynamic-select`，再由 `catalogChoices(key, mode, signal)` 返回当前可用选项。
- 选项经校验后作为 `search(query, page, signal, { sort, filters })` 的可选第四个参数提供。扩展负责把选项转换成服务端查询，并为同一条件计算 `hasNext`。

## HTTP 和错误

读取操作应尊重传入的 `AbortSignal`。`api.createSourceHttp({ requestHeaders, credentialHeaders, credentialOrigins, allowedOrigins })` 生成 `(url, signal, authenticated = false)`，返回 `{ bytes, url, contentType }`。`requestHeaders` 和 `allowedOrigins` 可选；`requestHeaders` 用于每次请求都发送的非凭据头。认证头只在显式开启认证且目标 Origin 被允许时附加，跨 Origin 跳转后不会重新附加。

- 用注入的 `api.TransientSourceError` 标记可重试错误。HTTP 助手将超时和部分暂态 HTTP 状态映射到这个类型。
- 只在站点明确表示单章无权访问时，从 `getPages()` 抛出注入的 `api.RestrictedChapterError`。登录失效、未知 HTTP 错误和解析错误不是章节受限。
- 非暂态 HTTP 状态由 `api.SourceHttpError` 提供 `status`。凭据、签名链接和站点敏感响应不应写入用户日志或归档标识。
