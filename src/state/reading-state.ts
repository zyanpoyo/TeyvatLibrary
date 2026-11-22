import type { LastSessionSnapshot, ReadingStateSnapshot } from "../types/story";
import { createPersistedStore } from "./persisted-store";

export const READING_STATE_KEY = "genshin-books-reading-state-v1";
export const BOOKMARK_THRESHOLD_MIN = 0.05;
export const AUTO_READ_THRESHOLD = 0.9;

/**
 * スクロール進捗率を小数第3位へ丸める。閾値判定の前に必ず適用して端数ズレを防ぐ。
 */
export function roundScrollRatio(ratio: number): number {
  if (typeof ratio !== "number" || !Number.isFinite(ratio)) return 0;
  return Math.round(ratio * 1000) / 1000;
}

export function createEmptyReadingState(): ReadingStateSnapshot {
  return {
    readStories: {},
    bookmarks: [],
    lastSession: null,
  };
}

function normalizeState(raw: unknown): ReadingStateSnapshot {
  const next = createEmptyReadingState();
  if (!raw || typeof raw !== "object") return next;
  const obj = raw as Record<string, unknown>;

  if (obj.readStories && typeof obj.readStories === "object" && !Array.isArray(obj.readStories)) {
    for (const [storyId, entry] of Object.entries(obj.readStories as Record<string, unknown>)) {
      if (typeof storyId !== "string" || !storyId) continue;
      if (
        entry &&
        typeof entry === "object" &&
        typeof (entry as { readAt?: unknown }).readAt === "string"
      ) {
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
      Number.isFinite(scrollRatio)
    ) {
      const roundedRatio = roundScrollRatio(scrollRatio);
      if (roundedRatio > BOOKMARK_THRESHOLD_MIN && roundedRatio < AUTO_READ_THRESHOLD) {
        next.lastSession = {
          storyId,
          chapterIndex:
            typeof chapterIndex === "number" && Number.isInteger(chapterIndex) && chapterIndex >= 0
              ? chapterIndex
              : 0,
          scrollRatio: roundedRatio,
          updatedAt: typeof updatedAt === "string" ? updatedAt : "",
        };
      }
    }
  }

  return next;
}

/**
 * スナップショットから指定作品が読了済みかを判定する純粋セレクタ。
 */
export function isStoryRead(
  snapshot: ReadingStateSnapshot | null | undefined,
  storyId: string
): boolean {
  if (!snapshot || !storyId) return false;
  return Object.hasOwn(snapshot.readStories, storyId);
}

/**
 * スナップショットから指定作品があとで読む登録済みかを判定する純粋セレクタ。
 */
export function isStoryBookmarked(
  snapshot: ReadingStateSnapshot | null | undefined,
  storyId: string
): boolean {
  if (!snapshot || !storyId) return false;
  return snapshot.bookmarks.includes(storyId);
}

/**
 * スナップショットから読了済み作品数を算出する純粋セレクタ。
 */
export function getSnapshotReadCount(
  snapshot: ReadingStateSnapshot | null | undefined,
  validStoryIds: ReadonlySet<string> | null = null
): number {
  if (!snapshot) return 0;
  if (!validStoryIds) {
    return Object.keys(snapshot.readStories).length;
  }
  let count = 0;
  for (const id of Object.keys(snapshot.readStories)) {
    if (validStoryIds.has(id)) count += 1;
  }
  return count;
}

/**
 * スナップショットから有効範囲内の途中しおりを取得する純粋セレクタ。
 */
export function getSnapshotLastSession(
  snapshot: ReadingStateSnapshot | null | undefined,
  validStoryIds: ReadonlySet<string> | null = null
): LastSessionSnapshot | null {
  const session = snapshot?.lastSession;
  if (!session) return null;
  if (validStoryIds && !validStoryIds.has(session.storyId)) return null;
  const roundedRatio = roundScrollRatio(session.scrollRatio);
  if (roundedRatio <= BOOKMARK_THRESHOLD_MIN || roundedRatio >= AUTO_READ_THRESHOLD) {
    return null;
  }
  return { ...session, scrollRatio: roundedRatio };
}

export interface ReadingStateSnapshotReader {
  isRead(storyId: string): boolean;
  isBookmarked(storyId: string): boolean;
  getReadCount(validStoryIds?: ReadonlySet<string> | null): number;
  getLastSession(validStoryIds?: ReadonlySet<string> | null): LastSessionSnapshot | null;
}

/**
 * 不変スナップショットから ReadingStateReader 互換の読み取りインターフェースを生成する。
 */
export function createReadingStateReader(
  snapshot: ReadingStateSnapshot | null | undefined
): ReadingStateSnapshotReader {
  return {
    isRead: (storyId: string) => isStoryRead(snapshot, storyId),
    isBookmarked: (storyId: string) => isStoryBookmarked(snapshot, storyId),
    getReadCount: (validStoryIds = null) => getSnapshotReadCount(snapshot, validStoryIds),
    getLastSession: (validStoryIds = null) => getSnapshotLastSession(snapshot, validStoryIds),
  };
}

export interface ReadingStateStore extends ReadingStateSnapshotReader {
  load(): void;
  getSnapshot(): ReadingStateSnapshot;
  subscribe(listener: () => void): () => void;
  markRead(storyId: string): boolean;
  unmarkRead(storyId: string): boolean;
  toggleRead(storyId: string): boolean;
  toggleBookmark(storyId: string): boolean;
  updateLastSession(params: { storyId: string; chapterIndex: number; scrollRatio: number }): boolean;
  clearLastSession(): boolean;
}

export function createReadingState(
  options?: { deferInitialLoad?: boolean }
): ReadingStateStore {
  const core = createPersistedStore<ReadingStateSnapshot>({
    key: READING_STATE_KEY,
    createDefault: createEmptyReadingState,
    deserialize: normalizeState,
    deferInitialLoad: options?.deferInitialLoad,
  });

  function load(): void {
    core.load();
  }

  function isRead(storyId: string): boolean {
    return isStoryRead(core.getSnapshot(), storyId);
  }

  function markRead(storyId: string): boolean {
    if (!storyId) return false;
    const state = core.getSnapshot();
    let changed = false;
    let nextReadStories = state.readStories;
    let nextLastSession = state.lastSession;

    if (!isStoryRead(state, storyId)) {
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
      core.commit({
        readStories: nextReadStories,
        bookmarks: state.bookmarks,
        lastSession: nextLastSession,
      });
    }
    return changed;
  }

  function unmarkRead(storyId: string): boolean {
    const state = core.getSnapshot();
    if (!storyId || !isStoryRead(state, storyId)) return false;
    const nextReadStories = { ...state.readStories };
    delete nextReadStories[storyId];
    core.commit({
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
    return isStoryBookmarked(core.getSnapshot(), storyId);
  }

  function toggleBookmark(storyId: string): boolean {
    if (!storyId) return false;
    const state = core.getSnapshot();
    const idx = state.bookmarks.indexOf(storyId);
    if (idx >= 0) {
      const nextBookmarks = state.bookmarks.filter((id) => id !== storyId);
      core.commit({
        readStories: state.readStories,
        bookmarks: nextBookmarks,
        lastSession: state.lastSession,
      });
      return false;
    }
    const nextBookmarks = [...state.bookmarks, storyId];
    core.commit({
      readStories: state.readStories,
      bookmarks: nextBookmarks,
      lastSession: state.lastSession,
    });
    return true;
  }

  function getReadCount(validStoryIds: ReadonlySet<string> | null = null): number {
    return getSnapshotReadCount(core.getSnapshot(), validStoryIds);
  }

  function getLastSession(
    validStoryIds: ReadonlySet<string> | null = null
  ): LastSessionSnapshot | null {
    return getSnapshotLastSession(core.getSnapshot(), validStoryIds);
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
    const state = core.getSnapshot();
    const roundedRatio = roundScrollRatio(scrollRatio);
    if (roundedRatio >= AUTO_READ_THRESHOLD) {
      if (state.lastSession?.storyId === storyId) {
        core.commit({
          readStories: state.readStories,
          bookmarks: state.bookmarks,
          lastSession: null,
        });
        return true;
      }
      return false;
    }
    if (roundedRatio <= BOOKMARK_THRESHOLD_MIN) {
      return false;
    }

    core.commit({
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
    const state = core.getSnapshot();
    if (!state.lastSession) return false;
    core.commit({
      readStories: state.readStories,
      bookmarks: state.bookmarks,
      lastSession: null,
    });
    return true;
  }

  return {
    load,
    getSnapshot: core.getSnapshot,
    subscribe: core.subscribe,
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
