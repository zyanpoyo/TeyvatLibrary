import { resolveReadingStateReader, type ReadingStateInput } from "./catalog";
import type {
  CourseIndexItem,
  CourseKind,
  StoriesIndexData,
  StoryCourseMembership,
  StoryCourseStepRef,
  StoryDetail,
  StoryIndexItem,
} from "../types/story";

export const COURSE_KIND_ORDER: ReadonlyArray<CourseKind> = ["beginner", "character", "arc"];

export const COURSE_KIND_LABELS: Record<CourseKind, { label: string; heading: string }> = {
  beginner: { label: "入門・必読", heading: "入門・必読コース" },
  character: { label: "キャラクター別", heading: "キャラクター別コース" },
  arc: { label: "地域・歴史別", heading: "地域・歴史別コース" },
};

export interface CourseProgress {
  readCount: number;
  totalCount: number;
  progressPercent: number;
  isCompleted: boolean;
  nextUnreadStepIndex: number;
  nextUnreadStoryId: string | null;
  ctaLabel: string;
}

export interface CourseWithProgress {
  course: CourseIndexItem;
  progress: CourseProgress;
}

export interface CourseKindGroup {
  kind: CourseKind;
  label: string;
  heading: string;
  items: CourseWithProgress[];
}

export interface CourseDetailStepView {
  stepIndex: number;
  stepNumber: number;
  storyId: string;
  note: string;
  story: StoryIndexItem | null;
  isRead: boolean;
  isBookmarked: boolean;
  isNextUnread: boolean;
}

export interface CourseDetailViewModel {
  course: CourseIndexItem;
  progress: CourseProgress;
  steps: CourseDetailStepView[];
  relatedCourses: CourseWithProgress[];
}

export interface ResolvedReaderUnreadStep extends StoryCourseStepRef {
  stepIndex: number;
}

export interface ResolvedReaderCourse extends StoryCourseMembership {
  readCount: number;
  isAllRead: boolean;
  firstUnreadOtherStep: ResolvedReaderUnreadStep | null;
}

export interface ReaderCourseContext {
  activeCourse: ResolvedReaderCourse | null;
  otherCourses: ResolvedReaderCourse[];
  memberships: ResolvedReaderCourse[];
}

function getCourseStoryIds(course: Pick<CourseIndexItem, "storyIds" | "steps">): string[] {
  if (Array.isArray(course.storyIds) && course.storyIds.length > 0) {
    return course.storyIds;
  }
  return (course.steps ?? []).map((s) => s.storyId);
}

/**
 * コース単位の読了数・達成率・次に読む未読話・CTA文言を導出する。
 */
export function deriveCourseProgress(
  course: Pick<CourseIndexItem, "storyIds" | "steps">,
  readingState: ReadingStateInput = null
): CourseProgress {
  const reader = resolveReadingStateReader(readingState);
  const storyIds = getCourseStoryIds(course);
  const totalCount = storyIds.length;

  let readCount = 0;
  let firstUnreadIdx = -1;
  for (let i = 0; i < totalCount; i += 1) {
    if (reader?.isRead(storyIds[i])) {
      readCount += 1;
    } else if (firstUnreadIdx === -1) {
      firstUnreadIdx = i;
    }
  }

  const progressPercent = totalCount > 0 ? Math.round((readCount / totalCount) * 100) : 0;
  const isCompleted = totalCount > 0 && readCount >= totalCount;
  const nextUnreadStepIndex = firstUnreadIdx >= 0 ? firstUnreadIdx : 0;
  const nextUnreadStoryId = totalCount > 0 ? (storyIds[nextUnreadStepIndex] ?? null) : null;

  let ctaLabel = "第1話から読む";
  if (isCompleted) {
    ctaLabel = "第1話から読み直す";
  } else if (readCount > 0) {
    ctaLabel = `続き（第${nextUnreadStepIndex + 1}話）から読む`;
  }

  return {
    readCount,
    totalCount,
    progressPercent,
    isCompleted,
    nextUnreadStepIndex,
    nextUnreadStoryId,
    ctaLabel,
  };
}

/**
 * 書架トップのフェア棚向けに featured コースを優先し最大 limit 件を選出する。
 */
export function selectFeaturedCourses(
  courses: ReadonlyArray<CourseIndexItem> | null | undefined,
  limit = 3
): CourseIndexItem[] {
  const list = courses ?? [];
  if (list.length === 0 || limit <= 0) return [];

  const featured = list.filter((c) => Boolean(c.featured));
  const rest = list.filter((c) => !c.featured);
  return [...featured, ...rest].slice(0, limit);
}

/**
 * コース一覧画面向けに、kind 別のグループと各コースの進捗を導出する。
 */
export function groupCoursesByKind(
  courses: ReadonlyArray<CourseIndexItem> | null | undefined,
  readingState: ReadingStateInput = null,
  kindFilter: "all" | CourseKind = "all"
): CourseKindGroup[] {
  const list = courses ?? [];
  const groups: CourseKindGroup[] = [];

  for (const kind of COURSE_KIND_ORDER) {
    if (kindFilter !== "all" && kind !== kindFilter) continue;
    const matched = list.filter((course) => course.kind === kind);
    if (matched.length === 0) continue;

    groups.push({
      kind,
      label: COURSE_KIND_LABELS[kind].label,
      heading: COURSE_KIND_LABELS[kind].heading,
      items: matched.map((course) => ({
        course,
        progress: deriveCourseProgress(course, readingState),
      })),
    });
  }

  return groups;
}

/**
 * コース詳細画面向けのステップ一覧・読書状態・関連コース一式を導出する。
 */
export function deriveCourseDetailView(
  course: CourseIndexItem,
  indexData: StoriesIndexData | null,
  readingState: ReadingStateInput = null
): CourseDetailViewModel {
  const reader = resolveReadingStateReader(readingState);
  const progress = deriveCourseProgress(course, reader);
  const storyMap = new Map((indexData?.stories ?? []).map((s) => [s.id, s]));

  const steps: CourseDetailStepView[] = course.steps.map((step, index) => ({
    stepIndex: index,
    stepNumber: index + 1,
    storyId: step.storyId,
    note: step.note,
    story: storyMap.get(step.storyId) ?? null,
    isRead: Boolean(reader?.isRead(step.storyId)),
    isBookmarked: Boolean(reader?.isBookmarked?.(step.storyId)),
    isNextUnread: !progress.isCompleted && progress.nextUnreadStoryId === step.storyId,
  }));

  const otherCourses = (indexData?.courses ?? []).filter((c) => c.id !== course.id);
  const sameKind = otherCourses.filter((c) => c.kind === course.kind);
  const diffKind = otherCourses.filter((c) => c.kind !== course.kind);
  const relatedCourses = [...sameKind, ...diffKind].slice(0, 3).map((c) => ({
    course: c,
    progress: deriveCourseProgress(c, reader),
  }));

  return {
    course,
    progress,
    steps,
    relatedCourses,
  };
}

function buildMembershipsFromIndex(
  storyId: string,
  indexData: StoriesIndexData | null
): StoryCourseMembership[] {
  if (!storyId || !indexData?.courses?.length) return [];
  const storyMap = new Map((indexData.stories ?? []).map((s) => [s.id, s]));
  const memberships: StoryCourseMembership[] = [];

  for (const course of indexData.courses) {
    const stepIndex = course.steps.findIndex((s) => s.storyId === storyId);
    if (stepIndex === -1) continue;

    const stepsSummary: StoryCourseStepRef[] = course.steps.map((s) => ({
      storyId: s.storyId,
      title: storyMap.get(s.storyId)?.title || s.storyId,
    }));

    memberships.push({
      courseId: course.id,
      kind: course.kind,
      badge: course.badge,
      title: course.title,
      stepIndex,
      totalSteps: stepsSummary.length,
      prevStep: stepIndex > 0 ? stepsSummary[stepIndex - 1] : null,
      nextStep: stepIndex < stepsSummary.length - 1 ? stepsSummary[stepIndex + 1] : null,
      steps: stepsSummary,
    });
  }

  return memberships;
}

/**
 * リーダー画面向けに、進行中コース（?course= 一致）と他所属コース・単品所属コース群を解決する。
 */
export function deriveReaderCourseContext({
  story,
  indexData = null,
  activeCourseId = null,
  readingState = null,
}: {
  story: Pick<StoryDetail, "id" | "courses"> | null;
  indexData?: StoriesIndexData | null;
  activeCourseId?: string | null;
  readingState?: ReadingStateInput;
}): ReaderCourseContext {
  if (!story) {
    return { activeCourse: null, otherCourses: [], memberships: [] };
  }

  const reader = resolveReadingStateReader(readingState);
  const rawMemberships =
    story.courses && story.courses.length > 0
      ? story.courses
      : buildMembershipsFromIndex(story.id, indexData);

  const resolved: ResolvedReaderCourse[] = rawMemberships.map((m) => {
    let readCount = 0;
    let firstUnreadOtherStep: ResolvedReaderUnreadStep | null = null;

    m.steps.forEach((step, idx) => {
      const read = Boolean(reader?.isRead(step.storyId));
      if (read) {
        readCount += 1;
      } else if (!firstUnreadOtherStep && step.storyId !== story.id) {
        firstUnreadOtherStep = { ...step, stepIndex: idx };
      }
    });

    return {
      ...m,
      readCount,
      isAllRead: m.totalSteps > 0 && readCount >= m.totalSteps,
      firstUnreadOtherStep,
    };
  });

  if (activeCourseId) {
    const matched = resolved.find((m) => m.courseId === activeCourseId) ?? null;
    if (matched) {
      return {
        activeCourse: matched,
        otherCourses: resolved.filter((m) => m.courseId !== activeCourseId),
        memberships: resolved,
      };
    }
  }

  return {
    activeCourse: null,
    otherCourses: [],
    memberships: resolved,
  };
}
