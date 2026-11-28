---
title: ソース拡張機能の開発
description: comic-dl のソース拡張機能を実装・テスト・パッケージ化する。
---

ソース拡張機能は独立公開する Node.js 24 ESM パッケージです。CLI は `comic-dl add <package>`、ライブラリは `.use()` で登録します。開発中は `--extension` や設定でローカルモジュールを読み込みます。拡張は入力判定・ログイン・サイト解析、コアは並列処理・チャプター再試行・中断・CBZ/ZIP・命名・進捗、CLI は端末表示と終了コードを担当します。`matchesUrl` で完全 URL の自動選択に対応できます。

手を動かして学ぶには、fixture 解析から最初の CBZ 生成までの [Zerobyw チュートリアル](../zerobyw-walkthrough/)を参照してください。

## 最小の試作品を実行

[hello-extension.mjs](https://github.com/yinyanfr/comic-dl/blob/main/examples/hello-extension.mjs) は 1 作品・1 チャプター・1 GIF の例です。依存導入後はネットワークなしで動きます。

```sh
npm ci
npm run build
node dist/index.js sources --extension ./examples/hello-extension.mjs
node dist/index.js list --extension ./examples/hello-extension.mjs --source hello demo
node dist/index.js chapter --extension ./examples/hello-extension.mjs --source hello welcome --output ./downloads
node dist/index.js download --extension ./examples/hello-extension.mjs --source hello demo --output ./downloads
```

`--extension` は繰り返せます。`./`、`../` は作業ディレクトリ基準です。絶対パスや CLI と同じ npm プロジェクトのパッケージも指定できます。リモートモジュール URL、自動ディレクトリ探索は非対応です。拡張は CLI と同じ権限を持つため、信頼できるコードのみ読み込んでください。`sources` は宣言を調べるだけで `create()` を呼びません。

## API v1

公開型を `comic-dl/extension` から import し、`SourceExtension` を default export します。

```ts
import type { SourceExtension } from 'comic-dl/extension';

export default {
  apiVersion: 1,
  id: 'hello',
  create(api) {
    // アダプターを返します。完全な例は hello-extension.mjs を参照。
    return createHelloSource(api);
  },
} satisfies SourceExtension;
```

識別子・読み順・HTTP セッション・エラー規約は[ソース拡張 API v1 仕様](../../specs/source-extension-v1/)を参照してください。

## 最小アダプターから完全なソースへ

4 も API v1 を維持します。以下は任意機能で、旧拡張にすべての実装は不要です。`comic-dl@4.0.0` 以降の互換版で開発し、コア宣言のコピーや非公開 `dist/` import を使わないでください。

### メタデータ・検索表紙・直リンクコンテキスト

`getSeries()` は安定 ID と完全な読み順を返します。ページに存在するメタデータを付けられます。

```ts
return {
  id: workId,
  metadata: {
    title,
    authors,
    summary,
    tags,
    coverUrl, // 検証済みの公開画像 URL。なければ省略。
  },
  chapters,
};
```

検索結果にも `coverUrl/coverId` を含められます。各作品の詳細を個別取得しないでください。メタデータ欠落でも閲覧・一覧・取得を壊さないようにします。DM5 の目録は `.mh-cover` の CSS `background-image`、検索は `img/data-src` の場合があります。既知ノードから URL を抽出し、スタイルやスクリプトは実行せず、各レイアウトをテストします。

直リンクは `{ workId, chapter, seriesInput }` を返します。`seriesInput` は設定先の再利用可能な正規作品入力で、必要なグループを保持します。コアが全目録を読み、作品・チャプターを検証します。直リンクに位置 1 を付けたり選択分を振り直したりしないでください。不明なら省略し、安定 ID による名前へフォールバックさせます。直リンクにも `metadata` を付けられます。

### 公開表紙と認証付き表紙

- 公開 `coverUrl` に Cookie・パスワード・API キー・認証クエリを含めず、宛先をソース設定に制限します。危険・欠落値は省略し、クライアント側で代替表示します。
- Zerobyw は明示的に信頼した設定済みサイト・画像オリジンの HTTP 表紙のみ HTTPS 化し、プロトコル・オリジン・ポート・認証・クエリ・フラグメントを再検証します。任意 HTTP ホストの HTTPS 化で信頼済みになるわけではありません。
- Komga/Kavita などは認証を含まない `coverId` と `readCover(id, signal)` を使います。ID を検証し、紐付けたサービスの固定エンドポイントから取得します。任意プロキシ URL や Auth Key URL を公開しないでください。
- `{ contentType, bytes }` を返します。コアは空でない JPEG/PNG/GIF/WebP、最大 10 MiB を受け付けます。アダプター側も読み取り量を制限します。Web は認証付き画像エンドポイントとプライベートキャッシュを提供します。

### 設定・認証・目録機能

非機密 `settings` を宣言します。`matchesUrl(url, kind, settings)` と `create(api, settings)` は同じ解決済み値を使い、`validateSettings()` で固有制約を検証します。必要に応じて既定・現行・明示された旧サイトを認識し、安定 ID から現行サイトの読み取り URL を組み直します。

Cookie・キーを設定、検索結果、メタデータに入れないでください。サーバー変更で旧認証を自動転送しないこと。Zerobyw は `COMIC_DL_ZEROBYW_COOKIE_ORIGIN`、Komga/Kavita は逆プロキシパスを含むサービス URL 全体に認証を紐付けます。変更時は旧 watcher を止めてインスタンスを再作成します。

必要なら公開検索・文書・画像のリーダーを分けます。認証読み取りは明示的かつ宛先制限付きにし、別オリジンへのリダイレクトで再付与しません。Zerobyw の検索・画像は匿名のままです。

`catalog.browse/search` にソート・フィルターを独立宣言し、動的選択肢は `catalogChoices()` で取得します。検証済み第 4 引数 `{ sort, filters }` を上流クエリへ変換し、ページ間で条件を維持します。サイト固有処理はアダプターに留めます。

### 進捗は拡張プロトコルではない

中断可能な `getPages()` と `Page.read()` のみ実装します。開始・ページ進捗・アーカイブ・結果はコアが発行します。CLI 描画・SSE・永続キュー・アーカイブ書き込みを拡張に作らないでください。ライブラリは安全な `onEvent`、CLI は `--progress auto|plain|off` を使います。総数不明時は段階を表示し、再試行で現試行のページ数をリセットします。ライフサイクルは[バックエンド API](../../guide/service-api/)を参照してください。

## オフライン検証チェックリスト

CLI のスモークテストに加え、同じアダプターを公開 `createDownloader().use(extension, settings)` でも検証します。

| 場面                   | 期待動作                                                                   |
| ---------------------- | -------------------------------------------------------------------------- |
| 全作品・選択・直リンク | 安定 ID が同じ。正規番号を維持し、正常アーカイブをスキップ                 |
| メタデータ・検索       | 存在時のみ任意値を含み、欠落も動作。作品ごとの詳細取得なし                 |
| 公開表紙               | HTTPS・信頼 HTTP 正規化・設定オリジンとポート。危険ホスト・認証 URL は拒否 |
| 認証付き表紙           | 正常不透明 ID は動作。任意 URL・不正 ID・漏洩・不正宛先は拒否              |
| 設定・認証             | 新旧入力を設定先へ解決。紐付いた宛先のみ認証し、匿名読み取りを維持         |
| ページ・失敗           | 順序、遅延画像、中断、一時再試行、期限切れと制限の区別                     |
| コアタスク             | `onEvent` のページ・アーカイブ段階に生エラー・ローカルパスを露出しない     |

コア検証は実サイトに依存させません。実サイト・NAS・セルフホスト環境の検証は別に報告し、ループバックテストを実デプロイの受け入れ確認としないでください。

## 独立したパッケージ化

別の npm プロジェクトを使います。TypeScript は `module/moduleResolution: NodeNext`、`@types/node@24`、`types: ["node"]` を設定します。開発時にコアを導入し、`comic-dl/extension` を `import type` で使います。実行時 API は `create(api)` で注入されます。`type: "module"`、コンパイル済み入口への `exports`、独自の実行時依存を設定します。

```json
{
  "name": "@example/comic-dl-source",
  "version": "0.1.0",
  "type": "module",
  "exports": "./dist/index.js",
  "files": ["dist"]
}
```

[Zerobyw](https://github.com/yinyanfr/comic-dl-extensions/tree/main/extensions/zerobyw) は完全な例です。独自リポジトリ・npm scope、または workspace 内で個別公開できます。CLI は導入時のライフサイクルを省略するため、コンパイル済み入口を同梱してください。

公開前に拡張プロジェクトで `npm pack` を実行し、一時 npm プロジェクトで検証します。

```sh
npm install comic-dl@latest /path/to/example-comic-dl-source-0.1.0.tgz
npm exec -- comic-dl sources --extension @example/comic-dl-source
```

機密を除いた fixture とループバック HTTP でページ順・期限切れ・制限・リダイレクトを検証します。[Zerobyw テスト](https://github.com/yinyanfr/comic-dl-extensions/blob/main/extensions/zerobyw/test/zerobyw.test.js)はアカウント・実サイトなしで実 CLI を動かします。拡張リポジトリ内の `npm test --workspace @comic-dl/zerobyw` で単独実行できます。
