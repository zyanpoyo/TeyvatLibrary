# テイワット文庫 — 継続利用（リテンション）改善ロードマップ

本ドキュメントは、初回訪問後のユーザー離脱を防ぎ、継続的な再訪・回遊・習慣化を促すための機能拡張ロードマップの**全体設計・実装順序・各詳細仕様への索引**である。
実装時は必ず以下の設計制約を確認した上で、該当フェーズの詳細仕様ドキュメントを読み込むこと。

---

## 1. 解決する課題とアーキテクチャ制約（Guardrails）

### 解決する3つの離脱要因
1. **読書状態の揮発**: 読了記録やしおり（途中位置）が残らないため、再訪時に「どれを読んだか」「どこまで読んだか」が分からず、コレクション欲（読破率埋め）も働かない。
2. **入り口の迷子と回遊導線の単発性**: アイテム単位のカードがフラットに並んでいるため、初心者にとっては「何から読めばいいか分からない」（参考：[Yahoo!知恵袋](https://detail.chiebukuro.yahoo.co.jp/qa/question_detail/q11325217331) / [Reddit](https://www.reddit.com/r/Genshin_Impact/comments/1ogdej9/yes_this_is_hoyos_plan_literally_why_are_you/)）、読了後も「次に何を読むべきか」の目的が途切れる。
3. **再訪時の固定表示と辞書導線の不足**: 書架の特等席（`is-featured`）や並び順が常に固定されており開くたびの発見がない。また、共通人物マスタ（[`data/shared/entities.json`](../../data/shared/entities.json)）がプルダウン絞り込みにしか使われておらず、「キャラ・神・組織の背景を調べる辞書」としての再訪ニーズを取り込めていない。

### 厳守すべき設計制約
- **完全静的配信（ゼロ・バックエンド）の維持**: ランタイムサーバー・外部DB・認証機能は一切追加せず、すべてのユーザー状態はブラウザの `localStorage` で完結させる（※Phase 6 は Won't 事項）。
- **3層データモデルとの整合**: コンテンツ側の拡張（読書コース・新着日・人物名鑑データ）は [`docs/architecture/DATA_ARCHITECTURE.md`](../architecture/DATA_ARCHITECTURE.md) の3層モデル（`data/raw/` → `data/stories/` & `data/shared/` → `public/data/`）および `npm run build:data`（[`scripts/build-stories.mjs`](../../scripts/build-stories.mjs)）のビルドパイプラインに統合する。
- **ストレージ障害耐性**: [`src/state/prefs.ts`](../../src/state/prefs.ts) や [`src/state/reading-state.ts`](../../src/state/reading-state.ts) と同様、`localStorage` の読み書きは必ず `try / catch` で囲み、プライベートブラウジングやストレージ制限環境でもエラーで停止しない設計にする。

---

## 2. フェーズ別・実装順序と詳細仕様（Context Pointers）

各フェーズの詳細仕様・データスキーマ・完了条件（Completion Criteria）は、責務ごとに以下のファイルへ分割している。**担当するフェーズの仕様書のみを読み込んで実装を進めること。**

| Phase | 機能群 | 主な変更対象 | 規模 | 目的・期待効果 | 詳細仕様ドキュメント |
| :---: | :--- | :--- | :---: | :--- | :--- |
| **Phase 1**<br>*(実装済み)* | **読了スタンプ・途中しおり・未読フィルタ・読破率** | フロントエンドのみ（`src/state/`, `src/hooks/`, `src/components/`, `src/domain/`） | 小 | 読書の蓄積と再開導線を作り、再訪時の迷いをなくす | [`retention/phase1_2_reading_state.md`](retention/phase1_2_reading_state.md) |
| **Phase 2**<br>*(実装済み)* | **「今日の物語ピックアップ」・おまかせ読書・新着表示** | フロントエンド ＋ ストーリーJSONの任意フィールド拡張 | 小 | 再訪するたびに未読の短編と出会えるトリガーを作る | [`retention/phase1_2_reading_state.md`](retention/phase1_2_reading_state.md) |
| **Phase 3** | **目的別・キャラ別「フェア棚＆読書コース」** | `data/shared/courses.json` ＋ ビルドスクリプト ＋ 書架/リーダーUI | 中 | 「何から読めばいいか」の入り口提示と、3〜5部作の連続読書へ引き上げる | [`retention/phase3_curation_courses.md`](retention/phase3_curation_courses.md) |
| **Phase 4** | **「人物・用語名鑑」ビューの独立** | `scripts/build-stories.mjs` ＋ 名鑑ビューUI | 中 | ゲーム更新やガチャ復刻時に「設定確認辞書」として常用される | [`retention/phase4_5_entities_and_content.md`](retention/phase4_5_entities_and_content.md) |
| **Phase 5**<br>*(第1〜3バッチ実装済み／継続)* | **収録作品の拡充（風の翼 0件解消済み・ファデュイ/水仙十字院拡充）** | `data/raw/`, `data/stories/`, `data/shared/entities.json` | 継続 | 初回訪問での読み尽くしを防ぎ、フェア棚と人物・用語名鑑の密度を高める | [`retention/phase4_5_entities_and_content.md`](retention/phase4_5_entities_and_content.md) |
| **Phase 6**<br>*(Won't / 任意)* | **【将来構想・必須外】軽量DBによる共感ハイライト＆感情別ランキング** | Cloudflare Pages Functions + D1（またはKV） | 中〜大 | **※DBを持つため通常スコープ外（Won't）**。明示的な指示がある時のみ参照 | [`retention/phase6_dynamic_db_wont.md`](retention/phase6_dynamic_db_wont.md) |

> [!IMPORTANT]
> **Phase 6（Won't 事項）に関する実装ガードレール**
> [`retention/phase6_dynamic_db_wont.md`](retention/phase6_dynamic_db_wont.md) は将来検討用の参考構想であり、必須実装機能ではない。ユーザーから「Phase 6（DB機能）を実装して」と明示的に指示されない限り、読み込みや実装着手をしないこと。
