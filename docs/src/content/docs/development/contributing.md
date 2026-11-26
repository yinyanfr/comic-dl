---
title: 参与项目开发
description: 本地开发、测试、代码边界与文档站维护。
---

## 环境和检查

在 `revive` 分支使用 Node.js 24。核心采用原生 ESM 和 TypeScript `NodeNext`；相对模块导入使用运行时 `.js` 扩展名。旧实现保留在 `legacy`，供查看历史行为。

```sh
npm ci
npm run check
npm test
node dist/index.js --help
```

`npm run check` 检查格式、类型和 lint；`npm test` 构建核心与扩展，并运行离线回归。用 `npm test --workspace @comic-dl/zerobyw` 单独运行 Zerobyw 测试。站点测试使用回环 HTTP 和最小 HTML 样本，不需要真实 Cookie。Husky 只检查暂存文件，提交前仍应运行完整检查。

## 代码边界

| 路径                                           | 职责                                        |
| ---------------------------------------------- | ------------------------------------------- |
| `src/index.ts`、`src/config.ts`                | CLI、配置、展示和退出码                     |
| `src/extension.ts`、`src/sources/`             | 公开扩展接口、源加载、HTTP 助手与内置测试源 |
| `src/download.ts`                              | 下载编排、并发、暂态重试、取消和结果汇总    |
| `src/output/`                                  | 安全输出路径、CBZ 写入与完整性检查          |
| `extensions/zerobyw/`、`extensions/copymanga/` | 各源的识别、会话、站点解析与集成测试        |
| `test/`                                        | 核心 CLI、下载和输出的回归测试              |

涉及站点的识别、认证和解析放在扩展侧。下载服务接收源给出的章节和有序页面，不解释站点 URL。写归档时，输出层先生成临时文件，再将完成的 CBZ 移到最终路径。当前实现会校验归档标记、页序和 CRC 才跳过已有归档；文件命名和标记格式属于实现细节。

## 维护文档网站

文档正文位于 `docs/src/content/docs/`，使用简体中文 Markdown。修改接口时，同时检查对应的参考页和规范。CLI 和文档站分别安装依赖：

```sh
npm ci --prefix docs
npm run dev --prefix docs
npm run build --prefix docs
npm run preview --prefix docs
```

本地预览从 `/comic-dl/` 进入，和 [GitHub Pages](https://yinyanfr.github.io/comic-dl/) 的子路径一致。PR 会验证文档构建，`revive` 上的文档变更会部署。仓库的 **Settings → Pages → Source** 须设为 **GitHub Actions**。
