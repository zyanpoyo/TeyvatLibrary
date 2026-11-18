import { useCallback, useMemo, useRef } from "react";
import { deriveShelfView, pickRandomStory } from "../../domain/catalog";
import {
  useReadingStateStore,
  useShelfContext,
  useShelfTransition,
} from "../../state/AppProviders";
import commonStyles from "../../styles/common.module.css";
import { ObservatoryHeader } from "./ObservatoryHeader";
import { ResumeBanner } from "./ResumeBanner";
import { ShelfToolbar } from "./ShelfToolbar";
import { StoryCard } from "./StoryCard";
import styles from "./StoryCard.module.css";

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
  const { lastOpenedStoryId, openStory } = useShelfTransition(shelfRef);

  const stories = indexData?.stories ?? [];
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

  const handleRandomPick = useCallback(() => {
    const picked = pickRandomStory(stories, readingSnapshot, lastOpenedStoryId);
    if (picked) {
      openStory(picked.id);
    }
  }, [stories, readingSnapshot, lastOpenedStoryId, openStory]);

  return (
    <section id="shelf-view" ref={shelfRef} className={styles.shelfView} tabIndex={-1}>
      <ObservatoryHeader
        categories={shelfView.categories}
        showCounts={shelfView.hasIndexData}
        onSelectCategory={(category) => setFilters((prev) => ({ ...prev, category }))}
      />

      <ResumeBanner
        session={shelfView.resume?.session ?? null}
        story={shelfView.resume?.story ?? null}
        onResumeClick={(storyId, scrollRatio) =>
          openStory(storyId, { restoreScrollRatio: scrollRatio })
        }
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
                onClick={() => setFilters((prev) => ({ ...prev, category: "all" }))}
              >
                「すべて」タブで {allCategoryHitCount} 件を表示
              </button>
            ) : null}
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
              onOpenStory={openStory}
              onOpenStoryWithTarget={(storyId, searchTarget) =>
                openStory(storyId, { searchTarget })
              }
              onToggleBookmark={(id) => readingStore.toggleBookmark(id)}
            />
          ))
        )}
      </div>
    </section>
  );
}
