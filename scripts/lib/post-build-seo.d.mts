import type { StoriesIndexData } from "../../src/types/story";

export const DEFAULT_SITEMAP_ORIGIN: string;

export function resolveSitemapOrigin(rawSiteUrl?: string | null): string;

export function buildRobotsTxt(options?: { siteUrl?: string | null }): string;

export function buildSitemapXml(options: {
  indexData: StoriesIndexData;
  siteUrl?: string | null;
}): string;

export function writePostBuildSeoAssets(options: {
  clientDir: string;
  indexData: StoriesIndexData;
  siteUrl?: string | null;
}): void;
