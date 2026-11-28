---
title: 部署 WebUI
description: 让 agent 按安全边界规划和验收 WebUI 的 Docker、NAS 与 HTTPS 部署。
---

## 加载技能

```sh
npx skills add yinyanfr/comic-dl --skill comic-dl-webui-deploy
```

[查看 SKILL.md](https://github.com/yinyanfr/comic-dl/blob/main/skills/comic-dl-webui-deploy/SKILL.md) · [安装说明](../)

适用于单用户、单实例的部署运维，不包含修改 WebUI 源码或自动获得服务器操作权限。

## 工作流程

1. 核对架构、Docker Compose、UID/GID、已有目录、网络入口和备份位置。
2. 读取目标版本的完整 Compose 配置，固定镜像 tag 或摘要；当前文档起点为 `0.1.0`。
3. 保留非 root、只读根、权限收敛、真实路径检查及停止宽限时间；密码通过安全渠道设置。
4. 获准后启动，配置准确 Origin、HTTPS 和 SSE，再检查登录、任务和实际归档。
5. 升级前停止所有写入者并备份数据与漫画身份信息；回退时核对 schema 和匹配备份。

## 示例任务

> 使用 comic-dl-webui-deploy。先审查我的 NAS 配置，给出部署方案与待确认项，不执行服务器变更。SQLite 放本地盘，漫画目录保持原权限，通过 VPN 和 HTTPS 访问；标明备份与回退步骤。

## 安全与验收

- 默认仅绑定回环，不直接暴露公网；不支持 `/comics/` 等子路径部署。
- 认证密码不为空；不公开 Compose 完整展开输出，不挂 Docker socket，不用 root／`chmod 777` 掩盖错误。
- 不自动创建挂载标记；SQLite 不放跨机器 SMB/NFS。
- `healthy` 只说明 HTTP 响应；仍要验收持久化、真实下载、挂载恢复、SSE 和停止清理。
- PWA 需要可信 HTTPS（localhost 除外），不支持离线阅读。

完整配置与验收表见 [WebUI 部署](../../webui/deployment/)，操作说明见 [WebUI 使用](../../webui/usage/)。
