import { Link } from "react-router";
import type { Route } from "./+types/story";
import { fetchStoryDetail, StoryFetchError } from "../api/stories";
import { ReaderPage } from "../components/reader/ReaderPage";
import { buildCanonicalMetaTag } from "../config/site-url";
import { loadDistStoryDetail } from "../server/dist-data.server.mjs";
import commonStyles from "../styles/common.module.css";

export function loader({ params }: Route.LoaderArgs) {
  const story = loadDistStoryDetail(params.storyId);
  return {
    story,
    notFound: !story,
    loadError: null as string | null,
  };
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const storyId = params.storyId ?? "";
  if (!storyId) {
    return {
      story: null,
      notFound: true,
      loadError: null as string | null,
    };
  }

  try {
    const story = await fetchStoryDetail(storyId);
    return {
      story,
      notFound: false,
      loadError: null as string | null,
    };
  } catch (err: unknown) {
    if (err instanceof StoryFetchError && err.status === 404) {
      return {
        story: null,
        notFound: true,
        loadError: null as string | null,
      };
    }
    return {
      story: null,
      notFound: false,
      loadError: err instanceof Error ? err.message : String(err),
    };
  }
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData?.story) {
    return [{ title: "作品が見つかりません | テイワット文庫" }];
  }
  return [
    { title: `${loaderData.story.title} | テイワット文庫` },
    ...buildCanonicalMetaTag(`/story/${encodeURIComponent(loaderData.story.id)}`),
  ];
}

export default function StoryRoute({ loaderData }: Route.ComponentProps) {
  if (loaderData.notFound) {
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

  return (
    <ReaderPage
      initialStory={loaderData.story}
      initialError={loaderData.loadError}
    />
  );
}
