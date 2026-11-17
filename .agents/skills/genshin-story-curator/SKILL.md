---
name: genshin-story-curator
description: >-
  原神の書籍・武器・聖遺物・風の翼・突破育成素材ストーリーのローカル抽出（npm run extract-raw）、代名詞・用語のクロスリファレンス特定、時系列順の章再構成、entities.json 連携、および検証・配信ビルド（npm run build:data）を行う手順。新しいストーリーデータの追加、原神テキストの構造化・注釈付与、または作品間リンクの更新時に使用する。
---

# Genshin Story Curator（原神ストーリー抽出・構造化・検証手順）

原神のゲーム内長文データ（書籍・聖遺物・武器・風の翼・突破育成素材）を抽出し、**原文を一字一句改変せずに**前提ガイド・インライン用語解説・真相メモ・作品間リンク付きの本番データ（[`data/stories/`](../../../data/stories/)）へ編纂する手順。

スキーマ定義・ビルド仕様の正本は [`data/schemas/story.schema.json`](../../../data/schemas/story.schema.json) と [`docs/architecture/DATA_ARCHITECTURE.md`](../../../docs/architecture/DATA_ARCHITECTURE.md) を参照する。

---

## Step 1: 原典データの選定と抽出（`data/raw/`）

種別に応じた取得元から無加工のスナップショットを抽出する。

| `sourceType` | `shelfCategory` | 取得元 | 抽出コマンド・注意点 |
| :--- | :--- | :--- | :--- |
| `artifact` | `artifact` | `node_modules/genshin-db` | `npm run extract-raw -- --type artifact --id <rawId>` |
| `weapon` | `weapon` | `node_modules/genshin-db` | 同上（一部武器に `story` 欠落・極短文があるため抽出後に本文長を確認） |
| `windglider` | `attire` | `node_modules/genshin-db` | 同上（`{M#...}{F#...}` 性別分岐記法が含まれる場合あり） |
| `material` | `chronicle` | `node_modules/genshin-db` | 同上（複数段階・週ボス3種を1冊に束ねる） |
| `book` | `book` | `node_modules/genshin-data` ＋ **Yatta Readable API** | 同上（`https://gi.yatta.moe/api/v2/jp/...` への外部HTTP通信が発生するため、実行前にネットワーク利用可否を確認する） |

### 実行ルール
1. **`rawId` の実物確認**: `genshin-db` のキーはスペース・記号なしの連結小文字（例：`moltenmoment`, `hellfirebutterfly`, `defenderswill`）であり、資料上の仮名称や旧翻訳と異なる場合がある。抽出前に `node_modules/genshin-db` 内の正確な `rawId` と日本語正式名称を確認する。
2. **本文長トリアージ（事前確認）**: 公式データには `story` が未収録（0字）や 100字未満の極短文アイテム（例：`静水流転の輝き` 0字、`水仙十字の剣` 93字）が存在する。執筆着手前に `data/raw/` の本文量を確認し、不足する場合は別作品の章へ統合するか同シリーズの他長文作品へ構成を見直す。
3. **コーパス更新**: 新しい書籍（Yatta API 経由）を追加した時や `genshin-db` / `genshin-data` を更新した時は、以下を実行して [`data/shared/official-corpus.json`](../../../data/shared/official-corpus.json) に反映する。
   ```bash
   npm run sync-corpus
   ```

- **完了条件**: 対象アイテムの無加工JSONが `data/raw/<sourceType>/<rawId>.json` に保存され、収録に足る本文・`description` が欠落なく存在すること。

---

## Step 2: 時系列・連作の章立て（`chapters[]` と `sourceRef`）

ゲーム内の並びは物語の時系列と一致しないことが多いため、読者が小説として自然に追える章順へ再構成する。

1. **聖遺物（全5章）**: 部位順（花→羽→砂→杯→冠）に固定せず、5部位を読んで「発端→転機→結末」の時系列順、またはオムニバスとして最も明快な順に並べる。`partLabel` に元の部位名（例：`第一章（死の羽：守護の印）`）を残す。
2. **突破・育成素材（`chronicle`）**: 突破素材4段階または週ボス素材3種を、レア度順または時系列順に各幕へ配置する。
3. **書籍（`book`）**: 長大な巻は `sourceRef.paragraphSlice: [start, end]` で前半・後半へ分割して読了負荷を下げる。

### 原文一致のための記述ルール
- **誤字・旧字体・装飾タグの扱い**: 原典に誤字・脱字（例：`悪を追い払っい、`）や旧字体（`惡`・`蠟燭`）があっても修正せずそのまま保持し、読み方の補足が必要な場合は `glossary` や `chapterNote` で補う。また `<br/>`・`<color>`・`<span>` はビルド検証時に自動正規化されるため、`paragraphs` 側へHTMLタグを書かない。
- **`stripPrefix` は実ファイルからそのまま指定する**: 同一シリーズでも定型文が1文字異なる場合（例：`手に入れた` vs `獲得した`）があるため、必ず抽出した `data/raw/` ファイルの文字列をそのまま `sourceRef.stripPrefix` に指定する。
- **空行分割と改行保持**: 原典内の空行（`\n\n`）単位で `paragraphs` 配列の要素を分割し、段落内の単一改行（`\n`）のみ文字列内に保持する。
- **性別分岐記法 `{M#...}{F#...}`**: JSON 原文では無改変のまま保持する（フロントエンド描画時に [`src/domain/text-parser.ts`](../../../src/domain/text-parser.ts) が `彼女／彼` のように展開する）。

- **完了条件**: 全章に `sourceRef`・`partLabel`・`heading`・`epigraph`・`paragraphs` が揃い、改行や `stripPrefix` が原典と対応していること。

---

## Step 3: 人物特定・マスタ連携・注釈執筆（`entities.json` & `glossary`）

伏せられた代名詞や歴史用語をクロスリファレンスで特定し、3段階の読書補助に配置する。照合パターンと現行JSON記述例は [`references/cross-reference-patterns.md`](./references/cross-reference-patterns.md) を参照する。

1. **`preGuide`（ネタバレなし3行導入）**: 「時代・舞台」「主人公の立場」「章構成・読みどころ」のみを記し、正体や結末は書かない。
2. **`{{term_id|原文そのまま}}` と `glossary`**:
   - `|` の右側は原典の表記・送り仮名を1文字も変更しない。性別分岐記法（`{M#彼女}{F#彼}`）が文中に現れる場合は、分岐記法の外側・直前にある名詞や称号（例：`{{wf_twin|金髪の王}}`）へタグを付与し、読みやすさと保守性を保つ（入れ子になっても `text-parser.ts` 側で展開可能）。
   - **`entities.json` 登録基準と既存漏れ点検**: 物語の核となる主要人物・神格・組織・概念は初出時から [`data/shared/entities.json`](../../../data/shared/entities.json) へ登録し、`entityId` で参照する（場面に応じた補足は `identityOverride` / `descOverride` / `evidenceOverride` で上書き）。他作品の主軸にならないゲスト言及は作品ローカルの `glossary` に留め、書架プルダウンの肥大化を防ぐ。あわせて、同じ人物が登場する既存の収録作品に `entityId` の紐付け漏れがないか点検する。
   - **必須フォーマット**:
     - `identity` は必ず **`正体：` / `真名：` / `鳴神名：` / `解説：` / `有力説：`** のいずれかで始める（公式未明言の考察は必ず `有力説：` を使用）。
     - `evidence` に裏付けとなる公式出典名を必ず記載する。
3. **公式コーパス適合の執筆方針**:
   - `npm run validate` は本文だけでなく `hook`・`preGuide`・`overallTruth`・`tags`・`glossary`・`connected` 内のすべてのカタカナ語を検査する。
   - 一般カタカナ語（例：`テキスト`・`モチーフ`・`ニュアンス` 等）は未登録エラーになりやすいため、解説文は原則として和語・漢字（「公式記録」「題材」「意味合い」等）で執筆し、不可避の一般語・公式メディア語のみ [`data/shared/official-entities.json`](../../../data/shared/official-entities.json) の `allowedCommonKatakana` / `officialMediaTerms` へ最小限追加する（`ngVariants` 記載の誤記・旧訳も使用しない）。
4. **`overallTruth`（真相・考察メモ）**: 読了後のネタバレ開示と他作品との接続を簡潔にまとめる。

- **完了条件**: すべての `{{term_id|...}}` が `glossary` と過不足なく対応し、タグ除去後の文字列が原典と1文字の狂いもなく一致すること。

---

## Step 4: 作品間リンク（`connected` / `evidenceLinks`）と新着日設定

1. **双方向 `connected` リンク**:
   - 表裏視点・前後譚・同時代群像として繋がる作品へ `connected` エントリを追加する。
   - 新規作品側で `targetId`, `relation`, `desc`, `reverseRelation`, `reverseDesc` を定義すると、ビルド時にリンク先作品の配信JSONへ逆リンクが自動展開される（リンク先に既に明示定義がある場合はそちらが優先）。
2. **`evidenceLinks` 自動リンク対応の『作品名』記法**:
   - [`scripts/build-stories.mjs`](../../../scripts/build-stories.mjs) は、`evidence` 内の `『タイトル』` が収録済み作品の `title`（または末尾 `（...）` を除いたベースタイトル）と**完全一致**した場合のみクリック可能なリンクを生成する（引用側の `『...』` 内にある `（...）` は除去されない）。
   - 部位名・巻名・素材名を併記する場合は、`『守護の心（守護の座時計）』` や `『紅蓮の蛾と灰燼の追憶（溶滅の刻）』` のように括弧を内側に入れず、**`『守護の心』（守護の座時計）`** や **`『紅蓮の蛾と灰燼の追憶』（溶滅の刻）`** のように補足情報を `『』` の外に出す。
   - 新規追加によって既存の収録済み作品の `evidence` が出典リンク可能になった場合は、既存作品の `evidence` 表記もあわせて整える。
3. **新着日（`addedAt`）の付与**:
   - 新規ストーリーには `"addedAt": "YYYY-MM-DD"` を設定し、書架の「新着順」ソートおよび14日間・未読時の `NEW` バッジ対象にする。
   - 作品数・カテゴリー件数はビルド時に自動集計されるため、UI側の手動カウント更新は不要。

- **完了条件**: 関連作品間の相互リンクと `evidenceLinks` がリンク切れなく解決でき、`addedAt` が有効なISO日付であること。

---

## Step 5: ガードレール検証と配信JSONビルド（必須）

データ作成・編集後は、検証および配信層（`public/data/`）の再生成を実行する。

```bash
npm run validate
npm run build:data
```

### エラー検出時の対処
- **`[原文不一致]`**: `data/raw/` と照合し、段落分割（`\n\n` と `\n`）、`stripPrefix` の1文字差異、タグ内文字列の改変を修正する。
- **`[NG固有名詞検出]`**: メッセージで示された公式表記（例：`ツァーリツァ` → `氷の女皇`、`ロストム` → `ルースタン`）へ修正する。
- **`[公式コーパス未登録カタカナ]`**: サジェストの公式表記に合わせるか、解説文を和語・漢字へ言い換える。公式テキストに存在しない正当なメディア由来語・必須一般語のみ [`data/shared/official-entities.json`](../../../data/shared/official-entities.json) へ追加する。
- **`[出典根拠欠落]` / `[確度区分欠落]`**: 該当 `glossary`（または `entities.json`）に `evidence` と5種プレフィックスを補う。

- **完了条件**: `npm run validate` および `npm run build:data` が終了コード `0` で成功し、[`public/data/stories-index.json`](../../../public/data/stories-index.json) に追加作品の件数・`entityIds`・`evidenceLinks` が正しく反映されていること（ロードマップや設計書の進捗に影響する場合は [`doc-sync`](../doc-sync/SKILL.md) スキルに従って更新対象を確認する）。
