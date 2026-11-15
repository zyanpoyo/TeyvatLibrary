# AGENTS.md

## Project Overview
「テイワット文庫（原神 聖遺物・武器・書籍リーダー）」— 原神の武器・聖遺物・書籍・突破素材ストーリーを、ライトユーザーが小説感覚で気軽に読めるWebアプリケーション。

## Context Pointers
- **新しい書籍・武器・聖遺物・突破素材ストーリーの抽出・人物名特定・作品間リンク追加を行う時**: [`.agents/skills/genshin-story-curator/SKILL.md`](.agents/skills/genshin-story-curator/SKILL.md) および [`docs/architecture/DATA_ARCHITECTURE.md`](docs/architecture/DATA_ARCHITECTURE.md) を参照。原典抽出は `npm run extract-raw -- --type <sourceType> --id <rawId>`（[`scripts/extract-raw.mjs`](scripts/extract-raw.mjs)）、検証＆配信JSON生成は `npm run build:data`（[`scripts/build-stories.mjs`](scripts/build-stories.mjs)）を使用する。
- **フロントエンド実装・UI/CSS仕様を確認する時**: [`index.html`](index.html)、[`src/main.js`](src/main.js)、[`src/render/shelf.js`](src/render/shelf.js)、[`src/render/reader.js`](src/render/reader.js)、[`src/styles/main.css`](src/styles/main.css) を参照。5分類タブ・人物/地域/キーワード検索・非同期JSON取得・ネイティブ `popover` 用語解説（出典自動リンク付）・`<details>` 真相メモが実装されている。
- **データアーキテクチャ・JSONスキーマ・ビルド検証仕様を確認する時**: [`docs/architecture/DATA_ARCHITECTURE.md`](docs/architecture/DATA_ARCHITECTURE.md) および [`docs/handoff/HANDOFF.md`](docs/handoff/HANDOFF.md) を参照。3層データモデル（`data/raw/` / `data/stories/` & `data/shared/` / `public/data/`）、共通人物マスタ（[`data/shared/entities.json`](data/shared/entities.json)）、原文1文字完全一致検証パイプライン（[`scripts/lib/validator.mjs`](scripts/lib/validator.mjs)）が定義されている。
