---
title: 配信元拡張を開発する
description: API v1 に従い、安全な認証、オフラインテスト、配布物を作成します。
---

## Skill の読み込み

```sh
npx skills add yinyanfr/comic-dl --skill comic-dl-extension-dev
```

[SKILL.md を読む](https://github.com/yinyanfr/comic-dl/blob/main/skills/comic-dl-extension-dev/SKILL.md) · [導入手順](../)

独立した配信元パッケージ向けです。付属拡張は [comic-dl-extensions](https://github.com/yinyanfr/comic-dl-extensions) にあり、サイト解析をコアへ追加しません。

## 手順

1. API v1 と対象リポジトリの指示を読み、安定した作品／章 ID、全体の読み順、脱敏サンプルを確認します。
2. オフライン hello から始め、`SourceExtension` を default export し、型は `comic-dl/extension` を使用します。
3. 入力照合、設定検証、認証、順序付き遅延ページを実装し、必要に応じてメタデータ、検索、表紙を追加します。
4. fixture とループバック HTTP で転送、認証境界、取消、制限、選章、直リンクを検証します。
5. コンパイル済み ESM を梱包し、一時的な利用プロジェクトで CLI とライブラリーから読み込みます。

## 依頼例

> comic-dl-extension-dev を使い、提供した脱敏 HTML／JSON からアダプターを作成してください。API v1 を維持してオフラインテストから始め、実サイトへの接続や npm 公開はせず、オンライン検証が必要な機能を列挙してください。

## 安全性と検証

- 配信元はサイト処理、コアは制御・再試行・アーカイブ・イベント、UI は表示を担当します。
- Cookie/key を公開設定、検索結果、表紙 URL、サンプルへ含めず、origin を跨いで再付与しません。
- メタデータ欠如で取得を失敗させず、検索結果ごとの追加詳細リクエストを避けます。
- 直リンクの章番号を捏造せず、安定した識別情報とページ順を検証します。
- 管理対象の導入ではライフサイクルスクリプトを実行しないため、コンパイル済み入口を含めます。公開には別途許可が必要です。

[拡張開発](../../extensions/develop/)、[API v1](../../specs/source-extension-v1/)、[Zerobyw 教材](../../extensions/zerobyw-walkthrough/)を参照してください。
