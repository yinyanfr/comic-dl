---
title: 配置与环境变量
description: 保存常用 CLI 选项，并为漫画源配置认证。
---

第一次写配置时，可以跟着[使用配置文件](../../guide/config-tutorial/)逐步验证。比如用 `comic-dl add @comic-dl/copymanga` 安装扩展后，可以将下面的设置保存为 `copymanga.json`。

```json
{
  "version": 1,
  "source": "copymanga",
  "output": "./downloads",
  "jobs": 2,
  "retries": 2
}
```

配置不会自动发现。显式选项优先于配置，再使用内置默认值。例如 `--jobs 1` 只改变当前命令；给出任何 `--extension` 会替换整个配置扩展列表，用 `add` 安装的扩展仍会加载。本地扩展路径以 `./` 或 `../` 开头，和输出路径一样基于配置文件所在目录。命令行路径则从当前工作目录解析。

所有支持字段、类型和校验规则见[配置文件 v1 规范](../../specs/config-v1/)。

## 环境变量

`COMIC_DL_EXTENSION_DIR` 可覆盖 CLI 的[扩展安装目录](../cli/#安装和管理漫画源)。各漫画源自行定义认证环境变量，例如 Zerobyw 使用 `COMIC_DL_ZEROBYW_COOKIE`。凭据不进入 CLI 配置；具体变量、获取和更新步骤见[各扩展 README](https://github.com/yinyanfr/comic-dl-extensions)。
