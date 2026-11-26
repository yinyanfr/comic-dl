---
title: 使用配置文件
description: 保存默认漫画源、输出目录与重试设置，并在命令行临时覆盖。
---

常用选项可以保存成 JSON，用 `--config` 显式加载。以下以[已添加的 CopyManga 扩展](../quickstart/#添加漫画源)为例。

## 保存默认设置

创建 `./profiles/copymanga.json`：

```json
{
  "version": 1,
  "source": "copymanga",
  "output": "./manga",
  "jobs": 2,
  "retries": 2
}
```

`version` 必须是数字 `1`；`source` 填 `comic-dl sources` 显示的源 ID。`jobs` 和 `retries` 分别是章节并发数和暂态错误的额外重试次数。用 `add` 安装的扩展会自动加载，无需在 JSON 里再列一遍。

## 从命令行加载

在 `profiles/` 的上级目录运行：

```sh
comic-dl l xiangkanbaitiantongxuederuanruobiaoqing --config ./profiles/copymanga.json
comic-dl d xiangkanbaitiantongxuederuanruobiaoqing --config ./profiles/copymanga.json -c 2-4
```

CLI 不会自动查找配置，每条命令都要传入 `--config`。配置里的相对输出路径以 **JSON 文件所在目录** 为基准，所以这里会写到 `./profiles/manga/`。如果没有配置文件或命令行提供输出目录，`download` 默认写到当前工作目录。

## 临时覆盖设置

```sh
comic-dl d xiangkanbaitiantongxuederuanruobiaoqing --config ./profiles/copymanga.json -c 2-4 -o ./preview --jobs 1
```

命令行参数优先，JSON 不会被改写。命令行上的相对路径以**当前工作目录**为基准，所以示例会写到 `./preview/`，而不是 `./profiles/preview/`。也可以用 `--source` 临时改用其他源。

可以为不同来源或下载目录保存多份配置，运行时选择对应的文件。Cookie、API Key 等凭据按各[扩展 README](https://github.com/yinyanfr/comic-dl-extensions)的说明配置。完整字段和高级用法见[配置与环境变量](../../reference/config/)。
