---
title: 从旧版迁移
description: 将旧版命令、预设、Cookie 和下载目录迁移到新版。
---

新版使用 Node.js 24、独立漫画源扩展和每章一个 CBZ。以下示例假设当前 shell 能找到新版 `comic-dl`，并已安装 `@comic-dl/zerobyw`。从仓库运行时，可用 `node dist/index.js` 代替 `comic-dl`。

## 列出章节，再按 ID 下载

旧版习惯是用 `ls -u` 列出章节索引，再用 `--chapters` 或 `--from` / `--to` 指定位置：

```sh
npx comic-dl ls -u "$series_url"
npx comic-dl dl -u "$series_url" --chapters 0,4 --output ./old-downloads
```

新版用完整命令名和位置参数。先核对作品的当前 URL，再从 `list` 输出的第一列取实际章节 ID；下面的 `101`、`105` 仅为示例：

```sh
comic-dl list "$series_url" --extension @comic-dl/zerobyw --source zerobyw
comic-dl download "$series_url" --extension @comic-dl/zerobyw --source zerobyw \
  --chapter 101 --chapter 105 --output ./new-downloads
```

省略 `--chapter` 会下载整个系列。已有章节直链时，用 `chapter <chapter-url>`。`list` 只列章节，不写 ComicInfo。旧快捷命令、`--url`、`--module` 和无子命令的 URL 调用需要改写，详见 `comic-dl <command> --help`。

## 复用 Cookie 文件

过去用 `--cookie ./cookie.txt` 或把文件放在 `~/.comic-dl/cookies/`。新版不自动读取这些路径；Zerobyw 扩展从环境变量读取有效的 Cookie：

```sh
export COMIC_DL_ZEROBYW_COOKIE="$(cat ./cookie.txt)"
comic-dl chapter "$chapter_url" --extension @comic-dl/zerobyw --source zerobyw \
  --output ./new-downloads
```

会话失效时重新登录并更新文件。`--auth` 没有通用替代项；凭据由各扩展管理，不填写到 CLI 的 JSON 配置中。

## 将旧 presets 改为显式配置

旧版可能通过 `--presets presets.json` 或家目录里的默认文件提供这些设置：

```json
[
  { "output": "./old-downloads", "archive": "cbz", "batch": 5, "retry": true },
  { "module": "zerobyw", "cookie": "./cookie.txt" }
]
```

可手工改写为 `zerobyw.json`：

```json
{
  "version": 1,
  "extensions": ["@comic-dl/zerobyw"],
  "source": "zerobyw",
  "output": "./new-downloads",
  "jobs": 2,
  "retries": 2
}
```

```sh
comic-dl sources --config ./zerobyw.json
comic-dl download "$series_url" --config ./zerobyw.json --chapter 101
```

- `output` 仍是输出路径，此处建议为新版另建目录。CBZ 是唯一输出格式，无需填写 `archive`。
- `jobs` 是同时处理的章节数，旧 `batch` 是同时处理的图片数，两者不能直接换算。`retries` 是暂态错误的额外重试次数，设为 `0` 可禁用；没有确认提示，无需 `--yes`。
- 命令行参数优先于配置；命令行上指定任何 `--extension` 时，整个配置扩展列表都会被替换。配置中的相对输出路径和 `./` 或 `../` 开头的本地扩展路径以配置文件所在目录为基准；命令行路径以当前目录为基准。只加载信任的扩展文件和配置。

## 保留旧下载

旧图片目录、ZIP 和 CBZ 可以继续在原阅读器中使用。新版使用章节身份和页序校验标记来判断能否跳过归档，旧归档同名也不会被视为已下载；请保留原目录，并让新版写到独立目录。用旧 `history.txt` 或 URL 清单查找作品时，先核对当前 URL；不要假定旧域名或短 ID 可直接使用。

旧版 Copymanga 脚本请改用 [CopyManga 扩展](../copymanga/)和当前站点 URL。Ganma、批量 URL 下载、历史记录写入、旧库 API 和模块生成命令没有直接替代。编写漫画源请参考[扩展开发指南](../../extensions/develop/)。
