import { Link } from "react-router";
import type { LastSessionSnapshot, StoryIndexItem } from "../../types/story";
import { AppIcon } from "../common/AppIcon";
import styles from "./ResumeBanner.module.css";

export interface ResumeBannerProps {
  session: LastSessionSnapshot | null;
  story: StoryIndexItem | null;
  onResumeClick: (storyId: string, scrollRatio: number) => void;
  onDismiss: () => void;
}

export function ResumeBanner({
  session,
  story,
  onResumeClick,
  onDismiss,
}: ResumeBannerProps) {
  if (!session || !story) {
    return <div id="resume-banner-container" className={styles.resumeBannerContainer} hidden />;
  }

  const percent = Math.round(session.scrollRatio * 100);
  const chapterCount = story.chapterCount || 1;
  const chapterNum = Math.min(chapterCount, (session.chapterIndex ?? 0) + 1);
  const progressLabel = chapterCount > 1 ? `第${chapterNum}章（${percent}%）` : `（${percent}%）`;

  return (
    <div id="resume-banner-container" className={styles.resumeBannerContainer}>
      <div className={`${styles.resumeBanner} resume-banner`} role="region" aria-label="前回の続き">
        <Link
          className={styles.resumeBannerLink}
          to={`/story/${encodeURIComponent(story.id)}`}
          state={{ restoreScrollRatio: session.scrollRatio }}
          data-action="resume-story"
          data-story-id={story.id}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
            e.preventDefault();
            onResumeClick(story.id, session.scrollRatio);
          }}
        >
          <span className={styles.resumeBannerIcon} aria-hidden="true">
            <AppIcon name="open-book" />
          </span>
          <span className={styles.resumeBannerText}>
            <strong>前回の続き</strong>：『{story.title}』{progressLabel}から再開する
          </span>
          <span className={styles.resumeBannerCta} aria-hidden="true">
            続きから読む →
          </span>
        </Link>
        <button
          type="button"
          className={styles.resumeBannerDismiss}
          data-action="dismiss-resume"
          aria-label="再開バナーを閉じる"
          onClick={onDismiss}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
