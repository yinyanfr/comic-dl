---
title: ライブラリとして使う
description: Node.js プロジェクトでソースの検索、ダウンロード、本棚の自動更新を利用する。
---

4.x のタスクスナップショット、ページ進捗、独立した自動化、表紙、アーカイブ移行、読み取り専用の拡張機能照会は [Web バックエンドとタスク API](../service-api/)を参照してください。古い本棚 DB は更新前にバックアップしてください。

Node.js 24 の ESM プロジェクト（`.mjs` ファイル、または `package.json` に `"type": "module"` を指定）にコアと拡張機能をインストールします。

```sh
npm install comic-dl@latest @comic-dl/zerobyw
```

```ts
import downloader from 'comic-dl';
import zerobyw from '@comic-dl/zerobyw';

downloader.use(zerobyw);

const url = 'https://www.zerobyw33.com/pc/details/?kuid=123';
const series = await downloader.list(url);
console.log(series.chapters.map(({ id, title }) => ({ id, title })));

const results = await downloader.download(url, {
  directory: './downloads',
  jobs: 2,
  onResult: (result) => console.log(result),
});
```

実際の作品 URL に置き換え、[Zerobyw README](https://github.com/yinyanfr/comic-dl-extensions/blob/main/extensions/zerobyw/README.en.md) に従ってアプリの環境にセッションを設定します。完全 URL は登録済みソースと照合されます。短い ID や複数ソースに一致する URL には `{ source: 'zerobyw' }` を渡します。

`download()` の `chapters: ['2-4', 'chapter-id']` で対象を選べます。安定した ID が、1 始まり・両端を含む範囲より優先されます。全選択をファイル書き込み前に検証します。直リンクには `downloadChapter(chapterUrl, { directory })` を使います。単一の結果を返し、出力先が必要です。インスタンスの既定 `output` でも指定できます。

`download()` はチャプターごとの結果を返します。`downloaded/skipped` にはアーカイブパス、`restricted/failed` にはエラーが含まれます。個別の失敗だけでは全体の Promise は reject されないため、状態を確認してください。不正なオプション、ソース選択・一覧取得エラー、`signal` の中断では reject されます。`directory` は現在のディレクトリ、`retries` は追加 2 回が既定です。`onResult` には完了ごとに同じ結果が渡されます。

`onResult` が例外を投げるか Promise を reject すると、新規チャプターの開始を止め、実行中の処理終了を待ってから reject します。完成済みアーカイブは残ります。

既定エクスポートはスクリプト向けです。タスクごとに独立したソース登録が必要なら `createDownloader()` を使います。

```ts
import { createDownloader } from 'comic-dl';
import zerobyw from '@comic-dl/zerobyw';

const downloader = createDownloader().use(zerobyw);
console.log(downloader.sources()); // ['zerobyw']
```

`createDownloader()` は `.use()` で登録した拡張機能のみを使い、CLI の拡張機能や設定を自動では読み込みません。`{ source, sourceSettings, overrides, output, jobs, retries }` で既定値を指定できます。ソースは明示引数、インスタンス既定値、URL 照合の順です。`validateSourceSettings(id, candidate)` はインスタンスを変更せず、候補を検証して解決済みの非機密設定を返します。

`.use(extension, settings)` でそのインスタンスのソース設定を上書きできます。`sourceSettings(source)` で設定定義、`await catalogOptions(source, query)` で閲覧・検索のソートとフィルターを取得します。空の検索語は目録閲覧です。

```js
const page = await downloader.search('', {
  source: 'copymanga',
  sort: 'popular',
});
```

この例にはソート対応の CopyManga 拡張機能の登録が必要です。`search()` は `page/filters/signal` も受け取り、`{ results, hasNext }` を返します。

## CLI とライブラリの対応

| CLI                                               | ライブラリ API                                                                          |
| ------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `sources`, `sources --options`                    | `app.sources()`, `app.sourceSettings(source)`                                           |
| `search`, `search --options`                      | `app.search(query, options)`, `app.catalogOptions(source, query)`                       |
| `list`, `download`, `chapter`                     | `app.list()`, `app.download()`, `app.downloadChapter()`                                 |
| `shelf add/list/set-input/follow/unfollow/remove` | `app.openShelf()` のハンドルの `add/list/setInput/follow/unfollow/remove`               |
| `shelf check/status/watch/retry`                  | `shelf.check()`, `status()` と `needsAttention()`, `watch()`, `retry()`                 |
| `add`, `update`, `remove`                         | `manageExtensions(action, packageName, options)`                                        |
| `--extension`, `--config`, `--set`                | `loadExtension()` または `withManagedDownloader()`, `readConfig()`, `sourceOverrides()` |

独立した Web UI では常駐 Node.js バックエンドから API を呼び出します。watcher はバックエンドで動くため、ブラウザーを閉じても更新が続きます。

## 機能対応と Web 要件

| CLI                                                                          | 公開ライブラリ API                                                     |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `search --json`, `list --details`                                            | 検索の表紙と作品メタデータ・チャプター記述子                           |
| `--progress auto/plain/off`                                                  | ダウンロード・watcher の `onEvent`。ライブラリは既定で端末描画しません |
| `shelf configure/chapters/tasks/enqueue/cancel`                              | `configure/chapters/tasks/enqueue/cancel`                              |
| `shelf watch --interval`                                                     | `setDefaultInterval()`、項目ごとの値は `configure()`                   |
| `--archive-template/--archive-padding/--archive-format` または設定 `archive` | ダウンロード・watcher の `archive`                                     |
| `--output-root/--require-output-marker`                                      | 手動・watcher の `outputRoot/outputMarker`                             |
| `extensions`, `update --check`                                               | `listManagedExtensions()`, `checkExtensionUpdates()`                   |
| `migrate`, `migrate --apply`                                                 | `planArchiveMigration()`, `applyArchiveMigration()`                    |

意図的に CLI を設けない API もあります。認証付き表紙のバイト列はライブラリの `readCover()` を使い、CLI は記述子を返します。手動 `startDownload()` はプロセス内のハンドル・スナップショット・中断・再試行を提供しますが、CLI ではプロセス制御と Ctrl+C を使います。`shelf tasks` は永続状態を読み、別プロセスのライブページ数は取得しません。常駐ライブラリハンドルはライブイベントを統合できます。CLI 移行は作品単位、ライブラリでは複数作品の計画を構成できます。

[comic-dl-web](https://github.com/yinyanfr/comic-dl-web) の 7 要件は、本棚の独立自動化（コア #26）、メタデータ・認証付き表紙（#27）、命名・移行（#28）、共通タスク・ページ進捗（#29）、NAS ルートマーカー（#30）、管理済み拡張一覧（#31）、更新確認のみ（#32）に対応します。すべて公開 API があり、上表は CLI の入口と意図した差分を示します。

保守対象の 5 アダプターはすべて任意メタデータと直リンクの正規目録コンテキストに対応し、Komga/Kavita は認証付き表紙にも対応します。Zerobyw `0.3.1` と DM5 `0.2.1` は公開目録の表紙を修正しています。[拡張開発](../../extensions/develop/)と [Zerobyw チュートリアル](../../extensions/zerobyw-walkthrough/)を参照してください。Web 統合では CLI 出力解析や SQLite の直接編集ではなく、サーバー API を使います。

## 本棚と自動更新

CLI と同じ SQLite DB、またはサーバー用の別ファイルを使えます。必要なソースを登録済みのインスタンスで開きます。

```ts
const shelf = await downloader.openShelf({ file: './data/shelf.sqlite' });
try {
  const entry = await shelf.add(url, { title: 'Example' });
  shelf.follow(entry.id);
  const check = await shelf.check({ entryId: entry.id });
  console.log(check.events, shelf.status(entry.id));
} finally {
  shelf.close();
}
```

`list/status/needsAttention` は保存データのみを読み、ソースを呼びません。`setInput/unfollow/remove/retry(entryId, chapterId)` で作品や失敗・制限チャプターを管理します。初回の正常な `check()` は基準を記録し、`includeHistory: true` と `entryId` を指定すると既存分もキューに登録します。

常駐プロセスで `await shelf.watch({ signal, directory, onCheck, onTask })` を実行します。CLI と watcher ロックを共有します。停止時は signal を中断し、Promise の完了を待ってから本棚を閉じます。`intervalSeconds/jobs/retries/outputMarker/onOutputUnavailable` でスケジュールと NAS 出力を設定できます。[自動更新ガイド](../../shelf/updates/)を参照してください。

## 管理済み拡張機能と CLI 設定

```ts
import { manageExtensions, readConfig, withManagedDownloader } from 'comic-dl';

const extensionDirectory = './data/extensions';
await manageExtensions('add', '@comic-dl/copymanga', {
  directory: extensionDirectory,
});
const config = await readConfig('./comic-dl.json');
const page = await withManagedDownloader(
  { ...config, extensionDirectory },
  (app) => app.search('', { source: 'copymanga' }),
);
```

`manageExtensions('update', undefined, options)` は保存範囲内ですべてを更新し、`'remove'` とパッケージ名で削除します。ディレクトリ省略時は CLI と同じストアです。`withManagedDownloader()` はコールバック中の世代を保持します。内部のすべての処理を await してください。常駐 watcher は停止まで同じ世代を使うため、拡張機能や設定変更後は再起動します。

明示登録には `loadExtension(pathOrPackage)` または直接 import を使います。組み込みの `fixtureExtension` は[ローカルテスト](../../development/local-testing/)用に明示登録できます。CLI 形式の `source.key=value` を解析するには `sourceOverrides()` を使い、その返り値を `overrides` に渡します。
