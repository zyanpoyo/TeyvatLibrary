import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useReaderSession, type UseReaderSessionOptions } from "../src/hooks/useReaderSession";
import {
  AUTO_READ_THRESHOLD,
  BOOKMARK_THRESHOLD_MIN,
  createReadingState,
  type ReadingStateStore,
} from "../src/state/reading-state";
import type { DisplayPrefs, StoryDetail } from "../src/types/story";

const DEFAULT_PREFS: DisplayPrefs = {
  fontSize: "medium",
  fontFamily: "mincho",
  theme: "night",
};

function makeStory(id: string, chapterCount = 1): StoryDetail {
  return {
    id,
    title: `物語 ${id}`,
    shelfCategory: "artifact",
    categoryLabel: "聖遺物",
    region: ["モンド"],
    era: "500年前",
    readingTime: "約3分",
    charCount: 1200,
    chapterCount,
    hook: "テスト用概要",
    tags: [],
    preGuide: ["前提"],
    overallTruth: "真相",
    gameEffect: "効果",
    glossary: {},
    chapters: Array.from({ length: chapterCount }, (_, idx) => ({
      partLabel: `第${idx + 1}章`,
      heading: `見出し${idx + 1}`,
      epigraph: "",
      paragraphs: [`本文${idx + 1}`],
    })),
  };
}

interface ViewportController {
  scrollY: number;
  scrollHeight: number;
  innerHeight: number;
  navHeight: number;
  chapterOffsets: Array<{ top: number; height: number }>;
  scrollToCalls: number[];
}

function createViewportController(
  overrides: Partial<ViewportController> = {}
): ViewportController {
  return {
    scrollY: 0,
    scrollHeight: 2000,
    innerHeight: 500,
    navHeight: 40,
    chapterOffsets: [
      { top: 0, height: 600 },
      { top: 600, height: 700 },
      { top: 1300, height: 700 },
    ],
    scrollToCalls: [],
    ...overrides,
  };
}

function installViewportStub(ctrl: ViewportController) {
  Object.defineProperty(window, "scrollY", {
    configurable: true,
    get: () => ctrl.scrollY,
  });
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    get: () => ctrl.innerHeight,
  });
  Object.defineProperty(document.documentElement, "scrollHeight", {
    configurable: true,
    get: () => ctrl.scrollHeight,
  });
  vi.spyOn(window, "scrollTo").mockImplementation((arg1?: ScrollToOptions | number, arg2?: number) => {
    const rawTop = typeof arg1 === "number" ? arg2 ?? 0 : arg1?.top ?? 0;
    const maxY = Math.max(0, ctrl.scrollHeight - ctrl.innerHeight);
    ctrl.scrollY = Math.min(maxY, Math.max(0, rawTop));
    ctrl.scrollToCalls.push(ctrl.scrollY);
  });
}

function Harness(props: {
  options: Omit<UseReaderSessionOptions, "readingState"> & { readingState: ReadingStateStore };
  viewport: ViewportController;
  onAfterLeave?: () => void;
}) {
  const { options, viewport, onAfterLeave } = props;
  const session = useReaderSession(options);

  return (
    <div>
      <div
        ref={(el) => {
          session.navRowRef.current = el;
          if (el) {
            Object.defineProperty(el, "offsetHeight", {
              configurable: true,
              value: viewport.navHeight,
            });
          }
        }}
        data-testid="nav-row"
        data-hidden={String(session.isNavHidden)}
      />
      <div ref={session.chaptersContainerRef} data-testid="chapters">
        {(options.story?.chapters ?? []).map((ch, idx) => (
          <section
            key={ch.partLabel}
            className="chapter-section"
            ref={(el) => {
              if (el) {
                el.getBoundingClientRect = () => {
                  const box = viewport.chapterOffsets[idx] ?? { top: idx * 500, height: 500 };
                  const top = box.top - viewport.scrollY;
                  return {
                    top,
                    bottom: top + box.height,
                    left: 0,
                    right: 800,
                    width: 800,
                    height: box.height,
                    x: 0,
                    y: top,
                    toJSON: () => ({}),
                  };
                };
              }
            }}
          >
            {ch.partLabel}
          </section>
        ))}
      </div>

      <span data-testid="progress-pct">{session.progressPercent}</span>
      <span data-testid="progress-exact">{session.progressExactPercent}</span>
      <span data-testid="chapter-label">{session.currentChapterLabel}</span>
      <span data-testid="is-read">{String(session.isRead)}</span>
      <span data-testid="is-bookmarked">{String(session.isBookmarked)}</span>

      <button type="button" onClick={session.toggleBookmark}>
        bookmark
      </button>
      <button type="button" onClick={session.toggleRead}>
        toggle-read
      </button>
      <button type="button" onClick={session.markLoreOpened}>
        open-lore
      </button>
      <button type="button" onClick={session.syncAfterExternalScroll}>
        sync-external
      </button>
      <button type="button" onClick={() => session.leave(onAfterLeave)}>
        leave
      </button>
    </div>
  );
}

function scrollToY(viewport: ViewportController, y: number) {
  const maxY = Math.max(0, viewport.scrollHeight - viewport.innerHeight);
  viewport.scrollY = Math.min(maxY, Math.max(0, y));
  act(() => {
    window.dispatchEvent(new Event("scroll"));
  });
}

function advanceTimers(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe("useReaderSession deepened module", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("ignores scroll during 400ms settle window, requires >4px downward scroll, and debounces session save at 250ms", () => {
    const store = createReadingState();
    store.load();
    const viewport = createViewportController({ scrollHeight: 2500, innerHeight: 500 }); // scrollable = 2000
    installViewportStub(viewport);
    const story = makeStory("mock_witch", 1);

    render(
      <Harness
        viewport={viewport}
        options={{ storyId: "mock_witch", story, readingState: store, displayPrefs: DEFAULT_PREFS }}
      />
    );

    // 400ms 抑制期間内のスクロールは記録しない
    vi.advanceTimersByTime(200);
    scrollToY(viewport, 900);
    vi.advanceTimersByTime(300);
    expect(store.getLastSession()).toBeNull();

    // 400ms 経過後も基準位置(900)から +4px 以内は記録しない
    vi.advanceTimersByTime(250);
    scrollToY(viewport, 903);
    vi.advanceTimersByTime(300);
    expect(store.getLastSession()).toBeNull();

    // +4px を超える下スクロールで 250ms デバウンス後に保存される
    scrollToY(viewport, 1000); // ratio = 1000 / 2000 = 0.5
    expect(store.getLastSession()).toBeNull();
    vi.advanceTimersByTime(249);
    expect(store.getLastSession()).toBeNull();
    vi.advanceTimersByTime(1);
    expect(store.getLastSession()).toMatchObject({
      storyId: "mock_witch",
      scrollRatio: 0.5,
      chapterIndex: 0,
    });
  });

  it("flushes pending bookmark on pagehide, visibilitychange(hidden), leave(), and ignores post-leave scrolls", () => {
    const store = createReadingState();
    store.load();
    const viewport = createViewportController({ scrollHeight: 2500, innerHeight: 500 });
    installViewportStub(viewport);
    const story = makeStory("mock_witch", 1);
    const afterLeave = vi.fn();

    render(
      <Harness
        viewport={viewport}
        onAfterLeave={afterLeave}
        options={{ storyId: "mock_witch", story, readingState: store, displayPrefs: DEFAULT_PREFS }}
      />
    );

    vi.advanceTimersByTime(450);

    // 1. pagehide で即時フラッシュ
    scrollToY(viewport, 600); // 0.3
    expect(store.getLastSession()).toBeNull();
    act(() => {
      window.dispatchEvent(new Event("pagehide"));
    });
    expect(store.getLastSession()?.scrollRatio).toBe(0.3);

    // 2. visibilitychange (hidden) で即時フラッシュ
    scrollToY(viewport, 800); // 0.4
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(store.getLastSession()?.scrollRatio).toBe(0.4);

    // 3. leave() でフラッシュ後にコールバックを実行し、以後のスクロールを無視する
    scrollToY(viewport, 1000); // 0.5
    fireEvent.click(screen.getByText("leave"));
    expect(afterLeave).toHaveBeenCalledTimes(1);
    expect(store.getLastSession()?.scrollRatio).toBe(0.5);

    scrollToY(viewport, 1900); // 0.95 だが離脱後は読了にも上書きにもならない
    advanceTimers(500);
    expect(store.isRead("mock_witch")).toBe(false);
    expect(store.getLastSession()?.scrollRatio).toBe(0.5);
  });

  it("flushes pending bookmark synchronously on unmount and enforces rounded threshold boundaries", () => {
    const store = createReadingState();
    store.load();
    const viewport = createViewportController({ scrollHeight: 10500, innerHeight: 500 }); // scrollable = 10000
    installViewportStub(viewport);
    const story = makeStory("rounded_story", 1);

    const { unmount } = render(
      <Harness
        viewport={viewport}
        options={{
          storyId: "rounded_story",
          story,
          readingState: store,
          displayPrefs: DEFAULT_PREFS,
        }}
      />
    );

    advanceTimers(450);

    // 0.0504 -> 0.05 に丸められるため保存されない
    scrollToY(viewport, 504);
    advanceTimers(300);
    expect(store.getLastSession()).toBeNull();

    // 0.45 は保留され、250ms 経過前の unmount でも即時フラッシュされる
    scrollToY(viewport, 4500);
    expect(store.getLastSession()).toBeNull();
    unmount();
    expect(store.getLastSession()?.scrollRatio).toBe(0.45);
  });

  it("marks read at >= 0.9, suppresses auto-read after manual unread, and clears >= 0.9 session instead of saving", () => {
    const store = createReadingState();
    store.load();
    const viewport = createViewportController({ scrollHeight: 2500, innerHeight: 500 });
    installViewportStub(viewport);
    const story = makeStory("mock_witch", 1);

    render(
      <Harness
        viewport={viewport}
        options={{ storyId: "mock_witch", story, readingState: store, displayPrefs: DEFAULT_PREFS }}
      />
    );

    vi.advanceTimersByTime(450);

    // 一度途中しおりを保存させる
    scrollToY(viewport, 800); // 0.4
    vi.advanceTimersByTime(250);
    expect(store.getLastSession()?.scrollRatio).toBe(0.4);

    // 0.9 以上到達で自動読了＆途中しおり消去
    scrollToY(viewport, 1840); // 0.92
    expect(screen.getByTestId("is-read")).toHaveTextContent("true");
    expect(store.getLastSession()).toBeNull();

    // 手動で未読へ戻し、50% に戻ってから再度 92% へ到達しても読了化されず途中しおりも残らない
    fireEvent.click(screen.getByText("toggle-read"));
    expect(screen.getByTestId("is-read")).toHaveTextContent("false");

    scrollToY(viewport, 1000); // 0.5
    vi.advanceTimersByTime(250);
    expect(store.getLastSession()?.scrollRatio).toBe(0.5);

    // 92% へ到達 -> Q1 統一仕様により markRead されず、かつ既存の 0.5 しおりはクリアされる
    scrollToY(viewport, 1840); // 0.92
    vi.advanceTimersByTime(300);
    expect(screen.getByTestId("is-read")).toHaveTextContent("false");
    expect(store.getLastSession()).toBeNull();

    // 手動未読抑止中は真相メモ展開でも自動読了にしない
    fireEvent.click(screen.getByText("open-lore"));
    expect(screen.getByTestId("is-read")).toHaveTextContent("false");

    // 再度手動で読了→未読以外の通常セッション（別作品）なら真相メモで読了になる
    fireEvent.click(screen.getByText("toggle-read")); // read -> true (抑止解除)
    expect(screen.getByTestId("is-read")).toHaveTextContent("true");
  });

  it("handles markLoreOpened and non-scrollable short stories correctly", () => {
    const store = createReadingState();
    store.load();
    const viewport = createViewportController({ scrollHeight: 500, innerHeight: 500 });
    installViewportStub(viewport);
    const story = makeStory("short_weapon", 1);

    render(
      <Harness
        viewport={viewport}
        options={{ storyId: "short_weapon", story, readingState: store, displayPrefs: DEFAULT_PREFS }}
      />
    );

    expect(screen.getByTestId("progress-pct")).toHaveTextContent("100");
    vi.advanceTimersByTime(500);
    expect(store.isRead("short_weapon")).toBe(false);

    fireEvent.click(screen.getByText("open-lore"));
    expect(screen.getByTestId("is-read")).toHaveTextContent("true");
    expect(store.isRead("short_weapon")).toBe(true);
  });

  it("tracks active chapter across multi-chapter scroll and IntersectionObserver events", () => {
    const observeSpy = vi.fn();
    const disconnectSpy = vi.fn();
    let ioCallback: (() => void) | null = null;
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(cb: () => void) {
          ioCallback = cb;
        }
        observe = observeSpy;
        disconnect = disconnectSpy;
        unobserve() {}
      }
    );

    const store = createReadingState();
    store.load();
    const viewport = createViewportController({
      scrollHeight: 2000,
      innerHeight: 500,
      chapterOffsets: [
        { top: 0, height: 600 },
        { top: 600, height: 700 },
        { top: 1300, height: 700 },
      ],
    });
    installViewportStub(viewport);
    const story = makeStory("multi_book", 3);

    const { unmount } = render(
      <Harness
        viewport={viewport}
        options={{ storyId: "multi_book", story, readingState: store, displayPrefs: DEFAULT_PREFS }}
      />
    );

    expect(observeSpy).toHaveBeenCalledTimes(3);
    expect(screen.getByTestId("chapter-label")).toHaveTextContent("第1章");

    // 第2章へスクロールして IntersectionObserver 経由のみで更新されること
    viewport.scrollY = 600;
    act(() => {
      ioCallback?.();
    });
    expect(screen.getByTestId("chapter-label")).toHaveTextContent("第2章");

    // 末尾 <= 16px スナップで第3章になること
    scrollToY(viewport, 1490); // maxY = 1500
    expect(screen.getByTestId("chapter-label")).toHaveTextContent("第3章");

    unmount();
    expect(disconnectSpy).toHaveBeenCalledTimes(1);
  });

  it("toggles nav auto-hide on downward/upward scroll and keeps nav visible while popover is open", () => {
    const store = createReadingState();
    store.load();
    const viewport = createViewportController({ scrollHeight: 2000, innerHeight: 500, navHeight: 40 });
    installViewportStub(viewport);
    const story = makeStory("mock_witch", 1);

    const { rerender } = render(
      <Harness
        viewport={viewport}
        options={{
          storyId: "mock_witch",
          story,
          readingState: store,
          displayPrefs: DEFAULT_PREFS,
          keepNavVisible: false,
        }}
      />
    );

    const nav = screen.getByTestId("nav-row");
    expect(nav).toHaveAttribute("data-hidden", "false");

    // hideThreshold = 40 + 24 = 64 を超えて下8px以上スクロールで格納
    scrollToY(viewport, 120);
    expect(nav).toHaveAttribute("data-hidden", "true");

    // ポップオーバー開で即再表示され、セッション状態はリセットされない
    rerender(
      <Harness
        viewport={viewport}
        options={{
          storyId: "mock_witch",
          story,
          readingState: store,
          displayPrefs: DEFAULT_PREFS,
          keepNavVisible: true,
        }}
      />
    );
    expect(nav).toHaveAttribute("data-hidden", "false");

    // 閉じても上スクロール12px以上で再表示維持
    rerender(
      <Harness
        viewport={viewport}
        options={{
          storyId: "mock_witch",
          story,
          readingState: store,
          displayPrefs: DEFAULT_PREFS,
          keepNavVisible: false,
        }}
      />
    );
    scrollToY(viewport, 150);
    expect(nav).toHaveAttribute("data-hidden", "true");
    scrollToY(viewport, 130); // -20px <= -12px
    expect(nav).toHaveAttribute("data-hidden", "false");
  });

  it("restores scroll position from explicitRestoreRatio or initial stored session without falling back on subsequent navigation", () => {
    const store = createReadingState();
    store.load();
    store.updateLastSession({ storyId: "cold_story", chapterIndex: 0, scrollRatio: 0.45 });

    const viewport = createViewportController({ scrollHeight: 2500, innerHeight: 500 }); // scrollable=2000
    installViewportStub(viewport);
    const coldStory = makeStory("cold_story", 1);

    // 1. コールドスタート: allowStoredSessionRestore = true で lastSession(0.45 -> 900px) を復元（即時 + rAF）
    const { rerender } = render(
      <Harness
        viewport={viewport}
        options={{
          storyId: "cold_story",
          story: coldStory,
          readingState: store,
          displayPrefs: DEFAULT_PREFS,
          allowStoredSessionRestore: true,
          navigationKey: "k1",
        }}
      />
    );

    expect(viewport.scrollY).toBe(900);
    advanceTimers(16);
    expect(viewport.scrollY).toBe(900);

    // 復元後の rAF 延長により 400ms 以内のスクロールは記録されない
    advanceTimers(200);
    scrollToY(viewport, 950);
    advanceTimers(300);
    expect(store.getLastSession()?.scrollRatio).toBe(0.45);

    // 2. 作品内リンク遷移（別作品へ）では初回マウントではないため lastSession 復元を行わない
    store.updateLastSession({ storyId: "next_story", chapterIndex: 0, scrollRatio: 0.6 });
    const nextStory = makeStory("next_story", 1);
    rerender(
      <Harness
        viewport={viewport}
        options={{
          storyId: "next_story",
          story: nextStory,
          readingState: store,
          displayPrefs: DEFAULT_PREFS,
          allowStoredSessionRestore: true,
          navigationKey: "k2",
        }}
      />
    );
    expect(viewport.scrollY).toBe(0);

    // 3. explicitRestoreRatio が閾値境界外 (<= 0.05) のときは復元しない
    rerender(
      <Harness
        viewport={viewport}
        options={{
          storyId: "next_story",
          story: nextStory,
          readingState: store,
          displayPrefs: DEFAULT_PREFS,
          explicitRestoreRatio: BOOKMARK_THRESHOLD_MIN,
          navigationKey: "k3",
        }}
      />
    );
    expect(viewport.scrollY).toBe(0);

    // 4. 表示設定変更時はセッション記録せずに進捗再計算のみ実行
    viewport.scrollHeight = 1500; // scrollable = 1000
    viewport.scrollY = 500;
    rerender(
      <Harness
        viewport={viewport}
        options={{
          storyId: "next_story",
          story: nextStory,
          readingState: store,
          displayPrefs: { ...DEFAULT_PREFS, fontSize: "large" },
          explicitRestoreRatio: AUTO_READ_THRESHOLD,
          navigationKey: "k3",
        }}
      />
    );
    expect(screen.getByTestId("progress-pct")).toHaveTextContent("50");

    // 5. allowStoredSessionRestore = false のときは初回マウントでも lastSession へフォールバックしない
    const freshStore = createReadingState();
    freshStore.load();
    freshStore.updateLastSession({ storyId: "shelf_entry", chapterIndex: 0, scrollRatio: 0.55 });
    const freshViewport = createViewportController({ scrollHeight: 2500, innerHeight: 500 });
    installViewportStub(freshViewport);
    render(
      <Harness
        viewport={freshViewport}
        options={{
          storyId: "shelf_entry",
          story: makeStory("shelf_entry", 1),
          readingState: freshStore,
          displayPrefs: DEFAULT_PREFS,
          allowStoredSessionRestore: false,
          navigationKey: "k_shelf",
        }}
      />
    );
    expect(freshViewport.scrollY).toBe(0);
  });

  it("skips lastSession restore and prevents auto-read on external search jump", () => {
    const searchStore = createReadingState();
    searchStore.load();
    searchStore.updateLastSession({ storyId: "search_target", chapterIndex: 0, scrollRatio: 0.4 });
    const searchViewport = createViewportController({
      scrollY: 1950,
      scrollHeight: 2500,
      innerHeight: 500,
    });
    installViewportStub(searchViewport);
    render(
      <Harness
        viewport={searchViewport}
        options={{
          storyId: "search_target",
          story: makeStory("search_target", 3),
          readingState: searchStore,
          displayPrefs: DEFAULT_PREFS,
          hasSearchTarget: true,
          navigationKey: "k_search",
        }}
      />
    );
    // hasSearchTarget=true なので lastSession(0.4 -> 800px) や top=0 で上書きされない
    expect(searchViewport.scrollY).toBe(1950);

    act(() => {
      screen.getByRole("button", { name: "sync-external" }).click();
    });
    expect(searchStore.isRead("search_target")).toBe(false);
    expect(searchStore.getSnapshot().lastSession?.scrollRatio).toBe(0.4);
  });
});
