import { expect, test } from "@playwright/test";
import { setupMockApi } from "./fixtures/mock-data.js";

test.describe("画面遷移・ルーティング・位置復元", () => {
  test.beforeEach(async ({ page }) => {
    await setupMockApi(page);
  });

  test("カードからリーダーへ遷移し、書架へ戻るボタンとブラウザ履歴で往復できる", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#story-grid .story-card")).toHaveCount(3);

    await page.locator(".story-card[data-story-id='mock_witch'] .card-primary-link").click();

    await expect(page.locator("body")).toHaveAttribute("data-view", "reader");
    await expect(page).toHaveURL(/#\/story\/mock_witch$/);
    await expect(page).toHaveTitle(/燃え盛る炎の魔女（テスト版）/);
    await expect(page.locator("#shelf-view")).toHaveCount(0);
    await expect(page.locator("#reader-view")).toBeVisible();
    await expect(page.locator(".reader-title")).toHaveText("燃え盛る炎の魔女（テスト版）");

    // 「← 書架へ戻る」で復帰するとフォーカスが元のカードリンクに戻る
    await page.locator("#back-to-shelf-btn").click();
    await expect(page.locator("body")).toHaveAttribute("data-view", "shelf");
    await expect(page).not.toHaveURL(/#\/?story\//);
    await expect(page.locator("#reader-view")).toHaveCount(0);
    await expect(
      page.locator(".story-card[data-story-id='mock_witch'] .card-primary-link")
    ).toBeFocused();

    // ブラウザの進む・戻るでも同期する
    await page.goForward();
    await expect(page.locator("body")).toHaveAttribute("data-view", "reader");
    await expect(page).toHaveURL(/#\/story\/mock_witch$/);

    await page.goBack();
    await expect(page.locator("body")).toHaveAttribute("data-view", "shelf");
  });

  test("書架のスクロール位置がリーダー遷移とブラウザバック後に復元される", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 480 });
    await page.goto("/");
    await expect(page.locator("#story-grid .story-card")).toHaveCount(3);

    const targetLink = page.locator("#story-grid .story-card").last().locator(".card-primary-link");
    await page.evaluate(() => window.scrollTo(0, 320));
    await targetLink.scrollIntoViewIfNeeded();
    const savedY = await page.evaluate(() => window.scrollY);
    expect(savedY).toBeGreaterThan(200);

    await targetLink.click();
    await expect(page.locator("body")).toHaveAttribute("data-view", "reader");
    expect(await page.evaluate(() => window.scrollY)).toBe(0);

    await page.locator("#back-to-shelf-btn").click();
    await expect(page.locator("body")).toHaveAttribute("data-view", "shelf");
    const restoredY = await page.evaluate(() => window.scrollY);
    expect(Math.abs(restoredY - savedY)).toBeLessThanOrEqual(10);

    // ブラウザの「進む」でリーダーへ再遷移し、「戻る」で書架へ戻ってもスクロール位置とフォーカスが失われない
    await page.goForward();
    await expect(page.locator("body")).toHaveAttribute("data-view", "reader");
    expect(await page.evaluate(() => window.scrollY)).toBe(0);

    await page.goBack();
    await expect(page.locator("body")).toHaveAttribute("data-view", "shelf");
    const restoredAfterForwardBackY = await page.evaluate(() => window.scrollY);
    expect(Math.abs(restoredAfterForwardBackY - savedY)).toBeLessThanOrEqual(10);
    await expect(targetLink).toBeFocused();
  });

  test("URLハッシュ直アクセスでリーダーが開き、無効IDは書架へフォールバックする", async ({ page }) => {
    await page.goto("/#story/mock_byakuyakoku");
    await expect(page.locator("body")).toHaveAttribute("data-view", "reader");
    await expect(page.locator(".reader-title")).toHaveText("白夜国館蔵（テスト版）");

    await page.goto("/#story/unknown_story_id");
    await expect(page.locator("body")).toHaveAttribute("data-view", "shelf");
    await expect(page.locator("#story-grid .story-card")).toHaveCount(3);
  });

  test("関連作品カードおよび用語ガイド内の出典リンクから別作品へ連続遷移できる", async ({ page }) => {
    await page.goto("/#story/mock_witch");
    await expect(page.locator(".reader-title")).toHaveText("燃え盛る炎の魔女（テスト版）");

    // 章末の関連作品リンクから mock_elegy へ遷移
    await page.locator(".connected-item[data-target-id='mock_elegy']").click();
    await expect(page).toHaveURL(/#\/story\/mock_elegy$/);
    await expect(page.locator(".reader-title")).toHaveText("終焉を嘆く詩（テスト版）");

    // 用語ガイド（Dialog）を開き、出典リンクから mock_witch へ遷移（同時にダイアログが閉じる）
    await page.locator(".glossary-term").first().click();
    const popover = page.locator("#pop-mock_elegy-el_knight");
    await expect(popover).toBeVisible();

    await popover.locator(".evidence-link[data-target-id='mock_witch']").click();
    await expect(page).toHaveURL(/#\/story\/mock_witch$/);
    await expect(page.locator(".reader-title")).toHaveText("燃え盛る炎の魔女（テスト版）");
    await expect(popover).toHaveCount(0);
  });
});
