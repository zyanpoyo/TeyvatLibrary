import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useLocation, useParams } from "react-router";
import { fetchStoryDetail } from "../../api/stories";
import { useReaderSession } from "../../hooks/useReaderSession";
import { useSearchHighlight } from "../../hooks/useSearchHighlight";
import { parseReaderJumpParams } from "../../router/search-params";
import {
  useDisplayPrefsStore,
  useReaderTransition,
  useReadingStateStore,
  useShelfContext,
} from "../../state/AppProviders";
import commonStyles from "../../styles/common.module.css";
import type { StoryDetail } from "../../types/story";
import { GlossaryDialog } from "./GlossaryDialog";
import { ReaderArticle } from "./ReaderArticle";
import { ReaderNavBar } from "./ReaderNavBar";
import styles from "./ReaderPage.module.css";

export function ReaderPage() {
  const { storyId = "" } = useParams<{ storyId: string }>();

  const { store: readingStore } = useReadingStateStore();
  const {
    prefs: displayPrefs,
    annotationsEnabled,
    toggleAnnotations,
  } = useDisplayPrefsStore();
  const { indexData, validStoryIds } = useShelfContext();

  const readerViewRef = useRef<HTMLElement | null>(null);
  const loreDetailsRef = useRef<HTMLDetailsElement | null>(null);
  const isProgrammaticLoreOpenRef = useRef(false);
  const location = useLocation();
  const hasSearchTarget = useMemo(
    () => Boolean(parseReaderJumpParams(location.search)),
    [location.search]
  );

  const [story, setStory] = useState<StoryDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [retryCount, setRetryCount] = useState(0);
  const [activeTermId, setActiveTermId] = useState<string | null>(null);
  const [isDisplayPopoverOpen, setIsDisplayPopoverOpen] = useState(false);

  const transition = useReaderTransition({
    story,
    readerViewRef,
  });

  const isInvalidStoryId =
    Boolean(indexData) && validStoryIds.size > 0 && !validStoryIds.has(storyId);

  const reader = useReaderSession({
    storyId,
    story,
    readingState: readingStore,
    displayPrefs,
    explicitRestoreRatio: transition.explicitRestoreRatio,
    allowStoredSessionRestore: transition.allowStoredSessionRestore,
    validStoryIds,
    navigationKey: transition.navigationKey,
    keepNavVisible: isDisplayPopoverOpen,
    hasSearchTarget,
  });

  const { highlightQuery } = useSearchHighlight({
    story,
    chaptersContainerRef: reader.chaptersContainerRef,
    loreDetailsRef,
    isProgrammaticLoreOpenRef,
    onScrollSettled: reader.syncAfterExternalScroll,
  });

  // Fetch story detail when storyId or retryCount changes
  useEffect(() => {
    if (!storyId || isInvalidStoryId) return;

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
  }, [storyId, isInvalidStoryId, retryCount]);

  const handleBackToShelf = useCallback(() => {
    reader.leave(() => {
      setActiveTermId(null);
      setIsDisplayPopoverOpen(false);
      transition.backToShelf();
    });
  }, [reader.leave, transition]);

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
          onToggleAnnotations={toggleAnnotations}
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
              loreDetailsRef={loreDetailsRef}
              isProgrammaticLoreOpenRef={isProgrammaticLoreOpenRef}
              highlightQuery={highlightQuery}
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
