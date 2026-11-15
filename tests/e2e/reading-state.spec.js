import { expect, test } from "@playwright/test";
import { setupMockApi } from "./fixtures/mock-data.js";

test.describe("読書状態・しおり・再開バナー・スクロール連動", () => {
  test.beforeEach(async ({ page }) => {
    await setupMockApi(page);
  });

  test("書架とリーダーで「あとで読む」「読了」をトグルでき、リロード後も永続化される", async ({ page }) => {
    await page.goto("/");

    // 書架でブックマーク（あとで読む）をONにする
    const bookmarkBtn = page.locator(".story-card[data-story-id='mock_elegy'] .card-bookmark-btn");
    await bookmarkBtn.click();
    await expect(bookmarkBtn).toHaveAttribute("aria-pressed", "true");

    await page.locator("#status-filter").selectOption("bookmarked");
    await expect(page.locator("#story-grid .story-card")).toHaveCount(1);
    await expect(page.locator("#story-grid .story-card").first()).toHaveAttribute("data-story-id", "mock_elegy");

    // リーダー画面に入って読了トグルを押す
    await page.locator(".story-card[data-story-id='mock_elegy'] .card-primary-link").click();
    const topReadBtn = page.locator(".reader-state-bar .reader-read-btn");
    const bottomReadBtn = page.locator(".reader-completion-btn");
    await expect(topReadBtn).toHaveAttribute("aria-pressed", "false");

    await topReadBtn.click();
    await expect(topReadBtn).toHaveAttribute("aria-pressed", "true");
    await expect(bottomReadBtn).toHaveAttribute("aria-pressed", "true");

    // リロード後、書架でも状態が維持されている
    await page.goto("/");
    await expect(page.locator("#filter-result-summary")).toContainText("1 / 3 篇 読了");
    await expect(page.locator(".story-card[data-story-id='mock_elegy'] .read-badge")).toHaveText("✦ 読了");
    await expect(page.locator(".story-card[data-story-id='mock_elegy'] .card-bookmark-btn")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  test("途中スクロールで自動しおりが保存され、再開バナーから位置復元・バナー消去ができる", async ({ page }) => {
    await page.goto("/#story/mock_witch");
    await expect(page.locator(".reader-title")).toHaveText("燃え盛る炎の魔女（テスト版）");

    // mount直後の400ms記録抑制期間が過ぎるまで待機
    await page.waitForTimeout(450);

    // 約45%の位置までスクロール
    const targetY = await page.evaluate(() => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      const y = Math.round(scrollable * 0.45);
      window.scrollTo({ top: y, behavior: "instant" });
      return y;
    });
    expect(targetY).toBeGreaterThan(100);
    await expect(page.locator("#reader-footer-percent")).not.toHaveText("0%");

    // 書架へ戻る（unmountで即座にflush保存される）
    await page.locator("#back-to-shelf-btn").click();
    const resumeBanner = page.locator("#resume-banner-container .resume-banner");
    await expect(resumeBanner).toBeVisible();
    await expect(resumeBanner).toContainText("燃え盛る炎の魔女（テスト版）");

    // リロードしても再開バナーが維持され、クリックで途中位置へ復帰できる
    await page.reload();
    await expect(resumeBanner).toBeVisible();
    await resumeBanner.locator('[data-action="resume-story"]').click();

    await expect(page).toHaveURL(/#\/story\/mock_witch$/);
    await expect
      .poll(async () => page.evaluate(() => window.scrollY))
      .toBeGreaterThan(targetY * 0.7);

    // 書架へ戻り、✕ボタンで再開バナーを消去するとリロード後も表示されない
    await page.locator("#back-to-shelf-btn").click();
    await expect(resumeBanner).toBeVisible();
    await resumeBanner.locator('[data-action="dismiss-resume"]').click();
    await expect(page.locator("#resume-banner-container")).toBeHidden();

    await page.reload();
    await expect(page.locator("#resume-banner-container")).toBeHidden();
  });

  test("90%スクロールと真相メモ展開で自動読了になり、手動未読戻し後は自動読了が抑制される", async ({ page }) => {
    // 1. 90%以上スクロールによる自動読了
    await page.goto("/#story/mock_witch");
    await expect(page.locator(".reader-title")).toHaveText("燃え盛る炎の魔女（テスト版）");
    await page.waitForTimeout(450);

    await page.evaluate(() => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo({ top: scrollable, behavior: "instant" });
    });

    const topReadBtn = page.locator(".reader-state-bar .reader-read-btn");
    await expect(topReadBtn).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#reader-footer-percent")).toHaveText("100%");

    // 手動で未読に戻した直後に再度末尾付近へスクロールしても自動で読了に戻らない
    await topReadBtn.click();
    await expect(topReadBtn).toHaveAttribute("aria-pressed", "false");
    await page.evaluate(() => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo({ top: Math.max(0, scrollable - 20), behavior: "instant" });
    });
    await page.waitForTimeout(150);
    await expect(topReadBtn).toHaveAttribute("aria-pressed", "false");

    // 2. 真相メモ（<details>）展開による自動読了
    await page.goto("/#story/mock_elegy");
    await expect(page.locator(".reader-title")).toHaveText("終焉を嘆く詩（テスト版）");
    await expect(page.locator(".reader-state-bar .reader-read-btn")).toHaveAttribute("aria-pressed", "false");

    await page.locator("details.lore-details summary").click();
    await expect(page.locator(".reader-state-bar .reader-read-btn")).toHaveAttribute("aria-pressed", "true");
  });

  test("リーダーで下スクロールすると操作バーが格納され、上スクロールで再表示される", async ({ page }) => {
    await page.goto("/#story/mock_witch");
    await expect(page.locator(".reader-title")).toHaveText("燃え盛る炎の魔女（テスト版）");

    const navRow = page.locator(".reader-nav-row");
    await expect(navRow).not.toHaveClass(/is-hidden/);

    // 閾値を超えて下方向へスクロール
    await page.evaluate(() => window.scrollTo({ top: 300, behavior: "instant" }));
    await expect(navRow).toHaveClass(/is-hidden/);

    // 上方向へ20px以上スクロールすると再表示
    await page.evaluate(() => window.scrollTo({ top: 200, behavior: "instant" }));
    await expect(navRow).not.toHaveClass(/is-hidden/);
  });
});
