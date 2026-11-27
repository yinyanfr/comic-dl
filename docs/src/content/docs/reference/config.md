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

## 来源运行时设置

运行 `comic-dl sources --source <id> --options` 查看扩展声明的设置、默认值和可选值。把要覆盖的值按来源 ID 保存到 `sourceSettings`，例如：

```json
{
  "version": 1,
  "sourceSettings": {
    "copymanga": { "site-url": "https://www.copy20.com" }
  }
}
```

用 `--config <file>` 加载，或用可重复的 `--set <id>.<key>=<value>` 临时覆盖单项。优先级为 `--set`、配置文件、扩展声明兼容的环境变量、扩展默认值。Cookie、密码和 API key 仍由扩展管理。

设置也用于 URL 自动选源和联网的书架操作。修改 `shelf watch` 使用的配置后，需重启 watcher。

## 环境变量

4.x 的归档配置可写为 `"archive": { "template": "{title}/{number}-{chapter}", "padding": 3, "format": "zip" }`，对手动下载和 watcher 生效。默认格式为 CBZ，不补零；更改设置不会自动重命名现有归档，见[迁移与命名](../../guide/service-api/)。

`COMIC_DL_EXTENSION_DIR` 可覆盖 CLI 的[扩展安装目录](../cli/#安装和管理漫画源)。各漫画源自行定义认证环境变量，例如 Zerobyw 使用 `COMIC_DL_ZEROBYW_COOKIE`。凭据不进入 CLI 配置；具体变量、获取和更新步骤见[各扩展 README](https://github.com/yinyanfr/comic-dl-extensions)。
