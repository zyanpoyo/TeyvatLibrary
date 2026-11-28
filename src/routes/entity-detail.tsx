import { Link, useParams } from "react-router";
import type { Route } from "./+types/entity-detail";
import { fetchStoriesIndex } from "../api/stories";
import { EntityDetailPage } from "../components/entities/EntityDetailPage";
import { buildEntityDetailMeta } from "../domain/seo";
import { loadDistEntityDetail } from "../server/dist-data.server.mjs";
import commonStyles from "../styles/common.module.css";

export function loader({ params }: Route.LoaderArgs) {
  const result = loadDistEntityDetail(params.entityId);
  return {
    entityId: result?.entityId ?? params.entityId ?? "",
    entity: result?.entity ?? null,
    indexData: result?.indexData ?? null,
    notFound: !result,
  };
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const entityId = params.entityId ?? "";
  if (!entityId) {
    return {
      entityId: "",
      entity: null,
      indexData: null,
      notFound: true,
    };
  }

  try {
    const indexData = await fetchStoriesIndex();
    const entitiesIndex = indexData.entitiesIndex;
    const entity =
      entitiesIndex && Object.hasOwn(entitiesIndex, entityId) ? entitiesIndex[entityId] : null;
    return {
      entityId,
      entity,
      indexData,
      notFound: !entity,
    };
  } catch {
    return {
      entityId,
      entity: null,
      indexData: null,
      notFound: false,
    };
  }
}

export function meta({ loaderData }: Route.MetaArgs) {
  return buildEntityDetailMeta({
    entityId: loaderData?.entityId ?? "",
    entity: loaderData?.entity ?? null,
    indexData: loaderData?.indexData ?? null,
  });
}

export default function EntityDetailRoute({ loaderData }: Route.ComponentProps) {
  const { entityId = "" } = useParams<{ entityId: string }>();

  if (loaderData.notFound) {
    return (
      <section className={commonStyles.emptyState}>
        <h1 className={commonStyles.emptyTitle}>人物・用語が見つかりません</h1>
        <p className={commonStyles.emptyDesc}>
          指定された人物・用語は見つかりませんでした。URL を確認するか、名鑑一覧からお探しください。
        </p>
        <Link to="/entities" className={commonStyles.controlPill}>
          ← 人物・用語名鑑へ戻る
        </Link>
      </section>
    );
  }

  return (
    <EntityDetailPage
      entityId={entityId}
      initialEntity={loaderData.entity}
      initialIndexData={loaderData.indexData}
    />
  );
}
