import type { Route } from "./+types/entities";
import { fetchStoriesIndex } from "../api/stories";
import { EntitiesPage } from "../components/entities/EntitiesPage";
import { buildEntitiesMeta } from "../domain/seo";
import { loadDistStoriesIndex } from "../server/dist-data.server.mjs";

export function loader() {
  return {
    indexData: loadDistStoriesIndex(),
  };
}

export async function clientLoader() {
  try {
    return {
      indexData: await fetchStoriesIndex(),
    };
  } catch {
    return {
      indexData: null,
    };
  }
}

export function meta({ loaderData }: Route.MetaArgs) {
  return buildEntitiesMeta({ indexData: loaderData?.indexData ?? null });
}

export default function EntitiesRoute({ loaderData }: Route.ComponentProps) {
  return <EntitiesPage initialIndexData={loaderData?.indexData ?? null} />;
}
