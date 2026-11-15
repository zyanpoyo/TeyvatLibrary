import { useCallback, useEffect, useRef, useState } from "react";
import {
  calculateScrollRatio,
  evaluateScrollSessionAction,
  SESSION_AUTO_READ_THRESHOLD,
  SESSION_BOOKMARK_THRESHOLD_MIN,
} from "../domain/scroll-session";
import type { ReadingStateStore } from "../state/reading-state";
import type { DisplayPrefs, LastSessionSnapshot, StoryDetail } from "../types/story";

interface PendingSnapshot {
  storyId: string;
  chapterIndex: number;
  scrollRatio: number;
}

export interface UseReaderSessionOptions {
  story: StoryDetail | null;
  restoreScrollRatio: number | null;
  readingState: ReadingStateStore;
  resolveActiveChapter: () => number;
  displayPrefs: DisplayPrefs;
}

export interface UseReaderSessionResult {
  progressPercent: number;
  progressExactPercent: number;
  clearPendingBookmark: () => void;
  stopSession: () => void;
  setAutoReadSuppressed: (suppressed: boolean) => void;
  isAutoReadSuppressed: () => boolean;
}

export function useReaderSession({
  story,
  restoreScrollRatio,
  readingState,
  resolveActiveChapter,
  displayPrefs,
}: UseReaderSessionOptions): UseReaderSessionResult {
  const [progressExactPercent, setProgressExactPercent] = useState(0);
  const autoReadSuppressedRef = useRef(false);
  const hasUserScrolledDownRef = useRef(false);
  const initialMountedScrollYRef = useRef(0);
  const suppressUntilRef = useRef(0);
  const bookmarkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSnapshotRef = useRef<PendingSnapshot | null>(null);
  const isMountedRef = useRef(false);

  const clearPendingBookmark = useCallback(() => {
    if (bookmarkTimerRef.current !== null) {
      clearTimeout(bookmarkTimerRef.current);
      bookmarkTimerRef.current = null;
    }
    pendingSnapshotRef.current = null;
  }, []);

  const flush = useCallback(() => {
    if (bookmarkTimerRef.current !== null) {
      clearTimeout(bookmarkTimerRef.current);
      bookmarkTimerRef.current = null;
    }
    if (pendingSnapshotRef.current) {
      const snapshot = pendingSnapshotRef.current;
      pendingSnapshotRef.current = null;
      readingState.updateLastSession(snapshot);
    }
  }, [readingState]);

  const stopSession = useCallback(() => {
    flush();
    isMountedRef.current = false;
  }, [flush]);

  const scheduleBookmarkSave = useCallback(
    (snapshot: PendingSnapshot) => {
      pendingSnapshotRef.current = snapshot;
      if (bookmarkTimerRef.current !== null) {
        clearTimeout(bookmarkTimerRef.current);
      }
      bookmarkTimerRef.current = setTimeout(() => {
        bookmarkTimerRef.current = null;
        flush();
      }, 250);
    },
    [flush]
  );

  const setAutoReadSuppressed = useCallback((suppressed: boolean) => {
    autoReadSuppressedRef.current = Boolean(suppressed);
  }, []);

  const isAutoReadSuppressed = useCallback(() => autoReadSuppressedRef.current, []);

  const refreshProgress = useCallback(
    (recordSession: boolean) => {
      if (!isMountedRef.current || !story) return;

      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      const ratio = calculateScrollRatio(
        window.scrollY,
        document.documentElement.scrollHeight,
        window.innerHeight
      );
      const pct = ratio * 100;
      setProgressExactPercent(pct);
      const chapterIndex = resolveActiveChapter();

      if (!recordSession || scrollable <= 0) return;
      if (performance.now() < suppressUntilRef.current) {
        initialMountedScrollYRef.current = window.scrollY;
        return;
      }

      if (window.scrollY > initialMountedScrollYRef.current + 4) {
        hasUserScrolledDownRef.current = true;
      }
      if (!hasUserScrolledDownRef.current) return;

      const action = evaluateScrollSessionAction({
        ratio,
        chapterIndex,
        hasUserScrolledDown: hasUserScrolledDownRef.current,
        autoReadSuppressed: autoReadSuppressedRef.current,
        storyId: story.id,
      });

      if (action.type === "mark-read") {
        clearPendingBookmark();
        readingState.markRead(action.storyId);
      } else if (action.type === "save-session") {
        if (action.session.scrollRatio >= SESSION_AUTO_READ_THRESHOLD) {
          readingState.updateLastSession(action.session);
        } else {
          scheduleBookmarkSave(action.session);
        }
      }
    },
    [story, readingState, resolveActiveChapter, clearPendingBookmark, scheduleBookmarkSave]
  );

  // Story mount & scroll restoration
  useEffect(() => {
    if (!story) {
      isMountedRef.current = false;
      setProgressExactPercent(0);
      return;
    }

    let cancelled = false;
    isMountedRef.current = true;
    autoReadSuppressedRef.current = false;
    hasUserScrolledDownRef.current = false;
    suppressUntilRef.current = performance.now() + 400;

    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    initialMountedScrollYRef.current = window.scrollY;

    const hasRestoreRatio =
      typeof restoreScrollRatio === "number" &&
      Number.isFinite(restoreScrollRatio) &&
      restoreScrollRatio > SESSION_BOOKMARK_THRESHOLD_MIN &&
      restoreScrollRatio < SESSION_AUTO_READ_THRESHOLD;

    let rafId: number | null = null;
    if (hasRestoreRatio) {
      const applyRestoredScroll = () => {
        if (cancelled) return;
        suppressUntilRef.current = performance.now() + 400;
        const scrollable = Math.max(
          0,
          document.documentElement.scrollHeight - window.innerHeight
        );
        window.scrollTo({
          top: Math.round(scrollable * restoreScrollRatio),
          behavior: "instant" as ScrollBehavior,
        });
        initialMountedScrollYRef.current = window.scrollY;
        refreshProgress(false);
      };
      applyRestoredScroll();
      rafId = requestAnimationFrame(applyRestoredScroll);
    } else {
      refreshProgress(false);
    }

    return () => {
      cancelled = true;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      flush();
      isMountedRef.current = false;
      autoReadSuppressedRef.current = false;
      hasUserScrolledDownRef.current = false;
      initialMountedScrollYRef.current = 0;
    };
  }, [story, restoreScrollRatio, flush, refreshProgress]);

  // Display prefs (fontSize / fontFamily) change recalculates progress without recording session
  useEffect(() => {
    if (!story || !isMountedRef.current) return;
    refreshProgress(false);
  }, [displayPrefs.fontSize, displayPrefs.fontFamily, story, refreshProgress]);

  // Scroll, pagehide, and visibilitychange listeners
  useEffect(() => {
    if (!story) return;

    const onScroll = () => refreshProgress(true);
    const onPageHide = () => flush();
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flush();
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [story, refreshProgress, flush]);

  return {
    progressPercent: Math.round(progressExactPercent),
    progressExactPercent,
    clearPendingBookmark,
    stopSession,
    setAutoReadSuppressed,
    isAutoReadSuppressed,
  };
}

export function getMatchingSessionScrollRatio(
  readingState: ReadingStateStore,
  storyId: string,
  validStoryIds?: ReadonlySet<string>
): number | null {
  const session: LastSessionSnapshot | null = readingState.getLastSession(
    validStoryIds && validStoryIds.size > 0 ? validStoryIds : null
  );
  return session && session.storyId === storyId ? session.scrollRatio : null;
}
