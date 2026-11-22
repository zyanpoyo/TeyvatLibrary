import type { Route } from "./+types/courses";
import { fetchStoriesIndex } from "../api/stories";
import { CoursesPage } from "../components/courses/CoursesPage";
import { buildCoursesMeta } from "../domain/seo";
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
  return buildCoursesMeta({ indexData: loaderData?.indexData ?? null });
}

export default function CoursesRoute({ loaderData }: Route.ComponentProps) {
  return <CoursesPage initialIndexData={loaderData?.indexData ?? null} />;
}
