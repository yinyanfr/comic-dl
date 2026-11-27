---
title: CLI 命令
description: 查阅命令、可用选项、标准输出和退出码。
---

运行 `comic-dl --help` 查看命令，或运行 `comic-dl <command> --help` 查看各命令选项。`-h` 等同于 `--help`，`-V` 等同于 `--version`。从仓库运行时，把 `comic-dl` 换成 `node dist/index.js`。

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

### 选项

| 选项                        | 适用命令                      | 说明                                                    |
| --------------------------- | ----------------------------- | ------------------------------------------------------- |
| `--config <file>`           | `sources` 及漫画操作命令      | 加载显式 JSON 配置，见[配置参考](../config/)            |
| `--extension <name>`        | `sources` 及漫画操作命令      | 加载可解析的 npm 包或本地 ESM 文件，可重复              |
| `--source <id>`             | 漫画操作命令                  | 选择已注册的源；可取自配置                              |
| `--fixture <directory>`     | `list`、`chapter`、`download` | 使用本地测试样本；与位置输入或显式 `--source` 互斥      |
| `-o, --output <directory>`  | `chapter`、`download`         | 可取自配置；`download` 默认当前目录，`chapter` 要求指定 |
| `-c, --chapter <selection>` | `download`                    | 章节 ID 或包含两端的范围（如 `2-4`），可重复            |
| `-c, --chapter <id>`        | `chapter --fixture`           | 只接受一个稳定章节 ID                                   |
| `--jobs <n>`                | `download`                    | 最大并行章节数，默认 `2`                                |
| `--retries <n>`             | `chapter`、`download`         | 暂态错误的额外重试次数，默认 `2`，设为 `0` 禁用         |

### 安装和管理漫画源

从扩展作者的文档或 npm 获取包名。例如：

```sh
comic-dl add @comic-dl/zerobyw
comic-dl update @comic-dl/zerobyw
comic-dl update
comic-dl remove @comic-dl/zerobyw
```

`update` 不会突破已保存的版本范围；跨版本范围可用 `add '包名@版本'`。管理命令使用 npm 包名，下载时的 `--source` 使用源 ID（如 `zerobyw`）。CLI 通过 npm 将扩展安装在用户数据目录下的独立项目中，安装时不运行 npm 生命周期脚本；扩展加载时以本地进程权限执行，只添加信任的扩展。

默认目录在 Unix 上是 `$XDG_DATA_HOME/comic-dl/extensions`，未设置时用 `~/.local/share/comic-dl/extensions`；Windows 使用 `%LOCALAPPDATA%\comic-dl\extensions`。可设置 `COMIC_DL_EXTENSION_DIR` 指向其他目录。

扩展管理命令同一时间只允许运行一个。并发操作如果提示锁定，等另一个命令结束后重试；进程意外退出后，下次管理操作会自动清理其遗留的写锁。扩展目录应由同一台机器管理，不要用多个主机共享同一个扩展目录。

### 选择漫画源

用 `add` 安装的扩展会自动加载。`--extension` 或配置可以额外加载本地文件或与 CLI 装在同一个 npm 项目中的包，不会安装或登记扩展。显式指定已登记的同名包时只加载一次；不同包声明相同源 ID 时会报错。

`--fixture` 的样本格式和验证步骤见[本地开发测试](../../development/local-testing/)。

`--source` 优先于配置中的 `source`。两者都未指定时，`list`、`chapter` 和 `download` 会让已加载的扩展识别完整 URL；匹配不到或有多个来源匹配时，会提示检查扩展或显式选源。作品短 ID 和搜索关键词需要指定源或使用配置中的默认源。

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

所有书架子命令都接受 `--shelf-db <file>`。`shelf add`、`set-input`、`check` 和 `watch` 也接受 `--config` 和 `--extension`；其他书架操作可离线执行。完整流程见[管理跨来源书架](../../shelf/manage/)。

### 检查更新和自动下载

| 命令                                  | 用途                                                         |
| ------------------------------------- | ------------------------------------------------------------ |
| `shelf check [entry-id]`              | 检查全部或指定订阅；指定条目时可加 `--include-history`       |
| `shelf status [entry-id]`             | 离线查询检查和下载状态                                       |
| `shelf watch`                         | 在前台定期检查并下载，需指定 `--output <dir>` 或在配置中设置 |
| `shelf retry <entry-id> <chapter-id>` | 重新排队指定失败或受限章节                                   |

`watch` 支持 `--interval <seconds>`（默认 `3600`）、`--jobs <n>`（默认 `2`）和 `--require-output-marker <name>`（标记文件不可用时推迟下载）。详见[检查更新与自动下载](../../shelf/updates/)。

### 脚本输出与退出码

`sources` 每行一个源 ID。`list` 输出 `章节 ID<TAB>标题`，`search` 输出 `作品 URL<TAB>标题`；下一页提示和错误写入标准错误。下载进度和汇总供人阅读，不作为机器可读格式。

| 退出码 | 含义                                                                       |
| ------ | -------------------------------------------------------------------------- |
| `0`    | 命令完成；系列中只要有章节成功或已有完整归档，且其余仅受访问限制，仍算成功 |
| `1`    | 运行失败、下载有失败章节，或所选章节全部受限                               |
| `2`    | 命令行用法、配置、选源或章节选择有误                                       |
| `130`  | 用户中断，已完成的归档保留                                                 |
