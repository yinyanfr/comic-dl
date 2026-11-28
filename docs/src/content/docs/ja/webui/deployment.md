---
title: デプロイ
description: Docker Compose または Node.js による comic-dl-web の導入、NAS、HTTPS、バックアップ、更新の設定。
---

comic-dl-web は単一ユーザー・単一プロセス・単一インスタンス向けです。NAS 上で実行し、SQLite はローカルの永続領域、漫画はローカル共有ディレクトリへ保存する構成を推奨します。ローカル、信頼できる LAN、VPN で使用し、**インターネットへの直接公開は推奨しません**。管理者パスワードはネットワーク分離や HTTPS の代わりにはなりません。

画面の操作は[使い方](../usage/)をご覧ください。設定ファイルは [comic-dl-web リポジトリ](https://github.com/yinyanfr/comic-dl-web)にあります。イメージ、Compose、文書は同じバージョンのものを使ってください。

## 配布物と公開状態

公開済みイメージは `ghcr.io/yinyanfr/comic-dl-web:0.1.0` です。`linux/amd64` と `linux/arm64` に対応し、Docker が適切なアーキテクチャを自動選択します。ARMv7 は対象外です。完全な [`docker-compose.yml`](https://github.com/yinyanfr/comic-dl-web/blob/main/docker-compose.yml)、Dockerfile、ホスト上の Nginx の設定例を提供します。

公開済みイメージを直接取得でき、ソース取得やローカルビルドは不要です。固定バージョンまたは Release のダイジェストを使用し、浮動 `latest` は使いません。公開済みであっても、実際の NAS、リーダー、配信元で検証済みであることを意味しません。

## Docker Compose で起動

Docker Engine と Compose プラグイン付き Docker CLI が必要です。NAS の GUI で `create_host_path: false`、数値 UID/GID、停止猶予時間を正しく設定できない場合は、SSH 経由で Compose を使ってください。

1. 専用の配置ディレクトリを作り、以下の完全な設定を `docker-compose.yml` として保存します。変数は `environment` に直接記述し、**`.env`、シェル変数の注入、override ファイルは不要**です。

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

2. `user` の UID/GID（ホストの `id -u`、`id -g` で確認）、2 つのホスト側 `source` パス、管理者パスワードを変更します。専用データ／漫画ディレクトリを事前に作成し、実行ユーザーに書き込みを許可してください。コンテナ内のパスは変更しません。任意設定は必要に応じてコメントを解除します。Web 管理を使う場合は `COMIC_DL_WEB_ENABLE_EXTENSION_MANAGEMENT` を `"1"` にします。

   既存の `compose.yaml`／`.env` 構成では、まずバックアップして元の値を新ファイルへ移し、古い Compose／override ファイルを配置ディレクトリ外へ移動してください。古い設定が優先されるのを防ぎます。既存のデータ／漫画ディレクトリは維持し、永続データを削除しないでください。

3. 検証して起動します。

   ```sh
   chmod 600 docker-compose.yml
   docker compose config --quiet
   docker compose pull
   docker compose up -d
   docker compose ps
   docker compose logs --tail=100 comic-dl-web
   ```

4. ホストで `http://127.0.0.1:3000` を開きます。既定はループバックのみで、別端末から直接アクセスできません。初期管理には SSH トンネル、継続的な端末間アクセスには以下の HTTPS プロキシを推奨します。

管理者パスワードの例は必ず変更し、空にしないでください。未設定／空文字列の場合は認証が無効になります。秘密情報を含む `docker-compose.yml` を Git に追加せず、`docker compose config` の全出力も共有しないでください。パスワードや Cookie に含まれる `$` は Compose ファイル内で `$$` と記述します。YAML の単一引用符では Compose の変数展開を防げません。

### 保存領域と権限

| コンテナ内パス | 内容                                                            | 条件                                                                                           |
| -------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `/data`        | `shelf.sqlite`、存在する WAL/SHM、`sources.json`、`extensions/` | NAS ローカルの永続領域。実行ユーザーと管理者だけがアクセスできるようにします。                 |
| `/downloads`   | CBZ／ZIP とコアの識別メタデータ                                 | 既存の漫画ディレクトリの実パス。サービスは書き込み可能、リーダー側は必要に応じて読み取り専用。 |
| `/tmp`         | npm キャッシュと一時ファイル                                    | 永続化しない tmpfs。既定上限 512 MiB、拡張導入に不足する場合は調整。                           |

イメージの既定ユーザーは `node`（UID/GID 1000）です。Compose で NAS の数値 UID/GID に変更できます。`HOME=/tmp` のため、コンテナ内に対応するユーザー名がなくても動作します。起動時に root で再帰的な chown はせず、漫画共有全体の権限も変更しません。管理者が専用ディレクトリの所有者／ACL を設定し、通常の解決策として `chmod 777` を使わないでください。Web 設定は `0600` で保存します。

Compose は存在しないホストの bind ディレクトリを自動作成しません。ルートファイルシステムは読み取り専用で、書き込み先は `/data`、`/downloads`、`/tmp` です。Docker socket を渡さないでください。SQLite を別マシンの SMB/NFS 共有へ置かないでください。出力がシンボリックリンクなら実パスに変更します。コアはリンクを経由する保存を拒否します。

### 追加設定と配信元の秘密情報

同じ `docker-compose.yml` の `environment` を直接編集します。Origin、マーカー、配信元の認証情報は必要な項目だけコメントを解除し、実際の値に置き換えてください。変更は `docker compose up -d` で反映します。`restart` だけでは環境変数を更新しません。ファイルを保護し、認証情報をイメージ、Dockerfile、Git、公開ログに含めないでください。

内蔵配信元の主な変数：

| 配信元  | 変数                                                                                                                                          |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Zerobyw | `COMIC_DL_ZEROBYW_COOKIE`、独自アドレスでは `COMIC_DL_ZEROBYW_COOKIE_ORIGIN` で結び付けます。                                                 |
| Komga   | `COMIC_DL_KOMGA_URL`、`COMIC_DL_KOMGA_API_KEY`。必要に応じ `COMIC_DL_KOMGA_API_KEY_URL` でプロキシのサブパスを含む完全な URL に結び付けます。 |
| Kavita  | `COMIC_DL_KAVITA_URL`、`COMIC_DL_KAVITA_API_KEY`。必要に応じ `COMIC_DL_KAVITA_API_KEY_URL` で完全な URL に結び付けます。                      |

その他は[拡張の文書](https://github.com/yinyanfr/comic-dl-extensions)を参照してください。Web 管理は既定で無効です。有効にすると設定と内蔵版の認証情報を `/data/sources.json` に保存します。管理対象版が優先され、その版には Web の認証情報を渡しません。拡張はサービスと同じ権限で実行されるため信頼できる npm パッケージだけを導入します。導入／更新には registry 接続が必要です。無関係な秘密情報や機密ディレクトリは渡さないでください。

## HTTPS、Origin、SSE

[Nginx の例](https://github.com/yinyanfr/comic-dl-web/blob/main/deploy/nginx.conf)のホスト名、上流ポート、信頼できる証明書のパスを置き換えます。既存の `docker-compose.yml` の `environment` で `COMIC_DL_WEB_ADMIN_ORIGIN` のコメントを解除して設定してください（以下は該当フィールドの抜粋で、別の Compose ファイルではありません）。

```yaml
services:
  comic-dl-web:
    environment:
      COMIC_DL_WEB_ADMIN_ORIGIN: https://comics.example.com
```

Origin はブラウザーから見えるスキーム・ホスト・ポートと完全一致させ、パス、末尾の `/`、ワイルドカードを付けません。アプリは `X-Forwarded-*` を無条件には信頼しません。プロキシで TLS を終端する場合は Origin を明示します。HTTPS Origin では認証 Cookie に Secure を設定します。Host を保持し、ログイン／書き込み時の Origin 検証を無効化して問題を回避しないでください。

例は**ホスト上で動作する Nginx**向けで、上流は `127.0.0.1:3000` です。プロキシもコンテナなら同じプライベート Docker ネットワークに参加させ、`comic-dl-web:3000` を使います。プロキシ自身の localhost は使わず、アプリのポートを外部公開しません。専用ホスト名のルートに配置してください。`/comics/` などのサブパス配置には対応しません。

SSE のバッファーとキャッシュを無効化し、長い読み取りタイムアウトを設定します。ホーム表示だけでなく、進捗、再接続、再ログインも確認してください。外部認証プロキシは業務ページ、API、表紙、SSE をすべて保護します。マニフェストとインストールアイコンは業務データを含まず匿名で取得できますが、プロキシで制限するとインストールに影響する場合があります。

PWA には HTTPS が必要です（localhost／127.0.0.1 は例外）。通常の HTTP LAN IP は一般に対象外です。端末が信頼する証明書を使ってください。HTTPS のために公開インターネットへ露出する必要はありません。PWA はオンライン専用で Service Worker やオフラインキャッシュはありません。

## アプリ環境変数

コンテナのパスは下表のとおりです。ソース実行時の相対パスは作業ディレクトリ基準です。

| 変数                                       | ソース実行時の既定値        | 説明                                                                                            |
| ------------------------------------------ | --------------------------- | ----------------------------------------------------------------------------------------------- |
| `HOST`                                     | `127.0.0.1`                 | コンテナは `0.0.0.0`。公開範囲はホストのポート割り当てで制御します。                            |
| `PORT`                                     | `3000`                      | コンテナ内は 3000 のまま、ホスト側は `ports` の中央の `3000` を変更します。                     |
| `NODE_ENV`                                 | 本番起動は `production`     | デプロイ時に test／development を使わないでください。                                           |
| `COMIC_DL_WEB_ADMIN_PASSWORD`              | 未設定                      | 空でない場合に認証有効。変更には再起動／再作成が必要で、全ログインは再起動で無効。              |
| `COMIC_DL_WEB_ADMIN_ORIGIN`                | リクエストのスキームと Host | プロキシ使用時はブラウザーの正確な Origin を明示。                                              |
| `COMIC_DL_WEB_OUTPUT`                      | `./downloads`               | コンテナ `/downloads`。事前に存在すること。                                                     |
| `COMIC_DL_WEB_SHELF`                       | `./data/shelf.sqlite`       | コンテナ `/data/shelf.sqlite`。                                                                 |
| `COMIC_DL_WEB_SOURCE_STATE`                | `./data/sources.json`       | コンテナ `/data/sources.json`。認証情報を含む可能性あり。                                       |
| `COMIC_DL_WEB_EXTENSION_DIR`               | `./data/extensions`         | コンテナ `/data/extensions`。管理対象拡張を永続化。                                             |
| `COMIC_DL_WEB_ENABLE_EXTENSION_MANAGEMENT` | `0`                         | `1` で拡張と Web 設定の管理を有効化。                                                           |
| `COMIC_DL_WEB_WATCH_INTERVAL`              | `3600`                      | 初期の全体確認間隔（秒）。保存済み Web 設定が優先、作品固有の指定は独立。                       |
| `COMIC_DL_WEB_OUTPUT_MARKER`               | 未設定                      | 出力ルート内の通常ファイル名。パスではありません。                                              |
| `COMIC_DL_WEB_DEFAULT_SOURCE`              | 未設定                      | 既定の配信元 ID。保存済み Web 設定が優先。                                                      |
| `COMIC_DL_WEB_EXTENSIONS`                  | 空                          | 導入済みでアプリから解決できる npm パッケージ名をカンマ区切り。インストール命令ではありません。 |

`COMIC_DL_WEB_FIXTURE=1` と `COMIC_DL_WEB_FIXTURE_DIR` は明示的な development／test 用です。デプロイには使わず、本番イメージにテストデータは同梱しません。

環境変数変更は保存済み Web 設定の管理の代わりにはなりません。管理対象アダプターは内蔵版より優先されます。CLI で共用拡張ディレクトリを変更したら Web を再起動します。読み取り専用の `/app` を `npm install` で変更しないでください。追加パッケージを事前導入する場合は派生イメージを作るか、信頼できる管理対象拡張を使います。

## NAS 出力保護

NAS ローカルのディレクトリでは通常マーカーは不要です。外部マウントでは**実際にマウントした出力ルート**に `.nas-ready` などを置き、`COMIC_DL_WEB_OUTPUT_MARKER` に同名を指定します。コンテナ起動時に自動生成するとマウント消失を隠すため、生成しないでください。

画面ではルート配下の既存相対ディレクトリだけを選べます。マーカーや選択ディレクトリが消えるとアーカイブを確定せず、watcher はキューを保持して復旧を待ちます。空ディレクトリを作って検証を迂回しないでください。Docker のパス存在確認はマウントマーカーの代替ではありません。

同一本棚では Web インスタンス／watcher は一つだけで、レプリカ運用には対応しません。CLI と共有する場合、watcher は片方のみで動かし、配信元設定と出力パスを統一してください。移行前には他の書き込みをすべて停止します。

## ヘルスチェック、ログ、停止

ヘルスチェックはローカルのインストール用マニフェストを読み、パスワードを使わず、配信元へ接続しません。`healthy` は HTTP 応答があることだけを示し、**配信元、出力の書き込み権限、watcher、ダウンロードの成功を保証しません**。画面、ログ、NAS 上で確認してください。

```sh
docker compose ps
docker compose logs --tail=100 comic-dl-web
docker compose stop
docker compose up -d
```

Compose は init を使い、SIGTERM に対してダウンロード／watcher の後処理を 90 秒待ちます。停止が遅い場合は、まず原因を調べ、安易に `kill -9` を使わないでください。unhealthy だけでは Compose は自動再起動しません。`unless-stopped` はプロセス終了などの再起動条件に適用されます。ログ共有前に URL のクエリ、Cookie、キーを伏せてください。

## バックアップ、更新、ロールバック

1. Web と、本棚／出力を共有するすべての CLI 書き込みを停止します。
2. データ全体（SQLite、残っている WAL／SHM、設定、認証情報、管理対象拡張）、`docker-compose.yml`、漫画と隠し識別ファイルをバックアップします。元ディレクトリ外に保管し、アクセスを制限して復元も確認してください。
3. リリース説明を読み、`docker-compose.yml` の `image` を対象の固定バージョン（例：`ghcr.io/yinyanfr/comic-dl-web:0.1.0`）または Release の `ghcr.io/yinyanfr/comic-dl-web@sha256:…` ダイジェストへ変更し、`docker compose pull`、`docker compose up -d` を実行します。
4. ログイン、本棚、設定、拡張、自動追跡、実際のアーカイブを検証します。手動キューは復元されず、watcher キューは復元されます。ログインはすべて無効になります。
5. 戻す前にも書き込みを止めます。DB schema が変わった場合、古いイメージだけでは戻せず、対応する旧バックアップが必要です。その間にアーカイブを移行／作成した場合は、新規ファイルを上書きしないよう出力側のスナップショットも確認・復元します。

3.x コアの本棚は初回オープン時に schema v3 へトランザクションで移行され、基準とキューを保持します。古いコアでは新 schema を読めません。旧ハッシュ名アーカイブも認識し、テンプレート変更だけでは改名しません。アーカイブ移行はバックアップ、プレビュー、明示的な適用が必要で、一括トランザクションではありません。[コアの移行ガイド](https://yinyanfr.github.io/comic-dl/ja/migration/v3-to-v4/)も参照してください。

## Docker を使わない場合

Node.js 24 と固定バージョンのソースを使います。

```sh
npm ci
npm run check
npm test
npm run build
```

専用の非 root ユーザーで `node server.ts` を実行し、systemd や NAS のサービス管理機能で常駐させます。出力・データの絶対パス、管理者パスワードを設定し、事前にディレクトリを作り、作業ディレクトリをプロジェクトのルートにします。`build/` だけでは起動できず、`server.ts`、`app/` のサーバーモジュール、本番依存も必要です。本番で Vite 開発サーバーを使わないでください。

Node は `.env` を自動で読みません。サービス管理機能から環境を渡すか、`node --env-file=/secure/path/service.env server.ts` を使います。このファイルにはアプリ変数を書き、Compose のホスト変数ファイルをそのまま使わないでください。ソース起動は既定でループバックのみです。SIGTERM で停止し、後処理の時間を確保します。SQLite のビルド済みバイナリーがない環境では Python、make、C++ コンパイラーが必要です。

## トラブルシューティングと受け入れ確認

| 症状                       | 確認事項                                                                                    |
| -------------------------- | ------------------------------------------------------------------------------------------- |
| 起動失敗／権限エラー       | UID/GID、ホストパス、NAS ACL、ローカル SQLite の書き込み権限。root 化で隠さないでください。 |
| ログイン／書き込みが 403   | ブラウザー Origin、`COMIC_DL_WEB_ADMIN_ORIGIN`、Host、HTTPS の Secure Cookie。              |
| 進捗が更新されない         | SSE のバッファー／タイムアウト／外部認証。再読み込みではスナップショットが取得できること。  |
| healthy だが自動追跡しない | watcher／ロック／出力の状態、二重起動、マーカーと選択ディレクトリ。                         |
| 拡張を導入できない         | 信頼できるパッケージと範囲、registry 接続、`/data` と `/tmp` の容量／権限。                 |
| PWA インストールがない     | HTTPS と証明書の信頼、ブラウザー対応、マニフェスト／アイコンのプロキシ制限。                |

本番利用前に実機 NAS で、コンテナ再作成後の永続化、ブラウザー終了後の取得、マウント復旧、リーダーのページ順、HTTPS／SSE／PWA、停止後のバックアップ／復元を確認してください。オフライン自動テストの成功を、実アカウントや Komga／Kavita、NAS 実機の検証済みとして扱わないでください。
