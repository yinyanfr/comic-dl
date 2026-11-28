---
title: 安装与使用 Skills
description: 为 AI agent 安装 comic-dl 的 CLI、库、WebUI 部署、扩展开发和核心开发技能。
---

这些 skills 是给 AI agent 的任务指引，不是新的 CLI 命令、漫画源扩展或自动部署脚本。每个技能包含适用场景、执行流程、安全边界和验收要求；实际操作仍受你的授权和项目 `AGENTS.md` 约束。

## 选择技能

| Skill                                   | 适用任务                                |
| --------------------------------------- | --------------------------------------- |
| [comic-dl-cli](./cli/)                  | 搜索、列章、下载、书架、追更和 CLI 排错 |
| [comic-dl-library](./library/)          | 在 Node.js 脚本和服务中使用公开库 API   |
| [comic-dl-webui-deploy](./webui/)       | Docker／NAS 部署、HTTPS、备份和升级     |
| [comic-dl-extension-dev](./extensions/) | 编写和测试独立漫画源扩展                |
| [comic-dl-core-dev](./core/)            | 修改核心、CLI、任务、书架和归档输出     |

任务跨越多层时，可组合加载；不要让扩展承担核心下载职责，或让浏览器直接访问 SQLite。

## 安装

使用 Node.js 24。在要使用 agent 的项目中，通过 [Skills CLI](https://github.com/vercel-labs/skills)查看和选择安装：

```sh
npx skills add yinyanfr/comic-dl --list
npx skills add yinyanfr/comic-dl --skill comic-dl-cli
```

按安装器提示选择 agent；在 agent 环境中也可能自动识别。默认安装到当前项目，添加 `-g` 才是用户级安装。安装前审阅内容，不要在无人确认时使用全局或全 agent 安装。安装后按所用 agent 的技能加载方式使用，不假设存在统一的斜杠命令。

从本地 comic-dl 源码安装（也适合尚未推送的技能修改）：

```sh
npx skills add . --list
npx skills add . --skill comic-dl-cli
```

不使用安装器时，将所需的 `skills/<name>/` 目录复制到 agent 支持的技能目录，保留 `SKILL.md`。准确位置由所用 agent 决定。技能正文统一使用英文，网站提供中、英、日三语使用说明；无需安装三个语言副本。

## 给 agent 的任务信息

提供目标、当前版本、运行环境、输入和输出范围、已有配置、允许的变更和验收条件。例如：

> 使用 comic-dl-cli，先检查版本和已安装来源，列出我提供的作品章节。仅下载我确认的章节到指定目录；不要开启追更、修改凭据或迁移已有归档。

请通过受保护的本地配置或环境提供凭据，不要把 Cookie、密码或 API Key 粘贴到公开对话、Issue 和截图中。安装技能不等于授权下载、部署、迁移、发布或删除。

## 版本与维护

技能面向 Node.js 24、核心 4.1+ 和扩展 API v1；WebUI 部署说明以已发布的 0.1.0 为起点，实际部署前核对目标版本文档。以安装版本的 `--help` 和公开类型为准，避免把新参数用于旧版本。

单一正文来源为仓库的 [`skills/`](https://github.com/yinyanfr/comic-dl/tree/main/skills)。安装器可以固定 Git ref 以便复现；请使用实际存在、包含技能的 tag 或 commit，不要假定旧 npm 版本或 Git tag 带有这些文件。

```sh
npx skills check
```

审阅差异后再按需更新。维护时同步技能正文、三语网页和对应 API 文档；离线测试不能替代真实来源或 NAS 验收。
