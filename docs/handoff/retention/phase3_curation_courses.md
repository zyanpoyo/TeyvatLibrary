# Phase 3 詳細仕様（確定・実装済み）：目的別・キャラクター別「フェア棚＆読書コース」

「何から読めばいいか分からない」という初心者向けに、書店の特設フェアのような**フェア棚（代表展示セクション）と読書コース一覧／詳細・連続通読導線**を用意し、推奨順とネタバレなし 1 行順路ガイドに沿って辿れる体験を構築する。

> 前提：読了状態の照合には Phase 1（[`phase1_2_reading_state.md`](phase1_2_reading_state.md)）の `readStories` を使用する。

---

## 3.1 キュレーション棚・コース定義データ（`data/shared/courses.json` & `data/schemas/courses.schema.json`）

目的別（初心者向け入門・キャラクター別・地域・歴史別）で複数作品を推奨順と 1 行順路ガイド（`note`）付きで束ねる定義ファイルを `data/shared/courses.json` に配置し、収録済み全 39 作品を網羅する初期 10 コースを定義している。

- **`kind` の分類**:
  - `"beginner"`（**入門・必読**）: 厳選 4 選（`must_read_essentials`）・短編＆風の翼（`short_masterpieces`）
  - `"character"`（**キャラクター別**）: ロザリンとルースタン（`rosalyne_chronicle`）・アルレッキーノと赤月王朝（`arlecchino_crimson_moon`）・放浪者と稲妻の記憶（`wanderer_inazuma`）
  - `"arc"`（**地域・歴史別**）: テイワット創世記（`teyvat_genesis`）・水仙十字院（`narcissenkreuz_arc`）・白夜国とオロバシ（`watatsumi_orobashi`）・ナド・クライ編（`nod_krai_moonlight`）・スネージナヤ王朝史（`snezhnaya_chronicle`）
- **`featured`**: `true` の代表 3 コース（`must_read_essentials`, `rosalyne_chronicle`, `narcissenkreuz_arc`）を書架トップのフェア棚へ展示する。

```json
[
  {
    "id": "must_read_essentials",
    "kind": "beginner",
    "badge": "必読入門・厳選4選",
    "title": "まずはこれ！テイワット核心の重要記録",
    "subtitle": "空月・『日月前事』・カーンルイアを辿る入門編",
    "hook": "旅人の片割れの記憶から、三輪の空月、『日月前事』の天地創造、カーンルイア赤月王朝まで。物語の核心と伏線に繋がる必読4篇。",
    "featured": true,
    "steps": [
      {
        "storyId": "wings_of_fate",
        "note": "まずは約1分で読める風の翼から。旅人の片割れとダインスレイヴが歩んだ過去の記憶に触れます。"
      },
      {
        "storyId": "aubade_of_morning_star_and_moon",
        "note": "続いて創世の時代へ。原初の龍が昇らせた三輪の空月と、外来の降臨者を受け入れた三姉妹の記録です。"
      }
    ]
  }
]
```

※ 各コース要素では任意で `"seo": { "title": "...", "description": "..." }` も指定可能。

---

## 3.2 ビルドパイプラインの拡張（`scripts/build-stories.mjs`, `scripts/lib/story-compiler.mjs`, `scripts/lib/validator.mjs`）

- **スキーマ＆構造ゲート検証（Stage 1/2）**:
  - `data/schemas/courses.schema.json` による必須項目・`kind`（`beginner` / `character` / `arc`）・追加プロパティ禁止・パターンチェック
  - コース `id` の重複禁止、同一コース内 `steps[].storyId` の重複禁止、各テキストの空白禁止
  - 全 `steps[].storyId` の実在確認およびコース内テキスト（`badge`, `title`, `subtitle`, `hook`, `seo`, `steps[].note`）への公式コーパス／NG 表記チェック（不正時は Exit 1）
- **コンパイル出力（Stage 3）**:
  - 各コースの `storyIds`, `storyCount`, `totalCharCount`, `totalReadingTime`（`Math.max(1, Math.round(totalCharCount / 550))` から `"約N分"`）を算出し、`public/data/stories-index.json` のトップレベル `courses[]` に出力
  - あわせて各作品 `public/data/stories/<id>.json` に事前解決済み `courses: StoryCourseMembership[]` を埋め込み、直アクセス／プリレンダリング時のゼロ CLS 描画に対応

---

## 3.3 ハイブリッド画面導線・連続通読 UX・SEO/OGP/GA4

1. **書架フェア棚＆常設ナビゲーション**:
   - ヘッダー上部に `SiteNavBar`（`書架` `/` ・ `読書コース` `/courses`、将来の名鑑も見据えた常設ナビ）と `ThemeSwitcher`、フッターに `#courses-page-link` を配置。
   - 書架トップ（`ResumeBanner` 直下・`ShelfToolbar` 直上）に `FairShelf`（`#fair-shelf`）を配置し、代表 3 コースのカード（`/courses/:courseId` への単一リンク＋読了進捗 `M / N 篇 読了`）と「すべてのコースを見る（全10コース）→」リンクを表示。検索・タブ／各種フィルタ適用中は自動で非表示にする。
2. **専用静的プリレンダリングルート（`/courses` & `/courses/:courseId`）**:
   - `/courses`（[`CoursesPage.tsx`](../../../src/components/courses/CoursesPage.tsx)）: 種別フィルタピル（`すべて` / `入門・必読` / `キャラクター別` / `地域・歴史別`）と種別ごとのグループ見出し付きコース一覧。
   - `/courses/:courseId`（[`CourseDetailPage.tsx`](../../../src/components/courses/CourseDetailPage.tsx)）: コースヘッダー、全体進捗バー、未読状況に応じた動的 CTA（「第1話から読む」 / 「続き（第X話）から読む」 / 「第1話から読み直す」）、収録順ステップ一覧（ネタバレなし 1 行ガイド `note`・読了/次に読むバッジ）、コース専用シェアバー（`ShareBar`）、関連コースカード、および不正 `courseId` 向け `noindex` Not Found フォールバック。
3. **リーダー画面でのコース文脈＆所属案内（[`ReaderCourseNav.tsx`](../../../src/components/reader/ReaderCourseNav.tsx)）**:
   - `?course=<courseId>` 付き（かつその作品が該当コースに属する場合）で開いた場合、`#back-to-shelf-btn`（`← 書架へ戻る`）を維持したまま上部に `#reader-course-banner`（コース詳細リンク＋第X話/全Y話）を表示。章末（`#connected-container` 直上）に次話／前話ナビ（`?course=` 引き継ぎ）・最終話到達時の全話読破完了カードまたは他未読話ガイド・他収録コースチップを表示する（`canonical` URL と作品シェア URL は常に `/story/:storyId` へ正規化）。
   - 単品閲覧時（有効な `?course=` なし）は上部バーを出さず、章末に「この物語が収録されている読書コース」一覧カードを表示する。
4. **ADR-0007 相当 SEO / JSON-LD / 静的 OGP / GA4**:
   - `/courses`・全 `/courses/:courseId` を SSG プリレンダリングし、`sitemap.xml` へ出力。
   - `BreadcrumbList`・`CollectionPage`・`ItemList` 構造化データと、`1200×630` 静的 OGP PNG（`/og/courses.png`, `/og/course/<id>.png`、CLI `--only courses,course/<id>` 対応）をビルド時に生成。
   - GA4 に `page_view`（`course_id`）、`story_open`（`course_detail` / `course_next` / `course_prev` / `story_course_card`）、`course_share` を統合。

---

## 3.4 Phase 3 完了条件（Completion Criteria）

- [x] `data/shared/courses.json` に存在しない `storyId`、重複 ID、不正な `kind`、または公式コーパス／NG 表記違反を記述した際、`npm run validate` がエラー（Exit 1）で検知できること。
- [x] `npm run build:data` 実行後、`public/data/stories-index.json` に `courses` 配列（`kind`・`badge`・`steps`・合計読了時間・文字数付き）と、`public/data/stories/<id>.json` に解決済み `courses` 所属情報が出力されること。
- [x] 書架フェア棚・`/courses` 一覧・`/courses/:courseId` 詳細・リーダー `?course=` 連続通読および単品時所属コース表示が正常に動作し、進捗（`M / N 篇 読了`）と全話読破表示が即時連動すること。
- [x] `/courses`・全 `/courses/:courseId` の静的 HTML・SEO メタ・JSON-LD・`sitemap.xml`・`1200×630` 静的 OGP PNG が生成され、ユニットテスト（`npm test`）および Playwright E2E（`npm run test:e2e`）がハイドレーション／フックエラーなしで全件通過すること。
