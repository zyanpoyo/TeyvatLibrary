import { Link } from "react-router";
import { useCurrentAppView } from "../../router/route-view";
import { AppIcon } from "../common/AppIcon";
import styles from "./SiteNavBar.module.css";

export interface SiteNavBarProps {
  id?: string;
  className?: string;
}

/**
 * 書架と読書コース・人物・用語名鑑を横断移動できる常設ナビゲーション。
 */
export function SiteNavBar({ id = "site-nav-bar", className }: SiteNavBarProps) {
  const currentView = useCurrentAppView();
  const isShelf = currentView === "shelf";
  const isCourses = currentView === "courses";
  const isEntities = currentView === "entities";
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
      <Link
        to="/entities"
        className={styles.navLink}
        data-nav-target="entities"
        aria-current={isEntities ? "page" : undefined}
      >
        <AppIcon name="archive" active={isEntities} />
        <span>人物・用語名鑑</span>
      </Link>
    </nav>
  );
}
