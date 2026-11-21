import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from "react";
import { flushSync } from "react-dom";
import type { StoryCompleteMethod } from "../analytics/ga4";
import {
  AUTO_READ_THRESHOLD,
  BOOKMARK_THRESHOLD_MIN,
  roundScrollRatio,
  type ReadingStateStore,
} from "../state/reading-state";
import type { DisplayPrefs, StoryDetail } from "../types/story";

const MOUNT_SUPPRESS_MS = 400;
const BOOKMARK_DEBOUNCE_MS = 250;
const DOWNWARD_SCROLL_MIN_DELTA_PX = 4;
const TOP_BOTTOM_SNAP_PX = 16;
const CHAPTER_TARGET_RATIO = 0.32;
const NAV_HIDE_DELTA_PX = 8;
const NAV_REVEAL_DELTA_PX = 12;
const NAV_HIDE_PADDING_PX = 24;

interface SectionRect {
  top: number;
  bottom: number;
}

interface NavScrollState {
  isHidden: boolean;
  lastScrollY: number;
  scrollAnchorY: number;
  lastScrollDir: -1 | 0 | 1;
}

interface PendingSnapshot {
  storyId: string;
  chapterIndex: number;
  scrollRatio: number;
}

type ScrollSessionAction =
  | { type: "none" }
  | { type: "mark-read"; storyId: string }
  | { type: "clear-session"; storyId: string }
  | { type: "save-session"; session: PendingSnapshot };

const INITIAL_NAV_SCROLL_STATE: NavScrollState = {
  isHidden: false,
  lastScrollY: 0,
  scrollAnchorY: 0,
  lastScrollDir: 0,
};

function calculateScrollRatio(
  scrollY: number,
  scrollHeight: number,
  innerHeight: number
): number {
  const scrollable = scrollHeight - innerHeight;
  if (scrollable <= 0) return 1;
  return Math.min(1, Math.max(0, scrollY / scrollable));
}

function resolveClosestChapterIndex(
  sectionRects: ReadonlyArray<SectionRect>,
  scrollY: number,
  scrollHeight: number,
  innerHeight: number,
  currentIndex: number
): number {
  if (sectionRects.length === 0) return 0;
  const maxY = Math.max(0, scrollHeight - innerHeight);
  if (scrollY <= TOP_BOTTOM_SNAP_PX) return 0;
  if (maxY > 0 && maxY - scrollY <= TOP_BOTTOM_SNAP_PX) {
    return sectionRects.length - 1;
  }

  const targetLine = innerHeight * CHAPTER_TARGET_RATIO;
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

function evaluateNavVisibility(
  prev: NavScrollState,
  scrollY: number,
  maxScrollY: number,
  hideThreshold: number,
  keepNavVisible: boolean
): { isHidden: boolean; nextState: NavScrollState } {
  if (keepNavVisible) {
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

  if (dir === 1 && y - anchorY >= NAV_HIDE_DELTA_PX) {
    nextHidden = true;
  } else if (dir === -1 && anchorY - y >= NAV_REVEAL_DELTA_PX) {
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

function evaluateScrollSessionAction(params: {
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

  const roundedRatio = roundScrollRatio(ratio);
  if (roundedRatio >= AUTO_READ_THRESHOLD) {
    if (!autoReadSuppressed) {
      return { type: "mark-read", storyId };
    }
    // 手動未読戻し後は自動読了を抑止し、0.9 以上は途中しおり対象外とする仕様に統一
    return { type: "clear-session", storyId };
  }

  if (roundedRatio > BOOKMARK_THRESHOLD_MIN) {
    return {
      type: "save-session",
      session: { storyId, chapterIndex, scrollRatio: roundedRatio },
    };
  }

  return { type: "none" };
}

function resolveValidRestoreRatio(rawRatio: unknown): number | null {
  if (typeof rawRatio !== "number" || !Number.isFinite(rawRatio)) {
    return null;
  }
  const rounded = roundScrollRatio(rawRatio);
  if (rounded <= BOOKMARK_THRESHOLD_MIN || rounded >= AUTO_READ_THRESHOLD) {
    return null;
  }
  return rounded;
}

function createRestoredNavState(scrollY: number): NavScrollState {
  return {
    isHidden: false,
    lastScrollY: scrollY,
    scrollAnchorY: scrollY,
    lastScrollDir: 0,
  };
}

export interface UseReaderSessionOptions {
  /** 現在開いているルートの作品 ID。 */
  storyId: string;
  /** 非同期取得された作品詳細。読み込み中・エラー時は null。 */
  story: StoryDetail | null;
  /** 読書状態（読了・あとで読む・途中しおり）を管理する永続ストア。 */
  readingState: ReadingStateStore;
  /** 表示設定。文字サイズ・書体の変更時にしおり記録なしで進捗を再計算する。 */
  displayPrefs: DisplayPrefs;
  /** 再開バナーなど呼び出し元が明示したスクロール復元比率。 */
  explicitRestoreRatio?: number | null;
  /** 初回マウント時に explicitRestoreRatio が無ければ lastSession へフォールバックするか。 */
  allowStoredSessionRestore?: boolean;
  /** lastSession フォールバック時に照合する有効作品 ID 集合。 */
  validStoryIds?: ReadonlySet<string> | null;
  /** React Router の location.key 等、同一 storyId への再遷移を区別するキー。 */
  navigationKey?: string;
  /** 表示設定ポップオーバー等が展開中で操作バーを強制表示すべきとき true。 */
  keepNavVisible?: boolean;
  /** 検索スニペット等からの位置指定ジャンプ遷移のとき true（途中しおり復元と自動スクロール競合を抑止）。 */
  hasSearchTarget?: boolean;
  /** 未読→読了へ状態遷移したときの通知コールバック（1閲覧セッションにつき最大1回）。 */
  onStoryComplete?: (method: StoryCompleteMethod) => void;
  /** あとで読む状態が切り替わったときの通知コールバック。 */
  onBookmarkToggled?: (added: boolean) => void;
}

export interface UseReaderSessionResult {
  /** 0〜100 の整数進捗率（#reader-footer-percent 用）。 */
  progressPercent: number;
  /** 0〜100 の連続進捗率（#reading-progress 幅用）。 */
  progressExactPercent: number;
  /** 現在の章ラベル（partLabel）。 */
  currentChapterLabel: string;
  /** 操作バーを自動格納すべきとき true。 */
  isNavHidden: boolean;
  /** 現在の作品が読了済みか。 */
  isRead: boolean;
  /** 現在の作品があとで読む登録済みか。 */
  isBookmarked: boolean;
  /** 操作バー高さ計測用の ref。 */
  navRowRef: RefObject<HTMLDivElement | null>;
  /** 章要素（.chapter-section）群のコンテナ ref。 */
  chaptersContainerRef: RefObject<HTMLDivElement | null>;
  /** あとで読む（ブックマーク）のトグル。 */
  toggleBookmark: () => void;
  /** 手動読了トグル。未読へ戻すと同一セッション中の自動読了を抑止する。 */
  toggleRead: () => void;
  /** 真相・考察メモ展開時の自動読了。手動未読抑止中はスキップする。 */
  markLoreOpened: () => void;
  /** 検索ジャンプ等によるプログラム的スクロール直後に進捗・基準位置を同期し、誤読了を防ぐ。 */
  syncAfterExternalScroll: () => void;
  /** 保留中しおりを同期フラッシュして記録を停止し、離脱ナビゲーションを実行する。 */
  leave: (afterLeave?: () => void) => void;
}

/**
 * リーダー画面の閲覧セッション全体（進捗計測・章追従・操作バー格納・途中しおり保存/復元・
 * 読了トグル抑止・真相メモ連動・離脱時フラッシュ）を統合管理する深いフックモジュール。
 */
export function useReaderSession({
  storyId,
  story,
  readingState,
  displayPrefs,
  explicitRestoreRatio = null,
  allowStoredSessionRestore = true,
  validStoryIds = null,
  navigationKey = "",
  keepNavVisible = false,
  hasSearchTarget = false,
  onStoryComplete,
  onBookmarkToggled,
}: UseReaderSessionOptions): UseReaderSessionResult {
  const activeStory = story && story.id === storyId ? story : null;
  const activeStoryId = activeStory?.id ?? null;
  const entryKey = `${storyId}:${navigationKey}`;

  const [progressExactPercent, setProgressExactPercent] = useState(0);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [isNavHidden, setIsNavHidden] = useState(false);

  const navRowRef = useRef<HTMLDivElement | null>(null);
  const chaptersContainerRef = useRef<HTMLDivElement | null>(null);

  const isInEffectRef = useRef(false);
  const isSessionActiveRef = useRef(false);
  const currentIndexRef = useRef(0);
  const navStateRef = useRef<NavScrollState>(INITIAL_NAV_SCROLL_STATE);
  const keepNavVisibleRef = useRef(keepNavVisible);

  const autoReadSuppressedRef = useRef(false);
  const hasReportedCompleteRef = useRef(false);
  const onStoryCompleteRef = useRef(onStoryComplete);
  const onBookmarkToggledRef = useRef(onBookmarkToggled);
  const hasUserScrolledDownRef = useRef(false);
  const initialMountedScrollYRef = useRef(0);
  const suppressUntilRef = useRef(0);
  const bookmarkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSnapshotRef = useRef<PendingSnapshot | null>(null);
  const capturedRestoreRef = useRef<{ entryKey: string; ratio: number | null } | null>(null);

  useEffect(() => {
    onStoryCompleteRef.current = onStoryComplete;
    onBookmarkToggledRef.current = onBookmarkToggled;
  }, [onStoryComplete, onBookmarkToggled]);

  const getReadSnapshot = useCallback(
    () => (activeStoryId ? readingState.isRead(activeStoryId) : false),
    [readingState, activeStoryId]
  );
  const getBookmarkSnapshot = useCallback(
    () => (activeStoryId ? readingState.isBookmarked(activeStoryId) : false),
    [readingState, activeStoryId]
  );

  const isRead = useSyncExternalStore(readingState.subscribe, getReadSnapshot, () => false);
  const isBookmarked = useSyncExternalStore(
    readingState.subscribe,
    getBookmarkSnapshot,
    () => false
  );

  const updateNavHidden = useCallback((nextHidden: boolean) => {
    if (isInEffectRef.current) {
      setIsNavHidden(nextHidden);
      return;
    }
    flushSync(() => {
      setIsNavHidden(nextHidden);
    });
  }, []);

  const clearPendingBookmark = useCallback(() => {
    if (bookmarkTimerRef.current !== null) {
      clearTimeout(bookmarkTimerRef.current);
      bookmarkTimerRef.current = null;
    }
    pendingSnapshotRef.current = null;
  }, []);

  const flushPendingBookmark = useCallback(() => {
    if (bookmarkTimerRef.current !== null) {
      clearTimeout(bookmarkTimerRef.current);
      bookmarkTimerRef.current = null;
    }
    const snapshot = pendingSnapshotRef.current;
    if (!snapshot) return;
    pendingSnapshotRef.current = null;
    readingState.updateLastSession(snapshot);
  }, [readingState]);

  const scheduleBookmarkSave = useCallback(
    (snapshot: PendingSnapshot) => {
      pendingSnapshotRef.current = snapshot;
      if (bookmarkTimerRef.current !== null) {
        clearTimeout(bookmarkTimerRef.current);
      }
      bookmarkTimerRef.current = setTimeout(() => {
        bookmarkTimerRef.current = null;
        flushPendingBookmark();
      }, BOOKMARK_DEBOUNCE_MS);
    },
    [flushPendingBookmark]
  );

  const resolveActiveChapter = useCallback((storyObj: StoryDetail): number => {
    const container = chaptersContainerRef.current;
    if (!container || storyObj.chapters.length === 0) {
      currentIndexRef.current = 0;
      setCurrentChapterIndex(0);
      return 0;
    }

    const sections = container.querySelectorAll<HTMLElement>(".chapter-section");
    if (sections.length === 0) {
      currentIndexRef.current = 0;
      setCurrentChapterIndex(0);
      return 0;
    }

    const rects = Array.from(sections, (el) => {
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom };
    });

    const nextIndex = resolveClosestChapterIndex(
      rects,
      window.scrollY,
      document.documentElement.scrollHeight,
      window.innerHeight,
      currentIndexRef.current
    );

    if (nextIndex !== currentIndexRef.current) {
      currentIndexRef.current = nextIndex;
      setCurrentChapterIndex(nextIndex);
    }
    return nextIndex;
  }, []);

  const updateNavVisibilityOnScroll = useCallback(() => {
    const navEl = navRowRef.current;
    if (!navEl) return;
    const maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const hideThreshold = navEl.offsetHeight + NAV_HIDE_PADDING_PX;
    const prevHidden = navStateRef.current.isHidden;
    const { isHidden, nextState } = evaluateNavVisibility(
      navStateRef.current,
      window.scrollY,
      maxY,
      hideThreshold,
      keepNavVisibleRef.current
    );
    navStateRef.current = nextState;
    if (isHidden !== prevHidden) {
      updateNavHidden(isHidden);
    }
  }, [updateNavHidden]);

  const markReadAndNotify = useCallback(
    (targetStoryId: string, method: StoryCompleteMethod) => {
      const wasAlreadyRead = readingState.isRead(targetStoryId);
      readingState.markRead(targetStoryId);
      if (!wasAlreadyRead && !hasReportedCompleteRef.current) {
        hasReportedCompleteRef.current = true;
        onStoryCompleteRef.current?.(method);
      }
    },
    [readingState]
  );

  const applySessionAction = useCallback(
    (action: ScrollSessionAction) => {
      if (action.type === "mark-read") {
        clearPendingBookmark();
        markReadAndNotify(action.storyId, "auto_scroll");
        return;
      }
      if (action.type === "clear-session") {
        clearPendingBookmark();
        if (readingState.getSnapshot().lastSession?.storyId === action.storyId) {
          readingState.clearLastSession();
        }
        return;
      }
      if (action.type === "save-session") {
        scheduleBookmarkSave(action.session);
      }
    },
    [clearPendingBookmark, markReadAndNotify, readingState, scheduleBookmarkSave]
  );

  const syncProgressAndSession = useCallback(
    (storyObj: StoryDetail, recordSession: boolean) => {
      if (!isSessionActiveRef.current) return;

      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      const ratio = calculateScrollRatio(
        window.scrollY,
        document.documentElement.scrollHeight,
        window.innerHeight
      );
      setProgressExactPercent(ratio * 100);
      const chapterIndex = resolveActiveChapter(storyObj);

      if (!recordSession || scrollable <= 0) return;
      if (performance.now() < suppressUntilRef.current) {
        initialMountedScrollYRef.current = window.scrollY;
        return;
      }

      if (window.scrollY > initialMountedScrollYRef.current + DOWNWARD_SCROLL_MIN_DELTA_PX) {
        hasUserScrolledDownRef.current = true;
      }
      if (!hasUserScrolledDownRef.current) return;

      const action = evaluateScrollSessionAction({
        ratio,
        chapterIndex,
        hasUserScrolledDown: true,
        autoReadSuppressed: autoReadSuppressedRef.current,
        storyId: storyObj.id,
      });
      applySessionAction(action);
    },
    [resolveActiveChapter, applySessionAction]
  );

  // ルート遷移単位で1回だけ復元比率を捕捉し、画面状態を初期化する（レンダー中の ref 書換えを避ける）
  useLayoutEffect(() => {
    if (capturedRestoreRef.current?.entryKey === entryKey) {
      return;
    }

    const isInitialEntry = capturedRestoreRef.current === null;
    let ratio = hasSearchTarget ? null : resolveValidRestoreRatio(explicitRestoreRatio);
    if (ratio === null && !hasSearchTarget && isInitialEntry && allowStoredSessionRestore) {
      const allowedIds = validStoryIds && validStoryIds.size > 0 ? validStoryIds : null;
      const session = readingState.getLastSession(allowedIds);
      if (session && session.storyId === storyId) {
        ratio = resolveValidRestoreRatio(session.scrollRatio);
      }
    }
    capturedRestoreRef.current = { entryKey, ratio };

    isInEffectRef.current = true;
    try {
      hasReportedCompleteRef.current = false;
      navStateRef.current = INITIAL_NAV_SCROLL_STATE;
      setIsNavHidden(false);
      currentIndexRef.current = 0;
      setCurrentChapterIndex(0);
      setProgressExactPercent(0);
      if (!hasSearchTarget) {
        window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
      }
    } finally {
      isInEffectRef.current = false;
    }
  }, [
    entryKey,
    storyId,
    explicitRestoreRatio,
    allowStoredSessionRestore,
    hasSearchTarget,
    validStoryIds,
    readingState,
  ]);

  // 表示設定ポップオーバー等で操作バーを固定表示する場合のみセッション状態を維持したまま再表示
  useEffect(() => {
    keepNavVisibleRef.current = keepNavVisible;
    if (keepNavVisible) {
      navStateRef.current = { ...navStateRef.current, isHidden: false };
      setIsNavHidden(false);
    }
  }, [keepNavVisible]);

  // 作品の読み込み完了後、単一スクロール監視・章追従・位置復元・背景退避フラッシュを一括で開始
  useLayoutEffect(() => {
    if (!activeStory) {
      isSessionActiveRef.current = false;
      setProgressExactPercent(0);
      currentIndexRef.current = 0;
      setCurrentChapterIndex(0);
      return;
    }

    let cancelled = false;
    let rafId: number | null = null;
    isSessionActiveRef.current = true;
    autoReadSuppressedRef.current = false;
    hasReportedCompleteRef.current = false;
    hasUserScrolledDownRef.current = false;
    suppressUntilRef.current = performance.now() + MOUNT_SUPPRESS_MS;

    isInEffectRef.current = true;
    try {
      if (!hasSearchTarget) {
        window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
      }
      initialMountedScrollYRef.current = window.scrollY;
      navStateRef.current = createRestoredNavState(window.scrollY);
      setIsNavHidden(false);

      const restoreRatio =
        !hasSearchTarget && capturedRestoreRef.current?.entryKey === entryKey
          ? capturedRestoreRef.current.ratio
          : null;

      if (restoreRatio !== null) {
        const applyRestoredScroll = () => {
          if (cancelled || !isSessionActiveRef.current) return;
          suppressUntilRef.current = performance.now() + MOUNT_SUPPRESS_MS;
          const scrollable = Math.max(
            0,
            document.documentElement.scrollHeight - window.innerHeight
          );
          window.scrollTo({
            top: Math.round(scrollable * restoreRatio),
            behavior: "instant" as ScrollBehavior,
          });
          initialMountedScrollYRef.current = window.scrollY;
          navStateRef.current = createRestoredNavState(window.scrollY);
          updateNavHidden(false);
          syncProgressAndSession(activeStory, false);
        };
        applyRestoredScroll();
        rafId = requestAnimationFrame(() => {
          isInEffectRef.current = false;
          applyRestoredScroll();
        });
      } else {
        syncProgressAndSession(activeStory, false);
      }
    } finally {
      isInEffectRef.current = false;
    }

    let observer: IntersectionObserver | null = null;
    const container = chaptersContainerRef.current;
    if (
      container &&
      activeStory.chapters.length > 1 &&
      typeof IntersectionObserver !== "undefined"
    ) {
      const sections = container.querySelectorAll<HTMLElement>(".chapter-section");
      if (sections.length > 1) {
        observer = new IntersectionObserver(
          () => {
            if (!isSessionActiveRef.current) return;
            resolveActiveChapter(activeStory);
          },
          {
            rootMargin: "-18% 0px -22% 0px",
            threshold: 0,
          }
        );
        sections.forEach((section) => observer?.observe(section));
      }
    }

    const onScroll = () => {
      if (!isSessionActiveRef.current) return;
      updateNavVisibilityOnScroll();
      syncProgressAndSession(activeStory, true);
    };
    const onPageHide = () => flushPendingBookmark();
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushPendingBookmark();
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      observer?.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      flushPendingBookmark();
      isSessionActiveRef.current = false;
      autoReadSuppressedRef.current = false;
      hasUserScrolledDownRef.current = false;
      initialMountedScrollYRef.current = 0;
    };
  }, [
    activeStory,
    entryKey,
    hasSearchTarget,
    flushPendingBookmark,
    resolveActiveChapter,
    syncProgressAndSession,
    updateNavHidden,
    updateNavVisibilityOnScroll,
  ]);

  // 表示設定（文字サイズ・書体）の変更時はセッション記録せず進捗率と章位置を再計算する
  useEffect(() => {
    if (!activeStory || !isSessionActiveRef.current) return;
    syncProgressAndSession(activeStory, false);
  }, [displayPrefs.fontSize, displayPrefs.fontFamily, activeStory, syncProgressAndSession]);

  const toggleBookmark = useCallback(() => {
    if (!activeStory) return;
    const added = readingState.toggleBookmark(activeStory.id);
    onBookmarkToggledRef.current?.(added);
  }, [activeStory, readingState]);

  const toggleRead = useCallback(() => {
    if (!activeStory) return;
    const wasAlreadyRead = readingState.isRead(activeStory.id);
    const nextRead = readingState.toggleRead(activeStory.id);
    autoReadSuppressedRef.current = !nextRead;
    if (nextRead) {
      clearPendingBookmark();
      if (!wasAlreadyRead && !hasReportedCompleteRef.current) {
        hasReportedCompleteRef.current = true;
        onStoryCompleteRef.current?.("manual");
      }
    }
  }, [activeStory, readingState, clearPendingBookmark]);

  const markLoreOpened = useCallback(() => {
    if (!activeStory || autoReadSuppressedRef.current) return;
    clearPendingBookmark();
    markReadAndNotify(activeStory.id, "auto_lore");
  }, [activeStory, clearPendingBookmark, markReadAndNotify]);

  const syncAfterExternalScroll = useCallback(() => {
    if (!activeStory || !isSessionActiveRef.current) return;
    suppressUntilRef.current = performance.now() + MOUNT_SUPPRESS_MS;
    initialMountedScrollYRef.current = window.scrollY;
    hasUserScrolledDownRef.current = false;
    navStateRef.current = createRestoredNavState(window.scrollY);
    setIsNavHidden(false);
    syncProgressAndSession(activeStory, false);
  }, [activeStory, syncProgressAndSession]);

  const leave = useCallback(
    (afterLeave?: () => void) => {
      flushPendingBookmark();
      isSessionActiveRef.current = false;
      afterLeave?.();
    },
    [flushPendingBookmark]
  );

  const currentChapterLabel = activeStory?.chapters[currentChapterIndex]?.partLabel ?? "";

  return {
    progressPercent: Math.round(progressExactPercent),
    progressExactPercent,
    currentChapterLabel,
    isNavHidden,
    isRead,
    isBookmarked,
    navRowRef,
    chaptersContainerRef,
    toggleBookmark,
    toggleRead,
    markLoreOpened,
    syncAfterExternalScroll,
    leave,
  };
}
