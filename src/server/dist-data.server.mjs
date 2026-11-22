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
