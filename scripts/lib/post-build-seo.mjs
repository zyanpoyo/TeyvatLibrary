import fs from "node:fs";
import path from "node:path";

export const DEFAULT_SITEMAP_ORIGIN = "https://teyvat-library.workers.dev";

export function resolveSitemapOrigin(rawSiteUrl) {
  if (typeof rawSiteUrl !== "string" || !rawSiteUrl.trim()) {
    return DEFAULT_SITEMAP_ORIGIN;
  }
  try {
    const parsed = new URL(rawSiteUrl.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return DEFAULT_SITEMAP_ORIGIN;
    }
    const pathname = parsed.pathname.replace(/\/+$/, "");
    return pathname ? `${parsed.origin}${pathname}` : parsed.origin;
  } catch {
    return DEFAULT_SITEMAP_ORIGIN;
  }
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function extractIsoDate(value) {
  if (typeof value !== "string") return null;
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim());
  return match ? match[1] : null;
}

export function buildRobotsTxt({ siteUrl } = {}) {
  const origin = resolveSitemapOrigin(siteUrl);
  return `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`;
}

export function buildSitemapXml({ indexData, siteUrl } = {}) {
  const origin = resolveSitemapOrigin(siteUrl);
  const indexLastmod = extractIsoDate(indexData?.generatedAt);

  const entries = [
    { loc: `${origin}/`, lastmod: indexLastmod },
    { loc: `${origin}/about`, lastmod: null },
  ];

  for (const story of indexData?.stories ?? []) {
    if (!story?.id) continue;
    entries.push({
      loc: `${origin}/story/${encodeURIComponent(story.id)}`,
      lastmod: extractIsoDate(story.addedAt),
    });
  }

  const urlsXml = entries
    .map((entry) => {
      const lastmodTag = entry.lastmod
        ? `\n    <lastmod>${escapeXml(entry.lastmod)}</lastmod>`
        : "";
      return `  <url>\n    <loc>${escapeXml(entry.loc)}</loc>${lastmodTag}\n  </url>`;
    })
    .join("\n");

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `${urlsXml}\n` +
    `</urlset>\n`
  );
}

export function writePostBuildSeoAssets({ clientDir, indexData, siteUrl } = {}) {
  fs.mkdirSync(clientDir, { recursive: true });

  const notFoundHtml = path.join(clientDir, "404", "index.html");
  const rootNotFoundHtml = path.join(clientDir, "404.html");
  if (fs.existsSync(notFoundHtml)) {
    fs.copyFileSync(notFoundHtml, rootNotFoundHtml);
  }

  fs.writeFileSync(
    path.join(clientDir, "robots.txt"),
    buildRobotsTxt({ siteUrl }),
    "utf8"
  );
  fs.writeFileSync(
    path.join(clientDir, "sitemap.xml"),
    buildSitemapXml({ indexData, siteUrl }),
    "utf8"
  );
}
