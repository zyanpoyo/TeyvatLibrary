import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type Dispatch,
  type ReactNode,
  type RefObject,
  type SetStateAction,
} from "react";
import { useLocation, useNavigate } from "react-router";
import { fetchStoriesIndex } from "../api/stories";
import { DEFAULT_SHELF_FILTERS } from "../domain/catalog";
import { useSearchIndex } from "../hooks/useSearchIndex";
import {
  buildReaderJumpParams,
  buildShelfSearchParams,
  parseShelfSearchParams,
} from "../router/search-params";
import {
  createDisplayPrefsState,
  useDocumentThemeEffect,
  type DisplayPrefSetting,
} from "./prefs";
import { createReadingState, type ReadingStateStore } from "./reading-state";
import type {
  DisplayPrefs,
  ReadingStateSnapshot,
  SearchIndexData,
  SearchJumpTarget,
  ShelfFilters,
  StoriesIndexData,
  StoryDetail,
} from "../types/story";

export { DEFAULT_SHELF_FILTERS };

const BASE_DOCUMENT_TITLE = "テイワット文庫 — 原神 聖遺物・武器・書籍リーダー";

function getHistoryIndex(): number | null {
  if (typeof window === "undefined") return null;
  const idx = (window.history.state as { idx?: unknown } | null)?.idx;
  return typeof idx === "number" ? idx : null;
}

export interface ReadingStateContextValue {
  store: ReadingStateStore;
  snapshot: ReadingStateSnapshot;
}

export interface DisplayPrefsContextValue {
  prefs: DisplayPrefs;
  setPref: <K extends DisplayPrefSetting>(
    setting: K,
    value: DisplayPrefs[K] | (string & {})
  ) => boolean;
  annotationsEnabled: boolean;
  setAnnotationsEnabled: Dispatch<SetStateAction<boolean>>;
  toggleAnnotations: () => void;
}

export interface ShelfContextValue {
  indexData: StoriesIndexData | null;
  indexError: string | null;
  isLoadingIndex: boolean;
  searchIndex: SearchIndexData | null;
  isLoadingSearchIndex: boolean;
  ensureSearchIndex: () => void;
  validStoryIds: ReadonlySet<string>;
  filters: ShelfFilters;
  setFilters: Dispatch<SetStateAction<ShelfFilters>>;
  resetFilters: () => void;
}

interface TransitionSessionState {
  hasVisitedShelf: boolean;
  shelfScrollY: number;
  lastOpenedStoryId: string | null;
  shouldRestoreFocus: boolean;
  shelfDepthInSession: number | null;
}

const ReadingStateContext = createContext<ReadingStateContextValue | null>(null);
const DisplayPrefsContext = createContext<DisplayPrefsContextValue | null>(null);
const ShelfContext = createContext<ShelfContextValue | null>(null);
const TransitionSessionContext = createContext<RefObject<TransitionSessionState> | null>(null);

export interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [readingStore] = useState<ReadingStateStore>(() => createReadingState());
  const [prefsStore] = useState(() => createDisplayPrefsState());

  const readingSnapshot = useSyncExternalStore(
    readingStore.subscribe,
    readingStore.getSnapshot,
    readingStore.getSnapshot
  );
  const displayPrefs = useSyncExternalStore(
    prefsStore.subscribe,
    prefsStore.getSnapshot,
    prefsStore.getSnapshot
  );

  useDocumentThemeEffect(displayPrefs);

  const [indexData, setIndexData] = useState<StoriesIndexData | null>(null);
  const [indexError, setIndexError] = useState<string | null>(null);
  const [isLoadingIndex, setIsLoadingIndex] = useState<boolean>(true);
  const [filters, setFilters] = useState<ShelfFilters>(() => {
    if (location.pathname !== "/") return DEFAULT_SHELF_FILTERS;
    const parsed = parseShelfSearchParams(location.search);
    if (!parsed.query && !parsed.includeTruth) return DEFAULT_SHELF_FILTERS;
    return {
      ...DEFAULT_SHELF_FILTERS,
      query: parsed.query,
      includeTruth: parsed.includeTruth,
    };
  });
  const [annotationsEnabled, setAnnotationsEnabled] = useState<boolean>(true);
  const { searchIndex, isLoadingSearchIndex, ensureSearchIndex } = useSearchIndex(
    filters.query
  );

  useEffect(() => {
    if (location.pathname !== "/") return;
    const nextQuery = buildShelfSearchParams(
      filters.query,
      Boolean(filters.includeTruth)
    );
    const expectedSearch = nextQuery ? `?${nextQuery}` : "";
    if (location.search !== expectedSearch) {
      navigate({ pathname: "/", search: expectedSearch }, { replace: true });
    }
  }, [location.pathname, location.search, filters.query, filters.includeTruth, navigate]);

  const transitionStateRef = useRef<TransitionSessionState>({
    hasVisitedShelf: false,
    shelfScrollY: 0,
    lastOpenedStoryId: null,
    shouldRestoreFocus: false,
    shelfDepthInSession: null,
  });

  useEffect(() => {
    let cancelled = false;
    setIsLoadingIndex(true);
    setIndexError(null);

    fetchStoriesIndex()
      .then((data) => {
        if (!cancelled) {
          setIndexData(data);
          setIsLoadingIndex(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : String(err);
          setIndexError(message);
          setIsLoadingIndex(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const validStoryIds = useMemo<ReadonlySet<string>>(
    () => new Set((indexData?.stories || []).map((s) => s.id)),
    [indexData]
  );

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_SHELF_FILTERS);
  }, []);

  const setPref = useCallback(
    <K extends DisplayPrefSetting>(setting: K, value: DisplayPrefs[K] | (string & {})) =>
      prefsStore.set(setting, value),
    [prefsStore]
  );

  const toggleAnnotations = useCallback(() => {
    setAnnotationsEnabled((prev) => !prev);
  }, []);

  const readingContextValue = useMemo<ReadingStateContextValue>(
    () => ({ store: readingStore, snapshot: readingSnapshot }),
    [readingStore, readingSnapshot]
  );

  const prefsContextValue = useMemo<DisplayPrefsContextValue>(
    () => ({
      prefs: displayPrefs,
      setPref,
      annotationsEnabled,
      setAnnotationsEnabled,
      toggleAnnotations,
    }),
    [displayPrefs, setPref, annotationsEnabled, toggleAnnotations]
  );

  const shelfContextValue = useMemo<ShelfContextValue>(
    () => ({
      indexData,
      indexError,
      isLoadingIndex,
      searchIndex,
      isLoadingSearchIndex,
      ensureSearchIndex,
      validStoryIds,
      filters,
      setFilters,
      resetFilters,
    }),
    [
      indexData,
      indexError,
      isLoadingIndex,
      searchIndex,
      isLoadingSearchIndex,
      ensureSearchIndex,
      validStoryIds,
      filters,
      resetFilters,
    ]
  );

  return (
    <ReadingStateContext.Provider value={readingContextValue}>
      <DisplayPrefsContext.Provider value={prefsContextValue}>
        <ShelfContext.Provider value={shelfContextValue}>
          <TransitionSessionContext.Provider value={transitionStateRef}>
            {children}
          </TransitionSessionContext.Provider>
        </ShelfContext.Provider>
      </DisplayPrefsContext.Provider>
    </ReadingStateContext.Provider>
  );
}

export function useReadingStateStore(): ReadingStateContextValue {
  const ctx = useContext(ReadingStateContext);
  if (!ctx) throw new Error("useReadingStateStore must be used inside AppProviders");
  return ctx;
}

export function useDisplayPrefsStore(): DisplayPrefsContextValue {
  const ctx = useContext(DisplayPrefsContext);
  if (!ctx) throw new Error("useDisplayPrefsStore must be used inside AppProviders");
  return ctx;
}

export function useShelfContext(): ShelfContextValue {
  const ctx = useContext(ShelfContext);
  if (!ctx) throw new Error("useShelfContext must be used inside AppProviders");
  return ctx;
}

function useTransitionSessionRef(): RefObject<TransitionSessionState> {
  const ref = useContext(TransitionSessionContext);
  if (!ref) throw new Error("Transition hooks must be used inside AppProviders");
  return ref;
}

export interface UseShelfTransitionResult {
  lastOpenedStoryId: string | null;
  openStory: (
    storyId: string,
    options?: { restoreScrollRatio?: number; searchTarget?: SearchJumpTarget }
  ) => void;
}

/**
 * 書架画面の履歴インデックス記録・スクロール位置の追跡と復元・フォーカス復元・作品遷移を一元管理する。
 */
export function useShelfTransition(
  shelfRef: RefObject<HTMLElement | null>
): UseShelfTransitionResult {
  const navigate = useNavigate();
  const { indexData, validStoryIds } = useShelfContext();
  const sessionRef = useTransitionSessionRef();
  const hasRestoredThisMountRef = useRef(false);

  // 書架マウント時の history.state.idx を記録し、リーダーからの「← 書架へ戻る」で一括バックできるようにする
  useEffect(() => {
    const idx = getHistoryIndex();
    if (idx !== null) {
      sessionRef.current.shelfDepthInSession = idx;
    }
  }, [sessionRef]);

  // 書架データの準備完了時に1回だけスクロール位置とカードフォーカスを復元し、以後のスクロール位置を常時追跡する
  useLayoutEffect(() => {
    if (!indexData) return;
    const session = sessionRef.current;

    if (!hasRestoredThisMountRef.current) {
      hasRestoredThisMountRef.current = true;
      const targetY = session.hasVisitedShelf ? session.shelfScrollY : 0;
      window.scrollTo({ top: targetY, behavior: "instant" as ScrollBehavior });
      session.shelfScrollY = window.scrollY;
      session.hasVisitedShelf = true;

      if (session.shouldRestoreFocus) {
        session.shouldRestoreFocus = false;
        const targetLink = session.lastOpenedStoryId
          ? shelfRef.current?.querySelector<HTMLElement>(
              `.story-card[data-story-id="${CSS.escape(session.lastOpenedStoryId)}"] .card-primary-link`
            )
          : null;
        if (targetLink) {
          targetLink.focus({ preventScroll: true });
        } else {
          shelfRef.current?.focus({ preventScroll: true });
        }
      }
    }

    const handleScroll = () => {
      session.shelfScrollY = window.scrollY;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [indexData, sessionRef, shelfRef]);

  const openStory = useCallback(
    (
      storyId: string,
      options?: { restoreScrollRatio?: number; searchTarget?: SearchJumpTarget }
    ) => {
      if (!validStoryIds.has(storyId)) return;
      const session = sessionRef.current;
      session.shelfScrollY = window.scrollY;
      session.lastOpenedStoryId = storyId;
      session.shouldRestoreFocus = true;
      session.hasVisitedShelf = true;
      const idx = getHistoryIndex();
      if (idx !== null) {
        session.shelfDepthInSession = idx;
      }

      const jumpSearch = buildReaderJumpParams(options?.searchTarget);
      navigate(
        {
          pathname: `/story/${encodeURIComponent(storyId)}`,
          search: jumpSearch ? `?${jumpSearch}` : "",
        },
        {
          state:
            options?.restoreScrollRatio !== undefined
              ? { restoreScrollRatio: options.restoreScrollRatio }
              : undefined,
        }
      );
    },
    [validStoryIds, sessionRef, navigate]
  );

  return {
    lastOpenedStoryId: sessionRef.current.lastOpenedStoryId,
    openStory,
  };
}

export interface UseReaderTransitionOptions {
  story: StoryDetail | null;
  readerViewRef: RefObject<HTMLElement | null>;
}

export interface UseReaderTransitionResult {
  explicitRestoreRatio: number | null;
  allowStoredSessionRestore: boolean;
  navigationKey: string;
  backToShelf: () => void;
}

/**
 * リーダー画面への遷移パラメータ解決・ドキュメントタイトル同期・フォーカス移動・書架への復帰遷移を一元管理する。
 */
export function useReaderTransition({
  story,
  readerViewRef,
}: UseReaderTransitionOptions): UseReaderTransitionResult {
  const location = useLocation();
  const navigate = useNavigate();
  const sessionRef = useTransitionSessionRef();

  const locationState = location.state as { restoreScrollRatio?: unknown } | null;
  const explicitRestoreRatio =
    typeof locationState?.restoreScrollRatio === "number"
      ? locationState.restoreScrollRatio
      : null;

  const allowStoredSessionRestore = sessionRef.current.shelfDepthInSession === null;

  // ブラウザの戻る・進む操作で書架訪問済みセッションからリーダーへ入った場合も、書架復帰時のフォーカス復元を有効化する
  useEffect(() => {
    const session = sessionRef.current;
    const idx = getHistoryIndex();
    if (idx !== null && session.shelfDepthInSession !== null && idx <= session.shelfDepthInSession) {
      session.shelfDepthInSession = null;
    }
    if (session.hasVisitedShelf && session.lastOpenedStoryId) {
      session.shouldRestoreFocus = true;
    }
  }, [location.key, sessionRef]);

  // 作品データ取得完了時にタイトルを更新し、書架経由の遷移であればリーダー本文へフォーカスを移す
  useEffect(() => {
    if (!story) return;
    document.title = `${story.title} | テイワット文庫`;
    if (sessionRef.current.shelfDepthInSession !== null) {
      readerViewRef.current?.focus({ preventScroll: true });
    }
  }, [story, readerViewRef, sessionRef]);

  useEffect(() => {
    return () => {
      document.title = BASE_DOCUMENT_TITLE;
    };
  }, []);

  const backToShelf = useCallback(() => {
    const session = sessionRef.current;
    session.shouldRestoreFocus = true;
    const currentIdx = getHistoryIndex();
    if (
      session.shelfDepthInSession !== null &&
      currentIdx !== null &&
      currentIdx > session.shelfDepthInSession
    ) {
      navigate(session.shelfDepthInSession - currentIdx);
      return;
    }
    session.hasVisitedShelf = false;
    session.shelfScrollY = 0;
    navigate("/");
  }, [sessionRef, navigate]);

  return {
    explicitRestoreRatio,
    allowStoredSessionRestore,
    navigationKey: location.key,
    backToShelf,
  };
}
