---
status: accepted
---

# 0007: 本番ドメイン正規化・5分類 SEO メタ/JSON-LD・ビルド時静的 OGP 画像生成

[ADR-0006](0006-ssg-framework-and-url-architecture.md) で構築した静的プリレンダリング基盤および Cloudflare Workers Static Assets 配信の上に、独自本番ドメイン `https://teyvat-bunko.com` の正規化、5 分類対応の検索メタタグ／JSON-LD 構造化データ、および完全静的な作品別 OGP 画像生成方式を確定する。

## Considered Options

### 1. 本番ドメイン正規化と重複インデックス防止

- **`https://teyvat-bunko.com`（`www` なし）既定化 ＋ `workers_dev: false`（採用）**:
  - [`src/config/site-url.ts`](../../src/config/site-url.ts) および [`scripts/lib/post-build-seo.mjs`](../../scripts/lib/post-build-seo.mjs) の既定オリジンを `https://teyvat-bunko.com` に統一し、`VITE_SITE_URL` 未設定のビルドでも `canonical`・`og:url`・`og:image`・JSON-LD・`sitemap.xml` の絶対 URL 欠落や `workers.dev` 混入を防ぐ（ステージング検証時は `VITE_SITE_URL` で上書き可能）。
  - [`wrangler.jsonc`](../../wrangler.jsonc) で `"workers_dev": false`・`"preview_urls": false`・`"custom_domain": true`（`teyvat-bunko.com`）を設定し、検索エンジンが `*.workers.dev` と独自ドメインを重複インデックスするリスクを遮断する。`www.teyvat-bunko.com` から apex ドメインへの 301 リダイレクトは、Worker ランタイムコードを追加せず Cloudflare Redirect Rules 側で処理する。
- **環境変数（`VITE_SITE_URL`）未設定時 `canonical` 省略・`workers.dev` フォールバック維持（不採用）**:
  - ビルド設定漏れ時に `og:image` 等の必須絶対 URL が欠落したり、`sitemap.xml` に旧 `workers.dev` オリジンが混入する事故を防ぐため見送る。

### 2. 作品別 OGP 画像生成と SNS シェアの実装境界

- **ビルド時完全静的 PNG 生成（`satori` ＋ `@resvg/resvg-js` ＋ `@fontsource/shippori-mincho`）＋ 作品単位シェア導線（採用）**:
  - [ADR-0001](0001-static-site-and-localstorage-persistence.md) のゼロ・バックエンド制約を維持したまま、ビルドの `buildEnd` フェーズで書架（`/og/site.png`）・About（`/og/about.png`）・全収録作品（`/og/story/<id>.png`）の `1200×630` PNG を生成し、`build/client/og/` へ配信する。
  - `.cache/og/` への入力ハッシュキャッシュにより再ビルド時間を抑え、生成 PNG 自体は Git 管理対象外（`build/`）に留める。
  - リーダー末尾には作品単位の「X でシェア」「URL をコピー」導線（[`src/components/reader/StoryShareBar.tsx`](../../src/components/reader/StoryShareBar.tsx)）と GA4 `story_share` 計測を追加する。
- **共通 OGP 画像 1 枚のみの固定配信（不採用）**:
  - SNS で個別物語を共有した際に作品タイトルやキャッチコピーがカード上で識別できず、考察層・推し活層からの流入訴求が弱いため見送る。
- **一節引用シェア（`?q=...`）＋ Workers エッジ動的 OGP 画像生成（`HTMLRewriter`）の今回同時実装（保留／将来拡張）**:
  - ランタイム Worker コード（`main`）・フォントファイルのエッジ配布制限対策・[ADR-0001](0001-static-site-and-localstorage-persistence.md) 改訂を伴うため、まずは完全静的基盤での公開を優先し、将来需要に応じて別途検討する。

### 3. メタデータ・構造化データの生成方針

- **5 分類共通ビルダー（[`src/domain/seo.ts`](../../src/domain/seo.ts)）＋ 任意 `seo` 上書き ＋ `entities.json` / `glossary` 両方出力（採用）**:
  - `title` / `description` / `canonical` / OGP / Twitter Card / JSON-LD（`WebSite`・`CollectionPage`・`Article`・`BreadcrumbList`・`DefinedTerm`・`AboutPage`）とクライアント遷移後の `document.title` 更新を単一モジュールへ集約し、プリレンダリング HTML とハイドレーション後状態の不一致を防ぐ。
  - 物語の `Article` JSON-LD には `entities.json` 由来の `about`（種別に応じた `Person` / `Organization` / `Place` / `DefinedTerm`）に加え、本文中の `glossary` を `mentions`（`DefinedTerm`）として出力し、検索・AI 検索による人物・用語紐付けを最大化する。
  - 初期収録 9 作品へ `NEW` バッジ判定外（14 日以前）の初期収録日 `addedAt: "2026-11-01"` を補完し、全作品の `datePublished` と `sitemap.xml` `<lastmod>` を揃える。

## Consequences

- `npm run build` 実行時に全作品・書架・About の静的 HTML（JSON-LD・OGP メタ含む）と `build/client/og/**/*.png`、および `robots.txt` / `sitemap.xml` が自動生成される。
- `devDependencies` に `satori`（MPL-2.0）・`@resvg/resvg-js`（MPL-2.0）・`@fontsource/shippori-mincho`（SIL OFL-1.1）を追加し、[`NOTICE`](../../NOTICE) にライセンス表記を追記した（クライアント配信バンドルには含まれない）。
- 404 ページおよび存在しない作品ページには `robots: noindex, nofollow` を付与し、`canonical`・OGP・JSON-LD は出力しない。
- 本番ドメインのデプロイ、Redirect Rule（`www` → apex）、Search Console・リッチリザルト・SNS カードの実機確認手順は [`docs/guides/SEO_AND_DEPLOY_SETUP.md`](../guides/SEO_AND_DEPLOY_SETUP.md) に集約する。
