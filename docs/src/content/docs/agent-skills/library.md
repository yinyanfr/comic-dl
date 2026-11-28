---
title: 使用库 API
description: 让 agent 通过公开 API 集成下载、任务进度、封面和书架自动化。
---

## 加载技能

```sh
npx skills add yinyanfr/comic-dl --skill comic-dl-library
```

[查看 SKILL.md](https://github.com/yinyanfr/comic-dl/blob/main/skills/comic-dl-library/SKILL.md) · [安装说明](../)

适用于 Node.js 24 ESM 脚本或常驻后端；浏览器不直接加载核心、扩展或 SQLite。

## 工作流程

1. 读取安装版本的公开类型；通过 `createDownloader().use()` 显式注册受信任来源。
2. 先列章，再调用 `download()`／`downloadChapter()`；检查每章结果，不能把 Promise 完成当成全部成功。
3. 使用 `onEvent` 和安全任务快照展示进度；需要取消／重试句柄时使用 `startDownload()`。
4. 通过公开书架接口管理独立自动化开关；停止时 abort watcher，等待结束，再关闭书架。
5. 使用显式注册的 `fixtureExtension` 验证下载；搜索另用支持该契约的测试来源。

## 示例任务

> 使用 comic-dl-library，为我的 Node.js 24 后端接入下载与取消。只用公开 API，将安全任务快照提供给前端；写出离线测试，覆盖部分章节失败、未知总页数和正常关闭。

## 安全与验收

- `createDownloader()` 不会自动读取 CLI 配置或加载 CLI 托管扩展。
- 不解析 CLI 文本、不导入私有 `dist/` 文件，也不直接修改数据库。
- 原始结果含本机路径或诊断，不直接序列化给浏览器；鉴权封面使用受保护的端点。
- 手动任务不跨重启恢复；追更队列持久化，实时页数不持久化。
- 检查取消、重试、输出保护和资源清理，单独报告真实来源／NAS 尚未验收的部分。

详细用法见[库指南](../../guide/library/)、[服务 API](../../guide/service-api/)和[公开 API 参考](../../reference/library-api/)。
