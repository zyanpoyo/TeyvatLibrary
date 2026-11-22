import { Link } from "react-router";
import type { StoryOpenSource } from "../../analytics/ga4";
import type { ReaderCourseContext, ResolvedReaderCourse } from "../../domain/courses";
import { buildReaderStoryPath } from "../../router/search-params";
import { AppIcon } from "../common/AppIcon";
import styles from "./ReaderCourseNav.module.css";

export interface ReaderCourseBannerProps {
  activeCourse: ResolvedReaderCourse | null;
}

/**
 * コース経由（?course=）閲覧時にリーダー上部へ表示するコンパクトなコース文脈バー。
 */
export function ReaderCourseBanner({ activeCourse }: ReaderCourseBannerProps) {
  if (!activeCourse) return null;

  return (
    <div id="reader-course-banner" className={styles.courseBanner} aria-label="読書コース進行状況">
      <span className={styles.courseBannerLead}>
        <AppIcon name="books" />
        <span>読書コース：</span>
        <Link
          to={`/courses/${encodeURIComponent(activeCourse.courseId)}`}
          className={styles.courseBannerLink}
        >
          {activeCourse.title}
        </Link>
      </span>
      <span className={styles.courseBannerStep}>
        第{activeCourse.stepIndex + 1}話 / 全{activeCourse.totalSteps}話
      </span>
    </div>
  );
}

export interface ReaderCourseFooterProps {
  courseContext?: ReaderCourseContext | null;
  onSelectCourseStory?: (targetId: string, source: StoryOpenSource) => void;
}

/**
 * リーダー章末に配置する読書コース進行・所属コース案内セクション。
 */
export function ReaderCourseFooter({
  courseContext,
  onSelectCourseStory,
}: ReaderCourseFooterProps) {
  if (!courseContext) return null;
  const { activeCourse, otherCourses, memberships } = courseContext;

  if (activeCourse) {
    const courseUrl = `/courses/${encodeURIComponent(activeCourse.courseId)}`;
    const nextStep = activeCourse.nextStep;
    const prevStep = activeCourse.prevStep;

    return (
      <aside
        id="course-nav-container"
        className={styles.courseFooterBox}
        data-course-id={activeCourse.courseId}
        aria-label="読書コース進行ナビゲーション"
      >
        <div className={styles.courseFooterHeader}>
          <h2 className={styles.courseFooterHeading}>
            <AppIcon name="books" />
            <Link to={courseUrl} className={styles.courseHeadingLink}>
              読書コース『{activeCourse.title}』
            </Link>
          </h2>
          <span className={styles.courseStepCounter}>
            第{activeCourse.stepIndex + 1}話 / 全{activeCourse.totalSteps}話（
            {activeCourse.readCount} / {activeCourse.totalSteps} 読了）
          </span>
        </div>

        {nextStep ? (
          <Link
            to={buildReaderStoryPath(nextStep.storyId, { courseId: activeCourse.courseId })}
            className={styles.coursePrimaryCard}
            data-action="course-next-story"
            data-target-id={nextStep.storyId}
            onClick={() => onSelectCourseStory?.(nextStep.storyId, "course_next")}
          >
            <div>
              <div className={styles.coursePrimaryLabel}>
                次の第{activeCourse.stepIndex + 2}話へ進む
              </div>
              <div className={styles.coursePrimaryTitle}>『{nextStep.title}』</div>
            </div>
            <span className={styles.coursePrimaryArrow} aria-hidden="true">
              →
            </span>
          </Link>
        ) : activeCourse.isAllRead ? (
          <div className={styles.courseCompletionNotice} data-course-completed="true">
            <p className={styles.courseCompletionText}>
              ✦ 読書コース『{activeCourse.title}』を全話読破しました
            </p>
            <div className={styles.courseCompletionActions}>
              <Link to="/courses" className={styles.courseSecondaryPill}>
                他の読書コースを見る →
              </Link>
              <Link to={courseUrl} className={styles.courseSecondaryPill}>
                コース詳細へ戻る
              </Link>
            </div>
          </div>
        ) : activeCourse.firstUnreadOtherStep ? (
          <Link
            to={buildReaderStoryPath(activeCourse.firstUnreadOtherStep.storyId, {
              courseId: activeCourse.courseId,
            })}
            className={styles.coursePrimaryCard}
            data-action="course-next-unread-story"
            data-target-id={activeCourse.firstUnreadOtherStep.storyId}
            onClick={() =>
              onSelectCourseStory?.(activeCourse.firstUnreadOtherStep!.storyId, "course_next")
            }
          >
            <div>
              <div className={styles.coursePrimaryLabel}>
                未読の第{activeCourse.firstUnreadOtherStep.stepIndex + 1}話へ進む
              </div>
              <div className={styles.coursePrimaryTitle}>
                『{activeCourse.firstUnreadOtherStep.title}』
              </div>
            </div>
            <span className={styles.coursePrimaryArrow} aria-hidden="true">
              →
            </span>
          </Link>
        ) : (
          <div className={styles.courseCompletionNotice}>
            <p className={styles.courseCompletionText}>
              この作品を読了するとコース全{activeCourse.totalSteps}篇を読破できます
            </p>
            <div className={styles.courseCompletionActions}>
              <Link to={courseUrl} className={styles.courseSecondaryPill}>
                コース詳細を見る
              </Link>
              <Link to="/courses" className={styles.courseSecondaryPill}>
                他の読書コースを見る →
              </Link>
            </div>
          </div>
        )}

        <div className={styles.coursePrevRow}>
          {prevStep ? (
            <Link
              to={buildReaderStoryPath(prevStep.storyId, { courseId: activeCourse.courseId })}
              className={styles.coursePrevLink}
              data-action="course-prev-story"
              data-target-id={prevStep.storyId}
              onClick={() => onSelectCourseStory?.(prevStep.storyId, "course_prev")}
            >
              ← 前の第{activeCourse.stepIndex}話『{prevStep.title}』
            </Link>
          ) : (
            <span />
          )}
          <Link to={courseUrl} className={styles.coursePrevLink}>
            コース目次を開く
          </Link>
        </div>

        {otherCourses.length > 0 ? (
          <div className={styles.otherCoursesBlock}>
            <span className={styles.otherCoursesLabel}>他の収録コース：</span>
            {otherCourses.map((c) => (
              <Link
                key={c.courseId}
                to={`/courses/${encodeURIComponent(c.courseId)}`}
                className={styles.otherCourseChip}
              >
                {c.title}（第{c.stepIndex + 1}話 / 全{c.totalSteps}話）
              </Link>
            ))}
          </div>
        ) : null}
      </aside>
    );
  }

  if (memberships.length === 0) {
    return null;
  }

  return (
    <aside
      id="course-nav-container"
      className={styles.courseFooterBox}
      aria-label="収録されている読書コース"
    >
      <div className={styles.courseFooterHeader}>
        <h2 className={styles.courseFooterHeading}>
          <AppIcon name="books" />
          <span>この物語が収録されている読書コース</span>
        </h2>
      </div>

      <div className={styles.membershipList}>
        {memberships.map((m) => (
          <div key={m.courseId} className={styles.membershipCard} data-course-id={m.courseId}>
            <div className={styles.membershipInfo}>
              <div className={styles.membershipTitleRow}>
                <Link
                  to={`/courses/${encodeURIComponent(m.courseId)}`}
                  className={styles.membershipTitleLink}
                >
                  {m.title}
                </Link>
              </div>
              <span className={styles.membershipStepMeta}>
                第{m.stepIndex + 1}話 / 全{m.totalSteps}話 ・ 進捗 {m.readCount} / {m.totalSteps} 篇 読了
              </span>
            </div>

            {m.nextStep ? (
              <Link
                to={buildReaderStoryPath(m.nextStep.storyId, { courseId: m.courseId })}
                className={styles.courseSecondaryPill}
                data-action="story-course-next"
                data-target-id={m.nextStep.storyId}
                onClick={() => onSelectCourseStory?.(m.nextStep!.storyId, "story_course_card")}
              >
                次の第{m.stepIndex + 2}話へ →
              </Link>
            ) : (
              <Link
                to={`/courses/${encodeURIComponent(m.courseId)}`}
                className={styles.courseSecondaryPill}
              >
                コース詳細を見る →
              </Link>
            )}
          </div>
        ))}
      </div>
    </aside>
  );
}
