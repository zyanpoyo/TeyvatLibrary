import { escapeHtml, formatRegion } from "../utils/html.js";
import { SHELF_CATEGORIES, getCategoryEmblem } from "../utils/category.js";
import { getStoryHash } from "../router.js";
import {
  arrangeShelfStories,
  filterStories,
  isNewStory,
} from "../domain/catalog.js";

export function renderRandomReadButton(buttonEl, labelEl, indexData, readingState) {
  if (!buttonEl) return;
  const stories = indexData?.stories || [];
  if (stories.length === 0) {
    buttonEl.disabled = true;
    return;
  }
  buttonEl.disabled = false;
  const validIds = new Set(stories.map((s) => s.id));
  const readCount = readingState ? readingState.getReadCount(validIds) : 0;
  const allRead = readCount >= stories.length;
  const text = allRead ? "おまかせで1篇読む" : "未読から1篇読む";
  if (labelEl) {
    labelEl.textContent = text;
  }
  buttonEl.setAttribute(
    "aria-label",
    allRead ? "全作品からおまかせで1篇開く" : "未読作品からランダムに1篇開く"
  );
}

export function renderCategoryTabs(tabsEl, indexData, activeCategory) {
  const counts = indexData?.categoryCounts || {};
  const totalCount = indexData?.totalCount ?? (indexData?.stories?.length || 0);

  tabsEl.innerHTML = SHELF_CATEGORIES.map((cat) => {
    const count = cat.id === "all" ? totalCount : (counts[cat.id] ?? 0);
    const pressed = cat.id === activeCategory;
    return `
      <button type="button" class="category-tab" data-filter="${cat.id}" aria-pressed="${pressed}">
        <span>${escapeHtml(cat.label)}</span>
        <span class="tab-count" aria-label="${count}件">${count}</span>
      </button>
    `;
  }).join("");
}

export function populateFilterOptions(entitySelect, regionSelect, indexData) {
  if (!indexData) return;

  const entities = Object.entries(indexData.entitiesIndex || {})
    .sort((a, b) => (b[1].storyIds?.length || 0) - (a[1].storyIds?.length || 0));

  entitySelect.innerHTML = `<option value="">登場人物：すべて</option>` +
    entities.map(([id, info]) =>
      `<option value="${escapeHtml(id)}">${escapeHtml(info.name)} (${info.storyIds?.length || 0})</option>`
    ).join("");

  const regionSet = new Set();
  for (const story of indexData.stories || []) {
    for (const r of story.region || []) {
      regionSet.add(r);
    }
  }
  regionSelect.innerHTML = `<option value="">地域：すべて</option>` +
    [...regionSet].map((r) =>
      `<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`
    ).join("");
}

export function renderResumeBanner(containerEl, indexData, readingState) {
  if (!containerEl) return;
  const stories = indexData?.stories || [];
  const validIds = new Set(stories.map((s) => s.id));
  const session = readingState?.getLastSession(validIds);
  const story = session ? stories.find((s) => s.id === session.storyId) : null;

  if (!session || !story) {
    containerEl.hidden = true;
    containerEl.innerHTML = "";
    return;
  }

  const percent = Math.round(session.scrollRatio * 100);
  const chapterCount = story.chapterCount || 1;
  const chapterNum = Math.min(chapterCount, (session.chapterIndex ?? 0) + 1);
  const progressLabel = chapterCount > 1
    ? `第${chapterNum}章（${percent}%）`
    : `（${percent}%）`;

  containerEl.hidden = false;
  containerEl.innerHTML = `
    <div class="resume-banner" role="region" aria-label="前回の続き">
      <a
        class="resume-banner-link"
        href="${getStoryHash(story.id)}"
        data-action="resume-story"
        data-story-id="${escapeHtml(story.id)}"
      >
        <span class="resume-banner-icon" aria-hidden="true">📖</span>
        <span class="resume-banner-text">
          <strong>前回の続き</strong>：『${escapeHtml(story.title)}』${escapeHtml(progressLabel)}から再開する
        </span>
        <span class="resume-banner-cta" aria-hidden="true">続きから読む →</span>
      </a>
      <button
        type="button"
        class="resume-banner-dismiss"
        data-action="dismiss-resume"
        aria-label="再開バナーを閉じる"
      >✕</button>
    </div>
  `;
}

export function renderShelf({
  storyGrid,
  resultSummaryEl,
  indexData,
  filters,
  readingState = null,
  now = new Date(),
}) {
  const stories = indexData?.stories || [];
  const filtered = filterStories(stories, filters, readingState);
  const { ordered, featuredId } = arrangeShelfStories(filtered, stories, filters, readingState, now);
  const validIds = new Set(stories.map((s) => s.id));
  const readCount = readingState ? readingState.getReadCount(validIds) : 0;

  if (resultSummaryEl) {
    const hasSubFilter = Boolean(
      (filters.status && filters.status !== "all") ||
      filters.entityId ||
      filters.region ||
      (filters.query || "").trim()
    );
    const countText = hasSubFilter
      ? `${ordered.length} 件の作品が一致しました（全 ${stories.length} 作品）`
      : `全 ${ordered.length} 作品を表示中`;
    const progressText = `✦ 星図記録：${readCount} / ${stories.length} 篇 読了`;
    resultSummaryEl.innerHTML = `
      <span>${escapeHtml(countText)}</span>
      <span class="summary-sep" aria-hidden="true">・</span>
      <span class="summary-progress">${escapeHtml(progressText)}</span>
    `;
  }

  if (ordered.length === 0) {
    const isUnpopulatedAttire =
      filters.category === "attire" &&
      (!filters.status || filters.status === "all") &&
      !filters.entityId &&
      !filters.region &&
      !(filters.query || "").trim();

    storyGrid.innerHTML = `
      <div class="shelf-empty-state">
        <p class="shelf-empty-title">✦ ${isUnpopulatedAttire ? "準備中のカテゴリーです" : "条件に一致する物語が見つかりません"}</p>
        <p class="shelf-empty-desc">${
          isUnpopulatedAttire
            ? "「風の翼」の収録作品は今後のアップデートで追加予定です。"
            : "カテゴリーや読書状態・登場人物・地域・検索語句の条件を変更してお試しください。"
        }</p>
        <button type="button" class="control-pill" data-action="reset-filters">条件をリセットしてすべて表示</button>
      </div>
    `;
    return;
  }

  storyGrid.innerHTML = ordered.map((story) => {
    const isFeatured = Boolean(featuredId && story.id === featuredId);
    const emblem = getCategoryEmblem(story.shelfCategory);
    const regionLabel = formatRegion(story.region);
    const isRead = Boolean(readingState?.isRead(story.id));
    const isNew = isNewStory(story, readingState, now);
    const isBookmarked = Boolean(readingState?.isBookmarked(story.id));
    return `
      <article class="story-card${isFeatured ? " is-featured" : ""}" data-story-id="${escapeHtml(story.id)}" data-read="${isRead}">
        <div>
          ${!isFeatured ? `<div class="card-emblem-center">${emblem}</div>` : ""}
          <div class="card-top-row">
            <div class="card-meta-top">
              ${isFeatured ? `<span class="card-emblem">${emblem}</span>` : ""}
              ${isFeatured ? `<span class="featured-badge">✦ 今日の物語ピックアップ</span>` : ""}
              <span class="category-badge">${escapeHtml(story.categoryLabel)}</span>
              <span>⏱ ${escapeHtml(story.readingTime)} ・ ${escapeHtml(regionLabel)}</span>
            </div>
            <div class="card-status-actions">
              ${isNew ? `<span class="new-badge">NEW</span>` : ""}
              ${isRead ? `<span class="read-badge">✦ 読了</span>` : ""}
              <button
                type="button"
                class="card-bookmark-btn"
                data-action="toggle-bookmark"
                data-story-id="${escapeHtml(story.id)}"
                aria-pressed="${isBookmarked}"
                aria-label="『${escapeHtml(story.title)}』をあとで読む"
              >
                <span aria-hidden="true">🔖</span>
                <span>あとで読む</span>
              </button>
            </div>
          </div>
          <h2 class="card-title">
            <a class="card-primary-link" href="${getStoryHash(story.id)}">${escapeHtml(story.title)}</a>
          </h2>
          <p class="card-hook">${escapeHtml(story.hook)}</p>
        </div>
        <div class="card-tags">
          ${(story.tags || []).map((t) => `<span class="tag-chip">#${escapeHtml(t)}</span>`).join("")}
        </div>
      </article>
    `;
  }).join("");
}
