import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  extractRawSourceSnapshot,
  loadGenshinDataBooks,
  loadGenshinDbJapanese,
} from "./lib/genshin-sources.mjs";

const ROOT = process.cwd();
const RAW_DIR = path.join(ROOT, "data", "raw");

// 初期収録9作品で使用する原典スナップショット定義
const INITIAL_MANIFEST = [
  { sourceType: "book", rawId: "the_byakuyakoku_collection" },
  { sourceType: "artifact", rawId: "crimsonwitchofflames" },
  { sourceType: "artifact", rawId: "paleflame" },
  { sourceType: "artifact", rawId: "huskofopulentdreams" },
  { sourceType: "weapon", rawId: "oathsworneye" },
  { sourceType: "weapon", rawId: "elegyfortheend" },
  { sourceType: "weapon", rawId: "wolfsgravestone" },
  { sourceType: "material", rawId: "coralbranchofadistantsea" },
  { sourceType: "material", rawId: "jeweledbranchofadistantsea" },
  { sourceType: "material", rawId: "jadebranchofadistantsea" },
  { sourceType: "material", rawId: "goldenbranchofadistantsea" },
  { sourceType: "material", rawId: "fettersofthedandeliongladiator" },
  { sourceType: "material", rawId: "chainsofthedandeliongladiator" },
  { sourceType: "material", rawId: "shacklesofthedandeliongladiator" },
  { sourceType: "material", rawId: "dreamofthedandeliongladiator" },
];

export function parseExtractArgs(argv) {
  const args = { all: false, type: null, id: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--all") args.all = true;
    else if (a === "--type" && argv[i + 1]) args.type = argv[++i];
    else if (a === "--id" && argv[i + 1]) args.id = argv[++i];
  }
  return args;
}

function writeRawSnapshot(rawDir, sourceType, rawId, data) {
  const outDir = path.join(rawDir, sourceType);
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${rawId}.json`);
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2) + "\n", "utf8");
  return outPath;
}

async function main() {
  const args = parseExtractArgs(process.argv.slice(2));
  const dbJapanese = loadGenshinDbJapanese(ROOT);
  const booksData = loadGenshinDataBooks(ROOT);

  const targets = args.type && args.id
    ? [{ sourceType: args.type, rawId: args.id }]
    : INITIAL_MANIFEST;

  for (const target of targets) {
    const snapshot = await extractRawSourceSnapshot({
      sourceType: target.sourceType,
      rawId: target.rawId,
      dbJapanese,
      booksData,
    });
    const outPath = writeRawSnapshot(RAW_DIR, snapshot.sourceType, snapshot.rawId, snapshot.data);
    console.log(`[extract-raw] Saved ${path.relative(ROOT, outPath)}`);
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch((err) => {
    console.error(`[extract-raw] ERROR: ${err.message}`);
    process.exit(1);
  });
}
