---
status: accepted
---

# 0001: 完全静的サイト構成と localStorage による状態永続化

「テイワット文庫」はバックエンドサーバーおよびデータベースを持たず、ビルド済みの静的アセット配信とブラウザの `localStorage` のみで読書状態（`readStories`・`bookmarks`・`lastSession`）および表示設定（`DisplayPrefs`）を保持する。

## Considered Options

- **完全静的サイト ＋ `localStorage`（採用）**: ホスティング維持費ゼロ、認証や個人情報の保持・管理リスクゼロ、オフライン近い軽快な応答を確保できる。
- **軽量バックエンド DB（例: Cloudflare D1）の導入**: 端末間同期や集計リアクションは実現できるが、サーバー状態管理と悪用対策の運用コストが増えるため、現フェーズでは Won't 事項（`docs/handoff/retention/phase6_dynamic_db_wont.md`）として明示的に凍結している。

## Consequences

- アーキテクチャ見直しや新機能設計において、ユーザーからの明示指示なしにサーバー API・認証・DB 導入を前提とした提案を行わない。
- 別タブ間同期は `storage` イベントを用いてクライアント内で完結させる。
