import { useEffect } from "react";
import { FONT_FAMILY_MAP, FONT_SIZE_MAP } from "../state/prefs";
import type { DisplayPrefs } from "../types/story";

/**
 * 表示設定（テーマ・文字サイズ・書体）を html/body 属性と CSS カスタムプロパティへ同期する。
 */
export function useDocumentThemeEffect(prefs: DisplayPrefs): void {
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--reader-font-size", FONT_SIZE_MAP[prefs.fontSize]);
    root.style.setProperty("--reader-prose-font", FONT_FAMILY_MAP[prefs.fontFamily]);
    root.dataset.theme = prefs.theme;
    document.body.dataset.theme = prefs.theme;

    const scheme = prefs.theme === "night" ? "dark" : "light";
    root.style.colorScheme = scheme;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
    if (meta && meta.content !== scheme) {
      meta.content = scheme;
    }
  }, [prefs]);
}
