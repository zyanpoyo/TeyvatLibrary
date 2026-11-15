import { escapeHtml, formatRegion } from "../utils/html.js";
import { SHELF_CATEGORIES, getCategoryEmblem } from "../utils/category.js";

export function getStoryHash(storyId) {
  return `#story/${encodeURIComponent(storyId)}`;
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

export function filterStories(stories, filters) {
  const query = (filters.query || "").trim().toLowerCase();
  return (stories || []).filter((story) => {
    if (filters.category !== "all" && story.shelfCategory !== filters.category) {
      return false;
    }
    if (filters.entityId && !(story.entityIds || []).includes(filters.entityId)) {
      return false;
    }
    if (filters.region && !(story.region || []).includes(filters.region)) {
      return false;
    }
    if (query) {
      const haystack = [
        story.title,
        story.hook,
        story.era,
        story.categoryLabel,
        ...(story.region || []),
        ...(story.tags || []),
      ].join(" ").toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

export function renderShelf({ storyGrid, resultSummaryEl, indexData, filters }) {
  const stories = indexData?.stories || [];
  const filtered = filterStories(stories, filters);

  if (resultSummaryEl) {
    const hasSubFilter = Boolean(filters.entityId || filters.region || (filters.query || "").trim());
    resultSummaryEl.textContent = hasSubFilter
      ? `${filtered.length} 件の作品が一致しました（全 ${stories.length} 作品）`
      : `全 ${filtered.length} 作品を表示中`;
  }

  if (filtered.length === 0) {
    const isUnpopulatedAttire =
      filters.category === "attire" &&
      !filters.entityId &&
      !filters.region &&
      !(filters.query || "").trim();

    storyGrid.innerHTML = `
      <div class="shelf-empty-state">
        <p class="shelf-empty-title">✦ ${isUnpopulatedAttire ? "準備中のカテゴリーです" : "条件に一致する物語が見つかりません"}</p>
        <p class="shelf-empty-desc">${
          isUnpopulatedAttire
            ? "「風の翼」の収録作品は今後のアップデートで追加予定です。"
            : "カテゴリーや登場人物・地域・検索語句の条件を変更してお試しください。"
        }</p>
        <button type="button" class="control-pill" data-action="reset-filters">条件をリセットしてすべて表示</button>
      </div>
    `;
    return;
  }

  storyGrid.innerHTML = filtered.map((story, idx) => {
    const isFeatured = idx === 0 && filters.category === "all" && !filters.entityId && !filters.region && !(filters.query || "").trim();
    const emblem = getCategoryEmblem(story.shelfCategory);
    const regionLabel = formatRegion(story.region);
    return `
      <a class="story-card${isFeatured ? " is-featured" : ""}" href="${getStoryHash(story.id)}" data-story-id="${escapeHtml(story.id)}">
        <div>
          ${!isFeatured ? `<div class="card-emblem-center">${emblem}</div>` : ""}
          <div class="card-top-row">
            <div class="card-meta-top">
              ${isFeatured ? `<span class="card-emblem">${emblem}</span>` : ""}
              <span class="category-badge">${escapeHtml(story.categoryLabel)}</span>
              <span>⏱ ${escapeHtml(story.readingTime)} ・ ${escapeHtml(regionLabel)}</span>
            </div>
          </div>
          <h2 class="card-title">${escapeHtml(story.title)}</h2>
          <p class="card-hook">${escapeHtml(story.hook)}</p>
        </div>
        <div class="card-tags">
          ${(story.tags || []).map((t) => `<span class="tag-chip">#${escapeHtml(t)}</span>`).join("")}
        </div>
      </a>
    `;
  }).join("");
}
