# テイワット文庫

原神の聖遺物・武器・書籍・風の翼・突破育成素材などに収録されているゲーム内テキストを、小説感覚で気軽に読める非公式Webリーダーです。

## プロダクト概要

ゲーム内のアイテム説明や書籍は、代名詞による固有名詞の秘匿や複数アイテムへのテキスト分散により、単体では背景文脈が掴みにくいことがあります。「テイワット文庫」は原文テキストを改変することなく、以下の機能で物語の通読を支援します。

### 主な機能

- **書架（一覧・検索）**
  - **5分類タブ**: `すべて` / `書籍` / `聖遺物` / `武器` / `風の翼` / `突破・育成素材`
  - **今日の物語ピックアップ**: フィルタ未適用かつ「おすすめ順」の時、未読作品（全件読了時は全作品）から日替わりで1篇を先頭に繰り上げて表示
  - **おまかせ読書**: 「未読から1篇読む」（全件読了時は「おまかせで1篇読む」）ボタンで未読短編を優先して即座に開くショートカット
  - **絞り込み・並び替え・横断全文検索**: 読書状態（`すべて` / `未読のみ` / `読了済み` / `あとで読む`）・登場人物・用語・地域・並び替え（`関連度順` / `おすすめ順` / `新着順` / `短い順`）に加え、タイトル・本文・人物・用語・地名をまたぐ日本語正規化＆スペース区切り AND 横断検索に対応（真相メモのオプトイン検索トグル・一致スニペット表示・検索時カテゴリー件数動的更新・URL クエリ同期付き）
  - **読書状態と新着表示**: 前回の続き再開バナー、カード上の `✦ 読了`・`NEW`（追加から14日以内かつ未読）・`あとで読む` バッジ、読破率サマリー表示
- **リーダー画面**
  - **時系列・連作構成**: 複数部位や段階に分かれたテキストを章立てして通し読みできる構成
  - **用語ガイド（Dialog）**: 原文の意味を補うインライン用語解説ダイアログ（`用語ガイド ON/OFF` 切替・出典リンク対応）
  - **検索着地・ハイライト**: 検索スニペットから該当段落・用語・真相メモへ直接スクロールし、一致語を一時ハイライト表示（誤自動読了の抑止付き）
  - **表示設定（Aa）**: 文字サイズ（小 / 標準 / 大）、書体（明朝 / ゴシック）、背景テーマ（夜空 / 生成り紙 / セピア）の切り替え（Popover メニュー）
  - **読書状態の保存（`localStorage`）**: スクロール90%到達または真相メモ展開での自動読了マーク、手動読了／あとで読むトグル、途中位置の自動しおり保存（別タブ同期対応）
  - **章目次・読了進捗・関連作品リンク**: 読書進捗バーと章末の関連作品カード表示
- **データ検証・ビルドパイプライン**
  - 原典層（`data/raw/`）・編集層（`data/stories/`, `data/shared/`）・配信層（`public/data/`）の3層構造を採用
  - ビルド時に原典データと本文の1文字完全一致チェックや各種整合性検証を実行

### 主な技術構成

- **フロントエンド**: React 19 / TypeScript / React Router（`createHashRouter`）/ Radix UI（`@radix-ui/react-popover`, `@radix-ui/react-dialog`）/ CSS Modules / Vite
- **テスト / 品質保証**: `tsc --noEmit`、`Vitest` + React Testing Library、`Playwright`（Chromium E2E）
- **原典データソース / CLI**: `Node.js`、`genshin-db`、`genshin-data`

---

## セットアップ

### 前提環境

- Node.js（ES Modules 対応バージョン）
- npm

### 依存パッケージのインストール

```bash
npm install
```

---

## 起動方法

### 開発サーバーの起動

データビルド（`npm run build:data`）を実行したあと、Vite の開発サーバーを起動します。

```bash
npm run dev
```

起動後、ターミナルに表示されるローカル URL（例: `http://localhost:5173/`）をブラウザで開きます。

---

## ビルド方法

### 本番用ビルド

配信用 JSON の生成（`npm run build:data`）、TypeScript 型チェック（`tsc --noEmit`）、および Vite による静的アセットのビルドを実行し、`dist/` へ出力します。

```bash
npm run build
```

### ビルド結果のローカルプレビュー

`npm run build` で生成された `dist/` をローカルで確認します。

```bash
npm run preview
```

---

## データ関連スクリプト

`package.json` に定義されているデータパイプライン用のコマンドです。

| コマンド | 内容 |
| :--- | :--- |
| `npm run build:data` | `data/` の原典・編集データ・共通マスタを検証し、フロントエンド配信用 JSON を `public/data/` に生成します |
| `npm run validate` | 配信用ファイルは出力せず、データ構造や原文一致などのバリデーションのみを実行します |
| `npm run typecheck` | `tsc --noEmit` による TypeScript の静的型チェックを実行します |
| `npm test` | Vitest + React Testing Library によるドメインロジック・状態管理・UI コンポーネントの単体/結合テストを実行します |
| `npm run test:e2e` | Playwright（Chromium）による UI リグレッションテストを実行します（開発サーバー自動起動込み） |
| `npm run test:all` | 単体テスト（`npm test`）と UI リグレッションテスト（`npm run test:e2e`）を一括実行します |
| `npm run extract-raw -- --type <sourceType> --id <rawId>` | `genshin-db` / `genshin-data`（書籍本文は Yatta API）から指定アイテムの原典スナップショットを `data/raw/` へ抽出します |
| `npm run lore:inspect -- --type <sourceType> --id <rawId>` | 記事化前に対象アイテムの文字数・段落構成・コーパス未登録カタカナ語を事前検査します |
| `npm run lore:search -- <keyword>` | インストール済みの `genshin-db`・`genshin-data`・`data/raw/` から関連テキストを横断検索します |
| `npm run sync-corpus` | インストール済みパッケージおよび `data/raw/` から公式カタカナ語コーパス（`data/shared/official-corpus.json`）を生成・同期します |

---

## ディレクトリ構成

```text
.
├── index.html          # Vite エントリーHTML（ルートマウント・フォント読み込み）
├── tsconfig.json       # TypeScript コンパイラ設定
├── vite.config.js      # Vite / React / Vitest 設定
├── package.json        # スクリプト・依存関係定義
├── src/                # React + TypeScript フロントエンドソース
│   ├── api/            # 作品一覧・詳細 JSON フェッチ
│   ├── components/     # layout / shelf / reader / common の React コンポーネント & CSS Modules
│   ├── domain/         # 書架表示状態導出・横断検索エンジン（正規化/AND/スニペット）・テキスト構文トークナイザの純粋ロジック
│   ├── hooks/          # リーダー閲覧セッション統合・検索コーパス遅延取得・検索ハイライト着地・テーマ同期フック
│   ├── router/         # HashRouter ルート定義・検索URLクエリ同期・旧ハッシュ互換（#story/<id>）
│   ├── state/          # reading-state / prefs ストア＆ Context Provider
│   ├── styles/         # カラートークン（tokens.css）＆共通 CSS Module
│   └── types/          # ストーリー・状態型定義
├── tests/              # Vitest テスト（*.test.ts, *.test.tsx）および Playwright UIテスト（e2e/）
├── scripts/            # 原典抽出・コーパス同期・検証＆配信データビルドスクリプト
├── data/               # 原典スナップショット（raw）・編集データ（stories）・共通マスタ（shared）・スキーマ（schemas）
├── public/             # ビルド時に生成される配信用データ（public/data/）
├── GLOSSARY.md         # ドメイン用語集（ユビキタス言語の正本）
└── docs/               # 設計書・ADR・ロードマップ索引（docs/README.md 参照）
```

---

## 免責事項・著作権表記

本プロジェクトは非公式のファンアーカイブであり、HoYoverse の公式サービスではありません。
収録しているゲーム内テキストの著作権は COGNOSPHERE PTE. LTD. に帰属します。
