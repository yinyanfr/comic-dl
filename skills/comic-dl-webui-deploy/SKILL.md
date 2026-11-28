---
name: comic-dl-webui-deploy
description: Deploy and maintain the single-user comic-dl WebUI with Docker Compose or Node.js, including NAS storage, authentication, HTTPS and SSE, backups, upgrades, and rollback. Use for WebUI setup and operations, not changes to WebUI source code.
---

# Deploy comic-dl WebUI

## Plan before changing the host

Read the [deployment guide](https://yinyanfr.github.io/comic-dl/en/webui/deployment/), [usage guide](https://yinyanfr.github.io/comic-dl/en/webui/usage/), and [upstream deployment files](https://github.com/yinyanfr/comic-dl-web). Verify the release version and use matching documentation and Compose configuration.

Collect host architecture, Docker/Compose availability, numeric UID/GID, existing real data/comic paths, local filesystem for SQLite, access network, hostname/TLS, and backup location. Ask about existing services before changing ports, permissions, or files.

This is a single-user, single-process, single-instance service. Prefer trusted LAN/VPN. Do not expose it directly to the public internet. A password is not a replacement for HTTPS or network isolation.

## Compose deployment

The documented release is `ghcr.io/yinyanfr/comic-dl-web:0.1.0` for `linux/amd64` and `linux/arm64`, not ARMv7. Check current release facts before using a different tag. Pin a version or verified digest; do not invent one or use floating `latest`.

Start from the upstream complete `docker-compose.yml`, not an abbreviated production configuration. Preserve:

- Numeric non-root UID/GID, `init`, 90-second shutdown grace.
- Read-only root, dropped capabilities, no-new-privileges.
- Writable `/data`, `/downloads`, and `/tmp` tmpfs only.
- Existing bind paths with `create_host_path: false`.
- Loopback host port binding by default.

Set a strong nonempty administrator password via a private channel. Empty/unset disables authentication. Do not echo secrets, commit deployment files, share resolved Compose output, mount Docker socket, run as root to hide permission errors, or apply blanket `chmod 777`/recursive ownership changes.

Edit environment variables directly in the supplied Compose file; no `.env` or override file is required. Escape literal `$` as `$$` in Compose values; YAML single quotes do not prevent Compose interpolation. Avoid conflicting legacy Compose/override files; back up before moving them.

After reviewing changes and obtaining deployment authorization:

```sh
chmod 600 docker-compose.yml
docker compose config --quiet
docker compose pull
docker compose up -d
docker compose ps
docker compose logs --tail=100 comic-dl-web
```

Do not send unredacted logs to external systems. Environment changes need container recreation with `up -d`; `restart` alone does not update the environment.

## Storage and sources

- Keep `/data` on persistent NAS-local storage; do not put SQLite on cross-machine SMB/NFS.
- Mount the real existing comic directory at `/downloads`. Readers may mount it read-only.
- For an external mount, an administrator places a marker on the actual mount and sets `COMIC_DL_WEB_OUTPUT_MARKER` to its filename. Never auto-create the marker at startup or mask a missing mount with an empty directory.
- Settings and bundled-source credentials may be in `/data/sources.json`; protect backups accordingly.
- Web settings/extension management defaults off. Enable `COMIC_DL_WEB_ENABLE_EXTENSION_MANAGEMENT=1` only when requested. Extensions execute with service permissions.
- Managed adapters override bundled adapters; Web-saved credentials are not injected into managed versions. Bind secrets to the configured source server; never reuse them for another destination silently.

## HTTPS and progress

Use the upstream Nginx example. Configure `COMIC_DL_WEB_ADMIN_ORIGIN` to the exact browser-facing scheme/host/port, without path, trailing slash, or wildcard; preserve Host. Do not disable Origin validation to fix 403s.

Host Nginx uses `127.0.0.1:3000`; a container proxy uses a private shared network and `comic-dl-web:3000`, not its own localhost. Subpath deployment such as `/comics/` is unsupported.

Disable SSE buffering/caching and permit long read timeouts. Protect business pages, APIs, covers, and SSE. PWA installation needs trusted HTTPS except localhost; there is no Service Worker, offline cache, or offline reading.

## Acceptance, backup, and rollback

`healthy` means HTTP responds, not source authentication, writable storage, active watcher, or successful downloads.

Verify login, settings persistence after recreation, shelf, an authorized actual archive/page order, task updates/reconnect, browser-closed work, and mount-loss recovery. Do not deliberately disrupt a live mount without approval. Run only one watcher per shelf.

Before upgrade: stop Web and all shared CLI writers; back up all `/data` including any WAL/SHM, settings, secrets, extensions, private Compose configuration, and comic identity metadata. Store backups outside source directories and test restoration. Pull the target pinned version and recreate, then repeat acceptance. All sessions invalidate; manual queues do not recover, watcher queues do.

For rollback, stop writers again. If schema changed, restore matching old data backups, not only the old image. Reconcile output snapshots without overwriting new comics. Never delete volumes or archives as a troubleshooting shortcut.

Without Docker, follow the guide's Node.js 24 build and dedicated-user service workflow. `node server.ts` needs the project root, server modules, and production dependencies, not only `build/`. Inject application environment explicitly; Node does not auto-load `.env`. Do not use Vite dev server in production.

Report configured version/paths without secrets, commands actually executed, acceptance results, unresolved real-world tests, and rollback readiness. Do not deploy, upgrade, publish, or destroy resources beyond the user's authorization.
