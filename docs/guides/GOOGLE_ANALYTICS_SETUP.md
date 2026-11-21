# Google Analytics 4（GA4）セットアップ＆運用ガイド

本ドキュメントは、「テイワット文庫」に実装済みの Google Analytics 4（GA4）計測基盤を本番環境で有効化し、GA4 管理画面上でカスタムイベント・パラメータを集計するための設定手順書です。

---

## 1. 環境変数の設定

測定 ID は Vite 環境変数 `VITE_GA_MEASUREMENT_ID` で注入します（リポジトリには実 ID をコミットせず、`.env.example` のみを追跡します）。

### 1.1 ローカル検証用（`.env.local`）
プロジェクトルート直下に `.env.local`（`.gitignore` 除外対象）を作成し、測定 ID を記載します。

```dotenv
VITE_GA_MEASUREMENT_ID=G-3Y6JZZ21ZM
# ローカルで GA4 DebugView を疎通確認する時だけ true にして再起動する
# VITE_GA_DEBUG=true
```

> [!WARNING]
> **E2E テスト時の注意**
> 通常のローカル開発・`npm run preview`・Playwright E2E テスト実行時は `VITE_GA_DEBUG=true` を **無効（コメントアウト）** にしておいてください。有効のままにするとローカル環境でも Google サーバーへの外部通信が発生します。

### 1.2 本番ホスティング側の環境変数登録
デプロイ先のビルド環境変数に以下を設定して `npm run build` を実行します。

| 変数名 | 設定値（例） | 必須 | 説明 |
| :--- | :--- | :---: | :--- |
| `VITE_GA_MEASUREMENT_ID` | `G-3Y6JZZ21ZM` | 任意 | 有効な `G-...` 形式が設定され、本番ホスト上で閲覧された場合のみ計測が有効になります |
| `VITE_GA_DEBUG` | 未設定（または `false`） | — | 本番環境では絶対に `true` にしないでください |

**主なホスティング設定箇所**:
- **Cloudflare Pages**: `Workers & Pages` → 対象プロジェクト → `Settings` → `Variables and Secrets` → Production 環境へ `VITE_GA_MEASUREMENT_ID` を登録
- **GitHub Actions（静的ビルド配信）**: リポジトリ `Settings` → `Secrets and variables` → `Actions` → `Variables` に `VITE_GA_MEASUREMENT_ID` を登録し、ビルドステップの `env:` へ渡す

---

## 2. GA4 管理画面の必須設定

### 2.1 拡張計測機能の「ページ変更に基づくイベント」を OFF にする
本アプリは `HashRouter`（`#/`・`#/story/<id>`・`#/about`）と検索クエリ `?q=...` の更新を利用しており、[`src/analytics/ga4.ts`](../../src/analytics/ga4.ts) から正規化済み仮想パスで `page_view` を手動送信しています（`send_page_view: false`）。

GA4 標準の「ブラウザ履歴イベントに基づくページ変更」が ON のままだと、検索入力による URL 書き換えのたびに二重・過剰計測されるため、必ず OFF にしてください。

1. GA4 管理画面 → 左下 **「管理（歯車アイコン）」** → **「データ ストリーム」** → 対象ウェブストリームを開く
2. **「拡張計測機能」** の右端にある歯車アイコンをクリック
3. **「ページビュー数」** の詳細設定を開き、**「ブラウザの履歴イベントに基づくページの変更」** のチェックを外して **保存**

---

## 3. カスタムディメンション／カスタム指標の登録

GA4 管理画面 → **「管理」** → **「データの表示」→「カスタム定義」** から、以下を登録すると探索レポートや標準レポートで作品・導線別の分析が可能になります。

> [!NOTE]
> `page_path`・`page_title`・`page_location`・`search_term` は GA4 標準パラメータのためカスタム登録不要です。

### 3.1 カスタムディメンション（すべて「イベント」スコープ）

| ディメンション名（表示例） | イベント パラメータ | 主な利用イベント | 取り得る値の例 |
| :--- | :--- | :--- | :--- |
| 作品ID | `story_id` | `page_view`, `story_open`, `story_complete`, `glossary_open`, `truth_memo_open`, `bookmark_toggle` | `crimson_witch`, `byakuyakoku` |
| 書架カテゴリー | `story_category` | `page_view`, `story_open`, `story_complete` | `book`, `artifact`, `weapon`, `attire`, `chronicle` |
| 開封導線 | `source` | `story_open` | `card`, `featured`, `random`, `resume`, `search_snippet`, `connected`, `evidence` |
| 読了方法 | `method` | `story_complete` | `auto_scroll`, `auto_lore`, `manual` |
| 用語ID | `term_id` | `glossary_open` | `cw_lover`, `by_snake` |
| ブックマーク操作 | `action` | `bookmark_toggle` | `add`, `remove` |
| 操作画面 | `surface` | `bookmark_toggle` | `shelf`, `reader` |
| フィルタ種別 | `filter_type` | `shelf_filter_change` | `category`, `status`, `entity`, `region`, `sort`, `include_truth`, `reset` |
| フィルタ値 | `filter_value` | `shelf_filter_change` | `artifact`, `unread`, `rostam`, `モンド`, `newest`, `true`, `all` |
| 真相メモ検索フラグ | `include_truth` | `search` | `true`, `false` |
| 検索ヒット有無 | `has_results` | `search` | `true`, `false` |

### 3.2 カスタム指標（「イベント」スコープ）

| 指標名（表示例） | イベント パラメータ | 単位 | 主な利用イベント |
| :--- | :--- | :--- | :--- |
| 検索ヒット件数 | `result_count` | 標準 | `search` |

---

## 4. 実装イベント仕様サマリー

| イベント名 | 発火タイミング | 重複・PII 対策 |
| :--- | :--- | :--- |
| `page_view` | 書架（`/`）・About（`/about`）到達時、およびリーダー作品データ取得＆タイトル確定後 | 検索クエリ `?q=` の URL 同期では再発火しない |
| `story_open` | 書架カード・今日のピックアップ・おまかせ読書・途中再開・検索スニペット・関連作品・出典リンクから作品を開いた時 | 別タブ開きの修飾キークリックも捕捉 |
| `search` | 検索入力停止後 800ms デバウンス経過時（インデックス読み込み完了後） | 書架↔リーダー往復の同一検索語重複を抑止。メール／電話様数値マスク＋100 文字制限 |
| `story_complete` | 未読作品が「読了」になった時（90% スクロール到達 / 真相メモ展開 / 手動読了） | 既読作品の再訪や同セッション内の戻し往復では再発火しない |
| `glossary_open` | 本文中のインライン用語ガイドを開いた時 | — |
| `truth_memo_open` | 読了後の真相・考察メモを手動で展開した時 | 検索ジャンプによるプログラム展開は除外、1 閲覧につき 1 回 |
| `bookmark_toggle` | 「あとで読む」を追加／解除した時 | 書架カード・リーダー双方から記録 |
| `shelf_filter_change` | カテゴリータブ・状態・登場人物/用語・地域・並び替え・真相メモ検索・条件リセット操作時 | 同一カテゴリータブの再クリックはスキップ |

---

## 5. ローカル DebugView での動作確認手順

1. `.env.local` で `VITE_GA_DEBUG=true` のコメントアウトを外し、`npm run dev` を起動する。
2. ブラウザでアプリを開き、DevTools の Console に `[GA4]` ログが出力されることを確認する。
3. GA4 管理画面 → **「管理」→「データの表示」→「DebugView」** を開き、以下を確認する：
   - [ ] 書架初期表示で `page_view`（`page_path: "/"`）が 1 件だけ届く
   - [ ] 作品カードクリックで `story_open`（`source: "card"` / `"featured"`）と `page_view`（`page_path: "/story/<id>"`）が届く
   - [ ] 検索語句入力後 800ms で `search`（`search_term`, `result_count`, `has_results`）が届く
   - [ ] 用語ガイド・真相メモ手動展開・読了・あとで読む・絞り込みの各イベントが届く
   - [ ] フッター「アクセス解析について」からスイッチを OFF にした直後、以降の操作で送信が止まり、ページリロード後も `gtag/js` が読み込まれない
4. 確認終了後、`.env.local` の `VITE_GA_DEBUG=true` を再びコメントアウトして保存する。
