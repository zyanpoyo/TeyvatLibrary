import fs from "node:fs";
import path from "node:path";

const VALID_STORY_ID_PATTERN = /^[a-z0-9_-]+$/i;

/**
 * 配信済みの書架インデックス JSON（public/data/stories-index.json）を読み込む。
 */
export function loadDistStoriesIndex(rootDir = process.cwd()) {
  const indexPath = path.join(rootDir, "public", "data", "stories-index.json");
  if (!fs.existsSync(indexPath)) {
    throw new Error(
      `配信用インデックスが見つかりません: ${indexPath}（先に npm run build:data を実行してください）`
    );
  }
  return JSON.parse(fs.readFileSync(indexPath, "utf8"));
}

/**
 * 指定された storyId に対応する配信済み作品詳細 JSON を読み込む。存在しない場合は null を返す。
 */
export function loadDistStoryDetail(storyId, rootDir = process.cwd()) {
  if (typeof storyId !== "string" || !VALID_STORY_ID_PATTERN.test(storyId)) {
    return null;
  }
  const detailPath = path.join(rootDir, "public", "data", "stories", `${storyId}.json`);
  if (!fs.existsSync(detailPath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(detailPath, "utf8"));
}

/**
 * 静的プリレンダリング対象となる全物語のパス一覧（/story/<id>）を返す。
 */
export function listPrerenderStoryPaths(rootDir = process.cwd()) {
  const indexData = loadDistStoriesIndex(rootDir);
  return (indexData.stories ?? []).map((story) => `/story/${story.id}`);
}

/**
 * 静的プリレンダリング対象となる全読書コースのパス一覧（/courses/<id>）を返す。
 */
export function listPrerenderCoursePaths(rootDir = process.cwd()) {
  const indexData = loadDistStoriesIndex(rootDir);
  return (indexData.courses ?? []).map((course) => `/courses/${course.id}`);
}

/**
 * 指定された courseId に対応する読書コースとインデックス一式を返す。存在しない場合は null を返す。
 */
export function loadDistCourseDetail(courseId, rootDir = process.cwd()) {
  if (typeof courseId !== "string" || !VALID_STORY_ID_PATTERN.test(courseId)) {
    return null;
  }
  const indexData = loadDistStoriesIndex(rootDir);
  const course = (indexData.courses ?? []).find((c) => c.id === courseId) ?? null;
  if (!course) {
    return null;
  }
  return { course, indexData };
}
