import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyDisplayPrefsToDocument,
  createDisplayPrefsState,
  DEFAULT_PREFS,
  DISPLAY_PREFS_KEY,
  FONT_FAMILY_MAP,
  FONT_SIZE_MAP,
} from "../src/state/prefs";

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

describe("display-prefs store", () => {
  beforeEach(() => {
    installMockLocalStorage();
    document.documentElement.dataset.theme = "night";
    document.documentElement.style.cssText = "";
    document.body.dataset.theme = "night";
  });

  it("loads default prefs and updates valid settings while rejecting invalid values", () => {
    const store = createDisplayPrefsState();
    expect(store.getSnapshot()).toEqual(DEFAULT_PREFS);

    expect(store.set("fontSize", "large")).toBe(true);
    expect(store.set("fontFamily", "gothic")).toBe(true);
    expect(store.set("theme", "sepia")).toBe(true);
    expect(store.getSnapshot()).toEqual({
      fontSize: "large",
      fontFamily: "gothic",
      theme: "sepia",
    });

    // Rejects unknown values without mutating snapshot
    expect(store.set("fontSize", "huge")).toBe(false);
    expect(store.set("fontFamily", "monospace")).toBe(false);
    expect(store.set("theme", "neon")).toBe(false);
    expect(store.getSnapshot()).toEqual({
      fontSize: "large",
      fontFamily: "gothic",
      theme: "sepia",
    });

    // Reloaded store reads persisted settings on creation
    const reloaded = createDisplayPrefsState();
    expect(reloaded.getSnapshot()).toEqual({
      fontSize: "large",
      fontFamily: "gothic",
      theme: "sepia",
    });
  });

  it("notifies subscribers on mutation and cross-tab storage events and recovers from broken JSON", () => {
    installMockLocalStorage({ [DISPLAY_PREFS_KEY]: "{broken" });
    const store = createDisplayPrefsState();
    expect(store.getSnapshot()).toEqual(DEFAULT_PREFS);

    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    // Setting same value returns true without redundant emit
    expect(store.set("theme", "night")).toBe(true);
    expect(listener).toHaveBeenCalledTimes(0);

    expect(store.set("theme", "paper")).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);

    localStorage.setItem(
      DISPLAY_PREFS_KEY,
      JSON.stringify({ fontSize: "small", fontFamily: "gothic", theme: "sepia" })
    );
    window.dispatchEvent(new StorageEvent("storage", { key: DISPLAY_PREFS_KEY }));
    expect(listener).toHaveBeenCalledTimes(2);
    expect(store.getSnapshot()).toEqual({
      fontSize: "small",
      fontFamily: "gothic",
      theme: "sepia",
    });

    unsubscribe();
  });

  it("applies display prefs to document root, body dataset, and color-scheme meta", () => {
    let meta = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "color-scheme";
      meta.content = "dark";
      document.head.appendChild(meta);
    }

    applyDisplayPrefsToDocument({
      fontSize: "large",
      fontFamily: "gothic",
      theme: "paper",
    });

    expect(document.documentElement.dataset.theme).toBe("paper");
    expect(document.body.dataset.theme).toBe("paper");
    expect(document.documentElement.style.colorScheme).toBe("light");
    expect(meta.content).toBe("light");
    expect(document.documentElement.style.getPropertyValue("--reader-font-size")).toBe(
      FONT_SIZE_MAP.large
    );
    expect(document.documentElement.style.getPropertyValue("--reader-prose-font")).toBe(
      FONT_FAMILY_MAP.gothic
    );
  });
});
