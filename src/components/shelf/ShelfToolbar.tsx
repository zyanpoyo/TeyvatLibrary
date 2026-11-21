import type { ShelfFilterTrackType } from "../../analytics/ga4";
import type { ShelfEntityOption } from "../../domain/catalog";
import type { ReadingStatusFilter, ShelfFilters, SortMode } from "../../types/story";
import { AppIcon } from "../common/AppIcon";
import styles from "./ShelfToolbar.module.css";

export interface ShelfToolbarProps {
  hasIndexData: boolean;
  hasSearchQuery?: boolean;
  isLoadingSearchIndex?: boolean;
  filters: ShelfFilters;
  entities: ReadonlyArray<ShelfEntityOption>;
  regions: ReadonlyArray<string>;
  isFiltered: boolean;
  orderedCount: number;
  totalCount: number;
  readCount: number;
  allRead: boolean;
  onChangeFilters: (updater: (prev: ShelfFilters) => ShelfFilters) => void;
  onFilterTracked?: (filterType: ShelfFilterTrackType, filterValue: string) => void;
  onSearchFocus?: () => void;
  onRandomPick: () => void;
}

export function ShelfToolbar({
  hasIndexData,
  hasSearchQuery = false,
  isLoadingSearchIndex = false,
  filters,
  entities,
  regions,
  isFiltered,
  orderedCount,
  totalCount,
  readCount,
  allRead,
  onChangeFilters,
  onFilterTracked,
  onSearchFocus,
  onRandomPick,
}: ShelfToolbarProps) {
  const countText = isFiltered
    ? `${orderedCount} 件の作品が一致しました（全 ${totalCount} 作品）`
    : `全 ${orderedCount} 作品を表示中`;
  const progressText = `✦ 星図記録：${readCount} / ${totalCount} 篇 読了`;
  const includeTruth = Boolean(filters.includeTruth);

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
          onChange={(e) => {
            const nextStatus = (e.target.value || "all") as ReadingStatusFilter;
            onFilterTracked?.("status", nextStatus);
            onChangeFilters((prev) => ({
              ...prev,
              status: nextStatus,
            }));
          }}
        >
          <option value="all">状態：すべて</option>
          <option value="unread">未読のみ</option>
          <option value="read">読了済み</option>
          <option value="bookmarked">あとで読む</option>
        </select>

        <select
          id="entity-filter"
          className={styles.filterControl}
          aria-label="登場人物・用語で絞り込む"
          value={filters.entityId}
          onChange={(e) => {
            const nextEntityId = e.target.value;
            onFilterTracked?.("entity", nextEntityId || "all");
            onChangeFilters((prev) => ({ ...prev, entityId: nextEntityId }));
          }}
        >
          <option value="">登場人物・用語：すべて</option>
          {entities.map((entity) => (
            <option key={entity.id} value={entity.id}>
              {entity.name} ({entity.count})
            </option>
          ))}
        </select>

        <select
          id="region-filter"
          className={styles.filterControl}
          aria-label="地域で絞り込む"
          value={filters.region}
          onChange={(e) => {
            const nextRegion = e.target.value;
            onFilterTracked?.("region", nextRegion || "all");
            onChangeFilters((prev) => ({ ...prev, region: nextRegion }));
          }}
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
          placeholder="タイトル・本文・人物・用語で横断検索…"
          aria-label="タイトル・本文・人物・用語・時代で検索"
          value={filters.query}
          onFocus={onSearchFocus}
          onChange={(e) =>
            onChangeFilters((prev) => ({ ...prev, query: e.target.value }))
          }
        />

        <button
          type="button"
          id="truth-search-toggle"
          className={styles.truthToggleBtn}
          data-action="toggle-truth-search"
          aria-pressed={includeTruth}
          title="未読作品の真相・考察メモも横断検索の対象に含めます"
          onClick={() => {
            onFilterTracked?.("include_truth", String(!includeTruth));
            onChangeFilters((prev) => ({ ...prev, includeTruth: !prev.includeTruth }));
          }}
        >
          <AppIcon name="magnifier" active={includeTruth} />
          <span>真相メモも含める</span>
        </button>

        <select
          id="sort-filter"
          className={styles.filterControl}
          aria-label="並び替え"
          value={filters.sort}
          onChange={(e) => {
            const nextSort = (e.target.value || "recommended") as SortMode;
            onFilterTracked?.("sort", nextSort);
            onChangeFilters((prev) => ({
              ...prev,
              sort: nextSort,
            }));
          }}
        >
          <option value="recommended">
            {hasSearchQuery ? "並び順：関連度順" : "並び順：おすすめ順"}
          </option>
          <option value="newest">並び順：新着順</option>
          <option value="shortest">並び順：短い順</option>
        </select>
      </div>

      <div className={styles.shelfToolbarMeta}>
        <p className={styles.filterSummary} id="filter-result-summary" aria-live="polite">
          {hasIndexData ? (
            <>
              <span>{countText}</span>
              {hasSearchQuery && isLoadingSearchIndex ? (
                <>
                  <span className={styles.summarySep} aria-hidden="true">
                    ・
                  </span>
                  <span>全文索引を読み込み中…</span>
                </>
              ) : null}
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
          disabled={!hasIndexData || totalCount === 0}
          aria-label={randomAriaLabel}
          onClick={onRandomPick}
        >
          <AppIcon name="dice" />
          <span id="random-story-btn-label">{randomLabel}</span>
        </button>
      </div>
    </div>
  );
}
