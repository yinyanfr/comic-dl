---
title: 配置与环境变量
description: 保存常用 CLI 选项，并为漫画源配置认证。
---

第一次写配置时，可以跟着[配置文件教程](../../guide/config-tutorial/)逐步验证。先用 `comic-dl add @comic-dl/zerobyw` 安装扩展，再把下面的内容保存为 `zerobyw.json`。

```json
{
  "version": 1,
  "source": "zerobyw",
  "output": "./downloads",
  "jobs": 2,
  "retries": 2
}
```

配置不会自动发现。显式选项优先于配置，再使用内置默认值。例如 `--jobs 1` 只改变当前命令；给出任何 `--extension` 会替换整个配置扩展列表，用 `add` 安装的扩展仍会加载。本地扩展路径以 `./` 或 `../` 开头，和输出路径一样基于配置文件所在目录。命令行路径则从当前工作目录解析。

所有支持字段、类型和校验规则见[配置文件 v1 规范](../../specs/config-v1/)。

## 环境变量

| 变量                      | 使用方              | 用途                                               |
| ------------------------- | ------------------- | -------------------------------------------------- |
| `COMIC_DL_ZEROBYW_COOKIE` | `@comic-dl/zerobyw` | Zerobyw 的 `Cookie` 请求头值；搜索公开目录时不需要 |

各漫画源自行定义认证方式。凭据不进入 CLI 配置；获取和更新 Zerobyw Cookie 的步骤见[快速入门](../../guide/quickstart/#登录并配置-cookie)。
