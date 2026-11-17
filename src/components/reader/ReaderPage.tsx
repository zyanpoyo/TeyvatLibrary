import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router";
import { fetchStoryDetail } from "../../api/stories";
import { useReaderSession } from "../../hooks/useReaderSession";
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

  const { store: readingStore } = useReadingStateStore();
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

  const [story, setStory] = useState<StoryDetail | null>(initialStory);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(!initialStory);
  const [retryCount, setRetryCount] = useState(0);
  const [activeTermId, setActiveTermId] = useState<string | null>(null);
  const [isDisplayPopoverOpen, setIsDisplayPopoverOpen] = useState(false);

  const locationState = location.state as { restoreScrollRatio?: unknown } | null;
  const explicitRestoreRatio =
    typeof locationState?.restoreScrollRatio === "number"
      ? locationState.restoreScrollRatio
      : null;

  const isInvalidStoryId =
    Boolean(indexData) && validStoryIds.size > 0 && !validStoryIds.has(storyId);

  const reader = useReaderSession({
    storyId,
    story,
    readingState: readingStore,
    displayPrefs,
    explicitRestoreRatio,
    allowStoredSessionRestore: shelfDepthInSession === null,
    validStoryIds,
    navigationKey: location.key,
    keepNavVisible: isDisplayPopoverOpen,
  });

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

  const handleBackToShelf = useCallback(() => {
    reader.leave(() => {
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
    });
  }, [
    reader.leave,
    shelfDepthInSession,
    navigate,
    setShouldRestoreShelfFocus,
    setShouldRestoreShelfScroll,
  ]);

  if (isInvalidStoryId) {
    return <Navigate to="/" replace />;
  }

  const activeGlossaryEntry =
    story && activeTermId ? story.glossary?.[activeTermId] ?? null : null;

  return (
    <>
      <div
        className={styles.readingProgress}
        id="reading-progress"
        style={{ width: `${reader.progressExactPercent}%` }}
      />
      <div
        className={styles.readerFooterStatus}
        id="reader-footer-status"
        aria-hidden="true"
      >
        <span className={styles.readerFooterChapter} id="reader-footer-chapter">
          {reader.currentChapterLabel}
        </span>
        <span className={styles.readerFooterSep} aria-hidden="true">
          ・
        </span>
        <span className={styles.readerFooterPercent} id="reader-footer-percent">
          {reader.progressPercent}%
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
          navRowRef={reader.navRowRef}
          isHidden={reader.isNavHidden}
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
              isRead={reader.isRead}
              isBookmarked={reader.isBookmarked}
              chaptersContainerRef={reader.chaptersContainerRef}
              onToggleBookmark={reader.toggleBookmark}
              onToggleRead={reader.toggleRead}
              onLoreOpened={reader.markLoreOpened}
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
