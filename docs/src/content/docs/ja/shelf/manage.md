---
title: 複数ソースの本棚を管理する
description: 異なるソースの作品を登録し、購読とローカル本棚 DB を管理する。
---

本棚は異なるソースの作品を同じローカル DB に保存します。登録と購読は別操作です。保存するだけでも、購読して[新着を確認・ダウンロード](../updates/)することもできます。

以下は Bash / Zsh の例です。[最新 CLI とソース](../../guide/quickstart/)を導入してください。`comic-dl shelf --help` が不明なコマンドなら CLI を更新します。

## 作品を登録

`search` または手元の作品 URL を使います。検索結果の第 1 列の URL を `shelf add` に渡してください。

```sh
comic-dl search '想看白天同学的软弱表情' --source copymanga

series_url='https://www.copy20.com/comic/xiangkanbaitiantongxuederuanruobiaoqing'
comic-dl shelf add "$series_url" --title '想看白天同学的软弱表情'
comic-dl shelf list
```

完全 URL ではソースを自動判定できます。短い ID には `--source copymanga` または設定の既定ソースを使います。`--title` 省略時はソースが返す作品 ID を表示します。保存前にソースで作品を検証します。認証情報のない再利用可能な入力を使い、ログインは拡張機能の指示に従ってください。

同じソースで同じ作品 ID に解決される入力を追加しても、既存項目を返し、タイトル・入力・購読状態を保持します。異なるソースの版は別項目なので、必要な版のみ購読できます。

## 購読・停止・削除

`shelf list` の 4 列は**本棚項目 ID、ソース ID、購読状態、タイトル**です。本棚操作には第 1 列を使います。作品の短い ID や `comic-dl list` のチャプター ID とは別です。

```sh
entry_id='paste-the-first-column-from-shelf-list'
comic-dl shelf follow "$entry_id"
comic-dl shelf list
```

新規項目は `not-following` で自動確認・ダウンロードが無効です。`follow/unfollow` は両方を切り替えますが、無効にしても既存タスクは止まらず、手動確認は常に利用できます。`shelf configure <id> --auto-check on --auto-download off --interval 1800` で個別設定し、`--interval default` で全体間隔に戻します。個別中断は `shelf cancel <id> <chapter-id>`、再登録は `shelf retry` です。[新 API と意味](../../guide/service-api/)を参照してください。

```sh
comic-dl shelf unfollow "$entry_id"
# 本棚から削除する場合のみ実行：
comic-dl shelf remove "$entry_id"
```

削除で購読・タスク記録は消えますが、CBZ は残ります。ソース拡張機能を削除後も、オフラインで一覧・購読・解除・削除ができます。更新確認の前に再インストールしてください。

## URL やチャプターグループの変更

```sh
comic-dl shelf set-input "$entry_id" "$new_series_url"
```

`new_series_url` は新しい作品 URL などソース対応の入力です。元のソースが同じ作品 ID に解決する場合のみ保存します。変更後の正常な確認で新目録の基準を作り、旧目録の保留タスクは無効になります。既存 CBZ は残ります。グループなどは拡張機能の説明を参照してください。

## 本棚 DB の選択

既定は `$XDG_DATA_HOME/comic-dl/shelf.sqlite` です。未設定または絶対パスでなければ `~/.local/share/comic-dl/shelf.sqlite`、Windows は `%LOCALAPPDATA%\comic-dl\shelf.sqlite` です。分離したテストやサービスには、各コマンドで同じ `--shelf-db <file>` を指定します。

```sh
comic-dl shelf list --shelf-db "$HOME/test-shelf.sqlite"
```

DB は CLI 実行マシンのローカルに置いてください。CBZ は NAS マウントへ出力できます。次は[手動確認と自動ダウンロード](../updates/)へ進んでください。
