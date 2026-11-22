import { Link } from "react-router";
import type { Route } from "./+types/story";
import { ReaderPage } from "../components/reader/ReaderPage";
import { loadDistStoryDetail } from "../server/dist-data.server.mjs";
import commonStyles from "../styles/common.module.css";

export function loader({ params }: Route.LoaderArgs) {
  return {
    story: loadDistStoryDetail(params.storyId),
  };
}

export function meta({ loaderData }: Route.MetaArgs) {
  return [
    {
      title: loaderData?.story
        ? `${loaderData.story.title} | テイワット文庫`
        : "作品が見つかりません | テイワット文庫",
    },
  ];
}

export default function StoryRoute({ loaderData }: Route.ComponentProps) {
  if (!loaderData.story) {
    return (
      <section className={commonStyles.emptyState}>
        <h1 className={commonStyles.emptyTitle}>作品が見つかりません</h1>
        <p className={commonStyles.emptyDesc}>
          指定された物語は見つかりませんでした。URL を確認するか、書架から別の物語をお探しください。
        </p>
        <Link to="/" className={commonStyles.controlPill}>
          ← 書架へ戻る
        </Link>
      </section>
    );
  }

  return <ReaderPage initialStory={loaderData.story} />;
}
