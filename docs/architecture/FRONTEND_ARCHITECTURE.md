# テイワット文庫 — フロントエンド＆テスト構成 (`FRONTEND_ARCHITECTURE.md`)

本ドキュメントは、テイワット文庫のフロントエンド実装・主要モジュール・静的配信・SEO/OGP 生成および型・テスト境界の仕様をまとめる。  
データ層の設計については [`DATA_ARCHITECTURE.md`](./DATA_ARCHITECTURE.md) を参照。

---

## 1. 技術スタック・静的ホスティング

- **フレームワーク / UI**: React 19 / TypeScript / React Router v8 Framework Mode（`ssr: false` によるビルド時静的プリレンダリング）/ Radix UI（`@radix-ui/react-popover`, `@radix-ui/react-dialog`）/ CSS Modules / Vite
- **静的ホスティング**: Cloudflare Workers Static Assets（[`wrangler.jsonc`](../../wrangler.jsonc)、[`public/_headers`](../../public/_headers)）
  - 配信ルート: `build/client/`、`not_found_handling: "404-page"`、`workers_dev: false`、`preview_urls: false`、`teyvat-bunko.com` カスタムドメイン運用
- **ビルド後処理設定**: [`react-router.config.ts`](../../react-router.config.ts)（全ルートプリレンダリング＋`buildEnd` での SEO アセット・静的 OGP PNG 生成）

---

## 2. 主要モジュール構成（`src/` & `scripts/`）

- **エントリ・ルーティング (`src/`)**
  - [`src/root.tsx`](../../src/root.tsx): ルート HTML シェル（テーマ初期化・`theme-color`・favicon・`HydrateFallback`・`ErrorBoundary`）
  - [`src/routes.ts`](../../src/routes.ts): フラット型パス URL 定義（`/`・`/courses`・`/courses/:courseId`・`/story/:storyId`・`/about`・`/404`・`*`）
  - [`src/routes/shelf.tsx`](../../src/routes/shelf.tsx) / [`src/routes/courses.tsx`](../../src/routes/courses.tsx) / [`src/routes/course-detail.tsx`](../../src/routes/course-detail.tsx) / [`src/routes/story.tsx`](../../src/routes/story.tsx) / [`src/routes/about.tsx`](../../src/routes/about.tsx) / [`src/routes/not-found.tsx`](../../src/routes/not-found.tsx): 各ルートの `loader` / `clientLoader` / `meta`（JSON-LD 含む）
  - [`src/server/dist-data.server.mjs`](../../src/server/dist-data.server.mjs): ビルド・プリレンダリング専用の `public/data/*.json` ローダー（物語・読書コース一覧／詳細プリレンダリング対象列挙含む）
  - [`src/router/search-params.ts`](../../src/router/search-params.ts): 検索クエリ・ジャンプ先パラメータ・コース文脈（`?course=`）同期およびパス構築
- **設定・アクセス解析**
  - [`src/config/site-url.ts`](../../src/config/site-url.ts): 正規基準 URL（既定 `https://teyvat-bunko.com`、`VITE_SITE_URL` 上書き可）および `canonical` / 絶対 URL 構築
  - [`src/config/site-contact.ts`](../../src/config/site-contact.ts): About ページ向けお問い合わせ窓口設定
  - [`src/analytics/ga4.ts`](../../src/analytics/ga4.ts): GA4 計測（`course_id` 対応 `page_view`・検索・読書・`story_open` コース導線・`story_share`・`course_share`、開発/テスト時の送信ガード、PII サニタイズ）
- **ドメインロジック (`src/domain/`)**
  - [`src/domain/catalog.ts`](../../src/domain/catalog.ts): 5 分類書架フィルタ、並び替え（おすすめ順 / 新着順 / 短い順等）、`NEW` バッジ（追加 14 日以内かつ未読）、日替わり「今日の物語ピックアップ」、おまかせ読書
  - [`src/domain/courses.ts`](../../src/domain/courses.ts): 代表フェアコース抽出、種別グルーピング、読了進捗／動的 CTA 導出、コース詳細ビュー・リーダー文脈（`?course=`・所属コース・未読次話）導出
  - [`src/domain/search.ts`](../../src/domain/search.ts): `search-index.json` 遅延取得による横断全文検索（日本語正規化・クロスフィールド AND・スニペット抽出・真相メモ検索トグル）
  - [`src/domain/text-parser.ts`](../../src/domain/text-parser.ts): インライン用語タグ・原文プレースホルダ構文パーサ・ISO 日付実在チェック
  - [`src/domain/seo.ts`](../../src/domain/seo.ts): 5 分類＆読書コース一覧・詳細テンプレート、任意 `seo` 上書き反映、OGP / Twitter Card、JSON-LD（`WebSite` + `SearchAction`, `CollectionPage`, `ItemList`, `BreadcrumbList`, `Article`, `DefinedTerm`, `AboutPage`）、`/404`・存在しない作品/コース用 `noindex, nofollow`
  - [`src/domain/share.ts`](../../src/domain/share.ts): 作品単位およびコース単位の正規シェア URL・X（旧 Twitter）インテント生成
- **状態管理・フック (`src/state/`, `src/hooks/`)**
  - [`src/state/persisted-store.ts`](../../src/state/persisted-store.ts) / [`reading-state.ts`](../../src/state/reading-state.ts) / [`prefs.ts`](../../src/state/prefs.ts) / [`analytics-prefs.ts`](../../src/state/analytics-prefs.ts) / [`AppProviders.tsx`](../../src/state/AppProviders.tsx): `localStorage` 永続化・別タブ同期・設定管理
  - [`src/hooks/useReaderSession.ts`](../../src/hooks/useReaderSession.ts) / [`useSearchIndex.ts`](../../src/hooks/useSearchIndex.ts) / [`useSearchHighlight.ts`](../../src/hooks/useSearchHighlight.ts): 読書進捗・途中しおり・90%自動読了・検索着地ハイライト
- **UI コンポーネント (`src/components/`, `src/styles/`)**
  - `shelf/`: [`ShelfPage.tsx`](../../src/components/shelf/ShelfPage.tsx), [`ObservatoryHeader.tsx`](../../src/components/shelf/ObservatoryHeader.tsx), [`FairShelf.tsx`](../../src/components/shelf/FairShelf.tsx), [`SearchSnippets.tsx`](../../src/components/shelf/SearchSnippets.tsx)
  - `courses/`: [`CoursesPage.tsx`](../../src/components/courses/CoursesPage.tsx), [`CourseDetailPage.tsx`](../../src/components/courses/CourseDetailPage.tsx), [`CourseCard.tsx`](../../src/components/courses/CourseCard.tsx)
  - `reader/`: [`ReaderPage.tsx`](../../src/components/reader/ReaderPage.tsx), [`ReaderCourseNav.tsx`](../../src/components/reader/ReaderCourseNav.tsx)（上部コース文脈バー・章末連続通読＆所属コース案内）, [`StoryShareBar.tsx`](../../src/components/reader/StoryShareBar.tsx)
  - `common/`: [`ShareBar.tsx`](../../src/components/common/ShareBar.tsx)（作品／コース共用 X シェア・URL コピーバー）, [`AppIcon.tsx`](../../src/components/common/AppIcon.tsx)
  - `about/`: [`AboutPage.tsx`](../../src/components/about/AboutPage.tsx)（非公式表記・著作権・GA4 オプトアウト・`localStorage` 説明・免責・連絡先）
  - `layout/` & `styles/`: [`SiteNavBar.tsx`](../../src/components/layout/SiteNavBar.tsx)（常設ナビ：`書架` / `読書コース`）, [`ThemeSwitcher.tsx`](../../src/components/layout/ThemeSwitcher.tsx), [`AnalyticsOptOutControl.tsx`](../../src/components/layout/AnalyticsOptOutControl.tsx), [`PrivacyDialog.tsx`](../../src/components/layout/PrivacyDialog.tsx), [`tokens.css`](../../src/styles/tokens.css)
- **ビルド後処理・静的検証スクリプト (`scripts/`)**
  - [`scripts/lib/post-build-seo.mjs`](../../scripts/lib/post-build-seo.mjs): `robots.txt`・`sitemap.xml`（`/`・`/courses`・全 `/courses/<id>`・全 `/story/<id>`（`addedAt` 連動 `<lastmod>`）・`/about`）・リダイレクト調整
  - [`scripts/lib/og-image-generator.mjs`](../../scripts/lib/og-image-generator.mjs) / [`scripts/generate-og-images.mjs`](../../scripts/generate-og-images.mjs): `satori` + `@resvg/resvg-js` + `@fontsource/shippori-mincho` による書架・About・読書コース一覧（`/og/courses.png`）・全コース（`/og/course/<id>.png`）・全作品の `1200×630` OGP PNG 生成（`.cache/og/` キャッシュ、`--only <target[,target...]>` / `--force` で部分強制再生成可）
  - [`scripts/preview-static.mjs`](../../scripts/preview-static.mjs): `build/client/` 向け静的プレビューサーバー（`404.html` 解決対応）

---

## 3. TypeScript 型境界・テスト・検証パイプライン

### TypeScript 設定の分離
ブラウザ実行コードと Node テスト／ビルドスクリプトで型定義が混線しないよう、`tsconfig` を 2 層に分離している。

| 設定ファイル | 対象スコープ | `types` 設定 | 用途・制約 |
| :--- | :--- | :--- | :--- |
| [`tsconfig.json`](../../tsconfig.json) | `src`, `.react-router/types/**/*` | `[]`（[`src/vite-env.d.ts`](../../src/vite-env.d.ts) で `vite/client` 参照） | ブラウザバンドルに Node 型や Vitest グローバル型が混入するのを防ぐ |
| [`tests/tsconfig.json`](../../tests/tsconfig.json) | `tests/**/*.{ts,tsx}`, `src/**/*` | `["vitest/globals", "@testing-library/jest-dom", "node"]` | テスト内での `node:*` / `Buffer` 利用や Vitest グローバル型を許可 |

- **`.mjs` モジュール参照規約**: TypeScript ファイル（テスト・アプリ等）から `scripts/**/*.mjs` や `src/server/*.mjs` を参照する場合は、同ディレクトリに隣接する `.d.mts` 宣言ファイルを配置して型安全性を保つ。

### テスト環境分離と検証コマンド
- **Vitest 実行環境分離 ([`vite.config.js`](../../vite.config.js))**: `test.projects` により、DOM/WebStorage を扱わない純粋ロジック・スクリプトテスト（`node` プロジェクト）と、React コンポーネント／`localStorage` 依存テスト（`dom` プロジェクト、`jsdom` ＋ [`tests/setup.ts`](../../tests/setup.ts)）を分離して実行する。
- **主なコマンド**:
  - `npm run lint`: Oxlint（[`.oxlintrc.json`](../../.oxlintrc.json)）による `react/rules-of-hooks` 検証
  - `npm run typecheck`: `react-router typegen && tsc --noEmit && tsc --noEmit -p tests/tsconfig.json`
  - `npm test`: Vitest（`node` + `dom` プロジェクト全実行）
  - `npm run test:e2e`: Playwright Chromium E2E（`build/client/` 本番ビルド＋静的プレビューサーバー自動起動）
  - `npm run test:all`: `npm test && npm run test:e2e`
  - `npm run build:og -- --only site,courses,course/must_read_essentials,crimson_witch --force`: OGP 画像の特定対象のみキャッシュ無視で即時再生成（レイアウト確認用）
