# テイワット文庫 — 設計ドキュメント索引 (`docs/`)

本ディレクトリには、プロダクト仕様・引き継ぎ指針・システム/データアーキテクチャに関する設計ドキュメントをカテゴリー別に格納する。

| カテゴリー | ドキュメント | 概要 |
| :--- | :--- | :--- |
| **アーキテクチャ (`architecture/`)** | [DATA_ARCHITECTURE.md](architecture/DATA_ARCHITECTURE.md) | 3層データモデル（Raw / Curation / Dist）、1作品＝1 JSONスキーマ、5分類UIカテゴリーと章単位 `sourceRef`、共通人物マスタ・双方向リンク自動解決、原文1文字完全一致検証仕様 |
| **設計決定記録 (`adr/`)** | [0001](adr/0001-static-site-and-localstorage-persistence.md) / [0002](adr/0002-three-layer-data-and-exact-text-verification.md) / [0003](adr/0003-separate-shelf-category-from-source-type.md) | 完全静的サイト＋`localStorage`完結、3層データ分離＋原文1文字一致検証、書架カテゴリーと原典種別の分離など不可逆な確定決定（ADR） |
| **ドメイン用語集（ルート直下）** | [GLOSSARY.md](../GLOSSARY.md) | 書架・リーダー・物語・原典/編集/配信層・読書状態などの公式ドメイン語彙定義（`_Avoid_` 用語含む） |
| **引き継ぎ・プロダクト仕様 (`handoff/`)** | [HANDOFF.md](handoff/HANDOFF.md) | プロトタイプで確定したコアUX・ビジュアル原則、データソース比較表、クロスリファレンス人物特定ロジック、本番Webアプリ化の実装ステップ |
| **引き継ぎ・プロダクト仕様 (`handoff/`)** | [RETENTION_ROADMAP.md](handoff/RETENTION_ROADMAP.md) | 継続利用（リテンション）改善ロードマップ索引：読了・しおり（Phase 1-2）、目的別・キャラ別書店フェア棚（Phase 3）、人物名鑑・作品拡充（Phase 4-5）、DB導入構想・Won't（Phase 6）を `handoff/retention/` 配下に分割定義 |
| **ロードマップ (`roadmap/`)** | [ROADMAP.md](roadmap/ROADMAP.md) | 機能追加計画（時代フィルタ・3大特集プレイリスト・自動注釈パイプライン・Google Analytics）およびMVP優先収録作品ラインナップ |
