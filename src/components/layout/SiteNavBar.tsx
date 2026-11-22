import { Link, useMatch } from "react-router";
import { AppIcon } from "../common/AppIcon";
import styles from "./SiteNavBar.module.css";

export interface SiteNavBarProps {
  id?: string;
  className?: string;
}

/**
 * 書架と読書コース（および将来の名鑑ビュー）を横断移動できる常設ナビゲーション。
 */
export function SiteNavBar({ id = "site-nav-bar", className }: SiteNavBarProps) {
  const isShelf = Boolean(useMatch("/"));
  const coursesIndexMatch = useMatch("/courses");
  const courseDetailMatch = useMatch("/courses/:courseId");
  const isCourses = Boolean(coursesIndexMatch || courseDetailMatch);
  const rootClass = className ? `${styles.siteNavBar} ${className}` : styles.siteNavBar;

  return (
    <nav id={id} className={rootClass} aria-label="メインナビゲーション">
      <Link
        to="/"
        className={styles.navLink}
        data-nav-target="shelf"
        aria-current={isShelf ? "page" : undefined}
      >
        <AppIcon name="open-book" active={isShelf} />
        <span>書架</span>
      </Link>
      <Link
        to="/courses"
        className={styles.navLink}
        data-nav-target="courses"
        aria-current={isCourses ? "page" : undefined}
      >
        <AppIcon name="books" active={isCourses} />
        <span>読書コース</span>
      </Link>
    </nav>
  );
}
