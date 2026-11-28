---
title: CLI コマンド
description: コマンド、オプション、標準出力、終了コードのリファレンス。
---

`comic-dl --help` でコマンド一覧、`comic-dl <command> --help` で個別オプションを表示します。`-h` は `--help`、`-V` は `--version` の省略形です。リポジトリから実行する場合は `comic-dl` を `node dist/index.js` に置き換えます。

本ページは 4.1.0 に対応します。進捗、`extensions`、`update --check`、`migrate`、詳細 JSON、アーカイブ上書き設定、手動 NAS 保護は 4.1.0 以降で利用できます。`npm install -g comic-dl@latest` で更新してください。Node.js 24 と拡張 API v1 の要件は変更ありません。

| コマンド                  | 別名  | 用途                                                                |
| ------------------------- | ----- | ------------------------------------------------------------------- |
| `sources`                 | `src` | セッションを作らず組み込み・読み込み済みソース ID を表示            |
| `search [query]`          | `s`   | 検索、検索語省略で閲覧。`--page <n>` は `1` 始まり                  |
| `list <series-input>`     | `l`   | 安定したチャプター ID とタイトルを表示                              |
| `chapter <chapter-input>` | `c`   | 直リンクまたはソース定義の識別子から単一取得                        |
| `download <series-input>` | `d`   | 作品全体または選択チャプターを取得                                  |
| `shelf <action>`          |       | 複数ソースの作品、本棚、購読、更新を管理                            |
| `add <package>`           | `a`   | npm 拡張を導入。`@version/@tag` 指定可                              |
| `update [package]`        | `u`   | 保存範囲内で単一または全拡張を更新                                  |
| `remove <package>`        | `rm`  | CLI 管理の拡張を削除                                                |
| `extensions`              |       | 管理パッケージ、実バージョン、保存範囲、ソース ID、状態を JSON 表示 |
| `migrate <series-input>`  |       | 再取得せず既存アーカイブの改名をプレビュー                          |

### オプション

| オプション                       | 対象                                  | 意味                                                          |
| -------------------------------- | ------------------------------------- | ------------------------------------------------------------- |
| `--config <file>`                | `sources` と漫画コマンド              | 明示的 JSON。[設定](../config/)を参照                         |
| `--extension <name>`             | `sources` と漫画コマンド              | 解決可能な npm パッケージかローカル ESM。繰り返し可           |
| `--source <id>`                  | 漫画コマンド                          | 登録済みソース。設定でも指定可                                |
| `--fixture <directory>`          | `list/chapter/download`               | ローカルテスト。位置引数・明示 `--source` と併用不可          |
| `-o, --output <directory>`       | `chapter/download`                    | 設定でも可。作品は既定で現在地、単一チャプターは必須          |
| `-c, --chapter <selection>`      | `download`                            | ID または `2-4` など両端を含む範囲。繰り返し可                |
| `-c, --chapter <id>`             | `chapter --fixture`                   | 単一の安定した ID                                             |
| `--jobs <n>`                     | `download`                            | 最大同時チャプター数。既定 `2`                                |
| `--retries <n>`                  | `chapter/download`                    | 一時的エラーの追加試行。既定 `2`、`0` で無効                  |
| `--progress auto\|plain\|off`    | `chapter/download/shelf watch`        | stderr 進捗。既定 `auto` は端末のみ                           |
| `--archive-template <template>`  | ダウンロード・watcher・移行プレビュー | 拡張子なしの相対パステンプレート                              |
| `--archive-padding <0-12>`       | 同上                                  | 正規番号のゼロ埋め                                            |
| `--archive-format cbz\|zip`      | 同上                                  | 形式の上書き                                                  |
| `--output-root <dir>`            | ダウンロード・watcher                 | ルート内の既存実ディレクトリを要求                            |
| `--require-output-marker <name>` | ダウンロード・watcher                 | マーカー名。手動ではルートも必要                              |
| `--details`                      | `list`                                | 読み取りメソッドを含まないメタデータ・チャプター記述子の JSON |
| `--json`                         | `search`                              | 表紙を含む `{ results, hasNext }`。`--options` と併用不可     |

### ソースの導入と管理

作者の説明や npm でパッケージ名を確認します。

```sh
comic-dl add @comic-dl/zerobyw
comic-dl update @comic-dl/zerobyw
comic-dl update
comic-dl remove @comic-dl/zerobyw
```

`update` は保存範囲内です。範囲外へ変更するには `add 'package@version'` を使います。管理コマンドは npm 名、`--source` は `zerobyw` などのソース ID です。ユーザーデータ内の独立 npm プロジェクトに導入し、ライフサイクルスクリプトは実行しません。ただし読み込んだ拡張は CLI と同じ権限を持つため、信頼できるものだけを導入してください。

Unix の既定は `$XDG_DATA_HOME/comic-dl/extensions`、未設定時は `~/.local/share/comic-dl/extensions`。Windows は `%LOCALAPPDATA%\comic-dl\extensions` です。`COMIC_DL_EXTENSION_DIR` で変更できます。

管理コマンドは一度に 1 つ実行します。ロックエラー時は他の完了を待って再試行します。終了済みプロセスの書き込みロックは次回管理操作で解除します。ストアは 1 台のマシンから管理し、複数ホストで共有しないでください。

### ソースを選択

`add` 済み拡張は自動で読み込みます。`--extension` や設定では、ローカルファイルや CLI と同じ npm プロジェクトのパッケージを一時的に読み込めます。CLI ストアへの登録・導入は行いません。登録済みと同名のパッケージを明示指定しても一度だけ読み込みます。異なるパッケージのソース ID 重複はエラーです。

`--fixture` の形式は[ローカルテスト](../../development/local-testing/)を参照してください。

`--source`、設定の `source`、読み込み済み拡張の URL 照合の順に優先します。URL 照合は `list/chapter/download` に適用され、該当なし・複数該当なら明示指定してください。短い作品 ID と検索には CLI または設定のソース指定が必要です。

### 閲覧・並べ替え・絞り込み

`search --source <id> --options` は閲覧用ソート・フィルターを JSON 表示します。検索語を含めると検索用の選択肢です。`--sort <id>`、キーごとの `--filter <key>=<value>` で指定します。次の `--page <n>` でも検索語・ソート・フィルターを維持してください。未宣言の指定は拒否されます。`list` は常に読み順です。

`sources --source <id> --options` でソース設定を取得できます。上書きは[設定リファレンス](../config/)を参照してください。

### チャプター選択

`-c 2-4` は `list` の 2〜4 番目（両端含む）です。位置は `1` 始まりで、タイトル・安定 ID とは無関係です。ID は `list` 第 1 列の `-c <id>` で指定し、完全一致が範囲より優先です。繰り返して混在でき、ダウンロード前に全検証後、各対象を読み順に一度ずつ処理します。逆順・範囲外・不明 ID は開始前に終了コード `2` です。

### 複数ソースの本棚管理

| コマンド                             | 用途                                                |
| ------------------------------------ | --------------------------------------------------- |
| `shelf add <series-input>`           | 登録。`--source <id>`、`--title <title>` は任意     |
| `shelf list`                         | 項目 ID、ソース、購読状態、タイトルをタブ区切り表示 |
| `shelf follow <entry-id>`            | 購読                                                |
| `shelf unfollow <entry-id>`          | 項目・確認履歴を残して更新停止                      |
| `shelf set-input <entry-id> <input>` | 同じ作品の入力を変更                                |
| `shelf remove <entry-id>`            | CBZ を残して項目・購読を削除                        |

すべて `--shelf-db <file>` に対応します。`add/set-input/check/watch` は `--config/--extension/--set` にも対応し、他はオフラインで動作します。[本棚ガイド](../../shelf/manage/)を参照してください。

### 更新確認と自動ダウンロード

| コマンド                              | 用途                                                               |
| ------------------------------------- | ------------------------------------------------------------------ |
| `shelf check [entry-id]`              | 自動化に関係なく全体または単一確認。`--include-history` は ID 必須 |
| `shelf status [entry-id]`             | オフラインで確認・ダウンロード状態を表示                           |
| `shelf watch`                         | フォアグラウンド確認・取得。`--output` または設定が必要            |
| `shelf retry <entry-id> <chapter-id>` | 失敗・制限チャプターを再登録                                       |

`watch` は `--interval <seconds>`（既定 `3600`）、`--jobs <n>`（既定 `2`）、`--require-output-marker <name>`（不在時延期）に対応します。[自動更新ガイド](../../shelf/updates/)を参照してください。

4 は `shelf configure <id> --auto-check on/off --auto-download on/off --interval <seconds/default>`、`shelf chapters <id>`、`shelf tasks [id]`、`shelf enqueue <id> <chapter-id>`、`shelf cancel <id> <chapter-id>` を追加します。chapters/tasks は JSON です。自動化停止で既存タスクは残り、retry は中断タスクも復元します。`--interval` 省略時は保存済み全体値（初期 `3600`）を維持します。`--output-root` はルートマーカーと既存保存先を分離します。契約は[バックエンド API](../../guide/service-api/)を参照してください。

### アーカイブ・NAS 保護・移行

download/chapter/watch と移行プレビューは `--archive-template/--archive-padding/--archive-format` に対応します。明示した項目のみ設定の `archive` を上書きし、未指定は維持します。テンプレートに拡張子は含めません。既定はゼロ埋めなしの `{title}/{number}-{chapter}.cbz` です。

```sh
comic-dl download "$series_url" --archive-padding 3 --archive-format zip -o ./downloads
comic-dl chapter "$chapter_url" -o /mnt/comics/Manga \
  --output-root /mnt/comics --require-output-marker .nas-ready
```

手動も watcher と同じルート・マーカー保護を使えます。ルートと保存先は既存実ディレクトリ、マーカーはルート内です。不在時は再作成せず手動は終了コード `1`、watcher は延期します。確定直前にも確認します。

設定変更だけでは改名しません。書き込み・watcher を止め、バックアップとマウントの安定を確認します。

```sh
comic-dl migrate "$series_url" -o ./downloads \
  --archive-padding 3 --archive-format zip > migration.json
# from/to/status を確認し、このプレビューを適用します。
comic-dl migrate --apply migration.json -o ./downloads
```

プレビューは全目録を使い、書き込まず `{ version: 1, directory, items }` を出力します。`directory` は絶対ルートです。適用には同じ明示ルートが必要で、ソース・設定オプションは拒否し、計画は再生成しません。`move` のみ適用し `unchanged/conflict` は残します。コアが識別・パス・宛先占有を再検証し、上書きを拒否します。一括トランザクションではなく、後続失敗でも完了分は残るため、続行前に再プレビューしてください。計画は管理者用ローカル相対パスを含み、ブラウザー DTO ではありません。複数作品はライブラリ API を使います。

### JSON と管理済み拡張の照会

`list --details` は作品 ID、任意メタデータ、正規位置付き記述子を返し、読み取りメソッドは含みません。`search --json` は表紙を含む `{ results, hasNext }` で、`--options` と併用不可です。省略時は従来のタブ区切りです。

```sh
comic-dl extensions
comic-dl update --check
comic-dl update @comic-dl/zerobyw --check
# 明示確認後に適用：
comic-dl update @comic-dl/zerobyw
```

`extensions` は壊れたパッケージも含む管理一覧を JSON 表示します。`sources` と異なり一時 `--extension` は対象外で、`loaded` は認証成功ではありません。`update --check` は導入・世代切り替えをせず、保存範囲・タグ・レジストリに従う `current/available/failed` を返します。部分失敗時も他結果を残して終了 `1`、更新ありだけなら `0` です。

### ライブ進捗

`chapter/download/shelf watch` は `--progress auto|plain|off` に対応します。既定 `auto` は端末のみ stderr に幅制限付きの 1 行を描画し、最新チャプター・段階・ページ数・総数既知時の割合・試行数を表示します。並行チャプターは同じ行を使い、作品全体の割合ではありません。`plain` は ANSI なしの段階・ページログ、`off` は無効です。再試行でページ数をリセットし、総数不明時は数と段階のみ表示します。結果・要約は stdout のままです。

`shelf tasks` はプロセス間の永続キュー投影を読み、別 watcher のライブページ数は取得しません。実行中 watcher はライブイベントを表示し、常駐 Web は保持ハンドルの `tasks()/onEvent` を使います。手動 CLI はプロセス内のみで Ctrl+C で中断し、ハンドル式の再接続・再試行 API はありません。

### スクリプト向け出力と終了コード

`sources` は 1 行 1 ID、既定 `list` は `チャプター ID<TAB>タイトル`、`search` は `作品 URL<TAB>タイトル` です。ページ案内・エラーは stderr。上記 JSON はスクリプト向け、進捗・要約は人間向けです。リダイレクト時の進捗は既定で無効で、ログには `--progress plain` を明示します。

| 終了コード | 意味                                                                    |
| ---------- | ----------------------------------------------------------------------- |
| `0`        | 完了。作品取得は 1 つ以上が取得済み・取得成功で、残りが制限のみなら成功 |
| `1`        | コマンド失敗、取得失敗あり、または全対象が制限                          |
| `2`        | CLI・設定・ソース・選択の不正                                           |
| `130`      | 利用者による中断。完成済みアーカイブは維持                              |
