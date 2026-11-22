import { expect, test } from "@playwright/test";
import { setupMockApi } from "./fixtures/mock-data.js";

test.describe("フェア棚＆読書コース導線・連続通読", () => {
  test.beforeEach(async ({ page }) => {
    await setupMockApi(page);
  });

  test("書架フェア棚からコース詳細・連続通読・完了表示・ナビ往復ができる", async ({ page }) => {
    await page.goto("/");

    const fairShelf = page.locator("#fair-shelf");
    await expect(fairShelf).toBeVisible();
    await expect(fairShelf.locator(".course-card")).toHaveCount(3);
    await expect(page.locator("#fair-shelf-all-link")).toContainText("全4コース");

    // 検索中はフェア棚が自動で隠れ、クリアで再表示される
    await page.locator("#search-filter").fill("水時計");
    await expect(fairShelf).toBeHidden();
    await page.locator("#search-filter").fill("");
    await expect(fairShelf).toBeVisible();

    // 代表コースをクリックして /courses/:courseId へ遷移
    await fairShelf
      .locator(".course-card[data-course-id='mock_beginner_course'] .course-primary-link")
      .click();
    await expect(page).toHaveURL(/\/courses\/mock_beginner_course$/);
    await expect(page.locator("body")).toHaveAttribute("data-view", "courses");
    await expect(page.locator(".course-detail-title")).toHaveText("まずはこれ！騎士と魔女の記録");
    await expect(page.locator("#course-primary-cta")).toContainText("第1話から読む");

    // 主要 CTA で第1話へ（?course= 付き）
    await page.locator("#course-primary-cta").click();
    await expect(page).toHaveURL(/\/story\/mock_elegy\?course=mock_beginner_course$/);
    await expect(page.locator("body")).toHaveAttribute("data-view", "reader");
    await expect(page.locator("#reader-course-banner")).toContainText("第1話 / 全2話");
    await expect(page.locator("#back-to-shelf-btn")).toHaveText("← 書架へ戻る");

    // 第1話を読了にして、章末の次話カードから第2話へ連続遷移
    await page.locator(".reader-state-bar .reader-read-btn").click();
    const nextCard = page.locator('[data-action="course-next-story"]');
    await expect(nextCard).toContainText("燃え盛る炎の魔女（テスト版）");
    await nextCard.click();

    await expect(page).toHaveURL(/\/story\/mock_witch\?course=mock_beginner_course$/);
    await expect(page.locator("#reader-course-banner")).toContainText("第2話 / 全2話");

    // 最終話を読了にすると、コース読破完了カードが表示される
    await page.locator(".reader-state-bar .reader-read-btn").click();
    await expect(page.locator('[data-course-completed="true"]')).toContainText("全話読破しました");

    // 「他の読書コースを見る」から /courses 一覧へ遷移し、種別フィルタとナビ往復が機能する
    await page.locator('[data-course-completed="true"] a', { hasText: "他の読書コースを見る" }).click();
    await expect(page).toHaveURL(/\/courses$/);
    await expect(page.locator("#courses-view .course-card")).toHaveCount(4);
    await expect(
      page.locator(".course-card[data-course-id='mock_beginner_course'] .course-completed-badge")
    ).toHaveText("✦ 読破");

    await page.locator('[data-course-filter="character"]').click();
    await expect(page.locator("#courses-view .course-card")).toHaveCount(1);

    // ヘッダー常設ナビから書架へ戻る
    await page.locator("#courses-site-nav [data-nav-target='shelf']").click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator("body")).toHaveAttribute("data-view", "shelf");
  });

  test("単品アクセス時は上部コースバーが出ず、章末に所属コース一覧が表示される", async ({ page }) => {
    await page.goto("/story/mock_elegy");
    await expect(page.locator(".reader-title")).toHaveText("終焉を嘆く詩（テスト版）");
    await expect(page.locator("#reader-course-banner")).toHaveCount(0);

    const courseNav = page.locator("#course-nav-container");
    await expect(courseNav).toContainText("この物語が収録されている読書コース");
    await expect(courseNav.locator("[data-course-id='mock_beginner_course']")).toBeVisible();
  });
});
