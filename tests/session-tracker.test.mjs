import test from "node:test";
import assert from "node:assert/strict";
import { createReadingState } from "../src/state/reading-state.js";
import { createReaderSessionTracker } from "../src/reader/session-tracker.js";

function setupDomMocks({ scrollY = 500, scrollHeight = 1000, innerHeight = 500, now = 1000 } = {}) {
  let currentNow = now;
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
  };
  globalThis.window = {
    scrollY,
    innerHeight,
    scrollTo({ top }) {
      this.scrollY = top;
    },
  };
  globalThis.document = {
    documentElement: {
      scrollHeight,
    },
  };
  globalThis.performance = {
    now: () => currentNow,
  };
  globalThis.requestAnimationFrame = (cb) => cb();

  const elements = {
    readerView: { hidden: false },
    readerNavRow: {
      offsetHeight: 40,
      classList: {
        add() {},
        remove() {},
      },
    },
    chaptersContainer: {
      querySelectorAll: () => [],
    },
    readingProgress: { style: { width: "0%" } },
    readerFooterChapter: { textContent: "" },
    readerFooterPercent: { textContent: "0%" },
  };

  return {
    elements,
    advanceTime(ms) {
      currentNow += ms;
    },
  };
}

test("session-tracker: scroll events during loading (before mount) never mark story as read", () => {
  const { elements } = setupDomMocks({ scrollY: 100, scrollHeight: 600, innerHeight: 500 });
  const readingState = createReadingState();
  readingState.load();

  const tracker = createReaderSessionTracker({
    elements,
    readingState,
    isDisplayPopoverOpen: () => false,
  });

  tracker.prepareForStory();
  tracker.handleScroll();
  tracker.refreshProgress({ recordSession: true });

  assert.equal(readingState.isRead("elegy"), false);
  assert.equal(readingState.getLastSession(), null);

  tracker.mount({ id: "elegy", chapters: [{ partLabel: "第一章" }] });
  assert.equal(globalThis.window.scrollY, 0);
  assert.equal(readingState.isRead("elegy"), false);
});

test("session-tracker: marks story as read only after user actually scrolls down past 90%", () => {
  const { elements, advanceTime } = setupDomMocks({ scrollY: 200, scrollHeight: 1500, innerHeight: 500 });
  const readingState = createReadingState();
  readingState.load();

  let autoReadCalledWith = null;
  const tracker = createReaderSessionTracker({
    elements,
    readingState,
    isDisplayPopoverOpen: () => false,
    onAutoReadMarked: (id) => {
      autoReadCalledWith = id;
    },
  });

  tracker.prepareForStory();
  tracker.mount({ id: "wolfs", chapters: [{ partLabel: "第一章" }] });
  assert.equal(globalThis.window.scrollY, 0);

  // Even after 500ms, if user has not scrolled down, refreshProgress does not mark read
  advanceTime(500);
  tracker.handleScroll();
  assert.equal(readingState.isRead("wolfs"), false);

  // User scrolls down to 92% (scrollable = 1000, scrollY = 920)
  globalThis.window.scrollY = 920;
  tracker.handleScroll();
  assert.equal(readingState.isRead("wolfs"), true);
  assert.equal(autoReadCalledWith, "wolfs");
});
