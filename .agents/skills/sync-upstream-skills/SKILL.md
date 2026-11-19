---
name: sync-upstream-skills
description: >-
  mattpocock/skills 上流リポジトリの更新を検知し、ローカル改変（日本語トリガー・.scratch/・references/・プロジェクト固有注記）を壊さずに 3-way マージで取り込む手順。上流スキルの最新化、差分確認、新スキル採用判断、マニフェスト・NOTICE・AGENTS.md の同期を行う時に使用する。
---

# Sync Upstream Skills（上流スキル追従・3-way マージ手順）

[`.agents/skills-upstream.json`](../../skills-upstream.json) を基準点として、`mattpocock/skills` の純粋な上流差分だけを抽出し、本プロジェクトのローカル規約を維持しながら安全に取り込むための手順。

---

## 1. 事前確認（GitHub 読み取りの承認）

1. `npm run skills:check` は GitHub API（`https://api.github.com/repos/mattpocock/skills/...`）へ読み取りリクエストを送るため、**未承認の場合は実行前に必ずユーザーの承認を得る**こと（目的・対象・読み取りのみである旨を明示）。
2. ローカルの整合性確認だけを行いたい場合は、通信を行わない `npm run skills:validate` を使用する。

---

## 2. 上流差分の検知とパッチ抽出

承認を得たら以下を実行する。

```powershell
npm run skills:check
```

これにより `.scratch/skills-sync/` 配下に以下が出力される（`.scratch/` は `.gitignore` 済み）：

- `.scratch/skills-sync/report.md`: 比較範囲、コミット履歴、採用中スキルの変更一覧、未マッピングファイル、新規スキル候補、LICENSE 変更警告
- `.scratch/skills-sync/patches/<skill>.patch`: **前回同期時の上流 → 最新の上流** の純粋な差分パッチ

---

## 3. 取り込み判断（ユーザー合意）

`.scratch/skills-sync/report.md` を読み、以下を簡潔に報告して取り込み範囲をユーザーと合意する。

- **採用中スキルの更新**: どのスキルにどんな意図の変更が入ったか
- **採用中スキル配下の未マッピングファイル**: 新規リファレンス等が追加されていれば `references/` に取り込むか
- **新規・未分類スキル候補**: 採用するか、`ignoredUpstreamSkills` に追加するか
- **廃止・移動 / LICENSE 変更**: 該当があれば対処方針を確認

---

## 4. 3-way マージ適用ルール（重要）

ローカル版と上流最新版を全文比較して上書きするのではなく、**`.scratch/skills-sync/patches/<skill>.patch` の変更意図だけをローカルの該当ファイルへ反映**する。

適用時、[`.agents/skills-upstream.json`](../../skills-upstream.json) の `localConventions` をすべて維持する：

- フロントマター `description` 末尾の日本語トリガー説明を消さない
- 保存先やチケット管理はローカルの `.scratch/<feature-slug>/` 運用を維持する
- 補助ファイルは `./references/` 配下のパス・リンクを維持する
- Antigravity のツール名・サブエージェント表記（`invoke_subagent` / `manage_subagents` 等）を維持する
- GitHub 操作は事前承認必須とする記述を維持する
- `TeyvatLibrary` 固有の注記（`doc-sync` / `genshin-story-curator` / `GLOSSARY.md` / `docs/adr/` 等）を消さない

---

## 5. 連動ファイルの同期と完了検証

取り込みが完了したら、以下を必ず実施する。

1. **スキル増減または構成変更があった場合**:
   - [`.agents/skills-upstream.json`](../../skills-upstream.json) の `trackedSkills` / `ignoredUpstreamSkills` を更新
   - [`NOTICE`](../../../NOTICE) のセクション `5. 開発支援スキル（.agents/skills/）` の対象スキル一覧（および LICENSE 変更があれば条文）を更新
   - [`AGENTS.md`](../../../AGENTS.md) の Context Pointers を更新（`doc-sync` 準拠）
2. **基準コミット SHA を最新へ更新**:
   ```powershell
   node scripts/check-skills-upstream.mjs --mark-synced <headCommitSha>
   ```
3. **検証コマンドを実行**:
   ```powershell
   npm run skills:validate
   npm test
   ```
4. 差分を確認し、必要であればユーザー承認のもとコミット・プッシュする。
