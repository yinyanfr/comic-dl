---
title: 使用 CLI
description: 让 agent 安全地搜索、列章、下载和管理 comic-dl 书架。
---

## 加载技能

```sh
npx skills add yinyanfr/comic-dl --skill comic-dl-cli
```

[查看 SKILL.md](https://github.com/yinyanfr/comic-dl/blob/main/skills/comic-dl-cli/SKILL.md) · [安装说明](../)

适用于命令行操作和脚本排错；开发服务端集成请用[库技能](../library/)。

## 工作流程

1. 核对 Node.js 24、`comic-dl --version`、子命令帮助、来源及输出目录。
2. 仅安装受信任且获准的扩展；区分 npm 包名与 `--source` 的来源 ID。
3. 先用 `search --json`、`list --details` 确认作品和完整章节顺序，再下载所选章节。
4. 自动化读取 JSON，进度走 stderr；日志用 `--progress plain`。逐章核对成功、跳过、受限和失败，不只看进程退出码。
5. 管理追更前确认书架数据库与已有 watcher；更新扩展先运行 `update --check`。

## 示例任务

> 使用 comic-dl-cli。检查已安装来源，列出我提供链接的章节，待我确认后下载第 2–4 项到 `./downloads`。保留旧归档，不安装额外来源，不开启自动追更；最后报告逐章结果。

## 安全与验收

- 首次检查通常只建基线；补历史、启动常驻 watcher 和取消队列需明确意图。
- 同一书架只运行一个 watcher；`shelf tasks` 不提供另一进程的实时页数。
- NAS 标记必须来自真实挂载，不能自动造标记或空目录绕过保护。
- 归档迁移先备份、停写、预览并确认，应用同一预览且不覆盖冲突。
- 未联网时可用仓库的 `hello-extension.mjs` 做离线验证，不假装已验证真实站点。

详细参数见 [CLI 参考](../../reference/cli/)、[书架](../../shelf/manage/)和[追更](../../shelf/updates/)。
