---
title: CLI 命令
description: 查阅命令、可用选项、标准输出和退出码。
---

运行 `comic-dl --help` 查看命令，或运行 `comic-dl <command> --help` 查看各命令选项。`-h` 等同于 `--help`，`-V` 等同于 `--version`。从仓库运行时，把 `comic-dl` 换成 `node dist/index.js`。

本文反映仓库当前代码；进度、`extensions/update --check/migrate`、详情 JSON、归档覆盖参数及手动 NAS 保护尚在 changelog 的 **Unreleased** 中，并非已发布 `4.0.0` 的 CLI 功能。

| 命令                      | 简写  | 用途                                                     |
| ------------------------- | ----- | -------------------------------------------------------- |
| `sources`                 | `src` | 列出内置和已加载的源 ID；不会创建源会话                  |
| `search [query]`          | `s`   | 搜索标题；省略关键词可浏览目录，`--page <n>` 从 `1` 开始 |
| `list <series-input>`     | `l`   | 列出作品章节的稳定 ID 与标题                             |
| `chapter <chapter-input>` | `c`   | 使用章节直链或源定义的标识下载一章                       |
| `download <series-input>` | `d`   | 下载整个系列或指定章节                                   |
| `shelf <action>`          |       | 收藏不同来源的作品、管理订阅并自动追更                   |
| `add <package>`           | `a`   | 安装 npm 源扩展，可附加 `@版本` 或 `@标签`               |
| `update [package]`        | `u`   | 按已保存的版本范围更新单个或全部扩展                     |
| `remove <package>`        | `rm`  | 卸载 CLI 管理的扩展                                      |
| `extensions`              |       | 以 JSON 列出托管包实际版本、保存范围、来源 ID 和加载状态 |
| `migrate <series-input>`  |       | 预览当前作品已有归档的重命名，不下载图片                 |

### 选项

| 选项                             | 适用命令                             | 说明                                                               |
| -------------------------------- | ------------------------------------ | ------------------------------------------------------------------ |
| `--config <file>`                | `sources` 及漫画操作命令             | 加载显式 JSON 配置，见[配置参考](../config/)                       |
| `--extension <name>`             | `sources` 及漫画操作命令             | 加载可解析的 npm 包或本地 ESM 文件，可重复                         |
| `--source <id>`                  | 漫画操作命令                         | 选择已注册的源；可取自配置                                         |
| `--fixture <directory>`          | `list`、`chapter`、`download`        | 使用本地测试样本；与位置输入或显式 `--source` 互斥                 |
| `-o, --output <directory>`       | `chapter`、`download`                | 可取自配置；`download` 默认当前目录，`chapter` 要求指定            |
| `-c, --chapter <selection>`      | `download`                           | 章节 ID 或包含两端的范围（如 `2-4`），可重复                       |
| `-c, --chapter <id>`             | `chapter --fixture`                  | 只接受一个稳定章节 ID                                              |
| `--jobs <n>`                     | `download`                           | 最大并行章节数，默认 `2`                                           |
| `--retries <n>`                  | `chapter`、`download`                | 暂态错误的额外重试次数，默认 `2`，设为 `0` 禁用                    |
| `--progress auto\|plain\|off`    | `chapter`、`download`、`shelf watch` | 标准错误进度；默认 `auto` 仅在终端显示                             |
| `--archive-template <template>`  | 下载、watcher、迁移预览              | 不含扩展名的相对命名模板                                           |
| `--archive-padding <0-12>`       | 下载、watcher、迁移预览              | 完整目录序号补零                                                   |
| `--archive-format cbz\|zip`      | 下载、watcher、迁移预览              | 覆盖配置中的归档格式                                               |
| `--output-root <dir>`            | 下载、watcher                        | 限制输出到根内已存在的真实目录                                     |
| `--require-output-marker <name>` | 下载、watcher                        | 挂载标记文件名；手动下载必须同时提供根                             |
| `--details`                      | `list`                               | 以 JSON 输出作品 ID、可选元数据和章节描述，不输出读取方法          |
| `--json`                         | `search`                             | 输出完整 `{ results, hasNext }`，含可选封面；不与 `--options` 同用 |

### 安装和管理漫画源

从扩展作者的文档或 npm 获取包名。例如：

```sh
comic-dl add @comic-dl/zerobyw
comic-dl update @comic-dl/zerobyw
comic-dl update
comic-dl remove @comic-dl/zerobyw
```

先检查再确认更新：

```sh
comic-dl extensions
comic-dl update --check
comic-dl update @comic-dl/zerobyw --check
# 检查不修改安装代；明确确认后去掉 --check 应用。
comic-dl update @comic-dl/zerobyw
```

`extensions` 与 `sources` 不同：前者列托管包，后者列本次命令加载的来源。清单包含无法加载的包，`loaded` 不代表账号有效。检查结果为 `current/available/failed`，单包失败仍输出其余结果并返回 `1`；有可用更新本身返回 `0`。查询遵守保存的范围/标签和 registry 设置，不切换当前版本，也不枚举 `--extension` 的临时模块。

`update` 不会突破已保存的版本范围；跨版本范围可用 `add '包名@版本'`。管理命令使用 npm 包名，下载时的 `--source` 使用源 ID（如 `zerobyw`）。CLI 通过 npm 将扩展安装在用户数据目录下的独立项目中，安装时不运行 npm 生命周期脚本；扩展加载时以本地进程权限执行，只添加信任的扩展。

默认目录在 Unix 上是 `$XDG_DATA_HOME/comic-dl/extensions`，未设置时用 `~/.local/share/comic-dl/extensions`；Windows 使用 `%LOCALAPPDATA%\comic-dl\extensions`。可设置 `COMIC_DL_EXTENSION_DIR` 指向其他目录。

扩展管理命令同一时间只允许运行一个。并发操作如果提示锁定，等另一个命令结束后重试；进程意外退出后，下次管理操作会自动清理其遗留的写锁。扩展目录应由同一台机器管理，不要用多个主机共享同一个扩展目录。

### 选择漫画源

用 `add` 安装的扩展会自动加载。`--extension` 或配置可以额外加载本地文件或与 CLI 装在同一个 npm 项目中的包，不会安装或登记扩展。显式指定已登记的同名包时只加载一次；不同包声明相同源 ID 时会报错。

`--fixture` 的样本格式和验证步骤见[本地开发测试](../../development/local-testing/)。

`--source` 优先于配置中的 `source`。两者都未指定时，`list`、`chapter` 和 `download` 会让已加载的扩展识别完整 URL；匹配不到或有多个来源匹配时，会提示检查扩展或显式选源。作品短 ID 和搜索关键词需要指定源或使用配置中的默认源。

### 浏览、排序和筛选

`search --source <id> --options` 返回浏览目录的排序和筛选选项（JSON）。加上关键词可查询该来源在关键词搜索中支持的选项。用 `--sort <id>` 选择排序，用 `--filter <key>=<value>` 指定筛选，可重复指定不同的键。要翻页，保留相同的关键词、排序和筛选，并传入 `--page <n>`。来源未声明的选项会报错。`list` 仍按阅读顺序列出作品的章节。

插件设置可用 `sources --source <id> --options` 查看，覆盖方式见[配置参考](../config/)。

### 选择章节

`-c 2-4` 选择当前章节列表中按阅读顺序排列的第 2 到第 4 项（含两端）。位置从 `1` 开始，与站点的章节标题和稳定 ID 无关；`list` 的输出顺序就是范围使用的顺序。也可用 `-c <id>` 指定 `list` 输出第一列的稳定 ID；若输入恰好与某个 ID 相同，优先按 ID 处理。可以重复传入 `-c` 混用范围和 ID，命令会先校验所有选择，再按阅读顺序下载，每章只处理一次。范围倒序、超界或 ID 不存在时返回 `2`，且不会开始下载。

### 管理跨来源书架

| 命令                                 | 用途                                                |
| ------------------------------------ | --------------------------------------------------- |
| `shelf add <series-input>`           | 收藏作品，可选 `--source <id>` 和 `--title <title>` |
| `shelf list`                         | 输出条目 ID、来源、订阅状态和标题，以制表符分隔     |
| `shelf follow <entry-id>`            | 开启订阅                                            |
| `shelf unfollow <entry-id>`          | 暂停追更，保留收藏及检查记录                        |
| `shelf set-input <entry-id> <input>` | 修改同一作品的定位输入                              |
| `shelf remove <entry-id>`            | 移除条目和订阅，保留已下载的 CBZ                    |

所有书架子命令都接受 `--shelf-db <file>`。`shelf add`、`set-input`、`check` 和 `watch` 也接受 `--config`、`--extension` 和 `--set`；其他书架操作可离线执行。完整流程见[管理跨来源书架](../../shelf/manage/)。

### 检查更新和自动下载

| 命令                                  | 用途                                                                     |
| ------------------------------------- | ------------------------------------------------------------------------ |
| `shelf check [entry-id]`              | 检查全书架或指定条目，不受自动开关限制；指定条目可加 `--include-history` |
| `shelf status [entry-id]`             | 离线查询检查和下载状态                                                   |
| `shelf watch`                         | 在前台定期检查并下载，需指定 `--output <dir>` 或在配置中设置             |
| `shelf retry <entry-id> <chapter-id>` | 重新排队指定失败或受限章节                                               |

`watch` 支持 `--interval <seconds>`（默认 `3600`）、`--jobs <n>`（默认 `2`）和 `--require-output-marker <name>`（标记文件不可用时推迟下载）。详见[检查更新与自动下载](../../shelf/updates/)。

4.x 增加 `shelf configure <id> --auto-check on/off --auto-download on/off --interval <秒数/default>`、`shelf chapters <id>`、`shelf tasks [id]`、`shelf enqueue <id> <chapter-id>` 和 `shelf cancel <id> <chapter-id>`。`chapters/tasks` 输出 JSON。关闭自动化不会取消既有任务，取消后可用 `retry` 恢复。watcher 省略 `--interval` 时沿用数据库中的全局默认（初始 `3600`）。用 `--output-root <dir>` 将根标记与既有输出子目录分开。归档配置和公开接口见[服务 API](../../guide/service-api/)。

### 归档、NAS 与显式迁移

归档命令行字段逐项覆盖配置中的 `archive`，未指定的字段保留配置值；默认 `{title}/{number}-{chapter}.cbz`、不补零。可用占位符和长度限制见[归档配置](../config/)。

```sh
comic-dl download "$series_url" --archive-padding 3 --archive-format zip -o ./downloads
comic-dl chapter "$chapter_url" -o /mnt/comics/Manga \
  --output-root /mnt/comics --require-output-marker .nas-ready
```

手动下载在保护目标不可用时返回 `1`，不重建目标目录；watcher 则保留任务等待恢复。根和目标均须是实际目录，标记放在根中，提交前再次校验。

改变命名不会自动改已有归档。先暂停 watcher 和其他写入者、备份归档、确认挂载稳定，再运行：

```sh
comic-dl migrate "$series_url" -o ./downloads \
  --archive-padding 3 --archive-format zip > migration.json
# 阅读 migration.json 的 from/to/status，确认后应用同一份预览。
comic-dl migrate --apply migration.json -o ./downloads
```

预览根据当前作品完整目录产生 `{ version: 1, directory, items }`，不改归档。`directory` 是绝对输出根；应用必须显式指定相同根，不接受来源或配置选项，不重新生成计划。仅移动 `move` 项，`unchanged/conflict` 保留；应用重新校验身份、路径和占用情况，拒绝覆盖。应用不是全批事务，中途失败保留已完成移动，应重新预览。预览含本机相对路径，只供本地管理员，不是浏览器 DTO。需要跨作品批量迁移时使用公开库 API。

### 实时进度

`auto` 默认在交互终端的标准错误流绘制有界单行，显示当前活跃章节的阶段、页数、已知总数的百分比及尝试次数；并发时显示最近更新的章节，不是整部漫画的百分比。`plain` 输出逐阶段/逐页行，便于保存日志且没有 ANSI 控制字符；`off` 关闭。重试从当前尝试的 0 页重新计数；未知总数只显示已完成页数与阶段。结果和汇总仍在标准输出。

`shelf tasks` 是跨进程可读的持久队列投影，**不是**另一个 watcher 的实时页数接口；实时事件由当前 watcher 输出，常驻 Web 后端用持有句柄的 `shelf.tasks()/onEvent`。CLI 手动任务仍由进程控制，用 Ctrl+C 取消，没有库句柄式的后台重连/重试接口。

### 脚本输出与退出码

`sources` 每行一个源 ID。默认 `list` 输出 `章节 ID<TAB>标题`，`search` 输出 `作品 URL<TAB>标题`；下一页提示和错误写入标准错误。上述 JSON 入口可供脚本读取，但进度和汇总仍供人阅读。默认重定向时不渲染进度；需要日志时显式用 `--progress plain`。

| 退出码 | 含义                                                                       |
| ------ | -------------------------------------------------------------------------- |
| `0`    | 命令完成；系列中只要有章节成功或已有完整归档，且其余仅受访问限制，仍算成功 |
| `1`    | 运行失败、下载有失败章节，或所选章节全部受限                               |
| `2`    | 命令行用法、配置、选源或章节选择有误                                       |
| `130`  | 用户中断，已完成的归档保留                                                 |
