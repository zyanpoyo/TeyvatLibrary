import type { LastSessionSnapshot, ReadingStateSnapshot } from "../types/story";

export const READING_STATE_KEY = "genshin-books-reading-state-v1";
export const BOOKMARK_THRESHOLD_MIN = 0.05;
export const AUTO_READ_THRESHOLD = 0.9;

function createEmptyState(): ReadingStateSnapshot {
  return {
    readStories: {},
    bookmarks: [],
    lastSession: null,
  };
}

function normalizeState(raw: unknown): ReadingStateSnapshot {
  const next = createEmptyState();
  if (!raw || typeof raw !== "object") return next;
  const obj = raw as Record<string, unknown>;

  if (obj.readStories && typeof obj.readStories === "object" && !Array.isArray(obj.readStories)) {
    for (const [storyId, entry] of Object.entries(obj.readStories as Record<string, unknown>)) {
      if (typeof storyId !== "string" || !storyId) continue;
      if (entry && typeof entry === "object" && typeof (entry as { readAt?: unknown }).readAt === "string") {
        next.readStories[storyId] = { readAt: (entry as { readAt: string }).readAt };
      }
    }
  }

  if (Array.isArray(obj.bookmarks)) {
    const seen = new Set<string>();
    for (const id of obj.bookmarks) {
      if (typeof id === "string" && id && !seen.has(id)) {
        seen.add(id);
        next.bookmarks.push(id);
      }
    }
  }

  if (obj.lastSession && typeof obj.lastSession === "object") {
    const ls = obj.lastSession as Record<string, unknown>;
    const storyId = ls.storyId;
    const chapterIndex = ls.chapterIndex;
    const scrollRatio = ls.scrollRatio;
    const updatedAt = ls.updatedAt;
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
        chapterIndex:
          typeof chapterIndex === "number" && Number.isInteger(chapterIndex) && chapterIndex >= 0
            ? chapterIndex
            : 0,
        scrollRatio,
        updatedAt: typeof updatedAt === "string" ? updatedAt : "",
      };
    }
  }

  return next;
}

export interface ReadingStateStore {
  load(): void;
  save(): void;
  getSnapshot(): ReadingStateSnapshot;
  subscribe(listener: () => void): () => void;
  isRead(storyId: string): boolean;
  markRead(storyId: string): boolean;
  unmarkRead(storyId: string): boolean;
  toggleRead(storyId: string): boolean;
  isBookmarked(storyId: string): boolean;
  toggleBookmark(storyId: string): boolean;
  getReadCount(validStoryIds?: ReadonlySet<string> | null): number;
  getLastSession(validStoryIds?: ReadonlySet<string> | null): LastSessionSnapshot | null;
  updateLastSession(params: { storyId: string; chapterIndex: number; scrollRatio: number }): boolean;
  clearLastSession(): boolean;
}

export function createReadingState(): ReadingStateStore {
  let state: ReadingStateSnapshot = createEmptyState();
  const listeners = new Set<() => void>();

  function emit(): void {
    for (const listener of listeners) {
      listener();
    }
  }

  function load(): void {
    let next = createEmptyState();
    try {
      const raw = localStorage.getItem(READING_STATE_KEY);
      if (raw) {
        next = normalizeState(JSON.parse(raw));
      }
    } catch {
      // Ignore storage errors in restricted environments
    }
    state = next;
    emit();
  }

  function save(): void {
    try {
      localStorage.setItem(READING_STATE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage errors in restricted environments
    }
  }

  function commit(nextState: ReadingStateSnapshot): void {
    state = nextState;
    save();
    emit();
  }

  function isRead(storyId: string): boolean {
    return Boolean(storyId && Object.hasOwn(state.readStories, storyId));
  }

  function markRead(storyId: string): boolean {
    if (!storyId) return false;
    let changed = false;
    let nextReadStories = state.readStories;
    let nextLastSession = state.lastSession;

    if (!isRead(storyId)) {
      nextReadStories = {
        ...state.readStories,
        [storyId]: { readAt: new Date().toISOString() },
      };
      changed = true;
    }
    if (state.lastSession?.storyId === storyId) {
      nextLastSession = null;
      changed = true;
    }

    if (changed) {
      commit({
        readStories: nextReadStories,
        bookmarks: state.bookmarks,
        lastSession: nextLastSession,
      });
    }
    return changed;
  }

  function unmarkRead(storyId: string): boolean {
    if (!storyId || !isRead(storyId)) return false;
    const nextReadStories = { ...state.readStories };
    delete nextReadStories[storyId];
    commit({
      readStories: nextReadStories,
      bookmarks: state.bookmarks,
      lastSession: state.lastSession,
    });
    return true;
  }

  function toggleRead(storyId: string): boolean {
    if (!storyId) return false;
    if (isRead(storyId)) {
      unmarkRead(storyId);
      return false;
    }
    markRead(storyId);
    return true;
  }

  function isBookmarked(storyId: string): boolean {
    return Boolean(storyId && state.bookmarks.includes(storyId));
  }

  function toggleBookmark(storyId: string): boolean {
    if (!storyId) return false;
    const idx = state.bookmarks.indexOf(storyId);
    if (idx >= 0) {
      const nextBookmarks = state.bookmarks.filter((id) => id !== storyId);
      commit({
        readStories: state.readStories,
        bookmarks: nextBookmarks,
        lastSession: state.lastSession,
      });
      return false;
    }
    const nextBookmarks = [...state.bookmarks, storyId];
    commit({
      readStories: state.readStories,
      bookmarks: nextBookmarks,
      lastSession: state.lastSession,
    });
    return true;
  }

  function getReadCount(validStoryIds: ReadonlySet<string> | null = null): number {
    if (!validStoryIds) {
      return Object.keys(state.readStories).length;
    }
    let count = 0;
    for (const id of Object.keys(state.readStories)) {
      if (validStoryIds.has(id)) count += 1;
    }
    return count;
  }

  function getLastSession(validStoryIds: ReadonlySet<string> | null = null): LastSessionSnapshot | null {
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

  function updateLastSession({
    storyId,
    chapterIndex,
    scrollRatio,
  }: {
    storyId: string;
    chapterIndex: number;
    scrollRatio: number;
  }): boolean {
    if (!storyId || typeof scrollRatio !== "number" || !Number.isFinite(scrollRatio)) {
      return false;
    }
    if (scrollRatio >= AUTO_READ_THRESHOLD) {
      if (state.lastSession?.storyId === storyId) {
        commit({
          readStories: state.readStories,
          bookmarks: state.bookmarks,
          lastSession: null,
        });
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

    commit({
      readStories: state.readStories,
      bookmarks: state.bookmarks,
      lastSession: {
        storyId,
        chapterIndex:
          typeof chapterIndex === "number" && Number.isInteger(chapterIndex) && chapterIndex >= 0
            ? chapterIndex
            : 0,
        scrollRatio: roundedRatio,
        updatedAt: new Date().toISOString(),
      },
    });
    return true;
  }

  function clearLastSession(): boolean {
    if (!state.lastSession) return false;
    commit({
      readStories: state.readStories,
      bookmarks: state.bookmarks,
      lastSession: null,
    });
    return true;
  }

  function getSnapshot(): ReadingStateSnapshot {
    return state;
  }

  function handleStorageEvent(event: StorageEvent): void {
    if (event.key === READING_STATE_KEY || event.key === null) {
      load();
    }
  }

  function subscribe(listener: () => void): () => void {
    const wasEmpty = listeners.size === 0;
    listeners.add(listener);
    if (wasEmpty && typeof window !== "undefined") {
      window.addEventListener("storage", handleStorageEvent);
    }
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0 && typeof window !== "undefined") {
        window.removeEventListener("storage", handleStorageEvent);
      }
    };
  }

  return {
    load,
    save,
    getSnapshot,
    subscribe,
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
