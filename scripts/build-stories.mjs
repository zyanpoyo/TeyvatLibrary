import fs from "node:fs";
import path from "node:path";
import {
  VALID_SHELF_CATEGORIES,
  VALID_IDENTITY_PREFIXES,
  VALID_PACKAGES,
  VALID_SOURCE_TYPES,
  createCorpusChecker,
  findFirstDiffContext,
  loadRawJson,
  resolveActualPlainText,
  resolveExpectedRawText,
  stripInlineTags,
  validateEntitiesMaster,
  validateStoryStructure,
} from "./lib/validator.mjs";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");
const RAW_DIR = path.join(DATA_DIR, "raw");
const SHARED_DIR = path.join(DATA_DIR, "shared");
const STORIES_DIR = path.join(DATA_DIR, "stories");
const DIST_DIR = path.join(ROOT, "public", "data");

const validateOnly = process.argv.includes("--validate-only");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function collectStoryFiles() {
  const files = [];
  for (const category of VALID_SHELF_CATEGORIES) {
    const catDir = path.join(STORIES_DIR, category);
    if (!fs.existsSync(catDir)) continue;
    for (const entry of fs.readdirSync(catDir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith(".json")) {
        files.push({
          folderCategory: category,
          fileSlug: entry.name.replace(/\.json$/, ""),
          filePath: path.join(catDir, entry.name),
        });
      }
    }
  }
  return files.sort((a, b) => a.filePath.localeCompare(b.filePath));
}

function resolveGlossaryItem(termId, rawItem, entities, sid, errors) {
  const label = `${sid}.glossary.${termId}`;
  const entity = rawItem.entityId ? entities[rawItem.entityId] : null;
  if (rawItem.entityId && !entity) {
    errors.push(`[マスタ参照切れ] ${label}: entityId '${rawItem.entityId}' が entities.json に存在しません。`);
  }

  const term = rawItem.term;
  const identity = rawItem.identityOverride || rawItem.identity || entity?.defaultIdentity || "";
  const desc = rawItem.descOverride || rawItem.desc || entity?.defaultDesc || "";
  const evidence = rawItem.evidenceOverride || rawItem.evidence || entity?.defaultEvidence || "";

  if (!term) {
    errors.push(`[用語定義欠落] ${label}: 'term' が未設定です。`);
  }
  if (!evidence || evidence.trim().length === 0) {
    errors.push(`[出典根拠欠落] ${label}: 'evidence' が未設定です。`);
  }
  if (!VALID_IDENTITY_PREFIXES.some((p) => identity.startsWith(p))) {
    errors.push(
      `[確度区分欠落] ${label}: 'identity'（「${identity}」）は ${VALID_IDENTITY_PREFIXES.join(" / ")} のいずれかで始めてください。`
    );
  }

  const resolved = {
    term,
    identity,
    desc,
    evidence,
  };
  if (rawItem.entityId) resolved.entityId = rawItem.entityId;
  return resolved;
}

export function extractEvidenceLinks(evidence, titleLookup, selfId = null) {
  if (!evidence) return [];
  const links = [];
  const seenIds = new Set();
  const matches = evidence.matchAll(/『([^』]+)』/g);
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

function buildTitleLookup(rawStories) {
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
  for (const st of rawStories) {
    registerTitleAlias(st.title, st.id);
    const baseTitle = st.title.replace(/（[^）]+）$/, "").trim();
    if (baseTitle !== st.title) registerTitleAlias(baseTitle, st.id);
  }
  for (const amb of ambiguousTitles) titleLookup.delete(amb);
  return titleLookup;
}

function compileAndValidateStory(story, { entities, storyIds, storyById, titleLookup, checkText, errors }) {
  const sid = story.id;
  checkText(story.title, `${sid}.title`, errors);
  checkText(story.hook, `${sid}.hook`, errors);
  checkText(story.overallTruth, `${sid}.overallTruth`, errors);
  checkText(story.gameEffect, `${sid}.gameEffect`, errors);
  (story.tags || []).forEach((t, i) => checkText(t, `${sid}.tags[${i}]`, errors));
  (story.preGuide || []).forEach((g, i) => checkText(g, `${sid}.preGuide[${i}]`, errors));

  // connected 検証
  for (const conn of story.connected || []) {
    if (conn.targetId === sid) {
      errors.push(`[自己参照] ${sid}.connected: 自分自身 (${sid}) を参照しています。`);
    } else if (!storyIds.has(conn.targetId)) {
      errors.push(`[リンク切れ] ${sid}.connected: 対象ID '${conn.targetId}' が存在しません。`);
    }
    checkText(conn.relation, `${sid}.connected(${conn.targetId}).relation`, errors);
    checkText(conn.desc, `${sid}.connected(${conn.targetId}).desc`, errors);
    if (conn.reverseRelation) {
      checkText(conn.reverseRelation, `${sid}.connected(${conn.targetId}).reverseRelation`, errors);
    }
    if (conn.reverseDesc) {
      checkText(conn.reverseDesc, `${sid}.connected(${conn.targetId}).reverseDesc`, errors);
    }
  }

  // glossary 解決＆検証
  const resolvedGlossary = {};
  const storyEntityIds = new Set();
  for (const [termId, rawItem] of Object.entries(story.glossary || {})) {
    const resolved = resolveGlossaryItem(termId, rawItem, entities, sid, errors);
    if (resolved.entityId) storyEntityIds.add(resolved.entityId);

    const gLabel = `${sid}.glossary.${termId}`;
    checkText(resolved.term, `${gLabel}.term`, errors);
    checkText(resolved.identity, `${gLabel}.identity`, errors);
    checkText(resolved.desc, `${gLabel}.desc`, errors);
    checkText(resolved.evidence, `${gLabel}.evidence`, errors);

    const evidenceLinks = extractEvidenceLinks(resolved.evidence, titleLookup, sid);
    if (evidenceLinks.length > 0) {
      resolved.evidenceLinks = evidenceLinks;
    }
    resolvedGlossary[termId] = resolved;
  }

  // chapters 検証（原文1文字完全一致 + タグ + コーパス）
  const glossaryKeys = new Set(Object.keys(resolvedGlossary));
  const usedTerms = new Set();
  let totalCharCount = 0;

  (story.chapters || []).forEach((ch, cIdx) => {
    const cLabel = `${sid}.chapters[${cIdx}]`;
    checkText(ch.partLabel, `${cLabel}.partLabel`, errors);
    checkText(ch.heading, `${cLabel}.heading`, errors);
    checkText(ch.epigraph, `${cLabel}.epigraph`, errors);
    checkText(ch.chapterNote, `${cLabel}.chapterNote`, errors);

    const ref = ch.sourceRef;
    if (!ref) {
      errors.push(`[sourceRef欠落] ${cLabel}: sourceRef が未設定です。`);
    } else {
      if (!VALID_PACKAGES.includes(ref.package)) {
        errors.push(`[sourceRef不正] ${cLabel}: package '${ref.package}' が無効です。`);
      }
      if (!VALID_SOURCE_TYPES.includes(ref.sourceType)) {
        errors.push(`[sourceRef不正] ${cLabel}: sourceType '${ref.sourceType}' が無効です。`);
      }
      try {
        const rawJson = loadRawJson(RAW_DIR, ref);
        const expected = resolveExpectedRawText(rawJson, ref);
        const actual = resolveActualPlainText(ch.paragraphs);
        if (expected !== actual) {
          const diff = findFirstDiffContext(expected, actual);
          errors.push(
            `[原文不一致] ${cLabel} (${ref.sourceType}/${ref.rawId}): raw(len=${expected.length}) と paragraphs(len=${actual.length}) が位置 ${diff?.index} で不一致です。` +
            ` raw=${JSON.stringify(diff?.expectedSnippet)} vs actual=${JSON.stringify(diff?.actualSnippet)}`
          );
        }
      } catch (err) {
        errors.push(`[原典解決エラー] ${cLabel}: ${err.message}`);
      }
    }

    (ch.paragraphs || []).forEach((p, pIdx) => {
      checkText(p, `${cLabel}.paragraphs[${pIdx}]`, errors);
      totalCharCount += stripInlineTags(p).replace(/\s+/g, "").length;
      const tagRegex = /\{\{([a-z0-9_]+)\|([^}]+)\}\}/g;
      let m;
      while ((m = tagRegex.exec(p)) !== null) {
        const tId = m[1];
        const surface = m[2];
        usedTerms.add(tId);
        if (!glossaryKeys.has(tId)) {
          errors.push(
            `[未定義用語タグ] ${cLabel}.paragraphs[${pIdx}]: {{${tId}|${surface}}} に対応する glossary.${tId} が存在しません。`
          );
        }
      }
    });
  });

  for (const gKey of glossaryKeys) {
    if (!usedTerms.has(gKey)) {
      errors.push(`[未使用glossary] ${sid}.glossary.${gKey}: 本文中のどこからも参照されていません。`);
    }
  }

  const readingMinutes = Math.max(1, Math.round(totalCharCount / 550));
  return {
    id: story.id,
    title: story.title,
    shelfCategory: story.shelfCategory,
    categoryLabel: story.categoryLabel,
    region: story.region,
    era: story.era,
    ...(story.releaseVersion ? { releaseVersion: story.releaseVersion } : {}),
    ...(story.addedAt ? { addedAt: story.addedAt } : {}),
    readingTime: `約${readingMinutes}分`,
    charCount: totalCharCount,
    chapterCount: story.chapters.length,
    hook: story.hook,
    tags: story.tags,
    entityIds: [...storyEntityIds],
    preGuide: story.preGuide,
    overallTruth: story.overallTruth,
    gameEffect: story.gameEffect,
    connected: (story.connected || []).map((c) => ({
      targetId: c.targetId,
      title: storyById.get(c.targetId)?.title || c.targetId,
      relation: c.relation,
      desc: c.desc,
    })),
    glossary: resolvedGlossary,
    chapters: story.chapters.map((ch) => ({
      partLabel: ch.partLabel,
      heading: ch.heading,
      epigraph: ch.epigraph,
      paragraphs: ch.paragraphs,
      ...(ch.chapterNote ? { chapterNote: ch.chapterNote } : {}),
      sourceRef: ch.sourceRef,
    })),
  };
}

function expandBidirectionalConnections(rawStories, compiledMap) {
  for (const story of rawStories) {
    for (const conn of story.connected || []) {
      const targetCompiled = compiledMap.get(conn.targetId);
      if (!targetCompiled) continue;
      const alreadyLinked = targetCompiled.connected.some((c) => c.targetId === story.id);
      if (!alreadyLinked) {
        targetCompiled.connected.push({
          targetId: story.id,
          title: story.title,
          relation: conn.reverseRelation || `関連作品（${story.title}）`,
          desc: conn.reverseDesc || `『${story.title}』——この物語と対・前後関係にある公式記録`,
        });
      }
    }
  }
}

function buildIndexPayload(compiledMap, entities) {
  const categoryCounts = Object.fromEntries(VALID_SHELF_CATEGORIES.map((c) => [c, 0]));
  const entitiesIndex = {};
  const indexStories = [];

  for (const compiled of compiledMap.values()) {
    categoryCounts[compiled.shelfCategory] = (categoryCounts[compiled.shelfCategory] || 0) + 1;

    for (const eid of compiled.entityIds) {
      if (!entitiesIndex[eid]) {
        entitiesIndex[eid] = {
          name: entities[eid]?.name || eid,
          kind: entities[eid]?.kind || "character",
          storyIds: [],
        };
      }
      entitiesIndex[eid].storyIds.push(compiled.id);
    }

    indexStories.push({
      id: compiled.id,
      title: compiled.title,
      shelfCategory: compiled.shelfCategory,
      categoryLabel: compiled.categoryLabel,
      region: compiled.region,
      era: compiled.era,
      ...(compiled.releaseVersion ? { releaseVersion: compiled.releaseVersion } : {}),
      ...(compiled.addedAt ? { addedAt: compiled.addedAt } : {}),
      readingTime: compiled.readingTime,
      charCount: compiled.charCount,
      chapterCount: compiled.chapterCount,
      hook: compiled.hook,
      tags: compiled.tags,
      entityIds: compiled.entityIds,
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    totalCount: indexStories.length,
    categoryCounts,
    entitiesIndex,
    stories: indexStories,
  };
}

function writeDistOutput(distDir, compiledMap, indexPayload) {
  const distStoriesDir = path.join(distDir, "stories");
  fs.rmSync(distDir, { recursive: true, force: true });
  fs.mkdirSync(distStoriesDir, { recursive: true });

  for (const compiled of compiledMap.values()) {
    fs.writeFileSync(
      path.join(distStoriesDir, `${compiled.id}.json`),
      JSON.stringify(compiled, null, 2) + "\n",
      "utf8"
    );
  }

  fs.writeFileSync(
    path.join(distDir, "stories-index.json"),
    JSON.stringify(indexPayload, null, 2) + "\n",
    "utf8"
  );
}

function main() {
  const entities = readJson(path.join(SHARED_DIR, "entities.json"));
  const officialEntities = readJson(path.join(SHARED_DIR, "official-entities.json"));
  const officialCorpus = readJson(path.join(SHARED_DIR, "official-corpus.json"));

  const checkText = createCorpusChecker(officialEntities, officialCorpus);
  const errors = [];

  validateEntitiesMaster(entities, errors, checkText);

  const storyEntries = collectStoryFiles();
  if (storyEntries.length === 0) {
    errors.push("data/stories/ 配下にストーリーJSONが1件も見つかりません。");
  }

  const rawStories = [];
  const storyIds = new Set();
  for (const entry of storyEntries) {
    const story = readJson(entry.filePath);
    if (storyIds.has(story.id)) {
      errors.push(`[重複ID] story.id '${story.id}' が重複しています。`);
    }
    storyIds.add(story.id);
    validateStoryStructure(story, entry.folderCategory, entry.fileSlug, errors);
    rawStories.push(story);
  }

  const titleLookup = buildTitleLookup(rawStories);
  const storyById = new Map(rawStories.map((s) => [s.id, s]));
  const compiledMap = new Map();

  for (const story of rawStories) {
    const compiledStory = compileAndValidateStory(story, {
      entities,
      storyIds,
      storyById,
      titleLookup,
      checkText,
      errors,
    });
    compiledMap.set(story.id, compiledStory);
  }

  expandBidirectionalConnections(rawStories, compiledMap);

  if (errors.length > 0) {
    console.error(`\n❌ 検証失敗: ${errors.length} 件のエラーが見つかりました:\n`);
    errors.forEach((e) => console.error("  - " + e));
    process.exit(1);
  }

  if (validateOnly) {
    console.log(
      `✅ 検証成功 (--validate-only): 全 ${rawStories.length} 作品（原文1文字一致・スキーマ・公式コーパス ${Object.keys(officialCorpus.terms || {}).length} 語・マスタ・リンク整合性）すべて正常です。`
    );
    return;
  }

  const indexPayload = buildIndexPayload(compiledMap, entities);
  writeDistOutput(DIST_DIR, compiledMap, indexPayload);

  console.log(
    `✅ ビルド＆検証成功: 全 ${indexPayload.totalCount} 作品を検証し、public/data/ (stories-index.json + stories/*.json) を生成しました。`
  );
}

main();
