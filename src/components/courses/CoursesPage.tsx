import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router";
import { analytics } from "../../analytics/ga4";
import {
  COURSE_KIND_LABELS,
  COURSE_KIND_ORDER,
  groupCoursesByKind,
} from "../../domain/courses";
import { COURSES_DOCUMENT_TITLE } from "../../domain/seo";
import {
  BASE_DOCUMENT_TITLE,
  useReadingStateStore,
  useShelfContext,
} from "../../state/AppProviders";
import commonStyles from "../../styles/common.module.css";
import type { CourseKind, StoriesIndexData } from "../../types/story";
import { SiteNavBar } from "../layout/SiteNavBar";
import { ThemeSwitcher } from "../layout/ThemeSwitcher";
import { CourseCard } from "./CourseCard";
import styles from "./CoursesPage.module.css";

export interface CoursesPageProps {
  initialIndexData?: StoriesIndexData | null;
}

/**
 * 目的別・キャラ別・地域・歴史別の全読書コースを一覧表示するページ（/courses）。
 */
export function CoursesPage({ initialIndexData = null }: CoursesPageProps = {}) {
  const location = useLocation();
  const lastTrackedKeyRef = useRef<string | null>(null);
  const [kindFilter, setKindFilter] = useState<"all" | CourseKind>("all");

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
    document.title = COURSES_DOCUMENT_TITLE;
    return () => {
      document.title = BASE_DOCUMENT_TITLE;
    };
  }, []);

  useEffect(() => {
    if (lastTrackedKeyRef.current === location.key) return;
    lastTrackedKeyRef.current = location.key;
    analytics.trackPageView({
      pagePath: "/courses",
      pageTitle: COURSES_DOCUMENT_TITLE,
    });
  }, [location.key]);

  const courses = effectiveIndexData?.courses ?? [];

  const kindCounts = useMemo(() => {
    const counts: Record<"all" | CourseKind, number> = {
      all: courses.length,
      beginner: 0,
      character: 0,
      arc: 0,
    };
    for (const c of courses) {
      counts[c.kind] += 1;
    }
    return counts;
  }, [courses]);

  const groups = useMemo(
    () => groupCoursesByKind(courses, readingSnapshot, kindFilter),
    [courses, readingSnapshot, kindFilter]
  );

  return (
    <section id="courses-view" className={styles.coursesView} tabIndex={-1}>
      <header className={styles.coursesHero}>
        <svg
          className={styles.coursesChartBg}
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
          <SiteNavBar id="courses-site-nav" />
          <ThemeSwitcher id="courses-theme-switcher" />
        </div>

        <div className={styles.coursesHeroInner}>
          <p className={styles.coursesEyebrow}>✦ Reading Courses ✦</p>
          <h1 className={styles.coursesTitle}>読書コース一覧</h1>
          <p className={styles.coursesLead}>
            入門向け・キャラクター別・地域や歴史別の切り口で、推奨順に物語を辿れるキュレーションコースです。
          </p>
        </div>

        <div
          className={styles.kindFilterRow}
          role="group"
          aria-label="コース種別で絞り込む"
        >
          <button
            type="button"
            className={styles.kindFilterPill}
            data-course-filter="all"
            aria-pressed={kindFilter === "all"}
            onClick={() => setKindFilter("all")}
          >
            <span>すべて</span>
            <span className={styles.kindCount}>{kindCounts.all}</span>
          </button>
          {COURSE_KIND_ORDER.map((kind) => (
            <button
              key={kind}
              type="button"
              className={styles.kindFilterPill}
              data-course-filter={kind}
              aria-pressed={kindFilter === kind}
              onClick={() => setKindFilter(kind)}
            >
              <span>{COURSE_KIND_LABELS[kind].label}</span>
              <span className={styles.kindCount}>{kindCounts[kind]}</span>
            </button>
          ))}
        </div>
      </header>

      {effectiveIsLoadingIndex ? (
        <p className={commonStyles.loadingStatus}>✦ 読書コースを読み込んでいます…</p>
      ) : indexError ? (
        <div className={commonStyles.emptyState}>
          <p className={commonStyles.emptyTitle}>データの読み込みに失敗しました</p>
          <p className={commonStyles.emptyDesc}>{indexError}</p>
        </div>
      ) : groups.length === 0 ? (
        <div className={commonStyles.emptyState}>
          <p className={commonStyles.emptyTitle}>表示できる読書コースがありません</p>
          <p className={commonStyles.emptyDesc}>
            絞り込み条件を変更して再度お試しください。
          </p>
        </div>
      ) : (
        <div className={styles.courseGroups}>
          {groups.map((group) => (
            <section
              key={group.kind}
              className={styles.courseGroup}
              data-course-group={group.kind}
              aria-labelledby={`course-group-${group.kind}`}
            >
              <div className={styles.courseGroupHeader}>
                <h2 id={`course-group-${group.kind}`} className={styles.courseGroupHeading}>
                  ✦ {group.heading}
                </h2>
                <span className={styles.courseGroupCount}>{group.items.length} コース</span>
              </div>

              <div className={styles.courseGrid}>
                {group.items.map(({ course, progress }) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    progress={progress}
                    headingLevel={3}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
