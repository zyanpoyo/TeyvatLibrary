import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  buildSkillPatchFiles,
  classifyUpstreamChanges,
  markManifestSynced,
  renderUpstreamReport,
  validateSkillsManifest,
} from "./lib/skills-upstream.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_ROOT_DIR = path.resolve(__dirname, "..");
const DEFAULT_MANIFEST_REL = ".agents/skills-upstream.json";
const DEFAULT_OUTPUT_REL = ".scratch/skills-sync";

export function parseCliArgs(argv) {
  const parsed = {
    validateOnly: false,
    markSynced: null,
    date: null,
    from: null,
    outputDir: DEFAULT_OUTPUT_REL,
    noWrite: false,
    json: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--validate-only") {
      parsed.validateOnly = true;
    } else if (arg === "--mark-synced" && argv[i + 1]) {
      parsed.markSynced = argv[++i];
    } else if (arg === "--date" && argv[i + 1]) {
      parsed.date = argv[++i];
    } else if (arg === "--from" && argv[i + 1]) {
      parsed.from = argv[++i];
    } else if (arg === "--output-dir" && argv[i + 1]) {
      parsed.outputDir = argv[++i];
    } else if (arg === "--no-write") {
      parsed.noWrite = true;
    } else if (arg === "--json") {
      parsed.json = true;
    } else if (arg === "--help" || arg === "-h") {
      parsed.help = true;
    }
  }

  return parsed;
}

function printUsage() {
  console.log(`使い方:
  node scripts/check-skills-upstream.mjs [オプション]

オプション:
  --validate-only       ローカルのマニフェストと NOTICE 整合性のみ検証（通信なし）
  --from <sha>          lastSyncedCommit の代わりに指定コミットから比較
  --output-dir <path>   レポート・パッチ出力先（既定: .scratch/skills-sync）
  --no-write            .scratch/ へのファイル書き出しを行わない
  --json                結果を JSON 形式で出力
  --mark-synced <sha>   同期完了後に lastSyncedCommit を指定 SHA で更新
  --date <YYYY-MM-DD>   --mark-synced 時の同期日付を指定（既定: 本日）
  -h, --help            このヘルプを表示`);
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

async function fetchGithubJson(url) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "TeyvatLibrary-SkillsUpstreamSync",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  const response = await fetch(url, { headers });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`GitHub API リクエストに失敗しました (${response.status}): ${url}\n${body.slice(0, 300)}`);
  }
  return response.json();
}

function writeSyncArtifacts({ outputDir, reportMarkdown, patchFiles }) {
  fs.mkdirSync(outputDir, { recursive: true });
  const reportPath = path.join(outputDir, "report.md");
  fs.writeFileSync(reportPath, reportMarkdown, "utf8");

  const patchesDir = path.join(outputDir, "patches");
  fs.rmSync(patchesDir, { recursive: true, force: true });
  if (patchFiles.size > 0) {
    fs.mkdirSync(patchesDir, { recursive: true });
    for (const [skillName, content] of patchFiles.entries()) {
      fs.writeFileSync(path.join(patchesDir, `${skillName}.patch`), content, "utf8");
    }
  }

  return { reportPath, patchesDir, patchCount: patchFiles.size };
}

export async function runCli(argv = process.argv.slice(2), rootDir = DEFAULT_ROOT_DIR) {
  const args = parseCliArgs(argv);
  if (args.help) {
    printUsage();
    return 0;
  }

  const manifestPath = path.resolve(rootDir, DEFAULT_MANIFEST_REL);
  const noticePath = path.resolve(rootDir, "NOTICE");
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`マニフェストが見つかりません: ${manifestPath}`);
  }

  const manifest = readJsonFile(manifestPath);
  const noticeText = fs.existsSync(noticePath) ? fs.readFileSync(noticePath, "utf8") : null;

  if (args.markSynced) {
    const updated = markManifestSynced(manifest, { commit: args.markSynced, date: args.date || undefined });
    const validation = validateSkillsManifest({ manifest: updated, rootDir, noticeText });
    if (!validation.ok) {
      throw new Error(`マニフェスト検証に失敗しました:\n- ${validation.errors.join("\n- ")}`);
    }
    fs.writeFileSync(manifestPath, `${JSON.stringify(updated, null, 2)}\n`, "utf8");
    console.log(
      `マニフェストを更新しました: lastSyncedCommit=${updated.lastSyncedCommit} (${updated.lastSyncedAt})`
    );
    return 0;
  }

  const validation = validateSkillsManifest({ manifest, rootDir, noticeText });
  if (!validation.ok) {
    for (const err of validation.errors) {
      console.error(`[ERROR] ${err}`);
    }
    return 1;
  }
  for (const warn of validation.warnings) {
    console.warn(`[WARN] ${warn}`);
  }

  if (args.validateOnly) {
    const count = Object.keys(manifest.trackedSkills).length;
    console.log(
      `OK: マニフェストと NOTICE の整合性を確認しました（追跡スキル: ${count}件 / 基準: ${manifest.lastSyncedCommit.slice(0, 7)}）`
    );
    return 0;
  }

  const { owner, repo, branch } = manifest.upstream;
  const baseCommit = args.from || manifest.lastSyncedCommit;
  const compareUrl = `https://api.github.com/repos/${owner}/${repo}/compare/${encodeURIComponent(baseCommit)}...${encodeURIComponent(branch)}`;
  const compareData = await fetchGithubJson(compareUrl);

  const commits = (compareData.commits || []).map((c) => ({
    sha: c.sha,
    date: String(c.commit?.committer?.date || "").slice(0, 10),
    message: String(c.commit?.message || "").split("\n")[0],
  }));

  const headCommit =
    commits.length > 0
      ? commits[commits.length - 1].sha
      : compareData.merge_base_commit?.sha || compareData.base_commit?.sha || baseCommit;
  const headDate =
    commits.length > 0
      ? commits[commits.length - 1].date
      : String(compareData.base_commit?.commit?.committer?.date || "").slice(0, 10);

  let headTreePaths = [];
  try {
    const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(headCommit)}?recursive=1`;
    const treeData = await fetchGithubJson(treeUrl);
    headTreePaths = (treeData.tree || [])
      .filter((entry) => entry.type === "blob" && typeof entry.path === "string")
      .map((entry) => entry.path);
  } catch (err) {
    console.warn(`[WARN] HEAD ツリー一覧の取得をスキップしました: ${err.message}`);
  }

  const classified = classifyUpstreamChanges({
    manifest,
    compareFiles: compareData.files || [],
    headTreePaths,
  });
  const patchFiles = buildSkillPatchFiles(classified);
  const reportMarkdown = renderUpstreamReport({
    manifest,
    baseCommit,
    headCommit,
    headDate,
    commits,
    classified,
  });

  let written = null;
  if (!args.noWrite) {
    written = writeSyncArtifacts({
      outputDir: path.resolve(rootDir, args.outputDir),
      reportMarkdown,
      patchFiles,
    });
  }

  if (args.json) {
    console.log(
      JSON.stringify(
        {
          upstream: `${owner}/${repo}`,
          baseCommit,
          headCommit,
          headDate,
          commitCount: commits.length,
          classified,
          written,
        },
        null,
        2
      )
    );
    return 0;
  }

  const notableUnmappedCount = classified.unmappedTrackedFiles.filter((f) => !f.isAgentMeta).length;
  console.log(`上流リポジトリ: ${owner}/${repo} (${branch})`);
  console.log(`比較範囲:       ${baseCommit.slice(0, 7)} -> ${headCommit.slice(0, 7)} (${commits.length} commits)`);
  console.log(`採用スキル更新: ${classified.updatedTracked.length} ファイル (${patchFiles.size} スキル)`);
  console.log(`未マッピング:   ${notableUnmappedCount} ファイル`);
  console.log(`廃止・移動:     ${classified.deprecatedOrRemoved.length} 件`);
  console.log(`新規スキル候補: ${classified.newSkills.length} 件`);
  console.log(`LICENSE変更:    ${classified.licenseChanged.length} 件`);

  if (classified.updatedTracked.length > 0) {
    console.log("\n更新対象スキル:");
    const grouped = new Set(classified.updatedTracked.map((item) => item.skill));
    for (const skill of grouped) {
      console.log(`  - ${skill}`);
    }
  }

  if (classified.newSkills.length > 0) {
    console.log("\n新規・未分類スキル候補:");
    for (const item of classified.newSkills) {
      console.log(`  - ${item.upstreamDir}`);
    }
  }

  if (written) {
    console.log(`\nレポート出力: ${path.relative(rootDir, written.reportPath).replace(/\\/g, "/")}`);
    if (written.patchCount > 0) {
      console.log(
        `パッチ出力:   ${path.relative(rootDir, written.patchesDir).replace(/\\/g, "/")} (${written.patchCount} 件)`
      );
    }
  }

  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((err) => {
      console.error(`[ERROR] ${err.message}`);
      process.exitCode = 1;
    });
}
