import { useMemo } from "react";
import type {
  ReadingStatusFilter,
  ShelfFilters,
  SortMode,
  StoriesIndexData,
} from "../../types/story";
import styles from "./ShelfToolbar.module.css";

export interface ShelfToolbarProps {
  indexData: StoriesIndexData | null;
  filters: ShelfFilters;
  orderedCount: number;
  totalCount: number;
  readCount: number;
  onChangeFilters: (updater: (prev: ShelfFilters) => ShelfFilters) => void;
  onRandomPick: () => void;
}

export function ShelfToolbar({
  indexData,
  filters,
  orderedCount,
  totalCount,
  readCount,
  onChangeFilters,
  onRandomPick,
}: ShelfToolbarProps) {
  const entities = useMemo(() => {
    if (!indexData?.entitiesIndex) return [];
    return Object.entries(indexData.entitiesIndex).sort(
      (a, b) => (b[1].storyIds?.length || 0) - (a[1].storyIds?.length || 0)
    );
  }, [indexData]);

  const regions = useMemo(() => {
    const regionSet = new Set<string>();
    for (const story of indexData?.stories || []) {
      for (const r of story.region || []) {
        regionSet.add(r);
      }
    }
    return [...regionSet];
  }, [indexData]);

  const hasSubFilter = Boolean(
    (filters.status && filters.status !== "all") ||
      filters.entityId ||
      filters.region ||
      (filters.query || "").trim()
  );

  const countText = hasSubFilter
    ? `${orderedCount} 件の作品が一致しました（全 ${totalCount} 作品）`
    : `全 ${orderedCount} 作品を表示中`;
  const progressText = `✦ 星図記録：${readCount} / ${totalCount} 篇 読了`;

  const allRead = totalCount > 0 && readCount >= totalCount;
  const randomLabel = allRead ? "おまかせで1篇読む" : "未読から1篇読む";
  const randomAriaLabel = allRead
    ? "全作品からおまかせで1篇開く"
    : "未読作品からランダムに1篇開く";

  return (
    <div className={styles.shelfToolbar} aria-label="人物・用語・地域・キーワード検索">
      <div className={styles.shelfFilters}>
        <select
          id="status-filter"
          className={styles.filterControl}
          aria-label="読書状態で絞り込む"
          value={filters.status}
          onChange={(e) =>
            onChangeFilters((prev) => ({
              ...prev,
              status: (e.target.value || "all") as ReadingStatusFilter,
            }))
          }
        >
          <option value="all">状態：すべて</option>
          <option value="unread">未読のみ</option>
          <option value="read">読了済み</option>
          <option value="bookmarked">🔖 あとで読む</option>
        </select>

        <select
          id="entity-filter"
          className={styles.filterControl}
          aria-label="登場人物・用語で絞り込む"
          value={filters.entityId}
          onChange={(e) =>
            onChangeFilters((prev) => ({ ...prev, entityId: e.target.value }))
          }
        >
          <option value="">登場人物・用語：すべて</option>
          {entities.map(([id, info]) => (
            <option key={id} value={id}>
              {info.name} ({info.storyIds?.length || 0})
            </option>
          ))}
        </select>

        <select
          id="region-filter"
          className={styles.filterControl}
          aria-label="地域で絞り込む"
          value={filters.region}
          onChange={(e) =>
            onChangeFilters((prev) => ({ ...prev, region: e.target.value }))
          }
        >
          <option value="">地域：すべて</option>
          {regions.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>

        <input
          type="search"
          id="search-filter"
          className={`${styles.filterControl} ${styles.filterSearch}`}
          placeholder="タイトル・キーワード・時代で検索…"
          aria-label="タイトル・キーワード・時代で検索"
          value={filters.query}
          onChange={(e) =>
            onChangeFilters((prev) => ({ ...prev, query: e.target.value }))
          }
        />

        <select
          id="sort-filter"
          className={styles.filterControl}
          aria-label="並び替え"
          value={filters.sort}
          onChange={(e) =>
            onChangeFilters((prev) => ({
              ...prev,
              sort: (e.target.value || "recommended") as SortMode,
            }))
          }
        >
          <option value="recommended">並び順：おすすめ順</option>
          <option value="newest">並び順：新着順</option>
          <option value="shortest">並び順：短い順</option>
        </select>
      </div>

      <div className={styles.shelfToolbarMeta}>
        <p className={styles.filterSummary} id="filter-result-summary" aria-live="polite">
          {indexData ? (
            <>
              <span>{countText}</span>
              <span className={styles.summarySep} aria-hidden="true">
                ・
              </span>
              <span className={styles.summaryProgress}>{progressText}</span>
            </>
          ) : null}
        </p>

        <button
          type="button"
          id="random-story-btn"
          className={styles.randomReadBtn}
          disabled={!indexData || totalCount === 0}
          aria-label={randomAriaLabel}
          onClick={onRandomPick}
        >
          <span aria-hidden="true">🎲</span>
          <span id="random-story-btn-label">{randomLabel}</span>
        </button>
      </div>
    </div>
  );
}
