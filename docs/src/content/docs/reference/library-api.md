---
title: 公开库 API 参考
description: downloader、书架、任务快照、封面、归档与托管扩展的公开接口。
---

运行环境为 Node.js 24 ESM。值和服务端类型从 `comic-dl` 导入；扩展作者使用 `comic-dl/extension` 的类型。这里只使用公开导出，不读取核心 SQLite 表或托管目录内部文件。[库指南](../../guide/library/)介绍注册方式，[Web 后端指南](../../guide/service-api/)提供组合用法。

## Downloader

`createDownloader({ source, sourceSettings, overrides, output, jobs, retries, archive })` 创建独立实例，默认导出是一个便捷实例。来源优先级为显式来源、实例默认来源、URL 匹配；不会自动加载 CLI 配置和扩展。

| 方法                                          | 返回及用途                                                                                             |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `.use(extension, settings?)`                  | 当前实例，可链式注册 API v1 扩展及非敏感设置                                                           |
| `.sources()`                                  | 已注册的来源 ID 数组                                                                                   |
| `.sourceSettings(source)`                     | 设置声明，不返回凭据                                                                                   |
| `.validateSourceSettings(source, candidate?)` | 校验并返回生效的非敏感设置，不修改实例                                                                 |
| `.validateOverrides()`                        | 校验实例覆盖值                                                                                         |
| `.resolveSource(input, kind?, explicit?)`     | 来源 ID；`kind` 为 `series`（默认）或 `chapter`                                                        |
| `.catalogOptions(source?, query?, signal?)`   | 异步取得当前搜索或浏览模式的排序与筛选                                                                 |
| `.search(query, options?)`                    | `Promise<SearchPage>`；`options` 支持 `source/page/sort/filters/signal`，页码从 1 开始，空查询浏览目录 |
| `.list(input, options?)`                      | `Promise<Series>`；`options` 为 `source/signal`，保留来源给出的完整阅读顺序                            |
| `.download(input, options?)`                  | `Promise<ChapterResult[]>`；支持 `chapters` 数组，稳定 ID 优先于含两端的范围                           |
| `.downloadChapter(input, options?)`           | `Promise<ChapterResult>`；章节直链。`chapterId` 仅供 fixture 系列选一章                                |
| `.startDownload(input, options?)`             | `DownloadTaskHandle`；支持系列下载选项及 `direct: true`                                                |
| `.readCover(id, options?)`                    | `Promise<CoverImage>`；必须显式或默认指定来源                                                          |
| `.openShelf(options?)`                        | `Promise<ShelfHandle>`；可指定 `file` 和全局默认 `intervalSeconds`                                     |

下载选项包括 `source/directory/jobs/retries/signal/onResult/onEvent/archive/outputRoot/outputMarker/taskScope`。系列下载还接受 `chapters`。默认并发 2，额外重试 2 次；系列默认写当前目录，直链必须指定目录或实例 `output`。参数、来源、目录解析和取消会使 Promise 拒绝；单章下载失败则以结果状态返回，其他章节继续。

`Series.chapters` 含服务端读取方法，不应直接发送给浏览器。页面响应只映射所需的 ID、标题、目录位置和可选元数据，不返回 `getPages()`、页面读取对象或源实例。

`ChapterResult` 包含 `sourceId/workId/chapterId/workTitle/chapterTitle/number?/attempts`，以及 `downloaded/skipped` 的 `path` 或 `failed/restricted` 的 `error`。它是服务端结果，不是浏览器 DTO。`onResult` 接收逐章结果；若它抛错，核心停止领取新章并等待在途工作。`onEvent` 是同步事件回调，应快速返回，不要在其中执行未处理的异步工作。

`taskScope` 可区分同时提交同一章节的事件；`startDownload()` 自动使用独立作用域。句柄的 `snapshot()` 返回副本，`cancel()` 取消本批手动任务，`done` 是首次执行的 Promise，`retry()` 返回后续执行的 Promise。解析目录前快照可为空；手动任务不持久化。实例的来源设置在创建时确定，修改生效设置需创建新实例。

## 书架及自动化

| 方法                                                                 | 返回及用途                                                         |
| -------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `list()`                                                             | 本地 `ShelfEntry[]`                                                |
| `add(input, { source?, title?, signal?, retries? }?)`                | 异步解析后添加；按来源与作品 ID 去重，不覆盖已有记录               |
| `setInput(id, input, options?)`                                      | 异步校验同一来源与作品后改定位；真正变化启用新目录基线             |
| `configure(id, { autoCheck?, autoDownload?, intervalSeconds? })`     | 更新设置并返回条目；省略字段保留原值                               |
| `setDefaultInterval(seconds)`                                        | 保存全局间隔，重新计算使用默认值的条目的下次检查时间               |
| `follow(id)` / `unfollow(id)`                                        | 同时开关自动检查和自动下载，不取消既有任务                         |
| `remove(id)`                                                         | 删除条目与任务记录，保留归档                                       |
| `check({ entryId?, includeHistory?, signal?, retries?, onCheck? }?)` | 检查任一条目或全书架，返回 `{ checked, failures, queued, events }` |
| `status(id?)`                                                        | 本地 `ShelfStatus[]`，最近/下次检查、结果及数量统计                |
| `chapters(id)`                                                       | 本地 `ShelfChapter[]`，包含目录序号、发现时间与状态                |
| `tasks(id?)`                                                         | 本地安全任务快照；运行中的句柄还合并实时进度                       |
| `needsAttention(id)`                                                 | 受限或需人工处理的章节 ID 和状态                                   |
| `enqueue(id, chapterId)`                                             | 将 `seen/discovered/cancelled` 章节入队，成功返回 `true`           |
| `cancel(id, chapterId)`                                              | 持久取消待处理或在途任务，成功返回 `true`；保留已经提交的归档      |
| `retry(id, chapterId)`                                               | 将 `blocked/restricted/retry/cancelled` 重新排队，成功返回 `true`  |
| `watch(options)`                                                     | 持续运行的 Promise；每个数据库只允许一个消费者                     |
| `close()`                                                            | 关闭句柄；必须先中止并等待 watcher 结束                            |

间隔是 1–31,536,000 秒的整数；作品的 `intervalSeconds: null` 使用全局默认（初始 3600 秒）。条目中的 `autoCheck/autoDownload/following` 使用 `0/1`，配置输入使用布尔值；`following` 是自动检查开关的兼容投影。`ShelfEntry.intervalSeconds` 是可空覆盖值，`ShelfStatus.intervalSeconds` 是生效值。`createdAt/updatedAt` 为 ISO 字符串；`lastCheck/lastSuccess/nextCheck/discoveredAt/readyAt` 使用 Unix 毫秒时间，未知值为 `null` 或未提供，`readyAt: 0` 表示立即可运行。

首次检查默认只建立 `seen` 基线。之后新章在自动下载关闭时为 `discovered`，开启时为 `queued`。普通检查不重新入队已知章节；显式补历史须提供 `entryId`，只将尚未入队的基线和发现记录入队。关闭任何开关不取消旧任务，缺失章节暂缓，恢复到目录后可以继续消费。

`enqueue/cancel/retry` 没有可操作章节时返回 `false`；`chapters/tasks` 查询未知条目返回空数组。传入未知条目调用 `check/configure/follow/unfollow/setInput/remove` 会报错，不会创建占位条目。

`CheckEvent` 的成功状态为 `baseline/updated/unchanged`，附 `queued/discovered`；并发变更导致写回作废时为 `changed`；失败为 `failed` 加 `problem`。问题码为 `source-unavailable/authorization-failed/temporary-failure/catalog-failed/wrong-work/invalid-catalog/empty-catalog/check-conflict`，不包含源异常原文。

## Watcher 与任务事件

`watch()` 必须提供 `signal` 和输出目录（或实例 `output`）；还支持 `jobs/retries/intervalSeconds/archive/outputRoot/outputMarker/onCheck/onTask/onEvent/onOutputUnavailable`。`intervalSeconds` 会保存为全局默认；省略时沿用数据库值，不覆盖作品级间隔。网络请求在事务外，队列由核心恢复，不应由 Web 再维护一套同义持久队列。

`onTask` 是兼容的逐章结果事件：`{ entryId, chapterId, state: retry|restricted|complete|blocked }`。新界面使用 `onEvent: ({ type: 'task', task }) => ...`：

| 快照字段                               | 含义                                                                                        |
| -------------------------------------- | ------------------------------------------------------------------------------------------- |
| `id`, `origin`, `entryId?`             | 不透明任务 ID；来源为 `manual` 或 `shelf`，书架任务附条目 ID                                |
| `sourceId`, `workId`, `chapterId`      | 用于展示的来源内身份；敏感或路径形文本会脱敏。服务端保留操作所需原始身份，不要反解析任务 ID |
| `workTitle`, `chapterTitle`, `number?` | 名称及完整目录中的一基序号，不是选章后的序号                                                |
| `state`                                | `queued/retry/starting/reading/archiving/downloaded/skipped/failed/restricted/cancelled`    |
| `pagesDownloaded`, `totalPages?`       | 当前尝试的页进度，未知总数不提供；重试时归零                                                |
| `attempt`                              | 当前执行的尝试序号；离线书架快照只保留失败计数，不是历史执行总次数                          |
| `retryable`, `readyAt?`                | 可显式重试；不等于会自动重试。书架可提供下次可运行时间                                      |
| `problem?`                             | `download-failed/access-restricted/output-unavailable` 安全问题码                           |

数据库的 `complete/blocked` 投影到快照的 `downloaded/failed`；进程重启后不保留逐页计数。实时计数在 watcher 停止时清除。事件不是持久日志，SSE 重连应重新获取快照；前端断开不能取消后台任务。不要将脱敏字段直接作为核心操作参数，服务端应保存或查回原始身份。取消和立即重试会使旧执行失效，旧结果不能覆盖新任务。

## 归档与封面

`ArchiveOptions` 为 `{ template?, padding?, format? }`，默认 `{title}/{number}-{chapter}`、补零 0、格式 `cbz`。支持的占位符为 `{title}/{chapter}/{number}/{workId}/{chapterId}`；模板最多四段相对路径，不允许绝对路径、越界或任意表达式。补零为 0–12，格式为 `cbz/zip`。按 UTF-8 字节清洗和截断名称，并检查平台路径长度；冲突不能覆盖别的章节。改命名或格式仍会验证并识别当前输出根内已有的身份标记归档。

`outputRoot` 让标记位于根内、归档写到已有子目录。只有实际写入位置不使用 `outputRoot` 时，watcher 才沿用同目录标记行为；手动下载指定标记时必须同时指定根。不存在的受保护目录不自动创建。目录锁无需硬链接；崩溃后可能需等待约一分钟使锁过期，不应删除仍在使用的锁。

`planArchiveMigration(directory, entries, archive?, signal?)` 的 `entries` 含 `identity: [sourceId, workId, chapterId]`、`title/chapter/number?`，返回相对路径、身份及 `move/unchanged/conflict`。`applyArchiveMigration(directory, plan, signal?)` 只处理 `move`，重新校验并拒绝目标覆盖。它不是全批次事务；中途失败时已完成的移动保留，应重新预览后再继续。两种格式都是 ZIP 容器；迁移不重新下载图片。

搜索结果可有 `coverUrl/coverId`；作品的可选 `metadata` 含 `title/authors/summary/tags/coverUrl/coverId`。没有字段时不影响下载。受保护封面用 `readCover(coverId, { source, signal })`，返回 `{ contentType, bytes }`；支持 JPEG/PNG/GIF/WebP，非空且不超过 10 MiB。Web 需自行做访问认证、私有缓存及响应头；核心不接收任意代理 URL。扩展直链返回可选 `seriesInput` 后，核心加载完整目录并验证身份；旧扩展没有该信息时序号未知。

## 顶层辅助函数与生命周期

| 导出                                           | 用途                                                        |
| ---------------------------------------------- | ----------------------------------------------------------- |
| `readConfig(file?, signal?)`                   | 读取显式 CLI v1 配置，返回可用实例默认值；不读取隐式配置    |
| `sourceOverrides(inputs?)`                     | 将 `source.key=value` 数组解析为运行时覆盖                  |
| `loadExtension(input)`                         | 加载 npm 包或本地 ESM 默认导出；URL 只允许 `file:`          |
| `fixtureExtension`                             | 显式注册的离线测试源，不用于生产目录浏览                    |
| `withManagedDownloader(options, callback)`     | 加载显式与托管扩展，并在异步回调期间固定该安装代            |
| `manageExtensions(action, package?, options?)` | `add/update/remove`；选项为 `directory/signal/stdio`        |
| `listManagedExtensions(options?)`              | 只读清单；选项为 `directory/signal`，不存在的目录返回空数组 |
| `checkExtensionUpdates(package?, options?)`    | 检查单包或全部，不安装、不更新；指定未安装包时拒绝          |

清单字段为 `package/version/requested/sourceId/status`：实际版本或来源映射未知时为 `null`，`status` 为 `loaded/failed`。导入模块不等于成功创建来源会话。更新检查的 `updateStatus` 为 `current/available/failed`：成功附 `availableVersion`（按保存范围/标签解析的候选值），失败附 `query-failed/not-installed`。只有 `available` 表示有更高版本；单个失败保留其他包结果，取消则使调用拒绝。更新时仍遵守保存的范围，不保证未来应用时与检查候选相同。缺省目录与 CLI 共用，也可显式隔离。

在 `withManagedDownloader()` 回调内等待所有手动任务与 watcher 结束后再返回；不要只返回一个仍在工作的句柄。扩展或设置变化后先停止旧工作、等待回调释放安装代，再重新加载。凭据由扩展管理；配置、快照和日志不得包含凭据。后台服务采用常驻 Node.js 进程，不是请求结束即销毁的 Serverless 函数。
