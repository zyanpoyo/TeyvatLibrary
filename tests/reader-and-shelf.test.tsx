import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearStoriesCache } from "../src/api/stories";
import { AppShell } from "../src/components/layout/AppShell";
import { ReaderPage } from "../src/components/reader/ReaderPage";
import { ShelfPage } from "../src/components/shelf/ShelfPage";
import { AppProviders } from "../src/state/AppProviders";
import type { SearchIndexData, StoriesIndexData, StoryDetail } from "../src/types/story";

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
    connected: [],
    glossary: {},
    chapters: [
      {
        partLabel: "全一章",
        heading: "風に溶けた詩",
        epigraph: "風神の詩。",
        paragraphs: ["彼は最後までモンドを守り抜いた。"],
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
          paragraphs: [
            "時計をくれた人はすでに戦場にいた。",
            "熱い溶液が流れる水時計の記憶。",
            "液体の炎と約束の時間。",
            "燃える魔女がまだ少女だった頃の水時計。",
          ],
          chapterNote: "水時計は恋人の形見。",
        },
      ],
      glossary: [
        {
          termId: "cw_lover",
          term: "時計をくれた人",
          identity: "正体：ルースタン",
          desc: "モンドを守った西風騎士団副団長。",
          firstChapterIndex: 0,
          firstParagraphIndex: 0,
        },
      ],
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

describe("Shelf & Reader integration (MemoryRouter + Radix UI)", () => {
  beforeEach(() => {
    clearStoriesCache();
    localStorage.clear();
    document.documentElement.dataset.theme = "night";
    document.documentElement.style.cssText = "";

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("stories-index.json")) {
          return {
            ok: true,
            status: 200,
            json: async () => MOCK_INDEX,
          } as Response;
        }
        if (url.endsWith("search-index.json")) {
          return {
            ok: true,
            status: 200,
            json: async () => MOCK_SEARCH_INDEX,
          } as Response;
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

  it("filters shelf stories, toggles bookmarks, and resets empty filters", async () => {
    const user = userEvent.setup();
    renderApp(["/"]);

    await screen.findByText("燃え盛る炎の魔女");
    expect(screen.getByText("終焉を嘆く詩")).toBeInTheDocument();
    expect(screen.getByLabelText("登場人物・用語で絞り込む")).toHaveDisplayValue(
      "登場人物・用語：すべて"
    );

    // Bookmark mock_elegy
    const bookmarkBtn = screen.getByRole("button", { name: "『終焉を嘆く詩』をあとで読む" });
    await user.click(bookmarkBtn);
    expect(bookmarkBtn).toHaveAttribute("aria-pressed", "true");

    // Search filter to empty and reset
    const searchInput = screen.getByLabelText("タイトル・本文・人物・用語・時代で検索");
    await user.type(searchInput, "存在しないキーワード");
    expect(screen.getByText(/条件に一致する物語が見つかりません/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "条件をリセットしてすべて表示" }));
    expect(screen.getByText("終焉を嘆く詩")).toBeInTheDocument();
  });

  it("opens Radix Dialog for glossary term, navigates via evidence link, and toggles annotations", async () => {
    const user = userEvent.setup();
    renderApp(["/story/mock_witch"]);

    await screen.findByRole("heading", { name: "燃え盛る炎の魔女" });

    // Open glossary Radix Dialog
    const termButton = screen.getByRole("button", { name: /時計をくれた人/ });
    await user.click(termButton);

    const dialog = await screen.findByRole("dialog", { name: "「時計をくれた人」" });
    expect(dialog).toHaveTextContent("モンドを守った西風騎士団副団長。");

    // Toggle annotations OFF & ON
    await user.click(screen.getByRole("button", { name: "✕ 閉じる" }));
    expect(screen.queryByRole("dialog", { name: "「時計をくれた人」" })).not.toBeInTheDocument();

    const toggleBtn = screen.getByRole("button", { name: /用語ガイド ON/ });
    await user.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute("aria-pressed", "false");
    expect(document.getElementById("reader-view")).toHaveAttribute("data-annotations", "off");

    // Re-open dialog and navigate via evidence link to mock_elegy
    await user.click(toggleBtn);
    await user.click(screen.getByRole("button", { name: /時計をくれた人/ }));
    const evidenceLink = await screen.findByRole("link", { name: "『終焉を嘆く詩』" });
    await user.click(evidenceLink);

    await screen.findByRole("heading", { name: "終焉を嘆く詩" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens Radix Popover for display settings and updates root theme and CSS vars", async () => {
    const user = userEvent.setup();
    renderApp(["/story/mock_witch"]);

    await screen.findByRole("heading", { name: "燃え盛る炎の魔女" });

    await user.click(screen.getByRole("button", { name: /Aa 表示設定/ }));
    const popover = await screen.findByRole("dialog", { name: "Aa 表示設定" });
    expect(popover).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "大" }));
    await user.click(screen.getByRole("button", { name: "ゴシック" }));
    await user.click(screen.getByRole("button", { name: "セピア" }));

    expect(document.documentElement.dataset.theme).toBe("sepia");
    expect(document.documentElement.style.getPropertyValue("--reader-font-size")).toBe("1.2rem");
    expect(document.documentElement.style.getPropertyValue("--reader-prose-font")).toContain(
      "Noto Sans JP"
    );
  });

  it("marks story as read when opening lore-details", async () => {
    const user = userEvent.setup();
    renderApp(["/story/mock_elegy"]);

    await screen.findByRole("heading", { name: "終焉を嘆く詩" });
    const summary = screen.getByText(/読了後の真相・考察メモ/);
    await user.click(summary);

    await waitFor(() => {
      expect(screen.getByText("✦ 読了済み")).toBeInTheDocument();
    });
  });

  it("performs cross-story full-text search with snippet expansion, truth opt-in toggle, and reader highlighting", async () => {
    const user = userEvent.setup();
    renderApp(["/"]);

    await screen.findByText("燃え盛る炎の魔女");
    const searchInput = screen.getByLabelText("タイトル・本文・人物・用語・時代で検索");

    // 1. かな正規化＋クロスフィールドAND検索（tags: ロザリン × 本文: 水時計）
    await user.type(searchInput, "ろざりん 水時計");
    await waitFor(() => {
      expect(document.querySelectorAll(".search-snippet-btn").length).toBe(3);
    });
    expect(screen.queryByText("終焉を嘆く詩")).not.toBeInTheDocument();

    // 2. 4件以上の一致で「他 N 件の一致を表示」トグルが機能する
    const expandBtn = screen.getByRole("button", { name: /他 \d+ 件の一致を表示/ });
    await user.click(expandBtn);
    expect(document.querySelectorAll(".search-snippet-btn").length).toBeGreaterThan(3);

    // 3. 未読の真相メモ内の語はデフォルトOFFではヒットせず、トグルONでヒット＆遷移時に自動読了を抑止して展開される
    await user.clear(searchInput);
    await user.type(searchInput, "シニョーラ");
    await waitFor(() => {
      expect(screen.getByText(/条件に一致する物語が見つかりません/)).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /真相メモも含める/ }));
    const truthSnippetBtn = await screen.findByRole("button", { name: /真相・考察メモ/ });
    await user.click(truthSnippetBtn);

    await screen.findByRole("heading", { name: "燃え盛る炎の魔女" });
    const detailsEl = document.querySelector("details.lore-details") as HTMLDetailsElement | null;
    expect(detailsEl?.open).toBe(true);
    // 検索ジャンプによるプログラム展開では読了済みにしない
    expect(screen.queryByText("✦ 読了済み")).not.toBeInTheDocument();
    expect(document.querySelectorAll("#reader-view mark").length).toBeGreaterThan(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("hydrates SSG shelf HTML without React error #418 even when client date differs from build date, then updates to client date", async () => {
    vi.useFakeTimers();
    // ビルド時は 2026-11-15（mock_witch の addedAt: 2026-11-14 が NEW 対象、featured は mock_witch）
    vi.setSystemTime(new Date("2026-11-15T08:00:00.000Z"));

    const buildShelfTree = (initialEntries: string[]) => (
      <MemoryRouter initialEntries={initialEntries}>
        <AppProviders deferStorageHydration>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<ShelfPage initialIndexData={MOCK_INDEX} />} />
            </Route>
          </Routes>
        </AppProviders>
      </MemoryRouter>
    );

    const ssrHtml = renderToString(buildShelfTree(["/"]));
    expect(ssrHtml).toContain("new-badge");

    // クライアント閲覧時は 20 日後の 2026-12-05（mock_witch の NEW が期限切れになり、featured も変わる日付）
    vi.setSystemTime(new Date("2026-12-05T12:00:00.000Z"));

    const container = document.createElement("div");
    container.innerHTML = ssrHtml;
    document.body.appendChild(container);

    const recoverableErrors: unknown[] = [];
    let root: ReturnType<typeof hydrateRoot> | null = null;
    try {
      await act(async () => {
        root = hydrateRoot(container, buildShelfTree(["/"]), {
          onRecoverableError: (err) => {
            recoverableErrors.push(err);
          },
        });
      });

      expect(recoverableErrors).toEqual([]);
      // ハイドレーション完了後はクライアント現在日（2026-12-05）に基づき NEW バッジが消えていること
      expect(container.querySelector(".new-badge")).toBeNull();
    } finally {
      await act(async () => {
        root?.unmount();
      });
      container.remove();
    }
  });

  it("hydrates SSG shelf and reader HTML without React error #418 when accessed directly with query parameters (?q=, ?course=)", async () => {
    const storyWithCourse: StoryDetail = {
      ...MOCK_DETAILS.mock_witch,
      courses: [
        {
          courseId: "rosalyne_chronicle",
          kind: "character",
          badge: "キャラ別",
          title: "ロザリンの軌跡",
          stepIndex: 0,
          totalSteps: 2,
          prevStep: null,
          nextStep: { storyId: "mock_elegy", title: "終焉を嘆く詩" },
          steps: [
            { storyId: "mock_witch", title: "燃え盛る炎の魔女" },
            { storyId: "mock_elegy", title: "終焉を嘆く詩" },
          ],
        },
      ],
    };

    const buildTree = (initialEntries: string[]) => (
      <MemoryRouter initialEntries={initialEntries}>
        <AppProviders deferStorageHydration>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<ShelfPage initialIndexData={MOCK_INDEX} />} />
              <Route
                path="story/:storyId"
                element={<ReaderPage initialStory={storyWithCourse} />}
              />
            </Route>
          </Routes>
        </AppProviders>
      </MemoryRouter>
    );

    // 1. 書架 /?q=ロザリン&truth=1 への直アクセス
    const shelfSsrHtml = renderToString(buildTree(["/"]));
    const shelfContainer = document.createElement("div");
    shelfContainer.innerHTML = shelfSsrHtml;
    document.body.appendChild(shelfContainer);

    const shelfErrors: unknown[] = [];
    let shelfRoot: ReturnType<typeof hydrateRoot> | null = null;
    try {
      await act(async () => {
        shelfRoot = hydrateRoot(shelfContainer, buildTree(["/?q=%E3%83%AD%E3%82%B6%E3%83%AA%E3%83%B3&truth=1"]), {
          onRecoverableError: (err) => shelfErrors.push(err),
        });
      });
      expect(shelfErrors).toEqual([]);
      const searchInput = shelfContainer.querySelector("#search-filter") as HTMLInputElement | null;
      expect(searchInput?.value).toBe("ロザリン");
    } finally {
      await act(async () => {
        shelfRoot?.unmount();
      });
      shelfContainer.remove();
    }

    // 2. リーダー /story/mock_witch?course=rosalyne_chronicle&q=水時計&f=body&c=0 への直アクセス
    const readerSsrHtml = renderToString(buildTree(["/story/mock_witch"]));
    const readerContainer = document.createElement("div");
    readerContainer.innerHTML = readerSsrHtml;
    document.body.appendChild(readerContainer);

    const readerErrors: unknown[] = [];
    let readerRoot: ReturnType<typeof hydrateRoot> | null = null;
    try {
      await act(async () => {
        readerRoot = hydrateRoot(
          readerContainer,
          buildTree(["/story/mock_witch?course=rosalyne_chronicle&q=%E6%B0%B4%E6%99%82%E8%A8%88&f=body&c=0"]),
          {
            onRecoverableError: (err) => readerErrors.push(err),
          }
        );
      });
      expect(readerErrors).toEqual([]);
      expect(readerContainer.querySelector("#reader-course-banner")).not.toBeNull();
      expect(readerContainer.querySelectorAll("#reader-view mark").length).toBeGreaterThan(0);
    } finally {
      await act(async () => {
        readerRoot?.unmount();
      });
      readerContainer.remove();
    }
  });

  it("renders unreleasedVolumes below chapters and above lore-details, and highlights on unreleased search jump", async () => {
    const storyWithUnreleased: StoryDetail = {
      ...MOCK_DETAILS.mock_elegy,
      title: "白姫と六人の小人（第一巻）",
      shelfCategory: "book",
      categoryLabel: "書籍（古童話・暗喩譚）",
      unreleasedVolumes: [
        {
          partLabel: "第二巻",
          description: "白の姫と光の王子の出会いを語る一冊。",
        },
        {
          partLabel: "第七巻",
          description: "全ての終りと夜ノ母の予言を語る一冊。",
        },
      ],
    };

    render(
      <MemoryRouter initialEntries={["/story/mock_elegy?q=%E5%85%89%E3%81%AE%E7%8E%8B%E5%AD%90&kind=unreleased&vol=0"]}>
        <AppProviders>
          <Routes>
            <Route element={<AppShell />}>
              <Route
                path="story/:storyId"
                element={<ReaderPage initialStory={storyWithUnreleased} />}
              />
            </Route>
          </Routes>
        </AppProviders>
      </MemoryRouter>
    );

    const section = await screen.findByRole("region", { name: /続巻の書籍概要/ });
    expect(section).toBeInTheDocument();
    expect(screen.getByText("第二巻")).toBeInTheDocument();
    expect(screen.getByText("第七巻")).toBeInTheDocument();

    // 第1章の後ろ、真相メモ（.lore-details）の前に配置されている
    const chapterEl = document.getElementById("chapter-1")!;
    const loreEl = document.querySelector(".lore-details")!;
    expect(Boolean(chapterEl.compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    expect(Boolean(section.compareDocumentPosition(loreEl) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);

    // 検索ジャンプ対象要素がフォーカス強調され、検索語がハイライトされる
    const volItem0 = document.getElementById("unreleased-volume-0");
    expect(volItem0).toHaveAttribute("data-search-focus", "true");
    expect(volItem0?.querySelector("mark")?.textContent).toBe("光の王子");
  });

  it("renders #entity-filter options grouped by 5 EntityKind <optgroup> headers and filters stories on selection", async () => {
    const multiKindIndex: StoriesIndexData = {
      ...MOCK_INDEX,
      stories: MOCK_INDEX.stories.map((story) =>
        story.id === "mock_witch"
          ? { ...story, entityIds: [...(story.entityIds ?? []), "fatui"] }
          : story
      ),
      entitiesIndex: {
        rostam: { name: "ルースタン", kind: "character", storyIds: ["mock_witch", "mock_elegy"] },
        orobashi: { name: "オロバシノミコト", kind: "god", storyIds: ["mock_elegy"] },
        fatui: { name: "ファデュイ", kind: "organization", storyIds: ["mock_witch"] },
        abyss: { name: "アビス（深淵）", kind: "concept", storyIds: ["mock_elegy"] },
        khaenriah: { name: "カーンルイア", kind: "place", storyIds: ["mock_elegy"] },
      },
    };

    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppProviders deferStorageHydration>
          <Routes>
            <Route index element={<ShelfPage initialIndexData={multiKindIndex} />} />
          </Routes>
        </AppProviders>
      </MemoryRouter>
    );

    const select = document.getElementById("entity-filter") as HTMLSelectElement | null;
    expect(select).not.toBeNull();
    const optgroups = Array.from(select!.querySelectorAll("optgroup"));
    expect(optgroups.map((g) => g.getAttribute("label"))).toEqual([
      "人物",
      "魔神・執政",
      "組織",
      "歴史・重要用語",
      "地域・地名",
    ]);
    expect(optgroups[2].querySelector("option")?.value).toBe("fatui");

    await user.selectOptions(select!, "fatui");
    expect(select!.value).toBe("fatui");
    expect(screen.getByText("燃え盛る炎の魔女")).toBeInTheDocument();
    expect(screen.queryByText("終焉を嘆く詩")).not.toBeInTheDocument();
  });
});
