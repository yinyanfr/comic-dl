---
title: ローカルテスト
description: ローカル fixture でチャプター一覧、CBZ 生成、アーカイブ整合性を検証する。
---

`fixture` は組み込みテストソースです。用意したローカル画像と JSON を読み、漫画サイトへ接続しません。ネットワークなしで CLI・ページ順・CBZ 出力を検証できます。リポジトリルートで実行します。

```sh
npm ci
npm test
node dist/index.js sources
```

`npm test` はビルドと回帰テストを実行します。`sources` に `fixture` が表示されます。以下はテストの一部を手動で再現する手順です。

## 単一チャプターの検証

`./demo` に画像 `cover.png`、`page-2.jpg` と `chapter.json` を用意します。`workId/chapterId` は安定した識別子、`pages` は同じディレクトリのファイル名を読み順に並べた配列です。

```json
{
  "workId": "demo",
  "chapterId": "1",
  "pages": ["cover.png", "page-2.jpg"]
}
```

```sh
node dist/index.js chapter --fixture ./demo -o ./downloads
```

出力は `./downloads/demo/1-1.cbz` です。この旧単一チャプター fixture には正規位置がないため、ID を名前の代替値に使います。`unzip -l ./downloads/demo/1-1.cbz` で内容、`unzip -t ./downloads/demo/1-1.cbz` で整合性を確認します。再実行は `Skipped` になるはずです。画像を一時的に移動し、空の出力先で実行すると、部分 CBZ を残さず失敗します。画像を戻して再試行してください。

## 一覧とチャプター選択の検証

画像ディレクトリに `series.json` と指定する 3 枚の画像を置きます。`workId` は作品、各 `id` は作品内で一意です。`chapters/pages` は読み順で、ファイル名にディレクトリ部分を含めないでください。

```json
{
  "workId": "demo",
  "chapters": [
    {
      "id": "1",
      "title": "Chapter one",
      "pages": ["01-cover.png", "01-page-2.jpg"]
    },
    { "id": "2", "title": "Chapter two", "pages": ["02-cover.png"] }
  ]
}
```

```sh
node dist/index.js list --fixture ./demo
node dist/index.js chapter --fixture ./demo -c 2 -o ./series-output
node dist/index.js download --fixture ./demo -o ./series-output
```

`list` は記載順に `1/2` を表示します。2 つ目のコマンドは `2` のみ、最後は `1` を作成して完成済み `2` をスキップします。`--fixture` は位置引数の代わりとなり、明示的 `--source` と併用できません。[CLI リファレンス](../../reference/cli/)にオプションと終了コードがあります。

4.x のオフラインテストは、本棚 v1/v2 移行、独立した自動化、ページ進捗、中断直後の再試行、NAS マーカー・サブディレクトリ回復、ハードリンク非対応環境、移行競合、読み取り専用拡張一覧、npm 範囲・タグも検証します。サーバー統合テストでは `fixtureExtension` を明示登録します。検索機能はないため、検索・フィルターには公開契約を実装するテストソースを用意してください。コア CI は実サイトに依存しません。
