import { expect, test } from "@playwright/test";
import { setupMockApi } from "./fixtures/mock-data.js";

test.describe("リーダーの読書補助UIとモバイル表示", () => {
  test.beforeEach(async ({ page }) => {
    await setupMockApi(page);
  });

  test("前提ガイド・小見出し・章末補足・章目次・真相メモが正しく機能する", async ({ page }) => {
    await page.goto("/#story/mock_byakuyakoku");

    await expect(page.locator(".pre-guide-list li")).toHaveCount(2);
    await expect(page.locator(".prose-subhead")).toContainText("【鳩が枝を運んだ年】");
    await expect(page.locator(".chapter-note-box")).toContainText("淵下宮特有の紀年法が記されている。");

    // 複数章では章目次が表示され、第2章ピルでスクロール移動できる
    await expect(page.locator("#chapter-toc")).toBeVisible();
    await expect(page.locator("#chapter-toc .toc-pill")).toHaveCount(2);
    await page.locator('#chapter-toc .toc-pill[href="#chapter-2"]').click();
    await expect.poll(async () => page.evaluate(() => window.scrollY)).toBeGreaterThan(200);

    // 真相・考察メモ（<details>）を展開できる
    const details = page.locator("details.lore-details");
    await expect(details).not.toHaveAttribute("open", "");
    await details.locator("summary").click();
    await expect(details).toHaveAttribute("open", "");
    await expect(details.locator(".lore-details-body")).toContainText("オロバシは民を守るために");
    await expect(details.locator(".lore-game-effect")).toContainText("ゲーム内書籍シリーズ");

    // 単一章の作品では章目次が非表示になる
    await page.goto("/#story/mock_elegy");
    await expect(page.locator("#chapter-toc")).toBeHidden();
  });

  test("インライン用語ガイドの開閉と用語ガイドON/OFFトグルが動作する", async ({ page }) => {
    await page.goto("/#story/mock_witch");

    const termBtn = page.locator(".glossary-term").first();
    const popover = page.locator("#pop-mock_witch-cw_lover");

    await termBtn.click();
    await expect(popover).toBeVisible();
    await expect(popover).toContainText("西風騎士団の副団長「ルースタン」");

    await popover.locator(".popover-close").click();
    await expect(popover).toBeHidden();

    // 用語ガイドをOFFにするとバッジが非表示になり、data-annotations="off" になる
    const toggleBtn = page.locator("#toggle-annotations-btn");
    await expect(toggleBtn).toHaveAttribute("aria-pressed", "true");
    await toggleBtn.click();

    await expect(toggleBtn).toHaveAttribute("aria-pressed", "false");
    await expect(toggleBtn).toContainText("用語ガイド OFF");
    await expect(page.locator("#reader-view")).toHaveAttribute("data-annotations", "off");
    await expect(page.locator(".glossary-badge").first()).toBeHidden();

    // 再度ONに戻せる
    await toggleBtn.click();
    await expect(toggleBtn).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#reader-view")).toHaveAttribute("data-annotations", "on");
    await expect(page.locator(".glossary-badge").first()).toBeVisible();
  });

  test("モバイルビューポート（390x844）でも書架・リーダー・ボトムシート型用語ガイドが操作できる", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    await expect(page.locator("#story-grid .story-card")).toHaveCount(3);
    await page.locator("#search-filter").fill("炎の魔女");
    await expect(page.locator("#story-grid .story-card")).toHaveCount(1);

    await page.locator(".story-card[data-story-id='mock_witch'] .card-primary-link").click();
    await expect(page.locator("body")).toHaveAttribute("data-view", "reader");

    await page.locator(".glossary-term").first().click();
    const popover = page.locator("#pop-mock_witch-cw_lover");
    await expect(popover).toBeVisible();
    await popover.locator(".popover-close").click();
    await expect(popover).toBeHidden();
  });
});
