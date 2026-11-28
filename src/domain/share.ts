import { buildAbsoluteUrl, getConfiguredSiteUrl } from "../config/site-url";
import type { CourseIndexItem, EntityIndexEntry, StoryDetail } from "../types/story";
import { resolveStoryCategorySeoLabel, SITE_NAME } from "./seo";

const DEFAULT_SHARE_HASHTAGS = "原神,原神考察,テイワット文庫";
const X_INTENT_ENDPOINT = "https://x.com/intent/tweet";

function buildXIntentUrl(text: string, url: string): string {
  const intentUrl = new URL(X_INTENT_ENDPOINT);
  intentUrl.searchParams.set("text", text);
  intentUrl.searchParams.set("url", url);
  intentUrl.searchParams.set("hashtags", DEFAULT_SHARE_HASHTAGS);
  return intentUrl.toString();
}

/**
 * 作品の正規シェア URL（https://teyvat-bunko.com/story/<id>）を生成する。
 */
export function buildStoryShareUrl(
  storyId: string,
  siteUrl: string | null = getConfiguredSiteUrl()
): string {
  const pathname = `/story/${encodeURIComponent(storyId)}`;
  return buildAbsoluteUrl(pathname, siteUrl) ?? pathname;
}

/**
 * X（旧Twitter）検索で作品名・関連キャラが引っかかりやすいシェア文面を生成する。
 */
export function buildStoryShareText(
  story: Pick<StoryDetail, "title" | "shelfCategory" | "categoryLabel" | "tags">
): string {
  const categoryPrefix = resolveStoryCategorySeoLabel(story);
  const primaryTag = (story.tags?.[0] ?? "").trim();
  const hasTagInTitle =
    primaryTag && story.title.includes(primaryTag.replace(/（[^）]*）$/, "").trim());
  const focusPart = primaryTag && !hasTagInTitle ? `（${primaryTag}）` : "";

  return `${categoryPrefix}『${story.title}』${focusPart}｜${SITE_NAME}`;
}

/**
 * 作品単位の X シェア Intent URL を生成する。
 */
export function buildXShareIntentUrl(
  story: Pick<StoryDetail, "id" | "title" | "shelfCategory" | "categoryLabel" | "tags">,
  siteUrl: string | null = getConfiguredSiteUrl()
): string {
  return buildXIntentUrl(buildStoryShareText(story), buildStoryShareUrl(story.id, siteUrl));
}

/**
 * 読書コースの正規シェア URL（https://teyvat-bunko.com/courses/<id>）を生成する。
 */
export function buildCourseShareUrl(
  courseId: string,
  siteUrl: string | null = getConfiguredSiteUrl()
): string {
  const pathname = `/courses/${encodeURIComponent(courseId)}`;
  return buildAbsoluteUrl(pathname, siteUrl) ?? pathname;
}

/**
 * 読書コース用の X シェア文面を生成する。
 */
export function buildCourseShareText(
  course: Pick<CourseIndexItem, "title" | "storyCount" | "totalReadingTime">
): string {
  return `読書コース『${course.title}』（全${course.storyCount}篇・${course.totalReadingTime}）｜${SITE_NAME}`;
}

/**
 * 読書コース単位の X シェア Intent URL を生成する。
 */
export function buildCourseXShareIntentUrl(
  course: Pick<CourseIndexItem, "id" | "title" | "storyCount" | "totalReadingTime">,
  siteUrl: string | null = getConfiguredSiteUrl()
): string {
  return buildXIntentUrl(buildCourseShareText(course), buildCourseShareUrl(course.id, siteUrl));
}

/**
 * 人物・用語名鑑の正規シェア URL（https://teyvat-bunko.com/entities/<id>）を生成する。
 */
export function buildEntityShareUrl(
  entityId: string,
  siteUrl: string | null = getConfiguredSiteUrl()
): string {
  const pathname = `/entities/${encodeURIComponent(entityId)}`;
  return buildAbsoluteUrl(pathname, siteUrl) ?? pathname;
}

/**
 * 人物・用語名鑑用の X シェア文面を生成する。
 */
export function buildEntityShareText(
  entity: Pick<EntityIndexEntry, "name" | "storyIds">
): string {
  return `人物・用語名鑑『${entity.name}』（登場物語 全${entity.storyIds.length}篇）｜${SITE_NAME}`;
}

/**
 * 人物・用語単位の X シェア Intent URL を生成する。
 */
export function buildEntityXShareIntentUrl(
  entity: { id: string } & Pick<EntityIndexEntry, "name" | "storyIds">,
  siteUrl: string | null = getConfiguredSiteUrl()
): string {
  return buildXIntentUrl(buildEntityShareText(entity), buildEntityShareUrl(entity.id, siteUrl));
}
