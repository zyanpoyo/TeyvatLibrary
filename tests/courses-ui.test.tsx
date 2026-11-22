import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useParams } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearStoriesCache } from "../src/api/stories";
import { CourseDetailPage } from "../src/components/courses/CourseDetailPage";
import { CoursesPage } from "../src/components/courses/CoursesPage";
import { AppShell } from "../src/components/layout/AppShell";
import { ReaderPage } from "../src/components/reader/ReaderPage";
import { ShelfPage } from "../src/components/shelf/ShelfPage";
import { AppProviders } from "../src/state/AppProviders";
import type { SearchIndexData, StoriesIndexData, StoryDetail } from "../src/types/story";

const MOCK_INDEX: StoriesIndexData = {
  generatedAt: "2026-11-22T00:00:00.000Z",
  totalCount: 3,
  categoryCounts: { book: 1, artifact: 1, weapon: 1, attire: 0, chronicle: 0 },
  entitiesIndex: {},
  stories: [
    {
      id: "mock_elegy",
      title: "終焉を嘆く詩",
      shelfCategory: "weapon",
      categoryLabel: "武器ストーリー",
      region: ["モンド"],
      era: "500年前",
      readingTime: "約1分",
      charCount: 600,
      chapterCount: 1,
      hook: "西風騎士の最期",
      tags: ["ルースタン"],
      entityIds: [],
    },
    {
      id: "mock_witch",
      title: "燃え盛る炎の魔女",
      shelfCategory: "artifact",
      categoryLabel: "聖遺物（連作短編）",
      region: ["モンド"],
      era: "500年前",
      readingTime: "約2分",
      charCount: 1050,
      chapterCount: 2,
      hook: "炎の魔女の記憶",
      tags: ["ロザリン"],
      entityIds: [],
    },
    {
      id: "mock_byakuyakoku",
      title: "白夜国館蔵",
      shelfCategory: "book",
      categoryLabel: "書籍",
      region: ["淵下宮"],
      era: "白夜国時代",
      readingTime: "約5分",
      charCount: 2800,
      chapterCount: 2,
      hook: "世界の創世記",
      tags: ["パネース"],
      entityIds: [],
    },
  ],
  courses: [
    {
      id: "must_read_essentials",
      kind: "beginner",
      badge: "必読入門",
      title: "まずはこれ！重要記録",
      subtitle: "迷ったらここから",
      hook: "入門用コース。",
      featured: true,
      storyIds: ["mock_elegy", "mock_witch"],
      steps: [
        { storyId: "mock_elegy", note: "1話目は騎士の物語。" },
        { storyId: "mock_witch", note: "2話目は炎の魔女。" },
      ],
      storyCount: 2,
      totalCharCount: 1650,
      totalReadingTime: "約3分",
    },
    {
      id: "rosalyne_chronicle",
      kind: "character",
      badge: "キャラ別",
      title: "ロザリンの500年",
      subtitle: "少女から淑女へ",
      hook: "表裏の物語。",
      featured: true,
      storyIds: ["mock_witch", "mock_elegy"],
      steps: [
        { storyId: "mock_witch", note: "炎の魔女編。" },
        { storyId: "mock_elegy", note: "騎士編。" },
      ],
      storyCount: 2,
      totalCharCount: 1650,
      totalReadingTime: "約3分",
    },
    {
      id: "teyvat_genesis",
      kind: "arc",
      badge: "創世記・神話編",
      title: "テイワット創世記",
      subtitle: "神話の核心",
      hook: "太古の真実。",
      featured: true,
      storyIds: ["mock_byakuyakoku"],
      steps: [{ storyId: "mock_byakuyakoku", note: "日月前事を読む。" }],
      storyCount: 1,
      totalCharCount: 2800,
      totalReadingTime: "約5分",
    },
    {
      id: "watatsumi_orobashi",
      kind: "arc",
      badge: "淵下宮・魔神戦争",
      title: "白夜国とオロバシ",
      subtitle: "海祇の盟約",
      hook: "白蛇の悲劇。",
      storyIds: ["mock_byakuyakoku", "mock_elegy"],
      steps: [
        { storyId: "mock_byakuyakoku", note: "禁書。" },
        { storyId: "mock_elegy", note: "関連比較。" },
      ],
      storyCount: 2,
      totalCharCount: 3400,
      totalReadingTime: "約6分",
    },
  ],
};

const MOCK_DETAILS: Record<string, StoryDetail> = {
  mock_elegy: {
    ...MOCK_INDEX.stories[0],
    preGuide: ["舞台：500年前のモンド"],
    overallTruth: "ルースタンの物語。",
    gameEffect: "元素熟知+60",
    connected: [],
    glossary: {},
    chapters: [
      {
        partLabel: "全一章",
        heading: "風に溶けた詩",
        epigraph: "風神の詩。",
        paragraphs: ["騎士は剣を置いた。"],
      },
    ],
  },
  mock_witch: {
    ...MOCK_INDEX.stories[1],
    preGuide: ["舞台：500年前のモンド"],
    overallTruth: "ロザリンの物語。",
    gameEffect: "炎元素+15%",
    connected: [],
    glossary: {},
    chapters: [
      {
        partLabel: "第一章",
        heading: "水時計",
        epigraph: "時計。",
        paragraphs: ["炎が燃え上がった。"],
      },
    ],
  },
  mock_byakuyakoku: {
    ...MOCK_INDEX.stories[2],
    preGuide: ["舞台：淵下宮"],
    overallTruth: "創世の記録。",
    gameEffect: "書籍。",
    connected: [],
    glossary: {},
    chapters: [
      {
        partLabel: "第一巻",
        heading: "日月前事",
        epigraph: "禁書。",
        paragraphs: ["原初のあの方が世界を造った。"],
      },
    ],
  },
};

const MOCK_SEARCH: SearchIndexData = {
  generatedAt: "2026-11-22T00:00:00.000Z",
  stories: {},
};

function CourseDetailRouteWrapper() {
  const { courseId = "" } = useParams<{ courseId: string }>();
  return <CourseDetailPage courseId={courseId} />;
}

function renderApp(initialEntries: string[] = ["/"]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <AppProviders>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<ShelfPage />} />
            <Route path="courses" element={<CoursesPage />} />
            <Route path="courses/:courseId" element={<CourseDetailRouteWrapper />} />
            <Route path="story/:storyId" element={<ReaderPage />} />
          </Route>
        </Routes>
      </AppProviders>
    </MemoryRouter>
  );
}

describe("Courses & Fair Shelf UI integration", () => {
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
          return { ok: true, status: 200, json: async () => MOCK_SEARCH } as Response;
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

  it("renders featured 3 courses in FairShelf on shelf top, updates progress, and hides FairShelf while filtering", async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      "genshin-books-reading-state-v1",
      JSON.stringify({
        readStories: { mock_elegy: { readAt: "2026-11-22T00:00:00.000Z" } },
        bookmarks: [],
        lastSession: null,
      })
    );

    renderApp(["/"]);

    const fairShelf = await screen.findByRole("region", { name: "特設フェア棚・読書コース" });
    expect(fairShelf.querySelectorAll(".course-card")).toHaveLength(3);
    expect(screen.getByText("すべてのコースを見る（全4コース）→")).toHaveAttribute("href", "/courses");
    expect(
      fairShelf.querySelector(".course-card[data-course-id='must_read_essentials'] .course-progress-text")
    ).toHaveTextContent("1 / 2 篇 読了");

    // カテゴリータブで絞り込むとフェア棚が自動で隠れる
    await user.click(screen.getByRole("button", { name: /書籍/ }));
    expect(document.getElementById("fair-shelf")).toBeNull();

    // 「すべて」へ戻すとフェア棚が再表示される
    await user.click(screen.getByRole("button", { name: /すべて/ }));
    expect(document.getElementById("fair-shelf")).not.toBeNull();
  });

  it("lists all courses grouped by kind on /courses and filters by kind pills", async () => {
    const user = userEvent.setup();
    renderApp(["/courses"]);

    await screen.findByRole("heading", { level: 1, name: "読書コース一覧" });
    expect(document.querySelectorAll("#courses-view .course-card")).toHaveLength(4);

    await user.click(document.querySelector('[data-course-filter="character"]')!);
    expect(document.querySelectorAll("#courses-view .course-card")).toHaveLength(1);
    expect(screen.getByText("ロザリンの500年")).toBeInTheDocument();

    await user.click(document.querySelector('[data-course-filter="all"]')!);
    expect(document.querySelectorAll("#courses-view .course-card")).toHaveLength(4);
  });

  it("shows step guides and dynamic CTA on /courses/:courseId and supports course continuation & completion in ReaderPage", async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      "genshin-books-reading-state-v1",
      JSON.stringify({
        readStories: { mock_elegy: { readAt: "2026-11-22T00:00:00.000Z" } },
        bookmarks: [],
        lastSession: null,
      })
    );

    renderApp(["/courses/must_read_essentials"]);

    await screen.findByRole("heading", { level: 1, name: "まずはこれ！重要記録" });
    const primaryCta = document.getElementById("course-primary-cta") as HTMLAnchorElement;
    expect(primaryCta).toHaveTextContent("続き（第2話）から読む");
    expect(primaryCta.getAttribute("href")).toBe("/story/mock_witch?course=must_read_essentials");

    // ステップ1から ?course= 付きでリーダーへ遷移
    const step1Link = document.querySelector(
      ".course-step-card[data-story-id='mock_elegy'] .course-step-link"
    ) as HTMLAnchorElement;
    await user.click(step1Link);

    await screen.findByRole("heading", { level: 1, name: "終焉を嘆く詩" });
    // 上部コース文脈バーと章末次話カードが表示され、#back-to-shelf-btn はそのまま維持される
    expect(document.getElementById("back-to-shelf-btn")).toHaveTextContent("← 書架へ戻る");
    expect(document.getElementById("reader-course-banner")).toHaveTextContent("第1話 / 全2話");
    const nextStoryBtn = document.querySelector('[data-action="course-next-story"]') as HTMLAnchorElement;
    expect(nextStoryBtn).toHaveTextContent("『燃え盛る炎の魔女』");

    // 次話へ連続遷移（最終話へ）
    await user.click(nextStoryBtn);
    await screen.findByRole("heading", { level: 1, name: "燃え盛る炎の魔女" });
    expect(document.getElementById("reader-course-banner")).toHaveTextContent("第2話 / 全2話");

    // 最終話を読了にすると、コース読破完了メッセージが即座に表示される
    await user.click(document.querySelector(".reader-state-bar .reader-read-btn")!);
    await waitFor(() => {
      expect(document.querySelector('[data-course-completed="true"]')).toHaveTextContent(
        "全話読破しました"
      );
    });
  });

  it("shows course membership cards without top banner when opening a story standalone", async () => {
    renderApp(["/story/mock_elegy"]);

    await screen.findByRole("heading", { level: 1, name: "終焉を嘆く詩" });
    expect(document.getElementById("reader-course-banner")).toBeNull();
    const courseNav = document.getElementById("course-nav-container")!;
    expect(courseNav).toHaveTextContent("この物語が収録されている読書コース");
    expect(courseNav.querySelectorAll("[data-course-id]").length).toBe(3);
  });

  it("navigates across /, /courses, and /courses/:courseId without hook-order mismatch", async () => {
    const user = userEvent.setup();
    renderApp(["/"]);

    const shelfNavLink = document.querySelector('#shelf-site-nav [data-nav-target="shelf"]');
    expect(shelfNavLink).toHaveAttribute("aria-current", "page");

    // / -> /courses (useMatch 順序が崩れないこと)
    await user.click(await screen.findByText(/すべてのコースを見る/));
    await screen.findByRole("heading", { level: 1, name: "読書コース一覧" });
    expect(document.querySelector('#courses-site-nav [data-nav-target="courses"]')).toHaveAttribute(
      "aria-current",
      "page"
    );

    // /courses -> /courses/:courseId
    const courseLink = document.querySelector(
      ".course-card[data-course-id='must_read_essentials'] .course-primary-link"
    ) as HTMLAnchorElement;
    await user.click(courseLink);
    await screen.findByRole("heading", { level: 1, name: "まずはこれ！重要記録" });
    expect(
      document.querySelector('#course-detail-site-nav [data-nav-target="courses"]')
    ).toHaveAttribute("aria-current", "page");

    // /courses/:courseId -> /
    await user.click(document.querySelector('#course-detail-site-nav [data-nav-target="shelf"]')!);
    await screen.findByRole("region", { name: "特設フェア棚・読書コース" });
  });

  it("renders course not-found state for unknown courseId", async () => {
    renderApp(["/courses/nonexistent_course_id"]);

    await screen.findByRole("heading", { level: 1, name: "読書コースが見つかりません" });
    expect(screen.getByRole("link", { name: "← 読書コース一覧へ戻る" })).toHaveAttribute(
      "href",
      "/courses"
    );
  });
});
