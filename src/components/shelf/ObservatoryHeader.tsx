import type { ShelfCategoryTab } from "../../domain/catalog";
import { useDisplayPrefsStore } from "../../state/AppProviders";
import type { ShelfCategoryId, ThemeMode } from "../../types/story";
import commonStyles from "../../styles/common.module.css";
import styles from "./ObservatoryHeader.module.css";

const THEME_OPTIONS: ReadonlyArray<{
  value: ThemeMode;
  label: string;
  swatchClass: string;
}> = [
  { value: "night", label: "夜空", swatchClass: commonStyles.themeSwatchNight },
  { value: "paper", label: "生成り紙", swatchClass: commonStyles.themeSwatchPaper },
  { value: "sepia", label: "セピア", swatchClass: commonStyles.themeSwatchSepia },
];

export interface ObservatoryHeaderProps {
  categories: ReadonlyArray<ShelfCategoryTab>;
  showCounts: boolean;
  onSelectCategory: (category: ShelfCategoryId) => void;
}

export function ObservatoryHeader({
  categories,
  showCounts,
  onSelectCategory,
}: ObservatoryHeaderProps) {
  const { prefs, setPref } = useDisplayPrefsStore();

  return (
    <header className={styles.observatoryHero}>
      <svg
        className={styles.observatoryChartBg}
        viewBox="0 0 960 280"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <g stroke="var(--chart-stroke-main)" strokeWidth="0.9" fill="none">
          <circle cx="480" cy="130" r="118" />
          <circle cx="480" cy="130" r="175" strokeDasharray="3 5" />
          <circle cx="480" cy="130" r="245" stroke="var(--chart-stroke-sub)" />
          <line x1="160" y1="130" x2="800" y2="130" stroke="var(--chart-stroke-axis)" />
          <line x1="480" y1="0" x2="480" y2="260" stroke="var(--chart-stroke-axis)" />
        </g>
        <g fill="var(--chart-star-fill)" opacity="0.75">
          <circle cx="245" cy="96" r="1.6" />
          <circle cx="295" cy="64" r="1.2" />
          <circle cx="672" cy="72" r="1.5" />
          <circle cx="718" cy="112" r="1.3" />
        </g>
      </svg>

      <div
        className={styles.shelfThemeSwitcher}
        id="shelf-theme-switcher"
        role="group"
        aria-label="背景テーマ"
      >
        {THEME_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={styles.shelfThemeOption}
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

      <div className={styles.observatoryHeaderInner}>
        <p className={styles.observatoryEyebrow}>✦ Teyvat Library ✦</p>
        <h1 className={styles.observatoryTitle}>テイワット文庫</h1>
        <p className={styles.observatorySub}>原神 聖遺物・武器・書籍リーダー</p>
      </div>

      <nav className={styles.categoryTabs} id="category-tabs" aria-label="カテゴリー絞り込み">
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            className={`${styles.categoryTab} category-tab`}
            data-filter={cat.id}
            aria-pressed={cat.isActive}
            onClick={() => onSelectCategory(cat.id)}
          >
            <span>{cat.label}</span>
            {showCounts ? (
              <span className={`${styles.tabCount} tab-count`} aria-label={`${cat.count}件`}>
                {cat.count}
              </span>
            ) : null}
          </button>
        ))}
      </nav>
    </header>
  );
}
