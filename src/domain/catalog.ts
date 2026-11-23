import { createReadingStateReader } from "../state/reading-state";
import { evaluateCatalogSearch, type StorySearchMatch } from "./search";
import { parseIsoDateUtcMs } from "./text-parser";
import type {
  EntityKind,
  LastSessionSnapshot,
  ReadingStateSnapshot,
  SearchIndexData,
  ShelfCategoryId,
  ShelfFilters,
  SortMode,
  StoriesIndexData,
  StoryCategoryId,
  StoryIndexItem,
} from "../types/story";

export const SHORT_STORY_MAX_CHARS = 1800;
export const NEW_BADGE_DAYS = 14;

export const DEFAULT_SHELF_FILTERS: ShelfFilters = {
  category: "all",
  status: "all",
  entityId: "",
  region: "",
  query: "",
  includeTruth: false,
  sort: "recommended",
};

export const SHELF_CATEGORIES: ReadonlyArray<{ id: ShelfCategoryId; label: string }> = [
  { id: "all", label: "すべて" },
  { id: "book", label: "書籍" },
  { id: "artifact", label: "聖遺物" },
  { id: "weapon", label: "武器" },
  { id: "attire", label: "風の翼" },
  { id: "chronicle", label: "突破・育成素材" },
];

export interface ReadingStateReader {
  isRead(storyId: string): boolean;
  isBookmarked?(storyId: string): boolean;
  getLastSession?(validStoryIds?: ReadonlySet<string> | null): LastSessionSnapshot | null;
}

export type ReadingStateInput = ReadingStateReader | ReadingStateSnapshot | null;

export function resolveReadingStateReader(
  input: ReadingStateInput | undefined
): ReadingStateReader | null {
  if (!input) return null;
  if ("isRead" in input && typeof input.isRead === "function") {
    return input;
  }
  return createReadingStateReader(input as ReadingStateSnapshot);
}

export interface ShelfCategoryTab {
  id: ShelfCategoryId;
  label: string;
  count: number;
  isActive: boolean;
}

export interface ShelfEntityOption {
  id: string;
  name: string;
  kind: EntityKind;
  count: number;
}

export interface ShelfCardItem {
  story: StoryIndexItem;
  isFeatured: boolean;
  isRead: boolean;
  isNew: boolean;
  isBookmarked: boolean;
  searchMatch: StorySearchMatch | null;
}

export interface ShelfResumeState {
  session: LastSessionSnapshot;
  story: StoryIndexItem;
}

export interface DeriveShelfViewInput {
  indexData: StoriesIndexData | null;
  searchIndex?: SearchIndexData | null;
  filters: Partial<ShelfFilters>;
  readingState?: ReadingStateInput;
  now?: Date;
}

export interface ShelfViewModel {
  hasIndexData: boolean;
  hasSearchQuery: boolean;
  isFiltered: boolean;
  isDefaultState: boolean;
  categories: ShelfCategoryTab[];
  entities: ShelfEntityOption[];
  regions: string[];
  items: ShelfCardItem[];
  featuredId: string | null;
  orderedCount: number;
  totalCount: number;
  readCount: number;
  allRead: boolean;
  resume: ShelfResumeState | null;
}

function getLocalDateKey(now: Date = new Date()): string {
  const y = String(now.getFullYear());
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * SSG プリレンダリング時とクライアント初回ハイドレーション時で、
 * 実行環境のタイムゾーンや閲覧日時に左右されず同一のローカル日付（YYYY-MM-DD）となる基準 Date を返す。
 */
export function resolveHydrationSafeNow(
  generatedAt: string | null | undefined,
  fallback: Date = new Date()
): Date {
  if (typeof generatedAt === "string" && generatedAt.length >= 10) {
    const utcMs = parseIsoDateUtcMs(generatedAt.slice(0, 10));
    if (utcMs !== null) {
      const utcDate = new Date(utcMs);
      return new Date(
        utcDate.getUTCFullYear(),
        utcDate.getUTCMonth(),
        utcDate.getUTCDate(),
        12,
        0,
        0,
        0
      );
    }
  }
  return fallback;
}

function hashDateSeed(dateKey: string): number {
  let hash = 2166136261;
  for (let i = 0; i < dateKey.length; i += 1) {
    hash ^= dateKey.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function isNewStory(
  story: Pick<StoryIndexItem, "id" | "addedAt"> | null | undefined,
  readingState: ReadingStateReader | null,
  now: Date
): boolean {
  if (!story?.addedAt || readingState?.isRead(story.id)) return false;
  const addedUtcMs = parseIsoDateUtcMs(story.addedAt);
  if (addedUtcMs === null) return false;
  const todayUtcMs = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.floor((todayUtcMs - addedUtcMs) / 86400000);
  return diffDays >= 0 && diffDays <= NEW_BADGE_DAYS;
}

function normalizeFilters(filters: Partial<ShelfFilters>): ShelfFilters {
  return {
    category: filters.category || DEFAULT_SHELF_FILTERS.category,
    status: filters.status || DEFAULT_SHELF_FILTERS.status,
    entityId: filters.entityId ?? DEFAULT_SHELF_FILTERS.entityId,
    region: filters.region ?? DEFAULT_SHELF_FILTERS.region,
    query: filters.query ?? DEFAULT_SHELF_FILTERS.query,
    includeTruth: Boolean(filters.includeTruth),
    sort: filters.sort || DEFAULT_SHELF_FILTERS.sort,
  };
}

function isFilteredShelf(filters: ShelfFilters): boolean {
  return Boolean(
    filters.category !== "all" ||
      filters.status !== "all" ||
      filters.entityId ||
      filters.region ||
      filters.query.trim()
  );
}

function selectFeaturedStoryId(
  stories: ReadonlyArray<Pick<StoryIndexItem, "id">>,
  readingState: ReadingStateReader | null,
  now: Date
): string | null {
  if (stories.length === 0) return null;
  const unread = stories.filter((s) => !readingState?.isRead(s.id));
  const pool = (unread.length > 0 ? unread : stories)
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id));
  const seed = hashDateSeed(getLocalDateKey(now));
  return pool[seed % pool.length].id;
}

function sortStories<T extends Pick<StoryIndexItem, "id" | "addedAt" | "charCount">>(
  stories: ReadonlyArray<T>,
  sortMode: SortMode,
  matchesByStoryId: ReadonlyMap<string, StorySearchMatch> | null
): T[] {
  const list = stories.slice();
  if (sortMode === "newest") {
    return list.sort((a, b) => {
      const aMs = parseIsoDateUtcMs(a.addedAt);
      const bMs = parseIsoDateUtcMs(b.addedAt);
      if (aMs === null && bMs === null) return 0;
      if (aMs === null) return 1;
      if (bMs === null) return -1;
      return bMs - aMs;
    });
  }
  if (sortMode === "shortest") {
    return list.sort((a, b) => {
      const aCount = typeof a.charCount === "number" ? a.charCount : Infinity;
      const bCount = typeof b.charCount === "number" ? b.charCount : Infinity;
      return aCount - bCount;
    });
  }
  if (matchesByStoryId) {
    return list.sort((a, b) => {
      const aScore = matchesByStoryId.get(a.id)?.score ?? 0;
      const bScore = matchesByStoryId.get(b.id)?.score ?? 0;
      return bScore - aScore;
    });
  }
  return list;
}

function matchesNonCategoryFacets(
  story: StoryIndexItem,
  filters: ShelfFilters,
  readingState: ReadingStateReader | null
): boolean {
  if (filters.status === "unread" && readingState?.isRead(story.id)) {
    return false;
  }
  if (filters.status === "read" && !readingState?.isRead(story.id)) {
    return false;
  }
  if (filters.status === "bookmarked" && !readingState?.isBookmarked?.(story.id)) {
    return false;
  }
  if (filters.entityId && !(story.entityIds || []).includes(filters.entityId)) {
    return false;
  }
  if (filters.region && !(story.region || []).includes(filters.region)) {
    return false;
  }
  return true;
}

function arrangeShelfStories<T extends StoryIndexItem>(
  filteredStories: ReadonlyArray<T>,
  allStories: ReadonlyArray<T>,
  sortMode: SortMode,
  isDefaultState: boolean,
  matchesByStoryId: ReadonlyMap<string, StorySearchMatch> | null,
  readingState: ReadingStateReader | null,
  now: Date
): { ordered: T[]; featuredId: string | null } {
  const sorted = sortStories(filteredStories, sortMode, matchesByStoryId);
  if (!isDefaultState || sorted.length === 0) {
    return { ordered: sorted, featuredId: null };
  }
  const featuredId = selectFeaturedStoryId(allStories, readingState, now);
  if (!featuredId) {
    return { ordered: sorted, featuredId: null };
  }
  const featuredIdx = sorted.findIndex((s) => s.id === featuredId);
  if (featuredIdx <= 0) {
    return { ordered: sorted, featuredId: featuredIdx === 0 ? featuredId : null };
  }
  const ordered = [
    sorted[featuredIdx],
    ...sorted.slice(0, featuredIdx),
    ...sorted.slice(featuredIdx + 1),
  ];
  return { ordered, featuredId };
}

function deriveCategoryTabs(
  stories: ReadonlyArray<StoryIndexItem>,
  indexData: StoriesIndexData | null,
  activeCategory: ShelfCategoryId,
  useComputedCounts: boolean
): ShelfCategoryTab[] {
  const countedByCategory: Record<StoryCategoryId, number> = {
    book: 0,
    artifact: 0,
    weapon: 0,
    attire: 0,
    chronicle: 0,
  };
  for (const story of stories) {
    if (Object.hasOwn(countedByCategory, story.shelfCategory)) {
      countedByCategory[story.shelfCategory] += 1;
    }
  }
  const totalCount = stories.length;
  return SHELF_CATEGORIES.map((cat) => {
    const count =
      cat.id === "all"
        ? totalCount
        : useComputedCounts
          ? countedByCategory[cat.id]
          : (indexData?.categoryCounts?.[cat.id] ?? countedByCategory[cat.id]);
    return {
      id: cat.id,
      label: cat.label,
      count,
      isActive: cat.id === activeCategory,
    };
  });
}

function deriveEntities(indexData: StoriesIndexData | null): ShelfEntityOption[] {
  if (!indexData?.entitiesIndex) return [];
  return Object.entries(indexData.entitiesIndex)
    .map(([id, info]) => ({
      id,
      name: info.name,
      kind: info.kind,
      count: info.storyIds?.length || 0,
    }))
    .sort((a, b) => b.count - a.count);
}

function deriveRegions(stories: ReadonlyArray<StoryIndexItem>): string[] {
  const regionSet = new Set<string>();
  for (const story of stories) {
    for (const r of story.region || []) {
      regionSet.add(r);
    }
  }
  return [...regionSet];
}

function deriveReadCount(
  validStoryIds: ReadonlySet<string>,
  readingState: ReadingStateReader | null
): number {
  if (!readingState) return 0;
  let count = 0;
  for (const id of validStoryIds) {
    if (readingState.isRead(id)) {
      count += 1;
    }
  }
  return count;
}

function deriveResumeState(
  stories: ReadonlyArray<StoryIndexItem>,
  validStoryIds: ReadonlySet<string>,
  readingState: ReadingStateReader | null
): ShelfResumeState | null {
  const lastSession = readingState?.getLastSession?.(validStoryIds) ?? null;
  if (!lastSession) return null;
  const story = stories.find((s) => s.id === lastSession.storyId) ?? null;
  if (!story) return null;
  return { session: lastSession, story };
}

/**
 * 書架画面の表示に必要なカード一覧・ピックアップ・ファセット選択肢・集計値を一括導出する。
 */
export function deriveShelfView({
  indexData,
  searchIndex = null,
  filters,
  readingState = null,
  now = new Date(),
}: DeriveShelfViewInput): ShelfViewModel {
  const reader = resolveReadingStateReader(readingState);
  const normalizedFilters = normalizeFilters(filters);
  const isFiltered = isFilteredShelf(normalizedFilters);
  const isDefaultState = !isFiltered && normalizedFilters.sort === "recommended";

  const stories = indexData?.stories ?? [];
  const validStoryIds = new Set(stories.map((s) => s.id));
  const totalCount = stories.length;
  const readCount = deriveReadCount(validStoryIds, reader);
  const allRead = totalCount > 0 && readCount >= totalCount;

  const searchResult = evaluateCatalogSearch({
    indexData,
    searchIndex,
    query: normalizedFilters.query,
    includeTruth: normalizedFilters.includeTruth,
    isStoryRead: (id) => Boolean(reader?.isRead(id)),
  });

  const matchedWithoutCategory = stories.filter(
    (story) =>
      matchesNonCategoryFacets(story, normalizedFilters, reader) &&
      (!searchResult.hasQuery || searchResult.matchesByStoryId.has(story.id))
  );

  const filtered =
    normalizedFilters.category === "all"
      ? matchedWithoutCategory
      : matchedWithoutCategory.filter((s) => s.shelfCategory === normalizedFilters.category);

  const { ordered, featuredId } = arrangeShelfStories(
    filtered,
    stories,
    normalizedFilters.sort,
    isDefaultState,
    searchResult.hasQuery ? searchResult.matchesByStoryId : null,
    reader,
    now
  );

  const items: ShelfCardItem[] = ordered.map((story) => ({
    story,
    isFeatured: Boolean(featuredId && story.id === featuredId),
    isRead: Boolean(reader?.isRead(story.id)),
    isNew: isNewStory(story, reader, now),
    isBookmarked: Boolean(reader?.isBookmarked?.(story.id)),
    searchMatch: searchResult.hasQuery
      ? (searchResult.matchesByStoryId.get(story.id) ?? null)
      : null,
  }));

  const tabSourceStories = searchResult.hasQuery ? matchedWithoutCategory : stories;

  return {
    hasIndexData: Boolean(indexData),
    hasSearchQuery: searchResult.hasQuery,
    isFiltered,
    isDefaultState,
    categories: deriveCategoryTabs(
      tabSourceStories,
      indexData,
      normalizedFilters.category,
      searchResult.hasQuery
    ),
    entities: deriveEntities(indexData),
    regions: deriveRegions(stories),
    items,
    featuredId,
    orderedCount: items.length,
    totalCount,
    readCount,
    allRead,
    resume: deriveResumeState(stories, validStoryIds, reader),
  };
}

/**
 * おまかせ読書用に、未読短編を優先してランダムに1作品を選出する。
 */
export function pickRandomStory<T extends Pick<StoryIndexItem, "id" | "charCount">>(
  stories: ReadonlyArray<T> | null | undefined,
  readingState: ReadingStateInput = null,
  excludeStoryId: string | null = null,
  rng: () => number = Math.random
): T | null {
  const reader = resolveReadingStateReader(readingState);
  const list = stories || [];
  if (list.length === 0) return null;
  const unread = list.filter((s) => !reader?.isRead(s.id));
  const unreadShort = unread.filter(
    (s) => typeof s.charCount === "number" && s.charCount <= SHORT_STORY_MAX_CHARS
  );
  let pool = unreadShort.length > 0 ? unreadShort : unread.length > 0 ? unread : list;
  if (excludeStoryId && pool.length > 1) {
    pool = pool.filter((s) => s.id !== excludeStoryId);
  }
  const rawIndex = Math.floor(rng() * pool.length);
  const safeIndex = Math.max(0, Math.min(rawIndex, pool.length - 1));
  return pool[safeIndex] || null;
}
