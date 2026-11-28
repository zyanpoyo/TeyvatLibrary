import { describe, expect, it } from "vitest";
import {
  buildAbsoluteUrl,
  buildCanonicalMetaTag,
  buildCanonicalUrl,
  DEFAULT_SITE_URL,
  getConfiguredSiteUrl,
  normalizeSiteUrl,
} from "../src/config/site-url";
import {
  buildRobotsTxt,
  buildSitemapXml,
  DEFAULT_SITEMAP_ORIGIN,
  resolveSitemapOrigin,
} from "../scripts/lib/post-build-seo.mjs";
import type { StoriesIndexData } from "../src/types/story";

const MOCK_INDEX: StoriesIndexData = {
  generatedAt: "2026-11-22T01:00:00.000Z",
  totalCount: 2,
  categoryCounts: {
    book: 1,
    artifact: 1,
    weapon: 0,
    attire: 0,
    chronicle: 0,
  },
  entitiesIndex: {
    rosalyne: {
      name: "ロザリン（淑女）",
      kind: "character",
      storyIds: ["crimson_witch"],
    },
    orobashi: {
      name: "オロバシ",
      kind: "god",
      storyIds: ["byakuyakoku"],
    },
  },
  stories: [
    {
      id: "crimson_witch",
      title: "燃え盛る炎の魔女",
      shelfCategory: "artifact",
      categoryLabel: "聖遺物（連作短編）",
      region: ["モンド"],
      era: "500年前",
      addedAt: "2026-11-15",
      readingTime: "約3分",
      charCount: 1000,
      chapterCount: 5,
      hook: "テスト",
      tags: [],
      entityIds: [],
    },
    {
      id: "byakuyakoku",
      title: "白夜国館蔵",
      shelfCategory: "book",
      categoryLabel: "書籍",
      region: ["稲妻（淵下宮）"],
      era: "白夜国時代",
      readingTime: "約15分",
      charCount: 8000,
      chapterCount: 6,
      hook: "テスト",
      tags: [],
      entityIds: [],
    },
  ],
  courses: [
    {
      id: "must_read_essentials",
      kind: "beginner",
      badge: "入門",
      title: "必読コース",
      subtitle: "サブ",
      hook: "フック",
      storyIds: ["crimson_witch", "byakuyakoku"],
      steps: [
        { storyId: "crimson_witch", note: "1" },
        { storyId: "byakuyakoku", note: "2" },
      ],
      storyCount: 2,
      totalCharCount: 9000,
      totalReadingTime: "約18分",
    },
  ],
};

describe("site-url canonical helpers", () => {
  it("normalizes valid http(s) site URLs and rejects empty or invalid values", () => {
    expect(normalizeSiteUrl("https://teyvat-library.example/")).toBe(
      "https://teyvat-library.example"
    );
    expect(normalizeSiteUrl("  https://example.com/sub/  ")).toBe(
      "https://example.com/sub"
    );
    expect(normalizeSiteUrl("http://127.0.0.1:4173/")).toBe(
      "http://127.0.0.1:4173"
    );
    expect(normalizeSiteUrl("")).toBeNull();
    expect(normalizeSiteUrl(undefined)).toBeNull();
    expect(normalizeSiteUrl("not-a-url")).toBeNull();
    expect(normalizeSiteUrl("javascript:alert(1)")).toBeNull();
  });

  it("resolves default site URL to https://teyvat-bunko.com and honors VITE_SITE_URL override", () => {
    expect(DEFAULT_SITE_URL).toBe("https://teyvat-bunko.com");
    expect(getConfiguredSiteUrl()).toBe("https://teyvat-bunko.com");
    expect(buildAbsoluteUrl("/og/site.png")).toBe("https://teyvat-bunko.com/og/site.png");
    expect(buildAbsoluteUrl("/story/crimson_witch", "https://staging.example/")).toBe(
      "https://staging.example/story/crimson_witch"
    );
  });

  it("builds canonical URLs and link meta descriptors only when siteUrl is configured", () => {
    expect(buildCanonicalUrl("/", "https://teyvat.example/")).toBe(
      "https://teyvat.example/"
    );
    expect(buildCanonicalUrl("/story/crimson_witch", "https://teyvat.example/")).toBe(
      "https://teyvat.example/story/crimson_witch"
    );
    expect(buildCanonicalUrl("about", "https://teyvat.example")).toBe(
      "https://teyvat.example/about"
    );
    expect(buildCanonicalUrl("/about", "")).toBeNull();

    expect(buildCanonicalMetaTag("/about", "https://teyvat.example/")).toEqual([
      {
        tagName: "link",
        rel: "canonical",
        href: "https://teyvat.example/about",
      },
    ]);
    expect(buildCanonicalMetaTag("/about", null)).toEqual([]);
  });
});

describe("post-build SEO asset generators", () => {
  it("resolves sitemap origin with custom domain or fallback default", () => {
    expect(resolveSitemapOrigin("https://bunko.example.jp/")).toBe(
      "https://bunko.example.jp"
    );
    expect(resolveSitemapOrigin("")).toBe("https://teyvat-bunko.com");
    expect(resolveSitemapOrigin("")).toBe(DEFAULT_SITEMAP_ORIGIN);
    expect(resolveSitemapOrigin("invalid-url")).toBe(DEFAULT_SITEMAP_ORIGIN);
  });

  it("generates robots.txt pointing to sitemap.xml", () => {
    expect(buildRobotsTxt({ siteUrl: "https://bunko.example.jp/" })).toBe(
      "User-agent: *\nAllow: /\n\nSitemap: https://bunko.example.jp/sitemap.xml\n"
    );
    expect(buildRobotsTxt()).toContain(
      `Sitemap: ${DEFAULT_SITEMAP_ORIGIN}/sitemap.xml`
    );
  });

  it("generates sitemap.xml containing root, about, and all story routes with safe escaping", () => {
    const xml = buildSitemapXml({
      indexData: MOCK_INDEX,
      siteUrl: "https://bunko.example.jp/?ref=1&v=2",
    });

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain("<loc>https://bunko.example.jp/</loc>");
    expect(xml).toContain("<lastmod>2026-11-22</lastmod>");
    expect(xml).toContain("<loc>https://bunko.example.jp/courses</loc>");
    expect(xml).toContain("<loc>https://bunko.example.jp/courses/must_read_essentials</loc>");
    expect(xml).toContain("<loc>https://bunko.example.jp/entities</loc>");
    expect(xml).toContain("<loc>https://bunko.example.jp/entities/rosalyne</loc>");
    expect(xml).toContain("<loc>https://bunko.example.jp/entities/orobashi</loc>");
    expect(xml).toContain("<loc>https://bunko.example.jp/about</loc>");
    expect(xml).toContain("<loc>https://bunko.example.jp/story/crimson_witch</loc>");
    expect(xml).toContain("<lastmod>2026-11-15</lastmod>");
    expect(xml).toContain("<loc>https://bunko.example.jp/story/byakuyakoku</loc>");
    expect(xml).not.toContain("undefined");
  });
});
