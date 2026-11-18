---
status: accepted
---

# 0004: 遅延取得型検索コーパス（`search-index.json`）によるクライアント横断全文検索

完全静的サイト構成（ADR-0001）を維持したまま、書架の初期表示軽量性を損なわずにタイトル・本文・登場人物・用語ガイド・地名を横断検索するため、ビルド時に正規化・タグ除去済みコーパス `public/data/search-index.json` を分離出力し、検索開始時に 1 回だけ遅延取得してクライアント側でクロスフィールド AND 評価を行う。

## Considered Options

- **ビルド時検索コーパスの分離生成 ＋ 遅延取得（採用）**: `stories-index.json` の初期ロード軽量性を維持しつつ、100〜200 作品規模でも 1 リクエストで全作品の全文検索と前後文脈スニペット生成・段落直通ジャンプを実行できる。
- **`stories-index.json` への本文統合**: 検索初回待機がなくなる一方、検索を使わない読者の初回読み込みサイズも作品数に応じて増大する。
- **個別 `public/data/stories/<id>.json` の全件並列フェッチ**: 新規生成物は不要だが、作品数に比例して HTTP リクエスト数が増大しモバイル回線やキャッシュ効率が悪化する。
- **事前分割転置インデックス（N-gram）のみを出力**: 判定は高速だがスニペット生成や語句ハイライトのために結局テキスト本体が必要になり、静的ファイル構成が複雑化する。

## Consequences

- `npm run build:data`（`StoryCompiler`）は `stories-index.json` および `stories/*.json` に加え、`evidence`・`connected` を除外した `search-index.json` を出力する。
- 未読作品の真相・考察メモ（`overallTruth` / `gameEffect`）は、既読作品または明示トグル ON 時のみ検索対象に含め、小説体験のネタバレ保護を維持する。
- フロントエンドは検索欄フォーカスまたは URL クエリ指定時のみ `search-index.json` を取得し、取得完了前は `stories-index.json` によるメタデータ検索へフォールバックする。
