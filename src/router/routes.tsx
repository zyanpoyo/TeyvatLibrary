import { createHashRouter, Navigate, type RouteObject } from "react-router";
import { AppShell } from "../components/layout/AppShell";
import { ReaderPage } from "../components/reader/ReaderPage";
import { ShelfPage } from "../components/shelf/ShelfPage";

export function getStoryHash(storyId: string): string {
  return `#/story/${encodeURIComponent(storyId)}`;
}

/**
 * 旧形式のハッシュ URL（#story/<id>）を React Router 標準の #/story/<id> へ正規化する。
 */
export function normalizeLegacyHash(): void {
  if (typeof window === "undefined") return;
  const hash = window.location.hash;
  if (/^#story\/.+/.test(hash)) {
    const normalized = `#/${hash.slice(1)}`;
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${window.location.search}${normalized}`
    );
  }
}

export const appRoutes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      {
        index: true,
        element: <ShelfPage />,
      },
      {
        path: "story/:storyId",
        element: <ReaderPage />,
      },
      {
        path: "*",
        element: <Navigate to="/" replace />,
      },
    ],
  },
];

export function createAppRouter() {
  normalizeLegacyHash();
  return createHashRouter(appRoutes);
}
