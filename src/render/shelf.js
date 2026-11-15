import { escapeHtml, formatRegion } from "../utils/html.js";
import { SHELF_CATEGORIES, getCategoryEmblem } from "../utils/category.js";

export const SHORT_STORY_MAX_CHARS = 1800;
export const NEW_BADGE_DAYS = 14;

export function getStoryHash(storyId) {
  return `#story/${encodeURIComponent(storyId)}`;
}

export function getLocalDateKey(now = new Date()) {
  const y = String(now.getFullYear());
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseIsoDateUtcMs(dateStr) {
  if (typeof dateStr !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return null;
  }
  const [y, m, d] = dateStr.split("-").map(Number);
  const utcMs = Date.UTC(y, m - 1, d);
  const dt = new Date(utcMs);
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    return null;
  }
  return utcMs;
}

function hashDateSeed(dateKey) {
  let hash = 2166136261;
  for (let i = 0; i < dateKey.length; i += 1) {
    hash ^= dateKey.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function isNewStory(story, readingState = null, now = new Date()) {
  if (!story?.addedAt || readingState?.isRead(story.id)) return false;
  const addedUtcMs = parseIsoDateUtcMs(story.addedAt);
  if (addedUtcMs === null) return false;
  const todayUtcMs = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.floor((todayUtcMs - addedUtcMs) / 86400000);
  return diffDays >= 0 && diffDays <= NEW_BADGE_DAYS;
}

export function isDefaultShelfState(filters) {
  return (
    filters.category === "all" &&
    (!filters.status || filters.status === "all") &&
    !filters.entityId &&
    !filters.region &&
    !(filters.query || "").trim() &&
    (!filters.sort || filters.sort === "recommended")
  );
}

export function selectFeaturedStoryId(stories, readingState = null, now = new Date()) {
  const list = stories || [];
  if (list.length === 0) return null;
  const unread = list.filter((s) => !readingState?.isRead(s.id));
  const pool = (unread.length > 0 ? unread : list)
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id));
  const seed = hashDateSeed(getLocalDateKey(now));
  return pool[seed % pool.length].id;
}

export function sortStories(stories, sortMode = "recommended") {
  const list = (stories || []).slice();
  if (sortMode === "newest") {
    return list.sort((a, b) => {
      const aMs = parseIsoDateUtcMs(a.addedAt);
      const bMs = parseIsoDateUtcMs(b.addedAt);
      if (aMs === null && bMs === null) return 0;
      if (aMs === null) return 1;
      if (bMs === null) return -1;
      return bMs - aMs;
    });
  }
  if (sortMode === "shortest") {
    return list.sort((a, b) => {
      const aCount = typeof a.charCount === "number" ? a.charCount : Infinity;
      const bCount = typeof b.charCount === "number" ? b.charCount : Infinity;
      return aCount - bCount;
    });
  }
  return list;
}

function arrangeShelfStories(filteredStories, allStories, filters, readingState, now) {
  const sorted = sortStories(filteredStories, filters.sort);
  if (!isDefaultShelfState(filters) || sorted.length === 0) {
    return { ordered: sorted, featuredId: null };
  }
  const featuredId = selectFeaturedStoryId(allStories, readingState, now);
  if (!featuredId) {
    return { ordered: sorted, featuredId: null };
  }
  const featuredIdx = sorted.findIndex((s) => s.id === featuredId);
  if (featuredIdx <= 0) {
    return { ordered: sorted, featuredId: featuredIdx === 0 ? featuredId : null };
  }
  const ordered = [
    sorted[featuredIdx],
    ...sorted.slice(0, featuredIdx),
    ...sorted.slice(featuredIdx + 1),
  ];
  return { ordered, featuredId };
}

export function pickRandomStory(stories, readingState = null, excludeStoryId = null, rng = Math.random) {
  const list = stories || [];
  if (list.length === 0) return null;
  const unread = list.filter((s) => !readingState?.isRead(s.id));
  const unreadShort = unread.filter(
    (s) => typeof s.charCount === "number" && s.charCount <= SHORT_STORY_MAX_CHARS
  );
  let pool = unreadShort.length > 0 ? unreadShort : (unread.length > 0 ? unread : list);
  if (excludeStoryId && pool.length > 1) {
    pool = pool.filter((s) => s.id !== excludeStoryId);
  }
  const rawIndex = Math.floor(rng() * pool.length);
  const safeIndex = Math.max(0, Math.min(rawIndex, pool.length - 1));
  return pool[safeIndex] || null;
}

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

export function filterStories(stories, filters, readingState = null) {
  const query = (filters.query || "").trim().toLowerCase();
  const status = filters.status || "all";
  return (stories || []).filter((story) => {
    if (filters.category !== "all" && story.shelfCategory !== filters.category) {
      return false;
    }
    if (status === "unread" && readingState?.isRead(story.id)) {
      return false;
    }
    if (status === "read" && !readingState?.isRead(story.id)) {
      return false;
    }
    if (status === "bookmarked" && !readingState?.isBookmarked(story.id)) {
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
