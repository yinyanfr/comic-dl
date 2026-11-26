---
title: 参与项目开发
description: 本地开发、测试、代码边界与文档站维护。
---

## 环境和检查

项目使用 Node.js 24。核心采用原生 ESM 和 TypeScript `NodeNext`；相对模块导入使用运行时 `.js` 扩展名。

```sh
npm ci
npm run check
npm test
node dist/index.js --help
```

`npm run check` 检查格式、类型和 lint；`npm test` 构建核心并运行离线回归。手动验证列章和 CBZ 输出可参考[本地开发测试](../local-testing/)。各站点扩展的源码和测试位于 [comic-dl-extensions](https://github.com/yinyanfr/comic-dl-extensions)，使用本地模拟服务和样本，无需真实站点凭据。Husky 只检查暂存文件，提交前仍应运行完整检查。

## 代码边界

| 路径                                       | 职责                                        |
| ------------------------------------------ | ------------------------------------------- |
| `src/index.ts`、`src/config.ts`            | CLI、配置、展示和退出码                     |
| `src/library.ts`、`src/extension-store.ts` | 库入口、CLI 扩展安装和发现                  |
| `src/extension.ts`、`src/sources/`         | 公开扩展接口、源加载、HTTP 助手与内置测试源 |
| `src/download.ts`                          | 下载编排、并发、暂态重试、取消和结果汇总    |
| `src/output/`                              | 安全输出路径、CBZ 写入与完整性检查          |
| `test/`                                    | 核心 CLI、下载和输出的回归测试              |

涉及站点的识别、认证和解析放在扩展侧。下载服务接收源给出的章节和有序页面，不解释站点 URL。写归档时，输出层先生成临时文件，再将完成的 CBZ 移到最终路径。当前实现会校验归档标记、页序和 CRC 才跳过已有归档；文件命名和标记格式属于实现细节。

## 维护文档网站

简体中文文档位于 `docs/src/content/docs/`，英文文档在 `docs/src/content/docs/en/`。同一页面在两个语言目录中使用相同的相对文件名，方便读者切换语言。修改接口时，同时更新两个版本，并检查对应的参考页和规范。CLI 和文档站分别安装依赖：

```sh
npm ci --prefix docs
npm run dev --prefix docs
npm run build --prefix docs
npm run preview --prefix docs
```

本地预览从 `/comic-dl/` 或 `/comic-dl/en/` 进入，和 [GitHub Pages](https://yinyanfr.github.io/comic-dl/) 的子路径一致。涉及文档的 PR 会验证构建，每次推送到 `main` 都会部署。仓库的 **Settings → Pages → Source** 须设为 **GitHub Actions**。

## 发布到 npm

更新版本可用 `npm version <版本> --no-git-tag-version`，并将 `package.json` 与 `package-lock.json` 一起提交。推送到 `main` 时，[发布工作流](https://github.com/yinyanfr/comic-dl/actions/workflows/publish-npm.yml)对比推送前后的版本；只有版本变化时才检查、测试、打包和发布。npm 预发布版使用 `next`，正式版使用 `latest`。npm 发布成功或确认版本已存在后，工作流会用版本号作为 Git tag，在本次提交上创建 GitHub Release 并自动生成发布说明。预发布版在 GitHub 上也会标为预发布；重跑时会跳过已有的正式或预发布 Release。

工作流合入后，在 npm 的 `comic-dl` 包设置中添加 [GitHub Actions Trusted Publisher](https://docs.npmjs.com/trusted-publishers/)：所有者 `yinyanfr`、仓库 `comic-dl`、工作流文件 `publish-npm.yml`，环境留空，并启用直接发布（`npm publish`）。无需配置 npm Token。请在下一次版本变更发布前配置；新的信任绑定必须在两天内完成首次发布。
