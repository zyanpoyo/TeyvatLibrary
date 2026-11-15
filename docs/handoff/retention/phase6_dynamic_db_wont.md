# 【Phase 6 / Won't 事項】軽量DB導入による動的機能プラン（必須実装対象外）

> [!IMPORTANT]
> **AIエージェントへの厳守事項（実装ガードレール）**
> 本ドキュメント（Phase 6）は**「DB（バックエンド状態管理）を持つことになるため、現時点では実装しない（Won't / 将来検討枠）」**として記録している構想案である。
> 通常の機能開発（Phase 1〜5）では「完全静的サイト＋`localStorage`」の原則を厳守し、**ユーザーから「Phase 6（DB機能）を実装して」と明示的に指示されない限り、本ドキュメントの実装には一切着手しないこと。**

将来、静的サイト（Phase 1〜5）の施策だけではPV・SNS流入が頭打ちになり、最小限のDB導入を許容する判断をした場合は、以下の「維持費0円・個人情報ゼロ・荒らし監視ゼロ」の仕様で実装する。

---

## 6.1 採用インフラとコスト・リスク制御の鉄則

1. **インフラ構成（維持費0円）**:
   - **Cloudflare Pages + Pages Functions + Cloudflare D1（サーバーレスSQLite）** を採用する。
   - ランキングやハイライト集計のGET APIには必ず `Cache-Control: public, s-maxage=300`（CDNエッジ5分キャッシュ）を付与し、SNSバズ時のDB読み取りクォータ消費とクラウド破産リスクを遮断する。
2. **個人情報・認証の非保持（ログイン不要）**:
   - メールアドレス・パスワード・外部SNSログイン等の認証情報は一切持たない。
   - 重複投票防止はクライアント側の `localStorage` トークンと、サーバー側での日次ソルト付きIPハッシュ（`SHA-256(ip + daily_salt)`）のみで処理する。
3. **自由記述テキストの全面禁止（荒らし・ネタバレ監視負荷ゼロ）**:
   - コメント欄や掲示板などの自由入力文字列はDBに一切保存しない。
   - DBが受け付けるのは**「既存の `story_id`・段落インデックス・定型リアクション種別に対する整数カウント（`INT`）の加算のみ」**とする。

---

## 6.2 実装する動的機能（PV・バイラル向上施策）

### ① 段落単位の「みんなの下線（ポピュラー・ハイライト）」＆引用OGPシェア
- **概要**: `chapters[].paragraphs` の各段落に対して読者が「✦ 心に残った」を押すと、DBの `(story_id, chapter_index, paragraph_index)` のカウントを加算する。
- **UIと拡散導線**:
  - 多くの読者が星を灯した段落に「✦ N人の旅人がこの一節に星を灯しました」と淡い金の下線（ヒートマップ）を表示する。
  - その一節と用語の正体をX（旧Twitter）へ1タップでシェアできる引用リンクを生成し、タイムラインからのバイラル流入を作る。

### ② 読了後の「4種・感情スタンプ集計」と「感情別トレンドランキング」
- **概要**: 章末の「読了後の真相・考察メモ」直下に定型リアクションボタン（例：`💧 涙腺崩壊` / `🤯 伏線が鳥肌` / `🕯️ 救われてほしい` / `🔍 考察が深い`）を設置し、作品ごとの累計・週間カウントを集計する。
- **UIと回遊導線**:
  - 書架トップに「今週読まれている物語 TOP5」「『涙腺崩壊』が多い物語」「『伏線が鳥肌』の物語」を表示し、初見ユーザーの1訪問あたり閲覧ページ数（PV/セッション）を引き上げる。

### ③ 章末の「選択式・考察アンケート（2〜3択投票）」
- **概要**: 解釈が分かれる作品（『白夜国館蔵』等）の章末に選択式の定型アンケートを1問設置し、投票後に全体の支持率（`A説 68% / B説 32%`）を開示する。

---

## 6.3 最小DBスキーマ案（Cloudflare D1 / SQLite）

```sql
-- 1. 作品単位の感情スタンプ＆閲覧カウント集計
CREATE TABLE story_reactions (
  story_id TEXT NOT NULL,
  reaction_type TEXT NOT NULL, -- 'view' | 'tear' | 'mindblown' | 'pray' | 'deep'
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (story_id, reaction_type)
);

-- 2. 段落単位のポピュラー・ハイライト集計
CREATE TABLE paragraph_highlights (
  story_id TEXT NOT NULL,
  chapter_index INTEGER NOT NULL,
  paragraph_index INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (story_id, chapter_index, paragraph_index)
);
```
