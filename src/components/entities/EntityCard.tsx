import { Link } from "react-router";
import { ENTITY_KIND_LABELS, type EntityListCardView } from "../../domain/entities";
import { AppIcon } from "../common/AppIcon";
import styles from "./EntityCard.module.css";

export interface EntityCardProps {
  item: EntityListCardView;
  headingLevel?: 2 | 3;
}

/**
 * 人物・用語名鑑一覧ページで使用する表示専用カード。
 */
export function EntityCard({ item, headingLevel = 3 }: EntityCardProps) {
  const { entity, progress, regions } = item;
  const entityPath = `/entities/${encodeURIComponent(entity.id)}`;
  const HeadingTag = headingLevel === 2 ? "h2" : "h3";
  const kindLabel = ENTITY_KIND_LABELS[entity.kind].label;
  const regionLabel = regions.slice(0, 2).join("・");

  return (
    <article
      className={`${styles.entityCard} entity-card`}
      data-entity-id={entity.id}
      data-entity-kind={entity.kind}
      data-completed={String(progress.isCompleted)}
    >
      <div>
        <div className={styles.entityTopRow}>
          <span className={styles.entityKindBadge}>{kindLabel}</span>
          {progress.isCompleted ? (
            <span className={`${styles.entityCompletedBadge} entity-completed-badge`}>
              ✦ 全篇読了
            </span>
          ) : null}
        </div>

        <HeadingTag className={styles.entityTitle}>
          <Link to={entityPath} className={`${styles.entityPrimaryLink} entity-primary-link`}>
            {entity.name}
          </Link>
        </HeadingTag>

        {entity.defaultIdentity ? (
          <p className={styles.entityIdentity}>{entity.defaultIdentity}</p>
        ) : null}
        {entity.defaultDesc ? (
          <p className={styles.entityDesc}>{entity.defaultDesc}</p>
        ) : null}
      </div>

      <div className={styles.entityFooter}>
        <div className={styles.entityMetaLine}>
          <span className={styles.entityMetaCount}>
            <AppIcon name="books" />
            <span>
              登場 {entity.storyIds.length}篇{regionLabel ? ` ・ ${regionLabel}` : ""}
            </span>
          </span>
          <span className={`${styles.entityProgressText} entity-progress-text`}>
            {progress.readCount} / {progress.totalCount} 篇 読了
          </span>
        </div>

        <div
          className={styles.progressTrack}
          role="progressbar"
          aria-valuenow={progress.readCount}
          aria-valuemin={0}
          aria-valuemax={progress.totalCount}
          aria-label={`「${entity.name}」の登場物語 読了進捗: ${progress.readCount} / ${progress.totalCount} 篇`}
        >
          <div
            className={styles.progressFill}
            style={{ width: `${progress.progressPercent}%` }}
          />
        </div>
      </div>
    </article>
  );
}
