import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
});
