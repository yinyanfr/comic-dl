---
title: 从 3.x 升级到 4.x
description: 迁移书架自动化、可读归档和 Web 后端 API。
---

先停止 watcher 并备份书架 SQLite，然后安装 `comic-dl@latest`。Node.js 24 和扩展 `apiVersion: 1` 不变。4.x 会将 v1/v2 书架事务升级为 v3；旧核心不能再打开升级后的数据库，回退须恢复备份。

- 旧 `following=1` 迁移为自动检查、自动下载均开启，`0` 则均关闭。基线和已有任务、失败、完成结果保留。
- `shelf check` 现在检查整个书架，包括未开启自动检查的条目。`follow/unfollow` 同时开关两项；关闭不取消既有任务。用 `shelf configure <id> --auto-check on --auto-download off --interval 1800` 独立配置。
- 默认归档为 `{作品名}/{完整目录序号}-{章节名}.cbz`，不再平铺哈希名。配置的 `archive` 可改模板、补零和 CBZ/ZIP。已有 3.x 身份标记归档仍校验并跳过，不自动重命名。2.4.0 旧产物的历史说明仍见[2.x 迁移](../v2-to-v3/)。
- 缺少作品元数据的旧扩展以作品 ID 显示；无法关联目录的章节直链序号未知，以章节 ID 回退命名。升级源扩展后可取得完整上下文。可选元数据缺失不会阻止旧扩展下载。
- 原有返回结果仍可用于服务端脚本。Web 应使用新的安全任务快照和 `onEvent`，不要直接发送包含路径及诊断的 `onResult`。
- NAS 根标记与既有输出子目录可通过 `outputRoot` 分开配置。CLI 使用 `--output-root /mnt/comics -o /mnt/comics/Manga --require-output-marker .nas-ready`。

完整接口、取消与重试语义、显式归档迁移及扩展更新预览见 [Web 后端与任务 API](../../guide/service-api/)。

4.1.0 补齐 CLI：`extensions`、`update --check`、`migrate/--apply`、`list --details`、`search --json`、归档覆盖参数、手动 NAS 保护和逐页终端进度。从 4.0 升级不再变更书架 schema；无需重新安装兼容的 API v1 扩展。迁移前仍须停止写入并备份，改名只会在明确应用预览后执行；详见 [CLI 参考](../../reference/cli/)和[库/CLI 对照](../../guide/library/#cli-与库-api-对照)。
