# AGENTS.md

## Project Overview
「テイワット文庫」— 原神の聖遺物・武器・書籍・風の翼・突破育成素材ストーリーを原文改変なしで通読できる完全静的 Web リーダー（React 19 + TypeScript + React Router v8 / Cloudflare Workers Static Assets）。

## Workflow & Guardrails
- **作業ブランチと PR 運用**: コード変更を始める前に最新の `master` からトピックブランチ（`feat/...`, `fix/...`, `docs/...`, `chore/...`）を作成し、PR 経由でマージする（`master` への直接コミット禁止）。
- **TypeScript 型境界と `.mjs` 宣言規約**: `tsconfig.json` はブラウザ実行コード（`src/`）専用（`"types": []`）で Node 型を含まない。Node API を使うテストは `tests/tsconfig.json`（`node` 型あり）配下に配置し、[`scripts/`](scripts/) の `.mjs` を TypeScript から参照する場合は隣接する `.d.mts` を維持・更新する。
- **UI/UX 変更の回帰検証**: フロントエンドの UI/UX を追加・修正した際は必ず `npm run test:e2e`（または `npm run test:all`）を実行し、既存操作のリグレッションがないことを確認する。
- **データ変更の必須検証**: [`data/stories/`](data/stories/)・[`data/shared/`](data/shared/)・[`data/schemas/`](data/schemas/) を編集した際は `npm run validate` を実行する（`addedAt` は必須、`official-corpus.json` 整合チェックを含む）。
- **ドキュメント同期**: 機能追加・仕様変更・`/plan` 時は [`.agents/skills/doc-sync/SKILL.md`](.agents/skills/doc-sync/SKILL.md) に従って関連ドキュメントを精査する。

## Context Pointers
- **フロントエンド構成・ルーティング・SEO/OGP・テスト詳細を確認する時**: [`docs/architecture/FRONTEND_ARCHITECTURE.md`](docs/architecture/FRONTEND_ARCHITECTURE.md)
- **3層データモデル・JSONスキーマ・ビルド/検証パイプラインを確認する時**: [`docs/architecture/DATA_ARCHITECTURE.md`](docs/architecture/DATA_ARCHITECTURE.md)（索引は [`docs/README.md`](docs/README.md)）
- **新しい物語の原典抽出・人物特定・作品間リンク・読書コース編入を行う時**: [`.agents/skills/genshin-story-curator/SKILL.md`](.agents/skills/genshin-story-curator/SKILL.md)
- **GA4 設定・独自ドメイン（`teyvat-bunko.com`）公開＆検証手順を確認する時**: [`docs/guides/GOOGLE_ANALYTICS_SETUP.md`](docs/guides/GOOGLE_ANALYTICS_SETUP.md)、[`docs/guides/SEO_AND_DEPLOY_SETUP.md`](docs/guides/SEO_AND_DEPLOY_SETUP.md)、[`docs/adr/`](docs/adr/)（特に 0005・0007）
- **リテンション機能改善（Phase 1〜5 / Phase 6 Won't）を扱う時**: [`docs/handoff/RETENTION_ROADMAP.md`](docs/handoff/RETENTION_ROADMAP.md) および [`docs/handoff/retention/`](docs/handoff/retention/)
- **設計壁打ち・アーキテクチャ改善・ドメイン言語管理を行う時**: [`GLOSSARY.md`](GLOSSARY.md)、[`docs/adr/`](docs/adr/)、および [`.agents/skills/ask-matt/SKILL.md`](.agents/skills/ask-matt/SKILL.md)（`improve-codebase-architecture` / `grilling` / `grill-with-docs` / `domain-modeling` / `wayfinder`）
- **仕様化・分割・TDD・2軸レビュー・調査・振り返りを行う時**: `.scratch/` 標準保存先を用い、`.agents/skills/` の該当スキル（`to-spec` / `to-tickets` / `implement` / `implement-spec` / `tdd` / `code-review` / `research` / `retro` 等）を参照
- **上流 `mattpocock/skills` との同期・整合性検証を行う時**: [`.agents/skills/sync-upstream-skills/SKILL.md`](.agents/skills/sync-upstream-skills/SKILL.md)、[`.agents/skills-upstream.json`](.agents/skills-upstream.json)（`npm run skills:validate` / `npm run skills:check`）
