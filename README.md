# comic-dl

comic-dl 是一个可扩展的命令行漫画下载器，每章保存为一个 CBZ。

```sh
comic-dl d "https://www.copy20.com/comic/xiangkanbaitiantongxuederuanruobiaoqing"
```

贴上作品链接，comic-dl 会自动选用 CopyManga，把整部漫画下载到当前目录。`d` 是 `download` 的简写。

```sh
comic-dl d xiangkanbaitiantongxuederuanruobiaoqing --source copymanga -o ~/manga -c 2-4
```

也可以直接用作品短 ID。`-o` 指定下载目录，`-c 2-4` 按阅读顺序下载第 2 到第 4 个章节（含两端）。范围超出章节列表时，命令会报错，且不会开始下载。

## 安装

使用 Node.js 24，从仓库构建并启用 `comic-dl` 命令：

```sh
git clone https://github.com/yinyanfr/comic-dl.git
cd comic-dl
npm ci
npm run build
npm link
```

## 文档

- [快速入门](https://yinyanfr.github.io/comic-dl/guide/quickstart/)：安装、搜索、列章与下载
- [CLI 命令](https://yinyanfr.github.io/comic-dl/reference/cli/)：命令简写、章节选择和配置
- [CopyManga 指南](https://yinyanfr.github.io/comic-dl/guide/copymanga/)与 [Zerobyw 用法](https://yinyanfr.github.io/comic-dl/guide/quickstart/#使用-zerobyw)
- [离线下载示例](https://yinyanfr.github.io/comic-dl/guide/fixture/)与[旧版迁移指南](https://yinyanfr.github.io/comic-dl/guide/migration/)
- [项目开发](https://yinyanfr.github.io/comic-dl/development/contributing/)与[漫画源扩展开发](https://yinyanfr.github.io/comic-dl/extensions/develop/)
