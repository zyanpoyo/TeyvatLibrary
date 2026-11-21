import { createPersistedStore } from "./persisted-store";

export const ANALYTICS_PREFS_KEY = "genshin-books-analytics-prefs-v1";

export interface AnalyticsPrefs {
  optOut: boolean;
}

export const DEFAULT_ANALYTICS_PREFS: AnalyticsPrefs = {
  optOut: false,
};

function normalizeAnalyticsPrefs(raw: unknown): AnalyticsPrefs {
  if (raw && typeof raw === "object") {
    const parsed = raw as Partial<Record<keyof AnalyticsPrefs, unknown>>;
    if (typeof parsed.optOut === "boolean") {
      return { optOut: parsed.optOut };
    }
  }
  return { ...DEFAULT_ANALYTICS_PREFS };
}

export interface AnalyticsPrefsStore {
  load(): void;
  setOptOut(optOut: boolean): void;
  toggleOptOut(): boolean;
  getSnapshot(): AnalyticsPrefs;
  subscribe(listener: () => void): () => void;
}

/**
 * Google Analytics オプトアウト設定を localStorage へ永続化し、別タブ間同期を提供するストア。
 */
export function createAnalyticsPrefsState(): AnalyticsPrefsStore {
  const core = createPersistedStore<AnalyticsPrefs>({
    key: ANALYTICS_PREFS_KEY,
    createDefault: () => ({ ...DEFAULT_ANALYTICS_PREFS }),
    deserialize: normalizeAnalyticsPrefs,
  });

  function load(): void {
    core.load();
  }

  function setOptOut(optOut: boolean): void {
    const current = core.getSnapshot();
    if (current.optOut === optOut) return;
    core.commit({ optOut });
  }

  function toggleOptOut(): boolean {
    const next = !core.getSnapshot().optOut;
    setOptOut(next);
    return next;
  }

  return {
    load,
    setOptOut,
    toggleOptOut,
    getSnapshot: core.getSnapshot,
    subscribe: core.subscribe,
  };
}
