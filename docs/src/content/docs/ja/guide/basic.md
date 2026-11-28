---
title: 基本的な使い方
description: 作品 URL や短い ID でのダウンロード、作品検索、チャプター一覧表示、単一チャプターの取得。
---

以下は Bash / Zsh の例です。[CLI と CopyManga の導入](../quickstart/#ソースの追加)を済ませてください。

## 作品 URL からダウンロード

漫画を保存するディレクトリでターミナルを開き、作品の完全な URL を渡します。

```sh
comic-dl d "https://www.copy20.com/comic/xiangkanbaitiantongxuederuanruobiaoqing"
```

CLI はインストール済みソースと URL を照合し、作品全体を現在のディレクトリにダウンロードします。各チャプターは個別の CBZ になります。`d` は `download` の省略形です。

最新版は既定で作品別のサブディレクトリ `作品名/番号-チャプター名.cbz` を作ります。`-o ~/manga` は出力ルートで、作品名を付け足す必要はありません。番号は選択前の全目録での位置です。テンプレート、ゼロ埋め、ZIP は[設定ファイル](../config-tutorial/)で指定できます。旧ハッシュ名アーカイブも安定した識別情報で認識され、自動では改名されません。

## 短い ID と範囲指定

```sh
comic-dl d xiangkanbaitiantongxuederuanruobiaoqing --source copymanga -o ~/manga -c 2-4
```

短い ID にドメインは含まれないため、`--source copymanga` でソースを指定します。`-o` は出力ディレクトリ、`-c 2-4` は一覧の 2 番目から 4 番目まで（両端を含む）です。一覧を超える範囲はダウンロード前にエラーになります。

## 検索・一覧表示・単一チャプターの取得

```sh
comic-dl search 'Do It Yourself' --source copymanga
```

検索結果の第 1 列の URL でチャプター一覧を取得します。閲覧対応ソースではキーワードを省略すると目録を表示します。次ページの案内が表示されたら `--page 2` などを指定してください。

```sh
series_url='https://www.copy20.com/comic/xiangkanbaitiantongxuederuanruobiaoqing'
comic-dl l "$series_url"
```

`l` は `list` の省略形です。第 1 列がチャプター ID、第 2 列がタイトルです。対応するチャプター URL があれば、次のプレースホルダーを置き換え、`-o` で保存先を指定します。

```sh
comic-dl chapter '<chapter URL>' -o ./downloads
```

ID 指定、範囲の組み合わせ、並列数の変更は[高度な使い方](../advanced/)を参照してください。チャプターグループなどのソース固有設定は [CopyManga 拡張機能の README](https://github.com/yinyanfr/comic-dl-extensions/blob/main/extensions/copymanga/README.en.md) にあります。
