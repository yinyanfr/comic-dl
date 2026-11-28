---
title: 部署
description: 使用 Docker Compose 或 Node.js 部署 comic-dl-web，配置 NAS 存储、HTTPS、备份和升级。
---

comic-dl-web 面向单用户、单进程、单实例部署。推荐在 NAS 本地运行，SQLite 放本地持久存储，漫画直接写入本地共享目录。建议本机、可信局域网或 VPN 使用，**不建议直接暴露公网**；管理员密码不能替代网络隔离与 HTTPS。

界面操作见[使用指南](../usage/)。部署文件在 [comic-dl-web 仓库](https://github.com/yinyanfr/comic-dl-web)；应使用同一版本的镜像、Compose 与文档。

## 部署产物与发布状态

已发布镜像 `ghcr.io/yinyanfr/comic-dl-web:0.1.0`，平台为 `linux/amd64`、`linux/arm64`，Docker 自动选择对应架构，不支持 ARMv7。仓库提供完整的 [`docker-compose.yml`](https://github.com/yinyanfr/comic-dl-web/blob/main/docker-compose.yml)、Dockerfile 和宿主机 Nginx 示例。

直接拉取已发布镜像，无需克隆仓库或本地构建。正式部署使用固定版本或 Release 中的摘要，不使用浮动 `latest`。镜像发布不代表已经完成你的 NAS、阅读器或真实来源验收。

## Docker Compose 快速启动

需要 Docker Engine 和带有 Compose 插件的 Docker CLI。NAS 图形界面若不能表达 `create_host_path: false`、UID/GID 和停止宽限时间，请使用 SSH 运行 Compose，避免静默丢失保护。

1. 建立专用部署目录，将以下完整配置保存为 `docker-compose.yml`。所有变量直接写在 `environment` 中，**不需要 `.env`、命令行注入或 override 文件**：

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

2. 修改 `user` 的 UID/GID（用宿主机 `id -u`、`id -g` 确认）、两个 `source` 宿主机路径及管理员密码。提前创建专用数据目录和漫画目录，并配置运行身份的写权限。容器内路径保持不变。可选配置按需取消注释；网页管理需将 `COMIC_DL_WEB_ENABLE_EXTENSION_MANAGEMENT` 改为 `"1"`。

   已使用旧版 `compose.yaml`／`.env` 的部署，应先备份并将原值迁入新文件，移走部署目录中的旧 Compose／override 文件，避免 Compose 优先读取旧配置；保留原数据和漫画目录，不删除持久数据。

3. 校验并启动：

   ```sh
   chmod 600 docker-compose.yml
   docker compose config --quiet
   docker compose pull
   docker compose up -d
   docker compose ps
   docker compose logs --tail=100 comic-dl-web
   ```

4. 在宿主机访问 `http://127.0.0.1:3000`。默认只绑定回环地址，其他设备不能直接访问。远程管理可先用 SSH 隧道；正式跨设备访问建议配置下面的 HTTPS 代理。

必须替换示例管理员密码，不要留空；应用未设置或为空时不启用认证。`docker-compose.yml` 含密钥，不提交到 Git，也不要分享 `docker compose config` 的完整输出。密码或 Cookie 含 `$` 时，在 Compose 文件中写成 `$$`，避免变量替换；YAML 单引号不能阻止 Compose 的 `$` 替换。

### 数据与权限

| 容器路径     | 内容                                                              | 要求                                                                   |
| ------------ | ----------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `/data`      | `shelf.sqlite`、可能存在的 WAL/SHM、`sources.json`、`extensions/` | NAS 本地持久目录；仅运行身份及管理员可读写。                           |
| `/downloads` | 漫画 CBZ／ZIP 与核心归档身份信息                                  | 指向已存在的漫画共享实际目录；运行身份可写，阅读器可按需只读挂载。     |
| `/tmp`       | npm 缓存、临时文件                                                | 临时 tmpfs，容器重建不保留；默认上限 512 MiB，扩展安装空间不足时调整。 |

镜像默认用户为 `node`（UID/GID 1000），Compose 可覆盖为 NAS 的数字 UID/GID；`HOME=/tmp`，不要求该 UID 在容器内有用户名。容器不会以 root 启动后自动递归 chown，更不会修改整个漫画共享权限。请管理员对专用目录配置正确的所有者／ACL；不要用 `chmod 777` 作为常规解决办法。网页配置文件以 `0600` 保存。

Compose 不会自动创建缺失的宿主机挂载目录。容器根文件系统只读，仅 `/data`、`/downloads`、`/tmp` 可写；不挂载 Docker socket。勿把 SQLite 放到跨机器 SMB/NFS 共享上。符号链接漫画路径应换成实际目录，核心拒绝沿符号链接写归档。

### 额外配置与来源凭据

直接编辑同一个 `docker-compose.yml` 的 `environment`，按需取消注释 Origin、挂载标记和来源凭据，替换为实际值；不要启用未使用来源的示例配置。更改后用 `docker compose up -d` 重建生效，单纯 `restart` 不更新容器环境。保护该文件，不要把真实凭据写入镜像、Dockerfile、仓库或公开日志。

内置来源支持的常见部署变量：

| 来源    | 变量                                                                                                               |
| ------- | ------------------------------------------------------------------------------------------------------------------ |
| Zerobyw | `COMIC_DL_ZEROBYW_COOKIE`，自定义地址时绑定 `COMIC_DL_ZEROBYW_COOKIE_ORIGIN`                                       |
| Komga   | `COMIC_DL_KOMGA_URL`、`COMIC_DL_KOMGA_API_KEY`；需要时用 `COMIC_DL_KOMGA_API_KEY_URL` 绑定完整地址（含代理子路径） |
| Kavita  | `COMIC_DL_KAVITA_URL`、`COMIC_DL_KAVITA_API_KEY`；需要时用 `COMIC_DL_KAVITA_API_KEY_URL` 绑定完整地址              |

更多字段以[扩展文档](https://github.com/yinyanfr/comic-dl-extensions)为准。网页管理默认关闭；开启后，普通设置与内置来源凭据写入 `/data/sources.json`。托管版本优先于内置版本，网页凭据不会注入托管版本。扩展代码与服务同权限运行，只安装受信任的 npm 包；首次安装／更新需能访问 npm registry。不要向容器传入无关密钥或挂载其他敏感目录。

## HTTPS、Origin 与 SSE

使用仓库的 [Nginx 示例](https://github.com/yinyanfr/comic-dl-web/blob/main/deploy/nginx.conf)，替换域名、上游端口及可信证书路径。在现有 `docker-compose.yml` 的 `environment` 中取消注释并设置 `COMIC_DL_WEB_ADMIN_ORIGIN`（下面仅展示对应字段，不是另一个 Compose 文件）：

```yaml
services:
  comic-dl-web:
    environment:
      COMIC_DL_WEB_ADMIN_ORIGIN: https://comics.example.com
```

Origin 必须是浏览器实际访问的准确协议、主机名和端口，无路径、尾斜杠或通配符。应用不盲目信任 `X-Forwarded-*`，TLS 终止在代理时必须显式配置；HTTPS Origin 使认证 Cookie 带 `Secure`。代理保留 Host，写请求与登录校验 Origin，不能靠关闭校验解决代理错误。

示例面向**运行在宿主机上的 Nginx**，上游是 `127.0.0.1:3000`。代理若也在容器中，应加入同一私有 Docker 网络，上游使用 `comic-dl-web:3000`，不要使用代理容器自己的 localhost，且不要向外发布应用端口。使用独立主机名／根路径，不支持以 `/comics/` 子路径部署。

SSE 需要关闭代理缓冲和缓存，并设置足够长的读取超时。应验证任务更新、断线重连和重新登录，而不只是首页能打开。外部认证代理须覆盖业务页面、API、封面与 SSE；应用清单和安装图标不含业务数据，可匿名读取，若代理限制这些资源，安装体验可能受影响。

PWA 安装要求 HTTPS（localhost／127.0.0.1 除外），普通 HTTP LAN IP 通常不满足条件。使用客户端信任的证书；HTTPS 不要求向公网开放服务。PWA 只在线运行，无 Service Worker 或离线缓存。

## 应用环境变量

容器固定使用表内容器默认路径；源码运行默认路径相对于工作目录。

| 变量                                       | 源码运行默认值          | 说明                                                             |
| ------------------------------------------ | ----------------------- | ---------------------------------------------------------------- |
| `HOST`                                     | `127.0.0.1`             | 容器为 `0.0.0.0`，由宿主机端口映射控制暴露范围。                 |
| `PORT`                                     | `3000`                  | 容器内部保持 3000；宿主机端口修改 `ports` 中间的 `3000`。        |
| `NODE_ENV`                                 | 生产启动为 `production` | 正式部署不要改为 test／development。                             |
| `COMIC_DL_WEB_ADMIN_PASSWORD`              | 未设置                  | 非空启用认证；修改须重建／重启，服务重启使登录失效。             |
| `COMIC_DL_WEB_ADMIN_ORIGIN`                | 请求的协议与 Host       | 代理后显式设置浏览器访问的准确 Origin。                          |
| `COMIC_DL_WEB_OUTPUT`                      | `./downloads`           | 容器 `/downloads`；由部署者配置，须已存在。                      |
| `COMIC_DL_WEB_SHELF`                       | `./data/shelf.sqlite`   | 容器 `/data/shelf.sqlite`。                                      |
| `COMIC_DL_WEB_SOURCE_STATE`                | `./data/sources.json`   | 容器 `/data/sources.json`，可能包含来源凭据。                    |
| `COMIC_DL_WEB_EXTENSION_DIR`               | `./data/extensions`     | 容器 `/data/extensions`，托管扩展持久目录。                      |
| `COMIC_DL_WEB_ENABLE_EXTENSION_MANAGEMENT` | `0`                     | 设为 `1` 开启扩展及网页设置管理。                                |
| `COMIC_DL_WEB_WATCH_INTERVAL`              | `3600`                  | 初始全局自动检查间隔（秒）；已保存的网页设置优先，作品覆盖独立。 |
| `COMIC_DL_WEB_OUTPUT_MARKER`               | 未设置                  | 输出根下的普通标记文件名，不是路径。                             |
| `COMIC_DL_WEB_DEFAULT_SOURCE`              | 未设置                  | 默认来源 ID；已保存网页设置优先。                                |
| `COMIC_DL_WEB_EXTENSIONS`                  | 空                      | 已安装且可从应用解析的附加 npm 包名，逗号分隔；不是安装指令。    |

`COMIC_DL_WEB_FIXTURE=1` 与 `COMIC_DL_WEB_FIXTURE_DIR` 只用于显式 development／test 离线测试，不用于部署，也不在生产镜像中附带测试数据。

环境变量不能代替网页保存设置的管理入口。托管扩展优先；从 CLI 修改同一扩展目录后重启 Web。只读根文件系统下不要运行 `npm install` 修改 `/app`；需要预装额外包时制作自己的衍生镜像，或使用受信任的托管扩展。

## NAS 输出保护

NAS 本地目录通常不需要标记。对外部挂载，可在**实际挂载的输出根**放置标记文件（例如 `.nas-ready`），并设置同名 `COMIC_DL_WEB_OUTPUT_MARKER`。标记必须来自真实挂载，不要由容器启动脚本自动生成，否则会掩盖挂载丢失。

网页只允许选择输出根下已存在的相对子目录。标记或子目录不可用时不提交归档，追更保留队列等待恢复；不要通过创建空目录绕过检查。Docker 的宿主机路径检查不能替代挂载标记保护。

同一书架只运行一个 Web 实例／watcher，不做副本扩容。如果 CLI 共享书架，只允许其中一端运行 watcher，并统一来源配置和输出路径；执行归档迁移前停止所有其他写入者。

## 健康检查、日志与停止

镜像健康检查读取本机安装清单，不携带密码、不访问真实来源。`healthy` 仅代表 HTTP 服务可响应，**不代表来源可用、磁盘可写、watcher 正在运行或所有下载成功**。这些状态需在界面、日志和 NAS 上检查。

```sh
docker compose ps
docker compose logs --tail=100 comic-dl-web
docker compose stop
docker compose up -d
```

Compose 使用 init，并给 SIGTERM 留 90 秒清理下载／watcher。长时间不结束时先调查，不优先 `kill -9`。健康异常不会由 Compose 自动重启；`unless-stopped` 只在进程退出等情况下生效。日志排查前去除 URL 查询参数、Cookie 和密钥。

## 备份、升级和回退

1. 停止 Web 和所有共享书架／输出的 CLI 写入者。
2. 备份整个数据目录（SQLite 及仍存在的 WAL／SHM、设置、凭据、托管扩展）、`docker-compose.yml`，以及漫画目录及其隐藏身份文件。备份存放在数据和输出目录之外，限制读取权限，并验证可恢复。
3. 将 `docker-compose.yml` 的 `image` 改为目标固定版本（如 `ghcr.io/yinyanfr/comic-dl-web:0.1.0`）或 Release 中的 `ghcr.io/yinyanfr/comic-dl-web@sha256:…` 摘要，查看版本说明，执行 `docker compose pull`、`docker compose up -d`。
4. 验证登录、书架、设置、扩展、追更和一个实际归档。手动队列不恢复，追更队列恢复；所有登录失效。
5. 回退前再次停止写入。若数据库 schema 已升级，不能只换旧镜像，须恢复匹配的旧备份。若期间已迁移／写入归档，也要检查并恢复对应输出快照，避免覆盖新文件。

3.x 核心书架首次打开会事务迁移到 schema v3，基线和队列保留；旧核心不能读取新 schema。旧哈希归档仍识别，改模板不会自动改名。归档迁移需备份、预览和显式确认，非整批事务。参阅[核心迁移指南](https://yinyanfr.github.io/comic-dl/migration/v3-to-v4/)。

## 不使用 Docker

使用 Node.js 24，获取固定版本源码后：

```sh
npm ci
npm run check
npm test
npm run build
```

以专用非 root 用户运行 `node server.ts`，由 systemd 或 NAS 服务管理器常驻管理。显式设置输出、数据路径和管理员密码，预先创建目录，设置工作目录为项目根；不要只复制 `build/`，启动还需要 `server.ts`、`app/` 服务端模块和生产依赖。生产不运行 Vite 开发服务器。

Node 不会自动加载 `.env`，可用服务管理器注入环境，或使用 `node --env-file=/安全路径/service.env server.ts`；此文件应是应用变量，不是直接复用 Compose 的宿主机变量文件。源码启动默认仅监听回环地址。停止信号使用 SIGTERM，并保留清理时间。原生 SQLite 依赖缺少预构建包时需要 Python、make 和 C++ 编译器。

## 故障排查与验收

| 现象                   | 检查                                                                                         |
| ---------------------- | -------------------------------------------------------------------------------------------- |
| 容器无法启动／权限错误 | UID/GID、宿主机目录是否存在、NAS ACL、本地 SQLite 写入权限。不要把服务改成 root 来掩盖问题。 |
| 登录或写操作 403       | 浏览器 Origin、`COMIC_DL_WEB_ADMIN_ORIGIN`、代理 Host、HTTPS Secure Cookie。                 |
| 任务不刷新             | SSE 缓冲、超时、外部认证代理；刷新应能读回快照。                                             |
| 健康但不追更           | 界面 watcher／锁／输出状态，是否有第二个实例，标记和子目录是否可用。                         |
| 扩展安装失败           | 信任的包名、版本范围、registry 网络、`/data` 和 `/tmp` 空间及权限。                          |
| PWA 没有安装入口       | HTTPS 与证书信任、浏览器支持、清单和图标是否被代理拦截。                                     |

上线前在自己的 NAS 验证：容器重建保留数据、关闭浏览器后下载、挂载中断恢复、外部阅读器页序、HTTPS／SSE／PWA、停止后备份及恢复。自动化离线通过不等于真实账号、Komga／Kavita 或 NAS 已实测。
