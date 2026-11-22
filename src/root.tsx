import { useEffect, type ReactNode } from "react";
import { isRouteErrorResponse, Link, Links, Meta, Scripts, useMatch } from "react-router";
import type { Route } from "./+types/root";
import { AppShell } from "./components/layout/AppShell";
import { AppProviders } from "./state/AppProviders";
import commonStyles from "./styles/common.module.css";
import "./styles/tokens.css";

const THEME_INIT_SCRIPT = `(function () {
  var theme = "night";
  var fontSize = "1.0625rem";
  var proseFont = '"Shippori Mincho", serif';
  var fontSizes = { small: "0.9375rem", medium: "1.0625rem", large: "1.2rem" };
  var fontFamilies = {
    mincho: '"Shippori Mincho", serif',
    gothic: '"Noto Sans JP", sans-serif'
  };
  try {
    var raw = localStorage.getItem("genshin-books-display-prefs-v1");
    var parsed = raw ? JSON.parse(raw) : null;
    if (parsed) {
      if (parsed.theme === "night" || parsed.theme === "paper" || parsed.theme === "sepia") {
        theme = parsed.theme;
      }
      if (parsed.fontSize && fontSizes[parsed.fontSize]) {
        fontSize = fontSizes[parsed.fontSize];
      }
      if (parsed.fontFamily && fontFamilies[parsed.fontFamily]) {
        proseFont = fontFamilies[parsed.fontFamily];
      }
    }
  } catch (e) {
    // Ignore storage errors
  }
  var root = document.documentElement;
  root.dataset.theme = theme;
  root.style.setProperty("--reader-font-size", fontSize);
  root.style.setProperty("--reader-prose-font", proseFont);
  root.style.colorScheme = theme === "night" ? "dark" : "light";
  var meta = document.querySelector('meta[name="color-scheme"]');
  if (!meta && document.head) {
    meta = document.createElement("meta");
    meta.name = "color-scheme";
    document.head.appendChild(meta);
  }
  if (meta) {
    meta.content = theme === "night" ? "dark" : "light";
  }
})();`;

export function Layout({ children }: { children: ReactNode }) {
  const isReaderRoute = Boolean(useMatch("/story/:storyId"));
  const isAboutRoute = Boolean(useMatch("/about"));
  const initialView = isReaderRoute ? "reader" : isAboutRoute ? "about" : "shelf";

  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#0b101c" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <Meta />
        <Links />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&family=Shippori+Mincho:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body data-view={initialView} suppressHydrationWarning>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

export function HydrateFallback() {
  return (
    <main style={{ maxWidth: "820px", margin: "4rem auto", padding: "0 1.5rem" }}>
      <p className={commonStyles.loadingStatus}>✦ 星図の記録を読み込んでいます…</p>
    </main>
  );
}

export default function Root() {
  useEffect(() => {
    if (typeof window !== "undefined" && "scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
  }, []);

  return (
    <AppProviders deferStorageHydration>
      <AppShell />
    </AppProviders>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let heading = "ページの読み込み中にエラーが発生しました";
  let detail = "時間をおいて再度お試しいただくか、書架トップへお戻りください。";

  if (isRouteErrorResponse(error)) {
    heading = error.status === 404 ? "ページが見つかりません" : `エラー (${error.status})`;
    detail =
      error.status === 404
        ? "指定された URL は見つかりませんでした。"
        : error.statusText || detail;
  } else if (error instanceof Error && import.meta.env.DEV) {
    detail = error.message;
  }

  return (
    <main style={{ maxWidth: "720px", margin: "4rem auto", padding: "0 1.5rem" }}>
      <div className={commonStyles.emptyState}>
        <h1 className={commonStyles.emptyTitle}>{heading}</h1>
        <p className={commonStyles.emptyDesc}>{detail}</p>
        <Link to="/" className={commonStyles.controlPill}>
          ← 書架へ戻る
        </Link>
      </div>
    </main>
  );
}
