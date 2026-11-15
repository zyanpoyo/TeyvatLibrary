import type { MouseEvent } from "react";
import { Link } from "react-router";
import { formatRegion } from "../../domain/text-parser";
import type { StoryIndexItem } from "../../types/story";
import { CategoryEmblem } from "../common/CategoryEmblem";
import commonStyles from "../../styles/common.module.css";
import styles from "./StoryCard.module.css";

export interface StoryCardProps {
  story: StoryIndexItem;
  isFeatured: boolean;
  isRead: boolean;
  isNew: boolean;
  isBookmarked: boolean;
  onBeforeOpenStory: (storyId: string) => void;
  onOpenStory: (storyId: string) => void;
  onToggleBookmark: (storyId: string) => void;
}

function isModifiedClick(event: MouseEvent): boolean {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
}

export function StoryCard({
  story,
  isFeatured,
  isRead,
  isNew,
  isBookmarked,
  onBeforeOpenStory,
  onOpenStory,
  onToggleBookmark,
}: StoryCardProps) {
  const regionLabel = formatRegion(story.region);
  const storyPath = `/story/${encodeURIComponent(story.id)}`;

  const handleCardClick = (event: MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest('[data-action="toggle-bookmark"]')) {
      return;
    }
    if (target.closest("a")) {
      return;
    }
    if (isModifiedClick(event)) return;
    onOpenStory(story.id);
  };

  return (
    <article
      className={`${styles.storyCard} story-card${isFeatured ? ` ${styles.isFeatured} is-featured` : ""}`}
      data-story-id={story.id}
      data-read={String(isRead)}
      onClick={handleCardClick}
    >
      <div>
        {!isFeatured ? (
          <div className={styles.cardEmblemCenter}>
            <CategoryEmblem category={story.shelfCategory} />
          </div>
        ) : null}

        <div className={styles.cardTopRow}>
          <div className={styles.cardMetaTop}>
            {isFeatured ? (
              <span className={styles.cardEmblem}>
                <CategoryEmblem category={story.shelfCategory} />
              </span>
            ) : null}
            {isFeatured ? (
              <span className={`${styles.featuredBadge} featured-badge`}>
                ✦ 今日の物語ピックアップ
              </span>
            ) : null}
            <span className={commonStyles.categoryBadge}>{story.categoryLabel}</span>
            <span>
              ⏱ {story.readingTime} ・ {regionLabel}
            </span>
          </div>

          <div className={styles.cardStatusActions}>
            {isNew ? <span className={`${styles.newBadge} new-badge`}>NEW</span> : null}
            {isRead ? <span className={`${styles.readBadge} read-badge`}>✦ 読了</span> : null}
            <button
              type="button"
              className={`${styles.cardBookmarkBtn} card-bookmark-btn`}
              data-action="toggle-bookmark"
              data-story-id={story.id}
              aria-pressed={isBookmarked}
              aria-label={`『${story.title}』をあとで読む`}
              onClick={(e) => {
                e.stopPropagation();
                onToggleBookmark(story.id);
              }}
            >
              <span aria-hidden="true">🔖</span>
              <span>あとで読む</span>
            </button>
          </div>
        </div>

        <h2 className={styles.cardTitle}>
          <Link
            className={`${styles.cardPrimaryLink} card-primary-link`}
            to={storyPath}
            onClick={(e) => {
              if (isModifiedClick(e)) return;
              onBeforeOpenStory(story.id);
            }}
          >
            {story.title}
          </Link>
        </h2>
        <p className={styles.cardHook}>{story.hook}</p>
      </div>

      <div className={styles.cardTags}>
        {(story.tags || []).map((tag) => (
          <span key={tag} className={styles.tagChip}>
            #{tag}
          </span>
        ))}
      </div>
    </article>
  );
}
