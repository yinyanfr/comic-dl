---
title: ソース拡張 API v1
description: エクスポート、安定した識別子、読み順、認証、エラーの規約。
---

公開 TypeScript 型は `comic-dl/extension` から import します。定義は [`src/extension.ts`](https://github.com/yinyanfr/comic-dl/blob/main/src/extension.ts)、実装手順は[拡張開発ガイド](../../extensions/develop/)を参照してください。

## モジュール契約

- default export は `{ apiVersion: 1, id, create }`。`id` は `[a-z0-9]+(?:-[a-z0-9]+)*` に一致し、読み込み済み ID と重複不可です。`fixture` はコア予約です。
- `create(api)` は同じ `id` の `ChapterSource` を同期で返します。`sources` で宣言だけ調べる場合があるため、セッション初期化は `create()` 以降にします。
- 任意の `matchesUrl(url, kind)` は完全 URL の対応可否を同期で判定します。kind は `'series'/'chapter'`。通信やセッション生成は行いません。未実装でも `--source` で選択できます。

## 作品・チャプター・ページ

| インターフェース                        | 契約                                                                                                                         |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `getSeries(input, signal)`              | 完全な読み順の `{ id, chapters, metadata? }`                                                                                 |
| `getChapter(input, signal)`             | `{ workId, chapter, seriesInput?, metadata? }`。直リンクと目録で安定 ID を共有                                               |
| `search(query, page, signal, options?)` | 任意。空語は閲覧、1 始まり。`{ results: [{ title, url, coverUrl?, coverId? }], hasNext }` を返す。URL は再利用可能な作品入力 |
| `readCover(id, signal)`                 | 任意。ソース制約付きの保護エンドポイントから `{ contentType, bytes }`。任意 URL プロキシ不可                                 |
| `chapter.getPages(signal)`              | 読み順のページ。再試行時に再呼び出しされるため一時リンクを更新可能にする                                                     |
| `page.read(signal)`                     | `Uint8Array` の画像バイト列。`jpg/jpeg/png/gif/webp` に対応                                                                  |

作品 ID はソース内、チャプター ID は作品内、ページ ID はチャプター内の識別子です。選択・アーカイブ識別・ページ順を決めるため、変動するタイトル、一時署名、認証情報、現在の位置から作らないでください。

## バージョン 4 の任意メタデータと正規コンテキスト

4 も API v1 を維持し、`Series.metadata`（`title/authors/summary/tags/coverUrl/coverId`）と検索の `coverUrl/coverId` を追加します。`getChapter()` の再利用可能な `seriesInput` により、コアは全目録を読み、作品・チャプター識別を検証して表示情報と正規位置を取得します。未対応の旧拡張は架空の 1 ではなく番号不明です。認証付き表紙には `readCover(id, signal): Promise<{ contentType, bytes }>` を実装し、ID・宛先を制限し、認証をサーバーに留め、任意 URL を受け付けないでください。任意項目の欠落は旧拡張を壊しません。[バックエンド API](../../guide/service-api/)を参照してください。

`title/summary/coverUrl/coverId` は文字列、`authors/tags` は文字列配列です。任意の `Chapter.number` は完全な正規目録の 1 始まり位置で、識別子や選択内位置ではありません。直リンクの `metadata` は正規コンテキストなしでも表示用に使えます。公開表紙 URL に認証を含めず、`coverId` はソース管理の不透明 ID とします。表紙は空でない JPEG/PNG/GIF/WebP、最大 10 MiB です。例とオフライン検証は[拡張開発](../../extensions/develop/#最小アダプターから完全なソースへ)を参照してください。

## 任意の実行時設定と目録機能

- `settings` のキーは安定した `[a-z][a-z0-9-]*`。各定義は `label/type` と任意の `description/default` を持ちます。型は `text/url/boolean/integer`（任意 `min/max`）/`select`（`{ id, label }` 選択肢）です。`env` は既存の非機密環境変数との互換用のみです。
- コアは値を検証し、同じ読み取り専用設定を `matchesUrl(url, kind, settings)` と `create(api, settings)` に渡します。任意の同期 `validateSettings(settings)` でサイト固有規則を検証できます。旧呼び出しが settings を省略しても従来の既定値を維持してください。Cookie・パスワード・API キーは対象外です。
- `catalog.browse/search` は閲覧・検索の `sorts/filters` を宣言します。sort は `{ id, label }`。filter は設定型に加え、`catalogChoices(key, mode, signal)` で選択肢を得る `dynamic-select` に対応します。
- 検証済みオプションは `search(query, page, signal, { sort, filters })` の第 4 引数に渡ります。ソース側で上流クエリへ変換し、同条件で `hasNext` を算出します。

## HTTP とエラー

読み取りは `AbortSignal` を尊重します。`api.createSourceHttp({ requestHeaders, credentialHeaders, credentialOrigins, allowedOrigins })` は `(url, signal, authenticated = false)` 関数を返し、`{ bytes, url, contentType }` に解決します。`requestHeaders/allowedOrigins` は任意です。通常ヘッダーは `requestHeaders` を使います。認証ヘッダーは認証を明示要求し、宛先オリジンが許可される場合のみ送信し、別オリジンへのリダイレクト後には再付与しません。

- 再試行可能エラーは注入された `api.TransientSourceError` を使います。HTTP ヘルパーはタイムアウトと一部の一時 HTTP 状態をこの型へ変換します。
- サイトが当該チャプターを明示的に拒否した場合のみ、`getPages()` から注入された `api.RestrictedChapterError` を投げます。ログイン期限切れ、不明 HTTP エラー、解析失敗はチャプター制限ではありません。
- 一時的でない HTTP 失敗は `api.SourceHttpError.status` で取得できます。認証情報、署名 URL、機密レスポンスを利用者ログやアーカイブ識別子へ入れないでください。
