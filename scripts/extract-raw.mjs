import fs from "node:fs";
import path from "node:path";
import {
  SOURCE_TYPE_TO_DB_FOLDER,
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

function parseArgs(argv) {
  const args = { all: false, type: null, id: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--all") args.all = true;
    else if (a === "--type" && argv[i + 1]) args.type = argv[++i];
    else if (a === "--id" && argv[i + 1]) args.id = argv[++i];
  }
  return args;
}

async function fetchYattaBookRaw(bookMeta) {
  const bookId = bookMeta._id;
  const bookRes = await fetch(`https://gi.yatta.moe/api/v2/jp/book/${bookId}`);
  if (!bookRes.ok) {
    throw new Error(`Failed to fetch Yatta book/${bookId}: HTTP ${bookRes.status}`);
  }
  const bookJson = await bookRes.json();
  const yattaVolumes = bookJson?.data?.volume || [];

  const volumes = [];
  for (const metaVol of bookMeta.volumes || []) {
    const yattaVol = yattaVolumes.find((v) => v.id === metaVol._id || v.name === metaVol.name);
    const storyId = yattaVol?.storyId ?? metaVol.storyId;
    const readableRes = await fetch(`https://gi.yatta.moe/api/v2/jp/readable/Book${storyId}`);
    if (!readableRes.ok) {
      throw new Error(`Failed to fetch Yatta readable/Book${storyId}: HTTP ${readableRes.status}`);
    }
    const readableJson = await readableRes.json();
    volumes.push({
      id: metaVol._id,
      name: metaVol.name,
      description: metaVol.description,
      storyId: String(storyId),
      text: readableJson?.data || "",
    });
  }

  return {
    _id: bookMeta._id,
    id: bookMeta.id,
    name: bookMeta.name,
    rarity: bookMeta.rarity,
    volumes,
  };
}

function writeRawSnapshot(sourceType, rawId, data) {
  const outDir = path.join(RAW_DIR, sourceType);
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${rawId}.json`);
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2) + "\n", "utf8");
  return outPath;
}

async function extractItem(sourceType, rawId, dbJapanese, booksData) {
  if (sourceType === "book") {
    const bookMeta = booksData.find((b) => b.id === rawId || String(b._id) === rawId);
    if (!bookMeta) {
      throw new Error(`Book '${rawId}' not found in genshin-data.`);
    }
    const rawBook = await fetchYattaBookRaw(bookMeta);
    return writeRawSnapshot("book", bookMeta.id, rawBook);
  }

  const dbFolder = SOURCE_TYPE_TO_DB_FOLDER[sourceType];
  if (!dbFolder) {
    throw new Error(`Unsupported sourceType '${sourceType}'. Allowed: book, artifact, weapon, material, windglider`);
  }
  const entry = dbJapanese?.[dbFolder]?.[rawId];
  if (!entry) {
    throw new Error(`Entry '${rawId}' not found in genshin-db (${dbFolder}).`);
  }
  return writeRawSnapshot(sourceType, rawId, entry);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dbJapanese = loadGenshinDbJapanese();
  const booksData = loadGenshinDataBooks();

  const targets = args.type && args.id
    ? [{ sourceType: args.type, rawId: args.id }]
    : INITIAL_MANIFEST;

  for (const target of targets) {
    const outPath = await extractItem(target.sourceType, target.rawId, dbJapanese, booksData);
    console.log(`[extract-raw] Saved ${path.relative(ROOT, outPath)}`);
  }
}

main().catch((err) => {
  console.error(`[extract-raw] ERROR: ${err.message}`);
  process.exit(1);
});
