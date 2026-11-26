---
title: 安装本体与添加漫画源
description: 安装 comic-dl CLI，并添加、更新或移除独立的漫画源扩展。
---

## 安装 comic-dl

先安装 Node.js 24（自带 npm），再安装 CLI。

```sh
node --version
npm install -g comic-dl
comic-dl --version
```

核心不含在线漫画源。要下载某个网站或自托管书库的漫画，先添加相应的扩展。

## 添加漫画源

在 [comic-dl-extensions](https://github.com/yinyanfr/comic-dl-extensions) 查找项目维护的扩展，也可以使用第三方独立发布的兼容扩展。按扩展 README 找到 npm 包名，例如：

```sh
comic-dl add @comic-dl/copymanga
comic-dl sources
```

`add` 安装扩展，后续 CLI 命令会自动加载。`sources` 中的 `copymanga` 是源 ID，用于 `--source`；`add`、`update`、`remove` 用的是 npm 包名 `@comic-dl/copymanga`。列表里的 `fixture` 是[本地开发测试源](../../development/local-testing/)。

<span id="使用-zerobyw"></span>
<span id="登录并配置-cookie"></span>

## 按来源配置登录

有些源需另行配置登录。安装前可先查阅各自的 README：例如 [Zerobyw](https://github.com/yinyanfr/comic-dl-extensions/tree/main/extensions/zerobyw) 用 Cookie 列章和下载，[Komga](https://github.com/yinyanfr/comic-dl-extensions/tree/main/extensions/komga) 和 [Kavita](https://github.com/yinyanfr/comic-dl-extensions/tree/main/extensions/kavita) 需要服务器地址和密钥。CopyManga 无需登录，可以直接开始[简单的使用](../basic/)。

## 更新或移除漫画源

```sh
comic-dl update @comic-dl/copymanga
comic-dl update
comic-dl remove @comic-dl/copymanga
```

带包名的 `update` 更新单个扩展，省略包名更新全部已安装的扩展。更新遵守原先保存的 npm 版本范围；要换到范围之外的版本，可以再次运行 `comic-dl add '包名@版本'`。`remove` 只卸载扩展，已下载的 CBZ 会保留。
