import type { ReactNode } from "react";
import styles from "./AppIcon.module.css";

export type AppIconName =
  | "bookmark"
  | "hourglass"
  | "magnifier"
  | "dice"
  | "open-book"
  | "lantern"
  | "link-rings"
  | "books"
  | "share"
  | "copy-link"
  | "check";

export interface AppIconProps {
  name: AppIconName;
  active?: boolean;
  className?: string;
}

const ICON_RENDERERS: Record<AppIconName, () => ReactNode> = {
  bookmark: () => (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="3.6" r="1.3" />
      <g className={styles.stateOff}>
        <path d="M7.2 5.4 H16.8 V20.5 L12 17.1 L7.2 20.5 Z" fill="currentColor" fillOpacity="0.14" />
        <path
          d="M12 8.5 L12.75 10.65 L14.9 11.4 L12.75 12.15 L12 14.3 L11.25 12.15 L9.1 11.4 L11.25 10.65 Z"
          strokeWidth="1.15"
        />
      </g>
      <g className={styles.stateOn}>
        <circle cx="12" cy="3.6" r="0.65" fill="currentColor" stroke="none" />
        <path
          d="M7.2 5.4 H16.8 V20.5 L12 17.1 L7.2 20.5 Z M12 8.4 L11.2 10.6 L9.0 11.4 L11.2 12.2 L12 14.4 L12.8 12.2 L15.0 11.4 L12.8 10.6 Z"
          fill="currentColor"
          fillOpacity="0.94"
          fillRule="evenodd"
          stroke="none"
        />
        <path d="M7.2 5.4 H16.8 V20.5 L12 17.1 L7.2 20.5 Z" />
      </g>
    </g>
  ),
  hourglass: () => (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path
        d="M9.1 7.6 H14.9 C14.3 9.7 13 10.8 12 11.6 C11 10.8 9.7 9.7 9.1 7.6 Z"
        fill="currentColor"
        fillOpacity="0.14"
        stroke="none"
      />
      <path
        d="M8.6 20.1 C8.9 17.5 10.5 16.4 12 16.4 C13.5 16.4 15.1 17.5 15.4 20.1 Z"
        fill="currentColor"
        fillOpacity="0.26"
        stroke="none"
      />
      <path d="M6.5 3.8 H17.5 M6.5 20.2 H17.5" />
      <path d="M8.2 3.8 C8.2 8.2 10.9 10.4 11.6 12 C10.9 13.6 8.2 15.8 8.2 20.2" />
      <path d="M15.8 3.8 C15.8 8.2 13.1 10.4 12.4 12 C13.1 13.6 15.8 15.8 15.8 20.2" />
      <path d="M12 12.6 V15.2" strokeDasharray="1.1 1.3" strokeWidth="1.2" />
    </g>
  ),
  magnifier: () => (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <g className={styles.stateOff}>
        <circle cx="10.5" cy="10.5" r="6.5" fill="currentColor" fillOpacity="0.12" />
        <path
          d="M10.5 7.4 L11.3 9.7 L13.6 10.5 L11.3 11.3 L10.5 13.6 L9.7 11.3 L7.4 10.5 L9.7 9.7 Z"
          strokeWidth="1.15"
        />
      </g>
      <g className={styles.stateOn}>
        <circle cx="10.5" cy="10.5" r="6.5" fill="currentColor" fillOpacity="0.24" />
        <path
          d="M10.5 7.2 L11.4 9.6 L13.8 10.5 L11.4 11.4 L10.5 13.8 L9.6 11.4 L7.2 10.5 L9.6 9.6 Z"
          fill="currentColor"
          fillOpacity="0.96"
          stroke="none"
        />
        <circle cx="16.5" cy="4.8" r="0.95" fill="currentColor" stroke="none" />
      </g>
      <path d="M15.2 15.2 L20.2 20.2" />
      <path d="M15.9 16.9 L16.9 15.9" strokeWidth="1.2" />
      <circle cx="20.4" cy="20.4" r="0.7" fill="currentColor" stroke="none" />
    </g>
  ),
  dice: () => (
    <g
      transform="rotate(-11 12 12)"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="4.5" y="4.5" width="15" height="15" rx="3.2" fill="currentColor" fillOpacity="0.14" />
      <path
        d="M12 9.2 L12.75 11.25 L14.8 12 L12.75 12.75 L12 14.8 L11.25 12.75 L9.2 12 L11.25 11.25 Z"
        fill="currentColor"
        stroke="none"
      />
      <circle cx="8.3" cy="8.3" r="0.95" fill="currentColor" stroke="none" />
      <circle cx="15.7" cy="15.7" r="0.95" fill="currentColor" stroke="none" />
    </g>
  ),
  "open-book": () => (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path
        d="M3.5 6.4 C6.2 5.4 9.5 5.6 12 7.2 V18.6 C9.5 17.2 6.2 17.0 3.5 18.0 Z"
        fill="currentColor"
        fillOpacity="0.14"
      />
      <path
        d="M20.5 6.4 C17.8 5.4 14.5 5.6 12 7.2 V18.6 C14.5 17.2 17.8 17.0 20.5 18.0 Z"
        fill="currentColor"
        fillOpacity="0.1"
      />
      <path
        d="M14.8 6.1 V12.1 L16.2 11.0 L17.6 12.1 V5.9"
        fill="currentColor"
        fillOpacity="0.28"
      />
      <path d="M6.2 9.8 H9.5 M6.2 12.6 H9.1" strokeWidth="1.1" opacity="0.65" />
    </g>
  ),
  lantern: () => (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="3.3" r="1.25" />
      <path d="M6.6 7.4 Q12 4.6 17.4 7.4 Z" fill="currentColor" fillOpacity="0.22" />
      <path
        d="M7.2 7.4 L5.8 12.3 C5.8 15.5 7.8 17.8 8.8 18.6 H15.2 C16.2 17.8 18.2 15.5 18.2 12.3 L16.8 7.4"
        fill="currentColor"
        fillOpacity="0.14"
      />
      <path d="M7.4 18.6 H16.6 M9.6 20.6 H14.4" />
      <path
        d="M12 9.9 L12.75 12.15 L15.0 12.9 L12.75 13.65 L12 15.9 L11.25 13.65 L9.0 12.9 L11.25 12.15 Z"
        fill="currentColor"
        fillOpacity="0.95"
        stroke="none"
      />
    </g>
  ),
  "link-rings": () => (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <g transform="rotate(-45 12 12)">
        <rect x="3.0" y="8.3" width="10.6" height="7.4" rx="3.7" fill="currentColor" fillOpacity="0.12" stroke="none" />
        <rect x="10.4" y="8.3" width="10.6" height="7.4" rx="3.7" fill="currentColor" fillOpacity="0.12" stroke="none" />
        <path d="M10.4 8.3 H6.7 A3.7 3.7 0 0 0 6.7 15.7 H10.4 A3.7 3.7 0 0 0 13.5 13.6" />
        <path d="M13.6 15.7 H17.3 A3.7 3.7 0 0 0 17.3 8.3 H13.6 A3.7 3.7 0 0 0 10.5 10.4" />
      </g>
      <path
        d="M12 10.0 L12.55 11.45 L14.0 12 L12.55 12.55 L12 14.0 L11.45 12.55 L10.0 12 L11.45 11.45 Z"
        fill="currentColor"
        stroke="none"
      />
    </g>
  ),
  books: () => (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3.0 19.8 H21.0" strokeWidth="1.2" opacity="0.65" />
      <rect x="3.8" y="5.0" width="4.4" height="14.6" rx="0.9" fill="currentColor" fillOpacity="0.14" />
      <path d="M3.8 8.2 H8.2 M3.8 16.4 H8.2" strokeWidth="1.1" />
      <rect x="8.2" y="3.8" width="4.6" height="15.8" rx="0.9" fill="currentColor" fillOpacity="0.22" />
      <circle cx="10.5" cy="9.2" r="0.85" fill="currentColor" stroke="none" />
      <path d="M8.2 16.4 H12.8" strokeWidth="1.1" />
      <g transform="rotate(-13 13.1 6.0)">
        <rect x="13.1" y="6.0" width="4.2" height="13.5" rx="0.9" fill="currentColor" fillOpacity="0.12" />
        <path d="M13.1 9.0 H17.3 M13.1 16.4 H17.3" strokeWidth="1.1" />
      </g>
    </g>
  ),
  share: () => (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="17.2" cy="5.8" r="2.3" fill="currentColor" fillOpacity="0.18" />
      <circle cx="6.8" cy="12" r="2.3" fill="currentColor" fillOpacity="0.18" />
      <circle cx="17.2" cy="18.2" r="2.3" fill="currentColor" fillOpacity="0.18" />
      <path d="M8.9 10.9 L15.1 7.0 M8.9 13.1 L15.1 17.0" />
    </g>
  ),
  "copy-link": () => (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="8.6" y="8.6" width="10.4" height="11.4" rx="2.1" fill="currentColor" fillOpacity="0.14" />
      <path d="M15.4 8.6 V6.1 A2.1 2.1 0 0 0 13.3 4.0 H6.9 A2.1 2.1 0 0 0 4.8 6.1 V13.9 A2.1 2.1 0 0 0 6.9 16.0 H8.6" />
      <path d="M11.6 12.6 H16.0 M11.6 15.6 H14.8" strokeWidth="1.15" />
    </g>
  ),
  check: () => (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="8.2" fill="currentColor" fillOpacity="0.14" strokeWidth="1.2" />
      <path d="M8.4 12.3 L10.9 14.8 L15.8 9.6" />
    </g>
  ),
};

/**
 * テイワット文庫のUIアイコン（「案A：星図ファインライン」統一仕様のテーマ連動SVG）。
 */
export function AppIcon({ name, active = false, className }: AppIconProps) {
  const combinedClassName = className ? `${styles.icon} ${className}` : styles.icon;
  return (
    <svg
      viewBox="0 0 24 24"
      className={combinedClassName}
      data-icon={name}
      data-active={active ? "true" : "false"}
      aria-hidden="true"
      focusable="false"
    >
      {ICON_RENDERERS[name]()}
    </svg>
  );
}
