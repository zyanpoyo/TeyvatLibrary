export const DISPLAY_PREFS_KEY = "genshin-books-display-prefs-v1";

export const FONT_SIZE_MAP = {
  small: "0.9375rem",
  medium: "1.0625rem",
  large: "1.2rem",
};

export const FONT_FAMILY_MAP = {
  mincho: '"Shippori Mincho", serif',
  gothic: '"Noto Sans JP", sans-serif',
};

export const VALID_THEMES = new Set(["night", "paper", "sepia"]);

const DEFAULT_PREFS = {
  fontSize: "medium",
  fontFamily: "mincho",
  theme: "night",
};

export function createDisplayPrefsState() {
  const prefs = { ...DEFAULT_PREFS };

  function load() {
    Object.assign(prefs, DEFAULT_PREFS);
    try {
      const raw = localStorage.getItem(DISPLAY_PREFS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && FONT_SIZE_MAP[parsed.fontSize]) {
        prefs.fontSize = parsed.fontSize;
      }
      if (parsed && FONT_FAMILY_MAP[parsed.fontFamily]) {
        prefs.fontFamily = parsed.fontFamily;
      }
      if (parsed && VALID_THEMES.has(parsed.theme)) {
        prefs.theme = parsed.theme;
      }
    } catch {
      // Ignore storage errors in restricted environments
    }
  }

  function save() {
    try {
      localStorage.setItem(DISPLAY_PREFS_KEY, JSON.stringify(prefs));
    } catch {
      // Ignore storage errors in restricted environments
    }
  }

  function set(setting, value) {
    if (setting === "fontSize" && FONT_SIZE_MAP[value]) {
      prefs.fontSize = value;
      return true;
    }
    if (setting === "fontFamily" && FONT_FAMILY_MAP[value]) {
      prefs.fontFamily = value;
      return true;
    }
    if (setting === "theme" && VALID_THEMES.has(value)) {
      prefs.theme = value;
      return true;
    }
    return false;
  }

  function syncColorScheme() {
    const scheme = prefs.theme === "night" ? "dark" : "light";
    document.documentElement.style.colorScheme = scheme;
    const meta = document.querySelector('meta[name="color-scheme"]');
    if (meta && meta.content !== scheme) {
      meta.content = scheme;
    }
  }

  function apply(settingContainers = []) {
    const containers = Array.isArray(settingContainers)
      ? settingContainers
      : [settingContainers];

    document.documentElement.style.setProperty("--reader-font-size", FONT_SIZE_MAP[prefs.fontSize]);
    document.documentElement.style.setProperty("--reader-prose-font", FONT_FAMILY_MAP[prefs.fontFamily]);
    document.documentElement.dataset.theme = prefs.theme;
    document.body.dataset.theme = prefs.theme;
    syncColorScheme();

    for (const container of containers) {
      if (!container) continue;
      container.querySelectorAll("[data-setting][data-value]").forEach((btn) => {
        const { setting, value } = btn.dataset;
        btn.setAttribute("aria-pressed", String(prefs[setting] === value));
      });
    }
  }

  return { prefs, load, save, set, syncColorScheme, apply };
}
