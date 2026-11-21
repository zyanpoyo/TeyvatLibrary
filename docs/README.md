# テイワット文庫 — 設計ドキュメント索引 (`docs/`)

本ディレクトリには、プロダクト仕様・アーキテクチャ・ADR・ロードマップに関する設計ドキュメントをカテゴリー別に格納する。

| カテゴリー | ドキュメント | 概要 |
| :--- | :--- | :--- |
| **ドメイン用語集（ルート直下）** | [GLOSSARY.md](../GLOSSARY.md) | 書架・リーダー・物語・原典/編集/配信層・検証辞書・読書状態・先行ロードマップ概念の公式ドメイン語彙定義（`_Avoid_` 用語含む） |
| **アーキテクチャ (`architecture/`)** | [DATA_ARCHITECTURE.md](architecture/DATA_ARCHITECTURE.md) | 3層データモデル（Raw / Curation / Dist）、1作品＝1 JSONスキーマ、5分類UIカテゴリーと章単位 `sourceRef`、共通マスタ・双方向リンク・コーパス検証仕様 |
| **設計決定記録 (`adr/`)** | [0001](adr/0001-static-site-and-localstorage-persistence.md) / [0002](adr/0002-three-layer-data-and-exact-text-verification.md) / [0003](adr/0003-separate-shelf-category-from-source-type.md) / [0004](adr/0004-client-side-full-text-search-with-lazy-corpus.md) / [0005](adr/0005-google-analytics-and-privacy-opt-out.md) | 完全静的サイト＋`localStorage`完結、3層データ分離＋原文1文字一致検証、書架カテゴリーと原典種別の分離、遅延取得型クライアント横断全文検索、GA4直接計測＋サイト内オプトアウトなどの確定決定（ADR） |
| **運用ガイド (`guides/`)** | [GOOGLE_ANALYTICS_SETUP.md](guides/GOOGLE_ANALYTICS_SETUP.md) | GA4 測定 ID（`VITE_GA_MEASUREMENT_ID`）設定・拡張計測無効化・カスタムディメンション／指標登録・DebugView 検証手順書 |
| **継続利用改善 (`handoff/`)** | [RETENTION_ROADMAP.md](handoff/RETENTION_ROADMAP.md) | リテンション改善ロードマップ索引：読了・しおり（Phase 1-2 実装済）、フェア棚＆読書コース（Phase 3）、人物・用語名鑑＆作品拡充（Phase 4-5）、DB導入構想・Won't（Phase 6） |
| **ロードマップ (`roadmap/`)** | [ROADMAP.md](roadmap/ROADMAP.md) | 機能追加計画（時代フィルタ・フェア棚／読書コース・自動注釈パイプライン・GA）および優先収録作品ラインナップ |
| **履歴引き継ぎ資料 (`handoff/`)** | [HANDOFF.md](handoff/HANDOFF.md) | 初期単一HTMLプロトタイプ期からの本番化引き継ぎ記録（移行完了済みの歴史的資料） |
| **将来構想・参考仕様 (`spec/`)** | [TeyvatLibrary_seo_and_share_spec.md](spec/TeyvatLibrary_seo_and_share_spec.md) | SSG＋Cloudflare Pages Functions による SEO・動的 OGP 引用シェア構想（※現行 [ADR-0001](adr/0001-static-site-and-localstorage-persistence.md) の完全静的・HashRouter 構成とは独立した将来検討案） |
| **プロモーション構想 (`promotion/`)** | [promotion_strategy.md](promotion/promotion_strategy.md) | 検索導線・SNS共有・記事連携に関するマーケティング参考メモ |
