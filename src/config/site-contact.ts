export const DEFAULT_OPERATOR_NAME = "zyanpoyo";
export const DEFAULT_GITHUB_ISSUES_URL = "https://github.com/zyanpoyo/TeyvatLibrary/issues";
export const DEFAULT_CONTACT_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLScrKc3YA_ItOhFH5-ZOccgwfYJr5tiq9UY7JMcHznZoHkiM5Q/viewform?usp=header";
export const DEFAULT_CONTACT_X_URL = "https://x.com/zyanpoyo";

export interface SiteContactEnv {
  VITE_GITHUB_ISSUES_URL?: string;
  VITE_CONTACT_FORM_URL?: string;
  VITE_CONTACT_EMAIL?: string;
  VITE_CONTACT_X_URL?: string;
}

export interface SiteContactConfig {
  operatorName: string;
  githubIssuesUrl: string;
  contactFormUrl: string | null;
  contactEmail: string | null;
  contactXUrl: string | null;
}

const SIMPLE_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * 外部リンク用 URL が http(s) スキームの妥当な URL かを検証して正規化する。
 */
export function sanitizeExternalHttpUrl(raw: string | undefined): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * 連絡先メールアドレス文字列の形式を検証し、前後空白を除いた値を返す。
 */
export function sanitizeContactEmail(raw: string | undefined): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || /[\r\n]/.test(trimmed)) return null;
  return SIMPLE_EMAIL_PATTERN.test(trimmed) ? trimmed : null;
}

/**
 * 環境変数マップから安全な連絡先設定を解決する。
 */
export function resolveSiteContactConfig(env?: Partial<SiteContactEnv>): SiteContactConfig {
  return {
    operatorName: DEFAULT_OPERATOR_NAME,
    githubIssuesUrl:
      sanitizeExternalHttpUrl(env?.VITE_GITHUB_ISSUES_URL) ?? DEFAULT_GITHUB_ISSUES_URL,
    contactFormUrl: sanitizeExternalHttpUrl(env?.VITE_CONTACT_FORM_URL) ?? DEFAULT_CONTACT_FORM_URL,
    contactEmail: sanitizeContactEmail(env?.VITE_CONTACT_EMAIL),
    contactXUrl: sanitizeExternalHttpUrl(env?.VITE_CONTACT_X_URL) ?? DEFAULT_CONTACT_X_URL,
  };
}

/**
 * Vite の実行環境変数（import.meta.env）から連絡先設定を読み込む。
 */
export function readDefaultSiteContactConfig(): SiteContactConfig {
  const metaEnv = (import.meta as { env?: Partial<SiteContactEnv> }).env;
  return resolveSiteContactConfig(metaEnv);
}
