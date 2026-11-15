import { describe, expect, it } from "vitest";
import {
  calculateScrollRatio,
  evaluateNavVisibility,
  evaluateScrollSessionAction,
  INITIAL_NAV_SCROLL_STATE,
  resolveClosestChapterIndex,
} from "../src/domain/scroll-session";

describe("scroll-session pure logic", () => {
  it("calculateScrollRatio clamps values and treats non-scrollable stories as complete (1)", () => {
    expect(calculateScrollRatio(0, 600, 800)).toBe(1);
    expect(calculateScrollRatio(-50, 1500, 500)).toBe(0);
    expect(calculateScrollRatio(500, 1500, 500)).toBe(0.5);
    expect(calculateScrollRatio(1200, 1500, 500)).toBe(1);
  });

  it("resolveClosestChapterIndex picks top, bottom, and closest section to viewport 32% line", () => {
    const rects = [
      { top: -400, bottom: 50 },
      { top: 60, bottom: 450 },
      { top: 460, bottom: 900 },
    ];
    expect(resolveClosestChapterIndex(rects, 10, 2000, 500, 1)).toBe(0);
    expect(resolveClosestChapterIndex(rects, 1495, 2000, 500, 0)).toBe(2);
    // targetLine = 500 * 0.32 = 160 -> lies within rect[1] (60..450)
    expect(resolveClosestChapterIndex(rects, 500, 2000, 500, 0)).toBe(1);
  });

  it("evaluateNavVisibility hides on downward scroll past threshold and reveals on upward scroll or open popover", () => {
    const s1 = evaluateNavVisibility(INITIAL_NAV_SCROLL_STATE, 100, 1000, 64, false);
    expect(s1.isHidden).toBe(true);

    const s2 = evaluateNavVisibility(s1.nextState, 80, 1000, 64, false);
    expect(s2.isHidden).toBe(false);

    const s3 = evaluateNavVisibility(s1.nextState, 120, 1000, 64, true);
    expect(s3.isHidden).toBe(false);
  });

  it("evaluateScrollSessionAction requires prior user downward scroll and handles autoReadSuppressed", () => {
    expect(
      evaluateScrollSessionAction({
        ratio: 0.95,
        chapterIndex: 1,
        hasUserScrolledDown: false,
        autoReadSuppressed: false,
        storyId: "wolfs",
      })
    ).toEqual({ type: "none" });

    expect(
      evaluateScrollSessionAction({
        ratio: 0.45,
        chapterIndex: 1,
        hasUserScrolledDown: true,
        autoReadSuppressed: false,
        storyId: "wolfs",
      })
    ).toEqual({
      type: "save-session",
      session: { storyId: "wolfs", chapterIndex: 1, scrollRatio: 0.45 },
    });

    expect(
      evaluateScrollSessionAction({
        ratio: 0.92,
        chapterIndex: 1,
        hasUserScrolledDown: true,
        autoReadSuppressed: false,
        storyId: "wolfs",
      })
    ).toEqual({ type: "mark-read", storyId: "wolfs" });

    expect(
      evaluateScrollSessionAction({
        ratio: 0.92,
        chapterIndex: 1,
        hasUserScrolledDown: true,
        autoReadSuppressed: true,
        storyId: "wolfs",
      })
    ).toEqual({
      type: "save-session",
      session: { storyId: "wolfs", chapterIndex: 1, scrollRatio: 0.92 },
    });
  });
});
