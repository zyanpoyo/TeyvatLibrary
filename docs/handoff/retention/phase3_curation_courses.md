# Phase 3 詳細仕様：目的別・キャラクター別「書店フェア棚＆読書コース」

「何から読めばいいか分からない」という初心者向けに、書店の特設フェアのような**目的別・キャラクター別のおすすめ棚（キュレーション導線）**を用意し、そのまま連続読書コースとして順番に読める体験を構築する。

> 前提：読了状態の照合には Phase 1（[`phase1_2_reading_state.md`](phase1_2_reading_state.md)）の `readStories` を使用する。

---

## 3.1 キュレーション棚・コース定義データ（`data/shared/courses.json` & `data/schemas/courses.schema.json`）

目的別（初心者向け入門・物語アークまとめ・キャラクター別の過去セット）で複数作品を束ねる定義ファイルを `data/shared/courses.json` に新設する。
`kind` でフェアの切り口を分類し、書架でのグループ表示やバッジ表示に利用する。

- **`kind` の分類**:
  - `"beginner"`: **目的別・必読入門棚**（例：「まずはこれ！世界観の核心に迫る必読5選」）
  - `"character"`: **キャラクター別過去セット**（例：「ロザリン（淑女）の過去がわかる聖遺物・武器セット」「放浪者の軌跡セット」）
  - `"arc"`: **地域・事件アークまとめ棚**（例：「白夜国と蛇神オロバシの悲劇」「フォンテーヌ水仙十字の物語まとめ」※収録作品追加に伴い展開）

```json
[
  {
    "id": "must_read_essentials",
    "kind": "beginner",
    "badge": "初心者おすすめ・必読入門",
    "title": "まずはこれ！テイワット核心の重要記録",
    "subtitle": "何から読むか迷った旅人への厳選コレクション",
    "hook": "原神の世界観・天理・災厄の輪郭が一気に掴める、まずは読んでおきたい必読の書籍・聖遺物・武器セット。",
    "storyIds": ["byakuyakoku", "crimson_witch", "pale_flame", "elegy", "dandelion"]
  },
  {
    "id": "rosalyne_trilogy",
    "kind": "character",
    "badge": "キャラ別・過去セット",
    "title": "ロザリン（淑女）の500年を追う聖遺物・武器セット",
    "subtitle": "歌と炎を愛した少女が『淑女』に至るまで",
    "hook": "モンドの歌姫がなぜ『炎の魔女』となり、ファデュイ執行官『淑女』へ至ったのか——表裏一体の物語を時系列で辿るセット。",
    "storyIds": ["elegy", "crimson_witch", "pale_flame"]
  },
  {
    "id": "watatsumi_orobashi",
    "kind": "arc",
    "badge": "地域・事件まとめ",
    "title": "白夜国の禁書と大蛇オロバシの物語まとめ",
    "subtitle": "海祇島・淵下宮と魔神の盟約",
    "hook": "天理の禁忌に触れた白蛇は、なぜ自ら死の宿命を受け入れて民を地上へ導いたのか。",
    "storyIds": ["byakuyakoku", "oathsworn", "distant_sea"]
  }
]
```

---

## 3.2 ビルドパイプラインの拡張（`scripts/build-stories.mjs`, `scripts/lib/validator.mjs`）

- **検証（Validator）**: `courses.json` 内のすべての `storyIds` が実在するストーリーIDであること、および `kind` が許可された値（`beginner` / `character` / `arc`）であることを検証する（不正値・存在しないIDがあれば Exit 1）。
- **コンパイル（Compiler）**: 各コースの合計文字数（`totalCharCount`）と合計読了目安時間（`totalReadingTime`）を自動算出し、`public/data/stories-index.json` のトップレベル `courses: [...]` 配列に出力する。

---

## 3.3 書架・リーダー画面でのフェア棚＆連続読書体験（`src/render/shelf.js`, `src/render/reader.js`）

1. **書架の「おすすめフェア棚（キュレーション導線）」セクション**:
   - 書架上部に書店フェアのような特集棚セクションを配置し、種別バッジ（`初心者おすすめ` / `キャラ別セット` / `物語まとめ`）付きで切り口ごとに見やすく並べる。
   - Phase 1 の `readStories` と照合して各棚の進捗（例：`2 / 3 篇 読了`）とプログレスバーを表示し、クリックでセット内の収録作品一覧・1話目へ導く。
2. **リーダー画面末尾の「次のエピソード」導線**:
   - 現在の作品がいずれかのフェア/コースに含まれている場合、章末（`#connected-container` 内または直上）に**「📚 特集『ロザリン（淑女）の500年を追う』（第1話 / 全3話） → 次の第2話『燃え盛る炎の魔女』へ進む」**カードを表示する。

---

## 3.4 Phase 3 完了条件（Completion Criteria）

- [ ] `data/shared/courses.json` に存在しない `storyId` または不正な `kind` を記述した際、`npm run validate` がエラー（Exit 1）で検知できること。
- [ ] `npm run build:data` 実行後、`public/data/stories-index.json` に `courses` 配列（`kind`・`badge`・合計読了時間・文字数付き）が出力されること。
- [ ] 書架で目的別（初心者向け）・キャラ別・事件まとめ別のフェア棚と読了進捗（`M / N 読了`）が確認でき、棚内の1作品を読み終えた章末から次の作品へ1クリックで連続遷移できること。
