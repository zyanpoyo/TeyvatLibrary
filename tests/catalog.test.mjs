import test from "node:test";
import assert from "node:assert/strict";
import {
  arrangeShelfStories,
  filterStories,
  isNewStory,
  pickRandomStory,
  selectFeaturedStoryId,
  sortStories,
} from "../src/domain/catalog.js";

const SAMPLE_STORIES = [
  {
    id: "byakuyakoku",
    title: "白夜国館蔵",
    shelfCategory: "book",
    categoryLabel: "書籍（古文書・禁書）",
    region: ["淵下宮", "海祇島"],
    era: "日月前事",
    addedAt: "2026-11-01",
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
    charCount: 1100,
    hook: "西風騎士ルースタンの最期",
    tags: ["ルースタン"],
    entityIds: ["rustan"],
  },
];

function createStubReadingState({ readIds = [], bookmarkedIds = [] } = {}) {
  const readSet = new Set(readIds);
  const bookmarkSet = new Set(bookmarkedIds);
  return {
    isRead: (id) => readSet.has(id),
    isBookmarked: (id) => bookmarkSet.has(id),
  };
}

test("catalog: filterStories filters by category, status, entityId, region, and query", () => {
  const readingState = createStubReadingState({
    readIds: ["byakuyakoku"],
    bookmarkedIds: ["elegy"],
  });

  const unreadOnly = filterStories(
    SAMPLE_STORIES,
    { category: "all", status: "unread", entityId: "", region: "", query: "" },
    readingState
  );
  assert.deepEqual(unreadOnly.map((s) => s.id), ["crimson_witch", "elegy"]);

  const bookmarkedOnly = filterStories(
    SAMPLE_STORIES,
    { category: "all", status: "bookmarked", entityId: "", region: "", query: "" },
    readingState
  );
  assert.deepEqual(bookmarkedOnly.map((s) => s.id), ["elegy"]);

  const byEntityAndRegion = filterStories(
    SAMPLE_STORIES,
    { category: "all", status: "all", entityId: "rustan", region: "スメール", query: "" },
    readingState
  );
  assert.deepEqual(byEntityAndRegion.map((s) => s.id), ["crimson_witch"]);

  const byQuery = filterStories(
    SAMPLE_STORIES,
    { category: "all", status: "all", entityId: "", region: "", query: "白蛇" },
    readingState
  );
  assert.deepEqual(byQuery.map((s) => s.id), ["byakuyakoku"]);
});

test("catalog: sortStories sorts by newest and shortest", () => {
  const newest = sortStories(SAMPLE_STORIES, "newest");
  assert.deepEqual(newest.map((s) => s.id), ["crimson_witch", "byakuyakoku", "elegy"]);

  const shortest = sortStories(SAMPLE_STORIES, "shortest");
  assert.deepEqual(shortest.map((s) => s.id), ["elegy", "crimson_witch", "byakuyakoku"]);
});

test("catalog: isNewStory checks 14-day window and excludes read stories", () => {
  const now = new Date(2026, 10, 15); // 2026-11-15 local
  const unreadState = createStubReadingState();
  const readState = createStubReadingState({ readIds: ["crimson_witch"] });

  assert.equal(isNewStory(SAMPLE_STORIES[0], unreadState, now), true); // 14 days ago
  assert.equal(isNewStory(SAMPLE_STORIES[1], unreadState, now), true); // 5 days ago
  assert.equal(isNewStory(SAMPLE_STORIES[2], unreadState, now), false); // 31 days ago
  assert.equal(isNewStory(SAMPLE_STORIES[1], readState, now), false); // already read
});

test("catalog: selectFeaturedStoryId and arrangeShelfStories promote daily unread featured story", () => {
  const now = new Date(2026, 10, 15);
  const readingState = createStubReadingState({ readIds: ["byakuyakoku", "crimson_witch"] });

  // Only "elegy" is unread, so it must be selected
  const featuredId = selectFeaturedStoryId(SAMPLE_STORIES, readingState, now);
  assert.equal(featuredId, "elegy");

  const defaultFilters = {
    category: "all",
    status: "all",
    entityId: "",
    region: "",
    query: "",
    sort: "recommended",
  };
  const arranged = arrangeShelfStories(SAMPLE_STORIES, SAMPLE_STORIES, defaultFilters, readingState, now);
  assert.equal(arranged.featuredId, "elegy");
  assert.equal(arranged.ordered[0].id, "elegy");
});

test("catalog: pickRandomStory prioritizes unread short stories and excludes current story", () => {
  const readingState = createStubReadingState({ readIds: ["byakuyakoku"] });
  // Unread short stories are crimson_witch (1500) and elegy (1100). Excluding crimson_witch leaves elegy.
  const picked = pickRandomStory(SAMPLE_STORIES, readingState, "crimson_witch", () => 0);
  assert.equal(picked?.id, "elegy");
});
