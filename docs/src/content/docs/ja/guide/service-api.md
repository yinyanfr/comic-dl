---
title: Web バックエンドとタスク API
description: 独立した自動化、安全なタスクスナップショット、アーカイブ移行、表紙、拡張機能の照会。
---

以下の API は 4.0 以降の Node.js 24 バックエンド専用です。コア・拡張機能・SQLite をブラウザーに読み込まないでください。登録は[ライブラリガイド](../library/)、更新前の注意は[移行ガイド](../../migration/v3-to-v4/)を参照してください。

ライブラリと CLI の範囲は意図的に異なります。[機能比較](../library/#機能対応と-web-要件)を参照してください。アダプター作者は[拡張開発](../../extensions/develop/)と [Zerobyw チュートリアル](../../extensions/zerobyw-walkthrough/)に従い、ソース内にタスク・アーカイブ・Web 通信を再実装しないでください。

## 本棚の確認と自動化

```ts
const shelf = await app.openShelf({ file: './data/shelf.sqlite' });
shelf.setDefaultInterval(3600);
shelf.configure(entryId, {
  autoCheck: true,
  autoDownload: false,
  intervalSeconds: 1800,
});
await shelf.check(); // 自動化無効の項目も含む本棚全体。
await shelf.check({ entryId });
const chapters = shelf.chapters(entryId);
shelf.enqueue(entryId, chapterId);
shelf.cancel(entryId, chapterId);
shelf.retry(entryId, chapterId);
```

`autoCheck` は定期確認、`autoDownload` は新規発見チャプターのキュー登録を制御します。後者は手動確認にも適用されます。いずれを無効にしても既存タスクは中断されません。明示的に `cancel()` を呼んでください。`follow/unfollow` は両方を切り替える互換ショートカットです。項目の `intervalSeconds: null` は全体の既定値を使います。間隔の変更は基準を消さず、次回確認時刻を再計算します。

初回の正常な確認は基準の記録のみです。以降、自動登録されない新着は `discovered` と `discoveredAt` を保持し、再確認でも消えません。自動ダウンロードを有効にしても過去分は自動登録されません。`enqueue()` または明示的な `check({ entryId, includeHistory: true })` を使います。通常確認は中断済みチャプターを再登録しません。

`chapters()` は安定した ID、タイトル、正規番号、発見時刻、`seen/discovered/queued/retry/restricted/complete/blocked/cancelled` 状態を返します。`status()` には最終確認・成功、次回自動確認（無効時 `null`）、実効間隔、件数が含まれます。本棚・タスクの読み取りはオフラインで動き、不明な項目の `chapters/tasks` は空配列です。

## 手動タスクと watcher

```ts
const task = app.startDownload(input, {
  chapters: ['2-4'],
  directory: './downloads',
  onEvent: publishSafeEvent,
});
task.snapshot();
// 別のサーバーハンドラーから task.cancel() を呼べます。
try {
  await task.done;
} catch (error) {
  if (!(error instanceof Error && error.name === 'AbortError')) throw error;
}
if (task.snapshot().some((chapter) => chapter.retryable)) {
  await task.retry();
}
```

直リンクには `startDownload(input, { direct: true, directory })` を使います。目録解決前のスナップショットは空の場合があります。手動ハンドルは現在のプロセス内のみ有効です。サーバーで保持し、Promise の reject を処理してください。`done` は初回実行、以降は `retry()` の Promise を await します。再試行は失敗・制限・中断のチャプターのみ対象です。個別失敗は結果であり、バッチ Promise の reject ではありません。

既存の `download/downloadChapter` も `onEvent` を受け取ります。結果にはソース・作品・チャプターの識別情報、表示名、判明時の正規位置を含みます。結果と `onResult` にはサーバーパスや診断情報もあるため、**ブラウザーへ直接シリアライズしないでください**。

watcher も同じ `onEvent` を受け取ります。`shelf.tasks(entryId?)` は手動と同じ `DownloadTaskSnapshot[]` 形式で、クライアントで統合できます。フィールドは `id/origin/entryId?`、`sourceId/workId/chapterId`、作品・チャプター名、任意の番号、`state/pagesDownloaded/totalPages/attempt/retryable`、安全な `problem` です。イベントは `{ type: 'task', task: snapshot }`。段階はキュー、開始、読み取り、アーカイブ、最終結果です。ページ数は試行ごとにリセットし、総数不明時は段階を表示します。

スナップショット・イベントにパス、リクエスト、認証情報、生の例外は含みません。SQLite は watcher キューを永続化しますが、ライブページ数は実行中ハンドルに属し、プロセス再起動でリセットされます。再接続では完全なイベント再送を前提にせず、新しいスナップショットを取得してください。watcher の中断はサービスを止めますが永続タスクは消しません。個別 `cancel()` は中断を永続化し、`retry()` で再登録します。

メソッド、状態フィールド、時刻単位、ライフサイクル制約の全体は[公開 API リファレンス](../../reference/library-api/)を参照してください。

## 読みやすいアーカイブとマウント保護

```ts
const archive = {
  template: '{title}/{number}-{chapter}',
  padding: 3,
  format: 'zip' as const,
};
await app.download(input, { directory: './downloads', archive });
await shelf.watch({
  signal,
  directory: '/mnt/comics/Manga',
  outputRoot: '/mnt/comics',
  outputMarker: '.nas-ready',
  archive,
  onEvent: publishSafeEvent,
});
```

既定はゼロ埋めなし・CBZ です。テンプレートは `{title}/{chapter}/{number}/{workId}/{chapterId}` を使え、相対パスは最大 4 要素、式は不可です。コアは予約名・特殊文字の無害化、長い名前の切り詰め、識別情報による同名作品の区別を行い、競合ファイルを上書きしません。番号は選択前の全目録での位置です。直リンクの目録を解決できない旧拡張機能では番号不明となり、ファイル名にチャプター ID を使います。

`outputRoot` を指定すると、出力先はルート内の既存の実ディレクトリである必要があり、マーカーはルートで確認します。マーカー・指定ディレクトリがなければ、指定先の再作成やアーカイブ確定をせずタスクを延期します。テンプレートによる作品サブディレクトリは作成できます。手動ダウンロードも同じ保護に対応します。`outputRoot` なしの watcher は従来どおり同一ディレクトリのマーカーを使います。

テンプレート・形式変更だけでは改名しません。旧ハッシュ名 CBZ を含め、安定した識別情報と整合性検査で既存ファイルを発見します。

所有権とアーカイブ確定はディレクトリロックで comic-dl の並行書き込みを調整し、ロック内で宛先占有を再確認して、ハードリンク不要のアトミックな rename を使います。異常終了後の古いロックは回復します。移行中は他ツールの書き込みを停止してください。索引走査は無関係なサブディレクトリの権限・消失エラーを分離しますが、選択した出力ルートへアクセスできなければエラーです。

明示的な改名例：

```ts
import { planArchiveMigration, applyArchiveMigration } from 'comic-dl';

const series = await app.list(input, { source });
const entries = series.chapters.map((chapter, index) => ({
  identity: [source, series.id, chapter.id] as const,
  title: series.metadata?.title ?? series.id,
  chapter: chapter.title,
  number: index + 1,
}));
const preview = await planArchiveMigration(directory, entries, archive);
// 管理者が from/to/status を確認。競合は適用されません。
await applyArchiveMigration(directory, preview);
```

移行記録の相対ファイルパスはサーバー管理用です。プレビューは書き込まず、適用時に識別情報を再検証し、トラバーサル、シンボリックリンク、宛先上書きを拒否します。CBZ と ZIP は同じ ZIP コンテナーなので拡張子変更でページを再取得しません。書き込みを止め、マウントが安定した状態で移行してください。

## メタデータと表紙

検索結果は `coverUrl/coverId`、`Series.metadata` は `title/authors/summary/tags/coverUrl/coverId` を含む場合があります。すべて任意で、欠落時はプレースホルダーを表示してください。公開表紙 URL に認証情報を含めてはいけません。認証付き表紙は `await app.readCover(coverId, { source, signal })` で `{ contentType, bytes }` を取得し、認証済みの画像エンドポイントで配信します。ソースが ID と宛先を制限します。コアは任意 URL プロキシではなく、非対応形式、空画像、10 MiB 超を拒否します。

## 管理済み拡張機能の調査

```ts
import {
  listManagedExtensions,
  checkExtensionUpdates,
  manageExtensions,
} from 'comic-dl';
const options = { directory: './data/extensions' };
const installed = await listManagedExtensions(options);
const updates = await checkExtensionUpdates(undefined, options);
const one = await checkExtensionUpdates('@comic-dl/copymanga', options);
// 利用者の確認後にのみ適用：
await manageExtensions('update', '@comic-dl/copymanga', options);
```

一覧は現世代の `package/version/requested/sourceId/status` を返します。壊れたパッケージも残り、不明な対応は `null`、ソース ID 重複は失敗です。`loaded` は定義を登録できる意味で、認証やサイトの動作保証ではありません。信頼したモジュールを import しますが、セッション作成・インストール・バージョン切り替えは行いません。

更新確認は `updateStatus: current/available/failed` を加え、成功時に `availableVersion`、失敗時に安全な `problem` を返します。保存範囲・タグと npm レジストリ設定（プレリリース規則を含む）に従い、完全固定バージョンは固定のままです。単一失敗で他の結果は失いません。パッケージ省略は全件、未導入の明示指定は reject です。両照会は `signal` に対応し、永続一覧キャッシュを作りません。確認はその時点のスナップショットで、適用時に再解決します。拡張変更後は従来どおり watcher を再起動してください。
