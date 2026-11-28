---
title: 設定ファイルを使う
description: ソース、出力先、再試行設定を保存し、コマンドごとに上書きする方法。
---

JSON に設定を保存し、`--config` で再利用できます。[CopyManga の導入](../quickstart/#ソースの追加)を済ませてください。

## 既定値を保存

`./profiles/copymanga.json` を作成します。

```json
{
  "version": 1,
  "source": "copymanga",
  "output": "./manga",
  "jobs": 2,
  "retries": 2
}
```

`version` は数値の `1`、`source` は `comic-dl sources` に表示される ID です。`jobs` はチャプター並列数、`retries` は一時的エラー後の追加試行回数です。`add` 済みの拡張機能は自動で読み込むため、ここへの記載は不要です。

## 設定を読み込む

`profiles/` の親ディレクトリで実行します。

```sh
comic-dl l xiangkanbaitiantongxuederuanruobiaoqing --config ./profiles/copymanga.json
comic-dl d xiangkanbaitiantongxuederuanruobiaoqing --config ./profiles/copymanga.json -c 2-4
```

設定ファイルは自動検出されません。毎回 `--config` を渡してください。JSON 内の相対出力パスは**設定ファイルのあるディレクトリ**を基準にするため、この例では `./profiles/manga/` に保存します。CLI にも設定にも出力先がなければ現在の作業ディレクトリを使います。

`"~/manga"` はホームディレクトリを基準にします。

## コマンド単位で上書き

```sh
comic-dl d xiangkanbaitiantongxuederuanruobiaoqing --config ./profiles/copymanga.json -c 2-4 -o ./preview --jobs 1
```

CLI オプションが優先され、設定ファイル自体は変更しません。CLI の相対パスは**現在の作業ディレクトリ**が基準なので、保存先は `./profiles/preview/` ではなく `./preview/` です。`--source` でも既定ソースを変更できます。

ソースや保存先ごとに別の設定ファイルを用意できます。Cookie や API キーは[拡張機能の README](https://github.com/yinyanfr/comic-dl-extensions/blob/main/README.en.md)に従って設定してください。全項目は[設定と環境変数](../../reference/config/)を参照してください。

## 読みやすいファイル名と ZIP

`naming.json` として保存します。

```json
{
  "version": 1,
  "source": "copymanga",
  "output": "~/manga",
  "archive": {
    "template": "{title}/{number}-{chapter}",
    "padding": 3,
    "format": "zip"
  }
}
```

```sh
comic-dl d xiangkanbaitiantongxuederuanruobiaoqing --config naming.json -c 2-4
```

出力例は `~/manga/作品名/002-チャプター名.zip` です。番号は全目録での位置を維持します。`archive` を省略すると既定テンプレート、ゼロ埋めなし、CBZ になります。同じ設定を `shelf watch` でも使えます。設定変更で完成済みファイルは改名されません。[サーバー移行 API](../service-api/)でプレビューして明示的に適用してください。制約は[設定仕様](../../specs/config-v1/)を参照してください。
