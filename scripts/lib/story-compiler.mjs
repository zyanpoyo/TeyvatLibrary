import {
  extractInlineTagReferences,
  formatGenderPlaceholders,
  isValidIsoDateString,
  stripInlineTags,
} from "../../src/domain/text-parser.ts";
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
  if (story.seo) {
    if (story.seo.title !== undefined) {
      pushIfBlank(story.seo.title, `${sid}.seo.title`, errors);
    }
    if (story.seo.description !== undefined) {
      pushIfBlank(story.seo.description, `${sid}.seo.description`, errors);
    }
  }
  story.chapters.forEach((ch, cIdx) => {
    const cLabel = `${sid}.chapters[${cIdx}]`;
    pushIfBlank(ch.partLabel, `${cLabel}.partLabel`, errors);
    pushIfBlank(ch.heading, `${cLabel}.heading`, errors);
    pushIfBlank(ch.sourceRef.rawId, `${cLabel}.sourceRef.rawId`, errors);
    ch.paragraphs.forEach((p, pIdx) => {
      pushIfBlank(p, `${cLabel}.paragraphs[${pIdx}]`, errors);
    });
  });
  (story.unreleasedVolumes || []).forEach((vol, vIdx) => {
    const vLabel = `${sid}.unreleasedVolumes[${vIdx}]`;
    pushIfBlank(vol.partLabel, `${vLabel}.partLabel`, errors);
    pushIfBlank(vol.description, `${vLabel}.description`, errors);
    pushIfBlank(vol.sourceRef.rawId, `${vLabel}.sourceRef.rawId`, errors);
  });
}

function collectBlankCourseFields(course, errors) {
  const cid = course.id;
  for (const key of ["badge", "title", "subtitle", "hook"]) {
    pushIfBlank(course[key], `courses.${cid}.${key}`, errors);
  }
  if (course.seo) {
    if (course.seo.title !== undefined) {
      pushIfBlank(course.seo.title, `courses.${cid}.seo.title`, errors);
    }
    if (course.seo.description !== undefined) {
      pushIfBlank(course.seo.description, `courses.${cid}.seo.description`, errors);
    }
  }
  (course.steps || []).forEach((step, idx) => {
    pushIfBlank(step.note, `courses.${cid}.steps[${idx}].note`, errors);
  });
}

function runSchemaAndPlacementGate({ stories, entities, courses, schemas }) {
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

  let hasCourseSchemaFailure = false;
  let hasDuplicateCourseId = false;
  const rawCourses = [];
  const hasExplicitCourses = courses !== undefined;

  if (hasExplicitCourses) {
    if (!schemas?.courses) {
      gateErrors.push("[JSONスキーマ] courses: courses.schema.json が指定されていません。");
      hasCourseSchemaFailure = true;
    } else {
      const courseSchemaErrors = validateAgainstJsonSchema(courses, schemas.courses, "courses");
      if (courseSchemaErrors.length > 0) {
        gateErrors.push(...courseSchemaErrors);
        hasCourseSchemaFailure = true;
      } else {
        const seenCourseIds = new Set();
        for (const course of courses) {
          if (seenCourseIds.has(course.id)) {
            gateErrors.push(`[重複ID] courses.${course.id}: id '${course.id}' が重複しています。`);
            hasDuplicateCourseId = true;
          } else {
            seenCourseIds.add(course.id);
          }

          const seenStepStoryIds = new Set();
          for (const [idx, step] of course.steps.entries()) {
            if (seenStepStoryIds.has(step.storyId)) {
              gateErrors.push(
                `[重複ストーリー] courses.${course.id}.steps[${idx}]: storyId '${step.storyId}' が同一コース内で重複しています。`
              );
            } else {
              seenStepStoryIds.add(step.storyId);
            }
          }

          collectBlankCourseFields(course, gateErrors);
          rawCourses.push(course);
        }
      }
    }
  }

  const canProceedToCompile =
    hasStories &&
    entitySchemaErrors.length === 0 &&
    !hasStorySchemaFailure &&
    !hasDuplicateId &&
    !hasCourseSchemaFailure &&
    !hasDuplicateCourseId;

  return { gateErrors, canProceedToCompile, rawStories, rawCourses, hasExplicitCourses };
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

function verifyRawSourceMatch(ref, paragraphs, contextLabel, { loadSnapshot, errors }) {
  try {
    const rawJson = loadSnapshot(ref);
    const expected = resolveExpectedRawText(rawJson, ref);
    const actual = resolveActualPlainText(paragraphs);
    if (expected !== actual) {
      const diff = findFirstDiffContext(expected, actual);
      errors.push(
        `[原文不一致] ${contextLabel} (${ref.sourceType}/${ref.rawId}): raw(len=${expected.length}) と paragraphs(len=${actual.length}) が位置 ${diff?.index} で不一致です。` +
        ` raw=${JSON.stringify(diff?.expectedSnippet)} vs actual=${JSON.stringify(diff?.actualSnippet)}`
      );
    }
  } catch (err) {
    errors.push(`[原典解決エラー] ${contextLabel}: ${err.message}`);
  }
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
  if (story.seo?.title) {
    errors.push(...checkText(story.seo.title, `${sid}.seo.title`));
  }
  if (story.seo?.description) {
    errors.push(...checkText(story.seo.description, `${sid}.seo.description`));
  }
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
    verifyRawSourceMatch(ref, ch.paragraphs, cLabel, { loadSnapshot, errors });

    ch.paragraphs.forEach((p, pIdx) => {
      errors.push(...checkText(p, `${cLabel}.paragraphs[${pIdx}]`));
      totalCharCount += stripInlineTags(p).replace(/\s+/g, "").length;
      for (const { termId: tId, surface } of extractInlineTagReferences(p)) {
        usedTerms.add(tId);
        if (!glossaryKeys.has(tId)) {
          errors.push(
            `[未定義用語タグ] ${cLabel}.paragraphs[${pIdx}]: {{${tId}|${surface}}} に対応する glossary.${tId} が存在しません。`
          );
        }
      }
    });
  });

  (story.unreleasedVolumes || []).forEach((vol, vIdx) => {
    const vLabel = `${sid}.unreleasedVolumes[${vIdx}]`;
    errors.push(...checkText(vol.partLabel, `${vLabel}.partLabel`));
    errors.push(...checkText(vol.description, `${vLabel}.description`));
    verifyRawSourceMatch(vol.sourceRef, [vol.description], vLabel, { loadSnapshot, errors });
  });

  for (const gKey of glossaryKeys) {
    if (!usedTerms.has(gKey)) {
      errors.push(`[未使用glossary] ${sid}.glossary.${gKey}: 本文中のどこからも参照されていません。`);
    }
  }

  warnings.push(...findEntityLinkHints(story, entities, storyEntityIds));

  const storyEntities = [...storyEntityIds]
    .map((eid) => {
      const entity = entities[eid];
      if (!entity) return null;
      return {
        id: eid,
        name: entity.name,
        kind: entity.kind,
        identity: entity.defaultIdentity,
        desc: entity.defaultDesc,
      };
    })
    .filter(Boolean);

  const readingMinutes = Math.max(1, Math.round(totalCharCount / 550));
  return {
    id: story.id,
    title: story.title,
    shelfCategory: story.shelfCategory,
    categoryLabel: story.categoryLabel,
    region: story.region,
    era: story.era,
    ...(story.addedAt ? { addedAt: story.addedAt } : {}),
    ...(story.seo ? { seo: story.seo } : {}),
    readingTime: `約${readingMinutes}分`,
    charCount: totalCharCount,
    chapterCount: story.chapters.length,
    hook: story.hook,
    tags: story.tags,
    entityIds: [...storyEntityIds],
    ...(storyEntities.length > 0 ? { entities: storyEntities } : {}),
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
    ...(Array.isArray(story.unreleasedVolumes) && story.unreleasedVolumes.length > 0
      ? {
          unreleasedVolumes: story.unreleasedVolumes.map((vol) => ({
            partLabel: vol.partLabel,
            description: vol.description,
            sourceRef: vol.sourceRef,
          })),
        }
      : {}),
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

function validateCourseReferencesAndText(course, { storyIds, checkText, errors }) {
  const cid = course.id;
  errors.push(...checkText(course.badge, `courses.${cid}.badge`));
  errors.push(...checkText(course.title, `courses.${cid}.title`));
  errors.push(...checkText(course.subtitle, `courses.${cid}.subtitle`));
  errors.push(...checkText(course.hook, `courses.${cid}.hook`));
  if (course.seo?.title) {
    errors.push(...checkText(course.seo.title, `courses.${cid}.seo.title`));
  }
  if (course.seo?.description) {
    errors.push(...checkText(course.seo.description, `courses.${cid}.seo.description`));
  }

  course.steps.forEach((step, idx) => {
    if (!storyIds.has(step.storyId)) {
      errors.push(
        `[リンク切れ] courses.${cid}.steps[${idx}]: 対象ID '${step.storyId}' が存在しません。`
      );
    }
    errors.push(...checkText(step.note, `courses.${cid}.steps[${idx}].note`));
  });
}

/**
 * コース未所属作品および代表フェア棚（3枠・作品重複なし）の非ブロッキングヒントを収集する。
 */
function collectCourseHints(rawStories, rawCourses, warnings) {
  if (!Array.isArray(rawCourses) || rawCourses.length === 0) return;

  const assignedStoryIds = new Set();
  for (const course of rawCourses) {
    for (const step of course.steps || []) {
      assignedStoryIds.add(step.storyId);
    }
  }

  for (const story of rawStories) {
    if (!assignedStoryIds.has(story.id)) {
      warnings.push(
        `[コース未所属作品] ${story.id}: どの読書コースにも収録されていません。既存コースへの編入または新コース追加を検討してください。`
      );
    }
  }

  const featuredCourses = rawCourses.filter((course) => course.featured === true);
  if (featuredCourses.length !== 3) {
    warnings.push(
      `[フェア棚代表枠] featured: true のコースが ${featuredCourses.length} 件です（書架フェア棚は代表 3 枠を基本としています）。`
    );
  }

  const featuredStoryOwners = new Map();
  for (const course of featuredCourses) {
    for (const step of course.steps || []) {
      if (!featuredStoryOwners.has(step.storyId)) {
        featuredStoryOwners.set(step.storyId, []);
      }
      featuredStoryOwners.get(step.storyId).push(course.id);
    }
  }
  for (const [storyId, courseIds] of featuredStoryOwners.entries()) {
    if (courseIds.length > 1) {
      warnings.push(
        `[フェア棚代表枠重複] '${storyId}' が代表コース（${courseIds.join(", ")}）で重複しています。`
      );
    }
  }
}

function buildCoursesPayloadAndAssignMemberships(rawCourses, compiledMap) {
  const compiledCourses = [];

  for (const course of rawCourses) {
    const storyIds = course.steps.map((s) => s.storyId);
    const stepsSummary = course.steps.map((s) => ({
      storyId: s.storyId,
      title: compiledMap.get(s.storyId)?.title || s.storyId,
    }));

    let totalCharCount = 0;
    course.steps.forEach((step, idx) => {
      const targetStory = compiledMap.get(step.storyId);
      if (!targetStory) return;
      totalCharCount += targetStory.charCount || 0;

      if (!Array.isArray(targetStory.courses)) {
        targetStory.courses = [];
      }
      targetStory.courses.push({
        courseId: course.id,
        kind: course.kind,
        badge: course.badge,
        title: course.title,
        stepIndex: idx,
        totalSteps: stepsSummary.length,
        prevStep: idx > 0 ? stepsSummary[idx - 1] : null,
        nextStep: idx < stepsSummary.length - 1 ? stepsSummary[idx + 1] : null,
        steps: stepsSummary,
      });
    });

    const readingMinutes = Math.max(1, Math.round(totalCharCount / 550));
    compiledCourses.push({
      id: course.id,
      kind: course.kind,
      badge: course.badge,
      title: course.title,
      subtitle: course.subtitle,
      hook: course.hook,
      ...(course.featured !== undefined ? { featured: course.featured } : {}),
      ...(course.seo ? { seo: course.seo } : {}),
      storyIds,
      steps: course.steps.map((s) => ({ storyId: s.storyId, note: s.note })),
      storyCount: course.steps.length,
      totalCharCount,
      totalReadingTime: `約${readingMinutes}分`,
    });
  }

  return compiledCourses;
}

function buildIndexPayload(compiledMap, entities, compiledCourses, includeCourses, titleLookup) {
  const categoryCounts = Object.fromEntries(VALID_SHELF_CATEGORIES.map((c) => [c, 0]));
  const entitiesIndex = {};
  const indexStories = [];

  for (const compiled of compiledMap.values()) {
    categoryCounts[compiled.shelfCategory] = (categoryCounts[compiled.shelfCategory] || 0) + 1;

    for (const eid of compiled.entityIds) {
      if (!entitiesIndex[eid]) {
        const entity = entities[eid];
        const defaultEvidence = entity?.defaultEvidence || "";
        const evidenceLinks =
          defaultEvidence && titleLookup
            ? extractEvidenceLinks(defaultEvidence, titleLookup, null)
            : [];
        entitiesIndex[eid] = {
          name: entity?.name || eid,
          kind: entity?.kind || "character",
          defaultIdentity: entity?.defaultIdentity || "",
          defaultDesc: entity?.defaultDesc || "",
          defaultEvidence,
          ...(evidenceLinks.length > 0 ? { evidenceLinks } : {}),
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
    ...(includeCourses ? { courses: compiledCourses } : {}),
  };
}

function toPlainSearchText(text) {
  return formatGenderPlaceholders(stripInlineTags(text));
}

function buildSearchIndexPayload(compiledMap, entities, generatedAt) {
  const stories = {};

  for (const compiled of compiledMap.values()) {
    const termFirstLocation = new Map();
    const chapters = (compiled.chapters || []).map((ch, chapterIndex) => {
      const paragraphs = (ch.paragraphs || []).map((p, paragraphIndex) => {
        for (const ref of extractInlineTagReferences(p)) {
          if (!termFirstLocation.has(ref.termId)) {
            termFirstLocation.set(ref.termId, { chapterIndex, paragraphIndex });
          }
        }
        return toPlainSearchText(p);
      });

      return {
        chapterIndex,
        partLabel: toPlainSearchText(ch.partLabel),
        heading: toPlainSearchText(ch.heading),
        epigraph: toPlainSearchText(ch.epigraph),
        paragraphs,
        ...(ch.chapterNote ? { chapterNote: toPlainSearchText(ch.chapterNote) } : {}),
      };
    });

    const glossary = Object.entries(compiled.glossary || {}).map(([termId, entry]) => {
      const loc = termFirstLocation.get(termId) || { chapterIndex: 0, paragraphIndex: 0 };
      return {
        termId,
        term: toPlainSearchText(entry.term),
        identity: toPlainSearchText(entry.identity),
        desc: toPlainSearchText(entry.desc),
        firstChapterIndex: loc.chapterIndex,
        firstParagraphIndex: loc.paragraphIndex,
      };
    });

    const entityNames = (compiled.entityIds || [])
      .map((eid) => entities[eid]?.name || "")
      .filter(Boolean);

    const unreleasedVolumes = (compiled.unreleasedVolumes || []).map((vol, volumeIndex) => ({
      volumeIndex,
      partLabel: toPlainSearchText(vol.partLabel),
      description: toPlainSearchText(vol.description),
    }));

    stories[compiled.id] = {
      id: compiled.id,
      title: compiled.title,
      hook: compiled.hook,
      categoryLabel: compiled.categoryLabel,
      era: compiled.era,
      region: compiled.region || [],
      tags: compiled.tags || [],
      entityNames,
      preGuide: (compiled.preGuide || []).map((line) => toPlainSearchText(line)),
      chapters,
      ...(unreleasedVolumes.length > 0 ? { unreleasedVolumes } : {}),
      glossary,
      truth: {
        overallTruth: toPlainSearchText(compiled.overallTruth),
        gameEffect: toPlainSearchText(compiled.gameEffect),
      },
    };
  }

  return {
    generatedAt,
    stories,
  };
}

/**
 * 編集層ストーリー・マスタ・原典スナップショット読取ポートを受け取り、
 * スキーマゲート → Entity解決＆原文一致＆コーパス検証 → 双方向リンク展開＆配信データ構築を実行して値で返す。
 */
export function compileStories({
  stories,
  entities,
  courses,
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
    courseCount: Array.isArray(courses) ? courses.length : 0,
    corpusTermCount: Object.keys(officialCorpus?.terms || {}).length,
  };

  // Stage 1: Schema & 配置ゲート（不正構造時は Stage 2 へ進まず安全中断）
  const { gateErrors, canProceedToCompile, rawStories, rawCourses, hasExplicitCourses } =
    runSchemaAndPlacementGate({
      stories,
      entities,
      courses,
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

  for (const course of rawCourses) {
    validateCourseReferencesAndText(course, {
      storyIds,
      checkText,
      errors,
    });
  }

  if (hasExplicitCourses && rawCourses.length > 0 && errors.length === 0) {
    collectCourseHints(rawStories, rawCourses, warnings);
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

  // Stage 3: 双方向 connected 展開 + コース解決 + 配信データ構築
  expandBidirectionalConnections(rawStories, compiledMap);
  const compiledCourses = hasExplicitCourses
    ? buildCoursesPayloadAndAssignMemberships(rawCourses, compiledMap)
    : [];
  const index = buildIndexPayload(compiledMap, entities, compiledCourses, hasExplicitCourses, titleLookup);
  const searchIndex = buildSearchIndexPayload(compiledMap, entities, index.generatedAt);
  const storiesById = Object.fromEntries(compiledMap);

  return {
    ok: true,
    errors: [],
    warnings,
    dist: {
      index,
      searchIndex,
      storiesById,
    },
    stats,
  };
}
