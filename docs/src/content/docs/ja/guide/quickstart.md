---
title: インストールとソースの追加
description: comic-dl CLI の導入とソース拡張機能の追加・更新・削除。
---

## comic-dl のインストール

Node.js 24（npm を含む）を導入し、最新の CLI をインストールします。

```sh
node --version
npm install -g comic-dl@latest
comic-dl --version
```

コアパッケージにオンライン漫画ソースは含まれません。利用するサイトやセルフホスト型ライブラリに対応する拡張機能を追加してください。

すでに CLI を導入している場合も、上のインストールコマンドで最新に更新できます。インストール済みの拡張機能は引き続き使えます。本棚と自動更新は[本棚ガイド](../../shelf/manage/)を参照してください。

## ソースの追加

[comic-dl-extensions](https://github.com/yinyanfr/comic-dl-extensions/blob/main/README.en.md) の保守対象拡張機能、または互換性のある第三者製拡張機能を利用できます。拡張機能の README で npm パッケージ名を確認して実行します。

```sh
comic-dl add @comic-dl/copymanga
comic-dl sources
```

`add` でインストールした拡張機能は自動で読み込まれます。`sources` に表示される `copymanga` は `--source` に指定するソース ID です。`add`、`update`、`remove` には npm パッケージ名 `@comic-dl/copymanga` を渡します。`fixture` は[ローカル開発テスト](../../development/local-testing/)用です。

## 認証の設定

ソースによって追加設定が必要です。[Zerobyw](https://github.com/yinyanfr/comic-dl-extensions/blob/main/extensions/zerobyw/README.en.md) にはチャプター一覧取得・ダウンロード用のセッション Cookie、[Komga](https://github.com/yinyanfr/comic-dl-extensions/blob/main/extensions/komga/README.en.md) と [Kavita](https://github.com/yinyanfr/comic-dl-extensions/blob/main/extensions/kavita/README.en.md) にはサーバー URL とキーが必要です。CopyManga は匿名で使えるため、[基本的な使い方](../basic/)へ進めます。

## ソースの更新・削除

```sh
comic-dl update @comic-dl/copymanga
comic-dl update
comic-dl remove @comic-dl/copymanga
```

`update` にパッケージ名を渡すと単一の拡張機能、省略するとすべてを更新します。更新は保存済みの npm バージョン範囲内で行われます。範囲外へ変更するには、目的のバージョンで `comic-dl add 'package@version'` を再実行します。拡張機能を削除してもダウンロード済み CBZ は残ります。
