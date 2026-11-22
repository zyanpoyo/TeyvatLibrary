import type { StoriesIndexData, StoryDetail } from "../types/story";

export function loadDistStoriesIndex(rootDir?: string): StoriesIndexData;

export function loadDistStoryDetail(
  storyId: string | undefined,
  rootDir?: string
): StoryDetail | null;

export function listPrerenderStoryPaths(rootDir?: string): string[];
