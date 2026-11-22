import { buildAbsoluteUrl, getConfiguredSiteUrl } from "../config/site-url";
import type { StoryDetail } from "../types/story";
import { resolveStoryCategorySeoLabel, SITE_NAME } from "./seo";

const DEFAULT_SHARE_HASHTAGS = "原神,原神考察,テイワット文庫";
const X_INTENT_ENDPOINT = "https://x.com/intent/tweet";

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
  const hasTagInTitle = primaryTag && story.title.includes(primaryTag.replace(/（[^）]*）$/, "").trim());
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
  const intentUrl = new URL(X_INTENT_ENDPOINT);
  intentUrl.searchParams.set("text", buildStoryShareText(story));
  intentUrl.searchParams.set("url", buildStoryShareUrl(story.id, siteUrl));
  intentUrl.searchParams.set("hashtags", DEFAULT_SHARE_HASHTAGS);
  return intentUrl.toString();
}
