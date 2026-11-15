import { describe, expect, it } from "vitest";
import {
  arrangeShelfStories,
  filterStories,
  isNewStory,
  pickRandomStory,
  selectFeaturedStoryId,
  sortStories,
  type ReadingStateReader,
} from "../src/domain/catalog";
import type { ShelfFilters, StoryIndexItem } from "../src/types/story";

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

function createStubReadingState({
  readIds = [],
  bookmarkedIds = [],
}: {
  readIds?: string[];
  bookmarkedIds?: string[];
} = {}): ReadingStateReader {
  const readSet = new Set(readIds);
  const bookmarkSet = new Set(bookmarkedIds);
  return {
    isRead: (id) => readSet.has(id),
    isBookmarked: (id) => bookmarkSet.has(id),
  };
}

describe("catalog domain", () => {
  it("filterStories filters by category, status, entityId, region, and query", () => {
    const readingState = createStubReadingState({
      readIds: ["byakuyakoku"],
      bookmarkedIds: ["elegy"],
    });

    const unreadOnly = filterStories(
      SAMPLE_STORIES,
      { category: "all", status: "unread", entityId: "", region: "", query: "" },
      readingState
    );
    expect(unreadOnly.map((s) => s.id)).toEqual(["crimson_witch", "elegy"]);

    const bookmarkedOnly = filterStories(
      SAMPLE_STORIES,
      { category: "all", status: "bookmarked", entityId: "", region: "", query: "" },
      readingState
    );
    expect(bookmarkedOnly.map((s) => s.id)).toEqual(["elegy"]);

    const byEntityAndRegion = filterStories(
      SAMPLE_STORIES,
      { category: "all", status: "all", entityId: "rustan", region: "スメール", query: "" },
      readingState
    );
    expect(byEntityAndRegion.map((s) => s.id)).toEqual(["crimson_witch"]);

    const byQuery = filterStories(
      SAMPLE_STORIES,
      { category: "all", status: "all", entityId: "", region: "", query: "白蛇" },
      readingState
    );
    expect(byQuery.map((s) => s.id)).toEqual(["byakuyakoku"]);
  });

  it("sortStories sorts by newest and shortest", () => {
    const newest = sortStories(SAMPLE_STORIES, "newest");
    expect(newest.map((s) => s.id)).toEqual(["crimson_witch", "byakuyakoku", "elegy"]);

    const shortest = sortStories(SAMPLE_STORIES, "shortest");
    expect(shortest.map((s) => s.id)).toEqual(["elegy", "crimson_witch", "byakuyakoku"]);
  });

  it("isNewStory checks 14-day window and excludes read stories", () => {
    const now = new Date(2026, 10, 15);
    const unreadState = createStubReadingState();
    const readState = createStubReadingState({ readIds: ["crimson_witch"] });

    expect(isNewStory(SAMPLE_STORIES[0], unreadState, now)).toBe(true);
    expect(isNewStory(SAMPLE_STORIES[1], unreadState, now)).toBe(true);
    expect(isNewStory(SAMPLE_STORIES[2], unreadState, now)).toBe(false);
    expect(isNewStory(SAMPLE_STORIES[1], readState, now)).toBe(false);
  });

  it("selectFeaturedStoryId and arrangeShelfStories promote daily unread featured story", () => {
    const now = new Date(2026, 10, 15);
    const readingState = createStubReadingState({ readIds: ["byakuyakoku", "crimson_witch"] });

    const featuredId = selectFeaturedStoryId(SAMPLE_STORIES, readingState, now);
    expect(featuredId).toBe("elegy");

    const defaultFilters: ShelfFilters = {
      category: "all",
      status: "all",
      entityId: "",
      region: "",
      query: "",
      sort: "recommended",
    };
    const arranged = arrangeShelfStories(SAMPLE_STORIES, SAMPLE_STORIES, defaultFilters, readingState, now);
    expect(arranged.featuredId).toBe("elegy");
    expect(arranged.ordered[0].id).toBe("elegy");
  });

  it("pickRandomStory prioritizes unread short stories and excludes current story", () => {
    const readingState = createStubReadingState({ readIds: ["byakuyakoku"] });
    const picked = pickRandomStory(SAMPLE_STORIES, readingState, "crimson_witch", () => 0);
    expect(picked?.id).toBe("elegy");
  });
});
