# Phase 4 & 5 詳細仕様：「登場人物・神・組織名鑑」ビュー＆収録作品の継続拡充

本仕様は、共通人物マスタ（[`data/shared/entities.json`](../../../data/shared/entities.json)）を設定確認辞書として活用する **Phase 4（名鑑ビュー）** と、機能実装後のコンテンツ拡充指針である **Phase 5（作品追加の優先順位）** を定義する。

---

## Phase 4: 「登場人物・神・組織名鑑（Entities Archive）」ビューの独立

### 4.1 インデックス出力の拡張（`scripts/build-stories.mjs`）
- 現在 `public/data/stories-index.json` の `entitiesIndex` には `{ name, kind, storyIds }` のみが出力されている。
- ここに [`data/shared/entities.json`](../../../data/shared/entities.json) の `defaultIdentity`・`defaultDesc`・`defaultEvidence`・`evidenceLinks`（ビルド時自動解決）を含めて出力する。

### 4.2 名鑑ビューUIの実装（`index.html`, `src/render/entities.js`, `src/main.js`）
- 書架上部のナビゲーションまたはタブから切り替えられる「人物・用語名鑑」ビュー（またはドロワー／モーダル）を追加する。
- 種別（`character`: 人物 / `god`: 魔神・執政 / `organization`: 組織 / `concept`: 歴史・重要用語 / `place`: 地域・地名）でグルーピングまたは絞り込み表示する。
- 各人物カードには以下を表示する:
  - 名称（`name`）と正体（`defaultIdentity`）
  - 背景解説（`defaultDesc`）と出典リンク（`defaultEvidence`）
  - **登場する物語リスト（`storyIds`）**: 作品タイトル・カテゴリー・読了バッジ（`✦ 読了`）を表示し、クリックで該当作品のリーダー画面へ直接遷移する。

### 4.3 Phase 4 完了条件（Completion Criteria）
- [ ] `entities.json` に登録された全エンティティの解説と出典リンク、および関連作品リストが名鑑ビューから閲覧できること。
- [ ] 名鑑内の関連作品リンクおよび出典リンク（`evidenceLinks`）をクリックすると、該当作品のリーダー画面へ遷移すること。

---

## Phase 5: 収録作品の継続拡充（コンテンツ密度の向上）

機能が揃った段階で、初回訪問での読み尽くしを防ぎ書店フェア棚・人物名鑑の網羅性を高めるため、[`.agents/skills/genshin-story-curator/SKILL.md`](../../../.agents/skills/genshin-story-curator/SKILL.md) のワークフローに従って以下の優先順位で作品を追加する。

1. **「風の翼（`attire`）」カテゴリーの0件解消（最優先）**:
   - `npm run extract-raw -- --type windglider --id <rawId>` を使用し、『運命の星が交錯する翼』『守月の翼』『森と花と風の翼』等の長文ストーリーを持つ風の翼を2〜3作品追加して、全5分類タブすべてに作品を揃える。
2. **既存コース・書店フェア棚の拡充とミッシングリンク補完**:
   - **キャラ別過去セットの拡充**: ロザリン関連の完結編となる週ボス育成素材3種連作（『溶滅の刻』『獄火の蝶』『灰燼の心』＝ `signora_chronicle`）や、放浪者（スカラマシュ）関連の武器・聖遺物（『神楽の真意』『砂上の楼閣の史話』等）を追加し、キャラ別フェア棚と Phase 4 の人物名鑑の厚みを増す。
   - **大型テーマまとめ棚の整備**: 「フォンテーヌ水仙十字の物語まとめ」（聖遺物『水仙の夢』・武器『水仙十字の剣』・関連書籍等）や「必読の重要書籍5選」を成立させる書籍・聖遺物を順次収録し、Phase 3（[`phase3_curation_courses.md`](phase3_curation_courses.md)）の `courses.json` に新規フェア棚として追加する。
