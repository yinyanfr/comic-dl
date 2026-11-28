---
title: 2.x から 3.x への移行
description: 2.4.0 のコマンド、スクリプト、プリセット、認証を移行し、既存データを維持する。
---

3.x は TypeScript による新規実装です。本ガイドは `2.4.0` を比較元とします。元のスクリプトと保存データを残し、まず新しい出力先で 1 作品を試してください。旧動作依存のスクリプトは `comic-dl@2.4.0` に固定できます。

## 新 CLI とソースの導入

最新版を導入し、バージョンを確認します。

```sh
npm install -g comic-dl@latest
comic-dl --version
comic-dl add @comic-dl/copymanga
comic-dl sources
```

Node.js 24 が必要です。2.x に同梱された CopyManga/Zerobyw は、3.x では `@comic-dl/copymanga` と `@comic-dl/zerobyw` です。一度導入すれば自動で読み込みます。旧 Ganma モジュールは同梱されません。利用可能なソース・URL・ログイン要件は[拡張リポジトリ](https://github.com/yinyanfr/comic-dl-extensions/blob/main/README.en.md)を参照してください。

`npx comic-dl` を使うスクリプトはバージョンを明示固定してください。作品保存と新着購読は[本棚ガイド](../../shelf/manage/)を参照してください。

## コマンドとチャプター選択の更新

現在の作品・チャプター URL を確認してください。以下の `$series_url/$chapter_url` は確認済み URL です。

| 旧コマンド・オプション                                       | 新しい指定                                                                                     |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `comic-dl ls -u "$series_url"`                               | `comic-dl list "$series_url"` または `l`                                                       |
| `comic-dl -u "$series_url"` / `comic-dl dl -u "$series_url"` | `comic-dl download "$series_url"` または `d`。サブコマンド必須、URL は位置引数                 |
| `comic-dl ch -u "$chapter_url"`                              | `comic-dl chapter "$chapter_url" -o ./new-downloads`。単一チャプターは保存先必須（設定でも可） |
| `comic-dl dl --module copymanga --shorthand-url "$short_id"` | 新拡張が ID に対応すれば `comic-dl download "$short_id" --source copymanga`                    |
| CopyManga の `--group tankobon`                              | 対応グループなら作品 URL に `?group=tankobon` を追加。他ソースは各説明を参照                   |

旧 `--chapters 0,4` は 0 始まりの位置指定、`--from 0 --to 4` も 0 始まり・両端を含みます。新 `-c` は安定した ID を優先するため、`-c 0 -c 4` は旧位置と同じ意味ではありません。両版で同じ一覧・順序なら、旧 `--from 0 --to 4` は `-c 1-5` に相当しますが、`1-5` が ID として存在すればその ID が優先です。

一覧を取り直し、第 1 列の ID を使います。`101/105` は実際の値に置き換えてください。

```sh
comic-dl list "$series_url"
comic-dl download "$series_url" -c 101 -c 105 -o ./new-downloads
```

`-c` 省略は全作品です。確認プロンプトはなく `--yes` は不要です。`list` は `チャプター ID<TAB>タイトル` を出力し、旧 URL 形式や `ComicInfo.xml` 出力はありません。解析スクリプトを更新し、[新しい終了コード](../../reference/cli/#スクリプト向け出力と終了コード)を確認してください。

## プリセットと認証の移行

旧版は `--presets` や `~/.comic-dl/presets.json` の共通・サイト設定を統合できましたが、新版は検出も統合もしません。必要な値をソースごとの JSON に移してください。`comic-dl add @comic-dl/zerobyw` 後、`./profiles/zerobyw.json` を作ります。

```json
{
  "version": 1,
  "source": "zerobyw",
  "output": "./new-downloads",
  "jobs": 2,
  "retries": 2
}
```

コアは `--cookie`、`~/.comic-dl/cookies/`、`--auth` を読みません。旧 Zerobyw Cookie が有効なら環境変数で拡張機能へ渡せます。他ソースは各 README を参照してください。

```sh
export COMIC_DL_ZEROBYW_COOKIE="$(cat ./cookie.txt)"
comic-dl list "$zerobyw_url" --config ./profiles/zerobyw.json
comic-dl download "$zerobyw_url" --config ./profiles/zerobyw.json -c 101
```

実際の URL と新一覧の ID を使ってください。認証情報を JSON に入れず、期限切れなら [Zerobyw README](https://github.com/yinyanfr/comic-dl-extensions/blob/main/extensions/zerobyw/README.en.md) に従って更新します。設定内パスは設定ファイル基準なので `./profiles/new-downloads/` に保存されます。CLI の `-o` は作業ディレクトリ基準で優先されます。

`"~/Downloads/manga"` などは引き続きホーム基準です。

旧 `batch` は画像並列数、新 `jobs` はチャプター並列数で同義ではありません。旧 `retry` は画像失敗のあるチャプターを再試行し、新 `retries` は一時的エラー後の追加試行回数です。`0` で無効です。[設定ガイド](../../guide/config-tutorial/)を参照してください。

## 既存データと廃止オプション

本ページは歴史的な 2.4.0 → 3.x 比較です。`comic-dl@latest` は最新版を導入するため、3.x の平坦な出力構造・購読動作は過去のものです。現在の命名・ZIP・独立自動化は [3.x → 4.x](../v3-to-v4/)へ進んでください。

画像フォルダー・ZIP・CBZ は既存リーダーで維持できます。3.x CLI は各チャプターを識別情報に基づく名前の CBZ にし、再実行時に識別・ページ順マーカー・整合性を検査します。名前一致だけで旧 CBZ を完成扱いしません。新しい保存先を使い、作品別に分けてください。Calibre など名前で取り込むリーダーにはアーカイブ名が表示されるため、タイトル・シリーズ情報をリーダー側で追加します。

- `--archive/--zip-level/--format/--info/list -o` は廃止です。3.x には改名・番号付き名前・旧 `--kavita` 命名の代替はありません。新 Kavita 拡張はライブラリソースです。
- `--override` はありません。再実行で検査を通ったアーカイブをスキップします。
- `--list` の URL ファイルと `--history` の組み込み代替はありません。旧一覧の URL を確認し、外部スクリプトから URL ごとに新 CLI を呼び出してください。
- 旧ライブラリクラスや `generate` テンプレートコマンドの互換入口はありません。[ライブラリ](../../guide/library/)と[拡張開発](../../extensions/develop/)を参照してください。
