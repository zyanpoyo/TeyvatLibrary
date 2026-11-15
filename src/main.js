import { fetchStoriesIndex, fetchStoryDetail } from "./api/stories.js";
import { createDisplayPrefsState, DISPLAY_PREFS_KEY } from "./state/prefs.js";
import { createReadingState, READING_STATE_KEY } from "./state/reading-state.js";
import { escapeHtml } from "./utils/html.js";
import { pickRandomStory } from "./domain/catalog.js";
import { createRouter } from "./router.js";
import { createReaderSessionTracker } from "./reader/session-tracker.js";
import {
  populateFilterOptions,
  renderCategoryTabs,
  renderRandomReadButton,
  renderResumeBanner,
  renderShelf,
} from "./render/shelf.js";
import { renderStoryReader, updateReaderStateButtons } from "./render/reader.js";

if (!Object.hasOwn(HTMLElement.prototype, "popover")) {
  import("@oddbird/popover-polyfill");
}

const BASE_TITLE = document.title;
const displayPrefsState = createDisplayPrefsState();
const readingState = createReadingState();

if ("scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}

const filters = {
  category: "all",
  status: "all",
  entityId: "",
  region: "",
  query: "",
  sort: "recommended",
};

let indexData = null;
let validStoryIds = new Set();
let annotationsEnabled = true;
let isDisplayPopoverOpen = false;
let activeView = "shelf";
let activeStoryId = null;
let shelfScrollY = 0;
let lastOpenedStoryId = null;
let loadToken = 0;

// Elements
const shelfView = document.getElementById("shelf-view");
const readerView = document.getElementById("reader-view");
const readerNavRow = document.querySelector(".reader-nav-row");
const resumeBannerContainer = document.getElementById("resume-banner-container");
const categoryTabsEl = document.getElementById("category-tabs");
const statusFilterEl = document.getElementById("status-filter");
const entityFilterEl = document.getElementById("entity-filter");
const regionFilterEl = document.getElementById("region-filter");
const searchFilterEl = document.getElementById("search-filter");
const sortFilterEl = document.getElementById("sort-filter");
const randomStoryBtn = document.getElementById("random-story-btn");
const randomStoryBtnLabel = document.getElementById("random-story-btn-label");
const filterResultSummaryEl = document.getElementById("filter-result-summary");
const storyGrid = document.getElementById("story-grid");
const readerHeader = document.getElementById("reader-header");
const chapterToc = document.getElementById("chapter-toc");
const chaptersContainer = document.getElementById("chapters-container");
const connectedContainer = document.getElementById("connected-container");
const popoversContainer = document.getElementById("popovers-container");
const displaySettingsPopover = document.getElementById("display-settings-popover");
const shelfThemeSwitcher = document.getElementById("shelf-theme-switcher");
const displaySettingContainers = [displaySettingsPopover, shelfThemeSwitcher];
const readingProgress = document.getElementById("reading-progress");
const readerFooterStatus = document.getElementById("reader-footer-status");
const readerFooterChapter = document.getElementById("reader-footer-chapter");
const readerFooterPercent = document.getElementById("reader-footer-percent");
const toggleAnnotationsBtn = document.getElementById("toggle-annotations-btn");

function isModifiedClick(event) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
}

function closeOpenPopovers() {
  [...popoversContainer.querySelectorAll("[popover]"), displaySettingsPopover].forEach((el) => {
    if (!el) return;
    try {
      if (el.matches(":popover-open") && typeof el.hidePopover === "function") {
        el.hidePopover();
      }
    } catch {
      el.classList.remove(":popover-open");
    }
  });
}

function syncActiveStoryReaderButtons() {
  if (!activeStoryId) return;
  updateReaderStateButtons(readerView, {
    isRead: readingState.isRead(activeStoryId),
    isBookmarked: readingState.isBookmarked(activeStoryId),
  });
}

const sessionTracker = createReaderSessionTracker({
  elements: {
    readerView,
    readerNavRow,
    chaptersContainer,
    readingProgress,
    readerFooterChapter,
    readerFooterPercent,
  },
  readingState,
  isDisplayPopoverOpen: () => isDisplayPopoverOpen,
  onAutoReadMarked: () => {
    syncActiveStoryReaderButtons();
  },
});

function setViewVisibility(view) {
  const isReader = view === "story";
  document.body.dataset.view = isReader ? "reader" : "shelf";
  shelfView.hidden = isReader;
  shelfView.inert = isReader;
  readerView.hidden = !isReader;
  readerView.inert = !isReader;
  readingProgress.hidden = !isReader;
  readerFooterStatus.hidden = !isReader;
}

function updateShelfView() {
  if (!indexData) return;
  renderResumeBanner(resumeBannerContainer, indexData, readingState);
  renderCategoryTabs(categoryTabsEl, indexData, filters.category);
  renderRandomReadButton(randomStoryBtn, randomStoryBtnLabel, indexData, readingState);
  renderShelf({
    storyGrid,
    resultSummaryEl: filterResultSummaryEl,
    indexData,
    filters,
    readingState,
  });
}

function resetFilters() {
  filters.category = "all";
  filters.status = "all";
  filters.entityId = "";
  regionFilterEl && (regionFilterEl.value = "");
  filters.region = "";
  filters.query = "";
  filters.sort = "recommended";
  if (statusFilterEl) statusFilterEl.value = "all";
  if (entityFilterEl) entityFilterEl.value = "";
  if (searchFilterEl) searchFilterEl.value = "";
  if (sortFilterEl) sortFilterEl.value = "recommended";
  updateShelfView();
}

async function openStory(storyId, { moveFocus = false, restoreScrollRatio = null } = {}) {
  sessionTracker.prepareForStory();
  const token = ++loadToken;
  closeOpenPopovers();

  activeView = "story";
  activeStoryId = storyId;
  setViewVisibility("story");
  window.scrollTo({ top: 0, behavior: "instant" });
  readerHeader.innerHTML = `<p class="loading-status">✦ 星図の記録を読み込んでいます…</p>`;
  chapterToc.hidden = true;
  chaptersContainer.innerHTML = "";
  connectedContainer.hidden = true;
  popoversContainer.innerHTML = "";

  try {
    const story = await fetchStoryDetail(storyId);
    if (token !== loadToken || activeView !== "story" || activeStoryId !== storyId) {
      return;
    }

    renderStoryReader(
      { readerHeader, chapterToc, chaptersContainer, popoversContainer, connectedContainer },
      story,
      readingState
    );
    document.title = `${story.title} | テイワット文庫`;
    sessionTracker.mount(story, {
      restoreScrollRatio,
      isCurrentLoad: () => token === loadToken && activeView === "story" && activeStoryId === storyId,
    });

    if (moveFocus) {
      readerView.focus({ preventScroll: true });
    }
  } catch (err) {
    if (token !== loadToken) return;
    readerHeader.innerHTML = `
      <div class="shelf-empty-state">
        <p class="shelf-empty-title">作品の読み込みに失敗しました</p>
        <p class="shelf-empty-desc">${escapeHtml(err.message)}</p>
        <button type="button" class="control-pill" data-action="retry-story" data-story-id="${escapeHtml(storyId)}">再試行する</button>
      </div>
    `;
  }
}

function showShelf({ restoreFocus = false, restoreScroll = false } = {}) {
  sessionTracker.unmount();
  loadToken++;
  closeOpenPopovers();
  activeView = "shelf";
  activeStoryId = null;
  document.title = BASE_TITLE;
  setViewVisibility("shelf");
  updateShelfView();
  window.scrollTo({ top: restoreScroll ? shelfScrollY : 0, behavior: "instant" });

  if (restoreFocus) {
    const targetLink = lastOpenedStoryId
      ? storyGrid.querySelector(`.story-card[data-story-id="${CSS.escape(lastOpenedStoryId)}"] .card-primary-link`)
      : null;
    if (targetLink) {
      targetLink.focus({ preventScroll: true });
    } else {
      shelfView.focus({ preventScroll: true });
    }
  }
}

const router = createRouter({
  getValidStoryIds: () => validStoryIds,
  getActiveRoute: () => ({ view: activeView, storyId: activeStoryId }),
  onBeforeLeaveShelf: (storyId) => {
    shelfScrollY = window.scrollY;
    lastOpenedStoryId = storyId;
  },
  onOpenStory: openStory,
  onShowShelf: showShelf,
});

// Event Listeners
resumeBannerContainer?.addEventListener("click", (e) => {
  const dismissBtn = e.target.closest('[data-action="dismiss-resume"]');
  if (dismissBtn && resumeBannerContainer.contains(dismissBtn)) {
    readingState.clearLastSession();
    renderResumeBanner(resumeBannerContainer, indexData, readingState);
    return;
  }

  const resumeLink = e.target.closest('[data-action="resume-story"]');
  if (!resumeLink || !resumeBannerContainer.contains(resumeLink)) return;
  if (isModifiedClick(e)) return;
  e.preventDefault();
  const storyId = resumeLink.dataset.storyId;
  const session = readingState.getLastSession(validStoryIds);
  const restoreScrollRatio = session && session.storyId === storyId ? session.scrollRatio : null;
  router.navigateToStory(storyId, { restoreScrollRatio });
});

storyGrid.addEventListener("click", (e) => {
  const resetBtn = e.target.closest('[data-action="reset-filters"]');
  if (resetBtn) {
    resetFilters();
    return;
  }
  const bookmarkBtn = e.target.closest('[data-action="toggle-bookmark"]');
  if (bookmarkBtn && storyGrid.contains(bookmarkBtn)) {
    e.preventDefault();
    const storyId = bookmarkBtn.dataset.storyId;
    if (storyId) {
      readingState.toggleBookmark(storyId);
      updateShelfView();
    }
    return;
  }
  if (isModifiedClick(e)) return;
  const card = e.target.closest(".story-card");
  if (!card || !storyGrid.contains(card)) return;
  e.preventDefault();
  router.navigateToStory(card.dataset.storyId);
});

readerView.addEventListener("click", (e) => {
  const bookmarkBtn = e.target.closest('[data-action="toggle-bookmark"]');
  if (bookmarkBtn && readerView.contains(bookmarkBtn)) {
    const storyId = bookmarkBtn.dataset.storyId || activeStoryId;
    if (!storyId) return;
    readingState.toggleBookmark(storyId);
    syncActiveStoryReaderButtons();
    return;
  }

  const readBtn = e.target.closest('[data-action="toggle-read"]');
  if (readBtn && readerView.contains(readBtn)) {
    const storyId = readBtn.dataset.storyId || activeStoryId;
    if (!storyId) return;
    const nextRead = readingState.toggleRead(storyId);
    sessionTracker.setAutoReadSuppressed(!nextRead);
    if (nextRead) {
      sessionTracker.clearPendingBookmark();
    }
    syncActiveStoryReaderButtons();
  }
});

chaptersContainer.addEventListener("toggle", (e) => {
  const details = e.target;
  if (!details || !details.classList?.contains("lore-details")) return;
  if (details.open && activeView === "story" && activeStoryId && !sessionTracker.isAutoReadSuppressed()) {
    sessionTracker.clearPendingBookmark();
    if (readingState.markRead(activeStoryId)) {
      syncActiveStoryReaderButtons();
    }
  }
}, true);

connectedContainer.addEventListener("click", (e) => {
  if (isModifiedClick(e)) return;
  const item = e.target.closest(".connected-item");
  if (!item || !connectedContainer.contains(item)) return;
  e.preventDefault();
  router.navigateToStory(item.dataset.targetId);
});

popoversContainer.addEventListener("click", (e) => {
  if (isModifiedClick(e)) return;
  const link = e.target.closest(".evidence-link");
  if (!link || !popoversContainer.contains(link)) return;
  e.preventDefault();
  const targetId = link.dataset.targetId;
  if (targetId) {
    closeOpenPopovers();
    router.navigateToStory(targetId);
  }
});

readerHeader.addEventListener("click", (e) => {
  const retryBtn = e.target.closest('[data-action="retry-story"]');
  if (retryBtn) {
    openStory(retryBtn.dataset.storyId, { moveFocus: false });
  }
});

chapterToc.addEventListener("click", (e) => {
  if (isModifiedClick(e)) return;
  const pill = e.target.closest(".toc-pill");
  if (!pill || !chapterToc.contains(pill)) return;
  const targetId = pill.getAttribute("href")?.slice(1);
  const target = targetId ? document.getElementById(targetId) : null;
  if (!target) return;
  e.preventDefault();
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({
    behavior: reduceMotion ? "instant" : "smooth",
    block: "start",
  });
});

categoryTabsEl.addEventListener("click", (e) => {
  const btn = e.target.closest(".category-tab");
  if (!btn || !categoryTabsEl.contains(btn)) return;
  filters.category = btn.dataset.filter;
  updateShelfView();
});

statusFilterEl?.addEventListener("change", () => {
  filters.status = statusFilterEl.value || "all";
  updateShelfView();
});

entityFilterEl?.addEventListener("change", () => {
  filters.entityId = entityFilterEl.value;
  updateShelfView();
});

regionFilterEl?.addEventListener("change", () => {
  filters.region = regionFilterEl.value;
  updateShelfView();
});

searchFilterEl?.addEventListener("input", () => {
  filters.query = searchFilterEl.value;
  updateShelfView();
});

sortFilterEl?.addEventListener("change", () => {
  filters.sort = sortFilterEl.value || "recommended";
  updateShelfView();
});

randomStoryBtn?.addEventListener("click", () => {
  const picked = pickRandomStory(indexData?.stories, readingState, lastOpenedStoryId);
  if (picked) {
    router.navigateToStory(picked.id);
  }
});

router.bindEvents();

document.getElementById("back-to-shelf-btn").addEventListener("click", () => {
  router.navigateToShelf();
});

toggleAnnotationsBtn.addEventListener("click", () => {
  annotationsEnabled = !annotationsEnabled;
  readerView.dataset.annotations = annotationsEnabled ? "on" : "off";
  toggleAnnotationsBtn.setAttribute("aria-pressed", String(annotationsEnabled));
  toggleAnnotationsBtn.innerHTML = `<span>✦ 用語ガイド ${annotationsEnabled ? "ON" : "OFF"}</span>`;
});

displaySettingsPopover.addEventListener("toggle", (event) => {
  isDisplayPopoverOpen = event.newState === "open";
  if (isDisplayPopoverOpen) {
    readerNavRow?.classList.remove("is-hidden");
  }
});

function bindDisplaySettingClicks(container) {
  if (!container) return;
  container.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-setting][data-value]");
    if (!btn || !container.contains(btn)) return;
    const { setting, value } = btn.dataset;
    if (!displayPrefsState.set(setting, value)) return;

    displayPrefsState.apply(displaySettingContainers);
    displayPrefsState.save();
    sessionTracker.refreshProgress({ recordSession: false });
  });
}

bindDisplaySettingClicks(displaySettingsPopover);
bindDisplaySettingClicks(shelfThemeSwitcher);

window.addEventListener("storage", (event) => {
  if (event.key === DISPLAY_PREFS_KEY || event.key === null) {
    displayPrefsState.load();
    displayPrefsState.apply(displaySettingContainers);
    sessionTracker.refreshProgress({ recordSession: false });
  }
  if (event.key === READING_STATE_KEY || event.key === null) {
    readingState.load();
    updateShelfView();
    if (activeView === "story" && activeStoryId) {
      syncActiveStoryReaderButtons();
    }
  }
});

window.addEventListener("pagehide", () => sessionTracker.flush());
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    sessionTracker.flush();
  }
});

window.addEventListener("scroll", () => {
  sessionTracker.handleScroll();
}, { passive: true });

async function init() {
  displayPrefsState.load();
  displayPrefsState.apply(displaySettingContainers);
  readingState.load();

  storyGrid.innerHTML = `<p class="loading-status">✦ 書架データを読み込んでいます…</p>`;

  try {
    indexData = await fetchStoriesIndex();
    validStoryIds = new Set((indexData.stories || []).map((s) => s.id));
    populateFilterOptions(entityFilterEl, regionFilterEl, indexData);
    updateShelfView();

    await router.initInitialRoute({
      getInitialScrollRatio: (storyId) => {
        const savedSession = readingState.getLastSession(validStoryIds);
        return savedSession && savedSession.storyId === storyId
          ? savedSession.scrollRatio
          : null;
      },
    });
  } catch (err) {
    storyGrid.innerHTML = `
      <div class="shelf-empty-state">
        <p class="shelf-empty-title">データの読み込みに失敗しました</p>
        <p class="shelf-empty-desc">${escapeHtml(err.message)}</p>
      </div>
    `;
  }
}

init();
