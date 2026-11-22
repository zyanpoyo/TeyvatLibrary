import type { Route } from "./+types/shelf";
import { fetchStoriesIndex } from "../api/stories";
import { ShelfPage } from "../components/shelf/ShelfPage";
import { buildCanonicalMetaTag } from "../config/site-url";
import { loadDistStoriesIndex } from "../server/dist-data.server.mjs";
import { BASE_DOCUMENT_TITLE } from "../state/AppProviders";

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

export function meta() {
  return [{ title: BASE_DOCUMENT_TITLE }, ...buildCanonicalMetaTag("/")];
}

export default function ShelfRoute({ loaderData }: Route.ComponentProps) {
  return <ShelfPage initialIndexData={loaderData?.indexData ?? null} />;
}
