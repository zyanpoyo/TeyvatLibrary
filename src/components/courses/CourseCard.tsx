import type { MouseEvent } from "react";
import { Link, useNavigate } from "react-router";
import type { CourseProgress } from "../../domain/courses";
import type { CourseIndexItem } from "../../types/story";
import { AppIcon } from "../common/AppIcon";
import styles from "./CourseCard.module.css";

export interface CourseCardProps {
  course: CourseIndexItem;
  progress: CourseProgress;
  headingLevel?: 2 | 3;
}

function isModifiedClick(event: MouseEvent): boolean {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
}

/**
 * 書架フェア棚およびコース一覧ページで共有する読書コースカード。
 */
export function CourseCard({ course, progress, headingLevel = 3 }: CourseCardProps) {
  const navigate = useNavigate();
  const coursePath = `/courses/${encodeURIComponent(course.id)}`;
  const HeadingTag = headingLevel === 2 ? "h2" : "h3";

  const handleCardClick = (event: MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("a") || target.closest("button")) {
      return;
    }
    if (isModifiedClick(event)) return;
    navigate(coursePath);
  };

  return (
    <article
      className={`${styles.courseCard} course-card`}
      data-course-id={course.id}
      data-course-kind={course.kind}
      data-completed={String(progress.isCompleted)}
      onClick={handleCardClick}
    >
      <div>
        <div className={styles.courseTopRow}>
          <span className={styles.courseBadge}>{course.badge}</span>
          {progress.isCompleted ? (
            <span className={`${styles.courseCompletedBadge} course-completed-badge`}>
              ✦ 読破
            </span>
          ) : null}
        </div>

        <HeadingTag className={styles.courseTitle}>
          <Link to={coursePath} className={`${styles.coursePrimaryLink} course-primary-link`}>
            {course.title}
          </Link>
        </HeadingTag>
        <p className={styles.courseSubtitle}>{course.subtitle}</p>
        <p className={styles.courseHook}>{course.hook}</p>
      </div>

      <div className={styles.courseFooter}>
        <div className={styles.courseMetaLine}>
          <span className={styles.courseMetaCount}>
            <AppIcon name="hourglass" />
            <span>
              全{course.storyCount}篇 ・ {course.totalReadingTime}
            </span>
          </span>
          <span className={`${styles.courseProgressText} course-progress-text`}>
            {progress.readCount} / {progress.totalCount} 篇 読了
          </span>
        </div>

        <div
          className={styles.progressTrack}
          role="progressbar"
          aria-valuenow={progress.readCount}
          aria-valuemin={0}
          aria-valuemax={progress.totalCount}
          aria-label={`『${course.title}』の読了進捗: ${progress.readCount} / ${progress.totalCount} 篇`}
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
