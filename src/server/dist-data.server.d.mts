import type { CourseIndexItem, StoriesIndexData, StoryDetail } from "../types/story";

export function loadDistStoriesIndex(rootDir?: string): StoriesIndexData;

export function loadDistStoryDetail(
  storyId: string | undefined,
  rootDir?: string
): StoryDetail | null;

export function listPrerenderStoryPaths(rootDir?: string): string[];

export function listPrerenderCoursePaths(rootDir?: string): string[];

export function loadDistCourseDetail(
  courseId: string | undefined,
  rootDir?: string
): { course: CourseIndexItem; indexData: StoriesIndexData } | null;
