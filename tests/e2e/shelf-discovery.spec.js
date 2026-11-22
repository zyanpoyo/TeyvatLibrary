import { expect, test } from "@playwright/test";
import { createMockDataset, setupMockApi } from "./fixtures/mock-data.js";

test.describe("書架の探索・フィルタリング・並び替え", () => {
  test.beforeEach(async ({ page }) => {
    await setupMockApi(page);
    await page.goto("/");
    await expect(page.locator("#story-grid .story-card")).toHaveCount(3);
  });

  test("初期表示で作品カード・件数バッジ・日替わりピックアップ・NEWバッジが描画される", async ({ page }) => {
    await expect(page.locator(".category-tab[data-filter='all'] .tab-count")).toHaveText("3");
    await expect(page.locator(".category-tab[data-filter='book'] .tab-count")).toHaveText("1");
    await expect(page.locator(".category-tab[data-filter='artifact'] .tab-count")).toHaveText("1");
    await expect(page.locator(".category-tab[data-filter='weapon'] .tab-count")).toHaveText("1");
    await expect(page.locator(".category-tab[data-filter='attire'] .tab-count")).toHaveText("0");

    await expect(page.locator("#filter-result-summary")).toContainText("全 3 作品を表示中");
    await expect(page.locator("#filter-result-summary")).toContainText("0 / 3 篇 読了");

    const featuredCards = page.locator("#story-grid .story-card.is-featured");
    await expect(featuredCards).toHaveCount(1);
    await expect(page.locator("#story-grid .story-card").first()).toHaveClass(/is-featured/);
    await expect(featuredCards.locator(".featured-badge")).toContainText("今日の物語ピックアップ");

    const newCards = page.locator("#story-grid .story-card .new-badge");
    await expect(newCards).toHaveCount(1);
    await expect(
      page.locator(".story-card[data-story-id='mock_witch'] .new-badge")
    ).toHaveText("NEW");
  });

  test("カテゴリータブで絞り込みができ、0件のタブでは統一空状態メッセージが表示される", async ({ page }) => {
    await page.locator(".category-tab[data-filter='artifact']").click();
    await expect(page.locator(".category-tab[data-filter='artifact']")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#filter-result-summary")).toContainText("1 件の作品が一致しました（全 3 作品）");
    await expect(page.locator("#story-grid .story-card")).toHaveCount(1);
    await expect(page.locator("#story-grid .story-card").first()).toHaveAttribute("data-story-id", "mock_witch");

    await page.locator(".category-tab[data-filter='attire']").click();
    await expect(page.locator("#filter-result-summary")).toContainText("0 件の作品が一致しました（全 3 作品）");
    await expect(page.locator("#story-grid .story-card")).toHaveCount(0);
    await expect(page.locator(".shelf-empty-title")).toContainText("条件に一致する物語が見つかりません");
    await expect(page.locator(".shelf-empty-desc")).toContainText("登場人物・用語");

    await page.locator(".category-tab[data-filter='all']").click();
    await expect(page.locator("#filter-result-summary")).toContainText("全 3 作品を表示中");
  });

  test("登場人物・用語、地域、キーワードで絞り込み、0件時に条件リセットで全件に戻せる", async ({ page }) => {
    await page.locator("#entity-filter").selectOption("orobashi");
    await expect(page.locator("#story-grid .story-card")).toHaveCount(1);
    await expect(page.locator("#story-grid .story-card").first()).toHaveAttribute("data-story-id", "mock_byakuyakoku");
    await expect(page.locator("#filter-result-summary")).toContainText("1 件の作品が一致しました（全 3 作品）");

    await page.locator("#entity-filter").selectOption("");
    await page.locator("#region-filter").selectOption("スメール");
    await expect(page.locator("#story-grid .story-card")).toHaveCount(1);
    await expect(page.locator("#story-grid .story-card").first()).toHaveAttribute("data-story-id", "mock_witch");

    await page.locator("#region-filter").selectOption("");
    await page.locator("#search-filter").fill("騎士の最期");
    await expect(page.locator("#story-grid .story-card")).toHaveCount(1);
    await expect(page.locator("#story-grid .story-card").first()).toHaveAttribute("data-story-id", "mock_elegy");

    await page.locator("#search-filter").fill("該当しない検索クエリ");
    await expect(page.locator("#story-grid .story-card")).toHaveCount(0);
    await expect(page.locator(".shelf-empty-title")).toContainText("条件に一致する物語が見つかりません");

    await page.locator('[data-action="reset-filters"]').click();
    await expect(page.locator("#story-grid .story-card")).toHaveCount(3);
    await expect(page.locator("#search-filter")).toHaveValue("");
  });

  test("並び順（新着順・短い順）でカードの順序が切り替わる", async ({ page }) => {
    await page.locator("#sort-filter").selectOption("newest");
    const newestIds = await page
      .locator("#story-grid .story-card")
      .evaluateAll((els) => els.map((el) => el.dataset.storyId));
    expect(newestIds).toEqual(["mock_witch", "mock_byakuyakoku", "mock_elegy"]);

    await page.locator("#sort-filter").selectOption("shortest");
    const shortestIds = await page
      .locator("#story-grid .story-card")
      .evaluateAll((els) => els.map((el) => el.dataset.storyId));
    expect(shortestIds).toEqual(["mock_elegy", "mock_witch", "mock_byakuyakoku"]);
  });

  test("おまかせ読書ボタンが未読短編へ遷移し、全件読了時はラベルが切り替わる", async ({ page }) => {
    const randomBtn = page.locator("#random-story-btn");
    await expect(randomBtn).toContainText("未読から1篇読む");

    await randomBtn.click();
    await expect(page.locator("body")).toHaveAttribute("data-view", "reader");
    expect(["/story/mock_witch", "/story/mock_elegy"]).toContain(new URL(page.url()).pathname);

    // 全作品を読了済みに設定してリロード
    const dataset = createMockDataset();
    const readStories = Object.fromEntries(
      dataset.storiesIndex.stories.map((s) => [s.id, { readAt: new Date().toISOString() }])
    );
    await page.evaluate((payload) => {
      localStorage.setItem("genshin-books-reading-state-v1", JSON.stringify(payload));
    }, { readStories, bookmarks: [], lastSession: null });

    await page.goto("/");
    await expect(page.locator("#random-story-btn")).toContainText("おまかせで1篇読む");
  });

  test("本文横断検索・動的タブ件数・真相メモトグル・スニペットからリーダー着地とURL同期ができる", async ({ page }) => {
    // 1. 本文フレーズ＋クロスフィールドAND検索（タグ: ロザリン × 本文: 水時計）
    await page.locator("#search-filter").fill("ろざりん 水時計");
    await expect(page.locator("#story-grid .story-card")).toHaveCount(1);
    await expect(page.locator("#story-grid .story-card").first()).toHaveAttribute("data-story-id", "mock_witch");
    await expect(page).toHaveURL(/\/\?q=/);

    // 検索中はカテゴリータブ件数がヒット件数へ動的更新される
    await expect(page.locator(".category-tab[data-filter='all'] .tab-count")).toHaveText("1");
    await expect(page.locator(".category-tab[data-filter='artifact'] .tab-count")).toHaveText("1");
    await expect(page.locator(".category-tab[data-filter='book'] .tab-count")).toHaveText("0");

    // リロードしてもURLクエリから検索結果が復元される
    await page.reload();
    await expect(page.locator("#search-filter")).toHaveValue("ろざりん 水時計");
    await expect(page.locator("#story-grid .story-card")).toHaveCount(1);

    // 別カテゴリー選択時は他カテゴリー一致への誘導が出ること
    await page.locator(".category-tab[data-filter='book']").click();
    await expect(page.locator("#story-grid .story-card")).toHaveCount(0);
    await page.locator('[data-action="switch-all-category"]').click();
    await expect(page.locator("#story-grid .story-card")).toHaveCount(1);

    // 2. スニペットクリックでリーダー該当箇所へ着地しハイライト＆自動読了しない
    const chapterSnippet = page.locator(".search-snippet-btn").first();
    await expect(chapterSnippet).toBeVisible();
    await chapterSnippet.click();

    await expect(page.locator("body")).toHaveAttribute("data-view", "reader");
    await expect(page).toHaveURL(/\/story\/mock_witch\?q=/);
    await expect(page.locator("#reader-view mark").first()).toBeVisible();
    await expect(page.locator(".reader-read-btn").first()).toHaveAttribute("aria-pressed", "false");

    // 「← 書架へ戻る」で検索結果状態へ復帰
    await page.locator("#back-to-shelf-btn").click();
    await expect(page.locator("body")).toHaveAttribute("data-view", "shelf");
    await expect(page.locator("#search-filter")).toHaveValue("ろざりん 水時計");

    // 3. 未読の真相メモ内語句はデフォルトOFFでは非ヒット、トグルONでヒット＆自動展開
    await page.locator("#search-filter").fill("執行官第八位");
    await expect(page.locator("#story-grid .story-card")).toHaveCount(0);

    await page.locator("#truth-search-toggle").click();
    await expect(page.locator("#truth-search-toggle")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#story-grid .story-card")).toHaveCount(1);

    await page.locator(".search-snippet-btn[data-snippet-kind='truth']").click();
    await expect(page.locator("body")).toHaveAttribute("data-view", "reader");
    await expect(page.locator("details.lore-details")).toHaveAttribute("open", "");
    await expect(page.locator(".reader-read-btn").first()).toHaveAttribute("aria-pressed", "false");
  });
});
