import { expect, test } from "@playwright/test";

function extractJsonLdGraph(html) {
  const match = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html);
  expect(match).not.toBeNull();
  return JSON.parse(match[1]);
}

test.describe("本番 SSG 静的 HTML・SEOメタ・構造化データ・OGP画像・ハイドレーション検証", () => {
  test("全ルート（書架・5分類物語・About・404）の静的 HTML・OGP・JSON-LD・画像・sitemap を正しく配信する", async ({
    request,
  }) => {
    const shelfRes = await request.get("/");
    expect(shelfRes.status()).toBe(200);
    const shelfHtml = await shelfRes.text();
    expect(shelfHtml).toContain(
      "<title>テイワット文庫｜原神の聖遺物・武器・書籍ストーリー全文＆用語解説リーダー</title>"
    );
    expect(shelfHtml).toContain('<link rel="canonical" href="https://teyvat-bunko.com/"');
    expect(shelfHtml).toContain(
      '<meta property="og:image" content="https://teyvat-bunko.com/og/site.png"'
    );
    expect(shelfHtml).toContain('<link rel="icon" type="image/svg+xml" href="/favicon.svg"');
    expect(shelfHtml).toContain("燃え盛る炎の魔女");
    const shelfLd = extractJsonLdGraph(shelfHtml);
    expect(shelfLd["@graph"].map((n) => n["@type"])).toEqual(["WebSite", "CollectionPage"]);

    // 5 分類代表作の静的 HTML と JSON-LD / OGP 検証
    const representativeCases = [
      {
        id: "crimson_witch",
        expectedTitleSnippet: "聖遺物「燃え盛る炎の魔女」",
        expectedBodySnippet: "燃える魔女がまだ少女",
      },
      {
        id: "byakuyakoku",
        expectedTitleSnippet: "書籍「白夜国館蔵（日月前事 ほか全五巻）」",
        expectedBodySnippet: "パネース",
      },
      {
        id: "wolfs",
        expectedTitleSnippet: "武器「狼の末路」",
        expectedBodySnippet: "アンドリアス",
      },
      {
        id: "wings_of_fate",
        expectedTitleSnippet: "風の翼「交錯する運命の翼」",
        expectedBodySnippet: "交錯する運命の翼",
      },
      {
        id: "signora_chronicle",
        expectedTitleSnippet: "育成素材「紅蓮の蛾と灰燼の追憶（淑女討伐録）」",
        expectedBodySnippet: "ロザリン",
      },
    ];

    for (const item of representativeCases) {
      const res = await request.get(`/story/${item.id}`);
      expect(res.status()).toBe(200);
      const html = await res.text();
      expect(html).toContain(item.expectedTitleSnippet);
      expect(html).toContain(item.expectedBodySnippet);
      expect(html).toContain('data-view="reader"');
      expect(html).toContain(
        `<link rel="canonical" href="https://teyvat-bunko.com/story/${item.id}"`
      );
      expect(html).toContain(
        `<meta property="og:image" content="https://teyvat-bunko.com/og/story/${item.id}.png"`
      );

      const ld = extractJsonLdGraph(html);
      expect(ld["@graph"].map((n) => n["@type"])).toEqual(["BreadcrumbList", "Article"]);
      const article = ld["@graph"][1];
      expect(article.datePublished).toMatch(/^\d{4}-\d{2}-\d{2}T00:00:00\+09:00$/);
    }

    const aboutRes = await request.get("/about");
    expect(aboutRes.status()).toBe(200);
    const aboutHtml = await aboutRes.text();
    expect(aboutHtml).toContain("<title>このサイトについて｜テイワット文庫</title>");
    expect(aboutHtml).toContain('<link rel="canonical" href="https://teyvat-bunko.com/about"');
    expect(aboutHtml).toContain(
      '<meta property="og:image" content="https://teyvat-bunko.com/og/about.png"'
    );
    const aboutLd = extractJsonLdGraph(aboutHtml);
    expect(aboutLd["@graph"].map((n) => n["@type"])).toEqual(["BreadcrumbList", "AboutPage"]);

    const notFoundRes = await request.get("/nonexistent-ssg-check");
    expect(notFoundRes.status()).toBe(404);
    const notFoundHtml = await notFoundRes.text();
    expect(notFoundHtml).toContain("ページが見つかりません");
    expect(notFoundHtml).toContain('<meta name="robots" content="noindex, nofollow"');
    expect(notFoundHtml).not.toContain('rel="canonical"');

    // 静的 OGP PNG アセット配信検証
    for (const ogPath of ["/og/site.png", "/og/about.png", "/og/story/crimson_witch.png"]) {
      const ogRes = await request.get(ogPath);
      expect(ogRes.status()).toBe(200);
      expect(ogRes.headers()["content-type"]).toContain("image/png");
      const bytes = await ogRes.body();
      expect(bytes.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))).toBe(true);
    }

    const robotsRes = await request.get("/robots.txt");
    expect(robotsRes.status()).toBe(200);
    const robotsTxt = await robotsRes.text();
    expect(robotsTxt).toContain("User-agent: *");
    expect(robotsTxt).toContain("Sitemap: https://teyvat-bunko.com/sitemap.xml");

    const sitemapRes = await request.get("/sitemap.xml");
    expect(sitemapRes.status()).toBe(200);
    const sitemapXml = await sitemapRes.text();
    expect(sitemapXml).toContain("<loc>https://teyvat-bunko.com/story/crimson_witch</loc>");
    expect(sitemapXml).toContain("<lastmod>2026-11-01</lastmod>");
    expect(sitemapXml).toContain("<loc>https://teyvat-bunko.com/about</loc>");

    const faviconRes = await request.get("/favicon.svg");
    expect(faviconRes.status()).toBe(200);
    const faviconSvg = await faviconRes.text();
    expect(faviconSvg).toContain("<svg");
  });

  test("localStorage の設定・読了状態を抱えたまま直アクセスしても Hydration 警告・エラーなしで起動し、作品シェアバーも含め遷移できる", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
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

    // リーダー末尾の作品シェアバー（X シェアリンク・URL コピー）が機能すること
    const xShareLink = page.locator('#story-share-bar a[data-action="share-story-x"]');
    await expect(xShareLink).toHaveAttribute("href", /https:\/\/x\.com\/intent\/tweet\?/);
    await expect(xShareLink).toHaveAttribute("href", /teyvat-bunko\.com%2Fstory%2Fcrimson_witch/);

    const copyBtn = page.locator('#story-share-bar button[data-action="copy-story-url"]');
    await copyBtn.click();
    await expect(page.locator('#story-share-bar [role="status"]')).toHaveText(
      "URL をコピーしました"
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
