import type { MetaDescriptor } from "react-router";
import { describe, expect, it } from "vitest";
import {
  ABOUT_DOCUMENT_TITLE,
  buildAboutMeta,
  buildCourseDetailMeta,
  buildCoursesMeta,
  buildNotFoundMeta,
  buildShelfMeta,
  buildStoryDescription,
  buildStoryDocumentTitle,
  buildStoryMeta,
  COURSES_DOCUMENT_TITLE,
  SHELF_DOCUMENT_TITLE,
} from "../src/domain/seo";
import type { CourseIndexItem, StoriesIndexData, StoryDetail } from "../src/types/story";

function findTitle(meta: MetaDescriptor[]): string | undefined {
  const entry = meta.find((item) => "title" in item) as { title?: string } | undefined;
  return entry?.title;
}

function findMetaContent(
  meta: MetaDescriptor[],
  key: "name" | "property",
  value: string
): string | undefined {
  const entry = meta.find(
    (item) => key in item && (item as Record<string, string>)[key] === value
  ) as { content?: string } | undefined;
  return entry?.content;
}

function findCanonical(meta: MetaDescriptor[]): string | undefined {
  const entry = meta.find(
    (item) => "tagName" in item && (item as Record<string, string>).rel === "canonical"
  ) as { href?: string } | undefined;
  return entry?.href;
}

function findLdJson(meta: MetaDescriptor[]): Record<string, unknown> | undefined {
  const entry = meta.find((item) => "script:ld+json" in item) as
    | { "script:ld+json"?: Record<string, unknown> }
    | undefined;
  return entry?.["script:ld+json"];
}

function makeStory(overrides: Partial<StoryDetail> = {}): StoryDetail {
  return {
    id: "crimson_witch",
    title: "燃え盛る炎の魔女",
    shelfCategory: "artifact",
    categoryLabel: "聖遺物（連作短編）",
    region: ["モンド", "スメール"],
    era: "500年前の災厄",
    addedAt: "2026-11-01",
    readingTime: "約2分",
    charCount: 1059,
    chapterCount: 5,
    hook: "愛する人を失った少女は、涙が枯れた日に自らの身体を「液体の炎」へと変えた——",
    tags: ["ロザリン（淑女）", "500年前の災厄"],
    entityIds: ["rosalyne"],
    entities: [
      {
        id: "rosalyne",
        name: "ロザリン（淑女）",
        kind: "character",
        identity: "正体：ファデュイ執行官第八位『淑女』",
        desc: "500年前のモンド出身の魔女。",
      },
    ],
    preGuide: ["舞台：500年前"],
    overallTruth: "真相解説",
    gameEffect: "炎元素ダメージ+15%",
    glossary: {
      cw_lover: {
        term: "時計をくれた人",
        identity: "正体：ルースタン",
        desc: "西風騎士団の騎士。",
      },
    },
    chapters: [
      {
        partLabel: "第一章",
        heading: "魔女の炎の花",
        epigraph: "エピグラフ",
        paragraphs: ["本文"],
      },
    ],
    ...overrides,
  };
}

describe("SEO meta & JSON-LD builders", () => {
  it("builds shelf metadata with WebSite SearchAction and CollectionPage JSON-LD", () => {
    const indexData: StoriesIndexData = {
      generatedAt: "2026-11-22T00:00:00.000Z",
      totalCount: 35,
      categoryCounts: { book: 7, artifact: 11, weapon: 10, attire: 3, chronicle: 4 },
      entitiesIndex: {},
      stories: [],
    };
    const meta = buildShelfMeta({ indexData });

    expect(findTitle(meta)).toBe(SHELF_DOCUMENT_TITLE);
    expect(findMetaContent(meta, "name", "description")).toContain("全35篇");
    expect(findCanonical(meta)).toBe("https://teyvat-bunko.com/");
    expect(findMetaContent(meta, "property", "og:image")).toBe("https://teyvat-bunko.com/og/site.png");
    expect(findMetaContent(meta, "name", "twitter:card")).toBe("summary_large_image");

    const ld = findLdJson(meta) as { "@graph": Array<Record<string, unknown>> };
    expect(ld["@graph"]).toHaveLength(2);
    expect(ld["@graph"][0]["@type"]).toBe("WebSite");
    expect(ld["@graph"][0].potentialAction).toMatchObject({
      "@type": "SearchAction",
      target: "https://teyvat-bunko.com/?q={search_term_string}",
    });
    expect(ld["@graph"][1]).toMatchObject({
      "@type": "CollectionPage",
      numberOfItems: 35,
    });
  });

  it("builds story titles across all 5 categories, avoids tag duplication/overflow, and honors seo overrides", () => {
    expect(buildStoryDocumentTitle(makeStory())).toBe(
      "【原神】聖遺物「燃え盛る炎の魔女」ストーリー全文・用語解説｜ロザリン（淑女）｜テイワット文庫"
    );

    expect(
      buildStoryDocumentTitle(
        makeStory({
          id: "byakuyakoku",
          title: "白夜国館蔵（日月前事 ほか全五巻）",
          shelfCategory: "book",
          categoryLabel: "書籍（古文書・禁書）",
          tags: ["日月前事", "パネース"],
        })
      )
    ).toBe("【原神】書籍「白夜国館蔵（日月前事 ほか全五巻）」全文・用語解説｜テイワット文庫");

    expect(
      buildStoryDocumentTitle(
        makeStory({
          id: "wolfs",
          title: "狼の末路",
          shelfCategory: "weapon",
          categoryLabel: "武器（短編小説）",
          tags: ["アンドリアス（奔狼の領主）"],
        })
      )
    ).toBe("【原神】武器「狼の末路」ストーリー全文・用語解説｜アンドリアス（奔狼の領主）｜テイワット文庫");

    expect(
      buildStoryDocumentTitle(
        makeStory({
          id: "wings_of_fate",
          title: "交錯する運命の翼",
          shelfCategory: "attire",
          categoryLabel: "風の翼（短編・銘文）",
          tags: ["ダインスレイヴ"],
        })
      )
    ).toBe("【原神】風の翼「交錯する運命の翼」ストーリー全文・用語解説｜ダインスレイヴ｜テイワット文庫");

    expect(
      buildStoryDocumentTitle(
        makeStory({
          id: "dandelion",
          title: "獅牙戦士の叙事詩",
          shelfCategory: "chronicle",
          categoryLabel: "突破素材（四幕詩）",
          tags: ["ヴァネッサ"],
        })
      )
    ).toBe("【原神】突破素材「獅牙戦士の叙事詩」ストーリー全文・用語解説｜ヴァネッサ｜テイワット文庫");

    expect(
      buildStoryDocumentTitle(
        makeStory({
          id: "signora_chronicle",
          title: "紅蓮の蛾と灰燼の追憶（淑女討伐録）",
          shelfCategory: "chronicle",
          categoryLabel: "育成素材（週ボス素材連作）",
          tags: ["ロザリン（淑女）"],
        })
      )
    ).toBe(
      "【原神】育成素材「紅蓮の蛾と灰燼の追憶（淑女討伐録）」ストーリー全文・用語解説｜ロザリン（淑女）｜テイワット文庫"
    );

    // 58文字上限を超える場合は代表タグを自動省略する
    expect(
      buildStoryDocumentTitle(
        makeStory({
          id: "general_history_of_snezhnaya_supplement",
          title: "スネージナヤ通史補編（全三巻）",
          shelfCategory: "book",
          categoryLabel: "書籍（スネージナヤ歴史補編・異民族史料）",
          tags: ["ツァーリ・ベールイ（モノマフ）"],
        })
      )
    ).toBe("【原神】書籍「スネージナヤ通史補編（全三巻）」全文・用語解説｜ツァーリ・ベールイ（モノマフ）｜テイワット文庫");

    expect(
      buildStoryDocumentTitle(
        makeStory({
          id: "long_title_case",
          title: "とても長い物語のタイトル例（第一部〜第五部・完全収録版）",
          shelfCategory: "artifact",
          categoryLabel: "聖遺物（連作短編）",
          tags: ["代表キャラクターの補足名称"],
        })
      )
    ).toBe(
      "【原神】聖遺物「とても長い物語のタイトル例（第一部〜第五部・完全収録版）」ストーリー全文・用語解説｜テイワット文庫"
    );

    expect(
      buildStoryDocumentTitle(
        makeStory({
          seo: { title: "カスタムSEOタイトル｜テイワット文庫" },
        })
      )
    ).toBe("カスタムSEOタイトル｜テイワット文庫");
  });

  it("builds story metadata with Article, BreadcrumbList, about entities, DefinedTerm mentions, and seo description override", () => {
    const story = makeStory({
      entities: [
        {
          id: "rosalyne",
          name: "ロザリン（淑女）",
          kind: "character",
          identity: "正体：ファデュイ執行官第八位『淑女』",
          desc: "500年前のモンド出身の魔女。",
        },
        {
          id: "fatui",
          name: "ファデュイ",
          kind: "organization",
          identity: "解説：スネージナヤの組織",
          desc: "氷の女皇直属の外交組織。",
        },
      ],
    });
    const meta = buildStoryMeta({ story });

    expect(findCanonical(meta)).toBe("https://teyvat-bunko.com/story/crimson_witch");
    expect(findMetaContent(meta, "property", "og:type")).toBe("article");
    expect(findMetaContent(meta, "property", "og:image")).toBe(
      "https://teyvat-bunko.com/og/story/crimson_witch.png"
    );

    const ld = findLdJson(meta) as { "@graph": Array<Record<string, unknown>> };
    expect(ld["@graph"][0]).toMatchObject({
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "テイワット文庫", item: "https://teyvat-bunko.com/" },
        {
          "@type": "ListItem",
          position: 2,
          name: "燃え盛る炎の魔女",
          item: "https://teyvat-bunko.com/story/crimson_witch",
        },
      ],
    });

    const article = ld["@graph"][1] as Record<string, unknown>;
    expect(article["@type"]).toBe("Article");
    expect(article.datePublished).toBe("2026-11-01T00:00:00+09:00");
    expect(article.about).toEqual([
      {
        "@type": "Person",
        name: "ロザリン",
        alternateName: ["淑女"],
        description: "正体：ファデュイ執行官第八位『淑女』 500年前のモンド出身の魔女。",
      },
      {
        "@type": "Organization",
        name: "ファデュイ",
        description: "解説：スネージナヤの組織 氷の女皇直属の外交組織。",
      },
    ]);
    expect(article.mentions).toEqual([
      {
        "@type": "DefinedTerm",
        name: "時計をくれた人",
        description: "正体：ルースタン 西風騎士団の騎士。",
      },
    ]);

    expect(
      buildStoryDescription(makeStory({ seo: { description: "手動設定のディスクリプション。" } }))
    ).toBe("手動設定のディスクリプション。");
  });

  it("builds About metadata and noindex 404 metadata without canonical/OGP/JSON-LD", () => {
    const aboutMeta = buildAboutMeta();
    expect(findTitle(aboutMeta)).toBe(ABOUT_DOCUMENT_TITLE);
    expect(findCanonical(aboutMeta)).toBe("https://teyvat-bunko.com/about");
    expect(findMetaContent(aboutMeta, "property", "og:image")).toBe(
      "https://teyvat-bunko.com/og/about.png"
    );
    const aboutLd = findLdJson(aboutMeta) as { "@graph": Array<Record<string, unknown>> };
    expect(aboutLd["@graph"].map((node) => node["@type"])).toEqual(["BreadcrumbList", "AboutPage"]);

    const notFoundMeta = buildNotFoundMeta("page");
    expect(findTitle(notFoundMeta)).toBe("ページが見つかりません｜テイワット文庫");
    expect(findMetaContent(notFoundMeta, "name", "robots")).toBe("noindex, nofollow");
    expect(findCanonical(notFoundMeta)).toBeUndefined();
    expect(findMetaContent(notFoundMeta, "property", "og:image")).toBeUndefined();
    expect(findLdJson(notFoundMeta)).toBeUndefined();
  });

  it("builds courses index and course detail metadata with ItemList, BreadcrumbList, OGP, and course 404 fallback", () => {
    const sampleCourse: CourseIndexItem = {
      id: "rosalyne_chronicle",
      kind: "character",
      badge: "キャラ別・500年の軌跡",
      title: "ロザリン（淑女）とルースタンの500年",
      subtitle: "歌と炎を愛した少女が『淑女』に至るまで",
      hook: "西風騎士団の騎士と炎の魔女の物語を時系列で追う。",
      storyIds: ["elegy", "crimson_witch"],
      steps: [
        { storyId: "elegy", note: "1話目" },
        { storyId: "crimson_witch", note: "2話目" },
      ],
      storyCount: 2,
      totalCharCount: 1661,
      totalReadingTime: "約3分",
    };

    const indexData: StoriesIndexData = {
      generatedAt: "2026-11-22T00:00:00.000Z",
      totalCount: 2,
      categoryCounts: { book: 0, artifact: 1, weapon: 1, attire: 0, chronicle: 0 },
      entitiesIndex: {},
      stories: [
        {
          id: "elegy",
          title: "終焉を嘆く詩",
          shelfCategory: "weapon",
          categoryLabel: "武器",
          region: ["モンド"],
          era: "500年前",
          readingTime: "約1分",
          charCount: 602,
          hook: "h",
          tags: [],
        },
        {
          id: "crimson_witch",
          title: "燃え盛る炎の魔女",
          shelfCategory: "artifact",
          categoryLabel: "聖遺物",
          region: ["モンド"],
          era: "500年前",
          readingTime: "約2分",
          charCount: 1059,
          hook: "h2",
          tags: [],
        },
      ],
      courses: [sampleCourse],
    };

    const coursesMeta = buildCoursesMeta({ indexData });
    expect(findTitle(coursesMeta)).toBe(COURSES_DOCUMENT_TITLE);
    expect(findCanonical(coursesMeta)).toBe("https://teyvat-bunko.com/courses");
    expect(findMetaContent(coursesMeta, "property", "og:image")).toBe(
      "https://teyvat-bunko.com/og/courses.png"
    );
    const coursesLd = findLdJson(coursesMeta) as { "@graph": Array<Record<string, unknown>> };
    expect(coursesLd["@graph"].map((n) => n["@type"])).toEqual(["BreadcrumbList", "CollectionPage"]);

    const detailMeta = buildCourseDetailMeta({ course: sampleCourse, indexData });
    expect(findTitle(detailMeta)).toBe(
      "【原神】読書コース「ロザリン（淑女）とルースタンの500年」（全2篇）｜テイワット文庫"
    );
    expect(findCanonical(detailMeta)).toBe(
      "https://teyvat-bunko.com/courses/rosalyne_chronicle"
    );
    expect(findMetaContent(detailMeta, "property", "og:image")).toBe(
      "https://teyvat-bunko.com/og/course/rosalyne_chronicle.png"
    );
    const detailLd = findLdJson(detailMeta) as { "@graph": Array<Record<string, unknown>> };
    expect(detailLd["@graph"].map((n) => n["@type"])).toEqual(["BreadcrumbList", "CollectionPage"]);
    expect(detailLd["@graph"][1].mainEntity).toMatchObject({
      "@type": "ItemList",
      numberOfItems: 2,
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "終焉を嘆く詩", url: "https://teyvat-bunko.com/story/elegy" },
        {
          "@type": "ListItem",
          position: 2,
          name: "燃え盛る炎の魔女",
          url: "https://teyvat-bunko.com/story/crimson_witch",
        },
      ],
    });

    const missingCourseMeta = buildCourseDetailMeta({ course: null, indexData });
    expect(findTitle(missingCourseMeta)).toBe("読書コースが見つかりません｜テイワット文庫");
    expect(findMetaContent(missingCourseMeta, "name", "robots")).toBe("noindex, nofollow");
  });
});
