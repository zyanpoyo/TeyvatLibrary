import { expect, test } from "@playwright/test";

test.describe("本番 SSG 静的 HTML・クロール基盤・ハイドレーション検証", () => {
  test("全ルートの静的 HTML・HTTP 404・robots.txt・sitemap.xml・favicon を正しく配信する", async ({
    request,
  }) => {
    const shelfRes = await request.get("/");
    expect(shelfRes.status()).toBe(200);
    const shelfHtml = await shelfRes.text();
    expect(shelfHtml).toContain("<title>テイワット文庫 — 原神 聖遺物・武器・書籍リーダー</title>");
    expect(shelfHtml).toContain('<link rel="icon" type="image/svg+xml" href="/favicon.svg"');
    expect(shelfHtml).toContain("燃え盛る炎の魔女");

    const storyRes = await request.get("/story/crimson_witch");
    expect(storyRes.status()).toBe(200);
    const storyHtml = await storyRes.text();
    expect(storyHtml).toContain("<title>燃え盛る炎の魔女 | テイワット文庫</title>");
    expect(storyHtml).toContain("燃える魔女がまだ少女");
    expect(storyHtml).toContain('data-view="reader"');

    const aboutRes = await request.get("/about");
    expect(aboutRes.status()).toBe(200);
    const aboutHtml = await aboutRes.text();
    expect(aboutHtml).toContain("<title>このサイトについて | テイワット文庫</title>");
    expect(aboutHtml).toContain("このサイトについて");

    const notFoundRes = await request.get("/nonexistent-ssg-check");
    expect(notFoundRes.status()).toBe(404);
    const notFoundHtml = await notFoundRes.text();
    expect(notFoundHtml).toContain("ページが見つかりません");

    const robotsRes = await request.get("/robots.txt");
    expect(robotsRes.status()).toBe(200);
    const robotsTxt = await robotsRes.text();
    expect(robotsTxt).toContain("User-agent: *");
    expect(robotsTxt).toContain("Sitemap:");

    const sitemapRes = await request.get("/sitemap.xml");
    expect(sitemapRes.status()).toBe(200);
    const sitemapXml = await sitemapRes.text();
    expect(sitemapXml).toContain("/story/crimson_witch");
    expect(sitemapXml).toContain("/about");

    const faviconRes = await request.get("/favicon.svg");
    expect(faviconRes.status()).toBe(200);
    const faviconSvg = await faviconRes.text();
    expect(faviconSvg).toContain("<svg");
  });

  test("localStorage の設定・読了状態を抱えたまま直アクセスしても Hydration 警告・エラーなしで起動し遷移できる", async ({
    page,
  }) => {
    await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/, (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/css; charset=utf-8",
        body: "",
      })
    );

    const pageErrors = [];
    const consoleErrors = [];
    const hydrationWarnings = [];

    page.on("pageerror", (err) => pageErrors.push(err.message));
    page.on("console", (msg) => {
      const text = msg.text();
      if (msg.type() === "error") {
        consoleErrors.push(text);
      }
      if (/hydrat/i.test(text)) {
        hydrationWarnings.push(text);
      }
    });

    // 同一オリジンの localStorage へ事前保存してから /story/crimson_witch へ直接アクセス
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem(
        "genshin-books-display-prefs-v1",
        JSON.stringify({ theme: "sepia", fontSize: "large", fontFamily: "gothic" })
      );
      localStorage.setItem(
        "genshin-books-reading-state-v1",
        JSON.stringify({
          readStories: { crimson_witch: { readAt: "2026-11-22T00:00:00.000Z" } },
          bookmarks: [],
          lastSession: null,
        })
      );
    });

    await page.goto("/story/crimson_witch");
    await expect(page.locator("#reader-view")).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "sepia");
    await expect(page.locator(".reader-title")).toHaveText("燃え盛る炎の魔女");
    await expect(page.locator(".reader-state-bar .reader-read-btn")).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    // 書架・About へ遷移し往復してもエラーが発生しないこと
    await page.locator("#back-to-shelf-btn").click();
    await expect(page.locator("body")).toHaveAttribute("data-view", "shelf");
    await expect(page.locator("#story-grid .story-card").first()).toBeVisible();

    await page.locator("#about-page-link").click();
    await expect(page.locator("body")).toHaveAttribute("data-view", "about");
    await expect(page.locator("#about-view h1")).toHaveText("このサイトについて");

    await page.locator("#about-back-to-shelf-link").click();
    await expect(page.locator("body")).toHaveAttribute("data-view", "shelf");

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
    expect(hydrationWarnings).toEqual([]);
  });
});
