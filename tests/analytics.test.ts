import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAnalyticsClient,
  isLocalHostname,
  isValidMeasurementId,
  resolveAnalyticsRuntimeStatus,
  sanitizeSearchTerm,
  type AnalyticsEnvConfig,
} from "../src/analytics/ga4";
import {
  ANALYTICS_PREFS_KEY,
  createAnalyticsPrefsState,
  DEFAULT_ANALYTICS_PREFS,
} from "../src/state/analytics-prefs";

function installMockLocalStorage(initialMap: Record<string, string> = {}) {
  const store = new Map(Object.entries(initialMap));
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
      setItem: (key: string, value: string) => {
        store.set(key, String(value));
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => {
        store.clear();
      },
    },
  });
  return store;
}

function createFakeWindowAndDocument(hostname = "teyvat-library.pages.dev") {
  const appendedScripts: Array<{ src: string; async: boolean; measurementId: string | null }> = [];
  let cookieJar = "";
  const cookieWrites: string[] = [];

  const fakeWin = {
    location: {
      hostname,
      origin: `https://${hostname}`,
      pathname: "/",
    },
    dataLayer: undefined as unknown[] | undefined,
    gtag: undefined as ((...args: unknown[]) => void) | undefined,
  } as unknown as Window & typeof globalThis;

  const fakeDoc = {
    head: {
      appendChild: (node: unknown) => {
        const el = node as {
          src: string;
          async: boolean;
          getAttribute: (name: string) => string | null;
        };
        appendedScripts.push({
          src: el.src,
          async: el.async,
          measurementId: el.getAttribute("data-ga-measurement-id"),
        });
        return node;
      },
    },
    querySelector: (selector: string) => {
      const match = /data-ga-measurement-id="([^"]+)"/.exec(selector);
      if (!match) return null;
      return appendedScripts.some((s) => s.measurementId === match[1]) ? ({} as Element) : null;
    },
    createElement: () => {
      const attrs = new Map<string, string>();
      return {
        async: false,
        src: "",
        setAttribute: (name: string, value: string) => {
          attrs.set(name, value);
        },
        getAttribute: (name: string) => attrs.get(name) ?? null,
      };
    },
    get cookie() {
      return cookieJar;
    },
    set cookie(val: string) {
      cookieWrites.push(val);
      cookieJar = val;
    },
  } as unknown as Document;

  return { fakeWin, fakeDoc, appendedScripts, cookieWrites, setCookieJar: (v: string) => { cookieJar = v; } };
}

describe("analytics / ga4 core", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("environment & measurementId validation", () => {
    it("validates GA4 measurement IDs and local hostnames", () => {
      expect(isValidMeasurementId("G-3Y6JZZ21ZM")).toBe(true);
      expect(isValidMeasurementId("  g-abc123xyz  ")).toBe(true);
      expect(isValidMeasurementId("")).toBe(false);
      expect(isValidMeasurementId(undefined)).toBe(false);
      expect(isValidMeasurementId("GTM-PSVF728L")).toBe(false);
      expect(isValidMeasurementId("UA-12345-1")).toBe(false);

      expect(isLocalHostname("")).toBe(true);
      expect(isLocalHostname("localhost")).toBe(true);
      expect(isLocalHostname("LOCALHOST")).toBe(true);
      expect(isLocalHostname("127.0.0.1")).toBe(true);
      expect(isLocalHostname("[::1]")).toBe(true);
      expect(isLocalHostname("::1")).toBe(true);
      expect(isLocalHostname("teyvat-library.pages.dev")).toBe(false);
    });

    it("resolves runtime status across prod, dev, localhost, debug, and optOut combinations", () => {
      const base: AnalyticsEnvConfig = {
        measurementId: "G-3Y6JZZ21ZM",
        isProd: true,
        isTestMode: false,
        isDebug: false,
        hostname: "teyvat-library.pages.dev",
      };

      expect(resolveAnalyticsRuntimeStatus(base, false)).toBe("active");
      expect(resolveAnalyticsRuntimeStatus(base, true)).toBe("opted_out");
      expect(resolveAnalyticsRuntimeStatus({ ...base, isTestMode: true }, false)).toBe("disabled_env");
      expect(resolveAnalyticsRuntimeStatus({ ...base, measurementId: "" }, false)).toBe("disabled_env");
      expect(resolveAnalyticsRuntimeStatus({ ...base, measurementId: "GTM-PSVF728L" }, false)).toBe("disabled_env");
      expect(resolveAnalyticsRuntimeStatus({ ...base, isProd: false }, false)).toBe("disabled_env");
      expect(resolveAnalyticsRuntimeStatus({ ...base, hostname: "localhost" }, false)).toBe("disabled_env");
      expect(resolveAnalyticsRuntimeStatus({ ...base, hostname: "127.0.0.1" }, false)).toBe("disabled_env");

      // VITE_GA_DEBUG=true enables local debug verification unless test mode or opted out
      expect(
        resolveAnalyticsRuntimeStatus({ ...base, isProd: false, hostname: "localhost", isDebug: true }, false)
      ).toBe("active");
      expect(
        resolveAnalyticsRuntimeStatus({ ...base, isProd: false, hostname: "localhost", isDebug: true }, true)
      ).toBe("opted_out");
    });
  });

  describe("sanitizeSearchTerm", () => {
    it("normalizes whitespace, masks emails and phone-like numbers, keeps short numbers, and caps at 100 codepoints", () => {
      expect(sanitizeSearchTerm("   ")).toBe("");
      expect(sanitizeSearchTerm("　ロザリン　　水時計  ")).toBe("ロザリン 水時計");
      expect(sanitizeSearchTerm("連絡 user.name+test@example.co.jp まで")).toBe(
        "連絡 [redacted] まで"
      );
      expect(sanitizeSearchTerm("電話 090-1234-5678 と +81 90 1234 5678 と 0312345678")).toBe(
        "電話 [redacted] と [redacted] と [redacted]"
      );
      expect(sanitizeSearchTerm("500年前の厄災 1234-5678")).toBe("500年前の厄災 1234-5678");

      // Surrogate pair safe 100-codepoint cap (✨ is 1 codepoint; 𩸽 is 2 UTF-16 code units / 1 codepoint)
      const longInput = "𩸽".repeat(99) + "あいうえお";
      const sanitized = sanitizeSearchTerm(longInput);
      expect(Array.from(sanitized)).toHaveLength(100);
      expect(sanitized.endsWith("あ")).toBe(true);
    });
  });

  describe("createAnalyticsClient lifecycle, opt-out, and event payloads", () => {
    it("injects gtag.js once lazily on first event with send_page_view: false and emits all 8 event payloads", () => {
      const { fakeWin, fakeDoc, appendedScripts } = createFakeWindowAndDocument();
      const client = createAnalyticsClient({
        env: {
          measurementId: "G-3Y6JZZ21ZM",
          isProd: true,
          isTestMode: false,
          isDebug: false,
          hostname: "teyvat-library.pages.dev",
        },
        windowRef: fakeWin,
        documentRef: fakeDoc,
      });

      expect(client.getStatus()).toBe("active");
      expect(client.getMeasurementId()).toBe("G-3Y6JZZ21ZM");
      expect(appendedScripts).toHaveLength(0);

      client.trackPageView({
        pagePath: "/story/crimson_witch",
        pageTitle: "燃え盛る炎の魔女 | テイワット文庫",
        storyId: "crimson_witch",
        storyCategory: "artifact",
      });

      expect(appendedScripts).toHaveLength(1);
      expect(appendedScripts[0]).toEqual({
        src: "https://www.googletagmanager.com/gtag/js?id=G-3Y6JZZ21ZM",
        async: true,
        measurementId: "G-3Y6JZZ21ZM",
      });

      const gtagSpy = vi.fn();
      fakeWin.gtag = gtagSpy;

      // Subsequent events do not re-append script
      client.trackStoryOpen({
        storyId: "crimson_witch",
        storyCategory: "artifact",
        source: "featured",
      });
      client.trackSearch({ query: "  ロザリン  ", resultCount: 2, includeTruth: true });
      client.trackSearch({ query: "   ", resultCount: 0, includeTruth: false }); // skipped
      client.trackStoryComplete({
        storyId: "crimson_witch",
        storyCategory: "artifact",
        method: "auto_scroll",
      });
      client.trackGlossaryOpen({ storyId: "crimson_witch", termId: "cw_lover" });
      client.trackTruthMemoOpen({ storyId: "crimson_witch" });
      client.trackBookmarkToggle({ storyId: "crimson_witch", action: "add", surface: "reader" });
      client.trackShelfFilterChange({ filterType: "category", filterValue: "artifact" });
      client.trackStoryShare({ storyId: "crimson_witch", storyCategory: "artifact", method: "copy" });

      expect(appendedScripts).toHaveLength(1);
      expect(gtagSpy.mock.calls).toEqual([
        [
          "event",
          "story_open",
          { story_id: "crimson_witch", story_category: "artifact", source: "featured" },
        ],
        [
          "event",
          "search",
          { search_term: "ロザリン", result_count: 2, has_results: true, include_truth: true },
        ],
        [
          "event",
          "story_complete",
          { story_id: "crimson_witch", story_category: "artifact", method: "auto_scroll" },
        ],
        ["event", "glossary_open", { story_id: "crimson_witch", term_id: "cw_lover" }],
        ["event", "truth_memo_open", { story_id: "crimson_witch" }],
        [
          "event",
          "bookmark_toggle",
          { story_id: "crimson_witch", action: "add", surface: "reader" },
        ],
        ["event", "shelf_filter_change", { filter_type: "category", filter_value: "artifact" }],
        [
          "event",
          "story_share",
          { story_id: "crimson_witch", story_category: "artifact", method: "copy" },
        ],
      ]);

      // Verify initial config call stored in dataLayer used send_page_view: false
      const calls = (fakeWin.dataLayer || []).map((entry) => Array.from(entry as ArrayLike<unknown>));
      expect(calls[0]?.[0]).toBe("js");
      expect(calls[1]).toEqual(["config", "G-3Y6JZZ21ZM", { send_page_view: false }]);
      expect(calls[2]).toEqual([
        "event",
        "page_view",
        {
          page_path: "/story/crimson_witch",
          page_title: "燃え盛る炎の魔女 | テイワット文庫",
          page_location: "https://teyvat-library.pages.dev/story/crimson_witch",
          story_id: "crimson_witch",
          story_category: "artifact",
        },
      ]);
    });

    it("does not duplicate pathname in page_location when navigating via path URLs", () => {
      const { fakeWin, fakeDoc } = createFakeWindowAndDocument("teyvat-library.pages.dev");
      fakeWin.location.pathname = "/story/crimson_witch";

      const client = createAnalyticsClient({
        env: {
          measurementId: "G-3Y6JZZ21ZM",
          isProd: true,
          isTestMode: false,
          isDebug: false,
          hostname: "teyvat-library.pages.dev",
        },
        windowRef: fakeWin,
        documentRef: fakeDoc,
      });

      client.trackPageView({
        pagePath: "/story/crimson_witch",
        pageTitle: "燃え盛る炎の魔女 | テイワット文庫",
        storyId: "crimson_witch",
        storyCategory: "artifact",
      });

      fakeWin.location.pathname = "/about";
      client.trackPageView({
        pagePath: "/about",
        pageTitle: "このサイトについて | テイワット文庫",
      });

      const calls = (fakeWin.dataLayer || []).map((entry) => Array.from(entry as ArrayLike<unknown>));
      expect(calls[2]).toEqual([
        "event",
        "page_view",
        {
          page_path: "/story/crimson_witch",
          page_title: "燃え盛る炎の魔女 | テイワット文庫",
          page_location: "https://teyvat-library.pages.dev/story/crimson_witch",
          story_id: "crimson_witch",
          story_category: "artifact",
        },
      ]);
      expect(calls[3]).toEqual([
        "event",
        "page_view",
        {
          page_path: "/about",
          page_title: "このサイトについて | テイワット文庫",
          page_location: "https://teyvat-library.pages.dev/about",
        },
      ]);
    });

    it("never injects gtag.js when opted out initially and stops tracking + expires cookies on runtime opt-out", () => {
      const { fakeWin, fakeDoc, appendedScripts, cookieWrites, setCookieJar } =
        createFakeWindowAndDocument("sub.example.com");
      const client = createAnalyticsClient({
        env: {
          measurementId: "G-3Y6JZZ21ZM",
          isProd: true,
          isTestMode: false,
          isDebug: false,
          hostname: "sub.example.com",
        },
        windowRef: fakeWin,
        documentRef: fakeDoc,
      });

      // Initially opted out: zero script injections and zero events
      client.setOptOut(true);
      expect(client.getStatus()).toBe("opted_out");
      expect(client.isOptedOut()).toBe(true);
      client.trackPageView({ pagePath: "/", pageTitle: "テイワット文庫" });
      expect(appendedScripts).toHaveLength(0);
      expect(fakeWin["ga-disable-G-3Y6JZZ21ZM"]).toBe(true);

      // Re-enable analytics: initializes dynamically
      client.setOptOut(false);
      expect(client.getStatus()).toBe("active");
      expect(appendedScripts).toHaveLength(1);
      expect(fakeWin["ga-disable-G-3Y6JZZ21ZM"]).toBe(false);

      const gtagSpy = vi.fn();
      fakeWin.gtag = gtagSpy;
      setCookieJar("_ga=GA1.1.12345; _ga_3Y6JZZ21ZM=GS1.1.999; other=ok");

      // Opt-out mid-session: sets ga-disable flag, expires _ga cookies, and blocks further events
      client.setOptOut(true);
      expect(fakeWin["ga-disable-G-3Y6JZZ21ZM"]).toBe(true);
      expect(cookieWrites.some((c) => c.startsWith("_ga=; Max-Age=0"))).toBe(true);
      expect(cookieWrites.some((c) => c.startsWith("_ga_3Y6JZZ21ZM=; Max-Age=0"))).toBe(true);
      expect(cookieWrites.some((c) => c.startsWith("other="))).toBe(false);

      client.trackTruthMemoOpen({ storyId: "crimson_witch" });
      expect(gtagSpy).not.toHaveBeenCalled();
    });

    it("adds debug_mode: true and logs via logger when isDebug is enabled", () => {
      const { fakeWin, fakeDoc } = createFakeWindowAndDocument("localhost");
      const logger = vi.fn();
      const client = createAnalyticsClient({
        env: {
          measurementId: "G-3Y6JZZ21ZM",
          isProd: false,
          isTestMode: false,
          isDebug: true,
          hostname: "localhost",
        },
        windowRef: fakeWin,
        documentRef: fakeDoc,
        logger,
      });

      expect(client.getStatus()).toBe("active");
      client.trackTruthMemoOpen({ storyId: "crimson_witch" });

      const calls = (fakeWin.dataLayer || []).map((entry) => Array.from(entry as ArrayLike<unknown>));
      expect(calls[1]).toEqual([
        "config",
        "G-3Y6JZZ21ZM",
        { send_page_view: false, debug_mode: true },
      ]);
      expect(calls[2]).toEqual([
        "event",
        "truth_memo_open",
        { story_id: "crimson_witch", debug_mode: true },
      ]);
      expect(logger).toHaveBeenCalledWith("[GA4]", "truth_memo_open", {
        story_id: "crimson_witch",
        debug_mode: true,
      });
    });

    it("remains a total no-op in test or disabled environments", () => {
      const { fakeWin, fakeDoc, appendedScripts } = createFakeWindowAndDocument("localhost");
      const client = createAnalyticsClient({
        env: {
          measurementId: "G-3Y6JZZ21ZM",
          isProd: false,
          isTestMode: true,
          isDebug: false,
          hostname: "localhost",
        },
        windowRef: fakeWin,
        documentRef: fakeDoc,
      });

      expect(client.getStatus()).toBe("disabled_env");
      client.trackPageView({ pagePath: "/", pageTitle: "テイワット文庫" });
      expect(appendedScripts).toHaveLength(0);
      expect(fakeWin.gtag).toBeUndefined();
    });
  });
});

describe("analytics-prefs store", () => {
  beforeEach(() => {
    installMockLocalStorage();
  });

  it("persists optOut state, recovers from invalid JSON, handles storage errors, and syncs across tabs", () => {
    installMockLocalStorage({ [ANALYTICS_PREFS_KEY]: "{broken" });
    const store = createAnalyticsPrefsState();
    expect(store.getSnapshot()).toEqual(DEFAULT_ANALYTICS_PREFS);

    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    // No-op write does not notify
    store.setOptOut(false);
    expect(listener).toHaveBeenCalledTimes(0);

    expect(store.toggleOptOut()).toBe(true);
    expect(store.getSnapshot()).toEqual({ optOut: true });
    expect(listener).toHaveBeenCalledTimes(1);

    const reloaded = createAnalyticsPrefsState();
    expect(reloaded.getSnapshot()).toEqual({ optOut: true });

    // Invalid field value resets cleanly on storage event
    localStorage.setItem(ANALYTICS_PREFS_KEY, JSON.stringify({ optOut: "invalid" }));
    window.dispatchEvent(new StorageEvent("storage", { key: ANALYTICS_PREFS_KEY }));
    expect(store.getSnapshot()).toEqual({ optOut: false });

    // Storage write throw does not crash memory state
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: () => {
          throw new Error("denied");
        },
        setItem: () => {
          throw new Error("quota");
        },
      },
    });
    store.setOptOut(true);
    expect(store.getSnapshot()).toEqual({ optOut: true });

    unsubscribe();
  });
});
