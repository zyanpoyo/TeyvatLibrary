import { fetchStoriesIndex, fetchStoryDetail } from "./api/stories.js";
import { createDisplayPrefsState, DISPLAY_PREFS_KEY } from "./state/prefs.js";
import {
  AUTO_READ_THRESHOLD,
  BOOKMARK_THRESHOLD_MIN,
  createReadingState,
  READING_STATE_KEY,
} from "./state/reading-state.js";
import { escapeHtml } from "./utils/html.js";
import {
  getStoryHash,
  populateFilterOptions,
  renderCategoryTabs,
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
};

let indexData = null;
let validStoryIds = new Set();
let annotationsEnabled = true;
let isDisplayPopoverOpen = false;
let activeView = "shelf";
let activeStoryId = null;
let autoReadSuppressedForActiveStory = false;
let suppressSessionRecordUntil = 0;
let bookmarkSaveTimer = null;
let pendingSessionSnapshot = null;
let currentDepth = 0;
let shelfDepth = 0;
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

function getShelfUrl() {
  return location.href.split("#")[0];
}

function parseStoryIdFromHash(hash = location.hash) {
  const match = /^#story\/(.+)$/.exec(hash);
  if (!match) return null;
  let rawId = match[1];
  try {
    rawId = decodeURIComponent(rawId);
  } catch {
    // Keep raw hash segment if percent-decoding fails
  }
  return validStoryIds.has(rawId) ? rawId : null;
}

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

// Reader Scroll & Chapter Observer
let lastScrollY = 0;
let scrollAnchorY = 0;
let lastScrollDir = 0;
let chapterObserver = null;
let activeChapterSections = [];
let activeStoryChapters = [];
const visibleChapterIndices = new Set();
let currentChapterIndex = 0;

function resetReaderNavVisibility() {
  readerNavRow?.classList.remove("is-hidden");
  lastScrollY = 0;
  scrollAnchorY = 0;
  lastScrollDir = 0;
}

function updateReaderNavVisibility() {
  if (readerView.hidden || !readerNavRow || isDisplayPopoverOpen) return;

  const maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  const y = Math.max(0, Math.min(window.scrollY, maxY));
  if (y === lastScrollY) return;

  const hideThreshold = readerNavRow.offsetHeight + 24;
  if (y <= hideThreshold) {
    readerNavRow.classList.remove("is-hidden");
    lastScrollY = y;
    scrollAnchorY = y;
    lastScrollDir = 0;
    return;
  }

  const dir = y > lastScrollY ? 1 : -1;
  if (dir !== lastScrollDir) {
    scrollAnchorY = lastScrollY;
    lastScrollDir = dir;
  }

  if (dir === 1 && y - scrollAnchorY >= 8) {
    readerNavRow.classList.add("is-hidden");
  } else if (dir === -1 && scrollAnchorY - y >= 12) {
    readerNavRow.classList.remove("is-hidden");
  }

  lastScrollY = y;
}

function setFooterChapterIndex(index) {
  if (index < 0 || index >= activeStoryChapters.length) return;
  currentChapterIndex = index;
  const label = activeStoryChapters[index]?.partLabel ?? "";
  if (readerFooterChapter.textContent !== label) {
    readerFooterChapter.textContent = label;
  }
}

function resolveActiveChapterIndex() {
  if (activeChapterSections.length === 0) return;

  const maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  if (window.scrollY <= 16) {
    setFooterChapterIndex(0);
    return;
  }
  if (maxY > 0 && maxY - window.scrollY <= 16) {
    setFooterChapterIndex(activeChapterSections.length - 1);
    return;
  }

  const targetLine = window.innerHeight * 0.32;
  let bestIndex = currentChapterIndex;
  let bestDistance = Infinity;

  for (let idx = 0; idx < activeChapterSections.length; idx += 1) {
    const el = activeChapterSections[idx];
    if (!el) continue;
    const rect = el.getBoundingClientRect();
    const distance = rect.top <= targetLine && rect.bottom >= targetLine
      ? 0
      : Math.min(Math.abs(rect.top - targetLine), Math.abs(rect.bottom - targetLine));
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = idx;
    }
  }

  setFooterChapterIndex(bestIndex);
}

function teardownChapterObserver() {
  if (chapterObserver) {
    chapterObserver.disconnect();
    chapterObserver = null;
  }
  visibleChapterIndices.clear();
  activeChapterSections = [];
  activeStoryChapters = [];
  currentChapterIndex = 0;
}

function setupChapterObserver(story) {
  teardownChapterObserver();
  activeStoryChapters = story.chapters || [];
  activeChapterSections = [...chaptersContainer.querySelectorAll(".chapter-section")];
  setFooterChapterIndex(0);

  if (activeChapterSections.length <= 1 || typeof IntersectionObserver === "undefined") {
    return;
  }

  chapterObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const idx = Number(entry.target.dataset.chapterIndex);
      if (Number.isNaN(idx)) continue;
      if (entry.isIntersecting) {
        visibleChapterIndices.add(idx);
      } else {
        visibleChapterIndices.delete(idx);
      }
    }
    resolveActiveChapterIndex();
  }, {
    rootMargin: "-18% 0px -22% 0px",
    threshold: 0,
  });

  for (const section of activeChapterSections) {
    chapterObserver.observe(section);
  }
}

function clearPendingBookmarkSave() {
  if (bookmarkSaveTimer !== null) {
    clearTimeout(bookmarkSaveTimer);
    bookmarkSaveTimer = null;
  }
  pendingSessionSnapshot = null;
}

function flushBookmarkSave() {
  if (bookmarkSaveTimer !== null) {
    clearTimeout(bookmarkSaveTimer);
    bookmarkSaveTimer = null;
  }
  if (pendingSessionSnapshot) {
    const snapshot = pendingSessionSnapshot;
    pendingSessionSnapshot = null;
    readingState.updateLastSession(snapshot);
  }
}

function scheduleBookmarkSave(snapshot) {
  pendingSessionSnapshot = snapshot;
  if (bookmarkSaveTimer !== null) {
    clearTimeout(bookmarkSaveTimer);
  }
  bookmarkSaveTimer = setTimeout(() => {
    bookmarkSaveTimer = null;
    flushBookmarkSave();
  }, 250);
}

function syncActiveStoryReaderButtons() {
  if (!activeStoryId) return;
  updateReaderStateButtons(readerView, {
    isRead: readingState.isRead(activeStoryId),
    isBookmarked: readingState.isBookmarked(activeStoryId),
  });
}

function updateReadingProgress({ recordSession = true } = {}) {
  if (readerView.hidden) return;
  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  const ratio = scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 1;
  const pct = ratio * 100;
  readingProgress.style.width = `${pct}%`;
  readerFooterPercent.textContent = `${Math.round(pct)}%`;
  resolveActiveChapterIndex();

  if (!recordSession || !activeStoryId || scrollable <= 0) return;
  if (performance.now() < suppressSessionRecordUntil) return;

  if (ratio >= AUTO_READ_THRESHOLD) {
    clearPendingBookmarkSave();
    if (!autoReadSuppressedForActiveStory) {
      if (readingState.markRead(activeStoryId)) {
        syncActiveStoryReaderButtons();
      }
    } else {
      readingState.updateLastSession({
        storyId: activeStoryId,
        chapterIndex: currentChapterIndex,
        scrollRatio: ratio,
      });
    }
    return;
  }

  if (ratio > BOOKMARK_THRESHOLD_MIN) {
    scheduleBookmarkSave({
      storyId: activeStoryId,
      chapterIndex: currentChapterIndex,
      scrollRatio: ratio,
    });
  }
}

function updateShelfView() {
  if (!indexData) return;
  renderResumeBanner(resumeBannerContainer, indexData, readingState);
  renderCategoryTabs(categoryTabsEl, indexData, filters.category);
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
  filters.region = "";
  filters.query = "";
  if (statusFilterEl) statusFilterEl.value = "all";
  if (entityFilterEl) entityFilterEl.value = "";
  if (regionFilterEl) regionFilterEl.value = "";
  if (searchFilterEl) searchFilterEl.value = "";
  updateShelfView();
}

async function openStory(storyId, { moveFocus = false, restoreScrollRatio = null } = {}) {
  flushBookmarkSave();
  const token = ++loadToken;
  closeOpenPopovers();

  activeView = "story";
  activeStoryId = storyId;
  autoReadSuppressedForActiveStory = false;
  document.body.dataset.view = "reader";
  shelfView.hidden = true;
  shelfView.inert = true;
  readerView.hidden = false;
  readerView.inert = false;
  readingProgress.hidden = false;
  readerFooterStatus.hidden = false;
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
    suppressSessionRecordUntil = performance.now() + 400;
    window.scrollTo({ top: 0, behavior: "instant" });
    resetReaderNavVisibility();
    setupChapterObserver(story);

    const hasRestoreRatio =
      typeof restoreScrollRatio === "number" &&
      Number.isFinite(restoreScrollRatio) &&
      restoreScrollRatio > BOOKMARK_THRESHOLD_MIN &&
      restoreScrollRatio < AUTO_READ_THRESHOLD;

    if (hasRestoreRatio) {
      const applyRestoredScroll = () => {
        suppressSessionRecordUntil = performance.now() + 400;
        const scrollable = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
        window.scrollTo({
          top: Math.round(scrollable * restoreScrollRatio),
          behavior: "instant",
        });
        updateReadingProgress({ recordSession: false });
      };
      applyRestoredScroll();
      requestAnimationFrame(() => {
        if (token === loadToken && activeView === "story" && activeStoryId === storyId) {
          applyRestoredScroll();
        }
      });
    } else {
      updateReadingProgress({ recordSession: false });
    }

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
  flushBookmarkSave();
  loadToken++;
  closeOpenPopovers();
  resetReaderNavVisibility();
  teardownChapterObserver();
  activeView = "shelf";
  activeStoryId = null;
  autoReadSuppressedForActiveStory = false;
  document.title = BASE_TITLE;
  document.body.dataset.view = "shelf";
  readerView.hidden = true;
  readerView.inert = true;
  shelfView.hidden = false;
  shelfView.inert = false;
  readingProgress.hidden = true;
  readerFooterStatus.hidden = true;
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

function navigateToStory(storyId, { restoreScrollRatio = null } = {}) {
  if (!validStoryIds.has(storyId)) return;

  if (activeView === "story" && activeStoryId === storyId) {
    window.scrollTo({ top: 0, behavior: "instant" });
    return;
  }

  if (activeView === "shelf") {
    shelfScrollY = window.scrollY;
    lastOpenedStoryId = storyId;
  }

  const newDepth = currentDepth + 1;
  if (shelfDepth !== null && newDepth <= shelfDepth) {
    shelfDepth = null;
  }
  history.pushState(
    { depth: newDepth, view: "story", storyId },
    "",
    getStoryHash(storyId)
  );
  currentDepth = newDepth;
  openStory(storyId, { moveFocus: true, restoreScrollRatio });
}

function navigateToShelf() {
  if (shelfDepth !== null && currentDepth > shelfDepth) {
    history.go(shelfDepth - currentDepth);
    return;
  }

  const newDepth = currentDepth + 1;
  shelfDepth = newDepth;
  history.pushState({ depth: newDepth, view: "shelf" }, "", getShelfUrl());
  currentDepth = newDepth;
  showShelf({ restoreFocus: true, restoreScroll: false });
}

function syncRouteFromUrl(state) {
  const storyId = parseStoryIdFromHash(location.hash);
  if (storyId) {
    if (state && typeof state.depth === "number") {
      currentDepth = state.depth;
    } else if (activeView !== "story" || activeStoryId !== storyId) {
      currentDepth += 1;
      if (shelfDepth !== null && currentDepth <= shelfDepth) {
        shelfDepth = null;
      }
      history.replaceState({ depth: currentDepth, view: "story", storyId }, "");
    }
    if (activeView !== "story" || activeStoryId !== storyId) {
      if (activeView === "shelf") {
        shelfScrollY = window.scrollY;
        lastOpenedStoryId = storyId;
      }
      openStory(storyId, { moveFocus: true });
    }
    return;
  }

  if (/^#chapter-\d+$/.test(location.hash) && activeView === "story") {
    return;
  }

  if (state && typeof state.depth === "number") {
    currentDepth = state.depth;
  } else if (activeView !== "shelf") {
    currentDepth += 1;
    shelfDepth = currentDepth;
    history.replaceState({ depth: currentDepth, view: "shelf" }, "");
  }

  if (activeView !== "shelf") {
    showShelf({ restoreFocus: true, restoreScroll: true });
  }
}

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
  navigateToStory(storyId, { restoreScrollRatio });
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
  navigateToStory(card.dataset.storyId);
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
    autoReadSuppressedForActiveStory = !nextRead;
    if (nextRead) {
      clearPendingBookmarkSave();
    }
    syncActiveStoryReaderButtons();
  }
});

chaptersContainer.addEventListener("toggle", (e) => {
  const details = e.target;
  if (!details || !details.classList?.contains("lore-details")) return;
  if (details.open && activeView === "story" && activeStoryId && !autoReadSuppressedForActiveStory) {
    clearPendingBookmarkSave();
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
  navigateToStory(item.dataset.targetId);
});

popoversContainer.addEventListener("click", (e) => {
  if (isModifiedClick(e)) return;
  const link = e.target.closest(".evidence-link");
  if (!link || !popoversContainer.contains(link)) return;
  e.preventDefault();
  const targetId = link.dataset.targetId;
  if (targetId) {
    closeOpenPopovers();
    navigateToStory(targetId);
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

window.addEventListener("popstate", (event) => {
  syncRouteFromUrl(event.state);
});

window.addEventListener("hashchange", () => {
  syncRouteFromUrl(history.state);
});

document.getElementById("back-to-shelf-btn").addEventListener("click", navigateToShelf);

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
    updateReadingProgress();
  });
}

bindDisplaySettingClicks(displaySettingsPopover);
bindDisplaySettingClicks(shelfThemeSwitcher);

window.addEventListener("storage", (event) => {
  if (event.key === DISPLAY_PREFS_KEY || event.key === null) {
    displayPrefsState.load();
    displayPrefsState.apply(displaySettingContainers);
    updateReadingProgress({ recordSession: false });
  }
  if (event.key === READING_STATE_KEY || event.key === null) {
    readingState.load();
    updateShelfView();
    if (activeView === "story" && activeStoryId) {
      syncActiveStoryReaderButtons();
    }
  }
});

window.addEventListener("pagehide", flushBookmarkSave);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    flushBookmarkSave();
  }
});

window.addEventListener("scroll", () => {
  updateReadingProgress();
  updateReaderNavVisibility();
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

    const initialStoryId = parseStoryIdFromHash(location.hash);
    if (initialStoryId) {
      currentDepth = 0;
      shelfDepth = null;
      history.replaceState({ depth: 0, view: "story", storyId: initialStoryId }, "");
      const savedSession = readingState.getLastSession(validStoryIds);
      const restoreScrollRatio =
        savedSession && savedSession.storyId === initialStoryId
          ? savedSession.scrollRatio
          : null;
      await openStory(initialStoryId, { moveFocus: false, restoreScrollRatio });
    } else {
      currentDepth = 0;
      shelfDepth = 0;
      history.replaceState({ depth: 0, view: "shelf" }, "");
      showShelf({ restoreFocus: false, restoreScroll: false });
    }
  } catch (err) {
    storyGrid.innerHTML = `
      <div class="shelf-empty-state">
        <p class="shelf-empty-title">書架データの読み込みに失敗しました</p>
        <p class="shelf-empty-desc">${escapeHtml(err.message)}</p>
        <button type="button" class="control-pill" onclick="location.reload()">再読み込み</button>
      </div>
    `;
  }
}

init();
