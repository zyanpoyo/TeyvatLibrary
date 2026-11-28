import {
  resolveReadingStateReader,
  summarizeStoryIdsProgress,
  type ReadingStateInput,
} from "./catalog";
import {
  deriveCourseProgress,
  getCourseStoryIds,
  type CourseProgress,
} from "./courses";
import { normalizeSearchText, tokenizeSearchQuery } from "./search";
import type {
  CourseIndexItem,
  EntityIndexEntry,
  EntityKind,
  EntitySortMode,
  EvidenceLink,
  StoriesIndexData,
  StoryIndexItem,
} from "../types/story";

export const ENTITY_KIND_ORDER: ReadonlyArray<EntityKind> = [
  "character",
  "god",
  "organization",
  "concept",
  "place",
];

export const ENTITY_KIND_LABELS: Record<EntityKind, { label: string; heading: string }> = {
  character: { label: "人物", heading: "人物" },
  god: { label: "魔神・執政", heading: "魔神・執政" },
  organization: { label: "組織", heading: "組織" },
  concept: { label: "歴史・重要用語", heading: "歴史・重要用語" },
  place: { label: "地域・地名", heading: "地域・地名" },
};

export interface EntityArchiveItem {
  id: string;
  name: string;
  kind: EntityKind;
  storyIds: string[];
  defaultIdentity: string;
  defaultDesc: string;
  defaultEvidence: string;
  evidenceLinks: EvidenceLink[];
}

export interface EntityReadingProgress {
  readCount: number;
  totalCount: number;
  progressPercent: number;
  isCompleted: boolean;
  nextUnreadStoryId: string | null;
  ctaLabel: string;
}

export interface EntityListCardView {
  entity: EntityArchiveItem;
  progress: EntityReadingProgress;
  regions: string[];
}

export interface EntityKindGroup {
  kind: EntityKind;
  label: string;
  heading: string;
  items: EntityListCardView[];
}

export interface EntitiesArchiveViewModel {
  totalCount: number;
  filteredCount: number;
  availableKinds: EntityKind[];
  kindCounts: Record<"all" | EntityKind, number>;
  groups: EntityKindGroup[];
  hasActiveFilter: boolean;
}

export interface EntityStoryLinkView {
  storyId: string;
  story: StoryIndexItem | null;
  isRead: boolean;
  isBookmarked: boolean;
  isNextUnread: boolean;
}

export interface RelatedEntityCourseView {
  course: CourseIndexItem;
  progress: CourseProgress;
  overlapCount: number;
}

export interface RelatedEntityView {
  entity: EntityArchiveItem;
  sharedStoryCount: number;
}

export interface EntityDetailViewModel {
  entity: EntityArchiveItem;
  progress: EntityReadingProgress;
  stories: EntityStoryLinkView[];
  relatedCourses: RelatedEntityCourseView[];
  relatedEntities: RelatedEntityView[];
}

function compareEntityNames(a: string, b: string): number {
  return a.localeCompare(b, "ja");
}

function uniqueStrings(values: ReadonlyArray<string> | undefined | null): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const val of values ?? []) {
    if (typeof val === "string" && val.length > 0 && !seen.has(val)) {
      seen.add(val);
      result.push(val);
    }
  }
  return result;
}

function isValidEntityKind(kind: unknown): kind is EntityKind {
  return typeof kind === "string" && (ENTITY_KIND_ORDER as readonly string[]).includes(kind);
}

/**
 * 単一の entitiesIndex エントリをフロントエンド表示用の EntityArchiveItem へ正規化する。
 */
export function normalizeEntityEntry(
  entityId: string,
  entry: EntityIndexEntry | null | undefined
): EntityArchiveItem {
  const kind: EntityKind = isValidEntityKind(entry?.kind) ? entry.kind : "character";
  const evidenceLinks = Array.isArray(entry?.evidenceLinks)
    ? entry.evidenceLinks.filter(
        (link): link is EvidenceLink =>
          Boolean(link) && typeof link.title === "string" && typeof link.storyId === "string"
      )
    : [];

  return {
    id: entityId,
    name: entry?.name?.trim() || entityId,
    kind,
    storyIds: uniqueStrings(entry?.storyIds),
    defaultIdentity: entry?.defaultIdentity?.trim() || "",
    defaultDesc: entry?.defaultDesc?.trim() || "",
    defaultEvidence: entry?.defaultEvidence?.trim() || "",
    evidenceLinks,
  };
}

/**
 * stories-index.json の entitiesIndex を EntityArchiveItem の配列へ正規化する。
 */
export function normalizeEntitiesFromIndex(
  indexData: StoriesIndexData | null | undefined
): EntityArchiveItem[] {
  const raw = indexData?.entitiesIndex;
  if (!raw || typeof raw !== "object") return [];

  return Object.entries(raw).map(([entityId, entry]) =>
    normalizeEntityEntry(entityId, entry)
  );
}

/**
 * エンティティに関連する物語群の読了進捗・未読先頭作品・CTA 文言を導出する。
 */
export function deriveEntityProgress(
  storyIds: ReadonlyArray<string>,
  readingState: ReadingStateInput = null
): EntityReadingProgress {
  const uniqueIds = uniqueStrings(storyIds);
  const summary = summarizeStoryIdsProgress(uniqueIds, readingState);
  const nextUnreadStoryId =
    summary.totalCount === 0
      ? null
      : (summary.firstUnreadStoryId ?? uniqueIds[0]);

  let ctaLabel = "";
  if (summary.totalCount > 0) {
    if (summary.isCompleted) {
      ctaLabel = "最初の物語から読み直す";
    } else if (summary.readCount > 0) {
      ctaLabel = "次の未読作品を読む";
    } else {
      ctaLabel = "最初の物語を読む";
    }
  }

  return {
    readCount: summary.readCount,
    totalCount: summary.totalCount,
    progressPercent: summary.progressPercent,
    isCompleted: summary.isCompleted,
    nextUnreadStoryId,
    ctaLabel,
  };
}

function matchesEntityQuery(
  entity: EntityArchiveItem,
  tokens: ReadonlyArray<string>,
  storyById: ReadonlyMap<string, StoryIndexItem>
): boolean {
  if (tokens.length === 0) return true;

  const relatedTitles = entity.storyIds
    .map((sid) => storyById.get(sid)?.title || "")
    .filter(Boolean);
  const combined = normalizeSearchText(
    [
      entity.name,
      entity.defaultIdentity,
      entity.defaultDesc,
      entity.defaultEvidence,
      ...relatedTitles,
    ]
      .filter(Boolean)
      .join(" ")
  );

  return tokens.every((token) => combined.includes(token));
}

function sortEntities(
  items: ReadonlyArray<EntityArchiveItem>,
  sort: EntitySortMode
): EntityArchiveItem[] {
  const copy = items.slice();
  if (sort === "name") {
    return copy.sort((a, b) => compareEntityNames(a.name, b.name));
  }
  return copy.sort((a, b) => {
    const countDiff = b.storyIds.length - a.storyIds.length;
    if (countDiff !== 0) return countDiff;
    return compareEntityNames(a.name, b.name);
  });
}

function collectEntityRegions(
  storyIds: ReadonlyArray<string>,
  storyById: ReadonlyMap<string, StoryIndexItem>
): string[] {
  const regions: string[] = [];
  const seen = new Set<string>();
  for (const sid of storyIds) {
    const story = storyById.get(sid);
    for (const region of story?.region ?? []) {
      const trimmed = region.trim();
      if (trimmed && !seen.has(trimmed)) {
        seen.add(trimmed);
        regions.push(trimmed);
      }
    }
  }
  return regions;
}

/**
 * 人物・用語名鑑一覧ページ（/entities）のフィルタリング・検索・並び替え・種別グループ化を導出する。
 */
export function deriveEntitiesArchiveView({
  indexData,
  readingState = null,
  kindFilter = "all",
  query = "",
  sort = "stories",
}: {
  indexData: StoriesIndexData | null | undefined;
  readingState?: ReadingStateInput;
  kindFilter?: "all" | EntityKind;
  query?: string;
  sort?: EntitySortMode;
}): EntitiesArchiveViewModel {
  const reader = resolveReadingStateReader(readingState);
  const allEntities = normalizeEntitiesFromIndex(indexData);
  const storyById = new Map((indexData?.stories ?? []).map((s) => [s.id, s]));
  const tokens = tokenizeSearchQuery(query);

  const kindCounts: Record<"all" | EntityKind, number> = {
    all: allEntities.length,
    character: 0,
    god: 0,
    organization: 0,
    concept: 0,
    place: 0,
  };
  for (const entity of allEntities) {
    kindCounts[entity.kind] += 1;
  }

  const availableKinds = ENTITY_KIND_ORDER.filter((kind) => kindCounts[kind] > 0);
  const hasActiveFilter = kindFilter !== "all" || tokens.length > 0;

  const groups: EntityKindGroup[] = [];
  let filteredCount = 0;

  for (const kind of ENTITY_KIND_ORDER) {
    if (kindFilter !== "all" && kind !== kindFilter) continue;
    const matched = allEntities.filter(
      (entity) => entity.kind === kind && matchesEntityQuery(entity, tokens, storyById)
    );
    if (matched.length === 0) continue;

    const sorted = sortEntities(matched, sort);
    filteredCount += sorted.length;

    groups.push({
      kind,
      label: ENTITY_KIND_LABELS[kind].label,
      heading: ENTITY_KIND_LABELS[kind].heading,
      items: sorted.map((entity) => ({
        entity,
        progress: deriveEntityProgress(entity.storyIds, reader),
        regions: collectEntityRegions(entity.storyIds, storyById),
      })),
    });
  }

  return {
    totalCount: allEntities.length,
    filteredCount,
    availableKinds,
    kindCounts,
    groups,
    hasActiveFilter,
  };
}

/**
 * 人物・用語名鑑詳細ページ（/entities/:entityId）の登場作品・読了進捗・関連コース・共起エンティティを導出する。
 */
export function deriveEntityDetailView({
  entityId,
  indexData,
  readingState = null,
  relatedEntityLimit = 8,
}: {
  entityId: string;
  indexData: StoriesIndexData | null | undefined;
  readingState?: ReadingStateInput;
  relatedEntityLimit?: number;
}): EntityDetailViewModel | null {
  const entitiesIndex = indexData?.entitiesIndex;
  if (!entityId || !entitiesIndex || !Object.hasOwn(entitiesIndex, entityId)) {
    return null;
  }

  const reader = resolveReadingStateReader(readingState);
  const entity = normalizeEntityEntry(entityId, entitiesIndex[entityId]);
  const allStories = indexData.stories ?? [];
  const storyById = new Map(allStories.map((s) => [s.id, s]));
  const entityStorySet = new Set(entity.storyIds);

  // 書架の公開順（indexData.stories の順）に沿って登場作品を並べ、未登録 ID は末尾へ補完
  const orderedStoryIds: string[] = [];
  const seenStoryIds = new Set<string>();
  for (const story of allStories) {
    if (entityStorySet.has(story.id) && !seenStoryIds.has(story.id)) {
      seenStoryIds.add(story.id);
      orderedStoryIds.push(story.id);
    }
  }
  for (const sid of entity.storyIds) {
    if (!seenStoryIds.has(sid)) {
      seenStoryIds.add(sid);
      orderedStoryIds.push(sid);
    }
  }

  const progress = deriveEntityProgress(orderedStoryIds, reader);
  const stories: EntityStoryLinkView[] = orderedStoryIds.map((sid) => ({
    storyId: sid,
    story: storyById.get(sid) ?? null,
    isRead: Boolean(reader?.isRead(sid)),
    isBookmarked: Boolean(reader?.isBookmarked?.(sid)),
    isNextUnread: !progress.isCompleted && progress.nextUnreadStoryId === sid,
  }));

  const relatedCourses: RelatedEntityCourseView[] = (indexData.courses ?? [])
    .map((course) => {
      const courseStoryIds = getCourseStoryIds(course);
      const overlapCount = courseStoryIds.reduce(
        (count, sid) => count + (entityStorySet.has(sid) ? 1 : 0),
        0
      );
      return {
        course,
        overlapCount,
        progress: deriveCourseProgress(course, reader),
      };
    })
    .filter((item) => item.overlapCount > 0)
    .sort((a, b) => b.overlapCount - a.overlapCount);

  const coOccurrenceCounts = new Map<string, number>();
  for (const sid of orderedStoryIds) {
    const story = storyById.get(sid);
    for (const otherId of story?.entityIds ?? []) {
      if (!otherId || otherId === entityId || !Object.hasOwn(entitiesIndex, otherId)) continue;
      coOccurrenceCounts.set(otherId, (coOccurrenceCounts.get(otherId) ?? 0) + 1);
    }
  }

  const relatedEntities: RelatedEntityView[] =
    relatedEntityLimit <= 0
      ? []
      : Array.from(coOccurrenceCounts.entries())
          .map(([otherId, sharedStoryCount]) => ({
            entity: normalizeEntityEntry(otherId, entitiesIndex[otherId]),
            sharedStoryCount,
          }))
          .sort((a, b) => {
            if (b.sharedStoryCount !== a.sharedStoryCount) {
              return b.sharedStoryCount - a.sharedStoryCount;
            }
            if (b.entity.storyIds.length !== a.entity.storyIds.length) {
              return b.entity.storyIds.length - a.entity.storyIds.length;
            }
            return compareEntityNames(a.entity.name, b.entity.name);
          })
          .slice(0, relatedEntityLimit);

  return {
    entity,
    progress,
    stories,
    relatedCourses,
    relatedEntities,
  };
}
