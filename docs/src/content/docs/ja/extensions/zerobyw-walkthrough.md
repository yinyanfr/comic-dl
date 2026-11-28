---
title: Zerobyw サンプル拡張機能を作る
description: メタデータ、信頼できる表紙、正規目録コンテキスト、CLI・ライブラリ検証をオフラインで学び、設定と認証へ進む。
---

コア 4.x（拡張 API は引き続き v1）向けのチュートリアルです。メタデータ・公開表紙・直リンクの正規目録コンテキスト・CBZ 出力に対応するアダプターを作ります。アカウントや漫画サイトへの接続は不要です。後半では[公開拡張機能](https://github.com/yinyanfr/comic-dl-extensions/blob/main/extensions/zerobyw/src/index.ts) `0.3.1` の設定・認証紐付けと比較します。表紙 URL は検証するのみで取得しません。

## 1. 作品とチャプターの ID を抽出

Node.js 24 を使います。コアリポジトリルートで依存を導入・ビルドし、練習用の別ディレクトリに HTML パーサー Cheerio をインストールします。

```sh
npm ci
npm run build
workshop="$(mktemp -d ./zerobyw-workshop.XXXXXX)"
npm install --prefix "$workshop" cheerio@1
```

`$workshop` に `source.mjs` を作ります。作品ページは `kuid`、閲覧ページは `zjid` が ID です。改名・順序変更でも識別を維持するため、サイト ID を文字列のまま使います。

```js
import { load } from 'cheerio/slim';
import { Buffer } from 'node:buffer';

const origin = 'https://www.zerobyw33.com';
const sourceId = 'zerobyw-workshop';

function idFromUrl(url, kind) {
  if (!url || url.origin !== origin || url.username || url.password) return;
  const path = kind === 'series' ? '/pc/details/' : '/pc/view/';
  if (url.pathname !== path && url.pathname !== `${path}index.php`) return;
  const id = url.searchParams.get(kind === 'series' ? 'kuid' : 'zjid');
  if (id && /^[1-9]\d*$/.test(id)) return id;
}
```

公開拡張は `siteUrl/pageId/requestUrl` で判定規則を共有します。`matchesUrl` は URL のみを検査し、読み取り時も再検証して正規 URL を作ります。公開実装は認識した HTTP リンクの HTTPS 化にも対応します。

## 2. サンプル HTML からチャプターとページを作る

同じファイルに以下を追加します。作品 `1` には `101/102` があり、2 番目を使って直リンク・選択でも位置が 1 にならないことを確認します。実画像 URL は `data-src`、`src` は仮画像です。埋め込み GIF を画像レスポンスの代わりに使います。

```js
const workId = '1';
const seriesHtml = `
  <h1>Sample Manga</h1>
  <span class="author">Sample Author</span>
  <p class="summary">Local fixtures only.</p>
  <span class="tag">Slice of life</span>
  <img class="cover" src="http://tupa.zerobyw33.com/covers/1.jpg">
  <section>
    <header><h2>Chapter list</h2></header>
    <div>
      <a href="/pc/view/index.php?zjid=101">Opening</a>
      <a href="/pc/view/index.php?zjid=102">Chapter two</a>
    </div>
  </section>`;
const readerHtml = `
  <div id="image-container">
    <img class="manga-image" data-src="/images/cover.gif" src="/placeholder.gif">
  </div>`;
const image = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

function chaptersFromSample() {
  const $ = load(seriesHtml);
  return $('h2')
    .parent()
    .next()
    .find('a[href]')
    .toArray()
    .map((link) => {
      const id = idFromUrl(new URL($(link).attr('href'), origin), 'chapter');
      if (!id) throw new Error('Invalid chapter link');
      return {
        id,
        title: $(link).text().trim(),
        async getPages(signal) {
          signal.throwIfAborted();
          const reader = load(readerHtml);
          const src = reader('#image-container img.manga-image').attr(
            'data-src',
          );
          if (src !== '/images/cover.gif')
            throw new Error('Missing sample image');
          return [
            {
              id: `1:${src}`,
              extension: 'gif',
              async read(signal) {
                signal.throwIfAborted();
                return image;
              },
            },
          ];
        },
      };
    });
}
```

`chaptersFromSample` は一覧を解析します。CLI の `list` は `getPages()` を呼びません。ダウンロード時に閲覧ページを読み、`Page.read()` で画像を取得します。拡張が順序を供給し、コアが CBZ/ZIP・命名・進捗を担当します。

メタデータパーサーも追加します。明示的に信頼するサイト・画像オリジンのみ HTTPS 化し、変換後にオリジン（ポート含む）、認証、クエリ、フラグメントを再検証します。ドメイン末尾一致や任意ホストの HTTPS 化を信用しないでください。

```js
const imageOrigin = 'https://tupa.zerobyw33.com';

function publicCover(value) {
  if (!value) return;
  const url = URL.parse(value, origin);
  if (!url) return;
  if (url.protocol === 'http:') url.protocol = 'https:';
  if (
    url.protocol !== 'https:' ||
    ![origin, imageOrigin].includes(url.origin) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    return;
  return url.href;
}

function metadataFromSample() {
  const $ = load(seriesHtml);
  return {
    title: $('h1').text().trim(),
    authors: [$('.author').text().trim()],
    summary: $('.summary').text().trim(),
    tags: $('.tag')
      .toArray()
      .map((node) => $(node).text().trim()),
    coverUrl: publicCover($('.cover').attr('src')),
  };
}
```

公開アダプターは上記 2 値を固定せず、現在の設定から信頼オリジンを作ります。欠落メタデータは省略し、取得を妨げないでください。検索表紙はカードから抽出し、作品ごとの詳細を取得しません。認証付き表紙には `coverId/readCover()` を使い、`coverUrl` に Cookie や Auth Key を含めません。

## 3. 拡張を登録し CLI で検証

末尾に API v1 の default export を追加します。`getSeries/getChapter` は安定 ID を共有し、どちらの入力で作ったアーカイブでも再認識できます。

```js
/** @type {import('comic-dl/extension').SourceExtension} */
const extension = {
  apiVersion: 1,
  id: sourceId,
  matchesUrl(url, kind) {
    return idFromUrl(url, kind) !== undefined;
  },
  create() {
    return {
      id: sourceId,
      async getSeries(input, signal) {
        signal.throwIfAborted();
        if (idFromUrl(URL.parse(input), 'series') !== workId) {
          throw new Error('Expected sample work 1');
        }
        return {
          id: workId,
          metadata: metadataFromSample(),
          chapters: chaptersFromSample(),
        };
      },
      async getChapter(input, signal) {
        signal.throwIfAborted();
        const id = idFromUrl(URL.parse(input), 'chapter');
        const chapter = chaptersFromSample().find((item) => item.id === id);
        if (!chapter) throw new Error('Expected sample chapter 101 or 102');
        return {
          workId,
          chapter,
          seriesInput: new URL(`/pc/details/?kuid=${workId}`, origin).href,
        };
      },
    };
  },
};

export default extension;
```

同じターミナルのリポジトリルートで実行します。公開拡張も `add` 済みなら同じサイトを認識するため、`--source` でサンプルを選びます。

```sh
work_url='https://www.zerobyw33.com/pc/details/?kuid=1'
chapter_url='https://www.zerobyw33.com/pc/view/index.php?zjid=102'
node dist/index.js sources --extension "$workshop/source.mjs"
node dist/index.js list "$work_url" --extension "$workshop/source.mjs" --source zerobyw-workshop
node dist/index.js list "$work_url" --extension "$workshop/source.mjs" --source zerobyw-workshop --details
node dist/index.js chapter "$chapter_url" --extension "$workshop/source.mjs" --source zerobyw-workshop -o "$workshop/output" --progress plain
node dist/index.js download "$work_url" --extension "$workshop/source.mjs" --source zerobyw-workshop -c 2-2 -o "$workshop/output"
node dist/index.js download "$work_url" --extension "$workshop/source.mjs" --source zerobyw-workshop -o "$workshop/output"
```

`sources` は `zerobyw-workshop`、`list` は順に `101/102`、`--details` はメタデータと HTTPS 表紙を返します。直リンクは `1.gif` を含む `Sample Manga/2-Chapter two.cbz` を作り、`2-2` の選択はスキップ、最後の全作品取得は `1 downloaded, 1 skipped` です。`--progress plain` は制御文字なしでページ数・アーカイブ段階を stderr に出力します。既定 `auto` は端末のみ表示し、リダイレクトでは無出力です。

`seriesInput` によりコアが全目録を再取得して識別を検証するため、直リンクにも作品名と位置 2 を引き継ぎ、架空の単一位置を作りません。

## 4. 同じアダプターを公開ライブラリで検証

`$workshop/verify.mjs` を作り、リポジトリルートから `node "$workshop/verify.mjs"` を実行します。コアへの相対 import はこの演習専用で、独立プロジェクトは `import { createDownloader } from 'comic-dl'` を使います。

```js
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createDownloader } from '../dist/library.js';
import extension from './source.mjs';

const app = createDownloader().use(extension);
const input = 'https://www.zerobyw33.com/pc/details/?kuid=1';
const series = await app.list(input);
assert.equal(
  series.metadata.coverUrl,
  'https://tupa.zerobyw33.com/covers/1.jpg',
);
assert.deepEqual(
  series.chapters.map(({ id }) => id),
  ['101', '102'],
);
const events = [];
const task = app.startDownload(
  'https://www.zerobyw33.com/pc/view/index.php?zjid=102',
  {
    direct: true,
    directory: fileURLToPath(new URL('./library-output', import.meta.url)),
    archive: { padding: 3, format: 'zip' },
    onEvent: (event) => events.push(event),
  },
);
await task.done;
assert.equal(task.snapshot()[0].number, 2);
assert.equal(task.snapshot()[0].state, 'downloaded');
assert.ok(
  events.some(
    ({ task }) => task.state === 'reading' && task.pagesDownloaded === 1,
  ),
);
assert.ok(events.some(({ task }) => task.state === 'archiving'));
const [result] = await app.download(input, {
  chapters: ['2-2'],
  directory: fileURLToPath(new URL('./library-output', import.meta.url)),
});
assert.equal(result.status, 'skipped');
assert.equal(result.number, 2);
```

`Sample Manga/002-Chapter two.zip` が作られます。後続の既定 CBZ 設定でも識別情報で ZIP を認識します。安全なスナップショットは Web 向けですが、`result.path/error` はサーバー詳細であり直接転送してはいけません。中断・再試行のライフサイクルは[バックエンド API](../../guide/service-api/)を参照してください。

## 5. 実サイト実装と比較

固定サンプルを実処理に置き換える際は[公開拡張のソース](https://github.com/yinyanfr/comic-dl-extensions/blob/main/extensions/zerobyw/src/index.ts)を参照します。

1. **設定を宣言し 2 つの HTTP リーダーを作成。** `site-url/image-url/previous-site-url` はパス・認証・クエリ・フラグメントのない HTTPS オリジンです。`matchesUrl/create(api, settings)` で設定を共有し、旧入力から安定 ID を得て現行サイトの URL に組み直します。`createZerobywSource` で `allowedOrigins` を制限した `readHtml/readImage` を作ります。`COMIC_DL_ZEROBYW_COOKIE` は `COMIC_DL_ZEROBYW_COOKIE_ORIGIN` で紐付け、未設定なら既定サイトのみです。新ホストへ旧 Cookie を自動転送しません。`document()` は作品・閲覧のみ明示認証し、公開検索・画像は匿名です。認証は settings の外に置きます。
2. **完全な一覧を構築。** `getSeries` はログインと作品 ID を検証し、カードをページ順に読みます。閲覧可能カードはリンクから ID、明示 VIP でリンクなしなら `mangaDownloadChapters` から得ます。件数・タイトル・閲覧可能 ID を照合し、隣接チャプターの取り違えを防ぎます。埋め込みデータは `JSON.parse` で解析し、スクリプトを実行しません。
3. **順序付きページを取得。** `readChapter` はパンくずと `localTranslate` で作品・チャプターを検証します。`data-src` を優先し、最終レスポンス URL 基準で相対解決します。画像オリジン・形式・件数を検証します。`data-page-index` があれば重複・欠番・範囲外を検査してソートし、なければ DOM 順です。ID は位置・URL パスなど安定値から作り、変動署名を除きます。再試行で閲覧ページを再取得して期限切れリンクを避けます。
4. **制限と失敗を区別。** サイトが明示的に VIP 専用とする場合のみ `api.RestrictedChapterError` を使います。制限チャプターも list に含め、`getPages()` で通知できます。セッション期限切れ、不明 `403`、欠落ページ、解析エラーは失敗です。HTTP の一時エラーをコアが再試行します。
5. **公開検索を追加。** `search(query, page, signal)` は `/pc/pc/` に `keyword/page` を渡し、リンク・タイトルを読み、作品 ID で重複排除します。`getSeries()` へ直接渡せる URL と `{ results, hasNext }` を返します。空語は閲覧、次ページリンクから `hasNext` を算出します。
6. **メタデータと正規コンテキストを追加。** 詳細情報と公開カード表紙を再利用し、現設定由来の信頼オリジンを検証して `0.3.1` の HTTP 正規化修正もテストします。検証済み作品 ID から現サイトの `seriesInput` を返します。チャプター解析に表紙取得・アーカイブ方針・端末描画を入れないでください。

## 6. パッケージ化前のオフライン回帰テスト

[拡張リポジトリ](https://github.com/yinyanfr/comic-dl-extensions/blob/main/README.en.md)で依存導入後に実行します。

```sh
npm test --workspace @comic-dl/zerobyw
```

[テスト](https://github.com/yinyanfr/comic-dl-extensions/blob/main/extensions/zerobyw/test/zerobyw.test.js)はループバック HTTP でサイト・画像ホストを模擬します。自分の拡張でも、list の安定 ID・順序、作品と直リンクの同一アーカイブ識別・ページ順、オリジン限定 Cookie、制限・期限切れ・解析失敗の区別を検証します。機密を除いたページ差分で遅延画像、リンクのない制限カード、ページ送りを検証してください。

任意メタデータ欠落、目録・認証詳細の表紙、信頼 HTTP 正規化、設定オリジン・ポート、未知ホスト・認証・クエリ・フラグメント拒否、新旧入力、Cookie オリジン不一致、直リンク・範囲の位置 2、パスや Cookie を含まずページ数を持つイベントも対象です。認証詳細も実アカウントなしの fixture で検証できます。

開発中は `--extension` で読み込みます。公開時は[独立したパッケージ化](../develop/#独立したパッケージ化)に従い、ESM と実行時依存を同梱し、[API v1 契約](../../specs/source-extension-v1/)を確認します。認証付き表紙と全体の検証項目は[開発ガイド](../develop/)を参照してください。
