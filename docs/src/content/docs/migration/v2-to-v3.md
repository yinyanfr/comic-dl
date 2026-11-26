---
title: 从 2.x 升级到 3.x alpha
description: 对照 2.4.0 迁移命令、脚本、预设和凭据，并保留已下载的漫画。
---

3.x 是 TypeScript 重写版，下面以 `2.4.0` 为对照。迁移前先保留旧下载目录和脚本，用新目录验证一部作品。新版仍是 alpha；依赖旧行为的脚本可以继续固定使用 `comic-dl@2.4.0`。

## 安装新版和对应的漫画源

```sh
npm install -g comic-dl@3.0.0-alpha
comic-dl --version
comic-dl add @comic-dl/copymanga
comic-dl sources
```

新版需要 Node.js 24。2.x 自带的 CopyManga 和 Zerobyw 在 3.x 中分别由 `@comic-dl/copymanga` 和 `@comic-dl/zerobyw` 提供，安装一次后会自动加载。旧 Ganma 模块目前没有随新版提供；其他可用源、网址和登录要求见[扩展仓库](https://github.com/yinyanfr/comic-dl-extensions)。

如果旧脚本通过 `npx comic-dl` 启动，请明确固定所需版本。对照中的新版命令假设 `comic-dl --version` 已显示 `3.0.0-alpha`。

## 改写命令和章节选择

先查询或核对作品当前的 URL。以下 `$series_url`、`$chapter_url` 分别表示已确认有效的作品和章节链接：

| 旧版写法                                                      | 新版写法                                                                                     |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `comic-dl ls -u "$series_url"`                                | `comic-dl list "$series_url"`，或用简写 `l`。                                                |
| `comic-dl -u "$series_url"` 或 `comic-dl dl -u "$series_url"` | `comic-dl download "$series_url"`，或用简写 `d`。目标是位置参数，必须写子命令。              |
| `comic-dl ch -u "$chapter_url"`                               | `comic-dl chapter "$chapter_url" -o ./new-downloads`。单章命令需要输出路径，也可由配置提供。 |
| `comic-dl dl --module copymanga --shorthand-url "$short_id"`  | `comic-dl download "$short_id" --source copymanga`，前提是新版源支持该短 ID。                |
| CopyManga 的 `--group tankobon`                               | 如果新版源提供该分组，在作品链接附上 `?group=tankobon`；其他源的分组用法见各自文档。         |

旧版 `--chapters 0,4` 中的数字是从 `0` 开始的位置；`--from 0 --to 4` 同样从 `0` 开始且含两端。新版的 `-c` 优先匹配稳定 ID，不能直接写成 `-c 0 -c 4` 来选择旧位置。只有在新旧列表顺序和内容都一致时，旧范围 `--from 0 --to 4` 才对应新位置范围 `-c 1-5`；如果 `1-5` 恰好也是章节 ID，则按 ID 处理。

更稳妥的做法是先列章，找到同一批章节，再依次传入新版列表第一列的 ID（用实际值替换示例中的 `101`、`105`）：

```sh
comic-dl list "$series_url"
comic-dl download "$series_url" -c 101 -c 105 -o ./new-downloads
```

省略 `-c` 会处理整部作品，且新版不再询问确认，无需 `--yes`。新版 `list` 每行输出 `章节 ID<TAB>标题`，不再按旧格式输出章节 URL，也不会写 `ComicInfo.xml`。迁移脚本时请更新解析逻辑并检查[新版退出码](../../reference/cli/#脚本输出与退出码)。

## 迁移预设和凭据

旧版可用 `--presets` 或 `~/.comic-dl/presets.json` 合并通用和站点规则。新版不会自动读取或合并旧预设；可按来源将常用设置整理为独立的 JSON 文件。例如，先添加 `@comic-dl/zerobyw`，再创建 `./profiles/zerobyw.json`：

```json
{
  "version": 1,
  "source": "zerobyw",
  "output": "./new-downloads",
  "jobs": 2,
  "retries": 2
}
```

旧的 `--cookie`、`~/.comic-dl/cookies/` 和 `--auth` 不再由核心读取。Zerobyw 仍可沿用旧文本文件中**尚未失效**的 Cookie，通过环境变量传给扩展；其他源按各自 README 配置：

```sh
export COMIC_DL_ZEROBYW_COOKIE="$(cat ./cookie.txt)"
comic-dl list "$zerobyw_url" --config ./profiles/zerobyw.json
comic-dl download "$zerobyw_url" --config ./profiles/zerobyw.json -c 101
```

这里的 `$zerobyw_url` 应是实际作品 URL，`101` 应换为新版列出的章节 ID。凭据不写进 JSON；会话失效时按 [Zerobyw 扩展说明](https://github.com/yinyanfr/comic-dl-extensions/tree/main/extensions/zerobyw)更新。示例输出至 `./profiles/new-downloads/`，因为 `output` 相对于 JSON 所在目录。命令行上的 `-o` 则以当前工作目录为基准，且优先于配置。

如果旧预设的输出目录以 `~/` 开头，可以沿用；JSON 中的 `"~/Downloads/manga"` 仍相对于用户主目录。

旧 `batch` 控制图片并发，新 `jobs` 控制章节并发，不能直接照抄。旧 `retry` 用来补下载有失败图片的章节；新 `retries` 是暂态错误的额外尝试次数，设为 `0` 可关闭。完整说明见[使用配置文件](../../guide/config-tutorial/)。

## 保留旧下载并检查没有直接替代的功能

旧图片目录、ZIP 和 CBZ 可以继续留给原阅读器使用。新版固定输出每章一个 CBZ，归档名基于章节身份；重跑时会核对身份、页序标记和归档完整性，旧版 CBZ 不会因文件同名而被视为已完成。请让新版写到独立目录，避免混用。下载多部作品时建议每部使用单独的输出目录。像 Calibre 这样按文件名导入的阅读器会显示归档名，需要在阅读器里补充作品名和系列信息。

- `--archive`、`--zip-level`、`--format`、`--info` 和 `list -o` 不再是新版的输出选项。旧版重命名、章节索引文件名和 `--kavita` 命名选项也没有对应开关；新版的 Kavita 扩展是书库来源。
- `--override` 没有对应选项。重跑会跳过通过完整性检查的归档。
- `--list` 的批量 URL 文件和 `--history` 没有内置替代。可以用原清单找回作品，核对当前链接后由外部脚本逐条调用新版 CLI。
- 旧的库类和 `generate` 模块模板命令没有兼容入口。应用代码参考[作为库使用](../../guide/library/)，自定义站点参考[扩展开发](../../extensions/develop/)。
