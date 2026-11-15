export const SESSION_AUTO_READ_THRESHOLD = 0.9;
export const SESSION_BOOKMARK_THRESHOLD_MIN = 0.05;

export interface SectionRect {
  top: number;
  bottom: number;
}

export interface NavScrollState {
  isHidden: boolean;
  lastScrollY: number;
  scrollAnchorY: number;
  lastScrollDir: -1 | 0 | 1;
}

export const INITIAL_NAV_SCROLL_STATE: NavScrollState = {
  isHidden: false,
  lastScrollY: 0,
  scrollAnchorY: 0,
  lastScrollDir: 0,
};

export type ScrollSessionAction =
  | { type: "none" }
  | { type: "mark-read"; storyId: string }
  | {
      type: "save-session";
      session: { storyId: string; chapterIndex: number; scrollRatio: number };
    };

/**
 * スクロール位置から読書進捗率（0〜1）を算出する。スクロール不要な短編は 1 を返す。
 */
export function calculateScrollRatio(
  scrollY: number,
  scrollHeight: number,
  innerHeight: number
): number {
  const scrollable = scrollHeight - innerHeight;
  if (scrollable <= 0) return 1;
  return Math.min(1, Math.max(0, scrollY / scrollable));
}

/**
 * ビューポート上部（32%地点）に最も近い章インデックスを特定する。
 */
export function resolveClosestChapterIndex(
  sectionRects: ReadonlyArray<SectionRect>,
  scrollY: number,
  scrollHeight: number,
  innerHeight: number,
  currentIndex: number
): number {
  if (sectionRects.length === 0) return 0;
  const maxY = Math.max(0, scrollHeight - innerHeight);
  if (scrollY <= 16) return 0;
  if (maxY > 0 && maxY - scrollY <= 16) {
    return sectionRects.length - 1;
  }

  const targetLine = innerHeight * 0.32;
  let bestIndex = Math.max(0, Math.min(currentIndex, sectionRects.length - 1));
  let bestDistance = Infinity;

  for (let idx = 0; idx < sectionRects.length; idx += 1) {
    const rect = sectionRects[idx];
    if (!rect) continue;
    const distance =
      rect.top <= targetLine && rect.bottom >= targetLine
        ? 0
        : Math.min(Math.abs(rect.top - targetLine), Math.abs(rect.bottom - targetLine));
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = idx;
    }
  }

  return bestIndex;
}

/**
 * スクロール方向と累積移動量に基づき、リーダー操作バーの格納/再表示状態を評価する。
 */
export function evaluateNavVisibility(
  prev: NavScrollState,
  scrollY: number,
  maxScrollY: number,
  hideThreshold: number,
  isPopoverOpen: boolean
): { isHidden: boolean; nextState: NavScrollState } {
  if (isPopoverOpen) {
    return {
      isHidden: false,
      nextState: { ...prev, isHidden: false },
    };
  }

  const clampedMaxY = Math.max(0, maxScrollY);
  const y = Math.max(0, Math.min(scrollY, clampedMaxY));
  if (y === prev.lastScrollY) {
    return { isHidden: prev.isHidden, nextState: prev };
  }

  if (y <= hideThreshold) {
    return {
      isHidden: false,
      nextState: {
        isHidden: false,
        lastScrollY: y,
        scrollAnchorY: y,
        lastScrollDir: 0,
      },
    };
  }

  const dir: -1 | 1 = y > prev.lastScrollY ? 1 : -1;
  const anchorY = dir !== prev.lastScrollDir ? prev.lastScrollY : prev.scrollAnchorY;
  let nextHidden = prev.isHidden;

  if (dir === 1 && y - anchorY >= 8) {
    nextHidden = true;
  } else if (dir === -1 && anchorY - y >= 12) {
    nextHidden = false;
  }

  return {
    isHidden: nextHidden,
    nextState: {
      isHidden: nextHidden,
      lastScrollY: y,
      scrollAnchorY: anchorY,
      lastScrollDir: dir,
    },
  };
}

/**
 * 現在のスクロール率とユーザー操作状態から、自動読了・しおり保存・何もしないのいずれかを判定する。
 */
export function evaluateScrollSessionAction(params: {
  ratio: number;
  chapterIndex: number;
  hasUserScrolledDown: boolean;
  autoReadSuppressed: boolean;
  storyId: string;
}): ScrollSessionAction {
  const { ratio, chapterIndex, hasUserScrolledDown, autoReadSuppressed, storyId } = params;
  if (!storyId || !hasUserScrolledDown) {
    return { type: "none" };
  }

  if (ratio >= SESSION_AUTO_READ_THRESHOLD) {
    if (!autoReadSuppressed) {
      return { type: "mark-read", storyId };
    }
    return {
      type: "save-session",
      session: { storyId, chapterIndex, scrollRatio: ratio },
    };
  }

  if (ratio > SESSION_BOOKMARK_THRESHOLD_MIN) {
    return {
      type: "save-session",
      session: { storyId, chapterIndex, scrollRatio: ratio },
    };
  }

  return { type: "none" };
}
