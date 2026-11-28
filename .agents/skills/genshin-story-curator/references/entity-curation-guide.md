# エンティティ設計・昇格・連携ガイド（`entities.json`）

新しい物語の収録時および既存データの見直し時に、5 種別すべてのエンティティを過不足なく [`data/shared/entities.json`](../../../../data/shared/entities.json) へ整理・連携するための詳細ルール。

---

## 1. 5 種別（`kind`）の分類基準

[`src/domain/entity-kinds.ts`](../../../../src/domain/entity-kinds.ts) および [`data/schemas/entities.schema.json`](../../../../data/schemas/entities.schema.json) で定義された以下の 5 種別から、対象の本質に最も合うものを 1 つ選ぶ。

| `kind` | 表示名 | 対象範囲 | 代表例 |
| :--- | :--- | :--- | :--- |
| `character` | 人物 | 固有名を持つ人物・人間以外の個体（七神以外の仙人・魔物・ファデュイ執行官等） | `rosalyne`, `dainsleif`, `pierro` |
| `god` | 魔神・執政 | 七神・魔神・天の使い・執政・原初の龍王など神格を有する存在 | `zhongli`, `istaroth`, `nabu_malikata` |
| `organization` | 組織 | 組織化された集団・国家機関・軍団・学派・結社・孤児院 | `fatui`, `akademiya`, `marechaussee_phantom`, `narzissenkreuz_institute` |
| `concept` | 歴史・重要用語 | 種族総称・天理や世界法則・歴史的災厄・特異現象・王朝体制 | `abyss`, `forbidden_knowledge`, `celestial_nail`, `fae`, `black_sun_dynasty` |
| `place` | 地域・地名 | 物語の核心となる古代国家・滅亡都市・特殊領域・固有拠点 | `khaenriah`, `enkanomiya`, `hyperborea`, `eternal_oasis`, `poisson` |

### 境界ケースの判定ルール
1. **国家・都市（`place`） vs 王朝・体制（`concept`）**:
   - 地理的領域・都市遺跡・独立圏は `place`（例：`khaenriah` / `hyperborea` / `enkanomiya`）。
   - 特定時代の統治体制や血統区分は `concept`（例：`black_sun_dynasty`）。
2. **組織（`organization`） vs 種族総称（`concept`）**:
   - 指揮系統や所属枠を持つ集団・軍勢は `organization`（例：`frostmoon_scions` / `lightkeepers` / `winter_covenant`）。
   - 生物学的・神話的な種族区分そのものは `concept`（例：`fae` / `seelie` / `jinn`）。
3. **一般地域との棲み分け**:
   - 七国などの広域地名（`モンド` / `璃月` / `フォンテーヌ` 等）は書架の `region` フィルタが担うため、`place` エンティティには登録しない。

---

## 2. 昇格基準と表記統合（名寄せ）

1. **昇格基準**:
   - 原則として **2 作品以上にまたがって物語理解の軸になる対象** を `entities.json` へ昇格させる。
   - 単独作品のみの登場であっても、今後他作品と接続し得る中核機関・重要領域（例：`水仙十字院`・`壁炉の家`）で解説価値が高いものは昇格対象とする。
   - 一度きりの脇役・固有アイテム・局所地名は作品ローカルの `glossary` に留め、書架フィルタ `#entity-filter` の肥大化を防ぐ。
2. **別名・旧称の統合と分離**:
   - 同一対象の別訳・旧称・通称は `主名（別名）` として 1 エントリへ統合する（例：`アビス（深淵）`、`淵下宮（白夜国）`、`キッチェヴ（キーテジ）`、`黒日王朝（赤月王朝）`）。
   - 発生源や物語上の役割が独立している対象は安易に統合せず別エントリにする（例：`アビス（深淵）` と `禁忌の知識`、`カーンルイア` と `黒日王朝（赤月王朝）`）。

---

## 3. 既存作品とのクロスリンク・最小タグ付け原則

1. **既存 `glossary` の優先接続**:
   - 新規エンティティを追加したら、既存の全 [`data/stories/`](../../../../data/stories/) で同対象を解説しているローカル用語を探し、重複解説を増やさず `entityId` を接続する。
   - 作品文脈特有の補足が残る場合は `identityOverride` / `descOverride` / `evidenceOverride` を併用し、既存解説の文意を失わないようにする。
2. **未タグ原文への最小限タグ付与**:
   - 既存作品本文に対象語が素のまま出現している場合は、原則として **1 作品あたり初出または最も象徴的な 1 箇所のみ** に `{{key|原文そのまま}}` を付与する。
   - 既存の `{{...|...}}` と入れ子にせず、素の記述箇所を選ぶ（原文の 1 文字一致検証を厳守）。
   - すでにある別人物・別事項の注釈を上書きして置き換えない。

---

## 4. 作業後の必須検証チェックリスト

- [ ] `entities.json` の追加エントリに `name`, `kind`, `defaultIdentity`（`正体：` / `解説：` / `有力説：` のいずれか）, `defaultDesc`, `defaultEvidence` が揃っている。
- [ ] `npm run validate` で **エラー 0 件** かつ **`[未使用エンティティ]` 警告が 0 件** である。
- [ ] `npm run validate` の `⚠️ [エンティティ未連携候補]` 出力を確認し、主要作品での紐付け漏れが残っていない。
- [ ] `npm run build:data` 実行後、`public/data/stories-index.json` の `entitiesIndex` に該当エンティティ（`defaultIdentity`・`defaultDesc`・`defaultEvidence`・`evidenceLinks` 等）が出力されている。
- [ ] 名鑑一覧や個別シェアに影響する追加・変更を行った場合、`npm run build:og -- --only entities,entity/<entityId> --force` で生成画像に文字欠け・崩れがないことを確認する。
