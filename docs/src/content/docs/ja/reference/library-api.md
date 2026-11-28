---
title: 公開ライブラリ API リファレンス
description: ダウンローダー、本棚、タスク、表紙、アーカイブ、管理済み拡張機能の公開契約。
---

Node.js 24 ESM を使います。値とサーバー用の型は `comic-dl`、拡張作者用の型は `comic-dl/extension` から import します。コアの SQLite テーブルや管理ストア内部を直接読まないでください。登録は[ライブラリガイド](../../guide/library/)、複合例は[バックエンドガイド](../../guide/service-api/)を参照してください。

## ダウンローダー

`createDownloader({ source, sourceSettings, overrides, output, jobs, retries, archive })` は独立インスタンスを作ります。既定エクスポートは手軽に使うためのインスタンスです。ソースは明示指定、インスタンス既定、URL 照合の順です。CLI の設定や拡張機能は暗黙に読み込みません。

| メソッド                                      | 結果と用途                                                                     |
| --------------------------------------------- | ------------------------------------------------------------------------------ |
| `.use(extension, settings?)`                  | 現在のインスタンス。API v1 拡張と非機密設定を登録                              |
| `.sources()`                                  | 登録済みソース ID                                                              |
| `.sourceSettings(source)`                     | 設定宣言。認証情報は含まない                                                   |
| `.validateSourceSettings(source, candidate?)` | インスタンスを変えず検証し、解決済み非機密設定を返す                           |
| `.validateOverrides()`                        | インスタンスの上書きを検証                                                     |
| `.resolveSource(input, kind?, explicit?)`     | ソース ID。kind は `series`（既定）か `chapter`                                |
| `.catalogOptions(source?, query?, signal?)`   | 現在の閲覧・検索モードのソートとフィルターを非同期取得                         |
| `.search(query, options?)`                    | `Promise<SearchPage>`。`source/page/sort/filters/signal`、1 始まり、空語は閲覧 |
| `.list(input, options?)`                      | `Promise<Series>`。`source/signal`、ソースの完全な読み順を保持                 |
| `.download(input, options?)`                  | `Promise<ChapterResult[]>`。任意 `chapters`、ID が両端を含む範囲より優先       |
| `.downloadChapter(input, options?)`           | 直リンクの `Promise<ChapterResult>`。`chapterId` は fixture 選択専用           |
| `.startDownload(input, options?)`             | `DownloadTaskHandle`。作品オプションに `direct: true` を追加可能               |
| `.readCover(id, options?)`                    | `Promise<CoverImage>`。明示または既定ソースが必要                              |
| `.openShelf(options?)`                        | `Promise<ShelfHandle>`。任意 `file` と全体既定 `intervalSeconds`               |

ダウンロードは `source/directory/jobs/retries/signal/onResult/onEvent/archive/outputRoot/outputMarker/taskScope` と、作品用 `chapters` を受け取ります。既定は並列 2 チャプター、追加再試行 2 回です。作品の保存先は作業ディレクトリ、直リンクは directory またはインスタンス output が必須です。オプション・ソース・目録解決の不正、中断は reject されます。個別チャプター失敗は結果を返し、他は継続します。

`Series.chapters` はサーバー用の読み取りメソッドを含み、ブラウザーへ直接送るべきではありません。必要な ID・タイトル・位置・任意メタデータのみを抽出し、`getPages()`、ページリーダー、ソースインスタンスを除いてください。

`ChapterResult` は `sourceId/workId/chapterId/workTitle/chapterTitle/number?/attempts` と、`downloaded/skipped`＋`path` または `failed/restricted`＋`error` を含みます。ブラウザー DTO ではありません。`onResult` の例外で新規開始を止め、実行中の終了を待ちます。`onEvent` は同期なので素早く返り、未処理の非同期処理を開始しないでください。

`taskScope` は同じチャプターの同時投入を区別し、`startDownload()` は独自の scope を作ります。ハンドルはコピーした `snapshot()`、全体 `cancel()`、初回 `done` Promise、以降の `retry()` Promise を提供します。解決前は空の場合があります。手動タスクは永続化しません。ソース設定はインスタンス作成時に固定され、変更には再作成が必要です。

## 本棚と自動化

| メソッド                                                             | 結果と用途                                                         |
| -------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `list()`                                                             | ローカル `ShelfEntry[]`                                            |
| `add(input, { source?, title?, signal?, retries? }?)`                | 解決後に保存。ソース・作品 ID で重複排除し既存を上書きしない       |
| `setInput(id, input, options?)`                                      | 同一ソース・作品を解決。実変更で目録基準を再作成                   |
| `configure(id, { autoCheck?, autoDownload?, intervalSeconds? })`     | 設定を更新して項目を返す。省略項目は維持                           |
| `setDefaultInterval(seconds)`                                        | 全体値を永続化し、その値を使う項目の予定を再計算                   |
| `follow(id)` / `unfollow(id)`                                        | 両自動化を切り替える。既存処理は中断しない                         |
| `remove(id)`                                                         | 項目・タスク記録を削除しアーカイブは維持                           |
| `check({ entryId?, includeHistory?, signal?, retries?, onCheck? }?)` | 任意項目・全体を確認。`{ checked, failures, queued, events }`      |
| `status(id?)`                                                        | ローカル `ShelfStatus[]`。時刻・結果・件数                         |
| `chapters(id)`                                                       | ローカル `ShelfChapter[]`。正規番号・発見時刻・状態                |
| `tasks(id?)`                                                         | 安全なローカルスナップショット。実行中ハンドルではライブ進捗を統合 |
| `needsAttention(id)`                                                 | 制限・停止の ID と状態                                             |
| `enqueue(id, chapterId)`                                             | `seen/discovered/cancelled` を登録。変更時 `true`                  |
| `cancel(id, chapterId)`                                              | 保留・実行中の中断を保存。確定済みアーカイブは維持                 |
| `retry(id, chapterId)`                                               | `blocked/restricted/retry/cancelled` を再登録。変更時 `true`       |
| `watch(options)`                                                     | 常駐 Promise。DB ごとに単一消費者                                  |
| `close()`                                                            | watcher を中断・await した後のみハンドルを閉じる                   |

間隔は 1〜31,536,000 秒の整数です。項目の `intervalSeconds: null` は全体値（初期 3600）を使います。項目の `autoCheck/autoDownload/following` は `0/1`、設定入力は真偽値です。`following` は自動確認の互換投影です。`ShelfEntry.intervalSeconds` は null 可の上書き、`ShelfStatus.intervalSeconds` は実効値です。`createdAt/updatedAt` は ISO 文字列、`lastCheck/lastSuccess/nextCheck/discoveredAt/readyAt` は Unix ミリ秒で、不明値は null または省略です。`readyAt: 0` は即実行可能です。

初回の正常確認は `seen` 基準を作ります。以降の新着は自動ダウンロード無効なら `discovered`、有効なら `queued`。通常確認は既知分を再登録しません。明示履歴指定には `entryId` が必要で、基準・発見済みの未登録分を登録します。どちらの自動化を無効にしてもキューは残ります。消えたチャプターは延期され、復活時に再開できます。

対象がなければ `enqueue/cancel/retry` は `false`、不明項目の `chapters/tasks` は空配列です。`check/configure/follow/unfollow/setInput/remove` は不明項目を拒否し、仮項目を作りません。

成功 `CheckEvent` は `baseline/updated/unchanged` と `queued/discovered`。並行変更で書き込みが無効になると `changed`。失敗は `failed` と安全な `problem`（`source-unavailable/authorization-failed/temporary-failure/catalog-failed/wrong-work/invalid-catalog/empty-catalog/check-conflict`）で、生のソースエラーは返しません。

## watcher とタスクイベント

`watch()` は signal と出力先（またはインスタンス output）が必須です。`jobs/retries/intervalSeconds/archive/outputRoot/outputMarker/onCheck/onTask/onEvent/onOutputUnavailable` も受け取ります。間隔指定は全体値を保存し、省略は保存値と項目別上書きを維持します。ネットワーク処理はトランザクション外です。コアが永続タスクを復元するため Web 側でキューを二重実装しないでください。

旧 `onTask` は `{ entryId, chapterId, state: retry|restricted|complete|blocked }` です。新規クライアントは `onEvent: ({ type: 'task', task }) => ...` を使います。

| スナップショット                 | 意味                                                                                               |
| -------------------------------- | -------------------------------------------------------------------------------------------------- |
| `id`, `origin`, `entryId?`       | 不透明タスク ID、`manual/shelf`、該当時の本棚 ID                                                   |
| `sourceId/workId/chapterId`      | 表示用識別子。機密・パス風文字列を伏せます。操作用 ID はサーバーに保持し、タスク ID を逆解析しない |
| `workTitle/chapterTitle/number?` | 名前と全目録での 1 始まり位置。選択内位置ではない                                                  |
| `state`                          | `queued/retry/starting/reading/archiving/downloaded/skipped/failed/restricted/cancelled`           |
| `pagesDownloaded/totalPages?`    | 現試行の進捗。総数不明は省略、再試行でリセット                                                     |
| `attempt`                        | 現試行番号。オフライン本棚は失敗回数を保持し、通算実行回数ではない                                 |
| `retryable/readyAt?`             | 明示再試行の可否で、自動再試行の約束ではない。任意の本棚実行可能時刻                               |
| `problem?`                       | 安全な `download-failed/access-restricted/output-unavailable`                                      |

DB の `complete/blocked` はスナップショットの `downloaded/failed` に対応します。ページ数は非永続で、watcher 停止時に消えます。イベントは永続ログではないため、SSE 再接続時にスナップショットを取得し、ブラウザー切断でバックグラウンド処理を止めないでください。伏せた表示用値を操作入力に戻さず、元 ID をサーバーで保持・解決します。中断直後の再試行は旧実行を無効化し、遅れて返る結果による上書きを防ぎます。

## アーカイブと表紙

`ArchiveOptions` は `{ template?, padding?, format? }`。既定は `{title}/{number}-{chapter}`、padding 0、`cbz` です。プレースホルダーは `{title}/{chapter}/{number}/{workId}/{chapterId}`。最大 4 相対要素で、絶対パス・トラバーサル・式は不可です。padding は 0〜12、形式は `cbz/zip`。UTF-8 バイト単位で無害化・切り詰めを行い、プラットフォームのパス長制限も検査します。他チャプターとの競合は上書きしません。設定変更後もルート内の識別マーカー付き既存アーカイブを検証・認識します。

`outputRoot` はルートマーカーと既存保存先を分離します。省略時 watcher は同一ディレクトリマーカー、手動でマーカーを使うにはルートも必須です。保護された保存先がなければ作りません。ディレクトリロックはハードリンク不要です。異常終了後の期限切れまで約 1 分かかる場合があります。使用中ロックを削除しないでください。

`planArchiveMigration(directory, entries, archive?, signal?)` は `identity: [sourceId, workId, chapterId]` と `title/chapter/number?` を受け取り、相対パス・識別情報・`move/unchanged/conflict` を返します。`applyArchiveMigration(directory, plan, signal?)` は `move` のみ適用し、識別を再検証して占有宛先を拒否します。一括トランザクションではなく、後続失敗でも完了移動は残ります。再プレビューしてから続行してください。両形式は ZIP コンテナーで、移行時に再取得しません。

検索は任意の `coverUrl/coverId`、作品 metadata は `title/authors/summary/tags/coverUrl/coverId` を持ちます。欠落は取得を妨げません。認証付き表紙の `readCover(coverId, { source, signal })` は `{ contentType, bytes }`（空でない JPEG/PNG/GIF/WebP、最大 10 MiB）を返します。Web は認証・プライベートキャッシュ・レスポンスヘッダーを担当します。任意 URL プロキシはありません。直リンクの任意 `seriesInput` により、コアは正規目録を検証します。未対応旧拡張は番号不明です。

## トップレベル関数とライフサイクル

| エクスポート                                   | 用途                                                       |
| ---------------------------------------------- | ---------------------------------------------------------- |
| `readConfig(file?, signal?)`                   | 明示 CLI v1 設定の読み込み。自動検出なし                   |
| `sourceOverrides(inputs?)`                     | `source.key=value` の解析                                  |
| `loadExtension(input)`                         | npm またはローカル ESM default export。URL は `file:` のみ |
| `fixtureExtension`                             | 明示登録するオフラインテスト用ソース                       |
| `withManagedDownloader(options, callback)`     | 明示・管理拡張を読み込み、非同期コールバック中は世代を固定 |
| `manageExtensions(action, package?, options?)` | `add/update/remove`、`directory/signal/stdio`              |
| `listManagedExtensions(options?)`              | `directory/signal` の読み取り専用一覧。ストア不在は空配列  |
| `checkExtensionUpdates(package?, options?)`    | 導入せず単一・全件確認。未導入の明示パッケージは拒否       |

一覧は `package/version/requested/sourceId/status`、不明バージョン・対応は null、状態は `loaded/failed` です。定義の import は有効なセッションの作成を意味しません。更新は `updateStatus: current/available/failed` を加え、成功に保存範囲・タグで解決した `availableVersion`、失敗に `query-failed/not-installed` を含みます。新しい版があるのは `available` のみです。個別失敗でも他結果を維持し、中断は reject です。適用は制約内で再解決するため以前の候補と一致するとは限りません。既定ストアは CLI と共有し、ディレクトリ指定で分離できます。

`withManagedDownloader()` から実行中ハンドルを返さず、内部ですべての手動タスク・watcher を await します。拡張・設定変更時は旧処理停止と世代解放を待って再読み込みします。認証は拡張が管理し、設定・スナップショット・ログに露出させないでください。リクエスト単位の Serverless ではなく常駐 Node.js プロセスを使います。
