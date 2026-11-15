import test from "node:test";
import assert from "node:assert/strict";
import {
  AUTO_READ_THRESHOLD,
  BOOKMARK_THRESHOLD_MIN,
  READING_STATE_KEY,
  createReadingState,
} from "../src/state/reading-state.js";

function installMockLocalStorage(initialMap = {}) {
  const store = new Map(Object.entries(initialMap));
  globalThis.localStorage = {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
  return store;
}

test("reading-state: markRead, unmarkRead, toggleRead and getReadCount", () => {
  installMockLocalStorage();
  const state = createReadingState();
  state.load();

  assert.equal(state.isRead("crimson_witch"), false);
  assert.equal(state.markRead("crimson_witch"), true);
  assert.equal(state.isRead("crimson_witch"), true);
  assert.equal(state.markRead("crimson_witch"), false);

  const validIds = new Set(["crimson_witch", "elegy"]);
  assert.equal(state.getReadCount(validIds), 1);

  assert.equal(state.toggleRead("crimson_witch"), false);
  assert.equal(state.isRead("crimson_witch"), false);
  assert.equal(state.toggleRead("crimson_witch"), true);
  assert.equal(state.isRead("crimson_witch"), true);
});

test("reading-state: toggleBookmark persists and deduplicates", () => {
  installMockLocalStorage();
  const state = createReadingState();
  state.load();

  assert.equal(state.isBookmarked("elegy"), false);
  assert.equal(state.toggleBookmark("elegy"), true);
  assert.equal(state.isBookmarked("elegy"), true);

  const reloaded = createReadingState();
  reloaded.load();
  assert.equal(reloaded.isBookmarked("elegy"), true);
  assert.equal(reloaded.toggleBookmark("elegy"), false);
  assert.equal(reloaded.isBookmarked("elegy"), false);
});

test("reading-state: session bookmark thresholds and auto-clear on markRead", () => {
  installMockLocalStorage();
  const state = createReadingState();
  state.load();

  // Below or equal to BOOKMARK_THRESHOLD_MIN is ignored
  assert.equal(
    state.updateLastSession({ storyId: "byakuyakoku", chapterIndex: 0, scrollRatio: BOOKMARK_THRESHOLD_MIN }),
    false
  );
  assert.equal(state.getLastSession(), null);

  // Within valid range (0.05 < ratio < 0.90) is saved
  assert.equal(
    state.updateLastSession({ storyId: "byakuyakoku", chapterIndex: 2, scrollRatio: 0.4256 }),
    true
  );
  const session = state.getLastSession(new Set(["byakuyakoku"]));
  assert.equal(session?.storyId, "byakuyakoku");
  assert.equal(session?.chapterIndex, 2);
  assert.equal(session?.scrollRatio, 0.426);

  // Reaching AUTO_READ_THRESHOLD clears existing session for the same story
  assert.equal(
    state.updateLastSession({ storyId: "byakuyakoku", chapterIndex: 4, scrollRatio: AUTO_READ_THRESHOLD }),
    true
  );
  assert.equal(state.getLastSession(), null);

  // Saving another session and marking the story read clears lastSession
  state.updateLastSession({ storyId: "pale_flame", chapterIndex: 1, scrollRatio: 0.5 });
  assert.equal(state.getLastSession()?.storyId, "pale_flame");
  state.markRead("pale_flame");
  assert.equal(state.getLastSession(), null);
});

test("reading-state: gracefully recovers from corrupted localStorage JSON", () => {
  installMockLocalStorage({
    [READING_STATE_KEY]: "{broken-json",
  });
  const state = createReadingState();
  assert.doesNotThrow(() => state.load());
  assert.equal(state.getReadCount(), 0);
  assert.equal(state.getLastSession(), null);
});
