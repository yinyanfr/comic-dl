---
title: 更新確認と自動ダウンロード
description: 手動確認、既存チャプターのキュー登録、ローカル・NAS での自動ダウンロード。
---

先に[作品を登録・購読](../manage/)してください。以下の `entry_id` は `shelf list` 第 1 列の本棚項目 ID です。

## 手動で更新確認

```sh
comic-dl shelf check
comic-dl shelf check "$entry_id"
comic-dl shelf status
```

`shelf check` は自動確認設定に関係なく全項目または指定項目を調べます。目録のみを読み、画像は取得しません。自動ダウンロード無効時は新着を発見状態で残し、有効時はキューへ登録します。`baseline` は初回の正常確認、`updated` は新着の発見・登録、`unchanged` は変更なしです。項目の失敗でも他は継続し、終了コードは `1`、不明 ID は `2` です。

初回の正常確認は既存目録の記録のみです。以降は未確認 ID をキューに登録します。既存の改名・並べ替え・復活は再登録されません。読み順の前方に追加された新 ID も新着です。

### 既存チャプターをキューに登録

```sh
comic-dl shelf check "$entry_id" --include-history
```

`--include-history` は初回・後続どちらでも単一項目に適用できます。基準内・発見済みの未登録分を重複なく登録します。単一登録は `shelf enqueue <id> <chapter-id>`、状態確認は `shelf chapters <id>` です。キュー処理には watcher を実行します。

## 自動更新の開始

```sh
comic-dl shelf watch --output "$HOME/manga" --interval 1800 --jobs 2
```

`watch` はフォアグラウンドで期限到来の自動確認と独立した既存キューを処理します。`Ctrl+C` で停止します。`--interval` は全体の既定間隔（秒、初期値 1 時間）で、項目別に上書きできます。`--jobs` は既定 `2`。`--config <file>` で `output/jobs/retries/archive` を読み、CLI の出力先・並列数が優先されます。既定アーカイブは作品サブディレクトリ内の `作品名/番号-チャプター名.cbz` です。

DB ごとに watcher は 1 つだけ実行します。再起動で保存済みキューを再開し、整合性を確認した既存 CBZ をスキップします。サーバー常駐にはサービスマネージャーからフォアグラウンドコマンドを起動し、手動操作と同じ DB を指定します。認証が必要なソースでは拡張機能の指示に従いサービスプロセスへ認証情報を渡してください。

### NAS へ出力

共有のマウントを確認し、実際の保存先に `.nas-ready` などの通常ファイルを作ります。マーカーはマウントされた共有にのみ存在させてください。

```sh
comic-dl shelf watch --output /mnt/manga --require-output-marker .nas-ready
```

マーカーがマウントルートにあり、保存先が既存のサブディレクトリなら、`--output-root /mnt/manga --output /mnt/manga/Manga` を指定します。マーカー・指定先がなければ再作成せず延期し、確定前にも再確認します。

マーカー不在でも更新確認は続き、ダウンロードは再試行までキューに残ります。`--require-output-marker` は出力先内のファイル名を指定します（ルート指定時はルート内）。SQLite DB はローカルに置いてください。

## 進捗とアーカイブ設定

`shelf watch` の `--archive-template/--archive-padding/--archive-format` は設定の各項目を上書きします。既定の `--progress auto` は対話端末のみ stderr に現在のページ数・段階を描画します。ログには制御文字なしの `plain`、無効化には `off` を使います。`shelf tasks` は永続キュー状態を読み、別プロセスのライブページ数は表示しません。

## 状態と再試行

```sh
comic-dl shelf status "$entry_id"
```

`shelf status` は最終確認・成功時刻と保留数をオフライン表示します。項目 ID 指定で制限・停止チャプターも表示します。

| 状態         | 対処                                                                     |
| ------------ | ------------------------------------------------------------------------ |
| `pending`    | ダウンロード・自動再試行を待つ。目録から消えたチャプターは復活が必要です |
| `restricted` | ソースが明示的にアクセス制限。watcher は低頻度で再確認します             |
| `blocked`    | 出力先不正・ソースアクセス喪失などを解消し、手動で再試行します           |
| `complete`   | CBZ 書き込み成功、または既存アーカイブが検査を通過しました               |

確認自体が `source-unavailable/authorization-failed` なら、拡張機能や認証を復旧し `shelf check` で確認します。再登録にはタイトル・位置ではなくチャプター ID を使います。

```sh
chapter_id='paste-the-chapter-id-to-retry'
comic-dl shelf retry "$entry_id" "$chapter_id"
```

これは再登録のみ行います。コマンド一覧は [CLI リファレンス](../../reference/cli/#更新確認と自動ダウンロード)を参照してください。
