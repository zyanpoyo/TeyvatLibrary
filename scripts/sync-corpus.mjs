import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ROOT = process.cwd();
const DB_JSON_PATH = path.join(ROOT, "node_modules", "genshin-db", "src", "min", "data.min.json");
const DATA_DIST_DIR = path.join(ROOT, "node_modules", "genshin-data", "dist");
const RAW_DIR = path.join(ROOT, "data", "raw");
const CORPUS_PATH = path.join(ROOT, "data", "shared", "official-corpus.json");

const SKIP_KEYS = new Set([
  "id", "icon", "route", "relicType", "weaponType",
  "mainStatType", "category", "images", "url", "storyId",
]);

function addTermsFromText(termCounts, text, weight = 1) {
  if (typeof text !== "string" || !text) return;
  const matches = text.match(/[ァ-ヴー]{2,}/g);
  if (!matches) return;
  for (const m of matches) {
    termCounts.set(m, (termCounts.get(m) || 0) + weight);
  }
}

function walkValue(termCounts, val, keyName = "") {
  if (typeof val === "string") {
    const weight = keyName === "name" || keyName === "title" ? 5 : 1;
    addTermsFromText(termCounts, val, weight);
  } else if (Array.isArray(val)) {
    for (const item of val) walkValue(termCounts, item, keyName);
  } else if (val && typeof val === "object") {
    for (const [k, v] of Object.entries(val)) {
      if (SKIP_KEYS.has(k)) continue;
      walkValue(termCounts, v, k);
    }
  }
}

function walkRawDirectory(dir, termCounts, customLoreCounts) {
  if (!fs.existsSync(dir)) return 0;
  let fileCount = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      fileCount += walkRawDirectory(fullPath, termCounts, customLoreCounts);
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
      fileCount++;
      const json = JSON.parse(fs.readFileSync(fullPath, "utf8"));
      walkValue(termCounts, json);
      walkValue(customLoreCounts, json);
    }
  }
  return fileCount;
}

function main() {
  const termCounts = new Map();
  const customLoreCounts = new Map();

  // 1. genshin-data の全日本語モジュール
  const dataFiles = fs.readdirSync(DATA_DIST_DIR).filter(
    (f) => f.startsWith("data_japanese_") && f.endsWith(".cjs")
  );
  for (const file of dataFiles) {
    const mod = require(path.join(DATA_DIST_DIR, file));
    walkValue(termCounts, mod.default || mod);
  }

  // 2. genshin-db の全日本語セクション
  let dbFolderCount = 0;
  if (fs.existsSync(DB_JSON_PATH)) {
    const dbRoot = JSON.parse(fs.readFileSync(DB_JSON_PATH, "utf8"));
    const jpDb = dbRoot?.data?.Japanese;
    if (jpDb) {
      dbFolderCount = Object.keys(jpDb).length;
      walkValue(termCounts, jpDb);
    }
  }

  // 3. data/raw/ 内のスナップショット（書籍 Readable 本文など npm に無いテキストを含む）
  const rawFileCount = walkRawDirectory(RAW_DIR, termCounts, customLoreCounts);

  const sortedTerms = Object.fromEntries(
    [...termCounts.entries()].sort((a, b) => b[1] - a[1])
  );
  const sortedCustom = Object.fromEntries(
    [...customLoreCounts.entries()].sort((a, b) => b[1] - a[1])
  );

  const gdataPkg = JSON.parse(
    fs.readFileSync(path.join(ROOT, "node_modules", "genshin-data", "package.json"), "utf8")
  );
  const gdbPkg = JSON.parse(
    fs.readFileSync(path.join(ROOT, "node_modules", "genshin-db", "package.json"), "utf8")
  );

  const output = {
    meta: {
      source: "genshin-data (npm) + genshin-db (npm) + data/raw snapshots",
      genshinDataVersion: gdataPkg.version,
      genshinDbVersion: gdbPkg.version,
      updatedAt: new Date().toISOString(),
      dataModuleCount: dataFiles.length,
      dbFolderCount,
      rawFileCount,
      termCount: termCounts.size,
    },
    terms: sortedTerms,
    customLoreTerms: sortedCustom,
  };

  fs.mkdirSync(path.dirname(CORPUS_PATH), { recursive: true });
  fs.writeFileSync(CORPUS_PATH, JSON.stringify(output, null, 2) + "\n", "utf8");
  console.log(
    `[sync-corpus] Synced ${termCounts.size} unique katakana terms ` +
    `(genshin-data v${gdataPkg.version}, genshin-db v${gdbPkg.version}, raw snapshots: ${rawFileCount}).`
  );
}

main();
