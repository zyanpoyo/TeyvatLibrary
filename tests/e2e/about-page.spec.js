import { expect, test } from "@playwright/test";
import { setupMockApi } from "./fixtures/mock-data.js";

test.describe("About ページ（/about）とナビゲーション・設定同期", () => {
  test("フッターから About ページへ遷移し、目次移動・オプトアウト双方向同期・書架復帰ができる", async ({
    page,
  }) => {
    const gaRequests = [];
    page.on("request", (req) => {
      const url = req.url();
      if (/googletagmanager\.com|google-analytics\.com/i.test(url)) {
        gaRequests.push(url);
      }
    });

    await setupMockApi(page);
    await page.goto("/");
    await expect(page.locator("#story-grid .story-card")).toHaveCount(3);

    // ページ下部へスクロールしてからフッターの「このサイトについて」をクリック
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const aboutLink = page.locator("#about-page-link");
    await expect(aboutLink).toBeVisible();
    await expect(aboutLink).toHaveText("このサイトについて");
    await aboutLink.click();

    await expect(page).toHaveURL(/\/about$/);
    await expect(page.locator("body")).toHaveAttribute("data-view", "about");
    await expect(page).toHaveTitle("このサイトについて | テイワット文庫");
    await expect(aboutLink).toHaveAttribute("aria-current", "page");
    await expect(page.locator("#about-view h1")).toHaveText("このサイトについて");
    expect(await page.evaluate(() => window.scrollY)).toBe(0);

    // 6セクションの見出しがすべて表示される
    await expect(page.locator("#about-view h2")).toHaveText([
      "当サイトについて",
      "著作権・引用について",
      "アクセス解析ツールについて",
      "ブラウザのデータ保存（localStorage）について",
      "免責事項",
      "お問い合わせ",
    ]);

    // クイック目次から「お問い合わせ」へスクロールしても URL が /about のまま維持される
    await page.locator('button[data-target-section="about-contact"]').click();
    await expect(page).toHaveURL(/\/about$/);
    await expect(page.locator("#about-contact-heading")).toBeInViewport();

    // デフォルトのお問い合わせ2窓口（GitHub Issues と専用 Google フォーム）が表示される
    const contactSection = page.locator("#about-contact");
    const issuesLink = contactSection.getByRole("link", { name: "GitHub Issues で報告・確認する" });
    await expect(issuesLink).toHaveAttribute("href", "https://github.com/zyanpoyo/TeyvatLibrary/issues");
    await expect(issuesLink).toHaveAttribute("target", "_blank");
    await expect(issuesLink).toHaveAttribute("rel", "noopener noreferrer");

    const formLink = contactSection.getByRole("link", { name: "お問い合わせフォームを開く" });
    await expect(formLink).toHaveAttribute(
      "href",
      "https://docs.google.com/forms/d/e/1FAIpQLScrKc3YA_ItOhFH5-ZOccgwfYJr5tiq9UY7JMcHznZoHkiM5Q/viewform?usp=header"
    );
    await expect(formLink).toHaveAttribute("target", "_blank");
    await expect(formLink).toHaveAttribute("rel", "noopener noreferrer");

    await expect(contactSection.getByText("運営者（zyanpoyo）・SNS")).toBeVisible();
    const xLink = contactSection.getByRole("link", { name: "@zyanpoyo（X / 旧Twitter）" });
    await expect(xLink).toHaveAttribute("href", "https://x.com/zyanpoyo");
    await expect(xLink).toHaveAttribute("target", "_blank");
    await expect(xLink).toHaveAttribute("rel", "noopener noreferrer");

    // About ページ内のオプトアウトスイッチを OFF にすると PrivacyDialog とも同期し、リロード後も維持される
    const aboutSection = page.locator("#about-analytics");
    const aboutSwitch = aboutSection.getByRole("switch", {
      name: "アクセス解析（Google Analytics）を有効にする",
    });
    await expect(aboutSwitch).toBeChecked();
    await aboutSwitch.click();
    await expect(aboutSwitch).not.toBeChecked();

    await page.locator("#privacy-dialog-trigger").click();
    const dialog = page.locator("#privacy-dialog");
    await expect(dialog).toBeVisible();
    const dialogSwitch = dialog.getByRole("switch", {
      name: "アクセス解析（Google Analytics）を有効にする",
    });
    await expect(dialogSwitch).not.toBeChecked();
    await dialog.locator(".privacy-dialog-close").click();

    await page.reload();
    await expect(page.locator("body")).toHaveAttribute("data-view", "about");
    await expect(
      page
        .locator("#about-analytics")
        .getByRole("switch", { name: "アクセス解析（Google Analytics）を有効にする" })
    ).not.toBeChecked();

    // 「← 書架へ戻る」で書架に戻る
    await page.locator("#about-back-to-shelf-link").click();
    await expect(page.locator("body")).toHaveAttribute("data-view", "shelf");
    await expect(page.locator("#story-grid .story-card")).toHaveCount(3);
    expect(gaRequests).toEqual([]);
  });

  test("リーダー画面から About へ遷移してブラウザバックで戻れ、/about 直アクセスも表示できる", async ({
    page,
  }) => {
    await setupMockApi(page);
    await page.goto("/story/mock_witch");
    await expect(page.locator(".reader-title")).toHaveText("燃え盛る炎の魔女（テスト版）");

    await page.locator("#about-page-link").click();
    await expect(page).toHaveURL(/\/about$/);
    await expect(page.locator("body")).toHaveAttribute("data-view", "about");

    await page.goBack();
    await expect(page).toHaveURL(/\/story\/mock_witch$/);
    await expect(page.locator("body")).toHaveAttribute("data-view", "reader");
    await expect(page.locator(".reader-title")).toHaveText("燃え盛る炎の魔女（テスト版）");

    await page.goto("/about");
    await expect(page).toHaveURL(/\/about$/);
    await expect(page.locator("body")).toHaveAttribute("data-view", "about");
    await expect(page.locator("#about-view h1")).toHaveText("このサイトについて");
  });
});
