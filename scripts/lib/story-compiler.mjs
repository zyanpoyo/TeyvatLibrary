import { validateAgainstJsonSchema } from "./json-schema.mjs";
import {
  VALID_IDENTITY_PREFIXES,
  VALID_SHELF_CATEGORIES,
  buildTitleLookup,
  createCorpusChecker,
  extractEvidenceLinks,
  findEntityLinkHints,
  findFirstDiffContext,
  findSubtitleLinkErrors,
  resolveActualPlainText,
  resolveExpectedRawText,
  stripInlineTags,
} from "./validator.mjs";

const STORY_REQUIRED_TEXT_FIELDS = [
  "title",
  "categoryLabel",
  "era",
  "hook",
  "overallTruth",
  "gameEffect",
];

const STORY_REQUIRED_ARRAY_TEXT_FIELDS = ["region", "tags", "preGuide"];

function isValidIsoDateString(value) {
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

function hasValidIdentity(identity) {
  if (typeof identity !== "string") return false;
  const prefix = VALID_IDENTITY_PREFIXES.find((p) => identity.startsWith(p));
  return Boolean(prefix && identity.slice(prefix.length).trim().length > 0);
}

function pushIfBlank(value, label, errors) {
  if (typeof value === "string" && value.trim().length === 0) {
    errors.push(`[スキーマ] ${label}: 空でない文字列が必要です。`);
  }
}

function collectBlankStoryFields(story, errors) {
  const sid = story.id;
  for (const key of STORY_REQUIRED_TEXT_FIELDS) {
    pushIfBlank(story[key], `${sid}.${key}`, errors);
  }
  for (const key of STORY_REQUIRED_ARRAY_TEXT_FIELDS) {
    story[key].forEach((item, index) => {
      pushIfBlank(item, `${sid}.${key}[${index}]`, errors);
    });
  }
  (story.connected || []).forEach((conn, index) => {
    const cLabel = `${sid}.connected[${index}]`;
    pushIfBlank(conn.relation, `${cLabel}.relation`, errors);
    pushIfBlank(conn.desc, `${cLabel}.desc`, errors);
    if (conn.reverseRelation !== undefined) {
      pushIfBlank(conn.reverseRelation, `${cLabel}.reverseRelation`, errors);
    }
    if (conn.reverseDesc !== undefined) {
      pushIfBlank(conn.reverseDesc, `${cLabel}.reverseDesc`, errors);
    }
  });
  story.chapters.forEach((ch, cIdx) => {
    const cLabel = `${sid}.chapters[${cIdx}]`;
    pushIfBlank(ch.partLabel, `${cLabel}.partLabel`, errors);
    pushIfBlank(ch.heading, `${cLabel}.heading`, errors);
    pushIfBlank(ch.sourceRef.rawId, `${cLabel}.sourceRef.rawId`, errors);
    ch.paragraphs.forEach((p, pIdx) => {
      pushIfBlank(p, `${cLabel}.paragraphs[${pIdx}]`, errors);
    });
  });
}

function runSchemaAndPlacementGate({ stories, entities, schemas }) {
  const gateErrors = [];
  const hasStories = Array.isArray(stories) && stories.length > 0;
  if (!hasStories) {
    gateErrors.push("data/stories/ 配下にストーリーJSONが1件も見つかりません。");
  }

  const entitySchemaErrors = validateAgainstJsonSchema(entities, schemas.entities, "entities");
  gateErrors.push(...entitySchemaErrors);
  if (entitySchemaErrors.length === 0) {
    for (const [entityId, entity] of Object.entries(entities)) {
      const label = `entities.${entityId}`;
      for (const field of ["name", "defaultDesc", "defaultEvidence"]) {
        pushIfBlank(entity[field], `${label}.${field}`, gateErrors);
      }
      if (!hasValidIdentity(entity.defaultIdentity)) {
        gateErrors.push(
          `[確度区分欠落] ${label}.defaultIdentity は ${VALID_IDENTITY_PREFIXES.join(" / ")} のいずれかで始め、内容を記述してください。`
        );
      }
    }
  }

  const rawStories = [];
  const seenIds = new Set();
  let hasStorySchemaFailure = false;
  let hasDuplicateId = false;

  for (const entry of stories || []) {
    const { folderCategory, fileSlug, story } = entry || {};
    const storyLabel =
      story && typeof story === "object" && typeof story.id === "string" && story.id
        ? story.id
        : fileSlug || "story";

    const storySchemaErrors = validateAgainstJsonSchema(story, schemas.story, storyLabel);
    if (storySchemaErrors.length > 0) {
      gateErrors.push(...storySchemaErrors);
      hasStorySchemaFailure = true;
      continue;
    }

    const sid = story.id;
    if (seenIds.has(sid)) {
      gateErrors.push(`[重複ID] story.id '${sid}' が重複しています。`);
      hasDuplicateId = true;
    } else {
      seenIds.add(sid);
    }

    if (sid !== fileSlug) {
      gateErrors.push(`[スキーマ] ${sid}: ファイル名 (${fileSlug}.json) と story.id (${sid}) が一致しません。`);
    }
    if (story.shelfCategory !== folderCategory) {
      gateErrors.push(
        `[スキーマ] ${sid}: 配置フォルダ (${folderCategory}/) と shelfCategory (${story.shelfCategory}) が一致しません。`
      );
    }
    if (story.addedAt !== undefined && !isValidIsoDateString(story.addedAt)) {
      gateErrors.push(`[スキーマ] ${sid}.addedAt: YYYY-MM-DD 形式の有効な日付を指定してください。`);
    }

    collectBlankStoryFields(story, gateErrors);
    rawStories.push(story);
  }

  const canProceedToCompile =
    hasStories &&
    entitySchemaErrors.length === 0 &&
    !hasStorySchemaFailure &&
    !hasDuplicateId;

  return { gateErrors, canProceedToCompile, rawStories };
}

function createCachedSnapshotLoader(readRawSnapshot) {
  const cache = new Map();
  return function loadSnapshot(sourceRef) {
    const key = `${sourceRef.package}\0${sourceRef.sourceType}\0${sourceRef.rawId}`;
    if (cache.has(key)) {
      const cached = cache.get(key);
      if (!cached.ok) throw cached.error;
      return cached.data;
    }

    try {
      const data = readRawSnapshot(sourceRef);
      if (!data || typeof data !== "object") {
        throw new Error(`Raw snapshot not found or invalid: ${sourceRef.sourceType}/${sourceRef.rawId}`);
      }
      cache.set(key, { ok: true, data });
      return data;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      cache.set(key, { ok: false, error });
      throw error;
    }
  };
}

function resolveGlossaryItem(termId, rawItem, entities, sid, errors) {
  const label = `${sid}.glossary.${termId}`;
  const entity = rawItem.entityId ? entities[rawItem.entityId] : null;
  const hasMissingEntity = Boolean(rawItem.entityId && !entity);
  if (hasMissingEntity) {
    errors.push(`[マスタ参照切れ] ${label}: entityId '${rawItem.entityId}' が entities.json に存在しません。`);
  }

  const term = rawItem.term;
  const identity = rawItem.identityOverride ?? rawItem.identity ?? entity?.defaultIdentity ?? "";
  const desc = rawItem.descOverride ?? rawItem.desc ?? entity?.defaultDesc ?? "";
  const evidence = rawItem.evidenceOverride ?? rawItem.evidence ?? entity?.defaultEvidence ?? "";

  if (!term || term.trim().length === 0) {
    errors.push(`[用語定義欠落] ${label}: 'term' が未設定です。`);
  }

  const hasExplicitIdentity = rawItem.identityOverride !== undefined || rawItem.identity !== undefined;
  if ((!hasMissingEntity || hasExplicitIdentity) && !hasValidIdentity(identity)) {
    errors.push(
      `[確度区分欠落] ${label}: 'identity'（「${identity}」）は ${VALID_IDENTITY_PREFIXES.join(" / ")} のいずれかで始め、内容を記述してください。`
    );
  }

  const hasExplicitDesc = rawItem.descOverride !== undefined || rawItem.desc !== undefined;
  if ((!hasMissingEntity || hasExplicitDesc) && (!desc || desc.trim().length === 0)) {
    errors.push(`[解説欠落] ${label}: 'desc' が未設定です。`);
  }

  const hasExplicitEvidence = rawItem.evidenceOverride !== undefined || rawItem.evidence !== undefined;
  if ((!hasMissingEntity || hasExplicitEvidence) && (!evidence || evidence.trim().length === 0)) {
    errors.push(`[出典根拠欠落] ${label}: 'evidence' が未設定です。`);
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

function compileAndValidateStory(
  story,
  { entities, storyIds, storyById, titleLookup, checkText, loadSnapshot, errors, warnings }
) {
  const sid = story.id;
  errors.push(...checkText(story.title, `${sid}.title`));
  errors.push(...checkText(story.hook, `${sid}.hook`));
  errors.push(...checkText(story.overallTruth, `${sid}.overallTruth`));
  errors.push(...checkText(story.gameEffect, `${sid}.gameEffect`));
  story.tags.forEach((t, i) => errors.push(...checkText(t, `${sid}.tags[${i}]`)));
  story.preGuide.forEach((g, i) => errors.push(...checkText(g, `${sid}.preGuide[${i}]`)));

  for (const conn of story.connected || []) {
    if (conn.targetId === sid) {
      errors.push(`[自己参照] ${sid}.connected: 自分自身 (${sid}) を参照しています。`);
    } else if (!storyIds.has(conn.targetId)) {
      errors.push(`[リンク切れ] ${sid}.connected: 対象ID '${conn.targetId}' が存在しません。`);
    }
    errors.push(...checkText(conn.relation, `${sid}.connected(${conn.targetId}).relation`));
    errors.push(...checkText(conn.desc, `${sid}.connected(${conn.targetId}).desc`));
    if (conn.reverseRelation) {
      errors.push(...checkText(conn.reverseRelation, `${sid}.connected(${conn.targetId}).reverseRelation`));
    }
    if (conn.reverseDesc) {
      errors.push(...checkText(conn.reverseDesc, `${sid}.connected(${conn.targetId}).reverseDesc`));
    }
  }

  const resolvedGlossary = {};
  const storyEntityIds = new Set();
  for (const [termId, rawItem] of Object.entries(story.glossary)) {
    const resolved = resolveGlossaryItem(termId, rawItem, entities, sid, errors);
    if (resolved.entityId) storyEntityIds.add(resolved.entityId);

    const gLabel = `${sid}.glossary.${termId}`;
    errors.push(...checkText(resolved.term, `${gLabel}.term`));
    errors.push(...checkText(resolved.identity, `${gLabel}.identity`));
    errors.push(...checkText(resolved.desc, `${gLabel}.desc`));
    errors.push(...checkText(resolved.evidence, `${gLabel}.evidence`));

    const ownEvidence = rawItem.evidenceOverride || rawItem.evidence;
    if (ownEvidence) {
      errors.push(...findSubtitleLinkErrors(ownEvidence, `${gLabel}.evidence`, titleLookup, sid));
    }

    const evidenceLinks = extractEvidenceLinks(resolved.evidence, titleLookup, sid);
    if (evidenceLinks.length > 0) {
      resolved.evidenceLinks = evidenceLinks;
    }
    resolvedGlossary[termId] = resolved;
  }

  const glossaryKeys = new Set(Object.keys(resolvedGlossary));
  const usedTerms = new Set();
  let totalCharCount = 0;

  story.chapters.forEach((ch, cIdx) => {
    const cLabel = `${sid}.chapters[${cIdx}]`;
    errors.push(...checkText(ch.partLabel, `${cLabel}.partLabel`));
    errors.push(...checkText(ch.heading, `${cLabel}.heading`));
    errors.push(...checkText(ch.epigraph, `${cLabel}.epigraph`));
    if (ch.chapterNote) {
      errors.push(...checkText(ch.chapterNote, `${cLabel}.chapterNote`));
    }

    const ref = ch.sourceRef;
    try {
      const rawJson = loadSnapshot(ref);
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

    ch.paragraphs.forEach((p, pIdx) => {
      errors.push(...checkText(p, `${cLabel}.paragraphs[${pIdx}]`));
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

  warnings.push(...findEntityLinkHints(story, entities, storyEntityIds));

  const readingMinutes = Math.max(1, Math.round(totalCharCount / 550));
  return {
    id: story.id,
    title: story.title,
    shelfCategory: story.shelfCategory,
    categoryLabel: story.categoryLabel,
    region: story.region,
    era: story.era,
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

/**
 * 編集層ストーリー・マスタ・原典スナップショット読取ポートを受け取り、
 * スキーマゲート → Entity解決＆原文一致＆コーパス検証 → 双方向リンク展開＆配信データ構築を実行して値で返す。
 */
export function compileStories({
  stories,
  entities,
  officialEntities = {},
  officialCorpus = {},
  schemas,
  readRawSnapshot,
}) {
  if (typeof readRawSnapshot !== "function") {
    throw new TypeError("readRawSnapshot function is required.");
  }

  const stats = {
    storyCount: Array.isArray(stories) ? stories.length : 0,
    corpusTermCount: Object.keys(officialCorpus?.terms || {}).length,
  };

  // Stage 1: Schema & 配置ゲート（不正構造時は Stage 2 へ進まず安全中断）
  const { gateErrors, canProceedToCompile, rawStories } = runSchemaAndPlacementGate({
    stories,
    entities,
    schemas,
  });
  if (!canProceedToCompile) {
    return {
      ok: false,
      errors: gateErrors,
      warnings: [],
      dist: null,
      stats,
    };
  }

  // Stage 2: Entity 解決 + 1文字完全一致 + コーパス検査
  const errors = [...gateErrors];
  const warnings = [];
  const checkText = createCorpusChecker(officialEntities || {}, officialCorpus || {});
  const titleLookup = buildTitleLookup(rawStories);
  const storyIds = new Set(rawStories.map((s) => s.id));
  const storyById = new Map(rawStories.map((s) => [s.id, s]));
  const loadSnapshot = createCachedSnapshotLoader(readRawSnapshot);

  for (const [entityId, entity] of Object.entries(entities)) {
    const label = `entities.${entityId}`;
    errors.push(...checkText(entity.name, `${label}.name`));
    errors.push(...checkText(entity.defaultIdentity, `${label}.defaultIdentity`));
    errors.push(...checkText(entity.defaultDesc, `${label}.defaultDesc`));
    errors.push(...checkText(entity.defaultEvidence, `${label}.defaultEvidence`));
    errors.push(...findSubtitleLinkErrors(entity.defaultEvidence, `${label}.defaultEvidence`, titleLookup, null));
  }

  const compiledMap = new Map();
  for (const story of rawStories) {
    const compiledStory = compileAndValidateStory(story, {
      entities,
      storyIds,
      storyById,
      titleLookup,
      checkText,
      loadSnapshot,
      errors,
      warnings,
    });
    compiledMap.set(story.id, compiledStory);
  }

  if (errors.length > 0) {
    return {
      ok: false,
      errors,
      warnings,
      dist: null,
      stats,
    };
  }

  // Stage 3: 双方向 connected 展開 + 配信データ構築
  expandBidirectionalConnections(rawStories, compiledMap);
  const index = buildIndexPayload(compiledMap, entities);
  const storiesById = Object.fromEntries(compiledMap);

  return {
    ok: true,
    errors: [],
    warnings,
    dist: {
      index,
      storiesById,
    },
    stats,
  };
}
