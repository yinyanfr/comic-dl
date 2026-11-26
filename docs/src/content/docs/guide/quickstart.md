---
title: 快速入门
description: 安装 comic-dl，直接下载作品，或配置 Zerobyw 后搜索并下载。
---

comic-dl 将漫画每章保存为一个 CBZ。命令示例适用于 Bash / Zsh。

## 安装 comic-dl

安装 Node.js 24（自带 npm），再安装新版 CLI 的 alpha 版本。核心不附带在线漫画源。

```sh
npm install -g comic-dl@3.0.0-alpha
comic-dl --help
```

如果要从源码构建，可以改用：

```sh
node --version
git clone https://github.com/yinyanfr/comic-dl.git
cd comic-dl
npm ci
npm run build
npm link
comic-dl --help
```

`npm link` 让你可以在任意下载目录运行 `comic-dl`。也可以跳过这一步，在仓库里用 `node dist/index.js` 调用。

## 从链接下载

先安装 CopyManga 扩展，然后进入希望保存漫画的目录，贴上作品链接即可下载：

```sh
comic-dl add @comic-dl/copymanga
comic-dl d "https://www.copy20.com/comic/xiangkanbaitiantongxuederuanruobiaoqing"
```

要用短 ID、指定目录和选择章节范围，可以写成：

```sh
comic-dl d xiangkanbaitiantongxuederuanruobiaoqing --source copymanga -o ~/manga -c 2-4
```

`2-4` 代表当前章节列表按阅读顺序的第 2 到第 4 项。按稳定 ID 选择的方法见 [CLI 命令参考](../../reference/cli/#选择章节)。

## 使用 Zerobyw

运行 `comic-dl add @comic-dl/zerobyw` 安装扩展，再用 `comic-dl sources` 确认列表中包含 `zerobyw`。为避免重复指定源和目录，可新建 `zerobyw.json`：

```json
{
  "version": 1,
  "source": "zerobyw",
  "output": "./downloads"
}
```

以后用 `--config ./zerobyw.json` 加载上述设置。`output` 相对于配置文件所在目录。想从头试一遍配置、路径和临时覆盖，可以跟着[配置文件教程](../config-tutorial/)操作。

### 登录并配置 Cookie

搜索公开目录不需要登录。列出章节和下载需要有效的 Zerobyw 会话：

1. 在浏览器登录 [Zerobyw](https://www.zerobyw33.com/)，打开一个作品详情页。
2. 打开开发者工具的「网络」（Network）面板并刷新页面。选中发往 `www.zerobyw33.com` 的作品详情页请求，在「请求标头」（Request Headers）中复制 `Cookie` 的值。
3. 把 Cookie 值保存到仓库外的本地文件，例如 `~/zerobyw-cookie.txt`。不要把它放进 `zerobyw.json` 或提交到 Git。在之后要运行下载命令的同一个终端中执行：

```sh
export COMIC_DL_ZEROBYW_COOKIE="$(cat "$HOME/zerobyw-cookie.txt")"
```

如果提示会话缺失或已过期，重新登录、更新 Cookie 文件，然后再次执行 `export`。其他源的认证方式以各自的扩展文档为准。

### 搜索并下载

按标题搜索，复制结果第一列的作品 URL。省略关键词可浏览目录；如提示有下一页，加上 `--page 2` 查看。

```sh
comic-dl search '漫画标题' --config ./zerobyw.json
```

把下面的示例地址替换为真实作品 URL。先列章节，再用输出第一列的实际章节 ID 下载；`101` 和 `105` 仅为示例：

```sh
series_url='https://www.zerobyw33.com/pc/details/?kuid=作品ID'
comic-dl list "$series_url" --config ./zerobyw.json
comic-dl download "$series_url" --config ./zerobyw.json \
  --chapter 101 --chapter 105
```

省略 `--chapter` 可下载整个系列。若已有单章阅读页 URL，可直接用 `comic-dl chapter '<章节 URL>' --config ./zerobyw.json`。

下载结果在 `./downloads/`。系列下载会把无权限的章节记为 `restricted`，继续处理可读章节；重跑时，已有的完整 CBZ 会记为 `skipped`。
