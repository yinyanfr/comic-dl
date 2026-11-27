---
title: 管理跨来源书架
description: 收藏不同漫画源的作品、管理订阅，并选择本地书架数据库。
---

书架把不同来源的作品保存在同一个本地数据库里。收藏和订阅是两件事：你可以只收藏作品，也可以订阅它，让 comic-dl [检查和下载新章节](../updates/)。

示例以 Bash / Zsh 为例，假设已[安装 CLI 并添加漫画源](../../guide/quickstart/)。如果安装的是 npm 上的 `3.0.0`，需要在仓库根目录运行 `npm ci` 和 `npm run build`，再把下文的 `comic-dl` 换成 `node dist/index.js`。可用 `comic-dl shelf --help` 确认当前 CLI 是否包含书架命令。

## 收藏作品

先用 `search` 找作品，或直接使用已有的作品 URL。把搜索结果第一列的 URL 传给 `shelf add`：

```sh
comic-dl search '想看白天同学的软弱表情' --source copymanga

series_url='https://www.copy20.com/comic/xiangkanbaitiantongxuederuanruobiaoqing'
comic-dl shelf add "$series_url" --title '想看白天同学的软弱表情'
comic-dl shelf list
```

完整 URL 可以自动选源。用短 ID 时，可以加 `--source copymanga` 或使用配置中的默认源。`--title` 可省略，默认显示源返回的作品 ID。命令会向来源验证作品，成功才加入书架。作品输入应能重复使用，且不含凭据；登录方式以扩展文档为准。

同一来源下，如果两个输入指向同一个作品 ID，重复添加会返回原来的条目，不修改已有标题、作品输入或订阅状态。同一作品在不同来源下会各自保留，可以只订阅其中一个版本。

## 订阅、暂停和移除

`shelf list` 的四列依次是**书架条目 ID、来源 ID、订阅状态、标题**。用第一列的条目 ID 操作书架；它与作品短 ID 和 `comic-dl list` 输出的章节 ID 不同。

```sh
entry_id='粘贴 shelf list 第一列的条目 ID'
comic-dl shelf follow "$entry_id"
comic-dl shelf list
```

新增条目为 `not-following`。`follow` 将其改为 `following`；`unfollow` 暂停追更，保留收藏、检查基线和待处理章节。再次 `follow` 后，会继续追踪并检查暂停期间新增的章节。

```sh
comic-dl shelf unfollow "$entry_id"
# 不再保留收藏时再执行：
comic-dl shelf remove "$entry_id"
```

移除条目会删除对应的订阅和任务记录，已经下载的 CBZ 会保留。卸载某个源扩展后，仍可离线列出、订阅、暂停或移除已有条目；检查更新前需要恢复该扩展。

## 更新作品链接或章节分组

```sh
comic-dl shelf set-input "$entry_id" "$new_series_url"
```

先把 `new_series_url` 设为新的作品 URL 或源支持的其他作品输入。`set-input` 会让原来的来源验证新输入，只有它仍指向同一个作品 ID 才会保存。实际修改输入后，下次成功检查会为新目录建立基线，旧目录的待下载任务停用，现有 CBZ 保留。章节分组等站点专用参数见相应扩展文档。

## 选择书架数据库

默认数据库是 `$XDG_DATA_HOME/comic-dl/shelf.sqlite`；未设置该变量时使用 `~/.local/share/comic-dl/shelf.sqlite`。Windows 默认位置为 `%LOCALAPPDATA%\comic-dl\shelf.sqlite`。如果希望试用独立书架，或在服务中明确指定路径，可以给每条书架命令传同一个 `--shelf-db <文件>`：

```sh
comic-dl shelf list --shelf-db "$HOME/test-shelf.sqlite"
```

数据库应保存在运行 CLI 的机器本地，CBZ 输出目录可以放在 NAS 上。接下来可[手动检查更新或启动自动下载](../updates/)。
