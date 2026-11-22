import { useDisplayPrefsStore } from "../../state/AppProviders";
import commonStyles from "../../styles/common.module.css";
import type { ThemeMode } from "../../types/story";
import styles from "./ThemeSwitcher.module.css";

const THEME_OPTIONS: ReadonlyArray<{
  value: ThemeMode;
  label: string;
  swatchClass: string;
}> = [
  { value: "night", label: "夜空", swatchClass: commonStyles.themeSwatchNight },
  { value: "paper", label: "生成り紙", swatchClass: commonStyles.themeSwatchPaper },
  { value: "sepia", label: "セピア", swatchClass: commonStyles.themeSwatchSepia },
];

export interface ThemeSwitcherProps {
  id?: string;
  className?: string;
}

/**
 * 書架・コース画面で共有する背景テーマ（夜空・生成り紙・セピア）切替コントロール。
 */
export function ThemeSwitcher({ id, className }: ThemeSwitcherProps) {
  const { prefs, setPref } = useDisplayPrefsStore();
  const rootClass = className ? `${styles.themeSwitcher} ${className}` : styles.themeSwitcher;

  return (
    <div className={rootClass} id={id} role="group" aria-label="背景テーマ">
      {THEME_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={styles.themeOption}
          data-setting="theme"
          data-value={opt.value}
          aria-pressed={prefs.theme === opt.value}
          onClick={() => setPref("theme", opt.value)}
        >
          <span className={`${commonStyles.themeSwatch} ${opt.swatchClass}`} aria-hidden="true" />
          <span>{opt.label}</span>
        </button>
      ))}
    </div>
  );
}
