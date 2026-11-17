import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  SOURCE_TYPE_TO_DB_FOLDER,
  loadGenshinDataBooks,
  loadGenshinDbJapanese,
} from "./lib/genshin-sources.mjs";
import {
  VALID_PIECES,
  createCorpusChecker,
  resolveExpectedRawText,
  splitIntoParagraphBlocks,
} from "./lib/validator.mjs";

const SHORT_TEXT_WARN_THRESHOLD = 300;

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

/**
 * CLI 引数を inspect / search サブコマンド向けにパースする。
 */
export function parseCliArgs(argv) {
  const [command, ...rest] = argv;
  const parsed = {
    command: command || null,
    type: null,
    id: null,
    json: false,
    checkText: null,
    collection: "all",
    limit: 20,
    keyword: null,
  };

  const positionals = [];
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg === "--type" && rest[i + 1]) {
      parsed.type = rest[++i];
    } else if (arg === "--id" && rest[i + 1]) {
      parsed.id = rest[++i];
    } else if (arg === "--check-text" && rest[i + 1]) {
      parsed.checkText = rest[++i];
    } else if (arg === "--collection" && rest[i + 1]) {
      parsed.collection = rest[++i];
    } else if (arg === "--limit" && rest[i + 1]) {
      const n = Number(rest[++i]);
      if (Number.isInteger(n) && n > 0) parsed.limit = n;
    } else if (arg === "--json") {
      parsed.json = true;
    } else if (!arg.startsWith("--")) {
      positionals.push(arg);
    }
  }

  if (positionals.length > 0) {
    parsed.keyword = positionals.join(" ");
  }
  return parsed;
}

/**
 * validator.mjs のコーパスチェッカーを再利用して未登録カタカナ/NG表記を抽出する。
 */
export function collectKatakanaIssues(labeledTexts, corpusChecker) {
  if (!corpusChecker) return [];
  const errors = [];
  for (const { label, text } of labeledTexts) {
    if (text) corpusChecker(text, label, errors);
  }
  return errors;
}

function summarizeLengthWarning(charCount) {
  if (charCount === 0) return "本文テキストが 0 文字です（長文ストーリー未収録）";
  if (charCount < SHORT_TEXT_WARN_THRESHOLD) {
    return `本文テキストが ${charCount} 文字の短文です（${SHORT_TEXT_WARN_THRESHOLD}文字未満）`;
  }
  return null;
}

function inspectArtifactItem(rawId, entry, corpusChecker, extraCheckText) {
  const chapters = [];
  const labeledTexts = [];
  let totalRawCharCount = 0;

  for (const piece of VALID_PIECES) {
    const pieceData = entry[piece];
    if (!pieceData) continue;
    const rawText = typeof pieceData.story === "string"
      ? resolveExpectedRawText(entry, { sourceType: "artifact", rawId, piece })
      : "";
    const paragraphs = rawText ? splitIntoParagraphBlocks(rawText) : [];
    totalRawCharCount += rawText.length;

    chapters.push({
      piece,
      name: pieceData.name || piece,
      epigraph: pieceData.description || "",
      rawCharCount: rawText.length,
      nonWhitespaceCharCount: rawText.replace(/\s+/g, "").length,
      paragraphs,
    });
    labeledTexts.push({ label: `${rawId}.${piece}.story`, text: rawText });
    labeledTexts.push({ label: `${rawId}.${piece}.description`, text: pieceData.description || "" });
  }

  if (extraCheckText) {
    labeledTexts.push({ label: "check-text", text: extraCheckText });
  }

  const lengthWarning = summarizeLengthWarning(totalRawCharCount);
  return {
    sourceType: "artifact",
    rawId,
    name: entry.name || rawId,
    rarityList: entry.rarityList || [],
    effect2Pc: entry.effect2Pc || "",
    effect4Pc: entry.effect4Pc || "",
    totalRawCharCount,
    warnings: lengthWarning ? [lengthWarning] : [],
    chapters,
    katakanaIssues: collectKatakanaIssues(labeledTexts, corpusChecker),
  };
}

function inspectSingleTextItem(sourceType, rawId, entry, corpusChecker, extraCheckText) {
  const field = sourceType === "material" ? "description" : "story";
  const rawFieldValue = entry[field];
  const rawText = typeof rawFieldValue === "string" && rawFieldValue.trim().length > 0
    ? resolveExpectedRawText(entry, { sourceType, rawId, field })
    : "";
  const paragraphs = rawText ? splitIntoParagraphBlocks(rawText) : [];
  const lengthWarning = summarizeLengthWarning(rawText.length);

  const labeledTexts = [
    { label: `${rawId}.${field}`, text: rawText },
    { label: `${rawId}.description`, text: entry.description || "" },
  ];
  if (extraCheckText) {
    labeledTexts.push({ label: "check-text", text: extraCheckText });
  }

  return {
    sourceType,
    rawId,
    name: entry.name || rawId,
    rarity: entry.rarity ?? null,
    weaponText: entry.weaponText || null,
    effectName: entry.effectName || null,
    effectTemplateRaw: entry.effectTemplateRaw || null,
    epigraph: sourceType === "material" ? "" : (entry.description || ""),
    totalRawCharCount: rawText.length,
    nonWhitespaceCharCount: rawText.replace(/\s+/g, "").length,
    warnings: lengthWarning ? [lengthWarning] : [],
    paragraphs,
    katakanaIssues: collectKatakanaIssues(labeledTexts, corpusChecker),
  };
}

function inspectBookItem(rawId, booksData, rawBookJson, corpusChecker, extraCheckText) {
  const bookMeta = (booksData || []).find((b) => b.id === rawId || String(b._id) === rawId);
  if (!bookMeta && !rawBookJson) {
    throw new Error(`Book '${rawId}' not found in genshin-data.`);
  }

  const sourceVolumes = rawBookJson?.volumes || [];
  const labeledTexts = [];
  let totalRawCharCount = 0;

  const volumes = (bookMeta?.volumes || sourceVolumes).map((vol) => {
    const volId = vol._id ?? vol.id;
    const rawVol = sourceVolumes.find((rv) => rv.id === volId || rv.name === vol.name);
    const text = rawVol?.text
      ? resolveExpectedRawText({ volumes: [rawVol] }, { sourceType: "book", rawId, volumeId: rawVol.id })
      : "";
    const paragraphs = text ? splitIntoParagraphBlocks(text) : [];
    totalRawCharCount += text.length;
    if (text) labeledTexts.push({ label: `${rawId}.vol(${volId})`, text });

    return {
      volumeId: volId,
      name: vol.name,
      epigraph: vol.description || rawVol?.description || "",
      storyId: String(vol.storyId ?? rawVol?.storyId ?? ""),
      rawCharCount: text.length,
      paragraphs,
    };
  });

  if (extraCheckText) {
    labeledTexts.push({ label: "check-text", text: extraCheckText });
  }

  const warnings = [];
  if (!rawBookJson) {
    warnings.push(
      `書籍の Readable 本文は未抽出です。'npm run extract-raw -- --type book --id ${bookMeta?.id || rawId}' で取得できます。`
    );
  } else {
    const lenWarn = summarizeLengthWarning(totalRawCharCount);
    if (lenWarn) warnings.push(lenWarn);
  }

  return {
    sourceType: "book",
    rawId: bookMeta?.id || rawId,
    name: bookMeta?.name || rawBookJson?.name || rawId,
    rarity: bookMeta?.rarity ?? rawBookJson?.rarity ?? null,
    totalRawCharCount,
    warnings,
    volumes,
    katakanaIssues: collectKatakanaIssues(labeledTexts, corpusChecker),
  };
}

/**
 * 原典アイテムのメタ情報・文字数警告・正規化段落・カタカナ検証結果を生成する。
 */
export function buildInspectReport({
  sourceType,
  rawId,
  dbJapanese,
  booksData = [],
  rawBookJson = null,
  corpusChecker = null,
  checkText = null,
}) {
  if (!sourceType || !rawId) {
    throw new Error("--type <sourceType> と --id <rawId> を指定してください。");
  }

  if (sourceType === "book") {
    return inspectBookItem(rawId, booksData, rawBookJson, corpusChecker, checkText);
  }

  const dbFolder = SOURCE_TYPE_TO_DB_FOLDER[sourceType];
  if (!dbFolder) {
    throw new Error(`Unsupported sourceType '${sourceType}'. Allowed: artifact, weapon, material, windglider, book`);
  }

  const entry = dbJapanese?.[dbFolder]?.[rawId];
  if (!entry) {
    throw new Error(`Entry '${rawId}' not found in genshin-db (${dbFolder}).`);
  }

  if (sourceType === "artifact") {
    return inspectArtifactItem(rawId, entry, corpusChecker, checkText);
  }
  return inspectSingleTextItem(sourceType, rawId, entry, corpusChecker, checkText);
}

function buildSnippet(text, index, keywordLength) {
  const start = Math.max(0, index - 24);
  const end = Math.min(text.length, index + keywordLength + 56);
  const slice = text.slice(start, end).replace(/\r?\n+/g, " ");
  return `${start > 0 ? "…" : ""}${slice}${end < text.length ? "…" : ""}`;
}

function findFirstMatchInValue(value, keywordLower, pathPrefix = "") {
  if (typeof value === "string") {
    const idx = value.toLowerCase().indexOf(keywordLower);
    if (idx !== -1) {
      return {
        matchedField: pathPrefix || "value",
        snippet: buildSnippet(value, idx, keywordLower.length),
      };
    }
    return null;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const hit = findFirstMatchInValue(value[i], keywordLower, `${pathPrefix}[${i}]`);
      if (hit) return hit;
    }
    return null;
  }
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if (k === "images" || k === "url" || k === "icon") continue;
      const nextPath = pathPrefix ? `${pathPrefix}.${k}` : k;
      const hit = findFirstMatchInValue(v, keywordLower, nextPath);
      if (hit) return hit;
    }
  }
  return null;
}

/**
 * genshin-db / genshin-data / raw 書籍からキーワード横断検索を実行する。
 */
export function searchLoreEntries({
  keyword,
  dbJapanese = {},
  booksData = [],
  rawBookMap = {},
  collection = "all",
  limit = 20,
}) {
  const cleanKeyword = String(keyword || "").trim();
  if (!cleanKeyword) {
    throw new Error("検索キーワードを指定してください。例: npm run lore:search -- ギヨタン");
  }

  const keywordLower = cleanKeyword.toLowerCase();
  const results = [];

  const targetCollections = collection === "all"
    ? Object.keys(dbJapanese).filter((k) => k !== "books")
    : collection === "books"
      ? []
      : [collection];

  for (const colName of targetCollections) {
    const entries = dbJapanese[colName];
    if (!entries || typeof entries !== "object") continue;

    for (const [rawId, entry] of Object.entries(entries)) {
      const hit = findFirstMatchInValue(entry, keywordLower);
      if (hit) {
        results.push({
          collection: colName,
          rawId,
          name: entry?.name || rawId,
          matchedField: hit.matchedField,
          snippet: hit.snippet,
        });
        if (results.length >= limit) return results;
      }
    }
  }

  if (collection === "all" || collection === "books") {
    for (const book of booksData) {
      const rawBook = rawBookMap[book.id] || null;
      const hit = findFirstMatchInValue(rawBook || book, keywordLower);
      if (hit) {
        results.push({
          collection: "books",
          rawId: book.id,
          name: book.name || book.id,
          matchedField: hit.matchedField,
          snippet: hit.snippet,
        });
        if (results.length >= limit) return results;
      }
    }
  }

  return results;
}

function loadCorpusCheckerIfPresent(rootDir) {
  const oePath = path.join(rootDir, "data", "shared", "official-entities.json");
  const corpusPath = path.join(rootDir, "data", "shared", "official-corpus.json");
  const officialEntities = readJsonIfExists(oePath);
  const officialCorpus = readJsonIfExists(corpusPath);
  if (!officialEntities || !officialCorpus) return null;
  return createCorpusChecker(officialEntities, officialCorpus);
}

function loadRawBookMap(rootDir) {
  const rawBookDir = path.join(rootDir, "data", "raw", "book");
  const map = {};
  if (!fs.existsSync(rawBookDir)) return map;
  for (const entry of fs.readdirSync(rawBookDir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith(".json")) {
      const slug = entry.name.replace(/\.json$/, "");
      map[slug] = JSON.parse(fs.readFileSync(path.join(rawBookDir, entry.name), "utf8"));
    }
  }
  return map;
}

function printInspectHuman(report) {
  console.log(`=== [${report.sourceType}] ${report.name} (${report.rawId}) ===`);
  if (report.weaponText || report.rarity) {
    console.log(`種別/レア度: ${[report.weaponText, report.rarity ? `★${report.rarity}` : null].filter(Boolean).join(" / ")}`);
  }
  if (report.effectName) {
    console.log(`スキル: ${report.effectName} — ${report.effectTemplateRaw || ""}`);
  }
  if (report.effect2Pc || report.effect4Pc) {
    console.log(`2セット: ${report.effect2Pc}`);
    console.log(`4セット: ${report.effect4Pc}`);
  }
  if (report.epigraph) {
    console.log(`説明 (epigraph): ${report.epigraph}`);
  }
  console.log(`総文字数 (空白改行含): ${report.totalRawCharCount}`);

  for (const warn of report.warnings || []) {
    console.log(`⚠️ ${warn}`);
  }

  if (report.chapters) {
    for (const ch of report.chapters) {
      console.log(`\n--- ${ch.piece}: ${ch.name} (${ch.rawCharCount}字 / ${ch.paragraphs.length}段落) ---`);
      console.log(`epigraph: ${ch.epigraph}`);
      ch.paragraphs.forEach((p, idx) => console.log(`[${idx}] ${p}`));
    }
  } else if (report.volumes) {
    for (const v of report.volumes) {
      console.log(`\n--- volume ${v.volumeId}: ${v.name} (${v.rawCharCount}字 / ${v.paragraphs.length}段落) ---`);
      console.log(`epigraph: ${v.epigraph}`);
      v.paragraphs.forEach((p, idx) => console.log(`[${idx}] ${p}`));
    }
  } else if (report.paragraphs) {
    console.log(`\n--- paragraphs (${report.paragraphs.length}段落) ---`);
    report.paragraphs.forEach((p, idx) => console.log(`[${idx}] ${p}`));
  }

  if (report.katakanaIssues.length > 0) {
    console.log(`\n⚠️ コーパス未登録語・表記注意 (${report.katakanaIssues.length}件):`);
    report.katakanaIssues.forEach((issue) => console.log("  - " + issue));
  } else {
    console.log("\n✅ コーパス・NG表記チェック: 問題なし");
  }
}

function main() {
  const rootDir = process.cwd();
  const args = parseCliArgs(process.argv.slice(2));
  const dbJapanese = loadGenshinDbJapanese(rootDir);
  const booksData = loadGenshinDataBooks(rootDir);

  if (args.command === "inspect") {
    const rawBookJson = args.type === "book" && args.id
      ? readJsonIfExists(path.join(rootDir, "data", "raw", "book", `${args.id}.json`))
      : null;
    const corpusChecker = loadCorpusCheckerIfPresent(rootDir);
    const report = buildInspectReport({
      sourceType: args.type,
      rawId: args.id,
      dbJapanese,
      booksData,
      rawBookJson,
      corpusChecker,
      checkText: args.checkText,
    });
    if (args.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      printInspectHuman(report);
    }
    return;
  }

  if (args.command === "search") {
    const rawBookMap = loadRawBookMap(rootDir);
    const results = searchLoreEntries({
      keyword: args.keyword,
      dbJapanese,
      booksData,
      rawBookMap,
      collection: args.collection,
      limit: args.limit,
    });
    if (args.json) {
      console.log(JSON.stringify(results, null, 2));
      return;
    }
    console.log(`=== 検索結果: "${args.keyword}" (${results.length}件 / limit=${args.limit}) ===`);
    for (const r of results) {
      console.log(`- [${r.collection}] ${r.rawId} (${r.name}) @ ${r.matchedField}: ${r.snippet}`);
    }
    return;
  }

  console.error(
    "Usage:\n" +
    "  npm run lore:inspect -- --type <artifact|weapon|material|windglider|book> --id <rawId> [--json] [--check-text \"...\"]\n" +
    "  npm run lore:search -- <keyword> [--collection <all|characters|artifacts|weapons|materials|windgliders|books>] [--limit <n>] [--json]"
  );
  process.exit(1);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    main();
  } catch (err) {
    console.error(`[lore-tools] ERROR: ${err.message}`);
    process.exit(1);
  }
}
