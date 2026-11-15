import type { DisplayPrefs, FontFamilyMode, FontSizeMode, ThemeMode } from "../types/story";

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

export interface DisplayPrefsStore {
  load(): void;
  save(): void;
  set(setting: DisplayPrefSetting, value: string): boolean;
  getSnapshot(): DisplayPrefs;
  subscribe(listener: () => void): () => void;
}

export function createDisplayPrefsState(): DisplayPrefsStore {
  let prefs: DisplayPrefs = { ...DEFAULT_PREFS };
  const listeners = new Set<() => void>();

  function emit(): void {
    for (const listener of listeners) {
      listener();
    }
  }

  function load(): void {
    const next: DisplayPrefs = { ...DEFAULT_PREFS };
    try {
      const raw = localStorage.getItem(DISPLAY_PREFS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Record<DisplayPrefSetting, unknown>>;
        if (parsed && typeof parsed.fontSize === "string" && parsed.fontSize in FONT_SIZE_MAP) {
          next.fontSize = parsed.fontSize as FontSizeMode;
        }
        if (parsed && typeof parsed.fontFamily === "string" && parsed.fontFamily in FONT_FAMILY_MAP) {
          next.fontFamily = parsed.fontFamily as FontFamilyMode;
        }
        if (parsed && typeof parsed.theme === "string" && VALID_THEMES.has(parsed.theme as ThemeMode)) {
          next.theme = parsed.theme as ThemeMode;
        }
      }
    } catch {
      // Ignore storage errors in restricted environments
    }
    prefs = next;
    emit();
  }

  function save(): void {
    try {
      localStorage.setItem(DISPLAY_PREFS_KEY, JSON.stringify(prefs));
    } catch {
      // Ignore storage errors in restricted environments
    }
  }

  function set(setting: DisplayPrefSetting, value: string): boolean {
    if (setting === "fontSize" && value in FONT_SIZE_MAP) {
      if (prefs.fontSize === value) return true;
      prefs = { ...prefs, fontSize: value as FontSizeMode };
      save();
      emit();
      return true;
    }
    if (setting === "fontFamily" && value in FONT_FAMILY_MAP) {
      if (prefs.fontFamily === value) return true;
      prefs = { ...prefs, fontFamily: value as FontFamilyMode };
      save();
      emit();
      return true;
    }
    if (setting === "theme" && VALID_THEMES.has(value as ThemeMode)) {
      if (prefs.theme === value) return true;
      prefs = { ...prefs, theme: value as ThemeMode };
      save();
      emit();
      return true;
    }
    return false;
  }

  function getSnapshot(): DisplayPrefs {
    return prefs;
  }

  function handleStorageEvent(event: StorageEvent): void {
    if (event.key === DISPLAY_PREFS_KEY || event.key === null) {
      load();
    }
  }

  function subscribe(listener: () => void): () => void {
    const wasEmpty = listeners.size === 0;
    listeners.add(listener);
    if (wasEmpty && typeof window !== "undefined") {
      window.addEventListener("storage", handleStorageEvent);
    }
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0 && typeof window !== "undefined") {
        window.removeEventListener("storage", handleStorageEvent);
      }
    };
  }

  return { load, save, set, getSnapshot, subscribe };
}
