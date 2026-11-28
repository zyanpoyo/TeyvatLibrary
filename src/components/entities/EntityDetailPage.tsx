import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Link, useLocation } from "react-router";
import { analytics, type StoryShareMethod } from "../../analytics/ga4";
import {
  deriveEntityDetailView,
  ENTITY_KIND_LABELS,
} from "../../domain/entities";
import { buildEntityDocumentTitle } from "../../domain/seo";
import {
  buildEntityShareUrl,
  buildEntityXShareIntentUrl,
} from "../../domain/share";
import { formatRegion } from "../../domain/text-parser";
import {
  BASE_DOCUMENT_TITLE,
  useReadingStateStore,
  useShelfContext,
} from "../../state/AppProviders";
import commonStyles from "../../styles/common.module.css";
import type {
  EntityIndexEntry,
  StoriesIndexData,
  StoryCategoryId,
} from "../../types/story";
import { AppIcon } from "../common/AppIcon";
import { EvidenceText } from "../common/EvidenceText";
import { ShareBar } from "../common/ShareBar";
import { CourseCard } from "../courses/CourseCard";
import { SiteNavBar } from "../layout/SiteNavBar";
import { ThemeSwitcher } from "../layout/ThemeSwitcher";
import styles from "./EntityDetailPage.module.css";

export interface EntityDetailPageProps {
  entityId: string;
  initialEntity?: EntityIndexEntry | null;
  initialIndexData?: StoriesIndexData | null;
}

/**
 * 人物・用語名鑑の個別詳細ページ（/entities/:entityId）。
 * 正体・背景解説・出典リンク・登場作品（読了進捗/CTA）・関連読書コース・共起人物/用語・シェア導線を提供する。
 */
export function EntityDetailPage({
  entityId,
  initialEntity = null,
  initialIndexData = null,
}: EntityDetailPageProps) {
  const location = useLocation();
  const lastTrackedKeyRef = useRef<string | null>(null);

  const { snapshot: readingSnapshot } = useReadingStateStore();
  const {
    indexData,
    indexError,
    isLoadingIndex,
    seedIndexData,
  } = useShelfContext();

  const effectiveIndexData = useMemo(() => {
    if (indexData) return indexData;
    if (initialIndexData) return initialIndexData;
    if (initialEntity && entityId) {
      return {
        generatedAt: "",
        totalCount: 0,
        categoryCounts: { book: 0, artifact: 0, weapon: 0, attire: 0, chronicle: 0 },
        entitiesIndex: { [entityId]: initialEntity },
        stories: [],
      } satisfies StoriesIndexData;
    }
    return null;
  }, [indexData, initialIndexData, initialEntity, entityId]);

  const effectiveIsLoadingIndex = !effectiveIndexData && isLoadingIndex;

  useEffect(() => {
    if (initialIndexData && !indexData) {
      seedIndexData(initialIndexData);
    }
  }, [initialIndexData, indexData, seedIndexData]);

  const view = useMemo(
    () =>
      deriveEntityDetailView({
        entityId,
        indexData: effectiveIndexData,
        readingState: readingSnapshot,
      }),
    [entityId, effectiveIndexData, readingSnapshot]
  );

  const storyCategoryById = useMemo(
    () =>
      new Map(
        (effectiveIndexData?.stories ?? []).map((story) => [story.id, story.shelfCategory])
      ),
    [effectiveIndexData]
  );

  const entity = view?.entity ?? null;

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [location.key, entityId]);

  useEffect(() => {
    if (!entity) return;
    document.title = buildEntityDocumentTitle(entity);
    return () => {
      document.title = BASE_DOCUMENT_TITLE;
    };
  }, [entity]);

  useEffect(() => {
    if (!entity || entity.id !== entityId) return;
    const trackKey = `${location.key}:${entity.id}`;
    if (lastTrackedKeyRef.current === trackKey) return;
    lastTrackedKeyRef.current = trackKey;
    analytics.trackPageView({
      pagePath: `/entities/${entity.id}`,
      pageTitle: buildEntityDocumentTitle(entity),
      entityId: entity.id,
    });
  }, [entity, entityId, location.key]);

  const handleOpenStory = useCallback(
    (storyId: string, storyCategory?: StoryCategoryId) => {
      analytics.trackStoryOpen({
        storyId,
        storyCategory: storyCategory ?? storyCategoryById.get(storyId),
        source: "entity_detail",
      });
    },
    [storyCategoryById]
  );

  const handleOpenEvidence = useCallback(
    (targetStoryId: string) => {
      analytics.trackStoryOpen({
        storyId: targetStoryId,
        storyCategory: storyCategoryById.get(targetStoryId),
        source: "entity_evidence",
      });
    },
    [storyCategoryById]
  );

  const handleShareEntity = useCallback(
    (method: StoryShareMethod) => {
      if (!entity) return;
      analytics.trackEntityShare({
        entityId: entity.id,
        entityKind: entity.kind,
        method,
      });
    },
    [entity]
  );

  const shareUrl = useMemo(
    () => (entity ? buildEntityShareUrl(entity.id) : ""),
    [entity]
  );
  const xIntentUrl = useMemo(
    () => (entity ? buildEntityXShareIntentUrl(entity) : ""),
    [entity]
  );

  return (
    <section id="entity-detail-view" className={styles.entityDetailView} tabIndex={-1}>
      <div className={styles.topControlBar}>
        <SiteNavBar id="entity-detail-site-nav" />
        <ThemeSwitcher id="entity-detail-theme-switcher" />
      </div>

      <nav className={styles.breadcrumbRow} aria-label="ページ遷移">
        <Link to="/entities" id="entity-back-to-list-link" className={styles.backLink}>
          ← 人物・用語名鑑へ
        </Link>
      </nav>

      {effectiveIsLoadingIndex && !entity ? (
        <p className={commonStyles.loadingStatus}>✦ 人物・用語の記録を読み込んでいます…</p>
      ) : indexError && !entity ? (
        <div className={commonStyles.emptyState}>
          <h1 className={commonStyles.emptyTitle}>データの読み込みに失敗しました</h1>
          <p className={commonStyles.emptyDesc}>{indexError}</p>
          <Link to="/entities" className={commonStyles.controlPill}>
            ← 人物・用語名鑑へ戻る
          </Link>
        </div>
      ) : !view || !entity ? (
        <div className={commonStyles.emptyState}>
          <h1 className={commonStyles.emptyTitle}>人物・用語が見つかりません</h1>
          <p className={commonStyles.emptyDesc}>
            指定された人物・用語は見つかりませんでした。URL を確認するか、名鑑一覧からお探しください。
          </p>
          <Link to="/entities" className={commonStyles.controlPill}>
            ← 人物・用語名鑑へ戻る
          </Link>
        </div>
      ) : (
        <>
          <header className={styles.entityHeaderCard} id="entity-detail-header">
            <div className={styles.entityKicker}>
              <span className={commonStyles.categoryBadge}>
                {ENTITY_KIND_LABELS[entity.kind].label}
              </span>
              <span className={styles.entityMetaItem}>
                <AppIcon name="books" />
                <span>登場物語 全{entity.storyIds.length}篇</span>
              </span>
            </div>

            <h1 className={`${styles.entityTitle} entity-detail-title`}>{entity.name}</h1>

            {entity.defaultIdentity ? (
              <p className={styles.entityIdentity}>{entity.defaultIdentity}</p>
            ) : null}

            {entity.defaultDesc ? (
              <p className={styles.entityDesc}>{entity.defaultDesc}</p>
            ) : null}

            {entity.defaultEvidence ? (
              <div className={styles.evidenceBox} id="entity-detail-evidence">
                <span className={styles.evidenceLabel}>
                  <AppIcon name="books" />
                  <span>出典・根拠：</span>
                </span>
                <span>
                  <EvidenceText
                    evidence={entity.defaultEvidence}
                    evidenceLinks={entity.evidenceLinks}
                    linkClassName={styles.evidenceLink}
                    onSelectEvidenceLink={handleOpenEvidence}
                  />
                </span>
              </div>
            ) : null}

            <div className={styles.progressAndCta}>
              <div className={styles.progressBlock}>
                <div className={styles.progressHeader}>
                  <span className={styles.progressLabel} id="entity-detail-progress">
                    登場 {view.progress.totalCount} 篇中 {view.progress.readCount} 篇 読了
                  </span>
                  {view.progress.isCompleted ? (
                    <span className={styles.completedBadge}>✦ 登場物語を読破済み</span>
                  ) : null}
                </div>
                <div
                  className={styles.progressTrack}
                  role="progressbar"
                  aria-valuenow={view.progress.readCount}
                  aria-valuemin={0}
                  aria-valuemax={view.progress.totalCount}
                  aria-label={`読了進捗: ${view.progress.readCount} / ${view.progress.totalCount} 篇`}
                >
                  <div
                    className={styles.progressFill}
                    style={{ width: `${view.progress.progressPercent}%` }}
                  />
                </div>
              </div>

              {view.progress.nextUnreadStoryId ? (
                <Link
                  id="entity-primary-cta"
                  className={styles.primaryCtaLink}
                  to={`/story/${encodeURIComponent(view.progress.nextUnreadStoryId)}`}
                  onClick={() => {
                    if (view.progress.nextUnreadStoryId) {
                      handleOpenStory(view.progress.nextUnreadStoryId);
                    }
                  }}
                >
                  <AppIcon name="open-book" />
                  <span>{view.progress.ctaLabel}</span>
                </Link>
              ) : null}
            </div>
          </header>

          <section className={styles.sectionBlock} aria-labelledby="entity-stories-heading">
            <h2 id="entity-stories-heading" className={styles.sectionHeading}>
              <AppIcon name="open-book" />
              <span>登場する物語</span>
            </h2>

            <ol id="entity-stories-list" className={styles.storiesList}>
              {view.stories.map((item) => {
                const storyPath = `/story/${encodeURIComponent(item.storyId)}`;
                const storyTitle = item.story?.title || item.storyId;
                const regionText = item.story ? formatRegion(item.story.region) : "";

                return (
                  <li
                    key={item.storyId}
                    className={`${styles.storyItemCard} entity-story-card`}
                    data-story-id={item.storyId}
                    data-read={String(item.isRead)}
                    data-next-unread={String(item.isNextUnread)}
                  >
                    <div className={styles.storyTopRow}>
                      <div className={styles.storyMetaLeft}>
                        {item.story ? (
                          <>
                            <span className={commonStyles.categoryBadge}>
                              {item.story.categoryLabel}
                            </span>
                            <span>
                              {item.story.readingTime}
                              {regionText ? ` ・ ${regionText}` : ""}
                            </span>
                          </>
                        ) : null}
                      </div>

                      <div className={styles.storyStatusGroup}>
                        {item.isNextUnread ? (
                          <span className={styles.storyNextBadge}>次に読む</span>
                        ) : null}
                        {item.isRead ? (
                          <span className={styles.storyReadBadge}>✦ 読了</span>
                        ) : null}
                      </div>
                    </div>

                    <h3 className={styles.storyTitle}>
                      <Link
                        to={storyPath}
                        className={`${styles.storyTitleLink} entity-story-link`}
                        onClick={() => handleOpenStory(item.storyId, item.story?.shelfCategory)}
                      >
                        {storyTitle}
                      </Link>
                    </h3>

                    {item.story?.hook ? (
                      <p className={styles.storyHook}>{item.story.hook}</p>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </section>

          <div className={styles.shareSection}>
            <ShareBar
              id="entity-share-bar"
              ariaLabel="人物・用語名鑑を共有"
              shareUrl={shareUrl}
              xIntentUrl={xIntentUrl}
              xActionName="share-entity-x"
              copyActionName="copy-entity-url"
              resetKey={entity.id}
              onShare={handleShareEntity}
            />
          </div>

          {view.relatedCourses.length > 0 ? (
            <section className={styles.sectionBlock} aria-labelledby="entity-courses-heading">
              <div className={styles.sectionHeaderRow}>
                <h2 id="entity-courses-heading" className={styles.sectionHeading}>
                  <AppIcon name="books" />
                  <span>関連する読書コース</span>
                </h2>
                <Link to="/courses" className={styles.backLink}>
                  すべて見る →
                </Link>
              </div>

              <div className={styles.coursesGrid}>
                {view.relatedCourses.map((item) => (
                  <CourseCard
                    key={item.course.id}
                    course={item.course}
                    progress={item.progress}
                    headingLevel={3}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {view.relatedEntities.length > 0 ? (
            <section className={styles.sectionBlock} aria-labelledby="entity-related-heading">
              <h2 id="entity-related-heading" className={styles.sectionHeading}>
                <AppIcon name="link-rings" />
                <span>同じ物語に登場する人物・用語</span>
              </h2>

              <ul className={styles.relatedEntitiesGrid} id="entity-related-list">
                {view.relatedEntities.map((rel) => (
                  <li key={rel.entity.id}>
                    <Link
                      to={`/entities/${encodeURIComponent(rel.entity.id)}`}
                      className={`${styles.relatedEntityChip} entity-related-chip`}
                      data-entity-id={rel.entity.id}
                    >
                      <span className={styles.relatedEntityName}>{rel.entity.name}</span>
                      <span className={styles.relatedEntityMeta}>
                        {ENTITY_KIND_LABELS[rel.entity.kind].label}・{rel.sharedStoryCount}篇で共演
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </section>
  );
}
