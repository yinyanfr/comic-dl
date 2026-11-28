---
title: CLI を使う
description: agent に安全な検索、章一覧、取得、本棚管理と調査を行わせます。
---

## Skill の読み込み

```sh
npx skills add yinyanfr/comic-dl --skill comic-dl-cli
```

[SKILL.md を読む](https://github.com/yinyanfr/comic-dl/blob/main/skills/comic-dl-cli/SKILL.md) · [導入手順](../)

シェル操作や CLI の調査向けです。サーバー連携には[ライブラリー用](../library/)を使います。

## 手順

1. Node.js 24、`comic-dl --version`、サブコマンドのヘルプ、配信元、出力先を確認します。
2. 許可された信頼できる拡張だけを導入し、npm パッケージ名と配信元 ID を区別します。
3. `search --json`、`list --details` で作品と全体の章順を確認してから章を選びます。
4. 自動処理では JSON、進捗は stderr、ログには `--progress plain` を使います。終了コードだけでなく各章の結果を確認します。
5. 自動化変更前に DB と既存 watcher を確認し、拡張更新は `update --check` から始めます。

## 依頼例

> comic-dl-cli を使って配信元とリンク先の章一覧を確認し、承認後に第 2～4 項だけを `./downloads` へ保存してください。既存ファイルを残し、追加の配信元導入や自動追跡はせず、章別の結果を報告してください。

## 安全性と検証

- 初回確認は通常、基準作成のみです。過去章の取得や常駐 watcher は明示的に指定します。
- 同一本棚の watcher は一つだけです。`shelf tasks` は別プロセスのリアルタイムページ数ではありません。
- NAS 保護を回避するためにマーカーや空ディレクトリを作りません。
- 移行はバックアップ、書き込み停止、プレビュー確認、承認後に同じ計画を適用し、競合を上書きしません。
- 実サイトを使えない場合は `hello-extension.mjs` で検証し、実サイト検証済みとは報告しません。

[CLI リファレンス](../../reference/cli/)、[本棚](../../shelf/manage/)、[自動更新](../../shelf/updates/)も参照してください。
