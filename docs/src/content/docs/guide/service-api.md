---
title: Web 后端与任务 API
description: 独立检查和下载开关、安全任务快照、归档迁移、封面和托管扩展查询。
---

这些接口从 4.0 起提供，只能在 Node.js 24 服务端使用。前端不直接加载核心、扩展或 SQLite。基础注册方式见[库指南](../library/)，升级前先阅读[迁移指南](../../migration/v3-to-v4/)。

## 书架检查与自动化

```ts
const shelf = await app.openShelf({ file: './data/shelf.sqlite' });
shelf.setDefaultInterval(3600);
shelf.configure(entryId, {
  autoCheck: true,
  autoDownload: false,
  intervalSeconds: 1800,
});
await shelf.check(); // 全书架，包含关闭自动检查的条目
await shelf.check({ entryId }); // 任一指定条目
const chapters = shelf.chapters(entryId);
shelf.enqueue(entryId, chapterId);
shelf.cancel(entryId, chapterId);
shelf.retry(entryId, chapterId);
```

`autoCheck` 控制定时检查，`autoDownload` 控制检查发现新章后是否入队，手动检查也遵守后者。关闭开关不取消既有任务；取消任务须显式调用 `cancel()`。`follow/unfollow` 是同时开关两项的兼容入口。作品级 `intervalSeconds: null` 恢复全局默认；间隔变化重新计算下次检查时间，不清除基线。

首次成功检查只建立基线。之后发现但未自动入队的章节保存为 `discovered`，保留 `discoveredAt`；重复检查不会丢失它们。开启自动下载不会追溯入队之前发现的章节；使用 `enqueue()` 单章入队，或 `check({ entryId, includeHistory: true })` 显式补历史。取消章节不会被普通检查重新入队。

`chapters()` 返回章节 ID、标题、目录序号、发现时间与 `seen/discovered/queued/retry/restricted/complete/blocked/cancelled` 状态。`status()` 提供最近检查、成功时间、下次自动检查时间（关闭时为 `null`）、生效间隔和数量统计。书架和任务离线可读；未知条目的 `chapters()`、`tasks()` 返回空数组。

## 手动与追更任务

```ts
const task = app.startDownload(input, {
  chapters: ['2-4'],
  directory: './downloads',
  onEvent: publishSafeEvent,
});
task.snapshot();
// 请求取消时，其他服务端处理器可调用 task.cancel()。
try {
  await task.done;
} catch (error) {
  if (!(error instanceof Error && error.name === 'AbortError')) throw error;
}
if (task.snapshot().some((chapter) => chapter.retryable)) {
  await task.retry(); // 仅重试失败、受限或取消的章节
}
```

`startDownload(input, { direct: true, directory })` 用于章节直链。解析目录前快照可以为空；手动任务句柄只在当前进程内存在，服务端应持有它并处理 Promise 拒绝。`done` 表示初次执行；后续执行等待 `retry()` 返回的 Promise。章节失败以任务状态呈现，并不令整批调用拒绝。

原有 `download()`、`downloadChapter()` 也接受 `onEvent`。其结果新增来源、作品及章节标题、稳定 ID、可确定时的目录序号。旧 `onResult` 和下载返回值仍包含服务端文件路径或诊断信息，**不得直接序列化到浏览器**。

watcher 同样接受 `onEvent`。`shelf.tasks(entryId?)` 提供与手动句柄相同的 `DownloadTaskSnapshot[]`，可合并展示。快照包含 `id`、`origin`、可选 `entryId`、`sourceId/workId/chapterId`、作品和章节名、可选序号、`state`、`pagesDownloaded/totalPages`、`attempt`、`retryable` 和安全的 `problem`。事件是 `{ type: 'task', task: snapshot }`。阶段包括排队、开始、读页、归档和最终结果；重试会重置当前尝试的页数。总数未知时按阶段展示，不能假定总页数。

完整的方法、状态字段、时间单位和生命周期限制见[公开库 API 参考](../../reference/library-api/)。

事件和快照不包含本机路径、请求对象、凭据或底层错误。持久队列来自 SQLite，实时页数只在当前运行的书架句柄中保留；进程重启后从待处理状态重新执行。客户端重新连接应获取新快照，而不是假定事件完整重放。取消 watcher 的信号只停止服务，不等于取消持久任务；按章 `cancel()` 才持久取消，`retry()` 可重新排队。

## 可读归档与挂载保护

```ts
const archive = {
  template: '{title}/{number}-{chapter}',
  padding: 3,
  format: 'zip' as const,
};
await app.download(input, { directory: './downloads', archive });
await shelf.watch({
  signal,
  directory: '/mnt/comics/Manga',
  outputRoot: '/mnt/comics',
  outputMarker: '.nas-ready',
  archive,
  onEvent: publishSafeEvent,
});
```

默认不补零、格式为 CBZ。模板支持 `{title}`、`{chapter}`、`{number}`、`{workId}`、`{chapterId}`，允许最多四段相对路径，不执行表达式。核心清洗保留名、特殊字符并截断过长名称；同名作品通过身份后缀区分，目标冲突不覆盖其他文件。完整目录中的序号在选章前确定；旧扩展无法关联直链目录时序号为未知，文件名以章节 ID 回退。

设置 `outputRoot` 时，实际输出目录必须是根内已经存在的真实目录；标记在根内检查。标记或所选目录消失时不重建所选目录，不提交归档，队列保留待重试。作品子目录由核心按模板创建。手动下载也接受这两项保护设置；没有 `outputRoot` 的 watcher 仍保留原先在实际目录检查标记的行为。

修改格式或模板不自动改名。稳定 ID 和完整性验证用于识别现有归档，包括旧哈希 CBZ。

所有权和归档提交使用目录锁协调同时运行的 comic-dl 写入者，并在锁内重新检查目标后原子重命名，不要求文件系统支持硬链接。异常退出后的过期锁可自动恢复；迁移期间仍应暂停其他会修改归档的工具。索引遍历会忽略无关子目录的权限或消失错误，但所选输出根不可访问仍报错。

显式迁移使用：

```ts
import { planArchiveMigration, applyArchiveMigration } from 'comic-dl';

const series = await app.list(input, { source });
const entries = series.chapters.map((chapter, index) => ({
  identity: [source, series.id, chapter.id] as const,
  title: series.metadata?.title ?? series.id,
  chapter: chapter.title,
  number: index + 1,
}));
const preview = await planArchiveMigration(directory, entries, archive);
// 向管理员展示 from/to/status；冲突项不会应用。
await applyArchiveMigration(directory, preview);
```

迁移记录包含本机相对路径，仅供服务端管理员操作。预览不写磁盘；应用时重新校验归档身份，拒绝越界、符号链接和目标覆盖。CBZ 与 ZIP 使用同一 ZIP 容器，改扩展名无需重新下载图片。迁移时应暂停写入，并确保挂载稳定。

## 元数据与封面

`SearchPage.results` 可有 `coverUrl/coverId`；`Series.metadata` 可有 `title/authors/summary/tags/coverUrl/coverId`。字段均可选，缺失时显示占位。公共封面地址不得带凭据；鉴权封面通过 `await app.readCover(coverId, { source, signal })` 获取 `{ contentType, bytes }`，由 Web 自己提供受认证保护的图片端点。扩展限定可读取的 ID 和服务地址；核心不提供任意 URL 代理，拒绝非受支持图片类型、空图片及大于 10 MiB 的结果。

## 托管扩展查询

```ts
import {
  listManagedExtensions,
  checkExtensionUpdates,
  manageExtensions,
} from 'comic-dl';
const options = { directory: './data/extensions' };
const installed = await listManagedExtensions(options);
const updates = await checkExtensionUpdates(undefined, options);
const one = await checkExtensionUpdates('@comic-dl/copymanga', options);
// 用户确认后才应用：
await manageExtensions('update', '@comic-dl/copymanga', options);
```

清单返回 `package/version/requested/sourceId/status`。版本读取当前托管代；加载失败的包仍列出，未知映射为 `null`，重复来源标为失败。`loaded` 表示扩展定义可注册，不代表账号或站点可用。查询已安装扩展会导入受信任的模块，不创建来源会话，也不安装或切换版本。

更新检查额外返回 `updateStatus: current/available/failed`；成功有 `availableVersion`，失败有安全的 `problem`。遵守已保存范围或标签以及 npm 的 registry 配置，预发布遵守 npm 解析规则；固定版本不会自动升级。单包查询失败不丢失其余结果。未指定包检查全部；指定未安装的包会拒绝。两种查询都支持 `signal`，不持久缓存列表。检查只是当时快照，应用更新仍按届时的 registry 解析；变更扩展后按原生命周期规则重启 watcher。
