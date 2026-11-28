import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router";
import { analytics } from "../../analytics/ga4";
import {
  deriveEntitiesArchiveView,
  ENTITY_KIND_LABELS,
} from "../../domain/entities";
import { ENTITIES_DOCUMENT_TITLE } from "../../domain/seo";
import {
  BASE_DOCUMENT_TITLE,
  useReadingStateStore,
  useShelfContext,
} from "../../state/AppProviders";
import commonStyles from "../../styles/common.module.css";
import type { EntityKind, EntitySortMode, StoriesIndexData } from "../../types/story";
import { SiteNavBar } from "../layout/SiteNavBar";
import { ThemeSwitcher } from "../layout/ThemeSwitcher";
import { EntityCard } from "./EntityCard";
import styles from "./EntitiesPage.module.css";

export interface EntitiesPageProps {
  initialIndexData?: StoriesIndexData | null;
}

/**
 * 人物・用語名鑑の一覧ページ（/entities）。
 * 種別フィルタ・日本語正規化キーワード検索・並び替えを備え、人物や重要用語から関連物語へ辿れる。
 */
export function EntitiesPage({ initialIndexData = null }: EntitiesPageProps = {}) {
  const location = useLocation();
  const lastTrackedKeyRef = useRef<string | null>(null);
  const [kindFilter, setKindFilter] = useState<"all" | EntityKind>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<EntitySortMode>("stories");

  const { snapshot: readingSnapshot } = useReadingStateStore();
  const {
    indexData,
    indexError,
    isLoadingIndex,
    seedIndexData,
  } = useShelfContext();

  const effectiveIndexData = indexData ?? initialIndexData ?? null;
  const effectiveIsLoadingIndex = !effectiveIndexData && isLoadingIndex;

  useEffect(() => {
    if (initialIndexData && !indexData) {
      seedIndexData(initialIndexData);
    }
  }, [initialIndexData, indexData, seedIndexData]);

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [location.key]);

  useEffect(() => {
    document.title = ENTITIES_DOCUMENT_TITLE;
    return () => {
      document.title = BASE_DOCUMENT_TITLE;
    };
  }, []);

  useEffect(() => {
    if (lastTrackedKeyRef.current === location.key) return;
    lastTrackedKeyRef.current = location.key;
    analytics.trackPageView({
      pagePath: "/entities",
      pageTitle: ENTITIES_DOCUMENT_TITLE,
    });
  }, [location.key]);

  const view = useMemo(
    () =>
      deriveEntitiesArchiveView({
        indexData: effectiveIndexData,
        readingState: readingSnapshot,
        kindFilter,
        query,
        sort,
      }),
    [effectiveIndexData, readingSnapshot, kindFilter, query, sort]
  );

  const countText = view.hasActiveFilter
    ? `${view.filteredCount} 件が一致しました（全 ${view.totalCount} 項目）`
    : `全 ${view.totalCount} 項目を表示中`;

  const handleResetFilters = () => {
    setKindFilter("all");
    setQuery("");
  };

  return (
    <section id="entities-view" className={styles.entitiesView} tabIndex={-1}>
      <header className={styles.entitiesHero}>
        <svg
          className={styles.entitiesChartBg}
          viewBox="0 0 960 280"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        >
          <g stroke="var(--chart-stroke-main)" strokeWidth="0.9" fill="none">
            <circle cx="480" cy="130" r="118" />
            <circle cx="480" cy="130" r="175" strokeDasharray="3 5" />
            <circle cx="480" cy="130" r="245" stroke="var(--chart-stroke-sub)" />
            <line x1="160" y1="130" x2="800" y2="130" stroke="var(--chart-stroke-axis)" />
            <line x1="480" y1="0" x2="480" y2="260" stroke="var(--chart-stroke-axis)" />
          </g>
        </svg>

        <div className={styles.heroTopBar}>
          <SiteNavBar id="entities-site-nav" />
          <ThemeSwitcher id="entities-theme-switcher" />
        </div>

        <div className={styles.entitiesHeroInner}>
          <p className={styles.entitiesEyebrow}>✦ Entities Archive ✦</p>
          <h1 className={styles.entitiesTitle}>人物・用語名鑑</h1>
          <p className={styles.entitiesLead}>
            聖遺物・武器・書籍の随所に登場する人物や魔神たちの正体・背景解説・公式出典を横断し、関連物語へ直接辿れる設定確認辞書です。
          </p>
          <p className={styles.spoilerNotice} id="entities-spoiler-notice">
            ※ 物語の核心や正体に関する記述を含みます。未読作品のネタバレを避けたい場合は書架から先に物語をお読みください。
          </p>
        </div>

        <div
          className={styles.kindFilterRow}
          role="group"
          aria-label="種別で絞り込む"
        >
          <button
            type="button"
            className={styles.kindFilterPill}
            data-entity-filter="all"
            aria-pressed={kindFilter === "all"}
            onClick={() => setKindFilter("all")}
          >
            <span>すべて</span>
            <span className={styles.kindCount}>{view.kindCounts.all}</span>
          </button>
          {view.availableKinds.map((kind) => (
            <button
              key={kind}
              type="button"
              className={styles.kindFilterPill}
              data-entity-filter={kind}
              aria-pressed={kindFilter === kind}
              onClick={() => setKindFilter(kind)}
            >
              <span>{ENTITY_KIND_LABELS[kind].label}</span>
              <span className={styles.kindCount}>{view.kindCounts[kind]}</span>
            </button>
          ))}
        </div>
      </header>

      <div className={styles.archiveToolbar} aria-label="人物・用語の絞り込みと並び替え">
        <div className={styles.toolbarControls}>
          <input
            type="search"
            id="entities-search-input"
            className={`${styles.filterControl} ${styles.filterSearch}`}
            placeholder="名称・正体・解説・出典・作品名で絞り込む…"
            aria-label="人物・用語名鑑をキーワードで絞り込む"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          <select
            id="entities-sort-select"
            className={styles.filterControl}
            aria-label="並び替え"
            value={sort}
            onChange={(e) => setSort((e.target.value as EntitySortMode) || "stories")}
          >
            <option value="stories">並び順：登場作品が多い順</option>
            <option value="name">並び順：五十音順</option>
          </select>
        </div>

        <div className={styles.toolbarMeta}>
          <p className={styles.filterSummary} id="entities-filter-summary" aria-live="polite">
            {effectiveIndexData ? countText : null}
          </p>
          {view.hasActiveFilter ? (
            <button
              type="button"
              id="entities-reset-btn"
              className={styles.resetFilterBtn}
              onClick={handleResetFilters}
            >
              条件をリセット
            </button>
          ) : null}
        </div>
      </div>

      {effectiveIsLoadingIndex ? (
        <p className={commonStyles.loadingStatus}>✦ 人物・用語名鑑を読み込んでいます…</p>
      ) : indexError ? (
        <div className={commonStyles.emptyState}>
          <p className={commonStyles.emptyTitle}>データの読み込みに失敗しました</p>
          <p className={commonStyles.emptyDesc}>{indexError}</p>
        </div>
      ) : view.groups.length === 0 ? (
        <div className={commonStyles.emptyState}>
          <p className={commonStyles.emptyTitle}>一致する人物・用語が見つかりません</p>
          <p className={commonStyles.emptyDesc}>
            検索キーワードや種別の絞り込み条件を変更して再度お試しください。
          </p>
          {view.hasActiveFilter ? (
            <button
              type="button"
              className={commonStyles.controlPill}
              onClick={handleResetFilters}
            >
              絞り込み条件をリセット
            </button>
          ) : null}
        </div>
      ) : (
        <div className={styles.entityGroups}>
          {view.groups.map((group) => (
            <section
              key={group.kind}
              className={styles.entityGroup}
              data-entity-group={group.kind}
              aria-labelledby={`entity-group-${group.kind}`}
            >
              <div className={styles.entityGroupHeader}>
                <h2 id={`entity-group-${group.kind}`} className={styles.entityGroupHeading}>
                  ✦ {group.heading}
                </h2>
                <span className={styles.entityGroupCount}>{group.items.length} 項目</span>
              </div>

              <div className={styles.entityGrid}>
                {group.items.map((item) => (
                  <EntityCard key={item.entity.id} item={item} headingLevel={3} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
