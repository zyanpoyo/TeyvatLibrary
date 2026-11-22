import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { analytics } from "../src/analytics/ga4";
import { clearStoriesCache } from "../src/api/stories";
import { AppShell } from "../src/components/layout/AppShell";
import { ReaderPage } from "../src/components/reader/ReaderPage";
import { ShelfPage } from "../src/components/shelf/ShelfPage";
import { buildStoryDocumentTitle, SHELF_DOCUMENT_TITLE } from "../src/domain/seo";
import { useReaderSession } from "../src/hooks/useReaderSession";
import { ANALYTICS_PREFS_KEY } from "../src/state/analytics-prefs";
import { AppProviders } from "../src/state/AppProviders";
import { createReadingState } from "../src/state/reading-state";
import type {
  DisplayPrefs,
  SearchIndexData,
  StoriesIndexData,
  StoryDetail,
} from "../src/types/story";

const MOCK_INDEX: StoriesIndexData = {
  generatedAt: "2026-11-15T00:00:00.000Z",
  totalCount: 2,
  categoryCounts: {
    book: 0,
    artifact: 1,
    weapon: 1,
    attire: 0,
    chronicle: 0,
  },
  entitiesIndex: {
    rostam: {
      name: "ルースタン",
      kind: "character",
      storyIds: ["mock_witch", "mock_elegy"],
    },
  },
  stories: [
    {
      id: "mock_witch",
      title: "燃え盛る炎の魔女",
      shelfCategory: "artifact",
      categoryLabel: "聖遺物（連作短編）",
      region: ["モンド", "スメール"],
      era: "500年前",
      addedAt: "2026-11-14",
      readingTime: "約3分",
      charCount: 1200,
      chapterCount: 1,
      hook: "炎の魔女の記憶",
      tags: ["ロザリン"],
      entityIds: ["rostam"],
    },
    {
      id: "mock_elegy",
      title: "終焉を嘆く詩",
      shelfCategory: "weapon",
      categoryLabel: "武器ストーリー",
      region: ["モンド"],
      era: "500年前",
      addedAt: "2024-01-01",
      readingTime: "約2分",
      charCount: 800,
      chapterCount: 1,
      hook: "西風騎士の最期",
      tags: ["ルースタン"],
      entityIds: ["rostam"],
    },
  ],
};

const MOCK_DETAILS: Record<string, StoryDetail> = {
  mock_witch: {
    ...MOCK_INDEX.stories[0],
    preGuide: ["舞台：500年前のモンドとスメール"],
    overallTruth: "少女の正体は淑女ロザリン（シニョーラ）である。",
    gameEffect: "炎元素ダメージ+15%",
    connected: [
      {
        targetId: "mock_elegy",
        relation: "対になる裏視点の物語",
        desc: "ルースタン視点の物語",
      },
    ],
    glossary: {
      cw_lover: {
        term: "時計をくれた人",
        identity: "正体：ルースタン",
        desc: "モンドを守った西風騎士団副団長。",
        evidence: "武器『終焉を嘆く詩』の記述より",
        evidenceLinks: [{ title: "終焉を嘆く詩", storyId: "mock_elegy" }],
      },
    },
    chapters: [
      {
        partLabel: "第一章",
        heading: "静止した水時計",
        epigraph: "針は止まった。",
        paragraphs: ["{{cw_lover|時計をくれた人}}はすでに戦場にいた。"],
      },
    ],
  },
  mock_elegy: {
    ...MOCK_INDEX.stories[1],
    preGuide: ["舞台：500年前のモンド"],
    overallTruth: "騎士の正体はルースタンである。",
    gameEffect: "元素熟知+60",
    connected: [
      {
        targetId: "mock_witch",
        relation: "対になる表視点の物語",
        desc: "ロザリン視点の物語",
      },
    ],
    glossary: {
      el_knight: {
        term: "悲しげな騎士",
        identity: "正体：ルースタン",
        desc: "副団長だった騎士。",
        evidence: "聖遺物『燃え盛る炎の魔女』",
        evidenceLinks: [{ title: "燃え盛る炎の魔女", storyId: "mock_witch" }],
      },
    },
    chapters: [
      {
        partLabel: "全一章",
        heading: "風に溶けた詩",
        epigraph: "風神の詩。",
        paragraphs: ["{{el_knight|悲しげな騎士}}は最後までモンドを守り抜いた。"],
      },
    ],
  },
};

const MOCK_SEARCH_INDEX: SearchIndexData = {
  generatedAt: "2026-11-15T00:00:00.000Z",
  stories: {
    mock_witch: {
      id: "mock_witch",
      title: "燃え盛る炎の魔女",
      hook: "炎の魔女の記憶",
      categoryLabel: "聖遺物（連作短編）",
      era: "500年前",
      region: ["モンド", "スメール"],
      tags: ["ロザリン"],
      entityNames: ["ルースタン"],
      preGuide: ["舞台：500年前のモンドとスメール"],
      chapters: [
        {
          chapterIndex: 0,
          partLabel: "第一章",
          heading: "静止した水時計",
          epigraph: "針は止まった。",
          paragraphs: ["時計をくれた人はすでに戦場にいた。"],
        },
      ],
      glossary: [],
      truth: {
        overallTruth: "少女の正体は淑女ロザリン（シニョーラ）である。",
        gameEffect: "炎元素ダメージ+15%",
      },
    },
    mock_elegy: {
      id: "mock_elegy",
      title: "終焉を嘆く詩",
      hook: "西風騎士の最期",
      categoryLabel: "武器ストーリー",
      era: "500年前",
      region: ["モンド"],
      tags: ["ルースタン"],
      entityNames: ["ルースタン"],
      preGuide: ["舞台：500年前のモンド"],
      chapters: [
        {
          chapterIndex: 0,
          partLabel: "全一章",
          heading: "風に溶けた詩",
          epigraph: "風神の詩。",
          paragraphs: ["彼は最後までモンドを守り抜いた。"],
        },
      ],
      glossary: [],
      truth: {
        overallTruth: "騎士の正体はルースタンである。",
        gameEffect: "元素熟知+60",
      },
    },
  },
};

function renderApp(initialEntries: string[] = ["/"]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <AppProviders>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<ShelfPage />} />
            <Route path="story/:storyId" element={<ReaderPage />} />
          </Route>
        </Routes>
      </AppProviders>
    </MemoryRouter>
  );
}

describe("Analytics integration with Shelf, Reader, and PrivacyDialog", () => {
  beforeEach(() => {
    clearStoriesCache();
    localStorage.clear();
    document.documentElement.dataset.theme = "night";

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("stories-index.json")) {
          return { ok: true, status: 200, json: async () => MOCK_INDEX } as Response;
        }
        if (url.endsWith("search-index.json")) {
          return { ok: true, status: 200, json: async () => MOCK_SEARCH_INDEX } as Response;
        }
        const match = /stories\/([^/]+)\.json$/.exec(url);
        if (match) {
          const detail = MOCK_DETAILS[decodeURIComponent(match[1])];
          if (detail) {
            return { ok: true, status: 200, json: async () => detail } as Response;
          }
        }
        return { ok: false, status: 404, json: async () => ({}) } as Response;
      })
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("tracks shelf and reader page_view without duplicating on query sync, plus card/featured/random/resume/connected/evidence story_open", async () => {
    const user = userEvent.setup();
    const pageViewSpy = vi.spyOn(analytics, "trackPageView");
    const storyOpenSpy = vi.spyOn(analytics, "trackStoryOpen");

    // Seed lastSession so ResumeBanner appears
    localStorage.setItem(
      "genshin-books-reading-state-v1",
      JSON.stringify({
        readStories: {},
        bookmarks: [],
        lastSession: {
          storyId: "mock_elegy",
          chapterIndex: 0,
          scrollRatio: 0.4,
          updatedAt: "2026-11-20T00:00:00.000Z",
        },
      })
    );

    renderApp(["/"]);
    await screen.findByText("燃え盛る炎の魔女");

    // Initial shelf page_view
    expect(pageViewSpy).toHaveBeenCalledTimes(1);
    expect(pageViewSpy).toHaveBeenLastCalledWith({
      pagePath: "/",
      pageTitle: SHELF_DOCUMENT_TITLE,
    });

    // Resume banner opens mock_elegy with source: "resume"
    await user.click(document.querySelector('[data-action="resume-story"]')!);
    await screen.findByRole("heading", { name: "終焉を嘆く詩" });

    expect(storyOpenSpy).toHaveBeenCalledWith({
      storyId: "mock_elegy",
      storyCategory: "weapon",
      source: "resume",
    });
    expect(pageViewSpy).toHaveBeenCalledTimes(2);
    expect(pageViewSpy).toHaveBeenLastCalledWith({
      pagePath: "/story/mock_elegy",
      pageTitle: buildStoryDocumentTitle(MOCK_DETAILS.mock_elegy),
      storyId: "mock_elegy",
      storyCategory: "weapon",
    });

    // Evidence link inside GlossaryDialog navigates to mock_witch with source: "evidence"
    await user.click(screen.getByRole("button", { name: /悲しげな騎士/ }));
    await user.click(await screen.findByRole("link", { name: "『燃え盛る炎の魔女』" }));
    await screen.findByRole("heading", { name: "燃え盛る炎の魔女" });

    expect(storyOpenSpy).toHaveBeenCalledWith({
      storyId: "mock_witch",
      storyCategory: "artifact",
      source: "evidence",
    });
    expect(pageViewSpy).toHaveBeenCalledTimes(3);
    expect(pageViewSpy).toHaveBeenLastCalledWith({
      pagePath: "/story/mock_witch",
      pageTitle: buildStoryDocumentTitle(MOCK_DETAILS.mock_witch),
      storyId: "mock_witch",
      storyCategory: "artifact",
    });

    // Connected link navigates back to mock_elegy with source: "connected"
    await user.click(document.querySelector(".connected-item[data-target-id='mock_elegy']")!);
    await screen.findByRole("heading", { name: "終焉を嘆く詩" });
    expect(storyOpenSpy).toHaveBeenCalledWith({
      storyId: "mock_elegy",
      storyCategory: "weapon",
      source: "connected",
    });
    expect(pageViewSpy).toHaveBeenCalledTimes(4);

    // Return to shelf: emits shelf page_view again
    await user.click(screen.getByRole("button", { name: /書架へ戻る/ }));
    await screen.findByText("燃え盛る炎の魔女");
    expect(pageViewSpy).toHaveBeenCalledTimes(5);
    expect(pageViewSpy).toHaveBeenLastCalledWith({
      pagePath: "/",
      pageTitle: SHELF_DOCUMENT_TITLE,
    });

    // Featured card vs normal card
    const featuredCardLink = document.querySelector(".story-card.is-featured .card-primary-link")!;
    const featuredStoryId =
      featuredCardLink.closest(".story-card")?.getAttribute("data-story-id") ?? "";
    const normalCardLink = document.querySelector(".story-card:not(.is-featured) .card-primary-link")!;
    const normalStoryId =
      normalCardLink.closest(".story-card")?.getAttribute("data-story-id") ?? "";

    await user.click(featuredCardLink);
    await screen.findByRole("heading", { level: 1 });
    expect(storyOpenSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ storyId: featuredStoryId, source: "featured" })
    );

    await user.click(screen.getByRole("button", { name: /書架へ戻る/ }));
    await screen.findByText("燃え盛る炎の魔女");

    await user.click(document.querySelector(`.story-card[data-story-id="${normalStoryId}"] .card-primary-link`)!);
    await screen.findByRole("heading", { level: 1 });
    expect(storyOpenSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ storyId: normalStoryId, source: "card" })
    );

    await user.click(screen.getByRole("button", { name: /書架へ戻る/ }));
    await screen.findByText("燃え盛る炎の魔女");

    // Random pick
    await user.click(document.getElementById("random-story-btn")!);
    await screen.findByRole("heading", { level: 1 });
    expect(storyOpenSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ source: "random" })
    );
  });

  it("debounces search tracking at 800ms, avoids page_view replay on ?q= sync, avoids duplicate search on reader roundtrip, and tracks search_snippet open", async () => {
    const user = userEvent.setup();
    const pageViewSpy = vi.spyOn(analytics, "trackPageView");
    const searchSpy = vi.spyOn(analytics, "trackSearch");
    const storyOpenSpy = vi.spyOn(analytics, "trackStoryOpen");

    renderApp(["/"]);
    await screen.findByText("燃え盛る炎の魔女");
    expect(pageViewSpy).toHaveBeenCalledTimes(1);

    const searchInput = screen.getByLabelText("タイトル・本文・人物・用語・時代で検索");
    await user.type(searchInput, "シニョーラ");

    // Toggle truth search so search matches mock_witch's truth
    await user.click(screen.getByRole("button", { name: /真相メモも含める/ }));

    await waitFor(
      () => {
        expect(searchSpy).toHaveBeenCalledTimes(1);
      },
      { timeout: 2500 }
    );
    expect(searchSpy).toHaveBeenCalledWith({
      query: "シニョーラ",
      resultCount: 1,
      includeTruth: true,
    });
    // ?q= sync did NOT emit extra page_view
    expect(pageViewSpy).toHaveBeenCalledTimes(1);

    // Click search snippet to open mock_witch (programmatic truth expansion must NOT trigger truth_memo_open or story_complete)
    const truthOpenSpy = vi.spyOn(analytics, "trackTruthMemoOpen");
    const completeSpy = vi.spyOn(analytics, "trackStoryComplete");
    const snippetBtn = await screen.findByRole("button", { name: /真相・考察メモ/ });
    await user.click(snippetBtn);
    await screen.findByRole("heading", { name: "燃え盛る炎の魔女" });

    expect(storyOpenSpy).toHaveBeenLastCalledWith({
      storyId: "mock_witch",
      storyCategory: "artifact",
      source: "search_snippet",
    });
    expect(truthOpenSpy).not.toHaveBeenCalled();
    expect(completeSpy).not.toHaveBeenCalled();

    // Return to shelf with ?q=シニョーラ&truth=1 preserved: must NOT re-fire same search event
    await user.click(screen.getByRole("button", { name: /書架へ戻る/ }));
    await screen.findByText("燃え盛る炎の魔女");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 950));
    });
    expect(searchSpy).toHaveBeenCalledTimes(1);
  });

  it("tracks shelf filters, bookmark_toggle on both surfaces, glossary_open, truth_memo_open, story_complete (no duplicate), and privacy opt-out", async () => {
    const user = userEvent.setup();
    const filterSpy = vi.spyOn(analytics, "trackShelfFilterChange");
    const bookmarkSpy = vi.spyOn(analytics, "trackBookmarkToggle");
    const glossarySpy = vi.spyOn(analytics, "trackGlossaryOpen");
    const truthOpenSpy = vi.spyOn(analytics, "trackTruthMemoOpen");
    const completeSpy = vi.spyOn(analytics, "trackStoryComplete");
    const setOptOutSpy = vi.spyOn(analytics, "setOptOut");

    renderApp(["/"]);
    await screen.findByText("燃え盛る炎の魔女");

    // Shelf filters
    await user.click(document.querySelector('#category-tabs button[data-filter="artifact"]')!);
    await user.click(document.querySelector('#category-tabs button[data-filter="artifact"]')!); // same category skipped
    await user.selectOptions(document.getElementById("status-filter")!, "unread");
    await user.selectOptions(document.getElementById("entity-filter")!, "rostam");
    await user.selectOptions(document.getElementById("region-filter")!, "モンド");
    await user.selectOptions(document.getElementById("sort-filter")!, "newest");
    await user.click(document.getElementById("truth-search-toggle")!);

    expect(filterSpy.mock.calls).toEqual([
      [{ filterType: "category", filterValue: "artifact" }],
      [{ filterType: "status", filterValue: "unread" }],
      [{ filterType: "entity", filterValue: "rostam" }],
      [{ filterType: "region", filterValue: "モンド" }],
      [{ filterType: "sort", filterValue: "newest" }],
      [{ filterType: "include_truth", filterValue: "true" }],
    ]);

    // Bookmark on shelf
    await user.click(screen.getByRole("button", { name: "『燃え盛る炎の魔女』をあとで読む" }));
    expect(bookmarkSpy).toHaveBeenLastCalledWith({
      storyId: "mock_witch",
      action: "add",
      surface: "shelf",
    });

    // Open mock_witch reader
    await user.click(document.querySelector(".story-card[data-story-id='mock_witch'] .card-primary-link")!);
    await screen.findByRole("heading", { name: "燃え盛る炎の魔女" });

    // Remove bookmark on reader
    await user.click(document.querySelector('.reader-bookmark-btn[data-action="toggle-bookmark"]')!);
    expect(bookmarkSpy).toHaveBeenLastCalledWith({
      storyId: "mock_witch",
      action: "remove",
      surface: "reader",
    });

    // Glossary open
    await user.click(screen.getByRole("button", { name: /時計をくれた人/ }));
    expect(glossarySpy).toHaveBeenCalledWith({
      storyId: "mock_witch",
      termId: "cw_lover",
    });
    await user.click(screen.getByRole("button", { name: "✕ 閉じる" }));

    // Manual truth memo open triggers both truth_memo_open and story_complete(auto_lore) once
    await user.click(screen.getByText(/読了後の真相・考察メモ/));
    expect(truthOpenSpy).toHaveBeenCalledTimes(1);
    expect(truthOpenSpy).toHaveBeenCalledWith({ storyId: "mock_witch" });
    expect(completeSpy).toHaveBeenCalledTimes(1);
    expect(completeSpy).toHaveBeenCalledWith({
      storyId: "mock_witch",
      storyCategory: "artifact",
      method: "auto_lore",
    });

    // Toggling read off and back on within the same session must NOT emit a duplicate story_complete
    const readBtn = document.querySelector(".reader-read-btn")!;
    await user.click(readBtn);
    await user.click(readBtn);
    expect(completeSpy).toHaveBeenCalledTimes(1);

    // Open PrivacyDialog from footer and opt out
    await user.click(document.getElementById("privacy-dialog-trigger")!);
    const dialog = await screen.findByRole("dialog", { name: "アクセス解析について" });
    const toggle = screen.getByRole("switch", {
      name: "アクセス解析（Google Analytics）を有効にする",
    });
    expect(toggle).toBeChecked();
    await user.click(toggle);
    expect(toggle).not.toBeChecked();
    expect(setOptOutSpy).toHaveBeenLastCalledWith(true);
    expect(JSON.parse(localStorage.getItem(ANALYTICS_PREFS_KEY) || "{}")).toEqual({
      optOut: true,
    });
    expect(dialog).toBeInTheDocument();

    // Test manual completion on unread mock_elegy
    await user.click(screen.getByRole("button", { name: /閉じる/ }));
    await user.click(document.querySelector(".connected-item[data-target-id='mock_elegy']")!);
    await screen.findByRole("heading", { name: "終焉を嘆く詩" });
    await user.click(document.querySelector(".reader-read-btn")!);
    expect(completeSpy).toHaveBeenCalledTimes(2);
    expect(completeSpy).toHaveBeenLastCalledWith({
      storyId: "mock_elegy",
      storyCategory: "weapon",
      method: "manual",
    });

    // Already-read story reopened does NOT emit story_complete when markRead triggers
    await user.click(screen.getByText(/読了後の真相・考察メモ/));
    expect(truthOpenSpy).toHaveBeenCalledWith({ storyId: "mock_elegy" });
    expect(completeSpy).toHaveBeenCalledTimes(2);
  });

  it("emits story_complete with method auto_scroll once when reaching >= 90% scroll on unread story", () => {
    vi.useFakeTimers();
    const store = createReadingState();
    store.load();
    const onStoryComplete = vi.fn();

    let scrollY = 0;
    const scrollHeight = 2500;
    const innerHeight = 500;
    Object.defineProperty(window, "scrollY", { configurable: true, get: () => scrollY });
    Object.defineProperty(window, "innerHeight", { configurable: true, get: () => innerHeight });
    Object.defineProperty(document.documentElement, "scrollHeight", {
      configurable: true,
      get: () => scrollHeight,
    });
    vi.spyOn(window, "scrollTo").mockImplementation((arg1?: ScrollToOptions | number) => {
      scrollY = typeof arg1 === "number" ? arg1 : arg1?.top ?? 0;
    });

    const prefs: DisplayPrefs = { fontSize: "medium", fontFamily: "mincho", theme: "night" };
    function ScrollHarness() {
      const session = useReaderSession({
        storyId: "mock_witch",
        story: MOCK_DETAILS.mock_witch,
        readingState: store,
        displayPrefs: prefs,
        onStoryComplete,
      });
      return (
        <div>
          <div ref={session.navRowRef} />
          <div ref={session.chaptersContainerRef}>
            <section className="chapter-section" />
          </div>
          <button type="button" data-testid="lore-btn" onClick={session.markLoreOpened}>
            lore
          </button>
        </div>
      );
    }

    render(<ScrollHarness />);
    vi.advanceTimersByTime(450);

    // Scroll to 92% (1840 / 2000)
    scrollY = 1840;
    act(() => {
      fireEvent.scroll(window);
    });
    expect(onStoryComplete).toHaveBeenCalledTimes(1);
    expect(onStoryComplete).toHaveBeenCalledWith("auto_scroll");

    // Subsequent scroll or lore open does not fire again
    scrollY = 1950;
    act(() => {
      fireEvent.scroll(window);
      fireEvent.click(screen.getByTestId("lore-btn"));
    });
    expect(onStoryComplete).toHaveBeenCalledTimes(1);
  });
});
