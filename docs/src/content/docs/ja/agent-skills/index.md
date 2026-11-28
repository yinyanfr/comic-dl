---
title: Skills の導入と利用
description: CLI、ライブラリー、WebUI 配置、拡張機能、コア開発用の agent skills。
---

Skills は AI agent 向けの作業手順です。新しい CLI コマンド、配信元拡張、自動デプロイスクリプトではありません。適用場面、手順、安全上の制約、検証条件を定義します。実際の操作にはユーザーの許可が必要で、プロジェクトの `AGENTS.md` にも従います。

## Skill を選ぶ

| Skill                                   | 作業                                                   |
| --------------------------------------- | ------------------------------------------------------ |
| [comic-dl-cli](./cli/)                  | 検索、章一覧、ダウンロード、本棚、自動更新、CLI の調査 |
| [comic-dl-library](./library/)          | Node.js スクリプト／サーバーで公開 API を使用          |
| [comic-dl-webui-deploy](./webui/)       | Docker／NAS、HTTPS、バックアップ、更新                 |
| [comic-dl-extension-dev](./extensions/) | 独立した配信元アダプターの開発とテスト                 |
| [comic-dl-core-dev](./core/)            | コア、CLI、タスク、本棚、アーカイブ出力の変更          |

複数の層にまたがる作業では組み合わせられます。ただし、配信元の処理をスケジューラーへ移したり、ブラウザーから SQLite を直接操作したりしません。

## インストール

Node.js 24 を使用します。agent を使うプロジェクトで [Skills CLI](https://github.com/vercel-labs/skills)から一覧を確認して導入します。

```sh
npx skills add yinyanfr/comic-dl --list
npx skills add yinyanfr/comic-dl --skill comic-dl-cli
```

案内に従って agent を選択します。agent 内では自動検出される場合もあります。既定はプロジェクト単位、`-g` はユーザー全体です。内容を確認し、許可なく全体やすべての agent へ導入しないでください。読み込み方法は agent の仕様に従い、共通のスラッシュコマンドがあるとは仮定しません。

ローカルの comic-dl ソース（未 push の変更を含む）から導入する場合：

```sh
npx skills add . --list
npx skills add . --skill comic-dl-cli
```

インストーラーを使わない場合、必要な `skills/<name>/` を agent が対応するスキルディレクトリへコピーし、`SKILL.md` を保持します。正確な場所は agent によります。正式な指示本文は英語で、サイトの説明は中国語・英語・日本語です。言語別に三重インストールする必要はありません。

## 作業情報を渡す

目的、バージョン、環境、入出力の範囲、既存設定、許可する変更、検証条件を指定します。

> comic-dl-cli を使い、バージョンと配信元を確認して、渡した作品の章一覧を表示してください。確認した章だけを指定先へ保存し、自動追跡、認証情報の変更、既存アーカイブの移行は行わないでください。

秘密情報は保護したローカル設定や環境で渡し、公開チャット、Issue、画像に Cookie、パスワード、API Key を載せないでください。Skill の導入は、取得、デプロイ、移行、公開、削除の許可ではありません。

## バージョンと保守

Node.js 24、コア 4.1 以降、拡張 API v1 を対象とします。WebUI 配置の起点は公開済み 0.1.0 で、実行前に対象リリースの文書を確認します。利用できる機能は導入版の `--help` と公開型に従います。

指示本文の管理元は [`skills/`](https://github.com/yinyanfr/comic-dl/tree/main/skills) です。再現性のために Git ref を固定できますが、スキルを含む実在の tag／commit を使ってください。古い npm 版や Git tag に含まれるとは限りません。

```sh
npx skills check
```

差分を確認してから更新します。本文、三言語の説明、API 文書を同期し、オフラインテストを実配信元や NAS の検証の代わりにしないでください。
