import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearStoriesCache } from "../src/api/stories";
import { AppShell } from "../src/components/layout/AppShell";
import { ReaderPage } from "../src/components/reader/ReaderPage";
import { ShelfPage } from "../src/components/shelf/ShelfPage";
import { AppProviders } from "../src/state/AppProviders";
import type { StoriesIndexData, StoryDetail } from "../src/types/story";

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
    overallTruth: "少女の正体は淑女ロザリンである。",
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

    // Bookmark mock_elegy
    const bookmarkBtn = screen.getByRole("button", { name: "『終焉を嘆く詩』をあとで読む" });
    await user.click(bookmarkBtn);
    expect(bookmarkBtn).toHaveAttribute("aria-pressed", "true");

    // Search filter to empty and reset
    const searchInput = screen.getByLabelText("タイトル・キーワード・時代で検索");
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
});
