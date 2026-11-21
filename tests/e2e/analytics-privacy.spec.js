import { expect, test } from "@playwright/test";
import { setupMockApi } from "./fixtures/mock-data.js";

test.describe("アクセス解析ガードとプライバシー・オプトアウト設定", () => {
  test("通常閲覧および検索操作中に外部の Google Analytics リクエストを送信しない", async ({ page }) => {
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

    await page.locator("#search-filter").fill("魔女");
    await page.locator(".story-card[data-story-id='mock_witch'] .card-primary-link").click();
    await expect(page.locator(".reader-title")).toHaveText("燃え盛る炎の魔女（テスト版）");

    await page.waitForTimeout(200);
    expect(gaRequests).toEqual([]);
  });

  test("フッターから「アクセス解析について」ダイアログを開閉し、オプトアウト設定がリロード・画面遷移後も維持される", async ({
    page,
  }) => {
    await setupMockApi(page);
    await page.goto("/");

    const trigger = page.locator("#privacy-dialog-trigger");
    await expect(trigger).toBeVisible();
    await expect(trigger).toHaveText("アクセス解析について");

    await trigger.click();
    const dialog = page.locator("#privacy-dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("h2")).toHaveText("アクセス解析について");
    await expect(dialog.locator("[data-analytics-status]")).toHaveAttribute(
      "data-analytics-status",
      "disabled_env"
    );

    // Google 公式ポリシーおよびオプトアウトアドオンの外部リンク属性検証
    const externalLinks = dialog.locator("a[target='_blank']");
    await expect(externalLinks).toHaveCount(2);
    await expect(externalLinks.nth(0)).toHaveAttribute(
      "href",
      "https://policies.google.com/technologies/partner-sites?hl=ja"
    );
    await expect(externalLinks.nth(0)).toHaveAttribute("rel", "noopener noreferrer");
    await expect(externalLinks.nth(1)).toHaveAttribute(
      "href",
      "https://tools.google.com/dlpage/gaoptout?hl=ja"
    );
    await expect(externalLinks.nth(1)).toHaveAttribute("rel", "noopener noreferrer");

    // 初期状態は有効(ON)、クリックしてオプトアウト(OFF)へ切り替え
    const toggle = dialog.getByRole("switch", {
      name: "アクセス解析（Google Analytics）を有効にする",
    });
    await expect(toggle).toBeChecked();
    await toggle.click();
    await expect(toggle).not.toBeChecked();

    const storedAfterOff = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("genshin-books-analytics-prefs-v1") || "{}")
    );
    expect(storedAfterOff).toEqual({ optOut: true });

    // 閉じるボタンで閉じた後、再オープンして Esc キーでも閉じられる
    await dialog.locator(".privacy-dialog-close").click();
    await expect(dialog).toHaveCount(0);

    await trigger.click();
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);

    // リロードおよびリーダー画面へ遷移してもオプトアウト設定が保持されている
    await page.reload();
    await page.locator(".story-card[data-story-id='mock_witch'] .card-primary-link").click();
    await expect(page.locator("body")).toHaveAttribute("data-view", "reader");

    await page.locator("#privacy-dialog-trigger").click();
    const readerDialog = page.locator("#privacy-dialog");
    await expect(readerDialog).toBeVisible();
    const readerToggle = readerDialog.getByRole("switch", {
      name: "アクセス解析（Google Analytics）を有効にする",
    });
    await expect(readerToggle).not.toBeChecked();

    // ON に戻すと localStorage も false へ更新される
    await readerToggle.click();
    await expect(readerToggle).toBeChecked();
    const storedAfterOn = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("genshin-books-analytics-prefs-v1") || "{}")
    );
    expect(storedAfterOn).toEqual({ optOut: false });
  });
});
