import { useMatch } from "react-router";

export type AppViewKind = "shelf" | "courses" | "entities" | "reader" | "about";

/**
 * 現在の URL ルートに対応する論理ビュー種別（body[data-view] や常設ナビの現在地判定用）を返す。
 */
export function useCurrentAppView(): AppViewKind {
  const isReader = Boolean(useMatch("/story/:storyId"));
  const isAbout = Boolean(useMatch("/about"));
  const isCoursesIndex = Boolean(useMatch("/courses"));
  const isCourseDetail = Boolean(useMatch("/courses/:courseId"));
  const isEntitiesIndex = Boolean(useMatch("/entities"));
  const isEntityDetail = Boolean(useMatch("/entities/:entityId"));

  if (isReader) return "reader";
  if (isAbout) return "about";
  if (isCoursesIndex || isCourseDetail) return "courses";
  if (isEntitiesIndex || isEntityDetail) return "entities";
  return "shelf";
}
