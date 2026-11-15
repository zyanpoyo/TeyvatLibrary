import type { ShelfCategoryId, ShelfFilters, SortMode, StoryIndexItem } from "../types/story";

export const SHORT_STORY_MAX_CHARS = 1800;
export const NEW_BADGE_DAYS = 14;

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
}

export function getLocalDateKey(now: Date = new Date()): string {
  const y = String(now.getFullYear());
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseIsoDateUtcMs(dateStr: unknown): number | null {
  if (typeof dateStr !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return null;
  }
  const [y, m, d] = dateStr.split("-").map(Number);
  const utcMs = Date.UTC(y, m - 1, d);
  const dt = new Date(utcMs);
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    return null;
  }
  return utcMs;
}

export function hashDateSeed(dateKey: string): number {
  let hash = 2166136261;
  for (let i = 0; i < dateKey.length; i += 1) {
    hash ^= dateKey.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function isNewStory(
  story: Pick<StoryIndexItem, "id" | "addedAt"> | null | undefined,
  readingState: ReadingStateReader | null = null,
  now: Date = new Date()
): boolean {
  if (!story?.addedAt || readingState?.isRead(story.id)) return false;
  const addedUtcMs = parseIsoDateUtcMs(story.addedAt);
  if (addedUtcMs === null) return false;
  const todayUtcMs = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.floor((todayUtcMs - addedUtcMs) / 86400000);
  return diffDays >= 0 && diffDays <= NEW_BADGE_DAYS;
}

export function isDefaultShelfState(filters: Partial<ShelfFilters>): boolean {
  return (
    filters.category === "all" &&
    (!filters.status || filters.status === "all") &&
    !filters.entityId &&
    !filters.region &&
    !(filters.query || "").trim() &&
    (!filters.sort || filters.sort === "recommended")
  );
}

export function selectFeaturedStoryId(
  stories: ReadonlyArray<Pick<StoryIndexItem, "id">> | null | undefined,
  readingState: ReadingStateReader | null = null,
  now: Date = new Date()
): string | null {
  const list = stories || [];
  if (list.length === 0) return null;
  const unread = list.filter((s) => !readingState?.isRead(s.id));
  const pool = (unread.length > 0 ? unread : list)
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id));
  const seed = hashDateSeed(getLocalDateKey(now));
  return pool[seed % pool.length].id;
}

export function sortStories<T extends Pick<StoryIndexItem, "addedAt" | "charCount">>(
  stories: ReadonlyArray<T> | null | undefined,
  sortMode: SortMode = "recommended"
): T[] {
  const list = (stories || []).slice();
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
  return list;
}

export function filterStories<T extends StoryIndexItem>(
  stories: ReadonlyArray<T> | null | undefined,
  filters: Pick<ShelfFilters, "category" | "status" | "entityId" | "region" | "query">,
  readingState: ReadingStateReader | null = null
): T[] {
  const query = (filters.query || "").trim().toLowerCase();
  const status = filters.status || "all";
  return (stories || []).filter((story) => {
    if (filters.category !== "all" && story.shelfCategory !== filters.category) {
      return false;
    }
    if (status === "unread" && readingState?.isRead(story.id)) {
      return false;
    }
    if (status === "read" && !readingState?.isRead(story.id)) {
      return false;
    }
    if (status === "bookmarked" && !readingState?.isBookmarked?.(story.id)) {
      return false;
    }
    if (filters.entityId && !(story.entityIds || []).includes(filters.entityId)) {
      return false;
    }
    if (filters.region && !(story.region || []).includes(filters.region)) {
      return false;
    }
    if (query) {
      const haystack = [
        story.title,
        story.hook,
        story.era,
        story.categoryLabel,
        ...(story.region || []),
        ...(story.tags || []),
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

export function arrangeShelfStories<T extends StoryIndexItem>(
  filteredStories: ReadonlyArray<T>,
  allStories: ReadonlyArray<T>,
  filters: ShelfFilters,
  readingState: ReadingStateReader | null = null,
  now: Date = new Date()
): { ordered: T[]; featuredId: string | null } {
  const sorted = sortStories(filteredStories, filters.sort);
  if (!isDefaultShelfState(filters) || sorted.length === 0) {
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

export function pickRandomStory<T extends Pick<StoryIndexItem, "id" | "charCount">>(
  stories: ReadonlyArray<T> | null | undefined,
  readingState: ReadingStateReader | null = null,
  excludeStoryId: string | null = null,
  rng: () => number = Math.random
): T | null {
  const list = stories || [];
  if (list.length === 0) return null;
  const unread = list.filter((s) => !readingState?.isRead(s.id));
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
