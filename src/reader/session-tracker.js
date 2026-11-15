import { AUTO_READ_THRESHOLD, BOOKMARK_THRESHOLD_MIN } from "../state/reading-state.js";

export function createReaderSessionTracker({
  elements,
  readingState,
  isDisplayPopoverOpen,
  onAutoReadMarked,
}) {
  const {
    readerView,
    readerNavRow,
    chaptersContainer,
    readingProgress,
    readerFooterChapter,
    readerFooterPercent,
  } = elements;

  let activeStoryId = null;
  let isMounted = false;
  let autoReadSuppressed = false;
  let hasUserScrolledDown = false;
  let initialMountedScrollY = 0;
  let suppressSessionRecordUntil = 0;
  let bookmarkSaveTimer = null;
  let pendingSessionSnapshot = null;

  let lastScrollY = 0;
  let scrollAnchorY = 0;
  let lastScrollDir = 0;
  let chapterObserver = null;
  let activeChapterSections = [];
  let activeStoryChapters = [];
  const visibleChapterIndices = new Set();
  let currentChapterIndex = 0;

  function resetNavVisibility() {
    readerNavRow?.classList.remove("is-hidden");
    lastScrollY = 0;
    scrollAnchorY = 0;
    lastScrollDir = 0;
  }

  function updateNavVisibility() {
    if (!isMounted || readerView.hidden || !readerNavRow || isDisplayPopoverOpen?.()) return;

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

  function clearPendingBookmark() {
    if (bookmarkSaveTimer !== null) {
      clearTimeout(bookmarkSaveTimer);
      bookmarkSaveTimer = null;
    }
    pendingSessionSnapshot = null;
  }

  function flush() {
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
      flush();
    }, 250);
  }

  function refreshProgress({ recordSession = true } = {}) {
    if (!isMounted || readerView.hidden || !activeStoryId) return;
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 1;
    const pct = ratio * 100;
    readingProgress.style.width = `${pct}%`;
    readerFooterPercent.textContent = `${Math.round(pct)}%`;
    resolveActiveChapterIndex();

    if (!recordSession || scrollable <= 0) return;
    if (performance.now() < suppressSessionRecordUntil) {
      initialMountedScrollY = window.scrollY;
      return;
    }

    if (window.scrollY > initialMountedScrollY + 4) {
      hasUserScrolledDown = true;
    }
    if (!hasUserScrolledDown) return;

    if (ratio >= AUTO_READ_THRESHOLD) {
      clearPendingBookmark();
      if (!autoReadSuppressed) {
        if (readingState.markRead(activeStoryId)) {
          onAutoReadMarked?.(activeStoryId);
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

  function prepareForStory() {
    flush();
    resetNavVisibility();
    teardownChapterObserver();
    isMounted = false;
    activeStoryId = null;
    autoReadSuppressed = false;
    hasUserScrolledDown = false;
    initialMountedScrollY = 0;
    readingProgress.style.width = "0%";
    readerFooterChapter.textContent = "";
    readerFooterPercent.textContent = "0%";
  }

  function mount(story, { restoreScrollRatio = null, isCurrentLoad } = {}) {
    activeStoryId = story.id;
    isMounted = true;
    hasUserScrolledDown = false;
    suppressSessionRecordUntil = performance.now() + 400;
    window.scrollTo({ top: 0, behavior: "instant" });
    initialMountedScrollY = window.scrollY;
    resetNavVisibility();
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
        initialMountedScrollY = window.scrollY;
        refreshProgress({ recordSession: false });
      };
      applyRestoredScroll();
      requestAnimationFrame(() => {
        if (!isCurrentLoad || isCurrentLoad()) {
          applyRestoredScroll();
        }
      });
    } else {
      refreshProgress({ recordSession: false });
    }
  }

  function unmount() {
    flush();
    resetNavVisibility();
    teardownChapterObserver();
    isMounted = false;
    activeStoryId = null;
    autoReadSuppressed = false;
    hasUserScrolledDown = false;
    initialMountedScrollY = 0;
  }

  function handleScroll() {
    if (!isMounted) return;
    refreshProgress();
    updateNavVisibility();
  }

  function setAutoReadSuppressed(suppressed) {
    autoReadSuppressed = Boolean(suppressed);
  }

  function isAutoReadSuppressed() {
    return autoReadSuppressed;
  }

  return {
    prepareForStory,
    mount,
    unmount,
    flush,
    clearPendingBookmark,
    refreshProgress,
    handleScroll,
    resetNavVisibility,
    setAutoReadSuppressed,
    isAutoReadSuppressed,
  };
}
