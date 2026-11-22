---
status: accepted
---

# 0006: React Router Framework Mode（静的プリレンダリング）・フラット URL・Cloudflare Workers Static Assets 配信

現行の `HashRouter` ＋クライアント SPA 構成が物語単位の検索インデックス登録および SNS OGP 配信のボトルネックになる課題を解決するため、一般公開前に React Router Framework Mode の完全静的プリレンダリング（`ssr: false` ＋ `prerender`）、フラット型パス URL、および Cloudflare Workers Static Assets 配信へ移行する方針を確定する。

## Considered Options

### 1. SSG フレームワークの選定

- **React Router Framework Mode（`ssr: false` ＋ `prerender`）（採用）**:
  - 現行の React 19 / Vite 8 / React Router 8（`@react-router/dev@8.5.2` が Vite 8・TypeScript 7 と互換）と同一エコシステム上にあり、ランタイムサーバーを持たない完全静的プリレンダリング（`build/client` への静的 `.html`＋`.data` 出力）によって [ADR-0001](0001-static-site-and-localstorage-persistence.md) のゼロ・バックエンド構成を維持できる。
  - 初期表示では物語本文を含む静的 HTML を返してクロール性を確保しつつ、ハイドレーション後はクライアント遷移で書架↔リーダー間の連続読書体験（絞り込み・横断検索・スクロール位置・フォーカス復元）をそのまま維持できる。
  - 既存の Radix UI・CSS Modules・Vitest / Playwright テスト資産の移行コストを最小限に抑えられる。
- **Astro 7 ＋ `@astrojs/react` v7（不採用）**:
  - コンテンツ配信と軽量 HTML 出力に優れ Vite 8 にも対応するが、MPA 遷移が基本となるため `AppProviders` が担う書架↔リーダー間の共有状態や `MemoryRouter` 依存の統合テストを Island 境界へ再設計するコストが大きく、アプリ的な連続読書体験の維持を優先して見送る。
- **Next.js Static Export（不採用）**:
  - Vite 8 / Vitest 中心の現行開発・テスト基盤から大きく離れ、完全静的リーダーに対して構成とビルド設定の重さが過剰となるため見送る。

### 2. 恒久的な URL 設計

- **フラット型パス URL（採用）**:
  - 現行画面の正規パスは書架 `/`、物語（リーダー） `/story/:storyId`、このサイトについて `/about` とする。
  - 将来拡張用の予約パスとして、読書コース `/courses`・`/courses/:courseId` および人物・用語名鑑 `/entities`・`/entities/:entityId` を確保する。
  - `storyId` は全書架カテゴリー横断で一意に管理されているため、将来書架カテゴリーの再編があっても恒久 URL が破損せず、URL 設計を簡潔に保てる。
- **書架カテゴリー階層型（`/:category/:storyId`）（不採用）**:
  - 5 分類（`book` / `artifact` / `weapon` / `attire` / `chronicle`）の単数・複数表記の揺れや、カテゴリー見直し時のリダイレクト保守コストが増えるため見送る。

### 3. 配信基盤（ホスティング）

- **Cloudflare Workers Static Assets ＋ 独自ドメイン予定（採用）**:
  - 従来の Cloudflare Pages ではなく現行公式推奨の Workers Static Assets を採用し、`wrangler.jsonc` の `assets.directory`（`./build/client`）および `not_found_handling: "404-page"` のみでサーバーエントリ（`main`）なしの完全静的配信を実現する。
  - 独自ドメイン取得予定（名称未定）を前提とし、将来 [ロードマップ `1.6`](../roadmap/ROADMAP.md) で動的引用 OGP 等を導入する場合も同一 Workers プロジェクトへ Worker エントリを追加して拡張できる。
- **GitHub Pages / Cloudflare Pages（不採用）**:
  - サブパス配信制約や、新規構成における Cloudflare の Workers 統合方針を踏まえ見送る。

## Consequences

- [`scripts/build-stories.mjs`](../../scripts/build-stories.mjs) による 3 層データ検証・配信データ生成（`public/data/`）はフレームワーク非依存の前段ビルドとして維持し、ルート `loader` および `prerender` 関数からビルド時に参照する。
- [ロードマップ `1.5`](../roadmap/ROADMAP.md) の第 2 ステップ（SSG 移行実装）では以下を必ず実施する：
  - パス URL 化に伴う `vite.config` の `base: "/"` 化と、`BASE_URL` 基準のデータ取得（[`src/api/stories.ts`](../../src/api/stories.ts)）への更新。
  - GA4（[ADR-0005](0005-google-analytics-and-privacy-opt-out.md)）の手動 `page_view` 計測方針を維持しつつ、[`src/analytics/ga4.ts`](../../src/analytics/ga4.ts) の `page_location` 計算から `HashRouter` 前提のパス二重結合を解消する。
  - `localStorage` 依存状態（読了・あとで読む・途中しおり・表示設定・テーマ初期化・GA4 オプトアウト）について、SSR／プリレンダリング時と初回ハイドレーション時の不一致を防ぐ安全策を組み込む。
  - 未知 URL に対するソフト 404 を防ぐため、静的 404 ページ（書架へ戻る導線付き）をビルド出力し、`not_found_handling: "404-page"` で HTTP 404 を返す。
  - 一般公開前の段階であるため、旧ハッシュ URL（`#/story/:id` 等）の恒久リダイレクト互換は設けない。
- 独自ドメイン確定までは正規オリジンをビルド時環境変数（`VITE_SITE_URL` 等）から注入する設計とし、未設定時のローカル開発や Vitest / Playwright テストが破綻しないようにする。
- 将来 [ロードマップ `1.6`](../roadmap/ROADMAP.md) や [SEO・シェア構想仕様書](../spec/TeyvatLibrary_seo_and_share_spec.md) に基づき、Workers 上で一節引用の動的 OGP 画像生成等（ランタイム処理）を導入する場合は、別途 [ADR-0001](0001-static-site-and-localstorage-persistence.md) を改訂する。
