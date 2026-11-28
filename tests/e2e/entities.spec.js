import { expect, test } from "@playwright/test";
import { setupMockApi } from "./fixtures/mock-data.js";

test.describe("人物・用語名鑑とクロスリンク導線", () => {
  test.beforeEach(async ({ page }) => {
    await setupMockApi(page);
  });

  test("常設ナビから名鑑一覧・絞り込み・詳細・出典/作品遷移・共起人物回遊・読了同期が動作する", async ({
    page,
  }) => {
    await page.goto("/");

    // 常設ナビから /entities へ遷移
    await page.locator("#shelf-site-nav [data-nav-target='entities']").click();
    await expect(page).toHaveURL(/\/entities$/);
    await expect(page.locator("body")).toHaveAttribute("data-view", "entities");
    await expect(page.locator("#entities-spoiler-notice")).toContainText(
      "物語の核心や正体に関する記述を含みます"
    );
    await expect(page.locator("#entities-view .entity-card")).toHaveCount(3);

    // 0件種別はピルに表示されない
    await expect(page.locator('[data-entity-filter="character"]')).toBeVisible();
    await expect(page.locator('[data-entity-filter="god"]')).toBeVisible();
    await expect(page.locator('[data-entity-filter="organization"]')).toHaveCount(0);

    // 日本語正規化＋ANDキーワード絞り込み（ひらがな検索でカタカナ一致＋漢字AND）
    await page.locator("#entities-search-input").fill("ふぁでゅい 魔女");
    await expect(page.locator("#entities-view .entity-card")).toHaveCount(1);
    await expect(page.locator(".entity-card[data-entity-id='rosalyne']")).toBeVisible();

    await page.locator("#entities-reset-btn").click();
    await expect(page.locator("#entities-view .entity-card")).toHaveCount(3);

    // 五十音順並び替え
    await page.locator("#entities-sort-select").selectOption("name");
    const orderedIds = await page
      .locator('[data-entity-group="character"] .entity-card')
      .evaluateAll((els) => els.map((el) => el.getAttribute("data-entity-id")));
    expect(orderedIds).toEqual(["rostam", "rosalyne"]);

    // ロザリン詳細へ遷移
    await page.locator(".entity-card[data-entity-id='rosalyne'] .entity-primary-link").click();
    await expect(page).toHaveURL(/\/entities\/rosalyne$/);
    await expect(page.locator("body")).toHaveAttribute("data-view", "entities");
    await expect(page.locator(".entity-detail-title")).toHaveText("ロザリン（淑女）");
    await expect(page.locator("#entity-detail-progress")).toContainText("登場 2 篇中 0 篇 読了");

    // 出典リンクからリーダーへ遷移し、読了マーク後に戻ると進捗が更新される
    await page.locator('#entity-detail-evidence a[data-target-id="mock_witch"]').click();
    await expect(page).toHaveURL(/\/story\/mock_witch$/);
    await expect(page.locator("body")).toHaveAttribute("data-view", "reader");

    await page.locator(".reader-state-bar .reader-read-btn").click();
    await page.goBack();
    await expect(page).toHaveURL(/\/entities\/rosalyne$/);
    await expect(page.locator("#entity-detail-progress")).toContainText("登場 2 篇中 1 篇 読了");
    await expect(page.locator("#entity-primary-cta")).toContainText("次の未読作品を読む");

    // 同じ物語に登場する人物・用語チップからルースタンへ横遷移
    await page.locator(".entity-related-chip[data-entity-id='rostam']").click();
    await expect(page).toHaveURL(/\/entities\/rostam$/);
    await expect(page.locator(".entity-detail-title")).toHaveText("ルースタン");
  });

  test("書架の人物絞り込みリンク・用語ガイド・真相メモチップから名鑑詳細へ遷移できる", async ({
    page,
  }) => {
    // 1. 書架の登場人物フィルタ選択時に名鑑リンクが表示される
    await page.goto("/");
    await expect(page.locator("#shelf-entity-archive-link")).toHaveCount(0);

    await page.locator("#entity-filter").selectOption("orobashi");
    const shelfEntityLink = page.locator("#shelf-entity-archive-link");
    await expect(shelfEntityLink).toContainText("「オロバシ」を人物・用語名鑑で見る");
    await shelfEntityLink.click();

    await expect(page).toHaveURL(/\/entities\/orobashi$/);
    await expect(page.locator(".entity-detail-title")).toHaveText("オロバシ");

    // 2. リーダーの用語ガイドダイアログから名鑑詳細へ遷移
    await page.goto("/story/mock_elegy");
    await page.locator('[data-term-id="el_knight"]').click();
    const glossaryLink = page.locator(".glossary-entity-link");
    await expect(glossaryLink).toBeVisible();
    await glossaryLink.click();

    await expect(page).toHaveURL(/\/entities\/rostam$/);
    await expect(page.locator(".entity-detail-title")).toHaveText("ルースタン");

    // 3. リーダーの真相・考察メモ内チップから名鑑詳細へ遷移
    await page.locator("#entity-stories-list .entity-story-link").first().click();
    await expect(page).toHaveURL(/\/story\/mock_byakuyakoku|\/story\/mock_witch|\/story\/mock_elegy/);

    await page.locator("details.lore-details summary").click();
    const loreChip = page.locator(".lore-entity-chip[data-entity-id='rosalyne']");
    await expect(loreChip).toBeVisible();
    await loreChip.click();
    await expect(page).toHaveURL(/\/entities\/rosalyne$/);
    await expect(page.locator(".entity-detail-title")).toHaveText("ロザリン（淑女）");
  });
});
