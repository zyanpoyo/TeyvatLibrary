import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export const VALID_SOURCE_TYPES = ["artifact", "weapon", "windglider", "book", "material"];

export const SOURCE_TYPE_TO_DB_FOLDER = {
  artifact: "artifacts",
  weapon: "weapons",
  material: "materials",
  windglider: "windgliders",
};

const YATTA_BASE_URL = "https://gi.yatta.moe/api/v2/jp";
const CORPUS_SKIP_KEYS = new Set([
  "id",
  "icon",
  "route",
  "relicType",
  "weaponType",
  "mainStatType",
  "category",
  "images",
  "url",
  "storyId",
]);

/**
 * node_modules 内の genshin-db / genshin-data パスを返す。
 */
export function getGenshinSourcePaths(rootDir = process.cwd()) {
  return {
    dbJsonPath: path.join(rootDir, "node_modules", "genshin-db", "src", "min", "data.min.json"),
    dataDistDir: path.join(rootDir, "node_modules", "genshin-data", "dist"),
  };
}

/**
 * genshin-db の日本語コレクション辞書をロードする。
 */
export function loadGenshinDbJapanese(rootDir = process.cwd()) {
  const { dbJsonPath } = getGenshinSourcePaths(rootDir);
  if (!fs.existsSync(dbJsonPath)) {
    throw new Error(`genshin-db data not found at ${dbJsonPath}. Run 'npm install' first.`);
  }
  const db = JSON.parse(fs.readFileSync(dbJsonPath, "utf8"));
  return db?.data?.Japanese || {};
}

/**
 * genshin-data の日本語書籍メタ配列をロードする。
 */
export function loadGenshinDataBooks(rootDir = process.cwd()) {
  const { dataDistDir } = getGenshinSourcePaths(rootDir);
  if (!fs.existsSync(dataDistDir)) {
    throw new Error(`genshin-data dist not found at ${dataDistDir}. Run 'npm install' first.`);
  }
  const bookFile = fs.readdirSync(dataDistDir).find(
    (f) => f.startsWith("data_japanese_books.") && f.endsWith(".cjs")
  );
  if (!bookFile) {
    throw new Error("Could not find data_japanese_books.*.cjs in genshin-data.");
  }
  const mod = require(path.join(dataDistDir, bookFile));
  return mod.default || mod;
}

/**
 * genshin-data の日本語モジュール（data_japanese_*.cjs）すべてをロードする。
 */
export function loadGenshinDataJapaneseModules(rootDir = process.cwd()) {
  const { dataDistDir } = getGenshinSourcePaths(rootDir);
  if (!fs.existsSync(dataDistDir)) {
    throw new Error(`genshin-data dist not found at ${dataDistDir}. Run 'npm install' first.`);
  }
  const dataFiles = fs.readdirSync(dataDistDir).filter(
    (f) => f.startsWith("data_japanese_") && f.endsWith(".cjs")
  );
  return dataFiles.map((file) => {
    const mod = require(path.join(dataDistDir, file));
    return { file, data: mod.default || mod };
  });
}

/**
 * genshin-data 書籍配列からスラッグまたは数値ID文字列でメタデータを検索する。
 */
export function findBookMeta(booksData, rawId) {
  return (booksData || []).find((b) => b.id === rawId || String(b._id) === rawId) || null;
}

/**
 * genshin-db の日本語辞書から sourceType と rawId に対応するエントリを解決する。
 */
export function resolveDbSourceEntry(dbJapanese, sourceType, rawId) {
  const dbFolder = SOURCE_TYPE_TO_DB_FOLDER[sourceType];
  if (!dbFolder) {
    throw new Error(
      `Unsupported sourceType '${sourceType}'. Allowed: ${VALID_SOURCE_TYPES.join(", ")}`
    );
  }
  const entry = dbJapanese?.[dbFolder]?.[rawId];
  if (!entry) {
    throw new Error(`Entry '${rawId}' not found in genshin-db (${dbFolder}).`);
  }
  return entry;
}

/**
 * Yatta API から書籍メタと各巻の日本語 Readable 本文を取得する HTTP アダプターを生成する。
 */
export function createYattaBookFetcher(
  fetchImpl = globalThis.fetch,
  baseUrl = YATTA_BASE_URL
) {
  if (typeof fetchImpl !== "function") {
    throw new TypeError("fetch implementation is required.");
  }

  return async function fetchYattaBookRaw(bookMeta) {
    const bookId = bookMeta._id;
    const bookRes = await fetchImpl(`${baseUrl}/book/${bookId}`);
    if (!bookRes.ok) {
      throw new Error(`Failed to fetch Yatta book/${bookId}: HTTP ${bookRes.status}`);
    }
    const bookJson = await bookRes.json();
    const yattaVolumes = bookJson?.data?.volume || [];

    const volumes = [];
    for (const metaVol of bookMeta.volumes || []) {
      const yattaVol = yattaVolumes.find((v) => v.id === metaVol._id || v.name === metaVol.name);
      const storyId = yattaVol?.storyId ?? metaVol.storyId;
      const readableRes = await fetchImpl(`${baseUrl}/readable/Book${storyId}`);
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
  };
}

/**
 * sourceType と rawId に基づき、genshin-db または Yatta アダプター経由で無加工スナップショットを抽出する。
 */
export async function extractRawSourceSnapshot({
  sourceType,
  rawId,
  dbJapanese,
  booksData = [],
  fetchBookRaw,
}) {
  if (!sourceType || !rawId) {
    throw new Error("sourceType and rawId are required.");
  }

  if (sourceType === "book") {
    const bookMeta = findBookMeta(booksData, rawId);
    if (!bookMeta) {
      throw new Error(`Book '${rawId}' not found in genshin-data.`);
    }
    const fetcher = fetchBookRaw ?? createYattaBookFetcher();
    if (typeof fetcher !== "function") {
      throw new TypeError("fetchBookRaw function is required for book extraction.");
    }
    const data = await fetcher(bookMeta);
    return {
      sourceType: "book",
      rawId: bookMeta.id,
      data,
    };
  }

  const entry = resolveDbSourceEntry(dbJapanese, sourceType, rawId);
  return {
    sourceType,
    rawId,
    data: entry,
  };
}

function addCorpusTermsFromText(termCounts, text, weight = 1) {
  if (typeof text !== "string" || !text) return;
  const matches = text.match(/[ァ-ヴー]{2,}/g);
  if (!matches) return;
  for (const m of matches) {
    termCounts.set(m, (termCounts.get(m) || 0) + weight);
  }
}

function walkCorpusValue(termCounts, val, keyName = "") {
  if (typeof val === "string") {
    const weight = keyName === "name" || keyName === "title" ? 5 : 1;
    addCorpusTermsFromText(termCounts, val, weight);
  } else if (Array.isArray(val)) {
    for (const item of val) walkCorpusValue(termCounts, item, keyName);
  } else if (val && typeof val === "object") {
    for (const [k, v] of Object.entries(val)) {
      if (CORPUS_SKIP_KEYS.has(k)) continue;
      walkCorpusValue(termCounts, v, k);
    }
  }
}

/**
 * genshin-data / genshin-db / data/raw スナップショットから公式カタカナ語コーパスを生成する。
 */
export function buildOfficialCorpus({
  dataModules = [],
  jpDb = {},
  rawSnapshots = [],
  genshinDataVersion = "unknown",
  genshinDbVersion = "unknown",
  updatedAt = new Date().toISOString(),
}) {
  const termCounts = new Map();

  for (const mod of dataModules) {
    const payload = mod && typeof mod === "object" && "data" in mod ? mod.data : mod;
    walkCorpusValue(termCounts, payload);
  }

  const dbFolderCount = jpDb && typeof jpDb === "object" ? Object.keys(jpDb).length : 0;
  if (dbFolderCount > 0) {
    walkCorpusValue(termCounts, jpDb);
  }

  for (const snapshot of rawSnapshots) {
    walkCorpusValue(termCounts, snapshot);
  }

  const sortedTerms = Object.fromEntries(
    [...termCounts.entries()].sort((a, b) => b[1] - a[1])
  );

  return {
    meta: {
      source: "genshin-data (npm) + genshin-db (npm) + data/raw snapshots",
      genshinDataVersion,
      genshinDbVersion,
      updatedAt,
      dataModuleCount: dataModules.length,
      dbFolderCount,
      rawFileCount: rawSnapshots.length,
      termCount: termCounts.size,
    },
    terms: sortedTerms,
  };
}
