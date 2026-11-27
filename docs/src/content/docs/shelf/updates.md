---
title: 检查更新与自动下载
description: 手动检查订阅更新、补下载历史章节，并在本机或 NAS 上运行自动追更。
---

先[加入作品并开启订阅](../manage/)。下列命令中的 `entry_id` 是 `shelf list` 第一列的书架条目 ID。

## 手动检查更新

```sh
comic-dl shelf check
comic-dl shelf check "$entry_id"
comic-dl shelf status
```

`shelf check` 检查整个书架，或指定的一条记录，不受自动检查开关限制。它只读取目录，不下载图片；自动下载关闭时，新章保留为发现记录，否则入队。`baseline` 表示首次成功检查，`updated` 表示发现新章或有章节入队，`unchanged` 表示没有变化。单条失败不影响其他条目，最后返回 `1`；指定未知条目返回 `2`。

首次成功检查默认只记录当前目录，之后才会把首次出现的章节 ID 加入队列。章节改名、重排或下架后重新出现不会重复入队；插入旧位置的新 ID 也会被发现。

### 补下载已有章节

```sh
comic-dl shelf check "$entry_id" --include-history
```

`--include-history` 对指定的一条书架记录生效，首次检查或之后都可以使用。它将尚未排队的基线和发现记录加入队列，重复运行不重复登记。单章入队可用 `shelf enqueue <id> <chapter-id>`；查看全部章节状态用 `shelf chapters <id>`。运行 watcher 才会下载队列。

## 启动自动追更

```sh
comic-dl shelf watch --output "$HOME/manga" --interval 1800 --jobs 2
```

`watch` 以前台进程运行，处理开启自动检查的到期条目，以及独立的既有下载队列；按 `Ctrl+C` 停止。`--interval` 是全局默认秒数，初始为一小时，作品可覆盖；`--jobs` 默认 `2`。用 `--config <文件>` 读取 `output/jobs/retries/archive`，命令行输出与并发选项优先。默认按 `作品名/序号-章节名.cbz` 创建作品子目录。

同一个书架数据库只允许运行一个 `watch`。重启后它会接着处理持久化的队列；通过完整性校验的已有 CBZ 会被跳过。要长期运行，可以让服务器的服务管理器启动这个前台命令。服务和手动命令应使用同一个书架数据库；若扩展需要登录，请按扩展说明为服务进程提供凭据。

### 输出到 NAS

先确认共享已挂载，再在共享的实际输出目录里创建一个普通文件，例如 `.nas-ready`。标记文件必须只存在于已挂载的共享上。

```sh
comic-dl shelf watch --output /mnt/manga --require-output-marker .nas-ready
```

若标记放在挂载根、归档写入既有子目录，增加 `--output-root /mnt/manga` 并使用 `--output /mnt/manga/Manga`。根标记或所选子目录不可用时保留队列，不重建所选目录；归档提交前再次检查。

标记不可用时，`watch` 仍会检查更新，下载任务会留在队列中，待标记恢复后重试。`--require-output-marker` 只接受输出目录内的文件名。书架 SQLite 数据库应留在本机。

## 查看状态和重试

```sh
comic-dl shelf status "$entry_id"
```

`shelf status` 可离线查看最近检查时间、最近成功时间和待下载数量。指定条目 ID 后，还会列出受限或需要处理的章节：

| 状态         | 如何处理                                                               |
| ------------ | ---------------------------------------------------------------------- |
| `pending`    | 等待下载或自动重试。若章节暂时从目录消失，重新出现后才会下载。         |
| `restricted` | 来源明确限制了这个章节；`watch` 会低频复查。                           |
| `blocked`    | 下载失败，需要先解决问题，例如修正输出路径或恢复来源访问，再手动重试。 |
| `complete`   | 已成功生成 CBZ，或已有归档已通过完整性校验。                           |

如果检查本身报告 `source-unavailable` 或 `authorization-failed`，先恢复扩展或更新该扩展所需的登录凭据，再运行 `shelf check` 确认。要重新排队失败或受限的章节，使用其章节 ID，而不是标题或阅读位置：

```sh
chapter_id='粘贴要重试的章节 ID'
comic-dl shelf retry "$entry_id" "$chapter_id"
```

此命令只将章节重新加入队列。命令和选项速查见 [CLI 参考](../../reference/cli/#检查更新和自动下载)。
