export const READING_STATE_KEY = "genshin-books-reading-state-v1";

export const BOOKMARK_THRESHOLD_MIN = 0.05;
export const AUTO_READ_THRESHOLD = 0.9;

function createEmptyState() {
  return {
    readStories: {},
    bookmarks: [],
    lastSession: null,
  };
}

function normalizeState(raw) {
  const next = createEmptyState();
  if (!raw || typeof raw !== "object") return next;

  if (raw.readStories && typeof raw.readStories === "object" && !Array.isArray(raw.readStories)) {
    for (const [storyId, entry] of Object.entries(raw.readStories)) {
      if (typeof storyId !== "string" || !storyId) continue;
      if (entry && typeof entry === "object" && typeof entry.readAt === "string") {
        next.readStories[storyId] = { readAt: entry.readAt };
      }
    }
  }

  if (Array.isArray(raw.bookmarks)) {
    const seen = new Set();
    for (const id of raw.bookmarks) {
      if (typeof id === "string" && id && !seen.has(id)) {
        seen.add(id);
        next.bookmarks.push(id);
      }
    }
  }

  if (raw.lastSession && typeof raw.lastSession === "object") {
    const { storyId, chapterIndex, scrollRatio, updatedAt } = raw.lastSession;
    if (
      typeof storyId === "string" &&
      storyId &&
      typeof scrollRatio === "number" &&
      Number.isFinite(scrollRatio) &&
      scrollRatio > BOOKMARK_THRESHOLD_MIN &&
      scrollRatio < AUTO_READ_THRESHOLD
    ) {
      next.lastSession = {
        storyId,
        chapterIndex: typeof chapterIndex === "number" && Number.isInteger(chapterIndex) && chapterIndex >= 0
          ? chapterIndex
          : 0,
        scrollRatio,
        updatedAt: typeof updatedAt === "string" ? updatedAt : "",
      };
    }
  }

  return next;
}

export function createReadingState() {
  let state = createEmptyState();

  function load() {
    state = createEmptyState();
    try {
      const raw = localStorage.getItem(READING_STATE_KEY);
      if (!raw) return;
      state = normalizeState(JSON.parse(raw));
    } catch {
      // Ignore storage errors in restricted environments
    }
  }

  function save() {
    try {
      localStorage.setItem(READING_STATE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage errors in restricted environments
    }
  }

  function isRead(storyId) {
    return Boolean(storyId && Object.hasOwn(state.readStories, storyId));
  }

  function markRead(storyId) {
    if (!storyId) return false;
    let changed = false;
    if (!isRead(storyId)) {
      state.readStories[storyId] = { readAt: new Date().toISOString() };
      changed = true;
    }
    if (state.lastSession?.storyId === storyId) {
      state.lastSession = null;
      changed = true;
    }
    if (changed) {
      save();
    }
    return changed;
  }

  function unmarkRead(storyId) {
    if (!storyId || !isRead(storyId)) return false;
    delete state.readStories[storyId];
    save();
    return true;
  }

  function toggleRead(storyId) {
    if (!storyId) return false;
    if (isRead(storyId)) {
      unmarkRead(storyId);
      return false;
    }
    markRead(storyId);
    return true;
  }

  function isBookmarked(storyId) {
    return Boolean(storyId && state.bookmarks.includes(storyId));
  }

  function toggleBookmark(storyId) {
    if (!storyId) return false;
    const idx = state.bookmarks.indexOf(storyId);
    if (idx >= 0) {
      state.bookmarks.splice(idx, 1);
      save();
      return false;
    }
    state.bookmarks.push(storyId);
    save();
    return true;
  }

  function getReadCount(validStoryIds = null) {
    if (!validStoryIds) {
      return Object.keys(state.readStories).length;
    }
    let count = 0;
    for (const id of Object.keys(state.readStories)) {
      if (validStoryIds.has(id)) count += 1;
    }
    return count;
  }

  function getLastSession(validStoryIds = null) {
    const session = state.lastSession;
    if (!session) return null;
    if (validStoryIds && !validStoryIds.has(session.storyId)) return null;
    if (
      session.scrollRatio <= BOOKMARK_THRESHOLD_MIN ||
      session.scrollRatio >= AUTO_READ_THRESHOLD
    ) {
      return null;
    }
    return { ...session };
  }

  function updateLastSession({ storyId, chapterIndex, scrollRatio }) {
    if (!storyId || typeof scrollRatio !== "number" || !Number.isFinite(scrollRatio)) {
      return false;
    }
    if (scrollRatio >= AUTO_READ_THRESHOLD) {
      if (state.lastSession?.storyId === storyId) {
        state.lastSession = null;
        save();
        return true;
      }
      return false;
    }
    if (scrollRatio <= BOOKMARK_THRESHOLD_MIN) {
      return false;
    }

    const roundedRatio = Math.round(scrollRatio * 1000) / 1000;
    if (roundedRatio <= BOOKMARK_THRESHOLD_MIN || roundedRatio >= AUTO_READ_THRESHOLD) {
      return false;
    }

    state.lastSession = {
      storyId,
      chapterIndex: typeof chapterIndex === "number" && Number.isInteger(chapterIndex) && chapterIndex >= 0
        ? chapterIndex
        : 0,
      scrollRatio: roundedRatio,
      updatedAt: new Date().toISOString(),
    };
    save();
    return true;
  }

  function clearLastSession() {
    if (!state.lastSession) return false;
    state.lastSession = null;
    save();
    return true;
  }

  return {
    load,
    save,
    isRead,
    markRead,
    unmarkRead,
    toggleRead,
    isBookmarked,
    toggleBookmark,
    getReadCount,
    getLastSession,
    updateLastSession,
    clearLastSession,
  };
}
