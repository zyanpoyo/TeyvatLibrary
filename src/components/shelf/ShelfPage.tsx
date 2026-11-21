import { useCallback, useEffect, useMemo, useRef } from "react";
import { analytics, type ShelfFilterTrackType } from "../../analytics/ga4";
import { deriveShelfView, pickRandomStory } from "../../domain/catalog";
import {
  useReadingStateStore,
  useShelfContext,
  useShelfTransition,
} from "../../state/AppProviders";
import commonStyles from "../../styles/common.module.css";
import type { SearchJumpTarget, ShelfCategoryId } from "../../types/story";
import { ObservatoryHeader } from "./ObservatoryHeader";
import { ResumeBanner } from "./ResumeBanner";
import { ShelfToolbar } from "./ShelfToolbar";
import { StoryCard } from "./StoryCard";
import styles from "./StoryCard.module.css";

const SEARCH_TRACK_DEBOUNCE_MS = 800;

export function ShelfPage() {
  const shelfRef = useRef<HTMLElement | null>(null);
  const { store: readingStore, snapshot: readingSnapshot } = useReadingStateStore();
  const {
    indexData,
    indexError,
    isLoadingIndex,
    searchIndex,
    isLoadingSearchIndex,
    ensureSearchIndex,
    filters,
    setFilters,
    resetFilters,
  } = useShelfContext();
  const {
    lastOpenedStoryId,
    openStory,
    getLastTrackedSearchKey,
    setLastTrackedSearchKey,
  } = useShelfTransition(shelfRef);

  const stories = indexData?.stories ?? [];
  const storyMap = useMemo(
    () => new Map(stories.map((story) => [story.id, story])),
    [stories]
  );

  const shelfView = useMemo(
    () =>
      deriveShelfView({
        indexData,
        searchIndex,
        filters,
        readingState: readingSnapshot,
      }),
    [indexData, searchIndex, filters, readingSnapshot]
  );

  const allCategoryHitCount =
    shelfView.categories.find((c) => c.id === "all")?.count ?? 0;
  const hasOtherCategoryHits =
    shelfView.hasSearchQuery &&
    filters.category !== "all" &&
    shelfView.items.length === 0 &&
    allCategoryHitCount > 0;

  useEffect(() => {
    const trimmed = filters.query.trim();
    if (!trimmed) {
      setLastTrackedSearchKey(null);
      return;
    }
    if (!shelfView.hasIndexData || isLoadingSearchIndex) {
      return;
    }

    const includeTruth = Boolean(filters.includeTruth);
    const searchKey = `${trimmed}|${includeTruth}`;
    if (getLastTrackedSearchKey() === searchKey) {
      return;
    }

    const timer = setTimeout(() => {
      setLastTrackedSearchKey(searchKey);
      analytics.trackSearch({
        query: trimmed,
        resultCount: shelfView.orderedCount,
        includeTruth,
      });
    }, SEARCH_TRACK_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [
    filters.query,
    filters.includeTruth,
    shelfView.hasIndexData,
    shelfView.orderedCount,
    isLoadingSearchIndex,
    getLastTrackedSearchKey,
    setLastTrackedSearchKey,
  ]);

  const handleSelectCategory = useCallback(
    (category: ShelfCategoryId) => {
      if (category !== filters.category) {
        analytics.trackShelfFilterChange({
          filterType: "category",
          filterValue: category,
        });
      }
      setFilters((prev) => ({ ...prev, category }));
    },
    [filters.category, setFilters]
  );

  const handleFilterTracked = useCallback(
    (filterType: ShelfFilterTrackType, filterValue: string) => {
      analytics.trackShelfFilterChange({ filterType, filterValue });
    },
    []
  );

  const handleResetFilters = useCallback(() => {
    analytics.trackShelfFilterChange({
      filterType: "reset",
      filterValue: "all",
    });
    resetFilters();
  }, [resetFilters]);

  const handleRandomPick = useCallback(() => {
    const picked = pickRandomStory(stories, readingSnapshot, lastOpenedStoryId);
    if (picked) {
      analytics.trackStoryOpen({
        storyId: picked.id,
        storyCategory: picked.shelfCategory,
        source: "random",
      });
      openStory(picked.id);
    }
  }, [stories, readingSnapshot, lastOpenedStoryId, openStory]);

  const handleOpenFromCard = useCallback(
    (storyId: string, isFeatured: boolean) => {
      analytics.trackStoryOpen({
        storyId,
        storyCategory: storyMap.get(storyId)?.shelfCategory,
        source: isFeatured ? "featured" : "card",
      });
      openStory(storyId);
    },
    [storyMap, openStory]
  );

  const handleTrackExternalCardOpen = useCallback(
    (storyId: string, isFeatured: boolean) => {
      analytics.trackStoryOpen({
        storyId,
        storyCategory: storyMap.get(storyId)?.shelfCategory,
        source: isFeatured ? "featured" : "card",
      });
    },
    [storyMap]
  );

  const handleOpenFromSnippet = useCallback(
    (storyId: string, searchTarget: SearchJumpTarget) => {
      analytics.trackStoryOpen({
        storyId,
        storyCategory: storyMap.get(storyId)?.shelfCategory,
        source: "search_snippet",
      });
      openStory(storyId, { searchTarget });
    },
    [storyMap, openStory]
  );

  const handleResumeStory = useCallback(
    (storyId: string, scrollRatio: number) => {
      analytics.trackStoryOpen({
        storyId,
        storyCategory: storyMap.get(storyId)?.shelfCategory,
        source: "resume",
      });
      openStory(storyId, { restoreScrollRatio: scrollRatio });
    },
    [storyMap, openStory]
  );

  const handleTrackExternalResume = useCallback(
    (storyId: string) => {
      analytics.trackStoryOpen({
        storyId,
        storyCategory: storyMap.get(storyId)?.shelfCategory,
        source: "resume",
      });
    },
    [storyMap]
  );

  const handleToggleBookmark = useCallback(
    (storyId: string) => {
      const added = readingStore.toggleBookmark(storyId);
      analytics.trackBookmarkToggle({
        storyId,
        action: added ? "add" : "remove",
        surface: "shelf",
      });
    },
    [readingStore]
  );

  return (
    <section id="shelf-view" ref={shelfRef} className={styles.shelfView} tabIndex={-1}>
      <ObservatoryHeader
        categories={shelfView.categories}
        showCounts={shelfView.hasIndexData}
        onSelectCategory={handleSelectCategory}
      />

      <ResumeBanner
        session={shelfView.resume?.session ?? null}
        story={shelfView.resume?.story ?? null}
        onResumeClick={handleResumeStory}
        onTrackExternalResume={handleTrackExternalResume}
        onDismiss={() => readingStore.clearLastSession()}
      />

      <ShelfToolbar
        hasIndexData={shelfView.hasIndexData}
        hasSearchQuery={shelfView.hasSearchQuery}
        isLoadingSearchIndex={isLoadingSearchIndex}
        filters={filters}
        entities={shelfView.entities}
        regions={shelfView.regions}
        isFiltered={shelfView.isFiltered}
        orderedCount={shelfView.orderedCount}
        totalCount={shelfView.totalCount}
        readCount={shelfView.readCount}
        allRead={shelfView.allRead}
        onChangeFilters={setFilters}
        onFilterTracked={handleFilterTracked}
        onSearchFocus={ensureSearchIndex}
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
        ) : shelfView.items.length === 0 ? (
          <div className={commonStyles.emptyState}>
            <p className={`${commonStyles.emptyTitle} shelf-empty-title`}>
              ✦ 条件に一致する物語が見つかりません
            </p>
            <p className={`${commonStyles.emptyDesc} shelf-empty-desc`}>
              {hasOtherCategoryHits
                ? `選択中のカテゴリーでは一致しませんでしたが、他のカテゴリーに ${allCategoryHitCount} 件の一致があります。`
                : "カテゴリーや読書状態・登場人物・用語・地域・検索語句の条件を変更してお試しください。"}
            </p>
            {hasOtherCategoryHits ? (
              <button
                type="button"
                className={commonStyles.controlPill}
                data-action="switch-all-category"
                onClick={() => handleSelectCategory("all")}
              >
                「すべて」タブで {allCategoryHitCount} 件を表示
              </button>
            ) : null}
            <button
              type="button"
              className={commonStyles.controlPill}
              data-action="reset-filters"
              onClick={handleResetFilters}
            >
              条件をリセットしてすべて表示
            </button>
          </div>
        ) : (
          shelfView.items.map((item) => (
            <StoryCard
              key={item.story.id}
              story={item.story}
              isFeatured={item.isFeatured}
              isRead={item.isRead}
              isNew={item.isNew}
              isBookmarked={item.isBookmarked}
              searchQuery={filters.query}
              searchMatch={item.searchMatch}
              onOpenStory={(id) => handleOpenFromCard(id, item.isFeatured)}
              onTrackExternalOpen={(id) => handleTrackExternalCardOpen(id, item.isFeatured)}
              onOpenStoryWithTarget={handleOpenFromSnippet}
              onToggleBookmark={handleToggleBookmark}
            />
          ))
        )}
      </div>
    </section>
  );
}
