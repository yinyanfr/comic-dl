---
title: 开发漫画源扩展
description: 让 agent 按 API v1 开发独立来源适配器并完成离线验收。
---

## 加载技能

```sh
npx skills add yinyanfr/comic-dl --skill comic-dl-extension-dev
```

[查看 SKILL.md](https://github.com/yinyanfr/comic-dl/blob/main/skills/comic-dl-extension-dev/SKILL.md) · [安装说明](../)

适用于独立扩展包；配套扩展位于 [comic-dl-extensions](https://github.com/yinyanfr/comic-dl-extensions)，不把站点解析塞入核心。

## 工作流程

1. 先读 API v1 规范和目标仓库约束，确认稳定作品／章节 ID、完整阅读顺序和脱敏样本。
2. 从离线 hello 原型起步，默认导出 `SourceExtension`；使用 `comic-dl/extension` 公开类型。
3. 实现输入匹配、设置验证、认证和有序惰性页面；元数据、搜索、封面按需实现。
4. 用样本与回环 HTTP 验证重定向、凭据边界、取消、受限状态、选章和直链。
5. 打包已编译 ESM，在临时消费项目通过 CLI 与库加载生成的包。

## 示例任务

> 使用 comic-dl-extension-dev，根据我提供的脱敏 HTML／JSON 样本编写来源适配器。保持 API v1，先做离线测试，不访问真实站点，不发布 npm；列出仍需在线验收的能力。

## 安全与验收

- 扩展负责来源逻辑；核心负责编排、重试、归档和进度，界面负责展示。
- 不把 Cookie/key 放进设置声明、搜索结果、封面 URL 或测试样本；跨 origin 不重新附加凭据。
- 缺失元数据不应导致下载失败；不为每条搜索结果额外读取详情。
- 直链缺少目录上下文时不要虚构序号；页序和稳定身份必须经过验证。
- CLI 托管安装不运行生命周期脚本，包中应已有编译入口；发布需另获授权。

参阅[扩展开发](../../extensions/develop/)、[API v1](../../specs/source-extension-v1/)和 [Zerobyw 教学](../../extensions/zerobyw-walkthrough/)。
