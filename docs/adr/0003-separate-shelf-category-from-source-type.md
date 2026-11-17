---
status: accepted
---

# 0003: 書架カテゴリー（UI 5分類）と原典種別（sourceType）の分離

書架のタブ分類である `ShelfCategoryId`（`book` / `artifact` / `weapon` / `attire` / `chronicle`）と、各章の抽出元を表す `sourceType`（`book` / `artifact` / `weapon` / `windglider` / `material`）を別概念として分離する。

## Considered Options

- **書架カテゴリーと章単位 `sourceRef.sourceType` の分離（採用）**: 武器突破素材4段階・週ボス素材3種・元素宝石など、単体では短い複数アイテムや異種原典を1冊の連作（オムニバス章構成）として自然な UI カテゴリーへ編纂できる。
- **1作品＝1原典種別の固定マッピング**: スキーマは単純になるが、短文素材群を独立した読み物としてまとめることや、武器・聖遺物・素材を横断した連作編成ができない。

## Consequences

- 作品メタデータ（`shelfCategory`）から原典フォルダ（`data/raw/<sourceType>/`）を一意に推定してはならず、原典解決は必ず章単位の `sourceRef` を参照する。
- `GLOSSARY.md` でも「書架カテゴリー」と「原典種別」を厳密に区別して扱う。
