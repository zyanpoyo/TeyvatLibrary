import { describe, expect, it } from "vitest";
import {
  DEFAULT_SHELF_FILTERS,
  deriveShelfView,
  pickRandomStory,
  type ReadingStateReader,
} from "../src/domain/catalog";
import type { LastSessionSnapshot, StoriesIndexData, StoryIndexItem } from "../src/types/story";

const SAMPLE_STORIES: StoryIndexItem[] = [
  {
    id: "byakuyakoku",
    title: "白夜国館蔵",
    shelfCategory: "book",
    categoryLabel: "書籍（古文書・禁書）",
    region: ["淵下宮", "海祇島"],
    era: "日月前事",
    addedAt: "2026-11-01",
    readingTime: "約6分",
    charCount: 3200,
    hook: "太陽の子と白蛇の記録",
    tags: ["オロバシ", "アビス"],
    entityIds: ["orobashi"],
  },
  {
    id: "crimson_witch",
    title: "燃え盛る炎の魔女",
    shelfCategory: "artifact",
    categoryLabel: "聖遺物（連作短編）",
    region: ["モンド", "スメール"],
    era: "500年前の災厄",
    addedAt: "2026-11-10",
    readingTime: "約3分",
    charCount: 1500,
    hook: "液体の炎へと変えた少女",
    tags: ["ロザリン"],
    entityIds: ["rosalyne", "rustan"],
  },
  {
    id: "elegy",
    title: "終焉を嘆く詩",
    shelfCategory: "weapon",
    categoryLabel: "武器（短編小説）",
    region: ["モンド"],
    era: "500年前の災厄",
    addedAt: "2026-10-15",
    readingTime: "約2分",
    charCount: 1100,
    hook: "西風騎士ルースタンの最期",
    tags: ["ルースタン"],
    entityIds: ["rustan"],
  },
];

const SAMPLE_INDEX: StoriesIndexData = {
  generatedAt: "2026-11-15T00:00:00.000Z",
  totalCount: 3,
  categoryCounts: {
    book: 1,
    artifact: 1,
    weapon: 1,
    attire: 0,
    chronicle: 0,
  },
  entitiesIndex: {
    orobashi: {
      name: "オロバシ",
      kind: "god",
      storyIds: ["byakuyakoku"],
    },
    rustan: {
      name: "ルースタン",
      kind: "character",
      storyIds: ["crimson_witch", "elegy"],
    },
    rosalyne: {
      name: "ロザリン",
      kind: "character",
      storyIds: ["crimson_witch"],
    },
  },
  stories: SAMPLE_STORIES,
};

function createStubReadingState({
  readIds = [],
  bookmarkedIds = [],
  lastSession = null,
}: {
  readIds?: string[];
  bookmarkedIds?: string[];
  lastSession?: LastSessionSnapshot | null;
} = {}): ReadingStateReader {
  const readSet = new Set(readIds);
  const bookmarkSet = new Set(bookmarkedIds);
  return {
    isRead: (id) => readSet.has(id),
    isBookmarked: (id) => bookmarkSet.has(id),
    getLastSession: (validStoryIds) => {
      if (!lastSession) return null;
      if (validStoryIds && !validStoryIds.has(lastSession.storyId)) return null;
      return lastSession;
    },
  };
}

describe("catalog domain", () => {
  it("handles null indexData safely", () => {
    const view = deriveShelfView({
      indexData: null,
      filters: DEFAULT_SHELF_FILTERS,
      readingState: createStubReadingState({ readIds: ["byakuyakoku"] }),
    });

    expect(view.hasIndexData).toBe(false);
    expect(view.isFiltered).toBe(false);
    expect(view.isDefaultState).toBe(true);
    expect(view.items).toEqual([]);
    expect(view.orderedCount).toBe(0);
    expect(view.totalCount).toBe(0);
    expect(view.readCount).toBe(0);
    expect(view.allRead).toBe(false);
    expect(view.resume).toBeNull();
    expect(view.categories.every((c) => c.count === 0)).toBe(true);
  });

  it("filters by category, status, entityId, region, and query and tracks isFiltered consistently", () => {
    const now = new Date(2026, 10, 15);
    const readingState = createStubReadingState({
      readIds: ["byakuyakoku"],
      bookmarkedIds: ["elegy"],
    });

    const byCategory = deriveShelfView({
      indexData: SAMPLE_INDEX,
      filters: { ...DEFAULT_SHELF_FILTERS, category: "artifact" },
      readingState,
      now,
    });
    expect(byCategory.isFiltered).toBe(true);
    expect(byCategory.isDefaultState).toBe(false);
    expect(byCategory.featuredId).toBeNull();
    expect(byCategory.items.map((item) => item.story.id)).toEqual(["crimson_witch"]);
    expect(byCategory.categories.find((c) => c.id === "artifact")?.isActive).toBe(true);

    const unreadOnly = deriveShelfView({
      indexData: SAMPLE_INDEX,
      filters: { ...DEFAULT_SHELF_FILTERS, status: "unread" },
      readingState,
      now,
    });
    expect(unreadOnly.isFiltered).toBe(true);
    expect(unreadOnly.items.map((item) => item.story.id)).toEqual(["crimson_witch", "elegy"]);

    const bookmarkedOnly = deriveShelfView({
      indexData: SAMPLE_INDEX,
      filters: { ...DEFAULT_SHELF_FILTERS, status: "bookmarked" },
      readingState,
      now,
    });
    expect(bookmarkedOnly.items.map((item) => item.story.id)).toEqual(["elegy"]);
    expect(bookmarkedOnly.items[0].isBookmarked).toBe(true);

    const byEntityAndRegion = deriveShelfView({
      indexData: SAMPLE_INDEX,
      filters: { ...DEFAULT_SHELF_FILTERS, entityId: "rustan", region: "スメール" },
      readingState,
      now,
    });
    expect(byEntityAndRegion.isFiltered).toBe(true);
    expect(byEntityAndRegion.items.map((item) => item.story.id)).toEqual(["crimson_witch"]);

    const byQuery = deriveShelfView({
      indexData: SAMPLE_INDEX,
      filters: { ...DEFAULT_SHELF_FILTERS, query: "白蛇" },
      readingState,
      now,
    });
    expect(byQuery.isFiltered).toBe(true);
    expect(byQuery.items.map((item) => item.story.id)).toEqual(["byakuyakoku"]);

    const whitespaceQuery = deriveShelfView({
      indexData: SAMPLE_INDEX,
      filters: { ...DEFAULT_SHELF_FILTERS, query: "   " },
      readingState,
      now,
    });
    expect(whitespaceQuery.isFiltered).toBe(false);
    expect(whitespaceQuery.isDefaultState).toBe(true);
  });

  it("sorts by newest and shortest without marking as filtered and suppresses featured pickup", () => {
    const now = new Date(2026, 10, 15);
    const readingState = createStubReadingState();

    const newest = deriveShelfView({
      indexData: SAMPLE_INDEX,
      filters: { ...DEFAULT_SHELF_FILTERS, sort: "newest" },
      readingState,
      now,
    });
    expect(newest.isFiltered).toBe(false);
    expect(newest.isDefaultState).toBe(false);
    expect(newest.featuredId).toBeNull();
    expect(newest.items.every((item) => !item.isFeatured)).toBe(true);
    expect(newest.items.map((item) => item.story.id)).toEqual([
      "crimson_witch",
      "byakuyakoku",
      "elegy",
    ]);

    const shortest = deriveShelfView({
      indexData: SAMPLE_INDEX,
      filters: { ...DEFAULT_SHELF_FILTERS, sort: "shortest" },
      readingState,
      now,
    });
    expect(shortest.isFiltered).toBe(false);
    expect(shortest.featuredId).toBeNull();
    expect(shortest.items.map((item) => item.story.id)).toEqual([
      "elegy",
      "crimson_witch",
      "byakuyakoku",
    ]);
  });

  it("derives card flags (isNew 14-day window, isRead, isFeatured) and promotes daily unread pickup", () => {
    const now = new Date(2026, 10, 15);
    const readingState = createStubReadingState({
      readIds: ["byakuyakoku", "crimson_witch"],
      bookmarkedIds: ["crimson_witch"],
    });

    const view = deriveShelfView({
      indexData: SAMPLE_INDEX,
      filters: DEFAULT_SHELF_FILTERS,
      readingState,
      now,
    });

    expect(view.isFiltered).toBe(false);
    expect(view.isDefaultState).toBe(true);
    expect(view.featuredId).toBe("elegy");
    expect(view.items[0].story.id).toBe("elegy");
    expect(view.items[0].isFeatured).toBe(true);
    expect(view.items[0].isRead).toBe(false);
    expect(view.items[0].isNew).toBe(false);

    const witchItem = view.items.find((item) => item.story.id === "crimson_witch");
    expect(witchItem?.isRead).toBe(true);
    expect(witchItem?.isNew).toBe(false);
    expect(witchItem?.isBookmarked).toBe(true);

    // Unread story added within 14 days gets NEW badge
    const unreadView = deriveShelfView({
      indexData: SAMPLE_INDEX,
      filters: DEFAULT_SHELF_FILTERS,
      readingState: createStubReadingState(),
      now,
    });
    const unreadByakuya = unreadView.items.find((item) => item.story.id === "byakuyakoku");
    const unreadWitch = unreadView.items.find((item) => item.story.id === "crimson_witch");
    const unreadElegy = unreadView.items.find((item) => item.story.id === "elegy");
    expect(unreadByakuya?.isNew).toBe(true);
    expect(unreadWitch?.isNew).toBe(true);
    expect(unreadElegy?.isNew).toBe(false);
  });

  it("derives sorted entities, deduplicated regions, category counts, read progress, and resume story", () => {
    const now = new Date(2026, 10, 15);
    const readingState = createStubReadingState({
      readIds: ["byakuyakoku", "crimson_witch", "stale_removed_story"],
      lastSession: {
        storyId: "elegy",
        chapterIndex: 0,
        scrollRatio: 0.45,
        updatedAt: "2026-11-15T09:00:00.000Z",
      },
    });

    const view = deriveShelfView({
      indexData: SAMPLE_INDEX,
      filters: DEFAULT_SHELF_FILTERS,
      readingState,
      now,
    });

    expect(view.entities.map((e) => [e.id, e.count])).toEqual([
      ["rustan", 2],
      ["orobashi", 1],
      ["rosalyne", 1],
    ]);
    expect(view.regions).toEqual(["淵下宮", "海祇島", "モンド", "スメール"]);
    expect(view.categories.map((c) => [c.id, c.count, c.isActive])).toEqual([
      ["all", 3, true],
      ["book", 1, false],
      ["artifact", 1, false],
      ["weapon", 1, false],
      ["attire", 0, false],
      ["chronicle", 0, false],
    ]);
    expect(view.totalCount).toBe(3);
    expect(view.readCount).toBe(2);
    expect(view.allRead).toBe(false);
    expect(view.resume?.story.id).toBe("elegy");
    expect(view.resume?.session.scrollRatio).toBe(0.45);

    const allReadView = deriveShelfView({
      indexData: SAMPLE_INDEX,
      filters: DEFAULT_SHELF_FILTERS,
      readingState: createStubReadingState({
        readIds: ["byakuyakoku", "crimson_witch", "elegy"],
      }),
      now,
    });
    expect(allReadView.readCount).toBe(3);
    expect(allReadView.allRead).toBe(true);
    expect(allReadView.featuredId).not.toBeNull();
  });

  it("pickRandomStory prioritizes unread short stories and excludes current story", () => {
    const readingState = createStubReadingState({ readIds: ["byakuyakoku"] });
    const picked = pickRandomStory(SAMPLE_STORIES, readingState, "crimson_witch", () => 0);
    expect(picked?.id).toBe("elegy");
  });

  it("accepts ReadingStateSnapshot directly in deriveShelfView and pickRandomStory", () => {
    const snapshot = {
      readStories: { byakuyakoku: { readAt: "2026-11-15T00:00:00.000Z" } },
      bookmarks: ["crimson_witch"],
      lastSession: {
        storyId: "elegy",
        chapterIndex: 0,
        scrollRatio: 0.4,
        updatedAt: "2026-11-15T01:00:00.000Z",
      },
    };
    const view = deriveShelfView({
      indexData: SAMPLE_INDEX,
      filters: DEFAULT_SHELF_FILTERS,
      readingState: snapshot,
      now: new Date(2026, 10, 15),
    });
    expect(view.readCount).toBe(1);
    expect(view.resume?.story.id).toBe("elegy");
    expect(view.items.find((i) => i.story.id === "crimson_witch")?.isBookmarked).toBe(true);

    const picked = pickRandomStory(SAMPLE_STORIES, snapshot, "crimson_witch", () => 0);
    expect(picked?.id).toBe("elegy");
  });
});
