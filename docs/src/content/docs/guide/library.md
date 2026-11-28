---
title: 作为库使用
description: 在 Node.js 项目中查找和下载漫画，并管理书架与自动追更。
---

在 Node.js 24 的 ESM 项目中（例如使用 `.mjs`，或在 `package.json` 中设置 `"type": "module"`），安装核心和选用的扩展作为项目依赖：

```sh
npm install comic-dl@latest @comic-dl/zerobyw
```

```ts
import downloader from 'comic-dl';
import zerobyw from '@comic-dl/zerobyw';

downloader.use(zerobyw);

const url = 'https://www.zerobyw33.com/pc/details/?kuid=123';
const series = await downloader.list(url);
console.log(series.chapters.map(({ id, title }) => ({ id, title })));

const results = await downloader.download(url, {
  directory: './downloads',
  jobs: 2,
  onResult: (result) => console.log(result),
});
```

将示例地址换成真实作品的链接，并按 [Zerobyw 扩展说明](https://github.com/yinyanfr/comic-dl-extensions/tree/main/extensions/zerobyw)在运行应用的环境中提供会话。完整 URL 会在已注册扩展中匹配；传短 ID 或有多个扩展识别同一 URL 时，传入 `{ source: 'zerobyw' }` 选择源 ID。

为 `download()` 传入 `chapters: ['2-4', 'chapter-id']` 可只下载指定章节。优先匹配稳定章节 ID；位置区间从 1 开始，包含两端。所有选择都通过校验后才写文件。章节直链使用 `downloadChapter(chapterUrl, { directory })`，返回单章结果；也可以在创建实例时通过 `output` 指定默认输出目录。

`download()` 返回每章的结果：`downloaded` 和 `skipped` 包含归档路径，`restricted` 和 `failed` 包含错误信息。脚本应检查这些状态；单章失败不等于整个 Promise 被拒绝。选源、列章或参数校验失败，或传入的 `signal` 被取消时，调用会拒绝。`directory` 默认是当前目录，`retries` 默认额外重试 2 次。每章结束时也可以从 `onResult` 得到同样的结果。

如果 `onResult` 抛错或返回拒绝的 Promise，下载会停止领取新章节，等待正在处理的章节结束后再拒绝。已完成的归档会保留。

默认导出适合简单脚本。若多个任务需要独立的源注册表，使用 `createDownloader()`：

```ts
import { createDownloader } from 'comic-dl';
import zerobyw from '@comic-dl/zerobyw';

const downloader = createDownloader().use(zerobyw);
console.log(downloader.sources()); // ['zerobyw']
```

`createDownloader()` 只使用应用通过 `.use()` 注册的扩展，不自动加载 CLI 的扩展或配置。可传入 `{ source, sourceSettings, overrides, output, jobs, retries }` 设置实例默认值。选源优先级为调用时指定的 `source`、实例默认来源、URL 匹配。`validateSourceSettings(id, candidate)` 校验拟保存的设置并返回解析后的非敏感值，不修改实例。

`.use(extension, settings)` 的第二个参数可覆盖当前实例的来源设置。用 `sourceSettings(source)` 查看设置声明，用 `await catalogOptions(source, query)` 查询当前浏览或搜索所支持的排序与筛选。省略关键词表示浏览：

```js
const page = await downloader.search('', {
  source: 'copymanga',
  sort: 'popular',
});
```

此例假设当前实例已注册支持目录排序的 CopyManga 扩展。`search()` 还接受 `page`、`filters` 和 `signal`，返回 `{ results, hasNext }`。

## CLI 与库 API 对照

4.x 新增的任务快照、逐页进度、独立自动化、封面、归档迁移及扩展只读查询见 [Web 后端与任务 API](../service-api/)。升级旧书架前请备份数据库。

| CLI                                               | 库 API                                                                                               |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `sources`、`sources --options`                    | `app.sources()`、`app.sourceSettings(source)`                                                        |
| `search`、`search --options`                      | `app.search(query, options)`、`app.catalogOptions(source, query)`                                    |
| `list`、`download`、`chapter`                     | `app.list()`、`app.download()`、`app.downloadChapter()`                                              |
| `shelf add/list/set-input/follow/unfollow/remove` | `app.openShelf()` 返回的 `shelf.add()`、`list()`、`setInput()`、`follow()`、`unfollow()`、`remove()` |
| `shelf check/status/watch/retry`                  | `shelf.check()`、`status()` 与 `needsAttention()`、`watch()`、`retry()`                              |
| `add`、`update`、`remove`                         | `manageExtensions(action, packageName, options)`                                                     |
| `--extension`、`--config`、`--set`                | `loadExtension()` 或 `withManagedDownloader()`、`readConfig()`、`sourceOverrides()`                  |

单独开发 Web UI 时，在常驻 Node.js 后端调用这些接口。后台追更由服务进程维持，浏览器关闭后仍可运行。

## 书架和自动追更

可以和 CLI 共用 SQLite 书架，也可以为服务指定独立文件。先在 downloader 实例中注册所需来源，再打开书架：

```ts
const shelf = await downloader.openShelf({ file: './data/shelf.sqlite' });
try {
  const entry = await shelf.add(url, { title: '示例作品' });
  shelf.follow(entry.id);
  const check = await shelf.check({ entryId: entry.id });
  console.log(check.events, shelf.status(entry.id));
} finally {
  shelf.close();
}
```

`list()`、`status()` 和 `needsAttention(entryId)` 从本地读取数据，不访问漫画源。用 `setInput()`、`unfollow()`、`remove()` 和 `retry(entryId, chapterId)` 管理书架条目和失败或受限的章节。首次成功 `check()` 只建立基线；同时传入 `includeHistory: true` 和 `entryId` 可把现有章节加入队列。

在常驻 Node.js 进程中运行 `await shelf.watch({ signal, directory, onCheck, onTask })`。它与 CLI 共用 watcher 锁。停止时取消 `signal`，等待返回的 Promise 结束后再关闭书架。可通过 `intervalSeconds`、`jobs`、`retries`、`outputMarker` 和 `onOutputUnavailable` 配置调度和 NAS 输出。队列及挂载行为见[自动追更指南](../../shelf/updates/)。

## 管理扩展和读取 CLI 配置

```ts
import { manageExtensions, readConfig, withManagedDownloader } from 'comic-dl';

const extensionDirectory = './data/extensions';
await manageExtensions('add', '@comic-dl/copymanga', {
  directory: extensionDirectory,
});
const config = await readConfig('./comic-dl.json');
const page = await withManagedDownloader(
  { ...config, extensionDirectory },
  (app) => app.search('', { source: 'copymanga' }),
);
```

用 `manageExtensions('update', undefined, options)` 在已保存的版本范围内更新全部扩展，或用 `'remove'` 加包名卸载扩展。省略目录即使用 CLI 的扩展仓库。`withManagedDownloader()` 在回调期间保留已加载的扩展版本；请在回调内等待所有操作结束。常驻 watcher 会使用该批扩展直到停止，修改扩展或设置后重启 watcher。

需要显式注册时，可以调用 `loadExtension(pathOrPackage)` 或直接导入扩展。内置 `fixtureExtension` 可以显式注册用于[本地测试](../../development/local-testing/)。如需解析和 CLI `--set` 相同的 `source.key=value` 字符串，使用 `sourceOverrides()` 并将返回值传给 `overrides`。
