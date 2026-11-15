import { expect, test } from "@playwright/test";
import { setupMockApi } from "./fixtures/mock-data.js";

test.describe("表示設定・異常系再試行・実データ結合スモーク", () => {
  test("背景テーマ・文字サイズ・書体の変更が反映されリロード後も永続化される", async ({ page }) => {
    await setupMockApi(page);
    await page.goto("/");

    // 書架のテーマスイッチャーで「生成り紙」に切り替え
    const paperBtn = page.locator("#shelf-theme-switcher [data-setting='theme'][data-value='paper']");
    await paperBtn.click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "paper");
    await expect(page.locator('meta[name="color-scheme"]')).toHaveAttribute("content", "light");
    await expect(paperBtn).toHaveAttribute("aria-pressed", "true");

    // リーダーへ遷移し「Aa 表示設定」Popoverから文字サイズ・書体・セピアテーマを変更
    await page.locator(".story-card[data-story-id='mock_witch'] .card-primary-link").click();
    await page.locator("#display-settings-btn").click();

    const displayPopover = page.locator("#display-settings-popover");
    await expect(displayPopover).toBeVisible();

    await displayPopover.locator("[data-setting='fontSize'][data-value='large']").click();
    await displayPopover.locator("[data-setting='fontFamily'][data-value='gothic']").click();
    await displayPopover.locator("[data-setting='theme'][data-value='sepia']").click();

    await expect(page.locator("html")).toHaveAttribute("data-theme", "sepia");
    const cssVars = await page.evaluate(() => ({
      fontSize: document.documentElement.style.getPropertyValue("--reader-font-size"),
      proseFont: document.documentElement.style.getPropertyValue("--reader-prose-font"),
    }));
    expect(cssVars.fontSize).toBe("1.2rem");
    expect(cssVars.proseFont).toContain("Noto Sans JP");

    // リロード後も全設定が保持されていること（書架テーマボタンのaria-pressedも同期）
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "sepia");
    const reloadedVars = await page.evaluate(() => ({
      fontSize: document.documentElement.style.getPropertyValue("--reader-font-size"),
      proseFont: document.documentElement.style.getPropertyValue("--reader-prose-font"),
    }));
    expect(reloadedVars.fontSize).toBe("1.2rem");
    expect(reloadedVars.proseFont).toContain("Noto Sans JP");

    await page.locator("#back-to-shelf-btn").click();
    await expect(
      page.locator("#shelf-theme-switcher [data-setting='theme'][data-value='sepia']")
    ).toHaveAttribute("aria-pressed", "true");
  });

  test("作品データ取得エラー時にエラー画面が表示され、再試行ボタンで復帰できる", async ({ page }) => {
    await setupMockApi(page, { failOnceIds: new Set(["mock_witch"]) });
    await page.goto("/");

    await page.locator(".story-card[data-story-id='mock_witch'] .card-primary-link").click();
    await expect(page.locator("#reader-header .shelf-empty-title")).toHaveText("作品の読み込みに失敗しました");

    await page.locator('[data-action="retry-story"]').click();
    await expect(page.locator(".reader-title")).toHaveText("燃え盛る炎の魔女（テスト版）");
    await expect(page.locator("#chapters-container .chapter-section")).toHaveCount(2);
  });

  test("【実データスモーク】public/data/ の実データで書架一覧と作品リーダーが正常に描画される", async ({ page }) => {
    // 外部Webフォント通信のみブロックし、アプリ配信JSONはモックせず実ファイルを読み込む
    await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/, (route) =>
      route.abort()
    );

    const pageErrors = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await page.goto("/");
    const cards = page.locator("#story-grid .story-card");
    await expect(cards.first()).toBeVisible();
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThan(0);

    await cards.first().locator(".card-primary-link").click();
    await expect(page.locator("body")).toHaveAttribute("data-view", "reader");
    await expect(page.locator(".reader-title")).not.toBeEmpty();
    await expect(page.locator("#chapters-container .novel-prose p").first()).toBeVisible();
    expect(pageErrors).toEqual([]);
  });
});
