import { Link } from "react-router";
import { buildNotFoundMeta } from "../domain/seo";
import commonStyles from "../styles/common.module.css";

export function meta() {
  return buildNotFoundMeta("page");
}

export default function NotFoundRoute() {
  return (
    <section className={commonStyles.emptyState}>
      <h1 className={commonStyles.emptyTitle}>ページが見つかりません</h1>
      <p className={commonStyles.emptyDesc}>
        お探しのページは移動または削除された可能性があります。
      </p>
      <Link to="/" className={commonStyles.controlPill}>
        ← 書架へ戻る
      </Link>
    </section>
  );
}
