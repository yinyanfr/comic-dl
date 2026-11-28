---
title: 開発への参加
description: ローカル開発、テスト、責務の分離、ドキュメントサイトの保守。
---

## 環境とチェック

Node.js 24 を使います。コアはネイティブ ESM と TypeScript `NodeNext` を採用し、相対 import には実行時の `.js` 拡張子を付けます。

```sh
npm ci
npm run check
npm test
node dist/index.js --help
```

`npm run check` は書式・型・lint、`npm test` はビルドとオフライン回帰テストを実行します。手動で一覧・CBZ を確認する手順は[ローカルテスト](../local-testing/)を参照してください。拡張機能とそのテストは [comic-dl-extensions](https://github.com/yinyanfr/comic-dl-extensions/blob/main/README.en.md) にあり、実サイトの認証情報を使わずローカルのモックサーバーと fixture で検証します。Husky はステージ済みファイルのみ対象なので、コミット前には完全なチェックを実行してください。

## コードの責務

| パス                                       | 責務                                           |
| ------------------------------------------ | ---------------------------------------------- |
| `src/index.ts`, `src/config.ts`            | CLI、設定、表示、終了コード                    |
| `src/library.ts`, `src/extension-store.ts` | ライブラリ入口、CLI 拡張機能管理               |
| `src/extension.ts`, `src/sources/`         | 公開拡張 API、ソース読み込み、HTTP、fixture    |
| `src/download.ts`                          | ダウンロード調整、並列処理、再試行、中断、結果 |
| `src/output/`                              | 安全な出力パス、CBZ 書き込み、整合性検査       |
| `test/`                                    | CLI・ダウンロード・出力の回帰テスト            |

サイト判定・認証・解析は拡張機能に置きます。ダウンロードサービスはチャプターと順序付きページを受け取り、サイト URL を解釈しません。出力層は一時ファイルを作り、完成した CBZ を移動します。既存ファイルをスキップする前に識別マーカー・ページ順・CRC を確認します。ファイル名とマーカー形式は実装詳細です。

## ドキュメントサイトの保守

簡体字中国語は `docs/src/content/docs/`、英語は `docs/src/content/docs/en/`、日本語は `docs/src/content/docs/ja/` に置きます。各言語で同じ相対ファイル名を使うと、言語メニューで対応ページへ切り替えられます。インターフェース変更時は 3 言語のガイド・リファレンス・仕様を更新してください。

CLI とサイトの依存関係は別です。

```sh
npm ci --prefix docs
npm run dev --prefix docs
npm run build --prefix docs
npm run preview --prefix docs
```

[GitHub Pages](https://yinyanfr.github.io/comic-dl/ja/) と同じベースパスの `/comic-dl/`、`/comic-dl/en/`、`/comic-dl/ja/` で確認します。ドキュメント PR はサイトをビルドし、`main` への push でデプロイします。リポジトリの **Settings → Pages → Source** は **GitHub Actions** にします。

## npm への公開

`npm version <version> --no-git-tag-version` で更新し、`package.json` と `package-lock.json` をコミットします。[公開ワークフロー](https://github.com/yinyanfr/comic-dl/actions/workflows/publish-npm.yml)は `main` への push 前後のバージョンを比較し、変更時のみチェック・テスト・パッケージ化を行います。npm のプレリリースは `next`、安定版は `latest` です。npm 公開成功または既存バージョン確認後、生成ノート付き GitHub Release とバージョンタグを push コミットに作成します。プレリリースはその旨を設定し、既存リリースはスキップします。

ワークフローが `main` に入ったら、npm の `comic-dl` パッケージ設定で [GitHub Actions trusted publisher](https://docs.npmjs.com/trusted-publishers/) を設定します。owner は `yinyanfr`、repository は `comic-dl`、workflow filename は `publish-npm.yml`、environment は空欄、直接公開（`npm publish`）を許可します。npm トークンは不要です。次の公開前に設定してください。新しい trusted publisher は 2 日以内に初回の公開を成功させる必要があります。
