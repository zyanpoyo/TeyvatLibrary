import type { MetaDescriptor } from "react-router";
import {
  buildAbsoluteUrl,
  buildCanonicalMetaTag,
  getConfiguredSiteUrl,
} from "../config/site-url";
import type {
  CourseIndexItem,
  EntityKind,
  StoriesIndexData,
  StoryCategoryId,
  StoryDetail,
  StoryEntitySummary,
} from "../types/story";
import {
  formatGenderPlaceholders,
  isValidIsoDateString,
  stripInlineTags,
} from "./text-parser";

export const SITE_NAME = "テイワット文庫";
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;
export const SHELF_DOCUMENT_TITLE =
  "テイワット文庫｜原神の聖遺物・武器・書籍ストーリー全文＆用語解説リーダー";
export const COURSES_DOCUMENT_TITLE = "読書コース・フェア棚一覧｜テイワット文庫";
export const ABOUT_DOCUMENT_TITLE = "このサイトについて｜テイワット文庫";
export const NOT_FOUND_PAGE_TITLE = "ページが見つかりません｜テイワット文庫";
export const NOT_FOUND_STORY_TITLE = "作品が見つかりません｜テイワット文庫";
export const NOT_FOUND_COURSE_TITLE = "読書コースが見つかりません｜テイワット文庫";

const MAX_SEO_TITLE_CHARS = 58;
const MAX_SEO_DESCRIPTION_CHARS = 140;

const CATEGORY_SEO_PREFIX: Record<StoryCategoryId, string> = {
  artifact: "聖遺物",
  book: "書籍",
  weapon: "武器",
  attire: "風の翼",
  chronicle: "育成素材",
};

function toSeoPlainText(text: string | undefined | null): string {
  if (!text) return "";
  return formatGenderPlaceholders(stripInlineTags(text))
    .replace(/\s+/g, " ")
    .trim();
}

function truncateCodepoints(text: string, maxChars: number): string {
  const chars = Array.from(text.trim());
  if (chars.length <= maxChars) return chars.join("");
  return `${chars.slice(0, Math.max(1, maxChars - 1)).join("")}…`;
}

function stripTrailingParens(value: string): string {
  return value.replace(/（[^）]*）$/g, "").trim();
}

export function resolveStoryCategorySeoLabel(
  story: Pick<StoryDetail, "shelfCategory" | "categoryLabel">
): string {
  if (story.shelfCategory === "chronicle") {
    return story.categoryLabel.includes("突破素材") ? "突破素材" : "育成素材";
  }
  return CATEGORY_SEO_PREFIX[story.shelfCategory] ?? "記録";
}

function shouldIncludeFocusTag(storyTitle: string, primaryTag: string): boolean {
  if (!primaryTag) return false;
  const baseTag = stripTrailingParens(primaryTag);
  const baseTitle = stripTrailingParens(storyTitle);
  if (storyTitle.includes(primaryTag) || (baseTag && storyTitle.includes(baseTag))) {
    return false;
  }
  if (baseTitle && primaryTag.includes(baseTitle)) {
    return false;
  }
  return true;
}

export function buildNotFoundDocumentTitle(kind: "page" | "story" | "course" = "page"): string {
  if (kind === "story") return NOT_FOUND_STORY_TITLE;
  if (kind === "course") return NOT_FOUND_COURSE_TITLE;
  return NOT_FOUND_PAGE_TITLE;
}

export function buildStoryDocumentTitle(
  story: Pick<StoryDetail, "title" | "shelfCategory" | "categoryLabel" | "tags" | "seo">
): string {
  const overrideTitle = story.seo?.title?.trim();
  if (overrideTitle) return overrideTitle;

  const categoryPrefix = resolveStoryCategorySeoLabel(story);
  const contentSuffix =
    story.shelfCategory === "book" ? "全文・用語解説" : "ストーリー全文・用語解説";
  const base = `【原神】${categoryPrefix}「${story.title}」${contentSuffix}`;
  const primaryTag = (story.tags?.[0] ?? "").trim();

  if (shouldIncludeFocusTag(story.title, primaryTag)) {
    const withFocus = `${base}｜${primaryTag}｜${SITE_NAME}`;
    if (Array.from(withFocus).length <= MAX_SEO_TITLE_CHARS) {
      return withFocus;
    }
  }

  return `${base}｜${SITE_NAME}`;
}

export function buildShelfDescription(totalCount?: number): string {
  const countText =
    typeof totalCount === "number" && totalCount > 0 ? `全${totalCount}篇` : "";
  return `原神の聖遺物・武器・書籍・風の翼・突破育成素材ストーリー${countText}を、原文改変なし・時系列構成で小説感覚で読める非公式Webリーダー「${SITE_NAME}」。インライン用語ガイドと作品間リンク付き。`;
}

export function buildAboutDescription(): string {
  return "非公式ファンアーカイブ「テイワット文庫」の運営方針、原神ゲーム内テキストの著作権・引用の取り扱い、GA4 アクセス解析とオプトアウト設定、localStorage 保存データ、免責事項、お問い合わせ先のご案内。";
}

export function buildCoursesDescription(courses?: ReadonlyArray<CourseIndexItem>): string {
  const countText = courses && courses.length > 0 ? `（全${courses.length}コース）` : "";
  return `原神の聖遺物・武器・書籍・風の翼・育成素材を、入門・キャラクター別・地域・歴史別の切り口で順番に通読できる読書コース一覧${countText}。何から読めばいいか迷う旅人に最適な順路を案内します。`;
}

export function buildCourseDocumentTitle(
  course: Pick<CourseIndexItem, "title" | "storyCount" | "seo">
): string {
  const overrideTitle = course.seo?.title?.trim();
  if (overrideTitle) return overrideTitle;
  return `【原神】読書コース「${course.title}」（全${course.storyCount}篇）｜${SITE_NAME}`;
}

export function buildCourseDescription(
  course: Pick<CourseIndexItem, "title" | "hook" | "storyCount" | "totalReadingTime" | "seo">
): string {
  const overrideDesc = course.seo?.description?.trim();
  if (overrideDesc) return overrideDesc;

  const cleanHook = toSeoPlainText(course.hook).replace(/[—―]+$/g, "。");
  const hookSentence = cleanHook.endsWith("。") ? cleanHook : `${cleanHook}。`;
  const combined = `原神の読書コース「${course.title}」（全${course.storyCount}篇・${course.totalReadingTime}）。${hookSentence}`;

  if (Array.from(combined).length <= MAX_SEO_DESCRIPTION_CHARS) {
    return combined;
  }
  return truncateCodepoints(combined, MAX_SEO_DESCRIPTION_CHARS);
}

export function buildStoryDescription(
  story: Pick<
    StoryDetail,
    "title" | "shelfCategory" | "categoryLabel" | "chapterCount" | "hook" | "tags" | "entities" | "seo"
  >
): string {
  const overrideDesc = story.seo?.description?.trim();
  if (overrideDesc) return overrideDesc;

  const categoryPrefix = resolveStoryCategorySeoLabel(story);
  const alreadyHasVolumeCount = /全[一二三四五六七八九十\d]+[巻章幕]/.test(story.title);
  const chapterNote =
    !alreadyHasVolumeCount && (story.chapterCount ?? 0) > 1
      ? story.shelfCategory === "book"
        ? `（全${story.chapterCount}巻）`
        : `（全${story.chapterCount}章）`
      : "";

  const lead = `原神の${categoryPrefix}「${story.title}」${chapterNote}の全文と用語解説。`;
  const cleanHook = toSeoPlainText(story.hook).replace(/[—―]+$/g, "。");
  const hookSentence = cleanHook.endsWith("。") ? cleanHook : `${cleanHook}。`;

  const relatedNames: string[] = [];
  for (const entity of story.entities ?? []) {
    if (entity.name && !relatedNames.includes(entity.name)) {
      relatedNames.push(entity.name);
    }
  }
  if (relatedNames.length === 0) {
    for (const tag of story.tags ?? []) {
      const trimmed = tag.trim();
      if (trimmed && !relatedNames.includes(trimmed)) {
        relatedNames.push(trimmed);
      }
    }
  }

  const focusNames = relatedNames.slice(0, 2);
  const relatedSuffix = focusNames.length > 0 ? `関連：${focusNames.join("・")}。` : "";
  const combined = `${lead}${hookSentence}${relatedSuffix}`;

  if (Array.from(combined).length <= MAX_SEO_DESCRIPTION_CHARS) {
    return combined;
  }

  const withoutRelated = `${lead}${hookSentence}`;
  if (Array.from(withoutRelated).length <= MAX_SEO_DESCRIPTION_CHARS) {
    return withoutRelated;
  }

  return truncateCodepoints(withoutRelated, MAX_SEO_DESCRIPTION_CHARS);
}

export function buildOgImagePath(
  kind: "site" | "about" | "story" | "courses" | "course",
  id?: string
): string {
  if (kind === "site") return "/og/site.png";
  if (kind === "about") return "/og/about.png";
  if (kind === "courses") return "/og/courses.png";
  if (kind === "course") return `/og/course/${encodeURIComponent(id || "")}.png`;
  return `/og/story/${encodeURIComponent(id || "")}.png`;
}

function buildSocialMetaTags({
  type,
  title,
  description,
  canonicalUrl,
  imageUrl,
  imageAlt,
}: {
  type: "website" | "article";
  title: string;
  description: string;
  canonicalUrl: string | null;
  imageUrl: string | null;
  imageAlt: string;
}): MetaDescriptor[] {
  const tags: MetaDescriptor[] = [
    { property: "og:site_name", content: SITE_NAME },
    { property: "og:locale", content: "ja_JP" },
    { property: "og:type", content: type },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
  ];

  if (canonicalUrl) {
    tags.push({ property: "og:url", content: canonicalUrl });
  }
  if (imageUrl) {
    tags.push(
      { property: "og:image", content: imageUrl },
      { property: "og:image:width", content: String(OG_IMAGE_WIDTH) },
      { property: "og:image:height", content: String(OG_IMAGE_HEIGHT) },
      { property: "og:image:alt", content: imageAlt }
    );
  }

  tags.push(
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description }
  );
  if (imageUrl) {
    tags.push({ name: "twitter:image", content: imageUrl });
  }

  return tags;
}

function splitEntityNameAndAliases(rawName: string): {
  name: string;
  alternateName?: string[];
} {
  const trimmed = rawName.trim();
  const parenMatch = /^(.+?)（([^）]+)）$/.exec(trimmed);
  if (!parenMatch) {
    return { name: trimmed };
  }
  const mainName = parenMatch[1].trim();
  const inner = parenMatch[2].trim();
  const aliases = inner
    .split(/[／/]/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && part !== mainName);

  return aliases.length > 0
    ? { name: mainName, alternateName: aliases }
    : { name: mainName };
}

function mapEntityKindToSchemaType(kind: EntityKind): string {
  switch (kind) {
    case "character":
    case "god":
      return "Person";
    case "organization":
      return "Organization";
    case "place":
      return "Place";
    case "concept":
    default:
      return "DefinedTerm";
  }
}

function buildEntityJsonLdNode(entity: StoryEntitySummary): Record<string, unknown> {
  const { name, alternateName } = splitEntityNameAndAliases(entity.name);
  const desc = toSeoPlainText(`${entity.identity} ${entity.desc}`);
  return {
    "@type": mapEntityKindToSchemaType(entity.kind),
    name,
    ...(alternateName ? { alternateName } : {}),
    ...(desc ? { description: desc } : {}),
  };
}

function buildGlossaryMentionNodes(story: StoryDetail): Array<Record<string, unknown>> {
  const nodes: Array<Record<string, unknown>> = [];
  const seenTerms = new Set<string>();

  for (const entry of Object.values(story.glossary ?? {})) {
    const termName = toSeoPlainText(entry.term);
    if (!termName || seenTerms.has(termName)) continue;
    seenTerms.add(termName);

    const desc = toSeoPlainText(`${entry.identity} ${entry.desc}`);
    nodes.push({
      "@type": "DefinedTerm",
      name: termName,
      ...(desc ? { description: desc } : {}),
    });
  }

  return nodes;
}

function toIsoDateTimeJst(dateStr?: string): string | undefined {
  if (!isValidIsoDateString(dateStr)) return undefined;
  return `${dateStr}T00:00:00+09:00`;
}

export function buildShelfMeta({
  indexData,
  siteUrl = getConfiguredSiteUrl(),
}: {
  indexData?: StoriesIndexData | null;
  siteUrl?: string | null;
} = {}): MetaDescriptor[] {
  const title = SHELF_DOCUMENT_TITLE;
  const description = buildShelfDescription(indexData?.totalCount);
  const canonicalUrl = buildAbsoluteUrl("/", siteUrl);
  const ogImageUrl = buildAbsoluteUrl(buildOgImagePath("site"), siteUrl);
  const websiteId = canonicalUrl ? `${canonicalUrl}#website` : undefined;

  const graph: Array<Record<string, unknown>> = [
    {
      "@type": "WebSite",
      ...(websiteId ? { "@id": websiteId } : {}),
      name: SITE_NAME,
      ...(canonicalUrl ? { url: canonicalUrl } : {}),
      inLanguage: "ja",
      description,
      ...(canonicalUrl
        ? {
            potentialAction: {
              "@type": "SearchAction",
              target: `${canonicalUrl}?q={search_term_string}`,
              "query-input": "required name=search_term_string",
            },
          }
        : {}),
    },
    {
      "@type": "CollectionPage",
      name: title,
      ...(canonicalUrl ? { url: canonicalUrl } : {}),
      inLanguage: "ja",
      description,
      ...(typeof indexData?.totalCount === "number"
        ? { numberOfItems: indexData.totalCount }
        : {}),
      ...(websiteId ? { isPartOf: { "@id": websiteId } } : {}),
    },
  ];

  return [
    { title },
    { name: "description", content: description },
    ...buildCanonicalMetaTag("/", siteUrl),
    ...buildSocialMetaTags({
      type: "website",
      title,
      description,
      canonicalUrl,
      imageUrl: ogImageUrl,
      imageAlt: `${SITE_NAME} 書架トップ`,
    }),
    {
      "script:ld+json": {
        "@context": "https://schema.org",
        "@graph": graph,
      },
    },
  ];
}

export function buildAboutMeta({
  siteUrl = getConfiguredSiteUrl(),
}: {
  siteUrl?: string | null;
} = {}): MetaDescriptor[] {
  const title = ABOUT_DOCUMENT_TITLE;
  const description = buildAboutDescription();
  const homeUrl = buildAbsoluteUrl("/", siteUrl);
  const canonicalUrl = buildAbsoluteUrl("/about", siteUrl);
  const ogImageUrl = buildAbsoluteUrl(buildOgImagePath("about"), siteUrl);

  const graph: Array<Record<string, unknown>> = [
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: SITE_NAME,
          ...(homeUrl ? { item: homeUrl } : {}),
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "このサイトについて",
          ...(canonicalUrl ? { item: canonicalUrl } : {}),
        },
      ],
    },
    {
      "@type": "AboutPage",
      name: title,
      description,
      ...(canonicalUrl ? { url: canonicalUrl } : {}),
      inLanguage: "ja",
      ...(homeUrl
        ? {
            isPartOf: {
              "@type": "WebSite",
              "@id": `${homeUrl}#website`,
              name: SITE_NAME,
              url: homeUrl,
            },
          }
        : {}),
    },
  ];

  return [
    { title },
    { name: "description", content: description },
    ...buildCanonicalMetaTag("/about", siteUrl),
    ...buildSocialMetaTags({
      type: "website",
      title,
      description,
      canonicalUrl,
      imageUrl: ogImageUrl,
      imageAlt: "このサイトについて｜テイワット文庫",
    }),
    {
      "script:ld+json": {
        "@context": "https://schema.org",
        "@graph": graph,
      },
    },
  ];
}

export function buildStoryMeta({
  story,
  siteUrl = getConfiguredSiteUrl(),
}: {
  story: StoryDetail | null | undefined;
  siteUrl?: string | null;
}): MetaDescriptor[] {
  if (!story) {
    return buildNotFoundMeta("story");
  }

  const pathname = `/story/${encodeURIComponent(story.id)}`;
  const title = buildStoryDocumentTitle(story);
  const description = buildStoryDescription(story);
  const homeUrl = buildAbsoluteUrl("/", siteUrl);
  const canonicalUrl = buildAbsoluteUrl(pathname, siteUrl);
  const ogImageUrl = buildAbsoluteUrl(buildOgImagePath("story", story.id), siteUrl);
  const publishedIso = toIsoDateTimeJst(story.addedAt);
  const aboutNodes = (story.entities ?? []).map(buildEntityJsonLdNode);
  const mentionNodes = buildGlossaryMentionNodes(story);
  const keywords = Array.from(
    new Set(
      [story.title, story.era, ...(story.region ?? []), ...(story.tags ?? [])]
        .map((s) => s.trim())
        .filter(Boolean)
    )
  );

  const graph: Array<Record<string, unknown>> = [
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: SITE_NAME,
          ...(homeUrl ? { item: homeUrl } : {}),
        },
        {
          "@type": "ListItem",
          position: 2,
          name: story.title,
          ...(canonicalUrl ? { item: canonicalUrl } : {}),
        },
      ],
    },
    {
      "@type": "Article",
      headline: title,
      name: story.title,
      description,
      ...(ogImageUrl ? { image: ogImageUrl } : {}),
      ...(canonicalUrl
        ? {
            url: canonicalUrl,
            mainEntityOfPage: {
              "@type": "WebPage",
              "@id": canonicalUrl,
            },
          }
        : {}),
      ...(publishedIso
        ? {
            datePublished: publishedIso,
            dateModified: publishedIso,
          }
        : {}),
      inLanguage: "ja",
      articleSection: story.categoryLabel,
      ...(keywords.length > 0 ? { keywords } : {}),
      author: {
        "@type": "Organization",
        name: SITE_NAME,
        ...(homeUrl ? { url: homeUrl } : {}),
      },
      publisher: {
        "@type": "Organization",
        name: SITE_NAME,
        ...(homeUrl ? { url: homeUrl } : {}),
      },
      ...(homeUrl
        ? {
            isPartOf: {
              "@type": "WebSite",
              "@id": `${homeUrl}#website`,
              name: SITE_NAME,
              url: homeUrl,
            },
          }
        : {}),
      ...(aboutNodes.length > 0 ? { about: aboutNodes } : {}),
      ...(mentionNodes.length > 0 ? { mentions: mentionNodes } : {}),
    },
  ];

  return [
    { title },
    { name: "description", content: description },
    ...buildCanonicalMetaTag(pathname, siteUrl),
    ...buildSocialMetaTags({
      type: "article",
      title,
      description,
      canonicalUrl,
      imageUrl: ogImageUrl,
      imageAlt: `${story.title} — ${story.categoryLabel}`,
    }),
    {
      "script:ld+json": {
        "@context": "https://schema.org",
        "@graph": graph,
      },
    },
  ];
}

export function buildCoursesMeta({
  indexData,
  siteUrl = getConfiguredSiteUrl(),
}: {
  indexData?: StoriesIndexData | null;
  siteUrl?: string | null;
} = {}): MetaDescriptor[] {
  const courses = indexData?.courses ?? [];
  const title = COURSES_DOCUMENT_TITLE;
  const description = buildCoursesDescription(courses);
  const homeUrl = buildAbsoluteUrl("/", siteUrl);
  const canonicalUrl = buildAbsoluteUrl("/courses", siteUrl);
  const ogImageUrl = buildAbsoluteUrl(buildOgImagePath("courses"), siteUrl);

  const itemListElements = courses.map((course, idx) => {
    const courseUrl = buildAbsoluteUrl(`/courses/${encodeURIComponent(course.id)}`, siteUrl);
    return {
      "@type": "ListItem",
      position: idx + 1,
      name: course.title,
      ...(courseUrl ? { url: courseUrl } : {}),
    };
  });

  const graph: Array<Record<string, unknown>> = [
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: SITE_NAME,
          ...(homeUrl ? { item: homeUrl } : {}),
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "読書コース一覧",
          ...(canonicalUrl ? { item: canonicalUrl } : {}),
        },
      ],
    },
    {
      "@type": "CollectionPage",
      name: title,
      description,
      ...(canonicalUrl ? { url: canonicalUrl } : {}),
      inLanguage: "ja",
      numberOfItems: courses.length,
      ...(homeUrl
        ? {
            isPartOf: {
              "@type": "WebSite",
              "@id": `${homeUrl}#website`,
              name: SITE_NAME,
              url: homeUrl,
            },
          }
        : {}),
      ...(itemListElements.length > 0
        ? {
            mainEntity: {
              "@type": "ItemList",
              numberOfItems: courses.length,
              itemListElement: itemListElements,
            },
          }
        : {}),
    },
  ];

  return [
    { title },
    { name: "description", content: description },
    ...buildCanonicalMetaTag("/courses", siteUrl),
    ...buildSocialMetaTags({
      type: "website",
      title,
      description,
      canonicalUrl,
      imageUrl: ogImageUrl,
      imageAlt: "読書コース・フェア棚一覧｜テイワット文庫",
    }),
    {
      "script:ld+json": {
        "@context": "https://schema.org",
        "@graph": graph,
      },
    },
  ];
}

export function buildCourseDetailMeta({
  course,
  indexData,
  siteUrl = getConfiguredSiteUrl(),
}: {
  course: CourseIndexItem | null | undefined;
  indexData?: StoriesIndexData | null;
  siteUrl?: string | null;
}): MetaDescriptor[] {
  if (!course) {
    return buildNotFoundMeta("course");
  }

  const pathname = `/courses/${encodeURIComponent(course.id)}`;
  const title = buildCourseDocumentTitle(course);
  const description = buildCourseDescription(course);
  const homeUrl = buildAbsoluteUrl("/", siteUrl);
  const coursesUrl = buildAbsoluteUrl("/courses", siteUrl);
  const canonicalUrl = buildAbsoluteUrl(pathname, siteUrl);
  const ogImageUrl = buildAbsoluteUrl(buildOgImagePath("course", course.id), siteUrl);
  const storyMap = new Map((indexData?.stories ?? []).map((s) => [s.id, s]));

  const itemListElements = course.steps.map((step, idx) => {
    const storyUrl = buildAbsoluteUrl(`/story/${encodeURIComponent(step.storyId)}`, siteUrl);
    const storyTitle = storyMap.get(step.storyId)?.title || step.storyId;
    return {
      "@type": "ListItem",
      position: idx + 1,
      name: storyTitle,
      ...(storyUrl ? { url: storyUrl } : {}),
    };
  });

  const graph: Array<Record<string, unknown>> = [
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: SITE_NAME,
          ...(homeUrl ? { item: homeUrl } : {}),
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "読書コース一覧",
          ...(coursesUrl ? { item: coursesUrl } : {}),
        },
        {
          "@type": "ListItem",
          position: 3,
          name: course.title,
          ...(canonicalUrl ? { item: canonicalUrl } : {}),
        },
      ],
    },
    {
      "@type": "CollectionPage",
      name: course.title,
      headline: title,
      description,
      ...(ogImageUrl ? { image: ogImageUrl } : {}),
      ...(canonicalUrl ? { url: canonicalUrl } : {}),
      inLanguage: "ja",
      numberOfItems: course.storyCount,
      ...(homeUrl
        ? {
            isPartOf: {
              "@type": "WebSite",
              "@id": `${homeUrl}#website`,
              name: SITE_NAME,
              url: homeUrl,
            },
          }
        : {}),
      ...(itemListElements.length > 0
        ? {
            mainEntity: {
              "@type": "ItemList",
              itemListOrder: "https://schema.org/ItemListOrderAscending",
              numberOfItems: itemListElements.length,
              itemListElement: itemListElements,
            },
          }
        : {}),
    },
  ];

  return [
    { title },
    { name: "description", content: description },
    ...buildCanonicalMetaTag(pathname, siteUrl),
    ...buildSocialMetaTags({
      type: "website",
      title,
      description,
      canonicalUrl,
      imageUrl: ogImageUrl,
      imageAlt: `${course.title} — ${course.badge}`,
    }),
    {
      "script:ld+json": {
        "@context": "https://schema.org",
        "@graph": graph,
      },
    },
  ];
}

export function buildNotFoundMeta(kind: "page" | "story" | "course" = "page"): MetaDescriptor[] {
  return [
    { title: buildNotFoundDocumentTitle(kind) },
    { name: "robots", content: "noindex, nofollow" },
  ];
}
