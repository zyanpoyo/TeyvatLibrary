import type { Route } from "./+types/shelf";
import { fetchStoriesIndex } from "../api/stories";
import { ShelfPage } from "../components/shelf/ShelfPage";
import { buildShelfMeta } from "../domain/seo";
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
  return buildShelfMeta({ indexData: loaderData?.indexData ?? null });
}

export default function ShelfRoute({ loaderData }: Route.ComponentProps) {
  return <ShelfPage initialIndexData={loaderData?.indexData ?? null} />;
}
