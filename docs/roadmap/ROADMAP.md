# テイワット文庫 — 機能追加・優先収録ロードマップ

本ドキュメントは、[HANDOFF.md](../handoff/HANDOFF.md)・[DATA_ARCHITECTURE.md](../architecture/DATA_ARCHITECTURE.md)・[RETENTION_ROADMAP.md](../handoff/RETENTION_ROADMAP.md) に定義された拡張計画と、MVP期に向けた優先収録ラインナップ（[teyvat_bunko_mvp_lineup.md](../handoff/teyvat_bunko_mvp_lineup.md)）を統合管理するロードマップである。

---

## 1. 機能追加ロードマップ

### 1.1 読書体験・検索機能の拡張
- [x] **読了チェックマーク・しおり・進捗のローカル保存**（[`reading-state.ts`](../../src/state/reading-state.ts) / [RETENTION_ROADMAP.md](../handoff/RETENTION_ROADMAP.md) Phase 1-2 にて実装済み）
- [ ] **時代（`era`）軸での横断フィルタリング**（[HANDOFF.md](../handoff/HANDOFF.md) Step 4）
  - 「500年前の災厄」「魔神戦争」「旧貴族時代」などの時代区分で絞り込める専用フィルタを書架に追加する（現状の `ShelfFilters` はカテゴリー・読書状態・登場人物・地域・キーワード・並び順に対応）。

### 1.2 トップページ「3大特集プレイリスト」機能
複数の書籍・聖遺物・武器を横断し、読むべき順序付きで案内する特集セクションを書架トップに配置する。

- [ ] **特集UI（プレイリストカード／ステップ導線）の実装**
  - **特集①：【推しキャラ深掘り】本編では語られない「ファデュイ執行官」の過去**
    1. 聖遺物『燃え盛る炎の魔女』（収録済み：[`crimson_witch.json`](../../data/stories/artifact/crimson_witch.json)）
    2. 聖遺物『華館夢醒形骸記』（収録済み：[`husk.json`](../../data/stories/artifact/husk.json)）
    3. 聖遺物『蒼白の炎』（収録済み：[`pale_flame.json`](../../data/stories/artifact/pale_flame.json)）
    4. 書籍『ペリンヘリ』 ＆ 武器『赤月のシルエット』（未収録）
  - **特集②：【一気読み連載】フォンテーヌ「水仙十字院」の軌跡をたどる**
    1. 聖遺物『水仙の夢』（収録済み：[`nymphsdream.json`](../../data/stories/artifact/nymphsdream.json)）＆ 『ファントムハンター』（収録済み：[`marechausseehunter.json`](../../data/stories/artifact/marechausseehunter.json)）
    2. 武器『サーンドルの渡し守』（収録済み：[`fleuvecendreferryman.json`](../../data/stories/weapon/fleuvecendreferryman.json)）＆ 『超越の鍵』（収録済み：[`ateaspoonoftranscendence.json`](../../data/stories/weapon/ateaspoonoftranscendence.json)）
    3. 武器『久遠流転の大典』（収録済み：[`tomeoftheeternalflow.json`](../../data/stories/weapon/tomeoftheeternalflow.json) ※なお `genshin-db` 上で『静水流転の輝き』は本文0文字、`水仙十字の剣` は93文字の短文であることを確認）
    4. 武器『ルミドゥースの挽歌』（収録済み：[`lumidouceelegy.json`](../../data/stories/weapon/lumidouceelegy.json)）
  - **特集③：【テイワット創世記】『日月前事』から最新聖遺物まで繋がる世界の真相**
    1. 書籍『白夜国館蔵（第2巻『日月前事』）』（収録済み：[`byakuyakoku.json`](../../data/stories/book/byakuyakoku.json)）
    2. 書籍『竹林月夜』（未収録）
    3. 書籍『白姫と六人の小人』（未収録）
    4. 聖遺物『深廊の終曲』 ＆ 『黒曜の秘典』（未収録）

### 1.3 コンテンツ制作パイプラインの自動化
- [ ] **全公式テキストのローカル検索インデックス化**（[HANDOFF.md](../handoff/HANDOFF.md) Step 2）
  - `genshin-db` の全日本語データ（`characters`, `artifacts`, `weapons`, `materials`, `windgliders`, `outfits`）を横断検索できるローカルインデックスを整備する（※初期CLIとして `npm run lore:search` / `npm run lore:inspect`（[`lore-tools.mjs`](../../scripts/lore-tools.mjs)）を実装済み）。
- [ ] **開発時バッチ変換スクリプト（`scripts/enrich-story`）**（[HANDOFF.md](../handoff/HANDOFF.md) Step 2）
  - 原典テキストと抽出根拠を元に、`hook`・`preGuide`・時系列 `chapters`・`{{term_id|...}}` 注釈・`glossary`・`overallTruth`・`connected` をビルド前に半自動生成するパイプラインを構築する。

### 1.4 運用・アクセス解析基盤
- [ ] **Google Analytics によるアナリティクス追跡対応**
  - 具体的な計測仕様・実装方法は今後決定（主な検討事項：GA4 タグ／測定IDの設定方法、ハッシュルーティング `#story/<id>` 遷移を含むページビュー計測、カスタムイベント設計〔作品開封・検索・用語ガイド表示・関連作品遷移等〕、プライバシー表記・Cookie同意要否）。

---

## 2. 優先収録作品ロードマップ

### 2.1 【書籍】世界観の根幹＆入門に最適な必読書（6選）

| 状態 | 作品名（巻数） | 優先度 | 収録・特集の狙い |
| :---: | :--- | :---: | :--- |
| ✅ | **白夜国館蔵**（全5巻 / 特に第2巻『日月前事』） | ★★★ | [`byakuyakoku.json`](../../data/stories/book/byakuyakoku.json) として収録済み。天理・七龍・四つの影などテイワット創世の起点となる最重要書籍。 |
| ⬜ | **ペリンヘリ**（全2巻） | ★★★ | カーンルイア「赤月王朝」や壁炉の家、外の世界からの漂流者を扱う重要書。全2巻と短く小説として読み応えがある。 |
| ⬜ | **白姫と六人の小人**（既刊1巻〜） | ★★★ | アビスや月の三姉妹・罪人の暗喩として考察需要が高い童話。 |
| ⬜ | **イノシシプリンセス**（全7巻） | ★★☆ | 知名度は高いが未読層が多い作品。絵本風の体裁とブラックな結末のコントラストで短編としての完成度が高い。 |
| ⬜ | **テイワット観光ガイド**（全4巻） | ★★☆ | アリスによる軽快な紀行文。専門用語が少なく、ライト層の最初の1冊に適する。 |
| ⬜ | **竹林月夜**（全4巻） / **フィッシュル皇女物語** | ★★☆ | 月の三姉妹伝承を描く民話『竹林月夜』と、キャラクターファンが入りやすい『フィッシュル皇女物語』。 |

### 2.2 【聖遺物】5部位統合で読みやすくなる名作（6選）

| 状態 | 聖遺物セット名 | 関連キャラ・テーマ | 収録・特集の狙い |
| :---: | :--- | :--- | :--- |
| ✅ | **燃え盛る炎の魔女** | 「淑女」シニョーラ（ロザリン） | [`crimson_witch.json`](../../data/stories/artifact/crimson_witch.json) として収録済み。本編未描写の過去を描く代表作。 |
| ✅ | **蒼白の炎** | ファデュイ執行官（道化・博士・散兵・淑女・富者） | [`pale_flame.json`](../../data/stories/artifact/pale_flame.json) として収録済み。執行官5名の勧誘オムニバス。 |
| ✅ | **華館夢醒形骸記** | 放浪者（スカラマシュ / 傾奇者） | [`husk.json`](../../data/stories/artifact/husk.json) として収録済み。たたら砂事件など放浪者の過去を綴る名作。 |
| ✅ | **水仙の夢**（＋**ファントムハンター**） | 水仙十字院（アラン・ルネ・マリアン・ジェイコブ） | [`nymphsdream.json`](../../data/stories/artifact/nymphsdream.json) / [`marechausseehunter.json`](../../data/stories/artifact/marechausseehunter.json) として第2バッチで収録済み。表裏の視点から読むことで物語の全容が立体化。 |
| ⬜ | **楽園の絶花** ＆ **金メッキの夢** | 花神・キングデシェレト・マハールッカデヴァータ | スメール砂漠の三神の友情と破滅を描く大河ロマン。固有名詞が多く用語解説の恩恵が大きい。 |
| ⬜ | **深廊の終曲** ＆ **黒曜の秘典** | 原初の龍ニーベルンゲン・過客の少女・ナタ古史 | 天理・龍王・月の三姉妹・ナタ古史に関わる最新考察トレンド直結の聖遺物群。 |

### 2.3 【武器】ガチャ限定・シリーズ横断ストーリー（5選）

| 状態 | 武器名 | 関連キャラ・テーマ | 収録・特集の狙い |
| :---: | :--- | :--- | :--- |
| ✅ | **ルミドゥースの挽歌**（＋**サーンドルの渡し守**・**超越の鍵**） | 水仙十字院の完結・派生編（マルフィサ・エドワルド・アラン＆サンドローネ） | [`lumidouceelegy.json`](../../data/stories/weapon/lumidouceelegy.json) / [`fleuvecendreferryman.json`](../../data/stories/weapon/fleuvecendreferryman.json) / [`ateaspoonoftranscendence.json`](../../data/stories/weapon/ateaspoonoftranscendence.json) として第2バッチで収録済み（※『水仙十字の剣』は `genshin-db` 本文93文字のため代替・拡張収録）。 |
| ✅ | **久遠流転の大典**（注：静水流転の輝きは本文なし） | 隠修会・先代水神エゲリア・メロピデ要塞以前 | [`tomeoftheeternalflow.json`](../../data/stories/weapon/tomeoftheeternalflow.json) として第2バッチで収録済み（※`genshin-db` 上で『静水流転の輝き』の `story` は0文字）。 |
| ⬜ | **赤月のシルエット** | アルレッキーノ（召使） | 書籍『ペリンヘリ』と直接リンクする赤月王朝時代の祭具。書籍とのセット特集による回遊を狙う。 |
| ⬜ | **冬極の白星** | タルタリヤ・スネージナヤ（氷の女皇） | 氷の女皇への忠誠とファデュイの思想が綴られた人気武器ストーリー。 |
| ⬜ | **祭礼シリーズ**（剣・大剣・弓・法器） | モンド旧貴族と「時間の執政」 | 身近な星4武器に隠されたモンド古代史と「時間の風（イスタロト）」の伏線。 |

### 2.4 【その他カテゴリー】既存設計に基づく拡充枠
- [x] **風の翼（`attire`）カテゴリーの初期収録**
  - Phase 5 第1バッチとして『交錯する運命の翼』『夜来泊月の翼』『樹花爛漫の翼』の3作品を収録（0件解消）。
- [ ] **突破・育成素材（`chronicle`）の連作拡充**
  - Phase 5 第1バッチとして『紅蓮の蛾と灰燼の追憶（淑女討伐録）』（`signora_chronicle`）を収録済み。今後は他の突破素材シリーズ（『凛風奔狼』等）や他週ボス素材連作を順次追加する。
