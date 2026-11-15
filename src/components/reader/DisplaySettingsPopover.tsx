import * as Popover from "@radix-ui/react-popover";
import { useDisplayPrefsStore } from "../../state/AppProviders";
import type { FontFamilyMode, FontSizeMode, ThemeMode } from "../../types/story";
import commonStyles from "../../styles/common.module.css";
import styles from "./PopoverAndDialog.module.css";

const FONT_SIZE_OPTIONS: ReadonlyArray<{ value: FontSizeMode; label: string }> = [
  { value: "small", label: "小" },
  { value: "medium", label: "標準" },
  { value: "large", label: "大" },
];

const FONT_FAMILY_OPTIONS: ReadonlyArray<{ value: FontFamilyMode; label: string }> = [
  { value: "mincho", label: "明朝" },
  { value: "gothic", label: "ゴシック" },
];

const THEME_OPTIONS: ReadonlyArray<{
  value: ThemeMode;
  label: string;
  swatchClass: string;
}> = [
  { value: "night", label: "夜空", swatchClass: commonStyles.themeSwatchNight },
  { value: "paper", label: "生成り紙", swatchClass: commonStyles.themeSwatchPaper },
  { value: "sepia", label: "セピア", swatchClass: commonStyles.themeSwatchSepia },
];

export interface DisplaySettingsPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DisplaySettingsPopover({ open, onOpenChange }: DisplaySettingsPopoverProps) {
  const { prefs, setPref } = useDisplayPrefsStore();

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={commonStyles.controlPill}
          id="display-settings-btn"
          aria-expanded={open}
        >
          <span>Aa 表示設定</span>
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          id="display-settings-popover"
          className={styles.displayPopover}
          role="dialog"
          aria-labelledby="display-settings-title"
          side="bottom"
          align="end"
          sideOffset={8}
          collisionPadding={12}
        >
          <div className={styles.popoverHeader}>
            <h3 className={styles.popoverTermTitle} id="display-settings-title">
              Aa 表示設定
            </h3>
            <Popover.Close asChild>
              <button type="button" className={`${styles.popoverClose} popover-close`}>
                ✕ 閉じる
              </button>
            </Popover.Close>
          </div>

          <div className={styles.displaySettingsGroups}>
            <fieldset className={styles.settingGroup}>
              <legend className={styles.settingLabel}>文字サイズ</legend>
              <div className={styles.settingSegmented}>
                {FONT_SIZE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={styles.settingOption}
                    data-setting="fontSize"
                    data-value={opt.value}
                    aria-pressed={prefs.fontSize === opt.value}
                    onClick={() => setPref("fontSize", opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className={styles.settingGroup}>
              <legend className={styles.settingLabel}>書体</legend>
              <div className={styles.settingSegmented}>
                {FONT_FAMILY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={styles.settingOption}
                    data-setting="fontFamily"
                    data-value={opt.value}
                    aria-pressed={prefs.fontFamily === opt.value}
                    onClick={() => setPref("fontFamily", opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className={styles.settingGroup}>
              <legend className={styles.settingLabel}>背景テーマ</legend>
              <div className={styles.settingSegmented}>
                {THEME_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={styles.settingOption}
                    data-setting="theme"
                    data-value={opt.value}
                    aria-pressed={prefs.theme === opt.value}
                    onClick={() => setPref("theme", opt.value)}
                  >
                    <span
                      className={`${commonStyles.themeSwatch} ${opt.swatchClass}`}
                      aria-hidden="true"
                    />
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
