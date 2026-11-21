# テイワット文庫 — 機能追加・優先収録ロードマップ

本ドキュメントは、[HANDOFF.md](../handoff/HANDOFF.md)・[DATA_ARCHITECTURE.md](../architecture/DATA_ARCHITECTURE.md)・[RETENTION_ROADMAP.md](../handoff/RETENTION_ROADMAP.md) に定義された拡張計画と、MVP期以降の優先収録ラインナップ（[teyvat_bunko_mvp_lineup.md](../handoff/teyvat_bunko_mvp_lineup.md) および追加収録候補）を統合管理するロードマップである。

---

## 1. 機能追加ロードマップ

### 1.1 読書体験・検索機能の拡張
- [x] **読了チェックマーク・途中しおり・進捗のローカル保存**（[`reading-state.ts`](../../src/state/reading-state.ts) / [RETENTION_ROADMAP.md](../handoff/RETENTION_ROADMAP.md) Phase 1-2 にて実装済み）
- [ ] **時代（`era`）軸での横断フィルタリング**（[HANDOFF.md](../handoff/HANDOFF.md) Step 4）
  - 「500年前の災厄」「魔神戦争」「旧貴族時代」などの時代区分で絞り込める専用フィルタを書架に追加する（現状の `ShelfFilters` はカテゴリー・読書状態・登場人物・用語・地域・キーワード・並び順に対応）。

### 1.2 トップページ「3大フェア棚（読書コース）」機能
複数の書籍・聖遺物・武器を横断し、読むべき順序付きで案内するフェア棚（読書コース：[`phase3_curation_courses.md`](../handoff/retention/phase3_curation_courses.md) に統合）を書架トップに配置する。

- [ ] **フェア棚／読書コース UI（`courses.json`・ステップ導線）の実装**
  - **コース①：【推しキャラ深掘り】本編では語られない「ファデュイ執行官」の過去**
    1. 聖遺物『燃え盛る炎の魔女』（収録済み：[`crimson_witch.json`](../../data/stories/artifact/crimson_witch.json)）＆ 育成素材『紅蓮の蛾と灰燼の追憶（淑女討伐録）』（収録済み：[`signora_chronicle.json`](../../data/stories/chronicle/signora_chronicle.json)）
    2. 聖遺物『華館夢醒形骸記』（収録済み：[`husk.json`](../../data/stories/artifact/husk.json)）
    3. 聖遺物『蒼白の炎』（収録済み：[`pale_flame.json`](../../data/stories/artifact/pale_flame.json)）＆ 『紅血の証』（収録済み：[`scarlet_proof.json`](../../data/stories/artifact/scarlet_proof.json)）＆ 武器『冬極の白星』（収録済み：[`polar_star.json`](../../data/stories/weapon/polar_star.json)）
    4. 書籍『ペリンヘリ』（収録済み：[`perinheri.json`](../../data/stories/book/perinheri.json)）、武器『赤月のシルエット』（収録済み：[`crimson_moon.json`](../../data/stories/weapon/crimson_moon.json)）＆ 育成素材『残火の灯燭と赤月の裁決（召使討伐録）』（収録済み：[`arlecchino_chronicle.json`](../../data/stories/chronicle/arlecchino_chronicle.json)）
    5. 書籍『スネージナヤ通史』（収録済み：[`general_history_of_snezhnaya.json`](../../data/stories/book/general_history_of_snezhnaya.json)）・『スネージナヤ通史補編』（収録済み：[`general_history_of_snezhnaya_supplement.json`](../../data/stories/book/general_history_of_snezhnaya_supplement.json)）・『蒼星フェイ史略』（収録済み：[`pale_starborn_history.json`](../../data/stories/book/pale_starborn_history.json)）＆ 聖遺物『影に沈む幻』（収録済み：[`disenchantment_in_deep_shadow.json`](../../data/stories/artifact/disenchantment_in_deep_shadow.json)）・『炉炎溶錬の心』（収録済み：[`heart_of_the_furnace.json`](../../data/stories/artifact/heart_of_the_furnace.json)）
  - **コース②：【一気読み連載】フォンテーヌ「水仙十字院」の軌跡をたどる**
    1. 聖遺物『水仙の夢』（収録済み：[`nymphsdream.json`](../../data/stories/artifact/nymphsdream.json)）＆ 『ファントムハンター』（収録済み：[`marechausseehunter.json`](../../data/stories/artifact/marechausseehunter.json)）
    2. 武器『サーンドルの渡し守』（収録済み：[`fleuvecendreferryman.json`](../../data/stories/weapon/fleuvecendreferryman.json)）＆ 『超越の鍵』（収録済み：[`ateaspoonoftranscendence.json`](../../data/stories/weapon/ateaspoonoftranscendence.json)）
    3. 武器『久遠流転の大典』（収録済み：[`tomeoftheeternalflow.json`](../../data/stories/weapon/tomeoftheeternalflow.json) ※なお `genshin-db` 上で『静水流転の輝き』は本文0文字、`水仙十字の剣` は93文字の短文であることを確認）
    4. 武器『ルミドゥースの挽歌』（収録済み：[`lumidouceelegy.json`](../../data/stories/weapon/lumidouceelegy.json)）
  - **コース③：【テイワット創世記】『日月前事』から最新聖遺物まで繋がる世界の真相**
    1. 書籍『白夜国館蔵（第2巻『日月前事』）』（収録済み：[`byakuyakoku.json`](../../data/stories/book/byakuyakoku.json)）
    2. 書籍『竹林月夜』（収録済み：[`moonlit_bamboo_forest.json`](../../data/stories/book/moonlit_bamboo_forest.json)）
    3. 書籍『白姫と六人の小人』（収録済み：[`pale_princess.json`](../../data/stories/book/pale_princess.json)）
    4. 聖遺物『深廊の終曲』（収録済み：[`deep_galleries.json`](../../data/stories/artifact/deep_galleries.json)） ＆ 『黒曜の秘典』（収録済み：[`obsidian_codex.json`](../../data/stories/artifact/obsidian_codex.json)）

### 1.3 コンテンツ制作パイプラインの自動化
- [ ] **全公式テキストのローカル検索インデックス化**（[HANDOFF.md](../handoff/HANDOFF.md) Step 2）
  - `genshin-db` の全日本語データ（`characters`, `artifacts`, `weapons`, `materials`, `windgliders`, `outfits`）を横断検索できるローカルインデックスを整備する（※初期CLIとして `npm run lore:search` / `npm run lore:inspect`（[`lore-tools.mjs`](../../scripts/lore-tools.mjs)）を実装済み）。
- [ ] **開発時バッチ変換スクリプト（`scripts/enrich-story`）**（[HANDOFF.md](../handoff/HANDOFF.md) Step 2）
  - 原典テキストと抽出根拠を元に、`hook`・`preGuide`・時系列 `chapters`・`{{term_id|...}}` 注釈・`glossary`・`overallTruth`・`connected` をビルド前に半自動生成するパイプラインを構築する。

### 1.4 運用・アクセス解析基盤
- [x] **Google Analytics によるアナリティクス追跡対応**（[ADR-0005](../adr/0005-google-analytics-and-privacy-opt-out.md) / [GA4 セットアップガイド](../guides/GOOGLE_ANALYTICS_SETUP.md)）
  - Vite 環境変数（`VITE_GA_MEASUREMENT_ID`）による有効化ガード、HashRouter 向け正規化仮想パスの手動 `page_view` 計測、7 種カスタムイベント（作品開封導線・検索・読了・用語ガイド・真相メモ・あとで読む・書架フィルタ）、およびフッター「アクセス解析について」ダイアログでの告知・即時オプトアウト切替を実装済み。

---

## 2. 優先収録作品ロードマップ

### 2.1 【書籍】世界観の根幹＆入門・重要書籍ラインナップ（12選）

| 状態 | 作品名（巻数） | 優先度 | 収録・特集の狙い |
| :---: | :--- | :---: | :--- |
| ✅ | **白夜国館蔵**（全5巻 / 特に第2巻『日月前事』） | ★★★ | [`byakuyakoku.json`](../../data/stories/book/byakuyakoku.json) として収録済み。天理・七龍・四つの影などテイワット創世の起点となる最重要書籍。 |
| ✅ | **ペリンヘリ**（全2巻） | ★★★ | [`perinheri.json`](../../data/stories/book/perinheri.json) として第3バッチで収録済み。カーンルイア「赤月王朝」や壁炉の家、外の世界からの漂流者を扱う重要書。 |
| ✅ | **白姫と六人の小人**（全7巻 ※ゲーム本編は第1巻のみ入手） | ★★★ | [`pale_princess.json`](../../data/stories/book/pale_princess.json) として第4バッチで収録済み。アビス・月の三姉妹・罪人や、夜の国と月光の森を舞台にした天理勢力との対峙構図の暗喩として考察需要が高い童話。 |
| ✅ | **スネージナヤ通史**（全2巻） | ★★★ | [`general_history_of_snezhnaya.json`](../../data/stories/book/general_history_of_snezhnaya.json) として第5バッチで収録済み。氷の女皇アナスターシャへ献上された正史であり、ヒュペルボレイア伝説と先代皇帝モノマフ（ツァーリ・ベールイ）および盟友フィリポフの旅路を描く。 |
| ✅ | **スネージナヤ通史補編**（全3巻） | ★★★ | [`general_history_of_snezhnaya_supplement.json`](../../data/stories/book/general_history_of_snezhnaya_supplement.json) として第5バッチで収録済み。モノマフ皇帝の宿敵ミスティスラフ王と異怪の獣連盟の興亡、および敗者側の一次史料『諸獣王公列伝』を収録。 |
| ✅ | **蒼星フェイ史略**（全1巻） | ★★★ | [`pale_starborn_history.json`](../../data/stories/book/pale_starborn_history.json) として第5バッチで収録済み。キーテジ会戦でのツァーリ・ベールイ誕生から、第七百九十九紀の女皇アナスターシャ戴冠・ファデュイ創設・妖精大公から人間への政権移行を描く年代記。 |
| ⬜ | **イノシシプリンセス**（全7巻） | ★★☆ | 知名度は高いが未読層が多い作品。絵本風の体裁とブラックな結末のコントラストに加え、「天の御遣い」や幻想シアターにも関わる暗喩として注目度が高い。 |
| ⬜ | **テイワット観光ガイド**（全4巻） | ★★☆ | アリスによる軽快な紀行文。専門用語が少なく、ライト層の最初の1冊に適する。 |
| ✅ | **竹林月夜**（全4巻） | ★★☆ | [`moonlit_bamboo_forest.json`](../../data/stories/book/moonlit_bamboo_forest.json) として第4バッチで収録済み。月の三姉妹伝承と白馬の仙人兹白の記憶を描く民話。 |
| ⬜ | **フィッシュル皇女物語** | ★★☆ | キャラクターファンが入りやすい幻想小説シリーズ。 |
| ⬜ | **プシュパの歌**（全3巻 / `scroll_of_streaming_song`） | ★★☆ | スメール砂海遺跡から出土した古代断片。マハールッカデヴァータと花神による、知恵・天理のルール・文明の本質をめぐる哲学的問答集。 |
| ⬜ | **砕夢奇珍**（全4巻 / `hearts_desire`） | ★☆☆ | テイワット各国で流行する、何もない骨董店で起きた出来事を綴る幻想物語集。 |
| ⬜ | **絶雲紀聞**（全6巻 / `records_of_jueyun`） | ★☆☆ | 璃月の民俗・怪奇・上古伝説全集（石獣・海神宮ほか）。璃月世界観の掘り下げに適する。 |

### 2.2 【聖遺物】5部位統合で読みやすくなる名作（テーマ・地域別 / 全31作品）

| 状態 | 地域・テーマ | 聖遺物セット名 | 関連キャラ・テーマ | 収録・特集の狙い |
| :---: | :--- | :--- | :--- | :--- |
| ✅ | 創世記・高天・月 | **深廊の終曲**（`finaleofthedeepgalleries`） | 原初の龍ニーベルンゲン・過客の少女・極北古史 | [`deep_galleries.json`](../../data/stories/artifact/deep_galleries.json) として第4バッチで収録済み（コース③対象）。天理・龍王・月の三姉妹・北国の古文明に関わる最新考察トレンド直結の聖遺物。 |
| ⬜ | 創世記・高天・月 | **暁の星と月の歌**（`aubadeofmorningstarandmoon`） | 月の三姉妹・空月・統一文明時代 | 三つの空月を中心とした統一文明時代から終焉までの神話を描く創世記テキスト。 |
| ⬜ | 創世記・高天・月 | **天からの贈り物**（`celestialgift`） | 最初の天の御使・高天への反逆 | 高天から御使へ授けられた贈り物と、最初の御使が天理へ反逆するまでの経緯を描く。 |
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
| ⬜ | スメール | **楽園の絶花**（`flowerofparadiselost`） | 花神・キングデシェレト・マハールッカデヴァータ | スメール砂漠の三神の友情と破滅を描く大河ロマン。固有名詞が多く用語解説の恩恵が大きい。 |
| ⬜ | スメール | **金メッキの夢**（`gildeddreams`） | キングデシェレトと砂漠の諸部族 | 『楽園の絶花』と対をなす、キングデシェレトの夢と砂漠文明の変遷。 |
| ⬜ | スメール | **砂上の楼閣の史話**（`desertpavilionchronicle`） | ジュラバド・花神の眷属（ジンニー）・キングデシェレト | 砂漠の古都ジュラバドの滅亡と花神の眷属ジンニーの裏話を語る長編。 |
| ⬜ | スメール | **深林の記憶**（`deepwoodmemories`） | 森林王（迷宮の王）・マハールッカデヴァータ | マハールッカデヴァータの眷属である森林王と森の知者たちの伝承。 |
| ⬜ | スメール | **花海甘露の光**（`vourukashasglow`） | 花神・草神・先代水神エゲリア・神鳥シームルグ | 漆黒の災厄時に先代水神エゲリア・霊光から生まれた神鳥シームルグを描くスメール／フォンテーヌ横断の記録。 |
| ✅ | フォンテーヌ | **水仙の夢** | 水仙十字院（アラン・ルネ・マリアン・ジェイコブ） | [`nymphsdream.json`](../../data/stories/artifact/nymphsdream.json) として第2バッチで収録済み（コース②対象）。 |
| ✅ | フォンテーヌ | **ファントムハンター** | 水仙十字院・旧ファントムハンター | [`marechausseehunter.json`](../../data/stories/artifact/marechausseehunter.json) として第2バッチで収録済み（コース②対象）。『水仙の夢』と表裏の視点から物語が立体化。 |
| ⬜ | フォンテーヌ | **黄金の劇団**（`goldentroupe`） | レムリア文明・黄金の劇団・調律師 | 沈んだ黄金の都レムリアの繁栄と没落を楽師・劇団の視点から描く。 |
| ⬜ | フォンテーヌ | **諧律奇想の断章**（`fragmentofharmonicwhimsy`） | レムリア文明・神王レムス・ボエティウス | 『黄金の劇団』と対をなす、レムリア建国から滅亡と調律師ボエティウスの物語。 |
| ✅ | ナタ | **黒曜の秘典**（`obsidiancodex`） | ナタ古史・原初の龍・夜の国 | [`obsidian_codex.json`](../../data/stories/artifact/obsidian_codex.json) として第4バッチで収録済み（コース③対象）。歴史書に記されなかったナタ古代史と大型世界任務の核心に迫る聖遺物。 |
| ⬜ | ナタ | **遂げられなかった想い**（`unfinishedreverie`） | 半人の独裁者（オチカン）・赤瞳の少年（シュバランケ）・六部族 | オシカ・ナタ時代の独裁と六部族の英雄たちをめぐる古史。 |
| ⬜ | ナド・クライ | **長き夜の誓い**（`longnightsoath`） | ライトキーパー・最初のライトブリンガー | 漆黒の夜から辺境を守り抜いたライトキーパーたちの戦いと誓い。 |
| ⬜ | ナド・クライ | **月を紡ぐ夜の歌**（`silkenmoonsserenade`） | 霜月の子・詠月使・ヒュペルボレイア | 砕けた銀の月光と霜月の子・ヒュペルボレイアにまつわる悲劇。 |
| ✅ | スネージナヤ・各国 | **蒼白の炎** | ファデュイ執行官（道化・博士・散兵・淑女・富者） | [`pale_flame.json`](../../data/stories/artifact/pale_flame.json) として収録済み（コース①対象）。執行官5名の勧誘オムニバス。 |
| ✅ | スネージナヤ・各国 | **紅血の証**（`scarletproof`） | サンドローネ・雄鶏・隊長・博士・富者 | [`scarlet_proof.json`](../../data/stories/artifact/scarlet_proof.json) として第5バッチで収録済み。アラン亡き後に雪国へ渡ったギヨタン嬢や、人間の議長に師事した『雄鶏』、辺境の孤立村での『博士』の実験と『隊長』の面談室が交錯する長編群像劇。 |
| ✅ | スネージナヤ・各国 | **影に沈む幻**（`disenchantmentindeepshadow`） | 先代氷神ツァーリ・ベールイ・白髪の学者アクシーニャ・雪の娘・コシチェイ・アルヴィス | [`disenchantment_in_deep_shadow.json`](../../data/stories/artifact/disenchantment_in_deep_shadow.json) として第5バッチで収録済み。ヒュペルボレイアの廃墟から見出された少女アクシーニャと秘密研究所「フヴェルゲルミル」の記憶。 |
| ✅ | スネージナヤ・各国 | **炉炎溶錬の心**（`heartofthefurnace`） | 小さき者イズマイール・アクシーニャ・アルヴィス大公・氷の女皇 | [`heart_of_the_furnace.json`](../../data/stories/artifact/heart_of_the_furnace.json) として第5バッチで収録済み。『影に沈む幻』と表裏をなす、弟子イズマイールの500年にわたる闇域探索と「ヴィソーキイ・ストール」創設の記録。 |

### 2.3 【武器】ガチャ限定・シリーズ横断ストーリー（5選）

| 状態 | 武器名 | 関連キャラ・テーマ | 収録・特集の狙い |
| :---: | :--- | :--- | :--- |
| ✅ | **ルミドゥースの挽歌**（＋**サーンドルの渡し守**・**超越の鍵**） | 水仙十字院の完結・派生編（マルフィサ・エドワルド・アラン＆サンドローネ） | [`lumidouceelegy.json`](../../data/stories/weapon/lumidouceelegy.json) / [`fleuvecendreferryman.json`](../../data/stories/weapon/fleuvecendreferryman.json) / [`ateaspoonoftranscendence.json`](../../data/stories/weapon/ateaspoonoftranscendence.json) として第2バッチで収録済み（※『水仙十字の剣』は `genshin-db` 本文93文字のため代替・拡張収録）。 |
| ✅ | **久遠流転の大典**（注：静水流転の輝きは本文なし） | 隠修会・先代水神エゲリア・メロピデ要塞以前 | [`tomeoftheeternalflow.json`](../../data/stories/weapon/tomeoftheeternalflow.json) として第2バッチで収録済み（※`genshin-db` 上で『静水流転の輝き』の `story` は0文字）。 |
| ✅ | **赤月のシルエット** | アルレッキーノ（召使） | [`crimson_moon.json`](../../data/stories/weapon/crimson_moon.json) として第3バッチで収録済み。書籍『ペリンヘリ』や育成素材『残火の灯燭と赤月の裁決』と直接リンクする赤月王朝時代の祭具。 |
| ✅ | **冬極の白星** | タルタリヤ・スネージナヤ（氷の女皇） | [`polar_star.json`](../../data/stories/weapon/polar_star.json) として第3バッチで収録済み。氷の女皇への忠誠とファデュイの思想が綴られた人気武器ストーリー。 |
| ⬜ | **祭礼シリーズ**（剣・大剣・弓・法器） | モンド旧貴族と「時間の執政」 | 身近な星4武器に隠されたモンド古代史と「時間の風（イスタロト）」の伏線。 |

### 2.4 【その他カテゴリー】既存設計に基づく拡充枠
- [x] **風の翼（`attire`）カテゴリーの初期収録**
  - Phase 5 第1バッチとして『交錯する運命の翼』『夜来泊月の翼』『樹花爛漫の翼』の3作品を収録（0件解消）。
- [ ] **突破・育成素材（`chronicle`）の連作拡充**
  - Phase 5 第1バッチとして『紅蓮の蛾と灰燼の追憶（淑女討伐録）』（`signora_chronicle`）を、第3バッチとして『残火の灯燭と赤月の裁決（召使討伐録）』（`arlecchino_chronicle`）を収録済み。今後は他の突破素材シリーズ（『凛風奔狼』等）や他週ボス素材連作を順次追加する。
