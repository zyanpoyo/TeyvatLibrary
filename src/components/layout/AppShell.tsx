import { useEffect, useState } from "react";
import { Link, Outlet, useMatch } from "react-router";
import styles from "./AppShell.module.css";
import { PrivacyDialog } from "./PrivacyDialog";

export function AppShell() {
  const isReaderRoute = Boolean(useMatch("/story/:storyId"));
  const isAboutRoute = Boolean(useMatch("/about"));
  const coursesIndexMatch = useMatch("/courses");
  const courseDetailMatch = useMatch("/courses/:courseId");
  const isCoursesRoute = Boolean(coursesIndexMatch || courseDetailMatch);
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);

  useEffect(() => {
    document.body.dataset.view = isReaderRoute
      ? "reader"
      : isAboutRoute
        ? "about"
        : isCoursesRoute
          ? "courses"
          : "shelf";
  }, [isReaderRoute, isAboutRoute, isCoursesRoute]);

  return (
    <>
      <div className={styles.celestialBackdrop} aria-hidden="true">
        <svg
          className={styles.celestialMeridians}
          viewBox="0 0 1440 900"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            <radialGradient id="starGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fff9eb" stopOpacity="0.95" />
              <stop offset="45%" stopColor="#d8b878" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#d8b878" stopOpacity="0" />
            </radialGradient>
          </defs>

          <g stroke="rgba(216, 184, 120, 0.14)" strokeWidth="1" fill="none">
            <circle cx="720" cy="140" r="260" />
            <circle cx="720" cy="140" r="390" strokeDasharray="4 6" />
            <circle cx="720" cy="140" r="540" stroke="rgba(142, 166, 200, 0.11)" />
            <path d="M120,210 L215,148 L305,196 L390,115" />
            <path d="M1050,120 L1145,195 L1235,132 L1335,205" />
          </g>

          <g className={styles.starTwinkle}>
            <circle cx="120" cy="210" r="5" fill="url(#starGlow)" />
            <circle cx="215" cy="148" r="1.6" fill="#f4e4bf" />
            <circle cx="305" cy="196" r="1.8" fill="#d8b878" />
            <circle cx="390" cy="115" r="5" fill="url(#starGlow)" />
            <circle cx="1050" cy="120" r="4.5" fill="url(#starGlow)" />
            <circle cx="1235" cy="132" r="5" fill="url(#starGlow)" />
          </g>
          <g className={styles.starTwinkleDelayed}>
            <circle cx="1145" cy="195" r="1.7" fill="#f4e4bf" />
            <circle cx="1335" cy="205" r="1.5" fill="#d8b878" />
            <circle cx="520" cy="460" r="1.3" fill="rgba(236, 231, 220, 0.55)" />
            <circle cx="940" cy="520" r="1.3" fill="rgba(236, 231, 220, 0.55)" />
          </g>
        </svg>
      </div>

      <main className={styles.mainContainer}>
        <Outlet />
      </main>

      <footer className={styles.siteFooter}>
        <p>テイワット文庫 — 非公式ファンアーカイブ（原文テキストはゲーム内収録資料に基づき無改変で掲載しています）</p>
        <p>本サイトは HoYoverse の公式サービスではありません。ゲーム内テキストの著作権は COGNOSPHERE PTE. LTD. に帰属します。</p>
        <div className={styles.footerActions}>
          <Link
            to="/courses"
            id="courses-page-link"
            className={styles.footerLinkBtn}
            aria-current={isCoursesRoute ? "page" : undefined}
          >
            読書コース
          </Link>
          <Link
            to="/about"
            id="about-page-link"
            className={styles.footerLinkBtn}
            aria-current={isAboutRoute ? "page" : undefined}
          >
            このサイトについて
          </Link>
          <button
            type="button"
            id="privacy-dialog-trigger"
            className={styles.footerLinkBtn}
            data-action="open-privacy-dialog"
            onClick={() => setIsPrivacyOpen(true)}
          >
            アクセス解析について
          </button>
        </div>
      </footer>

      <PrivacyDialog open={isPrivacyOpen} onOpenChange={setIsPrivacyOpen} />
    </>
  );
}
