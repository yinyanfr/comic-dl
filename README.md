# comic-dl

comic-dl 是一个可通过扩展添加漫画源的命令行工具和 TypeScript 库，每章保存为一个 CBZ。

```sh
comic-dl d "https://www.copy20.com/comic/xiangkanbaitiantongxuederuanruobiaoqing"
```

安装下文的 CopyManga 扩展后，贴上作品链接即可自动选源，把整部漫画下载到当前目录。`d` 是 `download` 的简写。

```sh
comic-dl d xiangkanbaitiantongxuederuanruobiaoqing --source copymanga -o ~/manga -c 2-4
```

也可以直接用作品短 ID。`-o` 指定下载目录，`-c 2-4` 按阅读顺序下载第 2 到第 4 个章节（含两端）。范围超出章节列表时，命令会报错，且不会开始下载。

## 安装

使用 Node.js 24。新版目前是 alpha。核心不附带在线漫画源，CLI 通过 `add` 安装扩展：

```sh
npm install -g comic-dl@3.0.0-alpha
comic-dl add @comic-dl/copymanga
comic-dl sources
```

`comic-dl update @comic-dl/copymanga` 更新单个扩展，`comic-dl update` 更新全部，`comic-dl remove @comic-dl/copymanga` 卸载。我们维护的扩展位于 [comic-dl-extensions](https://github.com/yinyanfr/comic-dl-extensions)；第三方也可独立发布 npm 包。

## 在项目中使用

```sh
npm install comic-dl@3.0.0-alpha @comic-dl/zerobyw
```

```typescript
import downloader from 'comic-dl';
import zerobyw from '@comic-dl/zerobyw';

downloader.use(zerobyw);

// 将链接换成要下载的作品；Zerobyw 需要有效的登录会话。
const results = await downloader.download(
  'https://www.zerobyw33.com/pc/details/?kuid=123',
  {
    directory: './downloads',
  },
);
console.log(results);
```

## 文档

- [快速入门](https://yinyanfr.github.io/comic-dl/guide/quickstart/)：安装、搜索、列章与下载
- [CLI 命令](https://yinyanfr.github.io/comic-dl/reference/cli/)：命令简写、章节选择和配置
- [在项目中使用](https://yinyanfr.github.io/comic-dl/guide/library/)：注册扩展、列章、下载和获取章节结果
- [CopyManga 指南](https://yinyanfr.github.io/comic-dl/guide/copymanga/)与 [Zerobyw 用法](https://yinyanfr.github.io/comic-dl/guide/quickstart/#使用-zerobyw)
- [离线下载示例](https://yinyanfr.github.io/comic-dl/guide/fixture/)与[旧版迁移指南](https://yinyanfr.github.io/comic-dl/guide/migration/)
- [项目开发](https://yinyanfr.github.io/comic-dl/development/contributing/)与[漫画源扩展开发](https://yinyanfr.github.io/comic-dl/extensions/develop/)
