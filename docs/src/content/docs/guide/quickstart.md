---
title: 快速入门
description: 安装 comic-dl，加载并认证 Zerobyw，然后下载漫画。
---

下面以 Zerobyw 为例，从安装开始，下载漫画并保存为每章一个 CBZ。命令示例适用于 Bash / Zsh。

## 1. 安装 comic-dl

安装 Node.js 24（自带 npm），然后从仓库构建当前版本：

```sh
node --version
git clone https://github.com/yinyanfr/comic-dl.git
cd comic-dl
npm ci
npm run build
node dist/index.js --help
```

下面的命令均在仓库根目录运行。如果已通过本地安装包安装，改用 `npm exec -- comic-dl` 即可。安装包的生成和安装方式见[独立打包](../../extensions/develop/#独立打包)。

## 2. 添加漫画源

Zerobyw 扩展已随仓库的 npm workspace 安装和构建。通过 `--extension` 加载它，确认 `sources` 输出中包含 `zerobyw`：

```sh
node dist/index.js sources --extension @comic-dl/zerobyw
```

`--extension` 指定扩展包，`--source` 指定从中使用的源 ID。为避免每次都填写这两个参数，在仓库根目录新建 `zerobyw.json`：

```json
{
  "version": 1,
  "extensions": ["@comic-dl/zerobyw"],
  "source": "zerobyw",
  "output": "./downloads"
}
```

以后用 `--config ./zerobyw.json` 加载上述设置。`output` 相对于配置文件所在目录。添加其他源时，安装其 npm 扩展包或准备好本地 ESM 文件（例如 `./my-source.mjs`），再用同样的方法加载并确认源 ID。

## 3. 登录并配置 Cookie

搜索公开目录不需要登录。列出章节和下载需要有效的 Zerobyw 会话：

1. 在浏览器登录 [Zerobyw](https://www.zerobyw33.com/)，打开一个作品详情页。
2. 打开开发者工具的「网络」（Network）面板并刷新页面。选中发往 `www.zerobyw33.com` 的作品详情页请求，在「请求标头」（Request Headers）中复制 `Cookie` 的值。
3. 把 Cookie 值保存到仓库外的本地文件，例如 `~/zerobyw-cookie.txt`。不要把它放进 `zerobyw.json` 或提交到 Git。在之后要运行下载命令的同一个终端中执行：

```sh
export COMIC_DL_ZEROBYW_COOKIE="$(cat "$HOME/zerobyw-cookie.txt")"
```

如果提示会话缺失或已过期，重新登录、更新 Cookie 文件，然后再次执行 `export`。其他源的认证方式以各自的扩展文档为准。

## 4. 搜索并下载

按标题搜索，复制结果第一列的作品 URL。省略关键词可浏览目录；如提示有下一页，加上 `--page 2` 查看。

```sh
node dist/index.js search '漫画标题' --config ./zerobyw.json
```

把下面的示例地址替换为真实作品 URL。先列章节，再用输出第一列的实际章节 ID 下载；`101` 和 `105` 仅为示例：

```sh
series_url='https://www.zerobyw33.com/pc/details/?kuid=作品ID'
node dist/index.js list "$series_url" --config ./zerobyw.json
node dist/index.js download "$series_url" --config ./zerobyw.json \
  --chapter 101 --chapter 105
```

省略 `--chapter` 可下载整个系列。若已有单章阅读页 URL，可直接用 `node dist/index.js chapter '<章节 URL>' --config ./zerobyw.json`。

下载结果在 `./downloads/`。系列下载会把无权限的章节记为 `restricted`，继续处理可读章节；重跑时，已有的完整 CBZ 会记为 `skipped`。
