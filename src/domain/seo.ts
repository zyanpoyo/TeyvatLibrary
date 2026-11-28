import type { MetaDescriptor } from "react-router";
import {
  buildAbsoluteUrl,
  buildCanonicalMetaTag,
  getConfiguredSiteUrl,
} from "../config/site-url";
import type {
  CourseIndexItem,
  EntityIndexEntry,
  EntityKind,
  StoriesIndexData,
  StoryCategoryId,
  StoryDetail,
  StoryEntitySummary,
  StoryIndexItem,
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
export const ENTITIES_DOCUMENT_TITLE = "人物・用語名鑑｜テイワット文庫";
export const ABOUT_DOCUMENT_TITLE = "このサイトについて｜テイワット文庫";
export const NOT_FOUND_PAGE_TITLE = "ページが見つかりません｜テイワット文庫";
export const NOT_FOUND_STORY_TITLE = "作品が見つかりません｜テイワット文庫";
export const NOT_FOUND_COURSE_TITLE = "読書コースが見つかりません｜テイワット文庫";
export const NOT_FOUND_ENTITY_TITLE = "人物・用語が見つかりません｜テイワット文庫";

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

export function buildNotFoundDocumentTitle(
  kind: "page" | "story" | "course" | "entity" = "page"
): string {
  if (kind === "story") return NOT_FOUND_STORY_TITLE;
  if (kind === "course") return NOT_FOUND_COURSE_TITLE;
  if (kind === "entity") return NOT_FOUND_ENTITY_TITLE;
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

export function buildEntitiesDescription(entityCount?: number): string {
  const countText =
    typeof entityCount === "number" && entityCount > 0 ? `（全${entityCount}項目）` : "";
  return `原神の聖遺物・武器・書籍に登場する人物・魔神・組織・重要用語をまとめた人物・用語名鑑${countText}。正体・背景解説・公式出典から該当物語へ直接辿れます。`;
}

export function buildEntityDocumentTitle(
  entity: Pick<EntityIndexEntry, "name" | "storyIds">
): string {
  const count = entity.storyIds.length;
  const full = `【原神】${entity.name}の正体・解説・登場物語（全${count}篇）｜${SITE_NAME}`;
  if (Array.from(full).length <= MAX_SEO_TITLE_CHARS) {
    return full;
  }
  const compact = `【原神】${entity.name}の正体・解説｜${SITE_NAME}`;
  if (Array.from(compact).length <= MAX_SEO_TITLE_CHARS) {
    return compact;
  }
  return `${entity.name}｜人物・用語名鑑｜${SITE_NAME}`;
}

export function buildEntityDescription(
  entity: Pick<EntityIndexEntry, "name" | "defaultIdentity" | "defaultDesc" | "storyIds">,
  stories: ReadonlyArray<Pick<StoryIndexItem, "id" | "title">> = []
): string {
  const identity = toSeoPlainText(entity.defaultIdentity);
  const desc = toSeoPlainText(entity.defaultDesc);
  const storyMap = new Map(stories.map((s) => [s.id, s.title]));
  const sampleTitles = entity.storyIds
    .map((id) => storyMap.get(id))
    .filter((t): t is string => Boolean(t))
    .slice(0, 2);
  const worksText =
    sampleTitles.length > 0
      ? `登場：${sampleTitles.map((t) => `『${t}』`).join("")}${entity.storyIds.length > 2 ? "ほか" : ""}。`
      : "";

  const parts = [
    identity ? `${identity}。` : "",
    desc,
    worksText,
  ].filter(Boolean);
  const combined =
    parts.join("") ||
    `原神の物語に登場する「${entity.name}」の背景解説・公式出典・登場作品一覧。`;

  if (Array.from(combined).length <= MAX_SEO_DESCRIPTION_CHARS) {
    return combined;
  }
  return truncateCodepoints(combined, MAX_SEO_DESCRIPTION_CHARS);
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
  kind: "site" | "about" | "story" | "courses" | "course" | "entities" | "entity",
  id?: string
): string {
  if (kind === "site") return "/og/site.png";
  if (kind === "about") return "/og/about.png";
  if (kind === "courses") return "/og/courses.png";
  if (kind === "course") return `/og/course/${encodeURIComponent(id || "")}.png`;
  if (kind === "entities") return "/og/entities.png";
  if (kind === "entity") return `/og/entity/${encodeURIComponent(id || "")}.png`;
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

function buildBreadcrumbListNode(
  items: ReadonlyArray<{ name: string; url?: string | null }>
): Record<string, unknown> {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((entry, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: entry.name,
      ...(entry.url ? { item: entry.url } : {}),
    })),
  };
}

function buildWebSitePartOfNode(homeUrl: string | null): Record<string, unknown> | undefined {
  if (!homeUrl) return undefined;
  return {
    "@type": "WebSite",
    "@id": `${homeUrl}#website`,
    name: SITE_NAME,
    url: homeUrl,
  };
}

function buildCollectionIndexMeta({
  pathname,
  breadcrumbLabel,
  title,
  description,
  ogKind,
  imageAlt,
  items,
  siteUrl,
}: {
  pathname: string;
  breadcrumbLabel: string;
  title: string;
  description: string;
  ogKind: "courses" | "entities";
  imageAlt: string;
  items: ReadonlyArray<{ name: string; path: string }>;
  siteUrl: string | null;
}): MetaDescriptor[] {
  const homeUrl = buildAbsoluteUrl("/", siteUrl);
  const canonicalUrl = buildAbsoluteUrl(pathname, siteUrl);
  const ogImageUrl = buildAbsoluteUrl(buildOgImagePath(ogKind), siteUrl);
  const websitePartOf = buildWebSitePartOfNode(homeUrl);

  const itemListElements = items.map((item, idx) => {
    const itemUrl = buildAbsoluteUrl(item.path, siteUrl);
    return {
      "@type": "ListItem",
      position: idx + 1,
      name: item.name,
      ...(itemUrl ? { url: itemUrl } : {}),
    };
  });

  const graph: Array<Record<string, unknown>> = [
    buildBreadcrumbListNode([
      { name: SITE_NAME, url: homeUrl },
      { name: breadcrumbLabel, url: canonicalUrl },
    ]),
    {
      "@type": "CollectionPage",
      name: title,
      description,
      ...(canonicalUrl ? { url: canonicalUrl } : {}),
      inLanguage: "ja",
      numberOfItems: items.length,
      ...(websitePartOf ? { isPartOf: websitePartOf } : {}),
      ...(itemListElements.length > 0
        ? {
            mainEntity: {
              "@type": "ItemList",
              numberOfItems: items.length,
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
      imageAlt,
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
  return buildCollectionIndexMeta({
    pathname: "/courses",
    breadcrumbLabel: "読書コース一覧",
    title: COURSES_DOCUMENT_TITLE,
    description: buildCoursesDescription(courses),
    ogKind: "courses",
    imageAlt: "読書コース・フェア棚一覧｜テイワット文庫",
    items: courses.map((course) => ({
      name: course.title,
      path: `/courses/${encodeURIComponent(course.id)}`,
    })),
    siteUrl,
  });
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
  const websitePartOf = buildWebSitePartOfNode(homeUrl);
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
    buildBreadcrumbListNode([
      { name: SITE_NAME, url: homeUrl },
      { name: "読書コース一覧", url: coursesUrl },
      { name: course.title, url: canonicalUrl },
    ]),
    {
      "@type": "CollectionPage",
      name: course.title,
      headline: title,
      description,
      ...(ogImageUrl ? { image: ogImageUrl } : {}),
      ...(canonicalUrl ? { url: canonicalUrl } : {}),
      inLanguage: "ja",
      numberOfItems: course.storyCount,
      ...(websitePartOf ? { isPartOf: websitePartOf } : {}),
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

export function buildEntitiesMeta({
  indexData,
  siteUrl = getConfiguredSiteUrl(),
}: {
  indexData?: StoriesIndexData | null;
  siteUrl?: string | null;
} = {}): MetaDescriptor[] {
  const entries = Object.entries(indexData?.entitiesIndex ?? {});
  return buildCollectionIndexMeta({
    pathname: "/entities",
    breadcrumbLabel: "人物・用語名鑑",
    title: ENTITIES_DOCUMENT_TITLE,
    description: buildEntitiesDescription(entries.length),
    ogKind: "entities",
    imageAlt: ENTITIES_DOCUMENT_TITLE,
    items: entries.map(([entityId, entry]) => ({
      name: entry.name,
      path: `/entities/${encodeURIComponent(entityId)}`,
    })),
    siteUrl,
  });
}

export function buildEntityDetailMeta({
  entityId,
  entity,
  indexData,
  siteUrl = getConfiguredSiteUrl(),
}: {
  entityId: string;
  entity: EntityIndexEntry | null | undefined;
  indexData?: StoriesIndexData | null;
  siteUrl?: string | null;
}): MetaDescriptor[] {
  if (!entity || !entityId) {
    return buildNotFoundMeta("entity");
  }

  const pathname = `/entities/${encodeURIComponent(entityId)}`;
  const title = buildEntityDocumentTitle(entity);
  const stories = indexData?.stories ?? [];
  const description = buildEntityDescription(entity, stories);
  const homeUrl = buildAbsoluteUrl("/", siteUrl);
  const entitiesUrl = buildAbsoluteUrl("/entities", siteUrl);
  const canonicalUrl = buildAbsoluteUrl(pathname, siteUrl);
  const ogImageUrl = buildAbsoluteUrl(buildOgImagePath("entity", entityId), siteUrl);
  const websitePartOf = buildWebSitePartOfNode(homeUrl);
  const storyMap = new Map(stories.map((s) => [s.id, s]));

  const mainEntityNode = {
    ...buildEntityJsonLdNode({
      id: entityId,
      name: entity.name,
      kind: entity.kind,
      identity: entity.defaultIdentity ?? "",
      desc: entity.defaultDesc ?? "",
    }),
    ...(canonicalUrl ? { url: canonicalUrl } : {}),
  };

  const mentionItems = entity.storyIds.map((sid) => {
    const story = storyMap.get(sid);
    const storyUrl = buildAbsoluteUrl(`/story/${encodeURIComponent(sid)}`, siteUrl);
    return {
      "@type": "Article",
      name: story?.title || sid,
      ...(storyUrl ? { url: storyUrl } : {}),
    };
  });

  const pageType =
    entity.kind === "character" || entity.kind === "god" ? "ProfilePage" : "WebPage";

  const graph: Array<Record<string, unknown>> = [
    buildBreadcrumbListNode([
      { name: SITE_NAME, url: homeUrl },
      { name: "人物・用語名鑑", url: entitiesUrl },
      { name: entity.name, url: canonicalUrl },
    ]),
    {
      "@type": pageType,
      name: entity.name,
      headline: title,
      description,
      ...(ogImageUrl ? { image: ogImageUrl } : {}),
      ...(canonicalUrl ? { url: canonicalUrl } : {}),
      inLanguage: "ja",
      mainEntity: mainEntityNode,
      ...(mentionItems.length > 0 ? { mentions: mentionItems } : {}),
      ...(websitePartOf ? { isPartOf: websitePartOf } : {}),
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
      imageAlt: `${entity.name} — 人物・用語名鑑`,
    }),
    {
      "script:ld+json": {
        "@context": "https://schema.org",
        "@graph": graph,
      },
    },
  ];
}

export function buildNotFoundMeta(
  kind: "page" | "story" | "course" | "entity" = "page"
): MetaDescriptor[] {
  return [
    { title: buildNotFoundDocumentTitle(kind) },
    { name: "robots", content: "noindex, nofollow" },
  ];
}
