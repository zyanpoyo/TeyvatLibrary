import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_PROJECT_ROOT = path.resolve(__dirname, "../..");

const SHA_PATTERN = /^[0-9a-f]{7,40}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function normalizePosix(p) {
  return String(p || "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
}

function isAgentMetaFile(relPath) {
  const norm = normalizePosix(relPath);
  return norm.startsWith("agents/") || norm.endsWith("/openai.yaml");
}

function extractSkillDirFromPath(filePath) {
  const parts = normalizePosix(filePath).split("/");
  if (parts.length >= 3 && parts[0] === "skills") {
    return `${parts[0]}/${parts[1]}/${parts[2]}`;
  }
  return null;
}

function extractCategoryFromPath(filePath) {
  const parts = normalizePosix(filePath).split("/");
  if (parts.length >= 2 && parts[0] === "skills") {
    return `${parts[0]}/${parts[1]}`;
  }
  return null;
}

/**
 * .agents/skills-upstream.json の構文・実ファイル存在・NOTICE記載整合性を検証する。
 */
export function validateSkillsManifest({ manifest, rootDir, noticeText = null }) {
  const errors = [];
  const warnings = [];

  if (!manifest || typeof manifest !== "object") {
    return { ok: false, errors: ["マニフェストが空または不正なJSONです。"], warnings };
  }

  const upstream = manifest.upstream;
  if (!upstream || !upstream.owner || !upstream.repo || !upstream.branch) {
    errors.push("upstream.owner / upstream.repo / upstream.branch は必須です。");
  }

  if (!SHA_PATTERN.test(String(manifest.lastSyncedCommit || ""))) {
    errors.push(`lastSyncedCommit が不正なコミットSHA形式です: ${manifest.lastSyncedCommit}`);
  }

  if (manifest.lastSyncedAt && !DATE_PATTERN.test(String(manifest.lastSyncedAt))) {
    warnings.push(`lastSyncedAt は YYYY-MM-DD 形式を推奨します: ${manifest.lastSyncedAt}`);
  }

  const trackedSkills = manifest.trackedSkills;
  if (!trackedSkills || typeof trackedSkills !== "object" || Object.keys(trackedSkills).length === 0) {
    errors.push("trackedSkills に少なくとも1件のスキル定義が必要です。");
    return { ok: false, errors, warnings };
  }

  const seenUpstreamDirs = new Set();
  for (const [skillName, entry] of Object.entries(trackedSkills)) {
    if (!entry || typeof entry !== "object") {
      errors.push(`trackedSkills.${skillName} が不正です。`);
      continue;
    }
    const upstreamDir = normalizePosix(entry.upstreamDir);
    const localDir = normalizePosix(entry.localDir);
    if (!upstreamDir || !localDir) {
      errors.push(`trackedSkills.${skillName} に upstreamDir または localDir がありません。`);
      continue;
    }
    if (seenUpstreamDirs.has(upstreamDir)) {
      errors.push(`upstreamDir が重複しています: ${upstreamDir}`);
    }
    seenUpstreamDirs.add(upstreamDir);

    const files = entry.files;
    if (!files || typeof files !== "object" || Object.keys(files).length === 0) {
      errors.push(`trackedSkills.${skillName}.files に1件以上のマッピングが必要です。`);
      continue;
    }

    if (rootDir) {
      for (const [upRel, localRel] of Object.entries(files)) {
        const localFullPath = path.resolve(rootDir, localDir, localRel);
        if (!fs.existsSync(localFullPath)) {
          errors.push(
            `ローカルファイルが存在しません (${skillName}: ${upRel}): ${normalizePosix(path.join(localDir, localRel))}`
          );
        }
      }
    }

    if (typeof noticeText === "string") {
      const escaped = skillName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const tokenPattern = new RegExp(`(^|[^a-zA-Z0-9_-])${escaped}([^a-zA-Z0-9_-]|$)`);
      if (!tokenPattern.test(noticeText)) {
        errors.push(`NOTICE に trackedSkills.${skillName} の記載が見当たりません。`);
      }
    }
  }

  const ignoredUpstreamSkills = manifest.ignoredUpstreamSkills || {};
  for (const ignoredDir of Object.keys(ignoredUpstreamSkills)) {
    if (seenUpstreamDirs.has(normalizePosix(ignoredDir))) {
      errors.push(`trackedSkills と ignoredUpstreamSkills の両方に登録されています: ${ignoredDir}`);
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

/**
 * GitHub Compare API の変更ファイル一覧と任意でHEADツリーから、上流更新を分類する。
 */
export function classifyUpstreamChanges({ manifest, compareFiles = [], headTreePaths = [] }) {
  const trackedByUpstreamDir = new Map();
  for (const [skillName, entry] of Object.entries(manifest.trackedSkills || {})) {
    trackedByUpstreamDir.set(normalizePosix(entry.upstreamDir), {
      skillName,
      upstreamDir: normalizePosix(entry.upstreamDir),
      localDir: normalizePosix(entry.localDir),
      files: entry.files || {},
    });
  }

  const ignoredDirs = new Set(
    Object.keys(manifest.ignoredUpstreamSkills || {}).map((dir) => normalizePosix(dir))
  );
  const ignoredCategories = new Set(
    (manifest.ignoredCategories || []).map((cat) => normalizePosix(cat))
  );

  const updatedTracked = [];
  const unmappedTrackedFiles = [];
  const deprecatedOrRemoved = [];
  const ignoredUpdates = [];
  const licenseChanged = [];
  const newSkillMap = new Map();

  for (const file of compareFiles) {
    const filename = normalizePosix(file.filename);
    const previousFilename = file.previous_filename ? normalizePosix(file.previous_filename) : null;
    const status = file.status || "modified";

    if (/^(LICENSE|NOTICE)(\..+)?$/i.test(filename)) {
      licenseChanged.push({
        filename,
        status,
        additions: file.additions || 0,
        deletions: file.deletions || 0,
        patch: file.patch || "",
      });
      continue;
    }

    // 追跡中スキルからの削除・移動を先にチェック
    const prevSkillDir = previousFilename ? extractSkillDirFromPath(previousFilename) : null;
    const currentSkillDir = extractSkillDirFromPath(filename);

    if (prevSkillDir && trackedByUpstreamDir.has(prevSkillDir) && prevSkillDir !== currentSkillDir) {
      const tracked = trackedByUpstreamDir.get(prevSkillDir);
      deprecatedOrRemoved.push({
        skill: tracked.skillName,
        previousPath: previousFilename,
        currentPath: filename,
        status,
      });
      continue;
    }

    if (currentSkillDir && trackedByUpstreamDir.has(currentSkillDir)) {
      const tracked = trackedByUpstreamDir.get(currentSkillDir);
      const relPath = filename.slice(currentSkillDir.length + 1);
      const mappedLocalRel = tracked.files[relPath];

      if (mappedLocalRel) {
        const localPath = normalizePosix(path.posix.join(tracked.localDir, mappedLocalRel));
        if (status === "removed") {
          deprecatedOrRemoved.push({
            skill: tracked.skillName,
            previousPath: filename,
            currentPath: null,
            status,
          });
        } else {
          updatedTracked.push({
            skill: tracked.skillName,
            upstreamPath: filename,
            localPath,
            status,
            additions: file.additions || 0,
            deletions: file.deletions || 0,
            patch: file.patch || "",
          });
        }
      } else {
        unmappedTrackedFiles.push({
          skill: tracked.skillName,
          upstreamPath: filename,
          relativePath: relPath,
          status,
          isAgentMeta: isAgentMetaFile(relPath),
          additions: file.additions || 0,
          deletions: file.deletions || 0,
          patch: file.patch || "",
        });
      }
      continue;
    }

    if (currentSkillDir && ignoredDirs.has(currentSkillDir)) {
      ignoredUpdates.push({
        upstreamDir: currentSkillDir,
        filename,
        status,
      });
      continue;
    }

    const category = extractCategoryFromPath(filename);
    if (
      currentSkillDir &&
      category &&
      !ignoredCategories.has(category) &&
      !trackedByUpstreamDir.has(currentSkillDir) &&
      !ignoredDirs.has(currentSkillDir)
    ) {
      const entry = newSkillMap.get(currentSkillDir) || {
        upstreamDir: currentSkillDir,
        files: [],
        fromDiff: true,
      };
      entry.files.push(filename);
      newSkillMap.set(currentSkillDir, entry);
    }
  }

  // HEAD の全ツリーが渡されている場合は、差分に含まれない未登録スキルも候補として検出する
  for (const rawTreePath of headTreePaths) {
    const treePath = normalizePosix(rawTreePath);
    if (!treePath.endsWith("/SKILL.md")) continue;
    const skillDir = extractSkillDirFromPath(treePath);
    const category = extractCategoryFromPath(treePath);
    if (!skillDir || !category) continue;
    if (ignoredCategories.has(category)) continue;
    if (trackedByUpstreamDir.has(skillDir) || ignoredDirs.has(skillDir)) continue;
    if (!newSkillMap.has(skillDir)) {
      newSkillMap.set(skillDir, {
        upstreamDir: skillDir,
        files: [treePath],
        fromDiff: false,
      });
    }
  }

  const newSkills = Array.from(newSkillMap.values()).sort((a, b) =>
    a.upstreamDir.localeCompare(b.upstreamDir)
  );

  return {
    updatedTracked,
    unmappedTrackedFiles,
    deprecatedOrRemoved,
    newSkills,
    ignoredUpdates,
    licenseChanged,
  };
}

/**
 * 採用中スキルの変更から、スキル単位の純粋な上流パッチテキストを構築する。
 */
export function buildSkillPatchFiles(classified) {
  const bySkill = new Map();

  const appendEntry = (skill, header, patch) => {
    if (!bySkill.has(skill)) bySkill.set(skill, []);
    bySkill.get(skill).push(header);
    bySkill.get(skill).push(patch ? patch : "(差分パッチなし / バイナリまたは大きすぎる変更)");
    bySkill.get(skill).push("");
  };

  for (const item of classified.updatedTracked || []) {
    const header = [
      `# Upstream: ${item.upstreamPath}`,
      `# Local:    ${item.localPath}`,
      `# Status:   ${item.status} (+${item.additions} / -${item.deletions})`,
      "--------------------------------------------------------------------------------",
    ].join("\n");
    appendEntry(item.skill, header, item.patch);
  }

  for (const item of classified.unmappedTrackedFiles || []) {
    if (item.isAgentMeta) continue;
    const header = [
      `# Upstream (UNMAPPED): ${item.upstreamPath}`,
      `# Status:              ${item.status} (+${item.additions} / -${item.deletions})`,
      "--------------------------------------------------------------------------------",
    ].join("\n");
    appendEntry(item.skill, header, item.patch);
  }

  const result = new Map();
  for (const [skill, lines] of bySkill.entries()) {
    result.set(skill, lines.join("\n"));
  }
  return result;
}

/**
 * 差分レポートを Markdown 形式で生成する。
 */
export function renderUpstreamReport({
  manifest,
  baseCommit,
  headCommit,
  headDate = "",
  commits = [],
  classified,
}) {
  const lines = [];
  const repoLabel = `${manifest.upstream.owner}/${manifest.upstream.repo}`;
  const shortBase = String(baseCommit || "").slice(0, 7);
  const shortHead = String(headCommit || "").slice(0, 7);

  lines.push(`# 上流スキル更新レポート (${repoLabel})`);
  lines.push("");
  lines.push(`- **比較範囲**: \`${shortBase}\` → \`${shortHead}\`${headDate ? ` (${headDate})` : ""}`);
  lines.push(`- **コミット数**: ${commits.length} 件`);
  lines.push(`- **採用中スキルの変更ファイル**: ${classified.updatedTracked.length} 件`);
  lines.push(`- **採用中スキルの未マッピング変更（メタ除く）**: ${classified.unmappedTrackedFiles.filter((f) => !f.isAgentMeta).length} 件`);
  lines.push(`- **廃止・移動・削除**: ${classified.deprecatedOrRemoved.length} 件`);
  lines.push(`- **新規・未分類スキル候補**: ${classified.newSkills.length} 件`);
  lines.push(`- **ライセンス/NOTICE 変更**: ${classified.licenseChanged.length} 件`);
  lines.push("");

  if (classified.licenseChanged.length > 0) {
    lines.push("## ⚠ ライセンス・NOTICE の変更（要確認）");
    lines.push("");
    for (const item of classified.licenseChanged) {
      lines.push(`- \`${item.filename}\` (${item.status}, +${item.additions}/-${item.deletions}) — 本リポジトリの \`NOTICE\` の見直しが必要です。`);
    }
    lines.push("");
  }

  lines.push("## 1. 採用中スキルの更新（3-way マージ対象）");
  lines.push("");
  if (classified.updatedTracked.length === 0) {
    lines.push("更新はありません。");
  } else {
    lines.push("| スキル | 上流ファイル | ローカル反映先 | 状態 | 増減 | パッチ |");
    lines.push("| :--- | :--- | :--- | :--- | :--- | :--- |");
    for (const item of classified.updatedTracked) {
      lines.push(
        `| \`${item.skill}\` | \`${item.upstreamPath}\` | \`${item.localPath}\` | ${item.status} | +${item.additions}/-${item.deletions} | \`patches/${item.skill}.patch\` |`
      );
    }
  }
  lines.push("");

  const notableUnmapped = classified.unmappedTrackedFiles.filter((f) => !f.isAgentMeta);
  const metaUnmapped = classified.unmappedTrackedFiles.filter((f) => f.isAgentMeta);
  if (notableUnmapped.length > 0 || metaUnmapped.length > 0) {
    lines.push("## 2. 採用中スキル配下の未マッピングファイル変更");
    lines.push("");
    for (const item of notableUnmapped) {
      lines.push(
        `- \`${item.skill}\`: \`${item.upstreamPath}\` (${item.status}, +${item.additions}/-${item.deletions}) — 新規リファレンス等の可能性があります。必要なら \`references/\` に取り込みマニフェストへ追加してください。`
      );
    }
    if (metaUnmapped.length > 0) {
      lines.push(`- （参考）他エージェント向けメタファイル（\`agents/openai.yaml\` 等）の変更: ${metaUnmapped.length} 件`);
    }
    lines.push("");
  }

  if (classified.deprecatedOrRemoved.length > 0) {
    lines.push("## 3. 採用中スキルの廃止・移動・削除");
    lines.push("");
    for (const item of classified.deprecatedOrRemoved) {
      const dest = item.currentPath ? `→ \`${item.currentPath}\`` : "(削除)";
      lines.push(`- \`${item.skill}\`: \`${item.previousPath}\` ${dest} (${item.status})`);
    }
    lines.push("");
  }

  if (classified.newSkills.length > 0) {
    lines.push("## 4. 新規・未分類スキル候補");
    lines.push("");
    for (const item of classified.newSkills) {
      const tag = item.fromDiff ? "今回の差分で更新" : "HEADに存在（未分類）";
      lines.push(`- \`${item.upstreamDir}\` (${tag})`);
    }
    lines.push("");
  }

  if (commits.length > 0) {
    lines.push("## 5. 上流コミット履歴");
    lines.push("");
    for (const c of commits.slice(0, 30)) {
      lines.push(`- \`${String(c.sha || "").slice(0, 7)}\` ${c.date || ""} ${c.message || ""}`.trim());
    }
    if (commits.length > 30) {
      lines.push(`- ...ほか ${commits.length - 30} 件`);
    }
    lines.push("");
  }

  lines.push("## 保持すべきローカル規約（3-way マージ時のチェック項目）");
  lines.push("");
  for (const rule of manifest.localConventions || []) {
    lines.push(`- ${rule}`);
  }
  lines.push("");

  lines.push("## 取り込み後の完了コマンド");
  lines.push("");
  lines.push("```powershell");
  lines.push(`node scripts/check-skills-upstream.mjs --mark-synced ${headCommit}`);
  lines.push("npm run skills:validate");
  lines.push("```");
  lines.push("");

  return lines.join("\n");
}

/**
 * 同期済みコミットSHAと日付を更新した新しいマニフェストオブジェクトを返す。
 */
export function markManifestSynced(manifest, { commit, date }) {
  if (!SHA_PATTERN.test(String(commit || ""))) {
    throw new Error(`不正なコミットSHAです: ${commit}`);
  }
  const syncDate = date || new Date().toISOString().slice(0, 10);
  if (!DATE_PATTERN.test(syncDate)) {
    throw new Error(`日付は YYYY-MM-DD 形式で指定してください: ${syncDate}`);
  }
  return {
    ...manifest,
    lastSyncedCommit: commit,
    lastSyncedAt: syncDate,
  };
}

/**
 * プロジェクト内の .agents/skills-upstream.json と NOTICE を読み込み整合性検証する。
 */
export function loadAndValidateProjectManifest(rootDir = DEFAULT_PROJECT_ROOT) {
  const manifestPath = path.resolve(rootDir, ".agents/skills-upstream.json");
  const noticePath = path.resolve(rootDir, "NOTICE");
  if (!fs.existsSync(manifestPath)) {
    return {
      ok: false,
      manifest: null,
      errors: [`マニフェストが見つかりません: ${manifestPath}`],
      warnings: [],
    };
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const noticeText = fs.existsSync(noticePath) ? fs.readFileSync(noticePath, "utf8") : null;
  const result = validateSkillsManifest({ manifest, rootDir, noticeText });
  return { ...result, manifest };
}
