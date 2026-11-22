import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useLocation, useParams } from "react-router";
import { analytics, type StoryCompleteMethod, type StoryShareMethod } from "../../analytics/ga4";
import { fetchStoryDetail } from "../../api/stories";
import { buildStoryDocumentTitle } from "../../domain/seo";
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

export interface ReaderPageProps {
  initialStory?: StoryDetail | null;
  initialError?: string | null;
}

export function ReaderPage({
  initialStory = null,
  initialError = null,
}: ReaderPageProps = {}) {
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
  const lastTrackedViewKeyRef = useRef<string | null>(null);
  const hasReportedTruthOpenRef = useRef(false);
  const location = useLocation();
  const hasSearchTarget = useMemo(
    () => Boolean(parseReaderJumpParams(location.search)),
    [location.search]
  );

  const storyCategoryById = useMemo(
    () => new Map((indexData?.stories ?? []).map((item) => [item.id, item.shelfCategory])),
    [indexData]
  );

  const [fetchedStory, setFetchedStory] = useState<StoryDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const hasMatchingInitialStory = Boolean(
    initialStory && initialStory.id === storyId && retryCount === 0
  );
  const hasInitialError = Boolean(
    !hasMatchingInitialStory && initialError && retryCount === 0
  );
  const [isLoading, setIsLoading] = useState<boolean>(
    () => !hasMatchingInitialStory && !hasInitialError
  );
  const [activeTermId, setActiveTermId] = useState<string | null>(null);
  const [isDisplayPopoverOpen, setIsDisplayPopoverOpen] = useState(false);

  const story = hasMatchingInitialStory
    ? (initialStory ?? null)
    : fetchedStory && fetchedStory.id === storyId
      ? fetchedStory
      : null;
  const effectiveError = hasInitialError ? (initialError ?? null) : error;
  const effectiveIsLoading = !hasMatchingInitialStory && !hasInitialError && isLoading;

  const transition = useReaderTransition({
    story,
    readerViewRef,
  });

  const entryKey = `${storyId}:${transition.navigationKey}`;

  useEffect(() => {
    hasReportedTruthOpenRef.current = false;
  }, [entryKey]);

  useEffect(() => {
    if (!story || story.id !== storyId) return;
    const viewKey = `${transition.navigationKey}:${story.id}`;
    if (lastTrackedViewKeyRef.current === viewKey) return;
    lastTrackedViewKeyRef.current = viewKey;
    analytics.trackPageView({
      pagePath: `/story/${story.id}`,
      pageTitle: buildStoryDocumentTitle(story),
      storyId: story.id,
      storyCategory: story.shelfCategory,
    });
  }, [story, storyId, transition.navigationKey]);

  const handleStoryComplete = useCallback(
    (method: StoryCompleteMethod) => {
      if (!story || story.id !== storyId) return;
      analytics.trackStoryComplete({
        storyId: story.id,
        storyCategory: story.shelfCategory,
        method,
      });
    },
    [story, storyId]
  );

  const handleBookmarkToggled = useCallback(
    (added: boolean) => {
      if (!story || story.id !== storyId) return;
      analytics.trackBookmarkToggle({
        storyId: story.id,
        action: added ? "add" : "remove",
        surface: "reader",
      });
    },
    [story, storyId]
  );

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
    onStoryComplete: handleStoryComplete,
    onBookmarkToggled: handleBookmarkToggled,
  });

  const { highlightQuery } = useSearchHighlight({
    story,
    chaptersContainerRef: reader.chaptersContainerRef,
    loreDetailsRef,
    isProgrammaticLoreOpenRef,
    onScrollSettled: reader.syncAfterExternalScroll,
  });

  useEffect(() => {
    setRetryCount(0);
    setFetchedStory(null);
    setError(null);
    setActiveTermId(null);
    setIsDisplayPopoverOpen(false);
  }, [storyId]);

  // Fetch story detail when storyId or retryCount changes
  useEffect(() => {
    if (!storyId || isInvalidStoryId) return;
    if (hasMatchingInitialStory) {
      setError(null);
      setIsLoading(false);
      return;
    }
    if (hasInitialError) {
      setFetchedStory(null);
      setError(initialError ?? null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setFetchedStory(null);
    setError(null);
    setIsLoading(true);
    setActiveTermId(null);
    setIsDisplayPopoverOpen(false);

    fetchStoryDetail(storyId)
      .then((data) => {
        if (!cancelled) {
          setFetchedStory(data);
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
  }, [storyId, isInvalidStoryId, retryCount, hasMatchingInitialStory, hasInitialError, initialError]);

  const handleLoreOpened = useCallback(() => {
    if (story && story.id === storyId && !hasReportedTruthOpenRef.current) {
      hasReportedTruthOpenRef.current = true;
      analytics.trackTruthMemoOpen({ storyId: story.id });
    }
    reader.markLoreOpened();
  }, [story, storyId, reader.markLoreOpened]);

  const handleSelectTerm = useCallback(
    (termId: string) => {
      setActiveTermId(termId);
      if (story && story.id === storyId && story.glossary?.[termId]) {
        analytics.trackGlossaryOpen({ storyId: story.id, termId });
      }
    },
    [story, storyId]
  );

  const handleSelectConnectedStory = useCallback(
    (targetId: string) => {
      if (!targetId) return;
      analytics.trackStoryOpen({
        storyId: targetId,
        storyCategory: storyCategoryById.get(targetId),
        source: "connected",
      });
    },
    [storyCategoryById]
  );

  const handleSelectEvidenceLink = useCallback(
    (targetId: string) => {
      if (!targetId) return;
      analytics.trackStoryOpen({
        storyId: targetId,
        storyCategory: storyCategoryById.get(targetId),
        source: "evidence",
      });
    },
    [storyCategoryById]
  );

  const handleShareStory = useCallback(
    (method: StoryShareMethod) => {
      if (!story || story.id !== storyId) return;
      analytics.trackStoryShare({
        storyId: story.id,
        storyCategory: story.shelfCategory,
        method,
      });
    },
    [story, storyId]
  );

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

        {effectiveIsLoading ? (
          <header id="reader-header">
            <p className={commonStyles.loadingStatus}>✦ 星図の記録を読み込んでいます…</p>
          </header>
        ) : effectiveError ? (
          <header id="reader-header">
            <div className={commonStyles.emptyState}>
              <p className={`${commonStyles.emptyTitle} shelf-empty-title`}>
                作品の読み込みに失敗しました
              </p>
              <p className={`${commonStyles.emptyDesc} shelf-empty-desc`}>{effectiveError}</p>
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
              onLoreOpened={handleLoreOpened}
              onSelectTerm={handleSelectTerm}
              onSelectConnectedStory={handleSelectConnectedStory}
              onShareStory={handleShareStory}
            />

            <GlossaryDialog
              storyId={story.id}
              termId={activeTermId}
              entry={activeGlossaryEntry}
              onClose={() => setActiveTermId(null)}
              onSelectEvidenceLink={handleSelectEvidenceLink}
            />
          </>
        ) : null}
      </article>
    </>
  );
}
