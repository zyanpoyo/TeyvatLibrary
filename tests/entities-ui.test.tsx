import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useParams } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { analytics } from "../src/analytics/ga4";
import { clearStoriesCache } from "../src/api/stories";
import { EntitiesPage } from "../src/components/entities/EntitiesPage";
import { EntityDetailPage } from "../src/components/entities/EntityDetailPage";
import { AppShell } from "../src/components/layout/AppShell";
import { ReaderPage } from "../src/components/reader/ReaderPage";
import { ShelfPage } from "../src/components/shelf/ShelfPage";
import { AppProviders } from "../src/state/AppProviders";
import type { SearchIndexData, StoriesIndexData, StoryDetail } from "../src/types/story";

const MOCK_INDEX: StoriesIndexData = {
  generatedAt: "2026-11-28T00:00:00.000Z",
  totalCount: 3,
  categoryCounts: { book: 1, artifact: 1, weapon: 1, attire: 0, chronicle: 0 },
  entitiesIndex: {
    rosalyne: {
      name: "ロザリン（淑女）",
      kind: "character",
      defaultIdentity: "正体：ファデュイ執行官第八位『淑女』",
      defaultDesc: "500年前のモンド出身の魔女。恋人を失い炎となった。",
      defaultEvidence: "聖遺物『燃え盛る炎の魔女』・武器『終焉を嘆く詩』",
      evidenceLinks: [
        { title: "燃え盛る炎の魔女", storyId: "mock_witch" },
        { title: "終焉を嘆く詩", storyId: "mock_elegy" },
      ],
      storyIds: ["mock_witch", "mock_elegy"],
    },
    rostam: {
      name: "ルースタン",
      kind: "character",
      defaultIdentity: "正体：西風騎士団副団長「幼い狼」",
      defaultDesc: "モンドを守って散った西風騎士団の騎士。",
      defaultEvidence: "武器『終焉を嘆く詩』",
      evidenceLinks: [{ title: "終焉を嘆く詩", storyId: "mock_elegy" }],
      storyIds: ["mock_elegy", "mock_witch"],
    },
    orobashi: {
      name: "オロバシノミコト",
      kind: "god",
      defaultIdentity: "正体：海祇大御神",
      defaultDesc: "白夜国の民を救い海祇島へ導いた白蛇の魔神。",
      defaultEvidence: "書籍『白夜国館蔵』",
      evidenceLinks: [{ title: "白夜国館蔵", storyId: "mock_byakuyakoku" }],
      storyIds: ["mock_byakuyakoku"],
    },
  },
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
      entityIds: ["rosalyne", "rostam"],
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
      chapterCount: 1,
      hook: "炎の魔女の記憶",
      tags: ["ロザリン"],
      entityIds: ["rosalyne", "rostam"],
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
      chapterCount: 1,
      hook: "世界の創世記",
      tags: ["オロバシ"],
      entityIds: ["orobashi"],
    },
  ],
  courses: [
    {
      id: "rosalyne_chronicle",
      kind: "character",
      badge: "キャラ別",
      title: "ロザリン（淑女）とルースタンの500年",
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
  ],
};

const MOCK_DETAILS: Record<string, StoryDetail> = {
  mock_elegy: {
    ...MOCK_INDEX.stories[0],
    entities: [
      {
        id: "rosalyne",
        name: "ロザリン（淑女）",
        kind: "character",
        identity: "正体：ファデュイ執行官第八位『淑女』",
        desc: "500年前のモンド出身の魔女。",
      },
      {
        id: "rostam",
        name: "ルースタン",
        kind: "character",
        identity: "正体：西風騎士団副団長",
        desc: "モンドを守った騎士。",
      },
    ],
    preGuide: ["舞台：500年前のモンド"],
    overallTruth: "ルースタンの物語。",
    gameEffect: "元素熟知+60",
    connected: [],
    glossary: {
      el_knight: {
        entityId: "rostam",
        term: "悲しげな騎士",
        identity: "正体：ルースタン",
        desc: "西風騎士団を支えた副団長。",
        evidence: "聖遺物『燃え盛る炎の魔女』より",
        evidenceLinks: [{ title: "燃え盛る炎の魔女", storyId: "mock_witch" }],
      },
    },
    chapters: [
      {
        partLabel: "全一章",
        heading: "風に溶けた詩",
        epigraph: "風神の詩。",
        paragraphs: ["{{el_knight|悲しげな騎士}}は剣を置いた。"],
      },
    ],
  },
  mock_witch: {
    ...MOCK_INDEX.stories[1],
    entities: [
      {
        id: "rosalyne",
        name: "ロザリン（淑女）",
        kind: "character",
        identity: "正体：ファデュイ執行官第八位『淑女』",
        desc: "500年前のモンド出身の魔女。",
      },
    ],
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
    entities: [
      {
        id: "orobashi",
        name: "オロバシノミコト",
        kind: "god",
        identity: "正体：海祇大御神",
        desc: "白夜国の民を救った魔神。",
      },
    ],
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
        paragraphs: ["白蛇の魔神は民を導いた。"],
      },
    ],
  },
};

const MOCK_SEARCH: SearchIndexData = {
  generatedAt: "2026-11-28T00:00:00.000Z",
  stories: {},
};

function EntityDetailRouteWrapper() {
  const { entityId = "" } = useParams<{ entityId: string }>();
  return <EntityDetailPage entityId={entityId} />;
}

function renderApp(initialEntries: string[] = ["/"]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <AppProviders>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<ShelfPage />} />
            <Route path="entities" element={<EntitiesPage />} />
            <Route path="entities/:entityId" element={<EntityDetailRouteWrapper />} />
            <Route path="story/:storyId" element={<ReaderPage />} />
          </Route>
        </Routes>
      </AppProviders>
    </MemoryRouter>
  );
}

describe("Entities Archive UI integration & cross-links", () => {
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

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("lists entities on /entities, hides 0-count kinds, filters by kind/query, sorts, and resets empty state", async () => {
    const user = userEvent.setup();
    const pageViewSpy = vi.spyOn(analytics, "trackPageView");

    renderApp(["/entities"]);

    await screen.findByRole("heading", { level: 1, name: "人物・用語名鑑" });
    expect(document.getElementById("entities-spoiler-notice")).toHaveTextContent(
      "物語の核心や正体に関する記述を含みます"
    );
    expect(document.querySelectorAll("#entities-view .entity-card")).toHaveLength(3);

    // 0件種別（organization / concept / place）は表示されない
    expect(document.querySelector('[data-entity-filter="character"]')).not.toBeNull();
    expect(document.querySelector('[data-entity-filter="god"]')).not.toBeNull();
    expect(document.querySelector('[data-entity-filter="organization"]')).toBeNull();
    expect(document.querySelector('[data-entity-filter="concept"]')).toBeNull();
    expect(document.querySelector('[data-entity-filter="place"]')).toBeNull();

    // ナビ active 状態と body data-view と page_view 計測
    expect(document.body.dataset.view).toBe("entities");
    expect(
      document.querySelector('#entities-site-nav [data-nav-target="entities"]')
    ).toHaveAttribute("aria-current", "page");
    expect(pageViewSpy).toHaveBeenCalledWith({
      pagePath: "/entities",
      pageTitle: "人物・用語名鑑｜テイワット文庫",
    });

    // 種別フィルタ
    await user.click(document.querySelector('[data-entity-filter="god"]')!);
    expect(document.querySelectorAll("#entities-view .entity-card")).toHaveLength(1);
    expect(screen.getByText("オロバシノミコト")).toBeInTheDocument();

    // 0件時のリセット
    await user.type(document.getElementById("entities-search-input")!, "存在しない検索語");
    expect(screen.getByText("一致する人物・用語が見つかりません")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "絞り込み条件をリセット" }));
    expect(document.querySelectorAll("#entities-view .entity-card")).toHaveLength(3);

    // 五十音順並び替え（ルースタン → ロザリン）
    await user.selectOptions(document.getElementById("entities-sort-select")!, "name");
    const characterCards = Array.from(
      document.querySelectorAll('[data-entity-group="character"] .entity-card')
    ).map((el) => el.getAttribute("data-entity-id"));
    expect(characterCards).toEqual(["rostam", "rosalyne"]);
  });

  it("renders entity detail with evidence links, reading progress CTA, related courses, co-occurring entities, and ShareBar analytics", async () => {
    const user = userEvent.setup();
    const pageViewSpy = vi.spyOn(analytics, "trackPageView");
    const storyOpenSpy = vi.spyOn(analytics, "trackStoryOpen");
    const shareSpy = vi.spyOn(analytics, "trackEntityShare");
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    localStorage.setItem(
      "genshin-books-reading-state-v1",
      JSON.stringify({
        readStories: { mock_elegy: { readAt: "2026-11-28T00:00:00.000Z" } },
        bookmarks: [],
        lastSession: null,
      })
    );

    renderApp(["/entities/rosalyne"]);

    await screen.findByRole("heading", { level: 1, name: "ロザリン（淑女）" });
    expect(document.getElementById("entity-detail-progress")).toHaveTextContent(
      "登場 2 篇中 1 篇 読了"
    );
    expect(document.getElementById("entity-primary-cta")).toHaveTextContent("次の未読作品を読む");
    expect(document.getElementById("entity-primary-cta")).toHaveAttribute(
      "href",
      "/story/mock_witch"
    );
    expect(pageViewSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        pagePath: "/entities/rosalyne",
        entityId: "rosalyne",
      })
    );

    // 関連コースと共起エンティティが表示される
    expect(document.querySelector(".course-card[data-course-id='rosalyne_chronicle']")).not.toBeNull();
    const relatedChip = document.querySelector(".entity-related-chip[data-entity-id='rostam']");
    expect(relatedChip).toHaveTextContent("ルースタン");
    expect(relatedChip).toHaveAttribute("href", "/entities/rostam");

    // ShareBar 動作と GA4 entity_share 計測
    const copyBtn = document.querySelector('#entity-share-bar [data-action="copy-entity-url"]')!;
    await user.click(copyBtn);
    expect(writeText).toHaveBeenCalledWith("https://teyvat-bunko.com/entities/rosalyne");
    expect(shareSpy).toHaveBeenCalledWith({
      entityId: "rosalyne",
      entityKind: "character",
      method: "copy",
    });

    // 出典リンククリックでリーダー遷移＆ entity_evidence 計測
    const evidenceLink = document.querySelector(
      '#entity-detail-evidence a[data-target-id="mock_witch"]'
    ) as HTMLAnchorElement;
    await user.click(evidenceLink);
    await screen.findByRole("heading", { level: 1, name: "燃え盛る炎の魔女" });
    expect(storyOpenSpy).toHaveBeenCalledWith({
      storyId: "mock_witch",
      storyCategory: "artifact",
      source: "entity_evidence",
    });
  });

  it("renders entity not-found fallback for unknown entityId (including Object.prototype property names)", async () => {
    renderApp(["/entities/unknown_entity_id"]);

    await screen.findByRole("heading", { level: 1, name: "人物・用語が見つかりません" });
    expect(screen.getByRole("link", { name: "← 人物・用語名鑑へ戻る" })).toHaveAttribute(
      "href",
      "/entities"
    );

    const protoRender = renderApp(["/entities/constructor"]);
    expect(
      await protoRender.findByRole("heading", { level: 1, name: "人物・用語が見つかりません" })
    ).toBeInTheDocument();
  });

  it("supports all 4 cross-links: SiteNavBar, ShelfToolbar entity filter link, GlossaryDialog link, and ReaderArticle lore chips", async () => {
    const user = userEvent.setup();
    renderApp(["/"]);

    // 1. ShelfToolbar 人物絞り込み中の名鑑リンク
    await screen.findByRole("combobox", { name: "登場人物・用語で絞り込む" });
    expect(document.getElementById("shelf-entity-archive-link")).toBeNull();

    await user.selectOptions(
      screen.getByRole("combobox", { name: "登場人物・用語で絞り込む" }),
      "orobashi"
    );
    const shelfEntityLink = document.getElementById("shelf-entity-archive-link");
    expect(shelfEntityLink).toHaveTextContent("「オロバシノミコト」を人物・用語名鑑で見る →");
    expect(shelfEntityLink).toHaveAttribute("href", "/entities/orobashi");

    await user.click(shelfEntityLink!);
    await screen.findByRole("heading", { level: 1, name: "オロバシノミコト" });

    // 2. 常設ナビ経由で書架へ戻り、絞り込みを解除してリーダーへ遷移
    await user.click(document.querySelector('#entity-detail-site-nav [data-nav-target="shelf"]')!);
    await screen.findByRole("combobox", { name: "登場人物・用語で絞り込む" });
    await user.selectOptions(
      screen.getByRole("combobox", { name: "登場人物・用語で絞り込む" }),
      ""
    );
    await user.click(
      document.querySelector(".story-card[data-story-id='mock_elegy'] .card-primary-link")!
    );
    await screen.findByRole("heading", { level: 1, name: "終焉を嘆く詩" });

    // 3. GlossaryDialog 内の「人物・用語名鑑で詳しく見る」リンク
    await user.click(document.querySelector('[data-term-id="el_knight"]')!);
    const glossaryEntityLink = await screen.findByRole("link", {
      name: /人物・用語名鑑で詳しく見る/,
    });
    expect(glossaryEntityLink).toHaveAttribute("href", "/entities/rostam");

    await user.click(glossaryEntityLink);
    await screen.findByRole("heading", { level: 1, name: "ルースタン" });

    // 4. ReaderArticle 真相・考察メモ内の登場人物・用語チップ
    await user.click(document.querySelector('#entity-stories-list a[href="/story/mock_elegy"]')!);
    await screen.findByRole("heading", { level: 1, name: "終焉を嘆く詩" });
    await user.click(screen.getByText(/読了後の真相・考察メモ/));

    const loreChip = document.querySelector(".lore-entity-chip[data-entity-id='rosalyne']");
    expect(loreChip).toHaveTextContent("ロザリン（淑女）");
    await user.click(loreChip!);
    await screen.findByRole("heading", { level: 1, name: "ロザリン（淑女）" });
  });
});
