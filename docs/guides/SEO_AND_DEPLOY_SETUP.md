# SEO・独自ドメイン公開（`teyvat-bunko.com`）＆公開後検証ガイド

本ドキュメントは、本番ドメイン **`https://teyvat-bunko.com`** への Cloudflare Workers Static Assets デプロイ、`www` → apex リダイレクト設定、Google Search Console 登録、およびリッチリザルト・SNS OGP カードの実機検証を行うための手順書・チェックリストである。

---

## 1. Cloudflare 側デプロイ＆ドメイン設定

### 1.1 デプロイ前のビルド設定（Cloudflare Workers / Workers Builds）

本リポジトリは [`wrangler.jsonc`](../../wrangler.jsonc) で以下を宣言している：

- `"name": "teyvat-library"`
- `"workers_dev": false`・`"preview_urls": false`（`*.workers.dev` での重複インデックス防止）
- `"routes": [{ "pattern": "teyvat-bunko.com", "custom_domain": true }]`
- `"assets": { "directory": "./build/client", "not_found_handling": "404-page" }`

Cloudflare ダッシュボードまたは Wrangler CLI からデプロイする際のビルド設定は以下を指定する。

| 項目 | 設定値 | 備考 |
| :--- | :--- | :--- |
| **ビルドコマンド** | `npm run build` | `build:data` → `typecheck` → `react-router build`（静的 HTML / `robots.txt` / `sitemap.xml` / `og/**/*.png` 生成）を一括実行 |
| **配信ディレクトリ** | `build/client` | `wrangler.jsonc` の `assets.directory` で指定済み |
| **環境変数（Production）** | `VITE_GA_MEASUREMENT_ID` | GA4 を有効化する場合のみ測定 ID（`G-...`）を設定（詳細は [`GOOGLE_ANALYTICS_SETUP.md`](GOOGLE_ANALYTICS_SETUP.md)） |
| **環境変数（任意上書き）** | `VITE_SITE_URL` | 未設定時の既定値は `https://teyvat-bunko.com`。検証用別ドメインにデプロイする場合のみ設定する |
| **キャッシュヘッダー** | `public/_headers` 自動同梱 | `/og/*`・`/favicon.svg`・`/robots.txt`・`/sitemap.xml` の `Cache-Control` が反映される |

### 1.2 `www.teyvat-bunko.com` → `https://teyvat-bunko.com` 301 リダイレクト設定

`www` 付きアクセスを検索エンジンへ分散させないため、Cloudflare 管理画面の Redirect Rules で恒久リダイレクト（301）を設定する。

1. Cloudflare ダッシュボード → 対象ドメイン **`teyvat-bunko.com`** を選択。
2. **DNS → Records** を確認し、`www` サブドメインが存在しない場合は以下を追加してプロキシ（オレンジ雲）を有効化する（Cloudflare の Edge Redirect を発火させるためのダミーレコード）：
   - **Type**: `AAAA` / **Name**: `www` / **IPv6 address**: `100::` / **Proxy status**: Proxied（ON）
3. **Rules → Redirect Rules → Create rule** を開く。
4. 以下を設定して **Deploy** する：
   - **Rule name**: `Redirect www to apex`
   - **When incoming requests match...**: Custom filter expression → Field: `Hostname` / Operator: `equals` / Value: `www.teyvat-bunko.com`
   - **Then... (URL redirect)**: Type: `Dynamic` / Expression: `concat("https://teyvat-bunko.com", http.request.uri.path)`
   - **Status code**: `301`
   - **Preserve query string**: ON（チェック）

### 1.3 デプロイ後の HTTP 疎通チェックリスト

公開直後にブラウザまたは `curl -I` 等で以下を確認する。

- [ ] `https://teyvat-bunko.com/` が HTTP `200` で返る
- [ ] `https://www.teyvat-bunko.com/`（および `/story/crimson_witch`）が HTTP `301` で `https://teyvat-bunko.com/...` へリダイレクトされる
- [ ] `https://teyvat-bunko.com/nonexistent-check` が HTTP `404`（ソフト 404 ではなく 404 ステータス）で返り、`<meta name="robots" content="noindex, nofollow">` を含む
- [ ] `https://teyvat-bunko.com/robots.txt` が `Sitemap: https://teyvat-bunko.com/sitemap.xml` を返す
- [ ] `https://teyvat-bunko.com/sitemap.xml` に全作品・`/about`・`/` と各 `<lastmod>` が含まれる
- [ ] `https://teyvat-bunko.com/og/site.png`・`/og/about.png`・`/og/story/crimson_witch.png` が HTTP `200` (`image/png`) で表示される
- [ ] 旧 `*.workers.dev` URL が無効化（404 等で非公開）されている

---

## 2. Google Search Console 登録＆サイトマップ送信

1. [Google Search Console](https://search.google.com/search-console) を開き、プロパティ追加で **「ドメイン」**（`teyvat-bunko.com`）を選択する。
2. TXT レコード検証（ドメインプロバイダが Cloudflare のため「Cloudflare で自動認証」または DNS TXT レコード登録）を完了する。
3. 左メニュー **「サイトマップ」** を開き、`https://teyvat-bunko.com/sitemap.xml`（入力欄には `sitemap.xml`）を入力して **送信** する。
4. 左メニュー **「URL 検査」** で以下をテストし、「公開 URL をテスト」でインデックス登録可能かつ `canonical` が一致していることを確認する：
   - [ ] `https://teyvat-bunko.com/`
   - [ ] `https://teyvat-bunko.com/story/crimson_witch`
   - [ ] `https://teyvat-bunko.com/story/byakuyakoku`
   - [ ] `https://teyvat-bunko.com/about`

---

## 3. リッチリザルト＆SNS OGP カード実機検証チェックリスト

### 3.1 構造化データ（JSON-LD）検証

- **Google リッチリザルトテスト**: `https://search.google.com/test/rich-results`
  - [ ] `https://teyvat-bunko.com/`：検出エラー 0 件
  - [ ] `https://teyvat-bunko.com/story/crimson_witch`：`パンくずリスト（BreadcrumbList）` と `記事（Article）` がエラーなしで検出される
- **Schema Markup Validator**: `https://validator.schema.org/`
  - [ ] `/` の `WebSite`（`SearchAction`）・`CollectionPage` がエラー 0 件でパースされる
  - [ ] `/story/crimson_witch` の `BreadcrumbList`・`Article`・`about`（`Person` 等）・`mentions`（`DefinedTerm`）がエラー 0 件でパースされる
  - [ ] `/about` の `BreadcrumbList`・`AboutPage` がエラー 0 件でパースされる

### 3.2 SNS OGP カード表示検証

- **X（旧 Twitter）**: 投稿作成画面（下書き・限定公開またはプレビューツール）に以下の URL を貼り付け、`summary_large_image`（`1200×630`）のタイトル・説明文・画像が欠けずに表示されることを確認する。
  - [ ] `https://teyvat-bunko.com/`（`og/site.png`）
  - [ ] `https://teyvat-bunko.com/story/crimson_witch`（`og/story/crimson_witch.png`）
  - [ ] `https://teyvat-bunko.com/story/moonlit_bamboo_forest`（難読漢字「兹白」を含む作品カード）
  - [ ] `https://teyvat-bunko.com/about`（`og/about.png`）
- **Discord / LINE / Slack 等**: プライベートチャンネルやメモ欄へ URL を貼り付け、OGP カードが正しく展開されることを確認する。

---

## 4. 公開後の継続改善ルーチン

- 公開後 2〜4 週間で Search Console の **「検索パフォーマンス」** を確認し、インプレッションが多いのにクリック率（CTR）が低い作品があれば、該当作品の編集 JSON（`data/stories/<category>/<id>.json`）へ任意フィールド `"seo": { "title": "...", "description": "..." }` を追加してタイトル・説明文を調整する。
- 新規作品追加時は `addedAt`（`YYYY-MM-DD`）を必ず設定し、`npm run build` により `sitemap.xml` と作品別 `/og/story/<id>.png` が自動追従することを確認する。
