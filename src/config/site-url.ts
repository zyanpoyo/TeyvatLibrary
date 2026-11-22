/**
 * サイト基準 URL（VITE_SITE_URL）の正規化と canonical URL 生成を行うユーティリティ。
 */
export function normalizeSiteUrl(raw?: string | null): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    const pathname = parsed.pathname.replace(/\/+$/, "");
    return pathname ? `${parsed.origin}${pathname}` : parsed.origin;
  } catch {
    return null;
  }
}

export function getConfiguredSiteUrl(): string | null {
  const viteSiteUrl = (import.meta as { env?: Record<string, string | undefined> }).env
    ?.VITE_SITE_URL;
  const nodeSiteUrl = (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process?.env?.VITE_SITE_URL;
  return normalizeSiteUrl(viteSiteUrl || nodeSiteUrl);
}

export function buildCanonicalUrl(
  pathname: string,
  siteUrl: string | null = getConfiguredSiteUrl()
): string | null {
  const base = normalizeSiteUrl(siteUrl);
  if (!base) return null;
  const normalizedPath =
    pathname === "/" ? "/" : pathname.startsWith("/") ? pathname : `/${pathname}`;
  return normalizedPath === "/" ? `${base}/` : `${base}${normalizedPath}`;
}

export function buildCanonicalMetaTag(
  pathname: string,
  siteUrl: string | null = getConfiguredSiteUrl()
): Array<{ tagName: "link"; rel: "canonical"; href: string }> {
  const canonical = buildCanonicalUrl(pathname, siteUrl);
  return canonical ? [{ tagName: "link", rel: "canonical", href: canonical }] : [];
}
