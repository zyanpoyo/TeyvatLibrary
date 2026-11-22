import { describe, expect, it } from "vitest";
import {
  deriveCourseDetailView,
  deriveCourseProgress,
  deriveReaderCourseContext,
  groupCoursesByKind,
  selectFeaturedCourses,
} from "../src/domain/courses";
import { buildReaderStoryPath, parseReaderCourseParam } from "../src/router/search-params";
import type { CourseIndexItem, ReadingStateSnapshot, StoriesIndexData } from "../src/types/story";

const COURSES: CourseIndexItem[] = [
  {
    id: "beginner_pack",
    kind: "beginner",
    badge: "必読入門",
    title: "入門セット",
    subtitle: "最初の2本",
    hook: "まずはここから。",
    featured: true,
    storyIds: ["s1", "s2"],
    steps: [
      { storyId: "s1", note: "1話目" },
      { storyId: "s2", note: "2話目" },
    ],
    storyCount: 2,
    totalCharCount: 1100,
    totalReadingTime: "約2分",
  },
  {
    id: "rosalyne_pack",
    kind: "character",
    badge: "キャラ別",
    title: "ロザリンの物語",
    subtitle: "3話セット",
    hook: "500年の軌跡。",
    featured: false,
    storyIds: ["s2", "s3", "s4"],
    steps: [
      { storyId: "s2", note: "1話目" },
      { storyId: "s3", note: "2話目" },
      { storyId: "s4", note: "3話目" },
    ],
    storyCount: 3,
    totalCharCount: 2200,
    totalReadingTime: "約4分",
  },
  {
    id: "genesis_pack",
    kind: "arc",
    badge: "創世記",
    title: "創世記セット",
    subtitle: "太古から",
    hook: "世界の起源。",
    featured: true,
    storyIds: ["s1", "s4"],
    steps: [
      { storyId: "s1", note: "1話目" },
      { storyId: "s4", note: "2話目" },
    ],
    storyCount: 2,
    totalCharCount: 1500,
    totalReadingTime: "約3分",
  },
  {
    id: "fontaine_pack",
    kind: "arc",
    badge: "フォンテーヌ",
    title: "水仙十字院",
    subtitle: "孤児たちの記録",
    hook: "500年前の約束。",
    featured: true,
    storyIds: ["s3"],
    steps: [{ storyId: "s3", note: "1話目" }],
    storyCount: 1,
    totalCharCount: 800,
    totalReadingTime: "約1分",
  },
];

const MOCK_INDEX: StoriesIndexData = {
  generatedAt: "2026-11-22T00:00:00.000Z",
  totalCount: 4,
  categoryCounts: { book: 1, artifact: 1, weapon: 1, attire: 1, chronicle: 0 },
  entitiesIndex: {},
  stories: [
    {
      id: "s1",
      title: "物語1",
      shelfCategory: "weapon",
      categoryLabel: "武器",
      region: ["モンド"],
      era: "500年前",
      readingTime: "約1分",
      charCount: 500,
      hook: "h1",
      tags: [],
    },
    {
      id: "s2",
      title: "物語2",
      shelfCategory: "artifact",
      categoryLabel: "聖遺物",
      region: ["モンド"],
      era: "500年前",
      readingTime: "約1分",
      charCount: 600,
      hook: "h2",
      tags: [],
    },
    {
      id: "s3",
      title: "物語3",
      shelfCategory: "book",
      categoryLabel: "書籍",
      region: ["フォンテーヌ"],
      era: "500年前",
      readingTime: "約2分",
      charCount: 800,
      hook: "h3",
      tags: [],
    },
    {
      id: "s4",
      title: "物語4",
      shelfCategory: "attire",
      categoryLabel: "風の翼",
      region: ["スネージナヤ"],
      era: "現代",
      readingTime: "約2分",
      charCount: 900,
      hook: "h4",
      tags: [],
    },
  ],
  courses: COURSES,
};

function makeState(readIds: string[], bookmarks: string[] = []): ReadingStateSnapshot {
  return {
    readStories: Object.fromEntries(readIds.map((id) => [id, { readAt: "2026-11-22T00:00:00.000Z" }])),
    bookmarks,
    lastSession: null,
  };
}

describe("courses domain & search params", () => {
  it("calculates progress, next unread story, and CTA labels across unread / partial / completed states", () => {
    const course = COURSES[1]; // s2, s3, s4

    expect(deriveCourseProgress(course, makeState([]))).toEqual({
      readCount: 0,
      totalCount: 3,
      progressPercent: 0,
      isCompleted: false,
      nextUnreadStepIndex: 0,
      nextUnreadStoryId: "s2",
      ctaLabel: "第1話から読む",
    });

    expect(deriveCourseProgress(course, makeState(["s2"]))).toEqual({
      readCount: 1,
      totalCount: 3,
      progressPercent: 33,
      isCompleted: false,
      nextUnreadStepIndex: 1,
      nextUnreadStoryId: "s3",
      ctaLabel: "続き（第2話）から読む",
    });

    // 1話目と3話目が読了済みでも、未読先頭の第2話を「続き」として案内する
    expect(deriveCourseProgress(course, makeState(["s2", "s4"]))).toEqual({
      readCount: 2,
      totalCount: 3,
      progressPercent: 67,
      isCompleted: false,
      nextUnreadStepIndex: 1,
      nextUnreadStoryId: "s3",
      ctaLabel: "続き（第2話）から読む",
    });

    expect(deriveCourseProgress(course, makeState(["s2", "s3", "s4"]))).toEqual({
      readCount: 3,
      totalCount: 3,
      progressPercent: 100,
      isCompleted: true,
      nextUnreadStepIndex: 0,
      nextUnreadStoryId: "s2",
      ctaLabel: "第1話から読み直す",
    });
  });

  it("selects featured courses first up to limit and groups courses by kind", () => {
    expect(selectFeaturedCourses(COURSES, 3).map((c) => c.id)).toEqual([
      "beginner_pack",
      "genesis_pack",
      "fontaine_pack",
    ]);

    const allGroups = groupCoursesByKind(COURSES, makeState(["s1"]), "all");
    expect(allGroups.map((g) => g.kind)).toEqual(["beginner", "character", "arc"]);
    expect(allGroups[0].items[0].progress.readCount).toBe(1);

    const arcOnly = groupCoursesByKind(COURSES, makeState([]), "arc");
    expect(arcOnly).toHaveLength(1);
    expect(arcOnly[0].items.map((i) => i.course.id)).toEqual(["genesis_pack", "fontaine_pack"]);
  });

  it("derives course detail view with resolved stories, next-unread highlight, and related courses", () => {
    const view = deriveCourseDetailView(COURSES[1], MOCK_INDEX, makeState(["s2"], ["s3"]));
    expect(view.steps.map((s) => ({ id: s.storyId, read: s.isRead, next: s.isNextUnread, bm: s.isBookmarked }))).toEqual([
      { id: "s2", read: true, next: false, bm: false },
      { id: "s3", read: false, next: true, bm: true },
      { id: "s4", read: false, next: false, bm: false },
    ]);
    expect(view.steps[0].story?.title).toBe("物語2");
    expect(view.relatedCourses).toHaveLength(3);
  });

  it("resolves reader course context for course-via, mismatched/invalid courseId, and standalone visits", () => {
    // s2 は beginner_pack と rosalyne_pack に重複所属
    const viaRosalyne = deriveReaderCourseContext({
      story: { id: "s2" },
      indexData: MOCK_INDEX,
      activeCourseId: "rosalyne_pack",
      readingState: makeState(["s2"]),
    });
    expect(viaRosalyne.activeCourse?.courseId).toBe("rosalyne_pack");
    expect(viaRosalyne.activeCourse?.stepIndex).toBe(0);
    expect(viaRosalyne.activeCourse?.nextStep).toEqual({ storyId: "s3", title: "物語3" });
    expect(viaRosalyne.otherCourses.map((c) => c.courseId)).toEqual(["beginner_pack"]);

    // 最終話 s4 閲覧時：他の話に未読（s3）があるケース
    const lastStepPartial = deriveReaderCourseContext({
      story: { id: "s4" },
      indexData: MOCK_INDEX,
      activeCourseId: "rosalyne_pack",
      readingState: makeState(["s2", "s4"]),
    });
    expect(lastStepPartial.activeCourse?.nextStep).toBeNull();
    expect(lastStepPartial.activeCourse?.isAllRead).toBe(false);
    expect(lastStepPartial.activeCourse?.firstUnreadOtherStep).toEqual({
      storyId: "s3",
      title: "物語3",
      stepIndex: 1,
    });

    // 最終話 s4 閲覧時：他話全部読了＋s4自身のみ未読のケース（自己リンクループにならないこと）
    const lastStepOnlySelfUnread = deriveReaderCourseContext({
      story: { id: "s4" },
      indexData: MOCK_INDEX,
      activeCourseId: "rosalyne_pack",
      readingState: makeState(["s2", "s3"]),
    });
    expect(lastStepOnlySelfUnread.activeCourse?.isAllRead).toBe(false);
    expect(lastStepOnlySelfUnread.activeCourse?.firstUnreadOtherStep).toBeNull();

    // 不正・非所属の courseId の場合は単品アクセスにフォールバック
    const mismatched = deriveReaderCourseContext({
      story: { id: "s2" },
      indexData: MOCK_INDEX,
      activeCourseId: "fontaine_pack",
      readingState: makeState([]),
    });
    expect(mismatched.activeCourse).toBeNull();
    expect(mismatched.memberships.map((m) => m.courseId)).toEqual(["beginner_pack", "rosalyne_pack"]);
  });

  it("parses and builds ?course= reader paths safely", () => {
    expect(parseReaderCourseParam("?course=rosalyne_chronicle")).toBe("rosalyne_chronicle");
    expect(parseReaderCourseParam("?course=bad-id!")).toBeNull();
    expect(parseReaderCourseParam("")).toBeNull();

    expect(buildReaderStoryPath("crimson_witch", { courseId: "rosalyne_chronicle" })).toBe(
      "/story/crimson_witch?course=rosalyne_chronicle"
    );
    expect(buildReaderStoryPath("crimson_witch", { courseId: "bad-id!" })).toBe(
      "/story/crimson_witch"
    );
  });
});
