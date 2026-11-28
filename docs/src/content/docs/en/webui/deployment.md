---
title: Deployment
description: Deploy comic-dl-web with Docker Compose or Node.js, including NAS storage, HTTPS, backups, and upgrades.
---

comic-dl-web targets a single user, process, and instance. Run it on the NAS, keep SQLite on local persistent storage, and write comics directly into a local shared directory. Prefer localhost, a trusted LAN, or a VPN. **Direct public exposure is not recommended.** An administrator password does not replace network isolation or HTTPS.

For UI workflows, see [Usage](../usage/). Deployment files live in the [comic-dl-web repository](https://github.com/yinyanfr/comic-dl-web). Use the image, Compose files, and documentation from the same version.

## Artifacts and release status

The published image is `ghcr.io/yinyanfr/comic-dl-web:0.1.0`, supporting `linux/amd64` and `linux/arm64`, not ARMv7. Docker selects the matching architecture automatically. The repository provides a complete [`docker-compose.yml`](https://github.com/yinyanfr/comic-dl-web/blob/main/docker-compose.yml), Dockerfile, and host-Nginx example.

Pull the published image directly; no source checkout or local build is needed. Use a fixed version or a digest from the Release, not a floating `latest`. Publication does not imply that your NAS, reader, or real sources have been validated.

## Docker Compose quick start

Install Docker Engine and the Docker CLI with the Compose plugin. If a NAS GUI cannot preserve `create_host_path: false`, numeric UID/GID, and the stop grace period, use Compose over SSH instead of silently losing these protections.

1. Create a dedicated deployment directory and save this complete configuration as `docker-compose.yml`. All variables are defined directly in `environment`; **no `.env`, shell-variable injection, or override file is required**:

   ```yaml
   services:
     comic-dl-web:
       image: ghcr.io/yinyanfr/comic-dl-web:0.1.0
       user: '1000:1000'
       init: true
       restart: unless-stopped
       stop_grace_period: 90s
       read_only: true
       cap_drop:
         - ALL
       security_opt:
         - no-new-privileges:true
       tmpfs:
         - /tmp:rw,nosuid,nodev,size=512m,mode=1777
       ports:
         - '127.0.0.1:3000:3000'
       environment:
         NODE_ENV: production
         HOST: 0.0.0.0
         PORT: '3000'
         HOME: /tmp
         COMIC_DL_WEB_OUTPUT: /downloads
         COMIC_DL_WEB_SHELF: /data/shelf.sqlite
         COMIC_DL_WEB_SOURCE_STATE: /data/sources.json
         COMIC_DL_WEB_EXTENSION_DIR: /data/extensions
         COMIC_DL_WEB_ADMIN_PASSWORD: 'replace-with-a-strong-random-password'
         COMIC_DL_WEB_ENABLE_EXTENSION_MANAGEMENT: '0'
         COMIC_DL_WEB_WATCH_INTERVAL: '3600'
         # Optional: uncomment and edit as needed.
         # COMIC_DL_WEB_ADMIN_ORIGIN: https://comics.example.com
         # COMIC_DL_WEB_OUTPUT_MARKER: .nas-ready
         # COMIC_DL_WEB_DEFAULT_SOURCE: copymanga
         # COMIC_DL_WEB_EXTENSIONS: "@scope/trusted-preinstalled-extension"
         # COMIC_DL_ZEROBYW_COOKIE: 'replace-with-your-cookie'
         # COMIC_DL_ZEROBYW_COOKIE_ORIGIN: https://zerobyw.example.com
         # COMIC_DL_KOMGA_URL: https://komga.example.com
         # COMIC_DL_KOMGA_API_KEY: 'replace-with-your-api-key'
         # COMIC_DL_KOMGA_API_KEY_URL: https://komga.example.com
         # COMIC_DL_KAVITA_URL: https://kavita.example.com
         # COMIC_DL_KAVITA_API_KEY: 'replace-with-your-api-key'
         # COMIC_DL_KAVITA_API_KEY_URL: https://kavita.example.com
       volumes:
         - type: bind
           source: /srv/comic-dl-web/data
           target: /data
           bind:
             create_host_path: false
         - type: bind
           source: /srv/comics
           target: /downloads
           bind:
             create_host_path: false
   ```

2. Edit the UID/GID in `user` (check with host `id -u` and `id -g`), both host `source` paths, and the administrator password. Pre-create dedicated data and comic directories with write access for that identity. Keep container paths unchanged. Uncomment optional settings as needed; set `COMIC_DL_WEB_ENABLE_EXTENSION_MANAGEMENT` to `"1"` to enable Web management.

   For an existing `compose.yaml`/`.env` deployment, back up and transfer its values into this file, then move old Compose/override files out of the deployment directory so Compose does not prefer old configuration. Keep the existing data and comic directories; do not delete persistent data.

3. Validate and start:

   ```sh
   chmod 600 docker-compose.yml
   docker compose config --quiet
   docker compose pull
   docker compose up -d
   docker compose ps
   docker compose logs --tail=100 comic-dl-web
   ```

4. Open `http://127.0.0.1:3000` on the host. The default loopback binding is not accessible from other devices. An SSH tunnel can provide initial remote administration; use the HTTPS proxy below for regular cross-device access.

Replace the example administrator password; do not leave it empty. The application disables authentication when the password is empty/unset. `docker-compose.yml` contains secrets: do not commit it or share unredacted `docker compose config` output. Escape literal `$` in passwords/cookies as `$$` in Compose files; YAML single quotes do not prevent Compose interpolation.

### Storage and permissions

| Container path | Contents                                                         | Requirement                                                                                 |
| -------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `/data`        | `shelf.sqlite`, any WAL/SHM files, `sources.json`, `extensions/` | Local persistent storage on the NAS, restricted to the runtime identity and administrators. |
| `/downloads`   | CBZ/ZIP archives and core identity metadata                      | Existing real comic directory, writable by the service; readers can mount it read-only.     |
| `/tmp`         | npm cache and temporary files                                    | Ephemeral tmpfs, 512 MiB by default; increase if extension installation needs more space.   |

The image defaults to `node` (UID/GID 1000). Compose can use a NAS numeric UID/GID instead. `HOME=/tmp` avoids requiring a username for that ID. The container does not start as root to recursively chown directories or alter an entire comic share. Configure ownership/ACLs on dedicated directories; do not routinely use `chmod 777`. Web settings are saved with mode `0600`.

Compose refuses missing host bind directories. The root filesystem is read-only; only `/data`, `/downloads`, and `/tmp` are writable. Do not mount the Docker socket. Do not put SQLite on cross-machine SMB/NFS shares. Replace symlink output paths with real paths; the core refuses archive writes through symlinks.

### Extra settings and source secrets

Edit `environment` in the same `docker-compose.yml`: uncomment the Origin, mount marker, or source credentials as needed and replace their example values. Leave unused source settings commented out. Apply changes with `docker compose up -d`; `restart` alone does not update container environment. Protect the file. Never bake credentials into images, Dockerfiles, repositories, or public logs.

Common bundled-source deployment variables:

| Source  | Variables                                                                                                                                          |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Zerobyw | `COMIC_DL_ZEROBYW_COOKIE`; bind custom origins with `COMIC_DL_ZEROBYW_COOKIE_ORIGIN`.                                                              |
| Komga   | `COMIC_DL_KOMGA_URL`, `COMIC_DL_KOMGA_API_KEY`; use `COMIC_DL_KOMGA_API_KEY_URL` when needed to bind the full server URL including proxy subpaths. |
| Kavita  | `COMIC_DL_KAVITA_URL`, `COMIC_DL_KAVITA_API_KEY`; use `COMIC_DL_KAVITA_API_KEY_URL` to bind the full URL when needed.                              |

See the [extension documentation](https://github.com/yinyanfr/comic-dl-extensions) for other fields. Web management defaults off. When enabled, settings and bundled-source credentials are stored in `/data/sources.json`. Managed versions take precedence, and Web credentials are not injected into them. Install only trusted npm packages: extension code has the service's permissions. Installation/updates need registry access. Do not pass unrelated secrets or mount unrelated sensitive directories.

## HTTPS, Origin, and SSE

Use the repository's [Nginx example](https://github.com/yinyanfr/comic-dl-web/blob/main/deploy/nginx.conf), replacing the hostname, upstream port, and trusted certificate paths. Uncomment and set `COMIC_DL_WEB_ADMIN_ORIGIN` in the existing `docker-compose.yml` `environment` section (this is only a field excerpt, not a separate Compose file):

```yaml
services:
  comic-dl-web:
    environment:
      COMIC_DL_WEB_ADMIN_ORIGIN: https://comics.example.com
```

The Origin must exactly match the browser-facing scheme, hostname, and port, without a path, trailing slash, or wildcard. The application does not blindly trust `X-Forwarded-*`; explicitly configure the Origin when TLS terminates at a proxy. An HTTPS Origin enables Secure authentication cookies. Preserve Host. Login and writes validate Origin; do not disable validation to work around proxy errors.

The example assumes **Nginx on the host**, using `127.0.0.1:3000` upstream. A containerized proxy should share a private Docker network and use `comic-dl-web:3000`, not its own localhost; do not publish the application's port externally. Use a dedicated hostname/root path. Deployment under a subpath such as `/comics/` is unsupported.

Disable proxy buffering and caching for SSE and allow long read timeouts. Test task updates, reconnects, and reauthentication, not just home-page rendering. Any external authentication proxy must protect business pages, APIs, covers, and SSE. The manifest and installation icons contain no business data and are public; blocking them at the proxy can affect installation.

PWA installation requires HTTPS except for localhost/127.0.0.1. Ordinary HTTP LAN IPs generally do not qualify. Use a certificate trusted by clients; HTTPS does not require public exposure. The PWA is online-only, with no Service Worker or offline cache.

## Application environment variables

Container paths are fixed below; source-run defaults are relative to the working directory.

| Variable                                   | Source-run default                | Purpose                                                                                                          |
| ------------------------------------------ | --------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `HOST`                                     | `127.0.0.1`                       | Container uses `0.0.0.0`; host port bindings control exposure.                                                   |
| `PORT`                                     | `3000`                            | Keep 3000 inside the container; change the middle `3000` in `ports` for the host.                                |
| `NODE_ENV`                                 | `production` for production start | Do not use test/development in deployment.                                                                       |
| `COMIC_DL_WEB_ADMIN_PASSWORD`              | Unset                             | Nonempty enables authentication; restart/recreate to change it. Restart invalidates all sessions.                |
| `COMIC_DL_WEB_ADMIN_ORIGIN`                | Request scheme and Host           | Explicit exact browser Origin behind proxies.                                                                    |
| `COMIC_DL_WEB_OUTPUT`                      | `./downloads`                     | Container `/downloads`; must already exist.                                                                      |
| `COMIC_DL_WEB_SHELF`                       | `./data/shelf.sqlite`             | Container `/data/shelf.sqlite`.                                                                                  |
| `COMIC_DL_WEB_SOURCE_STATE`                | `./data/sources.json`             | Container `/data/sources.json`; may contain secrets.                                                             |
| `COMIC_DL_WEB_EXTENSION_DIR`               | `./data/extensions`               | Container `/data/extensions`, persistent managed packages.                                                       |
| `COMIC_DL_WEB_ENABLE_EXTENSION_MANAGEMENT` | `0`                               | `1` enables extension and Web settings management.                                                               |
| `COMIC_DL_WEB_WATCH_INTERVAL`              | `3600`                            | Initial global check interval in seconds. Saved Web settings take precedence; work overrides remain independent. |
| `COMIC_DL_WEB_OUTPUT_MARKER`               | Unset                             | Plain filename beneath the output root, not a path.                                                              |
| `COMIC_DL_WEB_DEFAULT_SOURCE`              | Unset                             | Default source ID; saved Web settings take precedence.                                                           |
| `COMIC_DL_WEB_EXTENSIONS`                  | Empty                             | Comma-separated npm packages already installed and resolvable by the application, not an installation command.   |

`COMIC_DL_WEB_FIXTURE=1` and `COMIC_DL_WEB_FIXTURE_DIR` are explicit development/test options, not deployment settings. Test data is not shipped in the production image.

Environment changes do not replace management of saved Web settings. Managed adapters take precedence; restart Web after changing the shared extension directory through the CLI. Do not run `npm install` to mutate `/app` with the read-only root filesystem. Preinstall extra packages in a custom derived image, or use trusted managed extensions.

## NAS output protection

NAS-local directories usually need no marker. For external mounts, place a marker such as `.nas-ready` in the **actual mounted output root** and set `COMIC_DL_WEB_OUTPUT_MARKER` to that filename. Do not generate it automatically during container startup: doing so could conceal a missing mount.

The UI accepts only existing relative subdirectories beneath the root. If the marker or selected directory disappears, archives are not committed and watcher tasks wait for recovery. Do not create empty directories to bypass protection. Docker's host-path existence check does not replace mount-marker protection.

Use only one Web instance/watcher per shelf; replicas are unsupported. If sharing a shelf with the CLI, run a watcher at only one end and use consistent source settings and output paths. Stop all other writers before archive migration.

## Health, logs, and shutdown

The image health check reads the local installation manifest, needs no password, and does not contact sources. `healthy` means the HTTP server responds, **not that sources work, output is writable, the watcher is running, or downloads succeed**. Check those in the UI, logs, and NAS.

```sh
docker compose ps
docker compose logs --tail=100 comic-dl-web
docker compose stop
docker compose up -d
```

Compose uses init and allows 90 seconds for SIGTERM cleanup of downloads/watchers. Investigate slow stops before using `kill -9`. Compose does not automatically restart merely unhealthy containers; `unless-stopped` applies to process exits and related restart situations. Redact URL queries, cookies, and keys before sharing logs.

## Backup, upgrade, and rollback

1. Stop Web and all CLI writers sharing the shelf/output.
2. Back up the entire data directory, including SQLite and any WAL/SHM, settings, credentials, and managed packages; `docker-compose.yml`; and comics including hidden identity metadata. Store backups outside the source directories, restrict access, and test restoration.
3. Change `image` in `docker-compose.yml` to the target fixed version (such as `ghcr.io/yinyanfr/comic-dl-web:0.1.0`) or the Release's `ghcr.io/yinyanfr/comic-dl-web@sha256:…` digest, review release notes, then run `docker compose pull` and `docker compose up -d`.
4. Verify login, shelf, settings, extensions, following, and an actual archive. Manual queues do not recover; watcher queues do. All sessions are invalidated.
5. Stop writers again before rollback. If the database schema changed, switching to an old image is insufficient: restore matching old backups. If archives were migrated/written meanwhile, reconcile or restore the corresponding output snapshot without clobbering new files.

Opening a 3.x core shelf transactionally migrates it to schema v3, preserving baselines and queues. Older cores cannot read that schema. Old hashed archives remain recognized; template changes do not rename them. Archive migration needs a backup, preview, and explicit confirmation and is not a batch transaction. See the [core migration guide](https://yinyanfr.github.io/comic-dl/en/migration/v3-to-v4/).

## Without Docker

Use Node.js 24 and a fixed source version:

```sh
npm ci
npm run check
npm test
npm run build
```

Run `node server.ts` as a dedicated non-root user under systemd or a NAS service manager. Set absolute output/data paths and the administrator password, pre-create directories, and use the project root as the working directory. Do not copy only `build/`: startup also needs `server.ts`, `app/` server modules, and production dependencies. Do not run Vite's development server in production.

Node does not automatically load `.env`. Inject application variables through the service manager or use `node --env-file=/secure/path/service.env server.ts`. This file contains application variables, not the Compose host-variable file. Source startup defaults to loopback. Use SIGTERM and allow cleanup time. Native SQLite dependencies may need Python, make, and a C++ compiler when no prebuilt binary is available.

## Troubleshooting and acceptance

| Symptom                      | Check                                                                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Startup/permission failure   | Numeric UID/GID, existing host paths, NAS ACLs, and local SQLite write permission. Do not hide errors by running as root. |
| Login/writes return 403      | Browser Origin, `COMIC_DL_WEB_ADMIN_ORIGIN`, proxy Host, HTTPS Secure cookies.                                            |
| Progress does not update     | SSE buffering, timeouts, external authentication; refreshing should recover a snapshot.                                   |
| Healthy but not following    | UI watcher/lock/output state, duplicate instances, marker and selected directory.                                         |
| Extension installation fails | Trusted package/range, registry network, `/data` and `/tmp` space/permissions.                                            |
| No PWA installation action   | HTTPS/certificate trust, browser support, proxy restrictions on manifest/icons.                                           |

Before production use, validate on your NAS: persistence after container replacement, background downloads with the browser closed, mount recovery, reader page order, HTTPS/SSE/PWA, and stopped-service backup/restoration. Passing offline automation does not mean real accounts, Komga/Kavita, or NAS hardware were tested.
