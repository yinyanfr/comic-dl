---
title: 源扩展 API v1
description: 适配器导出、稳定标识、读取顺序、认证和错误约定。
---

公开 TypeScript 接口来自 `comic-dl/extension`，入口源码见 [`src/extension.ts`](https://github.com/yinyanfr/comic-dl/blob/revive/src/extension.ts)。完整实现流程见[扩展开发指南](../../extensions/develop/)。

## 模块契约

- 扩展默认导出 `{ apiVersion: 1, id, create }`。`id` 匹配 `[a-z0-9]+(?:-[a-z0-9]+)*`，不得与已加载的源重名，`fixture` 由核心占用。
- `create(api)` 同步返回具有同一 `id` 的 `ChapterSource`。模块加载阶段可能只为了 `sources` 查询声明；在 `create()` 或之后初始化会话。

## 漫画、章节和页面

| 接口                          | 约定                                                                                                                                    |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `getSeries(input, signal)`    | 返回 `{ id, chapters }`，章节数组按阅读顺序排列                                                                                         |
| `getChapter(input, signal)`   | 返回 `{ workId, chapter }`；直接读取的章节与系列中的同一章节使用相同作品和章节 ID                                                       |
| `search(query, page, signal)` | 可选；空查询可浏览目录，页码从 `1` 开始。返回 `{ results: [{ title, url }], hasNext }`，其中 `url` 可直接作为系列输入；无结果返回空数组 |
| `chapter.getPages(signal)`    | 返回按阅读顺序排列的页面；重试时可能重新调用，应支持刷新临时链接                                                                        |
| `page.read(signal)`           | 返回原始图片字节 `Uint8Array`；支持 `jpg`、`jpeg`、`png`、`gif`、`webp`                                                                 |

作品 ID 在源内标识作品，章节 ID 在作品内唯一，页面 ID 在章节内唯一且稳定。选择章节、归档身份和页面顺序都依赖这些标识。不要用可能改变的标题、临时签名或认证信息作为 ID；也不要把章节列表位置当作章节 ID。

## HTTP 和错误

读取操作应尊重传入的 `AbortSignal`。`api.createSourceHttp({ credentialHeaders, credentialOrigins, allowedOrigins })` 生成 `(url, signal, authenticated = false)`，返回 `{ bytes, url, contentType }`。`allowedOrigins` 可选；认证头只在显式开启认证且目标 Origin 被允许时附加，跨 Origin 跳转后不会重新附加。

- 用注入的 `api.TransientSourceError` 标记可重试错误。HTTP 助手将超时和部分暂态 HTTP 状态映射到这个类型。
- 只在站点明确表示单章无权访问时，从 `getPages()` 抛出注入的 `api.RestrictedChapterError`。登录失效、未知 HTTP 错误和解析错误不是章节受限。
- 非暂态 HTTP 状态由 `api.SourceHttpError` 提供 `status`。凭据、签名链接和站点敏感响应不应写入用户日志或归档标识。
