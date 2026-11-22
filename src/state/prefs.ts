import { useEffect } from "react";
import type { DisplayPrefs, FontFamilyMode, FontSizeMode, ThemeMode } from "../types/story";
import { createPersistedStore } from "./persisted-store";

export const DISPLAY_PREFS_KEY = "genshin-books-display-prefs-v1";

export const FONT_SIZE_MAP: Record<FontSizeMode, string> = {
  small: "0.9375rem",
  medium: "1.0625rem",
  large: "1.2rem",
};

export const FONT_FAMILY_MAP: Record<FontFamilyMode, string> = {
  mincho: '"Shippori Mincho", serif',
  gothic: '"Noto Sans JP", sans-serif',
};

export const VALID_THEMES = new Set<ThemeMode>(["night", "paper", "sepia"]);

export const DEFAULT_PREFS: DisplayPrefs = {
  fontSize: "medium",
  fontFamily: "mincho",
  theme: "night",
};

export type DisplayPrefSetting = keyof DisplayPrefs;

function normalizeDisplayPrefs(raw: unknown): DisplayPrefs {
  const next: DisplayPrefs = { ...DEFAULT_PREFS };
  if (!raw || typeof raw !== "object") return next;
  const parsed = raw as Partial<Record<DisplayPrefSetting, unknown>>;
  if (typeof parsed.fontSize === "string" && parsed.fontSize in FONT_SIZE_MAP) {
    next.fontSize = parsed.fontSize as FontSizeMode;
  }
  if (typeof parsed.fontFamily === "string" && parsed.fontFamily in FONT_FAMILY_MAP) {
    next.fontFamily = parsed.fontFamily as FontFamilyMode;
  }
  if (typeof parsed.theme === "string" && VALID_THEMES.has(parsed.theme as ThemeMode)) {
    next.theme = parsed.theme as ThemeMode;
  }
  return next;
}

/**
 * 表示設定（テーマ・文字サイズ・書体）を html/body 属性と CSS カスタムプロパティへ反映する。
 */
export function applyDisplayPrefsToDocument(prefs: DisplayPrefs): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--reader-font-size", FONT_SIZE_MAP[prefs.fontSize]);
  root.style.setProperty("--reader-prose-font", FONT_FAMILY_MAP[prefs.fontFamily]);
  root.dataset.theme = prefs.theme;
  if (document.body) {
    document.body.dataset.theme = prefs.theme;
  }

  const scheme = prefs.theme === "night" ? "dark" : "light";
  root.style.colorScheme = scheme;
  let meta = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
  if (!meta && document.head) {
    meta = document.createElement("meta");
    meta.name = "color-scheme";
    document.head.appendChild(meta);
  }
  if (meta && meta.content !== scheme) {
    meta.content = scheme;
  }
}

/**
 * 表示設定スナップショットの変化を監視して DOM のテーマ属性と CSS カスタムプロパティへ同期する。
 */
export function useDocumentThemeEffect(prefs: DisplayPrefs, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    applyDisplayPrefsToDocument(prefs);
  }, [prefs, enabled]);
}

export interface DisplayPrefsStore {
  load(): void;
  set<K extends DisplayPrefSetting>(setting: K, value: DisplayPrefs[K] | (string & {})): boolean;
  getSnapshot(): DisplayPrefs;
  subscribe(listener: () => void): () => void;
}

export function createDisplayPrefsState(
  options?: { deferInitialLoad?: boolean }
): DisplayPrefsStore {
  const core = createPersistedStore<DisplayPrefs>({
    key: DISPLAY_PREFS_KEY,
    createDefault: () => ({ ...DEFAULT_PREFS }),
    deserialize: normalizeDisplayPrefs,
    deferInitialLoad: options?.deferInitialLoad,
  });

  function load(): void {
    core.load();
  }

  function set<K extends DisplayPrefSetting>(
    setting: K,
    value: DisplayPrefs[K] | (string & {})
  ): boolean {
    const prefs = core.getSnapshot();
    if (setting === "fontSize" && value in FONT_SIZE_MAP) {
      if (prefs.fontSize === value) return true;
      core.commit({ ...prefs, fontSize: value as FontSizeMode });
      return true;
    }
    if (setting === "fontFamily" && value in FONT_FAMILY_MAP) {
      if (prefs.fontFamily === value) return true;
      core.commit({ ...prefs, fontFamily: value as FontFamilyMode });
      return true;
    }
    if (setting === "theme" && VALID_THEMES.has(value as ThemeMode)) {
      if (prefs.theme === value) return true;
      core.commit({ ...prefs, theme: value as ThemeMode });
      return true;
    }
    return false;
  }

  return {
    load,
    set,
    getSnapshot: core.getSnapshot,
    subscribe: core.subscribe,
  };
}
