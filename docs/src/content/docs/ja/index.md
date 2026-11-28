---
title: comic-dl ドキュメント
description: 漫画ダウンローダーの導入、ソース拡張機能の開発、プロジェクトへの参加。
template: splash
hero:
  image:
    file: ../../../../../assets/project-icon.png
    alt: 収納ボックスに入った漫画
  tagline: ソースを追加し、CLI や TypeScript ライブラリで漫画をダウンロード。各チャプターを個別の CBZ として保存できます。
  actions:
    - text: インストールとソースの追加
      link: ./guide/quickstart/
      icon: right-arrow
      variant: primary
    - text: 拡張機能の開発
      link: ./extensions/develop/
    - text: 開発に参加
      link: ./development/contributing/
---

- [基本的な使い方](./guide/basic/)：作品 URL からのダウンロード、検索、チャプター一覧の表示。
- [高度な使い方](./guide/advanced/)と[設定ファイル](./guide/config-tutorial/)：チャプター選択、並列数の調整、設定の再利用。
- [本棚と自動更新](./shelf/manage/)：複数ソースの作品の登録、購読管理、新着のダウンロード。
- [ライブラリとして使う](./guide/library/)：Node.js プロジェクトで拡張機能を登録してダウンロード。
- [Web バックエンドとタスク](./guide/service-api/)と[公開 API リファレンス](./reference/library-api/)：安全な進捗、独立した自動化、表紙、アーカイブ移行、拡張機能の更新プレビュー。
- [3.x から 4.x への移行](./migration/v3-to-v4/)：本棚 DB をバックアップ・更新し、既存アーカイブを維持。
- [2.x から 3.x への移行](./migration/v2-to-v3/)：旧スクリプトや設定を更新し、ダウンロード済みの漫画を維持。
- [CLI リファレンス](./reference/cli/)：コマンド、オプション、終了コード。
