import test from "node:test";
import assert from "node:assert/strict";
import { getShelfUrl, getStoryHash, parseRouteFromHash } from "../src/router.js";

test("router: getStoryHash and getShelfUrl format URLs properly", () => {
  assert.equal(getStoryHash("crimson_witch"), "#story/crimson_witch");
  assert.equal(getStoryHash("spécial id"), "#story/sp%C3%A9cial%20id");
  assert.equal(getShelfUrl("https://example.com/app/#story/crimson_witch"), "https://example.com/app/");
});

test("router: parseRouteFromHash resolves story, chapter-anchor, and shelf fallback", () => {
  const validIds = new Set(["crimson_witch", "byakuyakoku"]);

  assert.deepEqual(parseRouteFromHash("#story/crimson_witch", validIds), {
    view: "story",
    storyId: "crimson_witch",
  });

  assert.deepEqual(parseRouteFromHash("#story/unknown_story", validIds), {
    view: "shelf",
    storyId: null,
  });

  assert.deepEqual(parseRouteFromHash("#chapter-3", validIds), {
    view: "chapter-anchor",
    storyId: null,
  });

  assert.deepEqual(parseRouteFromHash("", validIds), {
    view: "shelf",
    storyId: null,
  });
});
