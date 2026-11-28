---
title: Install and use skills
description: Agent skills for comic-dl CLI, library integration, WebUI deployment, extensions, and core development.
---

These skills are instructions for AI agents, not new CLI commands, source adapters, or automatic deployment scripts. Each defines when to use it, a workflow, safety boundaries, and acceptance criteria. Actions still require your authorization and must respect the project's `AGENTS.md`.

## Choose a skill

| Skill                                   | Task                                                            |
| --------------------------------------- | --------------------------------------------------------------- |
| [comic-dl-cli](./cli/)                  | Search, list, download, shelf, watcher, and CLI troubleshooting |
| [comic-dl-library](./library/)          | Public APIs in Node.js scripts and servers                      |
| [comic-dl-webui-deploy](./webui/)       | Docker/NAS deployment, HTTPS, backup, and upgrades              |
| [comic-dl-extension-dev](./extensions/) | Independent source adapter development and testing              |
| [comic-dl-core-dev](./core/)            | Core, CLI, tasks, shelf, and archive output changes             |

Combine skills for cross-layer tasks without moving source logic into the scheduler or exposing SQLite to browsers.

## Install

Use Node.js 24. In the project where you use your agent, inspect and install through the [Skills CLI](https://github.com/vercel-labs/skills):

```sh
npx skills add yinyanfr/comic-dl --list
npx skills add yinyanfr/comic-dl --skill comic-dl-cli
```

Select your agent when prompted; the installer may detect it automatically inside an agent environment. Installation is project-local by default; `-g` selects user-wide installation. Review the instructions first and do not install globally or for all agents without confirmation. Load skills using your agent's supported mechanism; there is no assumed universal slash command.

From a local comic-dl checkout, including unpublished skill edits:

```sh
npx skills add . --list
npx skills add . --skill comic-dl-cli
```

Without an installer, copy the selected `skills/<name>/` folder into your agent's supported skill directory, retaining `SKILL.md`. The exact location depends on the agent. Canonical skill instructions are in English; these guides are available in Chinese, English, and Japanese. Do not install three language copies.

## Provide task context

Supply the goal, version, environment, input/output scope, existing configuration, permitted changes, and acceptance criteria. For example:

> Use comic-dl-cli to inspect the version and installed sources, then list chapters for my input. Download only the chapters I confirm into the specified directory. Do not enable following, change credentials, or migrate archives.

Provide secrets through protected local configuration or environment, not public chats, issues, or screenshots. Installing a skill does not authorize downloading, deploying, migrating, publishing, or deleting.

## Versions and maintenance

Skills target Node.js 24, core 4.1+, and extension API v1. The WebUI deployment starting point is published version 0.1.0; read the target release's documentation before deployment. Installed `--help` and public types determine actual availability.

The canonical instructions are in [`skills/`](https://github.com/yinyanfr/comic-dl/tree/main/skills). Pin a real Git tag or commit containing these files for reproducibility; do not assume older npm releases or Git tags contain them.

```sh
npx skills check
```

Review differences before updating. Keep skill instructions, the three-language guides, and API documentation consistent. Offline tests do not replace live-source or NAS acceptance.
