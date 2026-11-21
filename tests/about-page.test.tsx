import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { analytics } from "../src/analytics/ga4";
import { clearStoriesCache } from "../src/api/stories";
import { ABOUT_DOCUMENT_TITLE, AboutPage } from "../src/components/about/AboutPage";
import { AppShell } from "../src/components/layout/AppShell";
import { ShelfPage } from "../src/components/shelf/ShelfPage";
import {
  DEFAULT_CONTACT_FORM_URL,
  DEFAULT_CONTACT_X_URL,
  DEFAULT_GITHUB_ISSUES_URL,
  DEFAULT_OPERATOR_NAME,
  type SiteContactConfig,
} from "../src/config/site-contact";
import { normalizeLegacyHash } from "../src/router/routes";
import { ANALYTICS_PREFS_KEY } from "../src/state/analytics-prefs";
import { AppProviders, BASE_DOCUMENT_TITLE } from "../src/state/AppProviders";
import type { StoriesIndexData } from "../src/types/story";

const MOCK_INDEX: StoriesIndexData = {
  generatedAt: "2026-11-15T00:00:00.000Z",
  totalCount: 1,
  categoryCounts: {
    book: 0,
    artifact: 1,
    weapon: 0,
    attire: 0,
    chronicle: 0,
  },
  entitiesIndex: {},
  stories: [
    {
      id: "mock_witch",
      title: "燃え盛る炎の魔女",
      shelfCategory: "artifact",
      categoryLabel: "聖遺物（連作短編）",
      region: ["モンド"],
      era: "500年前",
      addedAt: "2026-11-14",
      readingTime: "約3分",
      charCount: 1200,
      chapterCount: 1,
      hook: "炎の魔女の記憶",
      tags: ["ロザリン"],
      entityIds: [],
    },
  ],
};

function renderApp(initialEntries: string[] = ["/"], contactConfig?: SiteContactConfig) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <AppProviders>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<ShelfPage />} />
            <Route path="about" element={<AboutPage contactConfig={contactConfig} />} />
          </Route>
        </Routes>
      </AppProviders>
    </MemoryRouter>
  );
}

describe("AboutPage and footer navigation", () => {
  beforeEach(() => {
    clearStoriesCache();
    localStorage.clear();
    document.title = BASE_DOCUMENT_TITLE;
    document.body.removeAttribute("data-view");
    window.history.replaceState(null, "", "/");

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("stories-index.json")) {
          return { ok: true, status: 200, json: async () => MOCK_INDEX } as Response;
        }
        return { ok: false, status: 404, json: async () => ({}) } as Response;
      })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("navigates from footer link to /about, syncs title/body[data-view]/GA4 page_view, and restores title when returning to shelf", async () => {
    const user = userEvent.setup();
    const pageViewSpy = vi.spyOn(analytics, "trackPageView");

    renderApp(["/"]);
    await screen.findByText("燃え盛る炎の魔女");
    expect(document.body.dataset.view).toBe("shelf");

    const aboutLink = screen.getByRole("link", { name: "このサイトについて" });
    expect(aboutLink).not.toHaveAttribute("aria-current");

    await user.click(aboutLink);

    expect(await screen.findByRole("heading", { level: 1, name: "このサイトについて" })).toBeVisible();
    expect(document.body.dataset.view).toBe("about");
    expect(document.title).toBe(ABOUT_DOCUMENT_TITLE);
    expect(screen.getByRole("link", { name: "このサイトについて" })).toHaveAttribute(
      "aria-current",
      "page"
    );

    expect(pageViewSpy).toHaveBeenCalledWith({
      pagePath: "/about",
      pageTitle: ABOUT_DOCUMENT_TITLE,
    });
    expect(
      pageViewSpy.mock.calls.filter(([params]) => params.pagePath === "/about")
    ).toHaveLength(1);

    // 6セクションすべての見出しが表示される
    const expectedHeadings = [
      "当サイトについて",
      "著作権・引用について",
      "アクセス解析ツールについて",
      "ブラウザのデータ保存（localStorage）について",
      "免責事項",
      "お問い合わせ",
    ];
    for (const title of expectedHeadings) {
      expect(screen.getByRole("heading", { level: 2, name: title })).toBeVisible();
    }

    // 書架へ戻るとタイトルが元に戻る
    await user.click(screen.getByRole("link", { name: "← 書架へ戻る" }));
    await screen.findByText("燃え盛る炎の魔女");
    expect(document.body.dataset.view).toBe("shelf");
    expect(document.title).toBe(BASE_DOCUMENT_TITLE);
  });

  it("scrolls to target section and focuses heading from quick TOC without mutating router path", async () => {
    const user = userEvent.setup();
    const scrollSpy = vi.spyOn(Element.prototype, "scrollIntoView");

    renderApp(["/about"]);
    await screen.findByRole("heading", { level: 1, name: "このサイトについて" });

    const tocNav = screen.getByRole("navigation", { name: "このページの目次" });
    await user.click(within(tocNav).getByRole("button", { name: "お問い合わせ" }));

    const contactSection = document.getElementById("about-contact");
    const contactHeading = document.getElementById("about-contact-heading");
    expect(contactSection).not.toBeNull();
    expect(scrollSpy).toHaveBeenCalled();
    expect(scrollSpy.mock.instances[0]).toBe(contactSection);
    expect(contactHeading).toHaveFocus();
  });

  it("synchronizes analytics opt-out switch bi-directionally between AboutPage and PrivacyDialog", async () => {
    const user = userEvent.setup();
    const setOptOutSpy = vi.spyOn(analytics, "setOptOut");

    renderApp(["/about"]);
    await screen.findByRole("heading", { level: 1, name: "このサイトについて" });

    const analyticsSection = document.getElementById("about-analytics")!;
    const inlineSwitch = within(analyticsSection).getByRole("switch", {
      name: "アクセス解析（Google Analytics）を有効にする",
    });
    expect(inlineSwitch).toBeChecked();

    await user.click(inlineSwitch);
    expect(inlineSwitch).not.toBeChecked();
    expect(setOptOutSpy).toHaveBeenLastCalledWith(true);
    expect(JSON.parse(localStorage.getItem(ANALYTICS_PREFS_KEY) || "{}")).toEqual({
      optOut: true,
    });

    // フッターからダイアログを開くと同じ OFF 状態で同期している
    await user.click(screen.getByRole("button", { name: "アクセス解析について" }));
    const dialog = await screen.findByRole("dialog", { name: "アクセス解析について" });
    const dialogSwitch = within(dialog).getByRole("switch", {
      name: "アクセス解析（Google Analytics）を有効にする",
    });
    expect(dialogSwitch).not.toBeChecked();

    // ダイアログ側で ON に戻すと About ページ側も即座に ON へ同期する
    await user.click(dialogSwitch);
    expect(dialogSwitch).toBeChecked();
    expect(inlineSwitch).toBeChecked();
    expect(JSON.parse(localStorage.getItem(ANALYTICS_PREFS_KEY) || "{}")).toEqual({
      optOut: false,
    });
  });

  it("renders default GitHub Issues, contact form, and operator X links, and supports custom contactConfig overrides", async () => {
    const defaultRender = renderApp(["/about"]);
    await screen.findByRole("heading", { level: 1, name: "このサイトについて" });
    const defaultContactSection = document.getElementById("about-contact")!;
    const defaultIssuesLink = within(defaultContactSection).getByRole("link", {
      name: "GitHub Issues で報告・確認する",
    });
    expect(defaultIssuesLink).toHaveAttribute("href", DEFAULT_GITHUB_ISSUES_URL);
    expect(defaultIssuesLink).toHaveAttribute("target", "_blank");
    expect(defaultIssuesLink).toHaveAttribute("rel", "noopener noreferrer");

    const defaultFormLink = within(defaultContactSection).getByRole("link", {
      name: "お問い合わせフォームを開く",
    });
    expect(defaultFormLink).toHaveAttribute("href", DEFAULT_CONTACT_FORM_URL);
    expect(defaultFormLink).toHaveAttribute("target", "_blank");
    expect(defaultFormLink).toHaveAttribute("rel", "noopener noreferrer");

    expect(
      within(defaultContactSection).getByText(`運営者（${DEFAULT_OPERATOR_NAME}）・SNS`)
    ).toBeVisible();
    const defaultXLink = within(defaultContactSection).getByRole("link", {
      name: `@${DEFAULT_OPERATOR_NAME}（X / 旧Twitter）`,
    });
    expect(defaultXLink).toHaveAttribute("href", DEFAULT_CONTACT_X_URL);
    expect(defaultXLink).toHaveAttribute("target", "_blank");
    expect(defaultXLink).toHaveAttribute("rel", "noopener noreferrer");

    expect(within(defaultContactSection).queryByRole("link", { name: /@/ })).toBe(defaultXLink);
    defaultRender.unmount();

    const baseConfig: SiteContactConfig = {
      operatorName: DEFAULT_OPERATOR_NAME,
      githubIssuesUrl: "https://github.com/zyanpoyo/TeyvatLibrary/issues",
      contactFormUrl: null,
      contactEmail: null,
      contactXUrl: null,
    };

    const { unmount } = renderApp(["/about"], baseConfig);
    await screen.findByRole("heading", { level: 1, name: "このサイトについて" });
    const contactSection = document.getElementById("about-contact")!;
    const issuesLink = within(contactSection).getByRole("link", {
      name: "GitHub Issues で報告・確認する",
    });
    expect(issuesLink).toHaveAttribute("href", baseConfig.githubIssuesUrl);
    expect(issuesLink).toHaveAttribute("target", "_blank");
    expect(issuesLink).toHaveAttribute("rel", "noopener noreferrer");
    expect(
      within(contactSection).queryByRole("link", { name: "お問い合わせフォームを開く" })
    ).toBeNull();
    expect(within(contactSection).queryByRole("link", { name: /@/ })).toBeNull();
    unmount();

    const fullConfig: SiteContactConfig = {
      operatorName: DEFAULT_OPERATOR_NAME,
      githubIssuesUrl: "https://github.com/zyanpoyo/TeyvatLibrary/issues",
      contactFormUrl: "https://docs.google.com/forms/d/e/example/viewform",
      contactEmail: "contact@example.com",
      contactXUrl: "https://x.com/zyanpoyo",
    };
    renderApp(["/about"], fullConfig);
    await screen.findByRole("heading", { level: 1, name: "このサイトについて" });
    const fullContactSection = document.getElementById("about-contact")!;
    const formLink = within(fullContactSection).getByRole("link", {
      name: "お問い合わせフォームを開く",
    });
    expect(formLink).toHaveAttribute("href", fullConfig.contactFormUrl);
    expect(formLink).toHaveAttribute("target", "_blank");
    expect(formLink).toHaveAttribute("rel", "noopener noreferrer");

    const xLink = within(fullContactSection).getByRole("link", {
      name: "@zyanpoyo（X / 旧Twitter）",
    });
    expect(xLink).toHaveAttribute("href", fullConfig.contactXUrl);
    expect(xLink).toHaveAttribute("target", "_blank");
    expect(xLink).toHaveAttribute("rel", "noopener noreferrer");

    const mailLink = within(fullContactSection).getByRole("link", {
      name: "contact@example.com",
    });
    expect(mailLink).toHaveAttribute("href", "mailto:contact@example.com");
  });

  it("normalizes legacy #about hash to #/about", () => {
    window.history.replaceState(null, "", "/#about");
    normalizeLegacyHash();
    expect(window.location.hash).toBe("#/about");
  });
});
