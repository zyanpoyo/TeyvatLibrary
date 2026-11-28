import { describe, expect, it } from "vitest";
import {
  deriveEntitiesArchiveView,
  deriveEntityDetailView,
  deriveEntityProgress,
  ENTITY_KIND_LABELS,
  ENTITY_KIND_ORDER,
  normalizeEntitiesFromIndex,
} from "../src/domain/entities";
import type { StoriesIndexData } from "../src/types/story";

function createSampleIndexData(): StoriesIndexData {
  return {
    generatedAt: "2026-11-28T00:00:00.000Z",
    totalCount: 3,
    categoryCounts: {
      book: 1,
      artifact: 1,
      weapon: 1,
      attire: 0,
      chronicle: 0,
    },
    entitiesIndex: {
      rosalyne: {
        name: "ロザリン（淑女）",
        kind: "character",
        defaultIdentity: "正体：ファデュイ執行官第八位『淑女』",
        defaultDesc: "500年前のモンド出身の魔女。スメール教令院への留学経験を持つ。",
        defaultEvidence: "聖遺物『燃え盛る炎の魔女』・武器『終焉を嘆く詩』",
        evidenceLinks: [
          { title: "燃え盛る炎の魔女", storyId: "crimson_witch" },
          { title: "終焉を嘆く詩", storyId: "elegy" },
        ],
        storyIds: ["crimson_witch", "elegy"],
      },
      rostam: {
        name: "ルースタン",
        kind: "character",
        defaultIdentity: "正体：西風騎士団の騎士「幼い狼」",
        defaultDesc: "500年前のモンドを守り抜いた騎士。",
        defaultEvidence: "武器『終焉を嘆く詩』",
        evidenceLinks: [{ title: "終焉を嘆く詩", storyId: "elegy" }],
        storyIds: ["elegy"],
      },
      orobashi: {
        name: "オロバシノミコト",
        kind: "god",
        defaultIdentity: "正体：海祇大御神",
        defaultDesc: "白夜国の民を救い海祇島へ導いた白蛇の魔神。",
        defaultEvidence: "書籍『白夜国館蔵』",
        evidenceLinks: [{ title: "白夜国館蔵", storyId: "byakuyakoku" }],
        storyIds: ["byakuyakoku"],
      },
      fatui: {
        name: "ファデュイ",
        kind: "organization",
        defaultIdentity: "解説：氷の女皇直属の外交組織",
        defaultDesc: "スネージナヤを拠点とする執行官たちの組織。",
        defaultEvidence: "聖遺物『燃え盛る炎の魔女』",
        storyIds: ["crimson_witch"],
      },
    },
    stories: [
      {
        id: "byakuyakoku",
        title: "白夜国館蔵",
        shelfCategory: "book",
        categoryLabel: "書籍",
        region: ["稲妻（淵下宮）"],
        era: "白夜国時代",
        readingTime: "約10分",
        charCount: 5000,
        hook: "深海の年代記。",
        tags: [],
        entityIds: ["orobashi"],
      },
      {
        id: "crimson_witch",
        title: "燃え盛る炎の魔女",
        shelfCategory: "artifact",
        categoryLabel: "聖遺物",
        region: ["モンド", "スメール"],
        era: "500年前",
        readingTime: "約3分",
        charCount: 1200,
        hook: "炎の魔女の記憶。",
        tags: [],
        entityIds: ["rosalyne", "fatui"],
      },
      {
        id: "elegy",
        title: "終焉を嘆く詩",
        shelfCategory: "weapon",
        categoryLabel: "武器",
        region: ["モンド"],
        era: "500年前",
        readingTime: "約2分",
        charCount: 800,
        hook: "騎士の最期。",
        tags: [],
        entityIds: ["rosalyne", "rostam"],
      },
    ],
    courses: [
      {
        id: "course_mondstadt",
        kind: "character",
        badge: "キャラ別",
        title: "炎の魔女と騎士",
        subtitle: "モンド500年前",
        hook: "表裏2部作。",
        storyIds: ["crimson_witch", "elegy"],
        steps: [
          { storyId: "crimson_witch", note: "1" },
          { storyId: "elegy", note: "2" },
        ],
        storyCount: 2,
        totalCharCount: 2000,
        totalReadingTime: "約5分",
      },
      {
        id: "course_beginner",
        kind: "beginner",
        badge: "入門",
        title: "入門コース",
        subtitle: "まず読む作品",
        hook: "厳選。",
        storyIds: ["byakuyakoku", "crimson_witch"],
        steps: [
          { storyId: "byakuyakoku", note: "1" },
          { storyId: "crimson_witch", note: "2" },
        ],
        storyCount: 2,
        totalCharCount: 6200,
        totalReadingTime: "約13分",
      },
    ],
  };
}

describe("entities domain helpers", () => {
  it("normalizes entitiesIndex entries and handles missing optional fields safely", () => {
    const partialIndex: StoriesIndexData = {
      generatedAt: "",
      totalCount: 0,
      categoryCounts: { book: 0, artifact: 0, weapon: 0, attire: 0, chronicle: 0 },
      entitiesIndex: {
        minimal: {
          name: "最小定義",
          kind: "concept",
          storyIds: ["s1", "s1", ""],
        },
      },
      stories: [],
    };

    const list = normalizeEntitiesFromIndex(partialIndex);
    expect(list).toEqual([
      {
        id: "minimal",
        name: "最小定義",
        kind: "concept",
        storyIds: ["s1"],
        defaultIdentity: "",
        defaultDesc: "",
        defaultEvidence: "",
        evidenceLinks: [],
      },
    ]);
    expect(ENTITY_KIND_ORDER).toEqual(["character", "god", "organization", "concept", "place"]);
    expect(ENTITY_KIND_LABELS.god.label).toBe("魔神・執政");
  });

  it("derives entity reading progress across unread, in-progress, completed, and empty states", () => {
    expect(deriveEntityProgress([], null)).toEqual({
      readCount: 0,
      totalCount: 0,
      progressPercent: 0,
      isCompleted: false,
      nextUnreadStoryId: null,
      ctaLabel: "",
    });

    expect(deriveEntityProgress(["crimson_witch", "elegy"], null)).toEqual({
      readCount: 0,
      totalCount: 2,
      progressPercent: 0,
      isCompleted: false,
      nextUnreadStoryId: "crimson_witch",
      ctaLabel: "最初の物語を読む",
    });

    expect(
      deriveEntityProgress(["crimson_witch", "elegy"], {
        readStories: { crimson_witch: { readAt: "2026-11-28T00:00:00.000Z" } },
        bookmarks: [],
        lastSession: null,
      })
    ).toEqual({
      readCount: 1,
      totalCount: 2,
      progressPercent: 50,
      isCompleted: false,
      nextUnreadStoryId: "elegy",
      ctaLabel: "次の未読作品を読む",
    });

    expect(
      deriveEntityProgress(["crimson_witch", "elegy"], {
        readStories: {
          crimson_witch: { readAt: "2026-11-28T00:00:00.000Z" },
          elegy: { readAt: "2026-11-28T00:05:00.000Z" },
        },
        bookmarks: [],
        lastSession: null,
      })
    ).toEqual({
      readCount: 2,
      totalCount: 2,
      progressPercent: 100,
      isCompleted: true,
      nextUnreadStoryId: "crimson_witch",
      ctaLabel: "最初の物語から読み直す",
    });
  });

  it("derives archive view with non-empty availableKinds, normalized AND search, kind filter, and sorting", () => {
    const indexData = createSampleIndexData();

    const defaultView = deriveEntitiesArchiveView({ indexData });
    expect(defaultView.totalCount).toBe(4);
    expect(defaultView.filteredCount).toBe(4);
    expect(defaultView.hasActiveFilter).toBe(false);
    // concept / place は 0 件のため availableKinds に含まれない
    expect(defaultView.availableKinds).toEqual(["character", "god", "organization"]);
    expect(defaultView.kindCounts).toEqual({
      all: 4,
      character: 2,
      god: 1,
      organization: 1,
      concept: 0,
      place: 0,
    });
    expect(defaultView.groups.map((g) => g.kind)).toEqual(["character", "god", "organization"]);
    // character グループは登場作品数降順（ロザリン 2篇 → ルースタン 1篇）
    expect(defaultView.groups[0].items.map((item) => item.entity.id)).toEqual([
      "rosalyne",
      "rostam",
    ]);
    expect(defaultView.groups[0].items[0].regions).toEqual(["モンド", "スメール"]);

    // カタカナ/ひらがな正規化 ＋ 作品タイトル・解説横断のスペース区切り AND 検索
    const searched = deriveEntitiesArchiveView({
      indexData,
      query: "ろざりん　教令院",
    });
    expect(searched.hasActiveFilter).toBe(true);
    expect(searched.filteredCount).toBe(1);
    expect(searched.groups[0].items[0].entity.id).toBe("rosalyne");

    // 登場作品タイトルでの検索も一致すること
    const byStoryTitle = deriveEntitiesArchiveView({
      indexData,
      query: "白夜国館蔵",
    });
    expect(byStoryTitle.filteredCount).toBe(1);
    expect(byStoryTitle.groups[0].items[0].entity.id).toBe("orobashi");

    // 五十音順ソート（ルースタン → ロザリン）
    const sortedByName = deriveEntitiesArchiveView({
      indexData,
      kindFilter: "character",
      sort: "name",
    });
    expect(sortedByName.groups).toHaveLength(1);
    expect(sortedByName.groups[0].items.map((i) => i.entity.id)).toEqual(["rostam", "rosalyne"]);
  });

  it("derives entity detail view with ordered stories, related courses, co-occurring entities, and null for unknown id", () => {
    const indexData = createSampleIndexData();
    const readingState = {
      readStories: { crimson_witch: { readAt: "2026-11-28T00:00:00.000Z" } },
      bookmarks: ["elegy"],
      lastSession: null,
    };

    const detail = deriveEntityDetailView({
      entityId: "rosalyne",
      indexData,
      readingState,
    });

    expect(detail).not.toBeNull();
    if (!detail) return;

    expect(detail.progress).toEqual({
      readCount: 1,
      totalCount: 2,
      progressPercent: 50,
      isCompleted: false,
      nextUnreadStoryId: "elegy",
      ctaLabel: "次の未読作品を読む",
    });

    expect(detail.stories.map((s) => s.storyId)).toEqual(["crimson_witch", "elegy"]);
    expect(detail.stories[0]).toMatchObject({
      storyId: "crimson_witch",
      isRead: true,
      isBookmarked: false,
      isNextUnread: false,
    });
    expect(detail.stories[1]).toMatchObject({
      storyId: "elegy",
      isRead: false,
      isBookmarked: true,
      isNextUnread: true,
    });

    // 関連コースは重複作品数の多い順（course_mondstadt: 2篇 → course_beginner: 1篇）
    expect(detail.relatedCourses.map((c) => c.course.id)).toEqual([
      "course_mondstadt",
      "course_beginner",
    ]);
    expect(detail.relatedCourses[0].overlapCount).toBe(2);
    expect(detail.relatedCourses[0].progress.readCount).toBe(1);

    // 共起エンティティ（fatui と rostam が各1篇で共演、五十音順で ファデュイ → ルースタン）
    expect(detail.relatedEntities.map((r) => r.entity.id)).toEqual(["fatui", "rostam"]);
    expect(detail.relatedEntities[0].sharedStoryCount).toBe(1);

    expect(
      deriveEntityDetailView({
        entityId: "rosalyne",
        indexData,
        readingState,
        relatedEntityLimit: 1,
      })?.relatedEntities
    ).toHaveLength(1);

    expect(
      deriveEntityDetailView({
        entityId: "nonexistent_entity",
        indexData,
        readingState,
      })
    ).toBeNull();

    // Object.prototype 由来のプロパティ名（constructor / toString 等）も未知 ID として安全に null を返すこと
    for (const protoId of ["constructor", "toString", "valueOf"]) {
      expect(
        deriveEntityDetailView({
          entityId: protoId,
          indexData,
          readingState,
        })
      ).toBeNull();
    }
  });
});
