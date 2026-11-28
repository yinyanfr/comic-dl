---
title: Deploy WebUI
description: Guide agents through secure Docker, NAS, HTTPS, backup, and upgrade planning.
---

## Load the skill

```sh
npx skills add yinyanfr/comic-dl --skill comic-dl-webui-deploy
```

[Read SKILL.md](https://github.com/yinyanfr/comic-dl/blob/main/skills/comic-dl-webui-deploy/SKILL.md) · [Installation](../)

For single-user, single-instance operations, not WebUI source changes or implicit permission to modify a server.

## Workflow

1. Establish architecture, Docker Compose, UID/GID, existing paths, access network, and backup location.
2. Read complete Compose configuration for the target release and pin its image tag or digest. The documented starting point is 0.1.0.
3. Preserve non-root execution, read-only root, restricted privileges, real-path checks, and shutdown grace. Supply secrets privately.
4. Start only when authorized; configure exact Origin, HTTPS, and SSE, then verify login, tasks, and an actual archive.
5. Stop all writers and back up data and comic identity metadata before upgrades. Match schema and backups for rollback.

## Example request

> Use comic-dl-webui-deploy to review my NAS setup and propose a deployment plan with confirmation points. Do not change the server. Keep SQLite local, preserve comic directory permissions, use VPN and HTTPS, and document backup and rollback.

## Safety and acceptance

- Bind loopback by default, avoid direct public exposure, and do not deploy under a subpath such as `/comics/`.
- Use a nonempty password; never share resolved Compose secrets, mount Docker socket, or hide errors with root/`chmod 777`.
- Never auto-create mount markers. Do not put SQLite on cross-machine SMB/NFS.
- `healthy` only confirms HTTP response. Validate persistence, real downloads, mount recovery, SSE, and cleanup.
- PWA needs trusted HTTPS except localhost and does not support offline reading.

See [WebUI deployment](../../webui/deployment/) for full configuration and acceptance, and [usage](../../webui/usage/) for operations.
