# テイワット文庫 — 機能追加・優先収録ロードマップ

本ドキュメントは、[HANDOFF.md](../handoff/HANDOFF.md)・[DATA_ARCHITECTURE.md](../architecture/DATA_ARCHITECTURE.md)・[RETENTION_ROADMAP.md](../handoff/RETENTION_ROADMAP.md) に定義された拡張計画と、MVP期以降の優先収録ラインナップ（[teyvat_bunko_mvp_lineup.md](../handoff/teyvat_bunko_mvp_lineup.md) および追加収録候補）を統合管理するロードマップである。

---

## 1. 機能追加ロードマップ

### 1.1 読書体験・検索機能の拡張
- [x] **読了チェックマーク・途中しおり・進捗のローカル保存**（[`reading-state.ts`](../../src/state/reading-state.ts) / [RETENTION_ROADMAP.md](../handoff/RETENTION_ROADMAP.md) Phase 1-2 にて実装済み）
- [ ] **時代（`era`）軸での横断フィルタリング**（[HANDOFF.md](../handoff/HANDOFF.md) Step 4）
  - 「500年前の災厄」「魔神戦争」「旧貴族時代」などの時代区分で絞り込める専用フィルタを書架に追加する（現状の `ShelfFilters` はカテゴリー・読書状態・登場人物・用語・地域・キーワード・並び順に対応）。

### 1.2 フェア棚＆読書コース（`/courses`・`/courses/:courseId`）機能
複数の書籍・聖遺物・武器・風の翼・突破素材を横断し、ネタバレなしの 1 行順路ガイド（`note`）付きで連続通読できるフェア棚＆読書コース機能（詳細：[`phase3_curation_courses.md`](../handoff/retention/phase3_curation_courses.md)）。

- [x] **フェア棚／読書コース UI（`courses.json`・専用ページ・連続通読・静的 OGP）の実装**
  - **ハイブリッド導線設計**: 書架トップ（`/`）の `FairShelf` に代表 3 コース（`featured: true`）＋一覧リンクを配置（検索・絞り込み中は自動非表示）し、専用ルート `/courses`（全コース種別フィルタ＆グループ一覧）と `/courses/:courseId`（進捗バー・動的 CTA・順路ガイド `note`・シェア・関連コース）を静的プリレンダリング＋`sitemap.xml`・静的 OGP（`/og/courses.png`, `/og/course/<id>.png`）付きで公開。
  - **全11コース（収録 46 作品全網羅）＆ `?course=` 連続通読**: 入門（2コース）・キャラ別（3コース：ロザリン／アルレッキーノ／放浪者）・地域・歴史別（6コース：テイワット創世記／水仙十字院／白夜国とオロバシ／ナド・クライ編／スネージナヤ王朝史／スメール砂漠編）を収録し、リーダー画面で `?course=` 文脈バー・章末の次話／前話／全話読破・他収録コース表示に対応。

### 1.3 コンテンツ制作パイプラインの自動化
- [ ] **全公式テキストのローカル検索インデックス化**（[HANDOFF.md](../handoff/HANDOFF.md) Step 2）
  - `genshin-db` の全日本語データ（`characters`, `artifacts`, `weapons`, `materials`, `windgliders`, `outfits`）を横断検索できるローカルインデックスを整備する（※初期CLIとして `npm run lore:search` / `npm run lore:inspect`（[`lore-tools.mjs`](../../scripts/lore-tools.mjs)）を実装済み）。
- [ ] **開発時バッチ変換スクリプト（`scripts/enrich-story`）**（[HANDOFF.md](../handoff/HANDOFF.md) Step 2）
  - 原典テキストと抽出根拠を元に、`hook`・`preGuide`・時系列 `chapters`・`{{term_id|...}}` 注釈・`glossary`・`overallTruth`・`connected` をビルド前に半自動生成するパイプラインを構築する。

### 1.4 運用・アクセス解析基盤
- [x] **Google Analytics によるアナリティクス追跡対応**（[ADR-0005](../adr/0005-google-analytics-and-privacy-opt-out.md) / [GA4 セットアップガイド](../guides/GOOGLE_ANALYTICS_SETUP.md)）
  - Vite 環境変数（`VITE_GA_MEASUREMENT_ID`）による有効化ガード、HashRouter 向け正規化仮想パスの手動 `page_view` 計測、7 種カスタムイベント（作品開封導線・検索・読了・用語ガイド・真相メモ・あとで読む・書架フィルタ）、およびフッター「アクセス解析について」ダイアログでの告知・即時オプトアウト切替を実装済み。

### 1.5 【SEO 前提基盤】SSG フレームワーク移行＆URL・静的配信基盤の確立
現行の `HashRouter` ＋クライアント SPA 構成は作品単位の検索インデックス登録・SNS OGP 配信のボトルネックとなるため、一般公開前に理想的な SSG フレームワーク構成を選定・移行し、SEO 施策および将来ページ（フェア棚・人物/用語名鑑）の土台となる「器」を確立する（**優先度：高／一般公開前・フェア棚／名鑑 UI 実装より先行推奨**）。

- [x] **要件整理＆SSG フレームワーク選定・ADR 策定**（[ADR-0006](../adr/0006-ssg-framework-and-url-architecture.md) にて確定）
  - **配信基盤**: Cloudflare Workers（Workers Static Assets：`build/client` 静的配信＋`not_found_handling: "404-page"`）および独自ドメイン運用（`https://teyvat-bunko.com` 既定・環境変数 `VITE_SITE_URL` で上書き可能）を採用。
  - **SSG フレームワーク**: React Router v8 Framework Mode（`ssr: false`＋`prerender`）を採用し、静的 HTML 出力による SEO とハイドレーション後の連続読書 UX（書架↔リーダー状態連携）を両立。
  - **URL 設計（フラット型）**: 書架 `/`・物語 `/story/:storyId`・このサイトについて `/about` を基本とし、将来の読書コース `/courses`・`/courses/:courseId` および人物・用語名鑑 `/entities`・`/entities/:entityId` を予約（未公開のため旧ハッシュ互換は設けない）。
- [x] **SSG 構成への移行＆既存アプリ移植**
  - [`react-router.config.ts`](../../react-router.config.ts)・[`src/routes.ts`](../../src/routes.ts)・[`src/root.tsx`](../../src/root.tsx)・[`src/routes/`](../../src/routes/story.tsx)・[`src/server/dist-data.server.mjs`](../../src/server/dist-data.server.mjs) を構築し、3 層データコンパイラ（[`build-stories.mjs`](../../scripts/build-stories.mjs)）の前段出力をそのまま接続。
  - パス URL 化・`vite.config.js`（`base: "/"`・`cssCodeSplit: false`）・`BASE_URL` 基準取得（[`stories.ts`](../../src/api/stories.ts)）・GA4 `page_location` 正規化（[`ga4.ts`](../../src/analytics/ga4.ts)）を対応。
  - `localStorage` 依存状態（読了記録・しおり・表示設定・テーマ／フォント初期化・GA4 オプトアウト）のハイドレーション安全化、および本番静的配信サーバー（[`scripts/preview-static.mjs`](../../scripts/preview-static.mjs)）を導入。
  - 既存の単体テスト・Playwright E2E 全 7 スペックをパス URL へ追従させ、ハイドレーション警告ゼロ検証（[`ssg-prerender.spec.js`](../../tests/e2e/ssg-prerender.spec.js)）を追加。
- [x] **最低限のクロール受入基盤の整備**
  - 書架 `/`・全 35 物語 `/story/:storyId`・`/about` の静的 HTML 出力、および静的 `404.html` ＋ [`wrangler.jsonc`](../../wrangler.jsonc)（`not_found_handling: "404-page"`）による HTTP 404 配信を構築。
  - `VITE_SITE_URL` 注入対応の `canonical`（[`site-url.ts`](../../src/config/site-url.ts)）・`robots.txt`・`sitemap.xml` 自動生成（[`post-build-seo.mjs`](../../scripts/lib/post-build-seo.mjs)）・[`public/favicon.svg`](../../public/favicon.svg) をビルドに組み込み。

### 1.6 【SEO 最適化】メタタグ・構造化データ・OGP／引用シェア＆公開後検証
`1.5` で確立した SSG 基盤の上で、検索流入（Google 検索・AI 検索）と SNS 拡散の訴求力を最大化するフェーズ（確定仕様：[ADR-0007](../adr/0007-seo-metadata-structured-data-and-static-ogp.md) / 公開・検証手順：[SEO_AND_DEPLOY_SETUP.md](../guides/SEO_AND_DEPLOY_SETUP.md) / 参考：[TeyvatLibrary_seo_and_share_spec.md](../spec/TeyvatLibrary_seo_and_share_spec.md)）。

- [x] **検索向けメタタグ設計＆JSON-LD 構造化データの実装**（優先度：高／一般公開前仕上げ）
  - 5 分類（書籍・聖遺物・武器・風の翼・突破／育成素材）・書架 `/`・About `/about`・404 `/404`（`noindex`）の `<title>`・`<meta name="description">` ビルダー（[`src/domain/seo.ts`](../../src/domain/seo.ts)）および任意 `seo` 上書きフィールドを実装し、`document.title` 同期を統一。
  - JSON-LD 構造化データ（`WebSite` + `SearchAction`、`CollectionPage`、`BreadcrumbList`、`Article`、`Person` / `Organization` / `Place` / `DefinedTerm`、`AboutPage`）を各静的 HTML へ出力し、初期 9 作品へ `addedAt`（`2026-11-01`）を補完。
- [x] **静的 OGP・作品単位 SNS シェア設計と実装**（完全静的・[ADR-0001](../adr/0001-static-site-and-localstorage-persistence.md) 準拠）
  - `satori` + `@resvg/resvg-js` + `@fontsource/shippori-mincho` により、ビルド時に書架・About・全作品の `1200×630` OGP PNG（`build/client/og/`）を自動生成（キャッシュ付き）し、`og:image` / `twitter:card` へ接続。
  - リーダー末尾へ作品単位の「X でシェア」「URL をコピー」導線（[`StoryShareBar.tsx`](../../src/components/reader/StoryShareBar.tsx)）と GA4 `story_share` イベント計測を実装。
  - [ ] **（任意・将来拡張）一節引用シェア＆動的 OGP 画像生成**：Cloudflare Workers ランタイム＋`HTMLRewriter` による段落単位の動的 OGP カード生成（※導入時は [ADR-0001](../adr/0001-static-site-and-localstorage-persistence.md) の改訂が必要）。
- [ ] **公開後の検索・SNS クロール検証**（優先度：中／一般公開後 — [`SEO_AND_DEPLOY_SETUP.md`](../guides/SEO_AND_DEPLOY_SETUP.md) に沿って実施）
  - Cloudflare Workers（`teyvat-bunko.com`、`workers_dev: false`）デプロイおよび `www` → apex 301 リダイレクト設定後の `canonical`・`og:url`・`og:image`・`sitemap.xml` 実 URL 反映を確認する。
  - Google リッチリザルトテスト・Schema Markup Validator・X / Discord 等の OGP カード実機表示検証を行う。
  - Google Search Console 登録・サイトマップ送信および検索クエリに基づく継続改善を行う。

### 1.7 人物・用語名鑑（`/entities`・`/entities/:entityId`）機能（Phase 4）
[`data/shared/entities.json`](../../data/shared/entities.json) の共通人物・用語マスタを設定確認辞書＋回遊ハブとして独立させる機能（詳細：[`phase4_5_entities_and_content.md`](../handoff/retention/phase4_5_entities_and_content.md)）。

- [x] **人物・用語名鑑 UI・ビルド出力・クロスリンク・静的 OGP の実装**
  - `stories-index.json` の `entitiesIndex` へ `defaultIdentity`・`defaultDesc`・`defaultEvidence`・解決済み `evidenceLinks` を出力し、`verifyEntitiesIndex` 検証を追加。
  - `/entities`（種別フィルタ・日本語正規化キーワード検索・並び替え・ネタバレ注記・種別グループ一覧）および `/entities/:entityId`（正体・背景解説・出典リンク・読了進捗＆未読 CTA・登場作品・関連コース・共起エンティティ・シェアバー）を静的プリレンダリング＋`sitemap.xml`＋JSON-LD＋静的 OGP（`/og/entities.png`, `/og/entity/<id>.png`）＋GA4 計測付きで公開。
  - 常設ナビ（`SiteNavBar`＋フッター）、リーダー用語ガイド（`GlossaryDialog`）、リーダー真相メモ内チップ、書架の人物絞り込み中リンクの 4 クロスリンク導線を接続。
- [ ] **組織・概念・場所（`organization` / `concept` / `place`）のマスタデータ拡充**
  - 現状 58 件（`character` / `god`）に加え、主要組織・概念・地名を別 PR にて段階的に登録・紐付けする（UI・5 種別グルーピングは 0 件種別自動非表示で対応済み）。

---

## 2. 優先収録作品ロードマップ

### 2.1 【書籍】世界観の根幹＆入門・重要書籍ラインナップ（12選）

| 状態 | 作品名（巻数） | 優先度 | 収録・特集の狙い |
| :---: | :--- | :---: | :--- |
| ✅ | **白夜国館蔵**（全5巻 / 特に第2巻『日月前事』） | ★★★ | [`byakuyakoku.json`](../../data/stories/book/byakuyakoku.json) として収録済み。天理・七龍・四つの影などテイワット創世の起点となる最重要書籍。 |
| ✅ | **ペリンヘリ**（全2巻） | ★★★ | [`perinheri.json`](../../data/stories/book/perinheri.json) として第3バッチで収録済み。カーンルイア「赤月王朝」や壁炉の家、外の世界からの漂流者を扱う重要書。 |
| ✅ | **白姫と六人の小人**（第1巻収録／第2〜7巻は書籍概要のみ掲載） | ★★★ | [`pale_princess.json`](../../data/stories/book/pale_princess.json) として第4バッチで収録済み。ゲーム内入手可能な第1巻を本編として収録し、第2〜7巻は書籍概要を併載。アビス・月の三姉妹・夜の国と月光の森を巡る暗喩として考察需要が高い古童話。 |
| ✅ | **スネージナヤ通史**（全2巻） | ★★★ | [`general_history_of_snezhnaya.json`](../../data/stories/book/general_history_of_snezhnaya.json) として第5バッチで収録済み。氷の女皇アナスターシャへ献上された正史であり、ヒュペルボレイア伝説と先代皇帝モノマフ（ツァーリ・ベールイ）および盟友フィリポフの旅路を描く。 |
| ✅ | **スネージナヤ通史補編**（全3巻） | ★★★ | [`general_history_of_snezhnaya_supplement.json`](../../data/stories/book/general_history_of_snezhnaya_supplement.json) として第5バッチで収録済み。モノマフ皇帝の宿敵ミスティスラフ王と異怪の獣連盟の興亡、および敗者側の一次史料『諸獣王公列伝』を収録。 |
| ✅ | **蒼星フェイ史略**（全1巻） | ★★★ | [`pale_starborn_history.json`](../../data/stories/book/pale_starborn_history.json) として第5バッチで収録済み。キーテジ会戦でのツァーリ・ベールイ誕生から、第七百九十九紀の女皇アナスターシャ戴冠・ファデュイ創設・妖精大公から人間への政権移行を描く年代記。 |
| ⬜ | **イノシシプリンセス**（全7巻） | ★★☆ | 知名度は高いが未読層が多い作品。絵本風の体裁とブラックな結末のコントラストに加え、「天の御遣い」や幻想シアターにも関わる暗喩として注目度が高い。 |
| ⬜ | **テイワット観光ガイド**（全4巻） | ★★☆ | アリスによる軽快な紀行文。専門用語が少なく、ライト層の最初の1冊に適する。 |
| ✅ | **竹林月夜**（全4巻） | ★★☆ | [`moonlit_bamboo_forest.json`](../../data/stories/book/moonlit_bamboo_forest.json) として第4バッチで収録済み。月の三姉妹伝承と白馬の仙人兹白の記憶を描く民話。 |
| ⬜ | **フィッシュル皇女物語** | ★★☆ | キャラクターファンが入りやすい幻想小説シリーズ。 |
| ✅ | **プシュパの歌**（全3巻 / `scroll_of_streaming_song`） | ★★☆ | [`scroll_of_streaming_song.json`](../../data/stories/book/scroll_of_streaming_song.json) として第7バッチで収録済み。スメール砂海遺跡から出土した古代断片。マハールッカデヴァータと花神による、知恵・天理のルール・文明の本質をめぐる哲学的問答集。 |
| ⬜ | **砕夢奇珍**（全4巻 / `hearts_desire`） | ★☆☆ | テイワット各国で流行する、何もない骨董店で起きた出来事を綴る幻想物語集。 |
| ⬜ | **絶雲紀聞**（全6巻 / `records_of_jueyun`） | ★☆☆ | 璃月の民俗・怪奇・上古伝説全集（石獣・海神宮ほか）。璃月世界観の掘り下げに適する。 |

### 2.2 【聖遺物】5部位統合で読みやすくなる名作（テーマ・地域別 / 全31作品）

| 状態 | 地域・テーマ | 聖遺物セット名 | 関連キャラ・テーマ | 収録・特集の狙い |
| :---: | :--- | :--- | :--- | :--- |
| ✅ | 創世記・高天・月 | **深廊の終曲**（`finaleofthedeepgalleries`） | 原初の龍ニーベルンゲン・過客の少女・極北古史 | [`deep_galleries.json`](../../data/stories/artifact/deep_galleries.json) として第4バッチで収録済み（コース③対象）。天理・龍王・月の三姉妹・北国の古文明に関わる最新考察トレンド直結の聖遺物。 |
| ✅ | 創世記・高天・月 | **暁の星と月の歌**（`aubadeofmorningstarandmoon`） | 月の三姉妹・空月・統一文明時代 | [`aubade_of_morning_star_and_moon.json`](../../data/stories/artifact/aubade_of_morning_star_and_moon.json) として第6バッチで収録済み。三つの空月を中心とした統一文明時代から終焉までの神話を描く創世記テキスト。 |
| ✅ | 創世記・高天・月 | **天からの贈り物**（`celestialgift`） | 最初の天の御使・高天への反逆 | [`celestial_gift.json`](../../data/stories/artifact/celestial_gift.json) として第6バッチで収録済み。高天から御使へ授けられた贈り物と、最初の御使が天理へ反逆するまでの経緯を描く。 |
| ✅ | モンド | **燃え盛る炎の魔女** | 「淑女」シニョーラ（ロザリン） | [`crimson_witch.json`](../../data/stories/artifact/crimson_witch.json) として収録済み（コース①対象）。本編未描写の過去を描く代表作。 |
| ✅ | モンド | **守護の心** | ルスタム（「幼狼」）・西風騎士団 | [`defenders_will.json`](../../data/stories/artifact/defenders_will.json) として収録済み（Phase 5 第1バッチ）。『燃え盛る炎の魔女』と対をなす物語。 |
| ⬜ | モンド | **風立ちの日**（`adaycarvedfromrisingwinds`） | ウェンティ・詩人少年・デカラビアン・グンヒルド | 烈風の王の時代から、ウェンティと無名の詩人少年の出会い・新モンド建国までを描く上古史。 |
| ⬜ | モンド | **氷風を彷徨う勇士**（`blizzardstrayer`） | シャール・フィンドニール（ドラゴンスパイン） | ドラゴンスパインに存在した古代王国シャール・フィンドニールの滅亡と勇士の悲劇。 |
| ⬜ | モンド | **旧貴族のしつけ**（`noblesseoblige`） | モンド旧貴族（ローレンス家ほか） | かつてモンドを支配した旧貴族の栄華と腐敗の時代背景を描く。 |
| ⬜ | モンド | **血染めの騎士道**（`bloodstainedchivalry`） | 血染めの騎士（ロランド） | 500年前の漆黒の災厄直後、魔物を討ち続けた騎士がアビスへ堕ちる物語。 |
| ⬜ | 璃月 | **来歆の余響**（`echoesofanoffering`） | 沈玉の谷・翹英荘・仙人（浮錦ほか） | 沈玉の谷の奉茶儀式や仙人たちの交流、魔神戦争期の裏話を綴る物語。 |
| ✅ | 稲妻 | **華館夢醒形骸記** | 放浪者（スカラマシュ / 傾奇者） | [`husk.json`](../../data/stories/artifact/husk.json) として収録済み（コース①対象）。たたら砂事件など放浪者の過去を綴る名作。 |
| ⬜ | 稲妻 | **雷のような怒り**（`thunderingfury`） | 鶴観の古代部族・少年ルー・雷鳥カパッチリ | 鶴観の世界任務に直結する、部族の生贄と雷鳥の怒りの悲劇。 |
| ⬜ | 稲妻 | **海染硨磲**（`oceanhuedclam`） | 海祇島の初代現人神の巫女・大御神オロバシ | 海祇の民と初代現人神の巫女、深海からの帰還を伝える島唄の記録。 |
| ⬜ | 稲妻 | **追憶のしめ縄**（`shimenawasreminiscence`） | 狐斎宮と大社の巫女・弟子たち | 漆黒の災厄以前の狐斎宮と鳴神大社をめぐる追憶。 |
| ⬜ | 稲妻 | **絶縁の旗印**（`emblemofseveredfate`） | 御輿千代・天狗・浅瀬響・岩蔵道胤 | 狐斎宮の縁者や稲妻の武人・妖たちが辿った運命のオムニバス。 |
| ⬜ | 稲妻 | **雷を鎮める尊者**（`thundersoother`） | 雷電の魔獣を討伐した古代の尊者 | 雷電の魔獣を討ち果たした人間の英雄にまつわる伝承。 |
| ✅ | スメール | **楽園の絶花**（`flowerofparadiselost`） | 花神・キングデシェレト・マハールッカデヴァータ | [`flower_of_paradise_lost.json`](../../data/stories/artifact/flower_of_paradise_lost.json) として第7バッチで収録済み。天の使いの生き残りである花神ナブ・マリカッタが砂漠に睡蓮とジンニーを生み、親友キングデシェレトのために自ら消えるまでの大河ロマン。 |
| ✅ | スメール | **金メッキの夢**（`gildeddreams`） | キングデシェレトと砂漠の諸部族 | [`gilded_dreams.json`](../../data/stories/artifact/gilded_dreams.json) として第7バッチで収録済み。『楽園の絶花』と対をなす、三神同盟の栄華からキングデシェレトの狂想と砂漠文明の衰退までを辿る叙事詩。 |
| ✅ | スメール | **砂上の楼閣の史話**（`desertpavilionchronicle`） | ジュラバド・花神の眷属（ジンニー）・キングデシェレト | [`desert_pavilion_chronicle.json`](../../data/stories/artifact/desert_pavilion_chronicle.json) として第7バッチで収録済み。羊飼いオルマズドと鎮霊リルパァールの愛憎による砂漠の古都ジュラバド滅亡と、七国分立の発端を語る長編。 |
| ⬜ | スメール | **深林の記憶**（`deepwoodmemories`） | 森林王（迷宮の王）・マハールッカデヴァータ | マハールッカデヴァータの眷属である森林王と森の知者たちの伝承。 |
| ⬜ | スメール | **花海甘露の光**（`vourukashasglow`） | 花神・草神・先代水神エゲリア・神鳥シームルグ | 漆黒の災厄時に先代水神エゲリア・霊光から生まれた神鳥シームルグを描くスメール／フォンテーヌ横断の記録。 |
| ✅ | フォンテーヌ | **水仙の夢** | 水仙十字院（アラン・ルネ・マリアン・ジェイコブ） | [`nymphsdream.json`](../../data/stories/artifact/nymphsdream.json) として第2バッチで収録済み（コース②対象）。 |
| ✅ | フォンテーヌ | **ファントムハンター** | 水仙十字院・旧ファントムハンター | [`marechausseehunter.json`](../../data/stories/artifact/marechausseehunter.json) として第2バッチで収録済み（コース②対象）。『水仙の夢』と表裏の視点から物語が立体化。 |
| ⬜ | フォンテーヌ | **黄金の劇団**（`goldentroupe`） | レムリア文明・黄金の劇団・調律師 | 沈んだ黄金の都レムリアの繁栄と没落を楽師・劇団の視点から描く。 |
| ⬜ | フォンテーヌ | **諧律奇想の断章**（`fragmentofharmonicwhimsy`） | レムリア文明・神王レムス・ボエティウス | 『黄金の劇団』と対をなす、レムリア建国から滅亡と調律師ボエティウスの物語。 |
| ✅ | ナタ | **黒曜の秘典**（`obsidiancodex`） | ナタ古史・原初の龍・夜の国 | [`obsidian_codex.json`](../../data/stories/artifact/obsidian_codex.json) として第4バッチで収録済み（コース③対象）。歴史書に記されなかったナタ古代史と大型世界任務の核心に迫る聖遺物。 |
| ⬜ | ナタ | **遂げられなかった想い**（`unfinishedreverie`） | 半人の独裁者（オチカン）・赤瞳の少年（シュバランケ）・六部族 | オシカ・ナタ時代の独裁と六部族の英雄たちをめぐる古史。 |
| ✅ | ナド・クライ | **長き夜の誓い**（`longnightsoath`） | ライトキーパー・最初のライトブリンガー | [`long_nights_oath.json`](../../data/stories/artifact/long_nights_oath.json) として第6バッチで収録済み。漆黒の夜から辺境を守り抜いたライトキーパーたちの戦いと誓い。 |
| ✅ | ナド・クライ | **月を紡ぐ夜の歌**（`silkenmoonsserenade`） | 霜月の子・詠月使・ヒュペルボレイア | [`silken_moons_serenade.json`](../../data/stories/artifact/silken_moons_serenade.json) として第6バッチで収録済み。砕けた銀の月光と霜月の子・ヒュペルボレイアにまつわる悲劇。 |
| ✅ | スネージナヤ・各国 | **蒼白の炎** | ファデュイ執行官（道化・博士・散兵・淑女・富者） | [`pale_flame.json`](../../data/stories/artifact/pale_flame.json) として収録済み（コース①対象）。執行官5名の勧誘オムニバス。 |
| ✅ | スネージナヤ・各国 | **紅血の証**（`scarletproof`） | サンドローネ・雄鶏・隊長・博士・富者 | [`scarlet_proof.json`](../../data/stories/artifact/scarlet_proof.json) として第5バッチで収録済み。アラン亡き後に雪国へ渡ったギヨタン嬢や、人間の議長に師事した『雄鶏』、辺境の孤立村での『博士』の実験と『隊長』の面談室が交錯する長編群像劇。 |
| ✅ | スネージナヤ・各国 | **影に沈む幻**（`disenchantmentindeepshadow`） | 先代氷神ツァーリ・ベールイ・白髪の学者アクシーニャ・雪の娘・コシチェイ・アルヴィス | [`disenchantment_in_deep_shadow.json`](../../data/stories/artifact/disenchantment_in_deep_shadow.json) として第5バッチで収録済み。ヒュペルボレイアの廃墟から見出された少女アクシーニャと秘密研究所「フヴェルゲルミル」の記憶。 |
| ✅ | スネージナヤ・各国 | **炉炎溶錬の心**（`heartofthefurnace`） | 小さき者イズマイール・アクシーニャ・アルヴィス大公・氷の女皇 | [`heart_of_the_furnace.json`](../../data/stories/artifact/heart_of_the_furnace.json) として第5バッチで収録済み。『影に沈む幻』と表裏をなす、弟子イズマイールの500年にわたる闇域探索と「ヴィソーキイ・ストール」創設の記録。 |

### 2.3 【武器】ガチャ限定・シリーズ横断ストーリー（8選）

| 状態 | 武器名 | 関連キャラ・テーマ | 収録・特集の狙い |
| :---: | :--- | :--- | :--- |
| ✅ | **ルミドゥースの挽歌**（＋**サーンドルの渡し守**・**超越の鍵**） | 水仙十字院の完結・派生編（マルフィサ・エドワルド・アラン＆サンドローネ） | [`lumidouceelegy.json`](../../data/stories/weapon/lumidouceelegy.json) / [`fleuvecendreferryman.json`](../../data/stories/weapon/fleuvecendreferryman.json) / [`ateaspoonoftranscendence.json`](../../data/stories/weapon/ateaspoonoftranscendence.json) として第2バッチで収録済み（※『水仙十字の剣』は `genshin-db` 本文93文字のため代替・拡張収録）。 |
| ✅ | **久遠流転の大典**（注：静水流転の輝きは本文なし） | 隠修会・先代水神エゲリア・メロピデ要塞以前 | [`tomeoftheeternalflow.json`](../../data/stories/weapon/tomeoftheeternalflow.json) として第2バッチで収録済み（※`genshin-db` 上で『静水流転の輝き』の `story` は0文字）。 |
| ✅ | **赤月のシルエット** | アルレッキーノ（召使） | [`crimson_moon.json`](../../data/stories/weapon/crimson_moon.json) として第3バッチで収録済み。書籍『ペリンヘリ』や育成素材『残火の灯燭と赤月の裁決』と直接リンクする赤月王朝時代の祭具。 |
| ✅ | **冬極の白星** | タルタリヤ・スネージナヤ（氷の女皇） | [`polar_star.json`](../../data/stories/weapon/polar_star.json) として第3バッチで収録済み。氷の女皇への忠誠とファデュイの思想が綴られた人気武器ストーリー。 |
| ✅ | **赤砂の杖** | キングデシェレト・花神・先代草神 | [`staff_of_the_scarlet_sands.json`](../../data/stories/weapon/staff_of_the_scarlet_sands.json) として第7バッチで収録済み。『金メッキの夢』の裏側となる赤砂の王本人の独白で、新世界の定理と最後の悔悟を明かす。 |
| ✅ | **聖顕の鍵** | 盲目の詩人・サイフォス・草木の主宰 | [`key_of_khaj_nisut.json`](../../data/stories/weapon/key_of_khaj_nisut.json) として第7バッチで収録済み。『赤砂の杖』と一対の王器であり、砂の王の死後に亡国の王子サイフォスが旅立つまでを描く。 |
| ✅ | **トゥライトゥーラの記憶** | サファイアの都・サイフォス・踊り子マカイラ | [`tulaytullahs_remembrance.json`](../../data/stories/weapon/tulaytullahs_remembrance.json) として第7バッチで収録済み。花神が愛した都市国家トゥライトゥーラの栄枯と悲恋を描く砂漠叙事詩の終着点。 |
| ⬜ | **祭礼シリーズ**（剣・大剣・弓・法器） | モンド旧貴族と「時間の執政」 | 身近な星4武器に隠されたモンド古代史と「時間の風（イスタロト）」の伏線。 |

### 2.4 【その他カテゴリー】既存設計に基づく拡充枠
- [x] **風の翼（`attire`）カテゴリーの初期収録**
  - Phase 5 第1バッチとして『交錯する運命の翼』『夜来泊月の翼』『樹花爛漫の翼』の3作品を収録（0件解消）。
- [ ] **突破・育成素材（`chronicle`）の連作拡充**
  - Phase 5 第1バッチとして『紅蓮の蛾と灰燼の追憶（淑女討伐録）』（`signora_chronicle`）を、第3バッチとして『残火の灯燭と赤月の裁決（召使討伐録）』（`arlecchino_chronicle`）を収録済み。今後は他の突破素材シリーズ（『凛風奔狼』等）や他週ボス素材連作を順次追加する。
