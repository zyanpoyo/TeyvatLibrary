import type { RefObject } from "react";
import commonStyles from "../../styles/common.module.css";
import { DisplaySettingsPopover } from "./DisplaySettingsPopover";
import styles from "./ReaderNavBar.module.css";

export interface ReaderNavBarProps {
  navRowRef: RefObject<HTMLDivElement | null>;
  isHidden: boolean;
  annotationsEnabled: boolean;
  isDisplayPopoverOpen: boolean;
  onBackToShelf: () => void;
  onToggleAnnotations: () => void;
  onDisplayPopoverOpenChange: (open: boolean) => void;
}

export function ReaderNavBar({
  navRowRef,
  isHidden,
  annotationsEnabled,
  isDisplayPopoverOpen,
  onBackToShelf,
  onToggleAnnotations,
  onDisplayPopoverOpenChange,
}: ReaderNavBarProps) {
  return (
    <div
      ref={navRowRef}
      className={`${styles.readerNavRow} reader-nav-row${isHidden ? ` ${styles.isHidden} is-hidden` : ""}`}
    >
      <button
        type="button"
        className={styles.backLink}
        id="back-to-shelf-btn"
        onClick={onBackToShelf}
      >
        ← 書架へ戻る
      </button>

      <div className={styles.readerControls}>
        <button
          type="button"
          className={commonStyles.controlPill}
          id="toggle-annotations-btn"
          aria-pressed={annotationsEnabled}
          onClick={onToggleAnnotations}
        >
          <span>✦ 用語ガイド {annotationsEnabled ? "ON" : "OFF"}</span>
        </button>

        <DisplaySettingsPopover
          open={isDisplayPopoverOpen}
          onOpenChange={onDisplayPopoverOpenChange}
        />
      </div>
    </div>
  );
}
