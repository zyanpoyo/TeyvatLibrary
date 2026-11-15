import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router";
import { fetchStoryDetail } from "../../api/stories";
import { useActiveChapter } from "../../hooks/useActiveChapter";
import { useAutoHideNav } from "../../hooks/useAutoHideNav";
import { getMatchingSessionScrollRatio, useReaderSession } from "../../hooks/useReaderSession";
import {
  useDisplayPrefsStore,
  useReadingStateStore,
  useShelfContext,
} from "../../state/AppProviders";
import commonStyles from "../../styles/common.module.css";
import type { StoryDetail } from "../../types/story";
import { GlossaryDialog } from "./GlossaryDialog";
import { ReaderArticle } from "./ReaderArticle";
import { ReaderNavBar } from "./ReaderNavBar";
import styles from "./ReaderPage.module.css";

const BASE_TITLE = "テイワット文庫 — 原神 聖遺物・武器・書籍リーダー";

function getHistoryIndex(): number | null {
  if (typeof window === "undefined") return null;
  const idx = (window.history.state as { idx?: unknown } | null)?.idx;
  return typeof idx === "number" ? idx : null;
}

export function ReaderPage({ initialStory = null }: { initialStory?: StoryDetail | null }) {
  const { storyId = "" } = useParams<{ storyId: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const { store: readingStore, snapshot: readingSnapshot } = useReadingStateStore();
  const { prefs: displayPrefs } = useDisplayPrefsStore();
  const {
    indexData,
    validStoryIds,
    annotationsEnabled,
    setAnnotationsEnabled,
    shelfDepthInSession,
    setShelfDepthInSession,
    setShouldRestoreShelfFocus,
    setShouldRestoreShelfScroll,
  } = useShelfContext();

  const readerViewRef = useRef<HTMLElement | null>(null);
  const navRowRef = useRef<HTMLDivElement | null>(null);
  const chaptersContainerRef = useRef<HTMLDivElement | null>(null);

  const [story, setStory] = useState<StoryDetail | null>(initialStory);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(!initialStory);
  const [retryCount, setRetryCount] = useState(0);
  const [activeTermId, setActiveTermId] = useState<string | null>(null);
  const [isDisplayPopoverOpen, setIsDisplayPopoverOpen] = useState(false);

  // Capture restoreScrollRatio once per storyId transition so mid-reading bookmark updates never re-trigger scroll restoration
  const initialMountRef = useRef(true);
  const capturedRatioRef = useRef<{ storyId: string; ratio: number | null }>({
    storyId: "",
    ratio: null,
  });

  if (capturedRatioRef.current.storyId !== storyId) {
    const locationState = location.state as { restoreScrollRatio?: number } | null;
    let ratio: number | null =
      typeof locationState?.restoreScrollRatio === "number"
        ? locationState.restoreScrollRatio
        : null;
    if (ratio === null && initialMountRef.current && shelfDepthInSession === null) {
      ratio = getMatchingSessionScrollRatio(readingStore, storyId, validStoryIds);
    }
    capturedRatioRef.current = { storyId, ratio };
  }
  useEffect(() => {
    initialMountRef.current = false;
  }, []);

  const restoreScrollRatio = capturedRatioRef.current.ratio;

  const isInvalidStoryId =
    Boolean(indexData) && validStoryIds.size > 0 && !validStoryIds.has(storyId);

  // If browser navigated back prior to shelfDepthInSession, invalidate shelf depth
  useEffect(() => {
    const idx = getHistoryIndex();
    if (idx !== null && shelfDepthInSession !== null && idx <= shelfDepthInSession) {
      setShelfDepthInSession(null);
    }
  }, [location.key, shelfDepthInSession, setShelfDepthInSession]);

  // Fetch story detail when storyId or retryCount changes
  useEffect(() => {
    if (!storyId || isInvalidStoryId) return;
    if (initialStory && initialStory.id === storyId && retryCount === 0) {
      setStory(initialStory);
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setStory(null);
    setError(null);
    setIsLoading(true);
    setActiveTermId(null);
    setIsDisplayPopoverOpen(false);
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });

    fetchStoryDetail(storyId)
      .then((data) => {
        if (!cancelled) {
          setStory(data);
          setIsLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [storyId, isInvalidStoryId, retryCount, initialStory]);

  // Document title sync & focus management on route transition
  useEffect(() => {
    if (!story) return;
    document.title = `${story.title} | テイワット文庫`;
    if (shelfDepthInSession !== null) {
      readerViewRef.current?.focus({ preventScroll: true });
    }
  }, [story, shelfDepthInSession]);

  useEffect(() => {
    return () => {
      document.title = BASE_TITLE;
    };
  }, []);

  const { currentChapterLabel, resolveActiveChapter } = useActiveChapter(
    story,
    chaptersContainerRef
  );

  const { isNavHidden } = useAutoHideNav(
    navRowRef,
    Boolean(story),
    isDisplayPopoverOpen,
    story?.id
  );

  const {
    progressPercent,
    progressExactPercent,
    clearPendingBookmark,
    stopSession,
    setAutoReadSuppressed,
    isAutoReadSuppressed,
  } = useReaderSession({
    story,
    restoreScrollRatio,
    readingState: readingStore,
    resolveActiveChapter,
    displayPrefs,
  });

  const handleBackToShelf = useCallback(() => {
    stopSession();
    setActiveTermId(null);
    setIsDisplayPopoverOpen(false);
    const currentIdx = getHistoryIndex();
    if (shelfDepthInSession !== null && currentIdx !== null && currentIdx > shelfDepthInSession) {
      setShouldRestoreShelfFocus(true);
      setShouldRestoreShelfScroll(true);
      navigate(shelfDepthInSession - currentIdx);
      return;
    }
    setShouldRestoreShelfFocus(true);
    setShouldRestoreShelfScroll(false);
    navigate("/");
  }, [
    stopSession,
    shelfDepthInSession,
    navigate,
    setShouldRestoreShelfFocus,
    setShouldRestoreShelfScroll,
  ]);

  const handleToggleBookmark = useCallback(() => {
    if (!story) return;
    readingStore.toggleBookmark(story.id);
  }, [story, readingStore]);

  const handleToggleRead = useCallback(() => {
    if (!story) return;
    const nextRead = readingStore.toggleRead(story.id);
    setAutoReadSuppressed(!nextRead);
    if (nextRead) {
      clearPendingBookmark();
    }
  }, [story, readingStore, setAutoReadSuppressed, clearPendingBookmark]);

  const handleLoreOpened = useCallback(() => {
    if (!story || isAutoReadSuppressed()) return;
    clearPendingBookmark();
    readingStore.markRead(story.id);
  }, [story, isAutoReadSuppressed, clearPendingBookmark, readingStore]);

  if (isInvalidStoryId) {
    return <Navigate to="/" replace />;
  }

  // Subscribe to readingSnapshot changes via context snapshot
  void readingSnapshot;
  const isRead = story ? readingStore.isRead(story.id) : false;
  const isBookmarked = story ? readingStore.isBookmarked(story.id) : false;
  const activeGlossaryEntry =
    story && activeTermId ? story.glossary?.[activeTermId] ?? null : null;

  return (
    <>
      <div
        className={styles.readingProgress}
        id="reading-progress"
        style={{ width: `${progressExactPercent}%` }}
      />
      <div
        className={styles.readerFooterStatus}
        id="reader-footer-status"
        aria-hidden="true"
      >
        <span className={styles.readerFooterChapter} id="reader-footer-chapter">
          {currentChapterLabel}
        </span>
        <span className={styles.readerFooterSep} aria-hidden="true">
          ・
        </span>
        <span className={styles.readerFooterPercent} id="reader-footer-percent">
          {progressPercent}%
        </span>
      </div>

      <article
        id="reader-view"
        ref={readerViewRef}
        className={styles.readerView}
        data-annotations={annotationsEnabled ? "on" : "off"}
        tabIndex={-1}
      >
        <ReaderNavBar
          navRowRef={navRowRef}
          isHidden={isNavHidden}
          annotationsEnabled={annotationsEnabled}
          isDisplayPopoverOpen={isDisplayPopoverOpen}
          onBackToShelf={handleBackToShelf}
          onToggleAnnotations={() => setAnnotationsEnabled((prev) => !prev)}
          onDisplayPopoverOpenChange={setIsDisplayPopoverOpen}
        />

        {isLoading ? (
          <header id="reader-header">
            <p className={commonStyles.loadingStatus}>✦ 星図の記録を読み込んでいます…</p>
          </header>
        ) : error ? (
          <header id="reader-header">
            <div className={commonStyles.emptyState}>
              <p className={`${commonStyles.emptyTitle} shelf-empty-title`}>
                作品の読み込みに失敗しました
              </p>
              <p className={`${commonStyles.emptyDesc} shelf-empty-desc`}>{error}</p>
              <button
                type="button"
                className={commonStyles.controlPill}
                data-action="retry-story"
                data-story-id={storyId}
                onClick={() => setRetryCount((c) => c + 1)}
              >
                再試行する
              </button>
            </div>
          </header>
        ) : story ? (
          <>
            <ReaderArticle
              story={story}
              isRead={isRead}
              isBookmarked={isBookmarked}
              chaptersContainerRef={chaptersContainerRef}
              onToggleBookmark={handleToggleBookmark}
              onToggleRead={handleToggleRead}
              onLoreOpened={handleLoreOpened}
              onSelectTerm={(termId) => setActiveTermId(termId)}
            />

            <GlossaryDialog
              storyId={story.id}
              termId={activeTermId}
              entry={activeGlossaryEntry}
              onClose={() => setActiveTermId(null)}
            />
          </>
        ) : null}
      </article>
    </>
  );
}
