---
title: 开发核心
description: 让 agent 保持架构边界、输出安全和离线回归，修改 comic-dl 核心。
---

## 加载技能

```sh
npx skills add yinyanfr/comic-dl --skill comic-dl-core-dev
```

[查看 SKILL.md](https://github.com/yinyanfr/comic-dl/blob/main/skills/comic-dl-core-dev/SKILL.md) · [安装说明](../)

适用于核心库、CLI、任务、书架与输出层；这是 TypeScript 从零重写，不是旧下载器的迁移。

## 工作流程

1. 阅读 `AGENTS.md`、检查工作区，保留用户现有变更；使用 `.node-version` 的 Node.js 24。
2. 定位正确模块，先用离线来源复现并补回归，再做最小改动。
3. 保持原生 ESM／NodeNext，相对导入写 `.js`，不手改生成的 `dist/`。
4. 验证公开结果、取消、重试、任务持久性、路径保护和迁移不覆盖语义。
5. 运行完整检查和测试，涉及公开行为时同步三语文档、规范及技能。

```sh
npm ci
npm run check
npm test
npm run build
node dist/index.js
```

## 示例任务

> 使用 comic-dl-core-dev，修复我描述的取消回归。先加离线失败测试，再改核心；保留 CLI stdout 和退出码，不触碰真实书架和下载目录，不提交、不推送。

## 安全与验收

- 站点识别、认证和解析留在扩展，WebUI 留在独立仓库。
- 保留身份／完整性校验、原子提交、NAS 保护和迁移冲突检查。
- 数据库改动需迁移／回退测试；不要随意提升 schema 或扩展 API 版本。
- Husky 不能替代完整检查；不把本机测试描述为 Windows、真实站点或 NAS 验收。
- 发布、部署、归档迁移和丢弃已有变更都不属于默认授权。

参阅[参与开发](../../development/contributing/)、[本地测试](../../development/local-testing/)和[服务 API](../../guide/service-api/)。
