---
title: ライブラリー API を使う
description: 公開 API でダウンロード、進捗、表紙、本棚の自動化を実装します。
---

## Skill の読み込み

```sh
npx skills add yinyanfr/comic-dl --skill comic-dl-library
```

[SKILL.md を読む](https://github.com/yinyanfr/comic-dl/blob/main/skills/comic-dl-library/SKILL.md) · [導入手順](../)

Node.js 24 ESM のスクリプトや常駐バックエンド向けです。ブラウザーからコア、拡張、SQLite を直接読み込みません。

## 手順

1. 導入版の公開型を読み、`createDownloader().use()` で信頼する配信元を明示登録します。
2. 章一覧を取得して `download()`／`downloadChapter()` を実行し、章別の結果を確認します。Promise の完了は全章成功とは限りません。
3. 進捗には `onEvent` と安全なスナップショット、取消／再試行には `startDownload()` を使います。
4. 公開本棚 API で独立した自動化設定を管理し、停止時は watcher を abort して終了を待ってから本棚を閉じます。
5. `fixtureExtension` を明示登録して取得を検証し、検索には契約に対応したテスト配信元を使います。

## 依頼例

> comic-dl-library を使い、Node.js 24 バックエンドに取得と取消を追加してください。公開 API のみを使用し、フロントエンドには安全なスナップショットを渡します。部分失敗、総ページ数不明、正常終了のオフラインテストを追加してください。

## 安全性と検証

- `createDownloader()` は CLI の設定や管理対象拡張を自動で読みません。
- CLI テキストの解析、非公開 `dist/` の import、SQLite の直接変更はしません。
- 生の結果に含まれるローカルパスや診断をブラウザーへ送らず、認証付き表紙エンドポイントを保護します。
- 手動タスクは再起動で失われます。watcher キューは永続化しますが、リアルタイムページ数は保存しません。
- 取消、再試行、出力保護、後処理を検証し、未実施の実配信元／NAS 検証は別に報告します。

[ライブラリーガイド](../../guide/library/)、[サービス API](../../guide/service-api/)、[API リファレンス](../../reference/library-api/)を参照してください。
