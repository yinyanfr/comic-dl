---
title: WebUI をデプロイする
description: Docker、NAS、HTTPS、バックアップ、更新を安全に計画して検証します。
---

## Skill の読み込み

```sh
npx skills add yinyanfr/comic-dl --skill comic-dl-webui-deploy
```

[SKILL.md を読む](https://github.com/yinyanfr/comic-dl/blob/main/skills/comic-dl-webui-deploy/SKILL.md) · [導入手順](../)

単一ユーザー・単一インスタンスの運用向けです。WebUI のソース変更や、サーバー操作の自動許可は含みません。

## 手順

1. アーキテクチャ、Docker Compose、UID/GID、既存パス、接続範囲、バックアップ先を確認します。
2. 対象版の完全な Compose を読み、イメージ tag／digest を固定します。文書の起点は 0.1.0 です。
3. 非 root、読み取り専用ルート、権限制限、実パス確認、停止猶予を保ち、秘密情報は安全に設定します。
4. 許可後に起動し、正確な Origin、HTTPS、SSE を設定してログイン、タスク、実アーカイブを検証します。
5. 更新前に全書き込みを停止してデータと漫画識別情報をバックアップし、ロールバック時は schema と対応バックアップを確認します。

## 依頼例

> comic-dl-webui-deploy を使って NAS 構成を確認し、承認事項付きの配置計画を作成してください。サーバーは変更せず、SQLite はローカル、漫画の権限は維持、VPN と HTTPS を使用します。バックアップとロールバック手順も示してください。

## 安全性と検証

- 既定はループバックのみで、直接の公開インターネット露出を避けます。`/comics/` 等のサブパスは非対応です。
- パスワードを空にせず、展開済み Compose の秘密情報を公開しません。Docker socket、root 化、`chmod 777` で問題を隠しません。
- マーカーを自動生成せず、SQLite を別マシンの SMB/NFS に置きません。
- `healthy` は HTTP 応答のみです。永続化、実ダウンロード、マウント復旧、SSE、停止処理も検証します。
- PWA は信頼済み HTTPS が必要です（localhost を除く）。オフライン閲覧はありません。

完全な設定は [WebUI デプロイ](../../webui/deployment/)、操作は[使い方](../../webui/usage/)を参照してください。
