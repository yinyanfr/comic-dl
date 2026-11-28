---
title: 設定と環境変数
description: CLI の既定値とソース認証の設定。
---

手順は[設定ガイド](../../guide/config-tutorial/)を参照してください。`comic-dl add @comic-dl/copymanga` 後、以下を `copymanga.json` として保存します。

```json
{
  "version": 1,
  "source": "copymanga",
  "output": "./downloads",
  "jobs": 2,
  "retries": 2
}
```

`--config` は明示指定です。CLI、設定、組み込み既定値の順に優先します。`--jobs 1` などはそのコマンドのみ有効です。`--extension` を 1 つでも指定すると設定内の一覧全体を置き換えますが、`add` 済み拡張は読み込みます。設定内の `./`、`../` 始まりのローカル拡張パスと出力パスは設定ファイル基準、CLI のパスは作業ディレクトリ基準です。

項目と検証規則は[設定 v1 仕様](../../specs/config-v1/)を参照してください。

## 実行時ソース設定

`comic-dl sources --source <id> --options` で定義・既定値・選択肢を確認できます。`sourceSettings` にソース ID ごとの上書きを保存します。

```json
{
  "version": 1,
  "sourceSettings": {
    "copymanga": { "site-url": "https://www.copy20.com" }
  }
}
```

`--config <file>` で読み込むか、`--set <id>.<key>=<value>` を繰り返して一時上書きします。優先順は `--set`、設定、拡張が宣言する旧互換環境変数、拡張既定値です。Cookie・パスワード・API キーは拡張機能が管理します。

設定は URL 照合とオンライン本棚操作にも適用されます。変更後は `shelf watch` を再起動してください。

## アーカイブの命名と形式

4 は手動・watcher 用に `"archive": { "template": "{title}/{number}-{chapter}", "padding": 3, "format": "zip" }` を受け取ります。既定はゼロ埋めなしの CBZ。変更で既存アーカイブは自動改名されません。[命名と移行](../../guide/service-api/)を参照してください。

`--archive-template/--archive-padding/--archive-format` は手動・watcher・移行プレビューで設定の各項目を上書きします。NAS ルート・マーカーと進捗は CLI オプションであり、JSON の新項目ではありません。[CLI リファレンス](../cli/)を参照してください。

## 環境変数

`COMIC_DL_EXTENSION_DIR` は[拡張導入ディレクトリ](../cli/#ソースの導入と管理)を変更します。認証変数は各ソースが定義し、例として Zerobyw は `COMIC_DL_ZEROBYW_COOKIE` を使います。認証情報を CLI 設定に入れず、[拡張 README](https://github.com/yinyanfr/comic-dl-extensions/blob/main/README.en.md) の設定・更新手順に従ってください。
