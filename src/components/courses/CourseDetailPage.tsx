import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, type MouseEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { analytics, type StoryShareMethod } from "../../analytics/ga4";
import { deriveCourseDetailView } from "../../domain/courses";
import { buildCourseDocumentTitle } from "../../domain/seo";
import { buildCourseShareUrl, buildCourseXShareIntentUrl } from "../../domain/share";
import { formatRegion } from "../../domain/text-parser";
import { buildReaderStoryPath } from "../../router/search-params";
import {
  BASE_DOCUMENT_TITLE,
  useReadingStateStore,
  useShelfContext,
} from "../../state/AppProviders";
import commonStyles from "../../styles/common.module.css";
import type { CourseIndexItem, StoriesIndexData, StoryCategoryId } from "../../types/story";
import { AppIcon } from "../common/AppIcon";
import { ShareBar } from "../common/ShareBar";
import { SiteNavBar } from "../layout/SiteNavBar";
import { ThemeSwitcher } from "../layout/ThemeSwitcher";
import { CourseCard } from "./CourseCard";
import styles from "./CourseDetailPage.module.css";

export interface CourseDetailPageProps {
  courseId: string;
  initialCourse?: CourseIndexItem | null;
  initialIndexData?: StoriesIndexData | null;
}

function isModifiedClick(event: MouseEvent): boolean {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
}

/**
 * 読書コース詳細ページ（/courses/:courseId）。
 * 推奨順の収録ステップ、ネタバレなし1行ガイド、進捗に応じた「続きから読む」CTA、シェア導線を提供する。
 */
export function CourseDetailPage({
  courseId,
  initialCourse = null,
  initialIndexData = null,
}: CourseDetailPageProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const lastTrackedKeyRef = useRef<string | null>(null);

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

  const course = useMemo(() => {
    const fromIndex = (effectiveIndexData?.courses ?? []).find((c) => c.id === courseId);
    if (fromIndex) return fromIndex;
    if (initialCourse && initialCourse.id === courseId) return initialCourse;
    return null;
  }, [effectiveIndexData, initialCourse, courseId]);

  const view = useMemo(
    () => (course ? deriveCourseDetailView(course, effectiveIndexData, readingSnapshot) : null),
    [course, effectiveIndexData, readingSnapshot]
  );

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [location.key, courseId]);

  useEffect(() => {
    if (!course) return;
    document.title = buildCourseDocumentTitle(course);
    return () => {
      document.title = BASE_DOCUMENT_TITLE;
    };
  }, [course]);

  useEffect(() => {
    if (!course || course.id !== courseId) return;
    const trackKey = `${location.key}:${course.id}`;
    if (lastTrackedKeyRef.current === trackKey) return;
    lastTrackedKeyRef.current = trackKey;
    analytics.trackPageView({
      pagePath: `/courses/${course.id}`,
      pageTitle: buildCourseDocumentTitle(course),
      courseId: course.id,
    });
  }, [course, courseId, location.key]);

  const handleOpenCourseStory = useCallback(
    (storyId: string, storyCategory?: StoryCategoryId) => {
      analytics.trackStoryOpen({
        storyId,
        storyCategory,
        source: "course_detail",
      });
    },
    []
  );

  const handleShareCourse = useCallback(
    (method: StoryShareMethod) => {
      if (!course) return;
      analytics.trackCourseShare({
        courseId: course.id,
        courseKind: course.kind,
        method,
      });
    },
    [course]
  );

  const shareUrl = useMemo(() => (course ? buildCourseShareUrl(course.id) : ""), [course]);
  const xIntentUrl = useMemo(() => (course ? buildCourseXShareIntentUrl(course) : ""), [course]);

  return (
    <section id="course-detail-view" className={styles.courseDetailView} tabIndex={-1}>
      <div className={styles.topControlBar}>
        <SiteNavBar id="course-detail-site-nav" />
        <ThemeSwitcher id="course-detail-theme-switcher" />
      </div>

      <nav className={styles.breadcrumbRow} aria-label="ページ遷移">
        <Link to="/courses" id="course-back-to-list-link" className={styles.backLink}>
          ← 読書コース一覧へ
        </Link>
      </nav>

      {effectiveIsLoadingIndex && !course ? (
        <p className={commonStyles.loadingStatus}>✦ 読書コースを読み込んでいます…</p>
      ) : indexError && !course ? (
        <div className={commonStyles.emptyState}>
          <h1 className={commonStyles.emptyTitle}>データの読み込みに失敗しました</h1>
          <p className={commonStyles.emptyDesc}>{indexError}</p>
          <Link to="/courses" className={commonStyles.controlPill}>
            ← 読書コース一覧へ戻る
          </Link>
        </div>
      ) : !view || !course ? (
        <div className={commonStyles.emptyState}>
          <h1 className={commonStyles.emptyTitle}>読書コースが見つかりません</h1>
          <p className={commonStyles.emptyDesc}>
            指定された読書コースは見つかりませんでした。URL を確認するか、一覧からお探しください。
          </p>
          <Link to="/courses" className={commonStyles.controlPill}>
            ← 読書コース一覧へ戻る
          </Link>
        </div>
      ) : (
        <>
          <header className={styles.courseHeaderCard} id="course-detail-header">
            <div className={styles.courseKicker}>
              <span className={commonStyles.categoryBadge}>{course.badge}</span>
              <span className={styles.courseMetaItem}>
                <AppIcon name="hourglass" />
                <span>
                  全{course.storyCount}篇 ・ {course.totalReadingTime}（約
                  {course.totalCharCount.toLocaleString()}字）
                </span>
              </span>
            </div>

            <h1 className={`${styles.courseTitle} course-detail-title`}>{course.title}</h1>
            <p className={styles.courseSubtitle}>{course.subtitle}</p>
            <p className={styles.courseHook}>{course.hook}</p>

            <div className={styles.progressAndCta}>
              <div className={styles.progressBlock}>
                <div className={styles.progressHeader}>
                  <span className={styles.progressLabel} id="course-detail-progress">
                    {view.progress.readCount} / {view.progress.totalCount} 篇 読了
                  </span>
                  {view.progress.isCompleted ? (
                    <span className={styles.completedBadge}>✦ コース読破済み</span>
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
                  id="course-primary-cta"
                  className={styles.primaryCtaLink}
                  to={buildReaderStoryPath(view.progress.nextUnreadStoryId, {
                    courseId: course.id,
                  })}
                  onClick={() => {
                    const targetStep = view.steps[view.progress.nextUnreadStepIndex];
                    if (targetStep) {
                      handleOpenCourseStory(
                        targetStep.storyId,
                        targetStep.story?.shelfCategory
                      );
                    }
                  }}
                >
                  <AppIcon name="open-book" />
                  <span>{view.progress.ctaLabel}</span>
                </Link>
              ) : null}
            </div>
          </header>

          <section className={styles.stepsSection} aria-labelledby="course-steps-heading">
            <h2 id="course-steps-heading" className={styles.sectionHeading}>
              <AppIcon name="books" />
              <span>推奨順の収録ラインナップ</span>
            </h2>

            <ol id="course-steps-list" className={styles.stepsList}>
              {view.steps.map((step) => {
                const targetPath = buildReaderStoryPath(step.storyId, {
                  courseId: course.id,
                });
                const storyTitle = step.story?.title || step.storyId;
                const regionText = step.story ? formatRegion(step.story.region) : "";

                return (
                  <li
                    key={step.storyId}
                    className={`${styles.stepCard} course-step-card`}
                    data-story-id={step.storyId}
                    data-step-number={step.stepNumber}
                    data-read={String(step.isRead)}
                    data-next-unread={String(step.isNextUnread)}
                    onClick={(event) => {
                      const target = event.target as HTMLElement;
                      if (target.closest("a") || target.closest("button")) return;
                      if (isModifiedClick(event)) return;
                      handleOpenCourseStory(step.storyId, step.story?.shelfCategory);
                      navigate(targetPath);
                    }}
                  >
                    <div className={styles.stepTopRow}>
                      <div className={styles.stepMetaLeft}>
                        <span className={styles.stepNumberBadge}>第{step.stepNumber}話</span>
                        {step.story ? (
                          <>
                            <span className={commonStyles.categoryBadge}>
                              {step.story.categoryLabel}
                            </span>
                            <span>
                              {step.story.readingTime}
                              {regionText ? ` ・ ${regionText}` : ""}
                            </span>
                          </>
                        ) : null}
                      </div>

                      <div className={styles.stepStatusGroup}>
                        {step.isNextUnread ? (
                          <span className={styles.stepNextBadge}>次に読む</span>
                        ) : null}
                        {step.isRead ? (
                          <span className={styles.stepReadBadge}>✦ 読了</span>
                        ) : null}
                      </div>
                    </div>

                    <h3 className={styles.stepTitle}>
                      <Link
                        to={targetPath}
                        className={`${styles.stepTitleLink} course-step-link`}
                        onClick={() =>
                          handleOpenCourseStory(step.storyId, step.story?.shelfCategory)
                        }
                      >
                        {storyTitle}
                      </Link>
                    </h3>

                    <p className={styles.stepNote}>{step.note}</p>
                  </li>
                );
              })}
            </ol>
          </section>

          <div className={styles.shareSection}>
            <ShareBar
              id="course-share-bar"
              ariaLabel="読書コースを共有"
              shareUrl={shareUrl}
              xIntentUrl={xIntentUrl}
              xActionName="share-course-x"
              copyActionName="copy-course-url"
              resetKey={course.id}
              onShare={handleShareCourse}
            />
          </div>

          {view.relatedCourses.length > 0 ? (
            <section className={styles.relatedSection} aria-labelledby="related-courses-heading">
              <div className={styles.relatedHeader}>
                <h2 id="related-courses-heading" className={styles.sectionHeading}>
                  <AppIcon name="books" />
                  <span>他の読書コース</span>
                </h2>
                <Link to="/courses" className={styles.backLink}>
                  すべて見る →
                </Link>
              </div>

              <div className={styles.relatedGrid}>
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
        </>
      )}
    </section>
  );
}
