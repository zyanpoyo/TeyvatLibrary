import { Link } from "react-router";
import type { ReadingStateInput } from "../../domain/catalog";
import { deriveCourseProgress } from "../../domain/courses";
import type { CourseIndexItem } from "../../types/story";
import { AppIcon } from "../common/AppIcon";
import { CourseCard } from "../courses/CourseCard";
import styles from "./FairShelf.module.css";

export interface FairShelfProps {
  courses: ReadonlyArray<CourseIndexItem>;
  totalCourseCount: number;
  readingState: ReadingStateInput;
  visible: boolean;
}

/**
 * 書架トップの特設フェア棚セクション（代表 3 コース展示＋一覧ページへの導線）。
 */
export function FairShelf({
  courses,
  totalCourseCount,
  readingState,
  visible,
}: FairShelfProps) {
  if (!visible || courses.length === 0) {
    return null;
  }

  return (
    <section
      id="fair-shelf"
      className={styles.fairShelfSection}
      aria-labelledby="fair-shelf-heading"
    >
      <div className={styles.fairShelfHeader}>
        <h2 id="fair-shelf-heading" className={styles.fairShelfTitle}>
          <AppIcon name="books" />
          <span>特設フェア棚・読書コース</span>
        </h2>

        <Link
          to="/courses"
          id="fair-shelf-all-link"
          className={styles.fairShelfAllLink}
        >
          すべてのコースを見る（全{totalCourseCount}コース）→
        </Link>
      </div>

      <div className={styles.fairShelfGrid}>
        {courses.map((course) => (
          <CourseCard
            key={course.id}
            course={course}
            progress={deriveCourseProgress(course, readingState)}
            headingLevel={3}
          />
        ))}
      </div>
    </section>
  );
}
