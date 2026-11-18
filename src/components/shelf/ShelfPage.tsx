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
    filters,
    setFilters,
    resetFilters,
  } = useShelfContext();
  const { lastOpenedStoryId, openStory } = useShelfTransition(shelfRef);

  const stories = indexData?.stories ?? [];
  const shelfView = useMemo(
    () => deriveShelfView({ indexData, filters, readingState: readingSnapshot }),
    [indexData, filters, readingSnapshot]
  );

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
        filters={filters}
        entities={shelfView.entities}
        regions={shelfView.regions}
        isFiltered={shelfView.isFiltered}
        orderedCount={shelfView.orderedCount}
        totalCount={shelfView.totalCount}
        readCount={shelfView.readCount}
        allRead={shelfView.allRead}
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
        ) : shelfView.items.length === 0 ? (
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
          shelfView.items.map((item) => (
            <StoryCard
              key={item.story.id}
              story={item.story}
              isFeatured={item.isFeatured}
              isRead={item.isRead}
              isNew={item.isNew}
              isBookmarked={item.isBookmarked}
              onOpenStory={openStory}
              onToggleBookmark={(id) => readingStore.toggleBookmark(id)}
            />
          ))
        )}
      </div>
    </section>
  );
}
