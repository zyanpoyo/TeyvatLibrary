import fs from "node:fs";
import path from "node:path";
import { validateAgainstJsonSchema } from "./json-schema.mjs";

export const VALID_SHELF_CATEGORIES = ["book", "artifact", "weapon", "attire", "chronicle"];
export const VALID_ENTITY_KINDS = ["character", "god", "organization", "concept", "place"];
export const VALID_IDENTITY_PREFIXES = ["正体：", "解説：", "有力説："];
export const VALID_SOURCE_TYPES = ["artifact", "weapon", "windglider", "book", "material"];
export const VALID_PACKAGES = ["genshin-db", "genshin-data", "yatta"];
export const VALID_PIECES = ["flower", "plume", "sands", "goblet", "circlet"];

export function stripInlineTags(text) {
  return String(text || "").replace(/\{\{([a-z0-9_]+)\|([^}]+)\}\}/g, "$2");
}

export function normalizeWhitespaceForComparison(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function splitIntoParagraphBlocks(rawText) {
  return normalizeWhitespaceForComparison(rawText)
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);
}

export function extractTargetField(rawJson, sourceRef) {
  const { sourceType, piece, volumeId, field } = sourceRef;

  if (sourceType === "artifact") {
    if (!piece || !VALID_PIECES.includes(piece)) {
      throw new Error(`sourceRef.piece is invalid or missing for artifact (${piece})`);
    }
    const targetField = field || "story";
    const val = rawJson?.[piece]?.[targetField];
    if (typeof val !== "string") {
      throw new Error(`Missing raw text at artifact.${piece}.${targetField}`);
    }
    return val;
  }

  if (sourceType === "book") {
    if (typeof volumeId !== "number") {
      throw new Error(`sourceRef.volumeId must be a number for book (${volumeId})`);
    }
    const vol = (rawJson?.volumes || []).find((v) => v.id === volumeId);
    if (!vol) {
      throw new Error(`Volume id ${volumeId} not found in raw book JSON`);
    }
    const targetField = field || "text";
    const val = vol[targetField];
    if (typeof val !== "string") {
      throw new Error(`Missing raw text at book.volume(${volumeId}).${targetField}`);
    }
    return val;
  }

  if (sourceType === "weapon" || sourceType === "windglider") {
    const targetField = field || "story";
    const val = rawJson?.[targetField];
    if (typeof val !== "string") {
      throw new Error(`Missing raw text at ${sourceType}.${targetField}`);
    }
    return val;
  }

  if (sourceType === "material") {
    const targetField = field || "description";
    const val = rawJson?.[targetField];
    if (typeof val !== "string") {
      throw new Error(`Missing raw text at material.${targetField}`);
    }
    return val;
  }

  throw new Error(`Unsupported sourceType: ${sourceType}`);
}

export function resolveExpectedRawText(rawJson, sourceRef) {
  let rawText = extractTargetField(rawJson, sourceRef);

  // Step A: 標準装飾タグのサニタイズ（文字自体は変更しない）
  rawText = rawText
    .replace(/\r\n/g, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?color[^>]*>/gi, "")
    .replace(/<\/?span[^>]*>/gi, "")
    .trim();

  // Step B: 宣言されたシステム定型プレフィックスの除去
  if (sourceRef.stripPrefix) {
    if (!rawText.startsWith(sourceRef.stripPrefix)) {
      throw new Error(
        `stripPrefix ${JSON.stringify(sourceRef.stripPrefix)} does not match start of raw text: ${JSON.stringify(rawText.slice(0, 40))}`
      );
    }
    rawText = rawText.slice(sourceRef.stripPrefix.length).trim();
  }

  // Step C: 段落スライス
  if (sourceRef.paragraphSlice) {
    if (
      !Array.isArray(sourceRef.paragraphSlice) ||
      sourceRef.paragraphSlice.length !== 2 ||
      !Number.isInteger(sourceRef.paragraphSlice[0]) ||
      !Number.isInteger(sourceRef.paragraphSlice[1])
    ) {
      throw new Error(`Invalid paragraphSlice: ${JSON.stringify(sourceRef.paragraphSlice)}`);
    }
    const [start, end] = sourceRef.paragraphSlice;
    const blocks = splitIntoParagraphBlocks(rawText);
    if (start < 0 || end > blocks.length || start >= end) {
      throw new Error(
        `paragraphSlice [${start}, ${end}] out of bounds (total blocks: ${blocks.length})`
      );
    }
    rawText = blocks.slice(start, end).join("\n\n");
  }

  return normalizeWhitespaceForComparison(rawText);
}

export function resolveActualPlainText(paragraphs) {
  const joined = (paragraphs || []).map((p) => stripInlineTags(p)).join("\n\n");
  return normalizeWhitespaceForComparison(joined);
}

export function findFirstDiffContext(expected, actual) {
  const maxLen = Math.max(expected.length, actual.length);
  for (let i = 0; i < maxLen; i++) {
    if (expected[i] !== actual[i]) {
      const from = Math.max(0, i - 16);
      return {
        index: i,
        expectedSnippet: expected.slice(from, i + 28),
        actualSnippet: actual.slice(from, i + 28),
      };
    }
  }
  return null;
}

// カタカナゆらぎ正規化と類似語サジェスト
function normalizeKatakana(str) {
  return str
    .replace(/ー/g, "")
    .replace(/ッ/g, "")
    .replace(/ヴァ/g, "バ").replace(/ヴィ/g, "ビ").replace(/ヴ/g, "ブ").replace(/ヴェ/g, "ベ").replace(/ヴォ/g, "ボ")
    .replace(/ファ/g, "ハ").replace(/フィ/g, "ヒ").replace(/フェ/g, "ヘ").replace(/フォ/g, "ホ")
    .replace(/ティ/g, "テ").replace(/ディ/g, "デ").replace(/ドゥ/g, "ド").replace(/トゥ/g, "ト")
    .replace(/ァ/g, "ア").replace(/ィ/g, "イ").replace(/ゥ/g, "ウ").replace(/ェ/g, "エ").replace(/ォ/g, "オ")
    .replace(/ャ/g, "ヤ").replace(/ュ/g, "ユ").replace(/ョ/g, "ヨ");
}

function normalizeLabial(str) {
  return normalizeKatakana(str)
    .replace(/[パバ]/g, "ハ").replace(/[ピビ]/g, "ヒ").replace(/[プブ]/g, "フ").replace(/[ペベ]/g, "ヘ").replace(/[ポボ]/g, "ホ");
}

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (Math.abs(m - n) > 3) return 99;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

export function createCorpusChecker(officialEntities, officialCorpus) {
  const corpusTermsMap = officialCorpus.terms || {};
  const corpusTermList = Object.keys(corpusTermsMap);

  const approvedSet = new Set([
    ...corpusTermList,
    ...(officialEntities.officialMediaTerms || []),
    ...(officialEntities.allowedCommonKatakana || []),
  ]);
  const ngMap = officialEntities.ngVariants || {};

  const normalizedIndex = new Map();
  const labialIndex = new Map();
  for (const term of corpusTermList) {
    const norm = normalizeKatakana(term);
    if (!normalizedIndex.has(norm)) normalizedIndex.set(norm, []);
    normalizedIndex.get(norm).push(term);

    const lab = normalizeLabial(term);
    if (!labialIndex.has(lab)) labialIndex.set(lab, []);
    labialIndex.get(lab).push(term);
  }

  function suggestOfficialTerms(unknownWord) {
    const candidates = new Map();
    const normTarget = normalizeKatakana(unknownWord);
    const labTarget = normalizeLabial(unknownWord);

    for (const match of normalizedIndex.get(normTarget) || []) {
      candidates.set(match, 0);
    }
    for (const match of labialIndex.get(labTarget) || []) {
      if (!candidates.has(match)) candidates.set(match, 0.2);
    }
    for (const term of corpusTermList) {
      if (candidates.has(term)) continue;
      if (Math.abs(term.length - unknownWord.length) > 2) continue;
      const dist = levenshtein(unknownWord, term);
      const normDist = levenshtein(normTarget, normalizeKatakana(term));
      const score = Math.min(dist, normDist + 0.5);
      if (score <= 2) candidates.set(term, score);
    }

    return [...candidates.entries()]
      .sort((a, b) => a[1] - b[1] || (corpusTermsMap[b[0]] || 0) - (corpusTermsMap[a[0]] || 0))
      .slice(0, 4)
      .map(([term]) => `「${term}」`);
  }

  return function checkText(text, contextLabel, errors) {
    if (!text) return;
    for (const [ng, right] of Object.entries(ngMap)) {
      if (text.includes(ng)) {
        errors.push(`[NG固有名詞検出] ${contextLabel}: 「${ng}」が含まれています -> 公式表記「${right}」に修正してください。`);
      }
    }

    const stripped = stripInlineTags(text);
    const katakanaMatches = stripped.match(/[ァ-ヴー]{2,}/g) || [];
    for (const word of katakanaMatches) {
      if (!approvedSet.has(word)) {
        const suggestions = suggestOfficialTerms(word);
        const hint = suggestions.length > 0
          ? ` もしかして公式表記: ${suggestions.join(", ")}`
          : " 公式テキストに見当たらない表記です。一般語なら official-entities.json の allowedCommonKatakana を確認してください。";
        errors.push(`[公式コーパス未登録カタカナ] ${contextLabel}: 「${word}」は公式データ内に存在しません。${hint}`);
      }
    }
  };
}

export function validateEntitiesMaster(entities, errors, checkText, titleLookup = null) {
  const validKinds = new Set(VALID_ENTITY_KINDS);
  for (const [entityId, entity] of Object.entries(entities)) {
    const label = `entities.${entityId}`;
    if (!/^[a-z0-9_]+$/.test(entityId)) {
      errors.push(`[マスタID不正] ${label}: entityId は半角英小文字・数字・アンダースコアのみ使用可能です。`);
    }
    if (!entity || typeof entity !== "object") {
      errors.push(`[マスタ型不正] ${label}: オブジェクトである必要があります。`);
      continue;
    }
    if (!entity.name || typeof entity.name !== "string") {
      errors.push(`[マスタ欠落] ${label}.name が未設定です。`);
    }
    if (!validKinds.has(entity.kind)) {
      errors.push(`[マスタ種別不正] ${label}.kind ('${entity.kind}') は ${[...validKinds].join("/")} のいずれかにしてください。`);
    }
    if (!VALID_IDENTITY_PREFIXES.some((p) => (entity.defaultIdentity || "").startsWith(p))) {
      errors.push(`[確度区分欠落] ${label}.defaultIdentity は ${VALID_IDENTITY_PREFIXES.join(" / ")} のいずれかで始めてください。`);
    }
    if (!entity.defaultDesc || typeof entity.defaultDesc !== "string") {
      errors.push(`[マスタ欠落] ${label}.defaultDesc が未設定です。`);
    }
    if (!entity.defaultEvidence || typeof entity.defaultEvidence !== "string") {
      errors.push(`[マスタ欠落] ${label}.defaultEvidence が未設定です。`);
    }
    checkText(entity.name, `${label}.name`, errors);
    checkText(entity.defaultIdentity, `${label}.defaultIdentity`, errors);
    checkText(entity.defaultDesc, `${label}.defaultDesc`, errors);
    checkText(entity.defaultEvidence, `${label}.defaultEvidence`, errors);
    if (titleLookup) {
      findSubtitleLinkErrors(entity.defaultEvidence, `${label}.defaultEvidence`, titleLookup, null, errors);
    }
  }
}

export function findSubtitleLinkErrors(evidence, contextLabel, titleLookup, selfId = null, errors = []) {
  if (!evidence || !titleLookup) return errors;
  for (const match of String(evidence).matchAll(/『([^』]+)』/g)) {
    const citedTitle = match[1];
    if (titleLookup.has(citedTitle)) continue;

    const baseTitle = citedTitle.replace(/（[^）]+）$/, "").trim();
    if (!baseTitle || baseTitle === citedTitle) continue;

    const targetId = titleLookup.get(baseTitle);
    if (targetId && targetId !== selfId) {
      errors.push(
        `[出典リンク表記エラー] ${contextLabel}: 『${citedTitle}』は補足が括弧内にあるためリンク化されません -> 『${baseTitle}』（補足）の形式に修正してください（対象: ${targetId}）。`
      );
    }
  }
  return errors;
}

export function findEntityLinkHints(story, entities, usedEntityIds = []) {
  const hints = [];
  const sid = story?.id || "story";
  const used = usedEntityIds instanceof Set ? usedEntityIds : new Set(usedEntityIds || []);
  const bodyText = (story?.chapters || [])
    .flatMap((ch) => (ch.paragraphs || []).map((p) => stripInlineTags(p)))
    .join("\n");
  const searchable = `${story?.overallTruth || ""}\n${bodyText}`;

  for (const [eid, entity] of Object.entries(entities || {})) {
    if (used.has(eid)) continue;
    const baseName = String(entity?.name || "").replace(/（[^）]+）$/, "").trim();
    if (baseName.length < 2) continue;
    if (searchable.includes(baseName)) {
      hints.push(
        `[エンティティ未連携候補] ${sid}: 「${baseName}」(${eid}) への言及がありますが glossary の entityId に含まれていません。`
      );
    }
  }
  return hints;
}

export function extractEvidenceLinks(evidence, titleLookup, selfId = null) {
  if (!evidence) return [];
  const links = [];
  const seenIds = new Set();
  const matches = String(evidence).matchAll(/『([^』]+)』/g);
  for (const m of matches) {
    const citedTitle = m[1];
    const targetId = titleLookup.get(citedTitle);
    if (targetId && targetId !== selfId && !seenIds.has(targetId)) {
      seenIds.add(targetId);
      links.push({ title: citedTitle, storyId: targetId });
    }
  }
  return links;
}

export function buildTitleLookup(rawStories) {
  const titleLookup = new Map();
  const ambiguousTitles = new Set();
  const registerTitleAlias = (alias, id) => {
    if (!alias) return;
    if (titleLookup.has(alias) && titleLookup.get(alias) !== id) {
      ambiguousTitles.add(alias);
    } else {
      titleLookup.set(alias, id);
    }
  };
  for (const st of rawStories || []) {
    registerTitleAlias(st.title, st.id);
    const baseTitle = String(st.title || "").replace(/（[^）]+）$/, "").trim();
    if (baseTitle !== st.title) registerTitleAlias(baseTitle, st.id);
  }
  for (const amb of ambiguousTitles) titleLookup.delete(amb);
  return titleLookup;
}

export function validateStoryJsonSchema(story, storySchema, fileSlug, errors) {
  validateAgainstJsonSchema(story, storySchema, story?.id || fileSlug || "story", errors);
}

export function validateEntitiesJsonSchema(entities, entitiesSchema, errors) {
  validateAgainstJsonSchema(entities, entitiesSchema, "entities", errors);
}

export function isValidIsoDateString(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

export function validateStoryStructure(story, folderCategory, fileSlug, errors) {
  const sid = story.id || fileSlug;
  if (!story.id || !/^[a-z0-9_]+$/.test(story.id)) {
    errors.push(`[スキーマ] ${sid}: id が不正です。`);
  }
  if (story.id !== fileSlug) {
    errors.push(`[スキーマ] ${sid}: ファイル名 (${fileSlug}.json) と story.id (${story.id}) が一致しません。`);
  }
  if (!VALID_SHELF_CATEGORIES.includes(story.shelfCategory)) {
    errors.push(`[スキーマ] ${sid}: shelfCategory ('${story.shelfCategory}') が無効です。`);
  }
  if (story.shelfCategory !== folderCategory) {
    errors.push(`[スキーマ] ${sid}: 配置フォルダ (${folderCategory}/) と shelfCategory (${story.shelfCategory}) が一致しません。`);
  }
  if (story.addedAt !== undefined && !isValidIsoDateString(story.addedAt)) {
    errors.push(`[スキーマ] ${sid}.addedAt: YYYY-MM-DD 形式の有効な日付を指定してください。`);
  }
  const requiredStr = ["title", "categoryLabel", "era", "hook", "overallTruth", "gameEffect"];
  for (const key of requiredStr) {
    if (typeof story[key] !== "string" || story[key].trim().length === 0) {
      errors.push(`[スキーマ] ${sid}.${key}: 空でない文字列が必要です。`);
    }
  }
  if (!Array.isArray(story.region) || story.region.length === 0) {
    errors.push(`[スキーマ] ${sid}.region: 1つ以上の地域を含む配列が必要です。`);
  }
  if (!Array.isArray(story.tags)) {
    errors.push(`[スキーマ] ${sid}.tags: 配列が必要です。`);
  }
  if (!Array.isArray(story.preGuide) || story.preGuide.length === 0) {
    errors.push(`[スキーマ] ${sid}.preGuide: 1行以上の配列が必要です。`);
  }
  if (!Array.isArray(story.chapters) || story.chapters.length === 0) {
    errors.push(`[スキーマ] ${sid}.chapters: 1章以上の配列が必要です。`);
  }
}

export function loadRawJson(rawDir, sourceRef) {
  const rawPath = path.join(rawDir, sourceRef.sourceType, `${sourceRef.rawId}.json`);
  if (!fs.existsSync(rawPath)) {
    throw new Error(`Raw snapshot not found: ${path.relative(process.cwd(), rawPath)}`);
  }
  return JSON.parse(fs.readFileSync(rawPath, "utf8"));
}
