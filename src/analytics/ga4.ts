import type { ShelfCategoryId, StoryCategoryId } from "../types/story";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    [key: `ga-disable-${string}`]: boolean | undefined;
  }
}

export type AnalyticsRuntimeStatus = "active" | "opted_out" | "disabled_env";

export type StoryOpenSource =
  | "card"
  | "featured"
  | "random"
  | "resume"
  | "search_snippet"
  | "connected"
  | "evidence";

export type StoryCompleteMethod = "auto_scroll" | "auto_lore" | "manual";

export type StoryShareMethod = "x" | "copy";

export type BookmarkSurface = "shelf" | "reader";

export type ShelfFilterTrackType =
  | "category"
  | "status"
  | "entity"
  | "region"
  | "sort"
  | "include_truth"
  | "reset";

export interface AnalyticsEnvConfig {
  measurementId?: string;
  isProd: boolean;
  isTestMode: boolean;
  isDebug: boolean;
  hostname: string;
}

export interface AnalyticsClientDeps {
  env?: Partial<AnalyticsEnvConfig>;
  windowRef?: (Window & typeof globalThis) | undefined;
  documentRef?: Document | undefined;
  logger?: (message: string, ...args: unknown[]) => void;
}

export interface PageViewParams {
  pagePath: string;
  pageTitle: string;
  storyId?: string;
  storyCategory?: StoryCategoryId;
}

export interface StoryOpenParams {
  storyId: string;
  storyCategory?: StoryCategoryId;
  source: StoryOpenSource;
}

export interface SearchTrackParams {
  query: string;
  resultCount: number;
  includeTruth: boolean;
}

export interface StoryCompleteParams {
  storyId: string;
  storyCategory: StoryCategoryId;
  method: StoryCompleteMethod;
}

export interface GlossaryOpenParams {
  storyId: string;
  termId: string;
}

export interface TruthMemoOpenParams {
  storyId: string;
}

export interface BookmarkToggleParams {
  storyId: string;
  action: "add" | "remove";
  surface: BookmarkSurface;
}

export interface ShelfFilterChangeParams {
  filterType: ShelfFilterTrackType;
  filterValue: string | ShelfCategoryId;
}

export interface StoryShareParams {
  storyId: string;
  storyCategory: StoryCategoryId;
  method: StoryShareMethod;
}

export interface AnalyticsClient {
  getStatus(): AnalyticsRuntimeStatus;
  isOptedOut(): boolean;
  setOptOut(optOut: boolean): void;
  getMeasurementId(): string | null;
  trackPageView(params: PageViewParams): void;
  trackStoryOpen(params: StoryOpenParams): void;
  trackSearch(params: SearchTrackParams): void;
  trackStoryComplete(params: StoryCompleteParams): void;
  trackGlossaryOpen(params: GlossaryOpenParams): void;
  trackTruthMemoOpen(params: TruthMemoOpenParams): void;
  trackBookmarkToggle(params: BookmarkToggleParams): void;
  trackShelfFilterChange(params: ShelfFilterChangeParams): void;
  trackStoryShare(params: StoryShareParams): void;
}

const MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]+$/i;
const LOCAL_HOSTNAMES = new Set(["", "localhost", "127.0.0.1", "[::1]", "::1"]);
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_CANDIDATE_PATTERN = /(?:\+?\d[\d\s-]{8,}\d)/g;
const MAX_SEARCH_TERM_LENGTH = 100;

type EventParamValue = string | number | boolean | undefined;

/**
 * GA4 測定 ID（G-XXXXXXXXXX 形式）の妥当性を検証する。
 */
export function isValidMeasurementId(id: string | undefined): id is string {
  if (typeof id !== "string") return false;
  return MEASUREMENT_ID_PATTERN.test(id.trim());
}

/**
 * ローカル開発・テスト環境向けのホスト名かを判定する。
 */
export function isLocalHostname(hostname: string): boolean {
  return LOCAL_HOSTNAMES.has(hostname.trim().toLowerCase());
}

/**
 * 実行環境およびオプトアウト設定から現在の GA4 稼働ステータスを決定する。
 */
export function resolveAnalyticsRuntimeStatus(
  config: AnalyticsEnvConfig,
  optOut: boolean
): AnalyticsRuntimeStatus {
  if (config.isTestMode || !isValidMeasurementId(config.measurementId)) {
    return "disabled_env";
  }
  const envEligible = config.isDebug || (config.isProd && !isLocalHostname(config.hostname));
  if (!envEligible) {
    return "disabled_env";
  }
  return optOut ? "opted_out" : "active";
}

/**
 * 横断検索語句を PII（メール・電話番号様数値列）マスクおよび最大100文字制限でサニタイズする。
 */
export function sanitizeSearchTerm(raw: string): string {
  if (typeof raw !== "string") return "";
  const normalized = raw.trim().replace(/[\s\u3000]+/g, " ");
  if (!normalized) return "";

  const emailMasked = normalized.replace(EMAIL_PATTERN, "[redacted]");
  const phoneMasked = emailMasked.replace(PHONE_CANDIDATE_PATTERN, (matched) => {
    const digitCount = matched.replace(/\D/g, "").length;
    return digitCount >= 10 ? "[redacted]" : matched;
  });

  return Array.from(phoneMasked).slice(0, MAX_SEARCH_TERM_LENGTH).join("").trim();
}

function readDefaultEnvConfig(): AnalyticsEnvConfig {
  const metaEnv = import.meta.env;
  const runtimeProcess = (globalThis as { process?: { env?: { VITEST?: string } } }).process;
  const isTestMode = metaEnv?.MODE === "test" || Boolean(runtimeProcess?.env?.VITEST);

  return {
    measurementId: metaEnv?.VITE_GA_MEASUREMENT_ID?.trim() || undefined,
    isProd: Boolean(metaEnv?.PROD),
    isTestMode,
    isDebug: metaEnv?.VITE_GA_DEBUG === "true",
    hostname: typeof window !== "undefined" ? window.location.hostname : "",
  };
}

function buildCookieDomainCandidates(hostname: string): Array<string | undefined> {
  const candidates: Array<string | undefined> = [undefined];
  const trimmed = hostname.trim();
  if (!trimmed || isLocalHostname(trimmed)) {
    return candidates;
  }
  candidates.push(trimmed);
  const parts = trimmed.split(".");
  for (let i = 0; i < parts.length - 1; i += 1) {
    candidates.push(`.${parts.slice(i).join(".")}`);
  }
  return candidates;
}

function clearGaCookies(doc: Document, hostname: string): void {
  try {
    const rawCookie = doc.cookie || "";
    if (!rawCookie) return;
    const gaNames = rawCookie
      .split(";")
      .map((part) => part.split("=")[0]?.trim() || "")
      .filter((name) => name === "_ga" || name.startsWith("_ga_"));
    if (gaNames.length === 0) return;

    const domains = buildCookieDomainCandidates(hostname);
    for (const name of gaNames) {
      for (const domain of domains) {
        const domainAttr = domain ? `; domain=${domain}` : "";
        doc.cookie = `${name}=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${domainAttr}`;
      }
    }
  } catch {
    // 制限環境や Cookie アクセス拒否時は無視して継続する
  }
}

function setGaDisableFlag(
  win: (Window & typeof globalThis) | undefined,
  measurementId: string | undefined,
  disabled: boolean
): void {
  if (!win || !isValidMeasurementId(measurementId)) return;
  const key = `ga-disable-${measurementId}` as `ga-disable-${string}`;
  win[key] = disabled;
}

function cleanEventParams(
  rawParams: Record<string, EventParamValue>,
  isDebug: boolean
): Record<string, string | number | boolean> {
  const cleaned: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(rawParams)) {
    if (value !== undefined) {
      cleaned[key] = value;
    }
  }
  if (isDebug) {
    cleaned.debug_mode = true;
  }
  return cleaned;
}

/**
 * GA4 クライアント（環境ガード・動的 gtag.js 読み込み・オプトアウト制御・型安全イベント送信）を生成する。
 */
export function createAnalyticsClient(deps: AnalyticsClientDeps = {}): AnalyticsClient {
  const defaults = readDefaultEnvConfig();
  const rawId =
    deps.env && "measurementId" in deps.env ? deps.env.measurementId : defaults.measurementId;
  const trimmedId = typeof rawId === "string" ? rawId.trim() : undefined;

  const config: AnalyticsEnvConfig = {
    ...defaults,
    ...deps.env,
    measurementId: trimmedId || undefined,
  };

  const win =
    "windowRef" in deps
      ? deps.windowRef
      : typeof window !== "undefined"
        ? window
        : undefined;
  const doc =
    "documentRef" in deps
      ? deps.documentRef
      : typeof document !== "undefined"
        ? document
        : undefined;
  const log = deps.logger ?? ((msg: string, ...args: unknown[]) => console.debug(msg, ...args));

  let optOut = false;
  let initialized = false;

  function getStatus(): AnalyticsRuntimeStatus {
    return resolveAnalyticsRuntimeStatus(config, optOut);
  }

  function ensureInitialized(): boolean {
    if (getStatus() !== "active") return false;
    if (!win || !doc || !isValidMeasurementId(config.measurementId)) return false;

    const measurementId = config.measurementId;
    setGaDisableFlag(win, measurementId, false);

    if (!initialized) {
      win.dataLayer = win.dataLayer || [];
      if (typeof win.gtag !== "function") {
        // gtag.js は通常配列ではなく Arguments オブジェクトの格納を期待するため function 宣言を使う
        win.gtag = function gtag() {
          win.dataLayer!.push(arguments);
        };
      }

      const existingScript = doc.querySelector(
        `script[data-ga-measurement-id="${measurementId}"]`
      );
      if (!existingScript && doc.head) {
        const script = doc.createElement("script");
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
        script.setAttribute("data-ga-measurement-id", measurementId);
        doc.head.appendChild(script);
      }

      win.gtag("js", new Date());
      win.gtag("config", measurementId, {
        send_page_view: false,
        ...(config.isDebug ? { debug_mode: true } : {}),
      });
      initialized = true;
    }

    return true;
  }

  function setOptOut(nextOptOut: boolean): void {
    optOut = nextOptOut;
    setGaDisableFlag(win, config.measurementId, nextOptOut);

    if (nextOptOut) {
      if (doc) {
        clearGaCookies(doc, config.hostname);
      }
      return;
    }

    if (getStatus() === "active") {
      ensureInitialized();
    }
  }

  function sendEvent(eventName: string, params: Record<string, EventParamValue>): void {
    if (getStatus() !== "active") return;
    if (!ensureInitialized()) return;

    const cleaned = cleanEventParams(params, config.isDebug);
    win?.gtag?.("event", eventName, cleaned);

    if (config.isDebug && !config.isTestMode) {
      log("[GA4]", eventName, cleaned);
    }
  }

  return {
    getStatus,
    isOptedOut: () => optOut,
    setOptOut,
    getMeasurementId: () => (isValidMeasurementId(config.measurementId) ? config.measurementId : null),

    trackPageView({ pagePath, pageTitle, storyId, storyCategory }) {
      const origin =
        win?.location?.origin && win.location.origin !== "null" ? win.location.origin : "";
      const normalizedPath = pagePath.startsWith("/") ? pagePath : `/${pagePath}`;
      const pageLocation = origin ? `${origin}${normalizedPath}` : undefined;

      sendEvent("page_view", {
        page_path: normalizedPath,
        page_title: pageTitle,
        page_location: pageLocation,
        story_id: storyId,
        story_category: storyCategory,
      });
    },

    trackStoryOpen({ storyId, storyCategory, source }) {
      sendEvent("story_open", {
        story_id: storyId,
        story_category: storyCategory,
        source,
      });
    },

    trackSearch({ query, resultCount, includeTruth }) {
      const sanitized = sanitizeSearchTerm(query);
      if (!sanitized) return;
      sendEvent("search", {
        search_term: sanitized,
        result_count: resultCount,
        has_results: resultCount > 0,
        include_truth: includeTruth,
      });
    },

    trackStoryComplete({ storyId, storyCategory, method }) {
      sendEvent("story_complete", {
        story_id: storyId,
        story_category: storyCategory,
        method,
      });
    },

    trackGlossaryOpen({ storyId, termId }) {
      sendEvent("glossary_open", {
        story_id: storyId,
        term_id: termId,
      });
    },

    trackTruthMemoOpen({ storyId }) {
      sendEvent("truth_memo_open", {
        story_id: storyId,
      });
    },

    trackBookmarkToggle({ storyId, action, surface }) {
      sendEvent("bookmark_toggle", {
        story_id: storyId,
        action,
        surface,
      });
    },

    trackShelfFilterChange({ filterType, filterValue }) {
      sendEvent("shelf_filter_change", {
        filter_type: filterType,
        filter_value: filterValue,
      });
    },

    trackStoryShare({ storyId, storyCategory, method }) {
      sendEvent("story_share", {
        story_id: storyId,
        story_category: storyCategory,
        method,
      });
    },
  };
}

export const analytics = createAnalyticsClient();
