import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router";
import {
  arrangeShelfStories,
  filterStories,
  isNewStory,
  pickRandomStory,
} from "../../domain/catalog";
import { useReadingStateStore, useShelfContext } from "../../state/AppProviders";
import commonStyles from "../../styles/common.module.css";
import { ObservatoryHeader } from "./ObservatoryHeader";
import { ResumeBanner } from "./ResumeBanner";
import { ShelfToolbar } from "./ShelfToolbar";
import { StoryCard } from "./StoryCard";
import styles from "./StoryCard.module.css";

function getHistoryIndex(): number | null {
  if (typeof window === "undefined") return null;
  const idx = (window.history.state as { idx?: unknown } | null)?.idx;
  return typeof idx === "number" ? idx : null;
}

export function ShelfPage() {
  const navigate = useNavigate();
  const shelfRef = useRef<HTMLElement | null>(null);
  const hasInitializedScrollRef = useRef(false);
  const { store: readingStore, snapshot: readingSnapshot } = useReadingStateStore();
  const {
    indexData,
    indexError,
    isLoadingIndex,
    validStoryIds,
    filters,
    setFilters,
    resetFilters,
    shelfScrollY,
    setShelfScrollY,
    lastOpenedStoryId,
    setLastOpenedStoryId,
    shouldRestoreShelfFocus,
    setShouldRestoreShelfFocus,
    shouldRestoreShelfScroll,
    setShouldRestoreShelfScroll,
    setShelfDepthInSession,
  } = useShelfContext();

  // Record history index of the shelf page so back-button can navigate(-steps)
  useEffect(() => {
    const idx = getHistoryIndex();
    if (idx !== null) {
      setShelfDepthInSession(idx);
    }
  }, [setShelfDepthInSession]);

  // Restore shelf scroll position and card link focus after returning from Reader
  useLayoutEffect(() => {
    if (!indexData) return;
    if (shouldRestoreShelfScroll) {
      window.scrollTo({ top: shelfScrollY, behavior: "instant" as ScrollBehavior });
      setShouldRestoreShelfScroll(false);
      hasInitializedScrollRef.current = true;
    } else if (!hasInitializedScrollRef.current) {
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
      hasInitializedScrollRef.current = true;
    }
    if (shouldRestoreShelfFocus) {
      const targetLink = lastOpenedStoryId
        ? shelfRef.current?.querySelector<HTMLElement>(
            `.story-card[data-story-id="${CSS.escape(lastOpenedStoryId)}"] .card-primary-link`
          )
        : null;
      if (targetLink) {
        targetLink.focus({ preventScroll: true });
      } else {
        shelfRef.current?.focus({ preventScroll: true });
      }
      setShouldRestoreShelfFocus(false);
    }
  }, [
    indexData,
    shouldRestoreShelfScroll,
    shouldRestoreShelfFocus,
    shelfScrollY,
    lastOpenedStoryId,
    setShouldRestoreShelfScroll,
    setShouldRestoreShelfFocus,
  ]);

  const stories = indexData?.stories ?? [];
  const readCount = useMemo(
    () => readingStore.getReadCount(validStoryIds),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [readingStore, readingSnapshot, validStoryIds]
  );

  const lastSession = useMemo(
    () => readingStore.getLastSession(validStoryIds),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [readingStore, readingSnapshot, validStoryIds]
  );

  const resumeStory = useMemo(
    () => (lastSession ? stories.find((s) => s.id === lastSession.storyId) ?? null : null),
    [lastSession, stories]
  );

  const { ordered, featuredId } = useMemo(() => {
    const filtered = filterStories(stories, filters, readingStore);
    return arrangeShelfStories(filtered, stories, filters, readingStore);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stories, filters, readingStore, readingSnapshot]);

  const captureShelfStateBeforeLeave = useCallback(
    (storyId: string) => {
      setShelfScrollY(window.scrollY);
      setLastOpenedStoryId(storyId);
      setShouldRestoreShelfScroll(true);
      setShouldRestoreShelfFocus(true);
    },
    [
      setShelfScrollY,
      setLastOpenedStoryId,
      setShouldRestoreShelfScroll,
      setShouldRestoreShelfFocus,
    ]
  );

  const handleOpenStory = useCallback(
    (storyId: string, restoreScrollRatio?: number) => {
      if (!validStoryIds.has(storyId)) return;
      captureShelfStateBeforeLeave(storyId);
      navigate(`/story/${encodeURIComponent(storyId)}`, {
        state: restoreScrollRatio !== undefined ? { restoreScrollRatio } : undefined,
      });
    },
    [validStoryIds, captureShelfStateBeforeLeave, navigate]
  );

  const handleRandomPick = useCallback(() => {
    const picked = pickRandomStory(stories, readingStore, lastOpenedStoryId);
    if (picked) {
      handleOpenStory(picked.id);
    }
  }, [stories, readingStore, lastOpenedStoryId, handleOpenStory]);

  return (
    <section id="shelf-view" ref={shelfRef} className={styles.shelfView} tabIndex={-1}>
      <ObservatoryHeader
        indexData={indexData}
        activeCategory={filters.category}
        onSelectCategory={(category) => setFilters((prev) => ({ ...prev, category }))}
      />

      <ResumeBanner
        session={lastSession}
        story={resumeStory}
        onResumeClick={(storyId) => captureShelfStateBeforeLeave(storyId)}
        onDismiss={() => readingStore.clearLastSession()}
      />

      <ShelfToolbar
        indexData={indexData}
        filters={filters}
        orderedCount={ordered.length}
        totalCount={stories.length}
        readCount={readCount}
        onChangeFilters={setFilters}
        onRandomPick={handleRandomPick}
      />

      <div className={styles.storyGrid} id="story-grid">
        {isLoadingIndex ? (
          <p className={commonStyles.loadingStatus}>✦ 書架データを読み込んでいます…</p>
        ) : indexError ? (
          <div className={commonStyles.emptyState}>
            <p className={`${commonStyles.emptyTitle} shelf-empty-title`}>
              データの読み込みに失敗しました
            </p>
            <p className={`${commonStyles.emptyDesc} shelf-empty-desc`}>{indexError}</p>
          </div>
        ) : ordered.length === 0 ? (
          <div className={commonStyles.emptyState}>
            <p className={`${commonStyles.emptyTitle} shelf-empty-title`}>
              ✦ 条件に一致する物語が見つかりません
            </p>
            <p className={`${commonStyles.emptyDesc} shelf-empty-desc`}>
              カテゴリーや読書状態・登場人物・用語・地域・検索語句の条件を変更してお試しください。
            </p>
            <button
              type="button"
              className={commonStyles.controlPill}
              data-action="reset-filters"
              onClick={resetFilters}
            >
              条件をリセットしてすべて表示
            </button>
          </div>
        ) : (
          ordered.map((story) => (
            <StoryCard
              key={story.id}
              story={story}
              isFeatured={Boolean(featuredId && story.id === featuredId)}
              isRead={readingStore.isRead(story.id)}
              isNew={isNewStory(story, readingStore)}
              isBookmarked={readingStore.isBookmarked(story.id)}
              onBeforeOpenStory={captureShelfStateBeforeLeave}
              onOpenStory={(id) => handleOpenStory(id)}
              onToggleBookmark={(id) => readingStore.toggleBookmark(id)}
            />
          ))
        )}
      </div>
    </section>
  );
}
