---
title: コアを開発する
description: 設計境界、出力の安全性、オフライン回帰テストを保ってコアを変更します。
---

## Skill の読み込み

```sh
npx skills add yinyanfr/comic-dl --skill comic-dl-core-dev
```

[SKILL.md を読む](https://github.com/yinyanfr/comic-dl/blob/main/skills/comic-dl-core-dev/SKILL.md) · [導入手順](../)

コア、CLI、タスク、本棚、出力層向けです。旧ダウンローダーの移行ではなく、TypeScript による新規実装です。

## 手順

1. `AGENTS.md` と作業ツリーを確認し、ユーザーの変更を保持して `.node-version` の Node.js 24 を使います。
2. 担当モジュールを特定し、オフライン再現と回帰テストを先に追加して最小変更を行います。
3. ネイティブ ESM／NodeNext、相対 import の `.js` を守り、生成物 `dist/` は直接編集しません。
4. 公開結果、取消、再試行、永続性、パス保護、移行の上書き禁止を検証します。
5. 全チェックを実行し、公開動作の変更時は三言語文書、仕様、skills も更新します。

```sh
npm ci
npm run check
npm test
npm run build
node dist/index.js
```

## 依頼例

> comic-dl-core-dev を使い、説明した取消の不具合を修正してください。先にオフラインの失敗テストを追加し、CLI stdout と終了コードを維持します。実本棚や漫画ディレクトリには触れず、commit／push はしないでください。

## 安全性と検証

- サイト照合・認証・解析は拡張、WebUI は独立リポジトリに保ちます。
- 識別情報／完全性検証、原子的確定、NAS 保護、移行競合確認を維持します。
- DB 変更は移行／ロールバックテストを伴い、schema や拡張 API 版を安易に変更しません。
- Husky は全チェックの代わりではありません。ローカルテストを Windows、実配信元、NAS の検証とは報告しません。
- 公開、配置、実アーカイブ移行、ユーザー変更の破棄は既定の許可に含みません。

[開発参加](../../development/contributing/)、[ローカルテスト](../../development/local-testing/)、[サービス API](../../guide/service-api/)を参照してください。
