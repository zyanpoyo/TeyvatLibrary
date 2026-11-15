import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AUTO_READ_THRESHOLD,
  BOOKMARK_THRESHOLD_MIN,
  createReadingState,
  READING_STATE_KEY,
} from "../src/state/reading-state";

function installMockLocalStorage(initialMap: Record<string, string> = {}) {
  const store = new Map(Object.entries(initialMap));
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
      setItem: (key: string, value: string) => {
        store.set(key, String(value));
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => {
        store.clear();
      },
    },
  });
  return store;
}

describe("reading-state store", () => {
  beforeEach(() => {
    installMockLocalStorage();
  });

  it("handles markRead, unmarkRead, toggleRead, and getReadCount", () => {
    const state = createReadingState();
    state.load();

    expect(state.isRead("crimson_witch")).toBe(false);
    expect(state.markRead("crimson_witch")).toBe(true);
    expect(state.isRead("crimson_witch")).toBe(true);
    expect(state.markRead("crimson_witch")).toBe(false);

    const validIds = new Set(["crimson_witch", "elegy"]);
    expect(state.getReadCount(validIds)).toBe(1);

    expect(state.toggleRead("crimson_witch")).toBe(false);
    expect(state.isRead("crimson_witch")).toBe(false);
    expect(state.toggleRead("crimson_witch")).toBe(true);
    expect(state.isRead("crimson_witch")).toBe(true);
  });

  it("persists bookmarks and deduplicates", () => {
    const state = createReadingState();
    state.load();

    expect(state.isBookmarked("elegy")).toBe(false);
    expect(state.toggleBookmark("elegy")).toBe(true);
    expect(state.isBookmarked("elegy")).toBe(true);

    const reloaded = createReadingState();
    reloaded.load();
    expect(reloaded.isBookmarked("elegy")).toBe(true);
    expect(reloaded.toggleBookmark("elegy")).toBe(false);
    expect(reloaded.isBookmarked("elegy")).toBe(false);
  });

  it("enforces session bookmark thresholds and clears session on markRead", () => {
    const state = createReadingState();
    state.load();

    expect(
      state.updateLastSession({
        storyId: "byakuyakoku",
        chapterIndex: 0,
        scrollRatio: BOOKMARK_THRESHOLD_MIN,
      })
    ).toBe(false);
    expect(state.getLastSession()).toBeNull();

    expect(
      state.updateLastSession({
        storyId: "byakuyakoku",
        chapterIndex: 2,
        scrollRatio: 0.4256,
      })
    ).toBe(true);
    const session = state.getLastSession(new Set(["byakuyakoku"]));
    expect(session?.storyId).toBe("byakuyakoku");
    expect(session?.chapterIndex).toBe(2);
    expect(session?.scrollRatio).toBe(0.426);

    expect(
      state.updateLastSession({
        storyId: "byakuyakoku",
        chapterIndex: 4,
        scrollRatio: AUTO_READ_THRESHOLD,
      })
    ).toBe(true);
    expect(state.getLastSession()).toBeNull();

    state.updateLastSession({ storyId: "pale_flame", chapterIndex: 1, scrollRatio: 0.5 });
    expect(state.getLastSession()?.storyId).toBe("pale_flame");
    state.markRead("pale_flame");
    expect(state.getLastSession()).toBeNull();
  });

  it("gracefully recovers from corrupted localStorage JSON", () => {
    installMockLocalStorage({
      [READING_STATE_KEY]: "{broken-json",
    });
    const state = createReadingState();
    expect(() => state.load()).not.toThrow();
    expect(state.getReadCount()).toBe(0);
    expect(state.getLastSession()).toBeNull();
  });

  it("notifies subscribers on state mutations and cross-tab storage events", () => {
    const state = createReadingState();
    state.load();

    const listener = vi.fn();
    const unsubscribe = state.subscribe(listener);

    const initialSnap = state.getSnapshot();
    state.markRead("mock_witch");
    expect(listener).toHaveBeenCalledTimes(1);
    expect(state.getSnapshot()).not.toBe(initialSnap);

    // Simulate cross-tab storage update
    localStorage.setItem(
      READING_STATE_KEY,
      JSON.stringify({
        readStories: { mock_elegy: { readAt: "2026-11-15T10:00:00.000Z" } },
        bookmarks: ["mock_witch"],
        lastSession: null,
      })
    );
    window.dispatchEvent(new StorageEvent("storage", { key: READING_STATE_KEY }));

    expect(listener).toHaveBeenCalledTimes(2);
    expect(state.isRead("mock_elegy")).toBe(true);
    expect(state.isBookmarked("mock_witch")).toBe(true);

    unsubscribe();
  });
});
