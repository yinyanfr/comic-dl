---
title: 动手编写配置文件
description: 将常用下载参数写进 JSON，验证相对路径和命令行覆盖，再为真实漫画源保存配置。
---

如果每次下载都要填相同的漫画源和输出目录，可以把这些选项保存到 JSON，再用 `--config` 复用。本教程先用离线示例验证配置，再将同样的做法用到 CopyManga。开始前，请按[快速入门](../quickstart/#安装-comic-dl)构建仓库并启用 `comic-dl` 命令。

## 1. 把命令行选项写进 JSON

在仓库根目录运行下面的命令，把示例扩展复制到临时目录：

```sh
demo="$(mktemp -d)"
cp examples/hello-extension.mjs "$demo/hello.mjs"
```

在同一目录创建 `hello.json`（也就是 `$demo/hello.json`），写入：

```json
{
  "version": 1,
  "extensions": ["./hello.mjs"],
  "source": "hello",
  "output": "./downloads"
}
```

- `version` 必须是数字 `1`。JSON 使用双引号，不写注释或尾随逗号。
- `extensions` 对应 `--extension`，这里加载配置文件旁的 `hello.mjs`。
- `source` 对应 `--source`，填扩展声明的源 ID `hello`。
- `output` 对应 `--output`，这里保存到配置文件旁的 `downloads/`。

## 2. 加载配置，验证输出位置

在同一个终端依次运行：

```sh
comic-dl sources --config "$demo/hello.json"
comic-dl list demo --config "$demo/hello.json"
comic-dl download demo --config "$demo/hello.json"
```

预期源列表里有 `hello`，列章结果是 `welcome` 和标题 `Welcome`，下载后能在 `$demo/downloads/` 找到一个 CBZ。即使从仓库根目录运行，配置里的 `./hello.mjs` 和 `./downloads` 也以 **JSON 文件所在的目录** 为基准。`--config` 需要每次显式传入，CLI 不会自动搜索配置。

## 3. 临时改用其他输出目录

试着在命令行指定 `-o`（`--output`）：

```sh
mkdir "$demo/run"
(
  cd "$demo/run"
  comic-dl download demo --config ../hello.json -o ./preview
)
```

这次 CBZ 会写到 `$demo/run/preview/`。命令行上的相对路径以**当前工作目录**为基准，且命令行选项优先于配置文件；`hello.json` 里的 `output` 不会被改写。类似地，`--source` 可临时替换默认源。传入 `--extension` 时会替换整个配置扩展列表，用 `add` 安装的扩展仍会加载。

## 4. 为日常下载保存一份配置

先运行 `comic-dl add @comic-dl/copymanga`，再在希望存放下载目录的位置创建 `copymanga.json`。用 `add` 安装的扩展会自动加载，所以这里可以省略 `extensions`。

```json
{
  "version": 1,
  "source": "copymanga",
  "output": "./manga",
  "jobs": 2,
  "retries": 2
}
```

`jobs` 是同时下载的章节数，`retries` 是暂态失败后最多额外尝试的次数。进入 `copymanga.json` 所在目录，先列章，再下载第 2 到第 4 个章节：

```sh
comic-dl l xiangkanbaitiantongxuederuanruobiaoqing --config ./copymanga.json
comic-dl d xiangkanbaitiantongxuederuanruobiaoqing --config ./copymanga.json -c 2-4
```

也可以为不同来源或下载目录分别保存配置，运行时换一个 `--config` 路径即可。需要登录的来源仍按各自文档提供凭据，例如 Zerobyw 使用[环境变量中的 Cookie](../quickstart/#登录并配置-cookie)。JSON 里只保存普通选项。完整字段和取值见[配置文件 v1 规范](../../specs/config-v1/)。
