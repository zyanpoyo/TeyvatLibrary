import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { fetchStoriesIndex } from "../api/stories";
import { DEFAULT_SHELF_FILTERS } from "../domain/catalog";
import { useDocumentThemeEffect } from "../hooks/useDocumentThemeEffect";
import { createDisplayPrefsState, type DisplayPrefSetting, type DisplayPrefsStore } from "./prefs";
import { createReadingState, type ReadingStateStore } from "./reading-state";
import type {
  DisplayPrefs,
  ReadingStateSnapshot,
  ShelfFilters,
  StoriesIndexData,
} from "../types/story";

export { DEFAULT_SHELF_FILTERS };

interface ReadingStateContextValue {
  store: ReadingStateStore;
  snapshot: ReadingStateSnapshot;
}

interface DisplayPrefsContextValue {
  prefs: DisplayPrefs;
  setPref: (setting: DisplayPrefSetting, value: string) => boolean;
}

interface ShelfContextValue {
  indexData: StoriesIndexData | null;
  indexError: string | null;
  isLoadingIndex: boolean;
  validStoryIds: ReadonlySet<string>;
  filters: ShelfFilters;
  setFilters: React.Dispatch<React.SetStateAction<ShelfFilters>>;
  resetFilters: () => void;
  shelfScrollY: number;
  setShelfScrollY: (y: number) => void;
  lastOpenedStoryId: string | null;
  setLastOpenedStoryId: (id: string | null) => void;
  shouldRestoreShelfFocus: boolean;
  setShouldRestoreShelfFocus: (flag: boolean) => void;
  shouldRestoreShelfScroll: boolean;
  setShouldRestoreShelfScroll: (flag: boolean) => void;
  annotationsEnabled: boolean;
  setAnnotationsEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  shelfDepthInSession: number | null;
  setShelfDepthInSession: (depth: number | null) => void;
}

const ReadingStateContext = createContext<ReadingStateContextValue | null>(null);
const DisplayPrefsContext = createContext<DisplayPrefsContextValue | null>(null);
const ShelfContext = createContext<ShelfContextValue | null>(null);

export interface AppProvidersProps {
  children: ReactNode;
  initialIndexData?: StoriesIndexData | null;
  readingStore?: ReadingStateStore;
  prefsStore?: DisplayPrefsStore;
}

export function AppProviders({
  children,
  initialIndexData = null,
  readingStore: externalReadingStore,
  prefsStore: externalPrefsStore,
}: AppProvidersProps) {
  const readingStoreRef = useRef<ReadingStateStore | null>(externalReadingStore ?? null);
  if (!readingStoreRef.current) {
    const store = createReadingState();
    store.load();
    readingStoreRef.current = store;
  }
  const readingStore = readingStoreRef.current;

  const prefsStoreRef = useRef<DisplayPrefsStore | null>(externalPrefsStore ?? null);
  if (!prefsStoreRef.current) {
    const store = createDisplayPrefsState();
    store.load();
    prefsStoreRef.current = store;
  }
  const prefsStore = prefsStoreRef.current;

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

  const [indexData, setIndexData] = useState<StoriesIndexData | null>(initialIndexData);
  const [indexError, setIndexError] = useState<string | null>(null);
  const [isLoadingIndex, setIsLoadingIndex] = useState<boolean>(!initialIndexData);
  const [filters, setFilters] = useState<ShelfFilters>(DEFAULT_SHELF_FILTERS);
  const [shelfScrollY, setShelfScrollY] = useState<number>(0);
  const [lastOpenedStoryId, setLastOpenedStoryId] = useState<string | null>(null);
  const [shouldRestoreShelfFocus, setShouldRestoreShelfFocus] = useState<boolean>(false);
  const [shouldRestoreShelfScroll, setShouldRestoreShelfScroll] = useState<boolean>(false);
  const [annotationsEnabled, setAnnotationsEnabled] = useState<boolean>(true);
  const [shelfDepthInSession, setShelfDepthInSession] = useState<number | null>(null);

  useEffect(() => {
    if (initialIndexData) return;
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
  }, [initialIndexData]);

  const validStoryIds = useMemo<ReadonlySet<string>>(
    () => new Set((indexData?.stories || []).map((s) => s.id)),
    [indexData]
  );

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_SHELF_FILTERS);
  }, []);

  const setPref = useCallback(
    (setting: DisplayPrefSetting, value: string) => prefsStore.set(setting, value),
    [prefsStore]
  );

  const readingContextValue = useMemo<ReadingStateContextValue>(
    () => ({ store: readingStore, snapshot: readingSnapshot }),
    [readingStore, readingSnapshot]
  );

  const prefsContextValue = useMemo<DisplayPrefsContextValue>(
    () => ({ prefs: displayPrefs, setPref }),
    [displayPrefs, setPref]
  );

  const shelfContextValue = useMemo<ShelfContextValue>(
    () => ({
      indexData,
      indexError,
      isLoadingIndex,
      validStoryIds,
      filters,
      setFilters,
      resetFilters,
      shelfScrollY,
      setShelfScrollY,
      lastOpenedStoryId,
      setLastOpenedStoryId,
      shouldRestoreShelfFocus,
      setShouldRestoreShelfFocus,
      shouldRestoreShelfScroll,
      setShouldRestoreShelfScroll,
      annotationsEnabled,
      setAnnotationsEnabled,
      shelfDepthInSession,
      setShelfDepthInSession,
    }),
    [
      indexData,
      indexError,
      isLoadingIndex,
      validStoryIds,
      filters,
      resetFilters,
      shelfScrollY,
      lastOpenedStoryId,
      shouldRestoreShelfFocus,
      shouldRestoreShelfScroll,
      annotationsEnabled,
      shelfDepthInSession,
    ]
  );

  return (
    <ReadingStateContext.Provider value={readingContextValue}>
      <DisplayPrefsContext.Provider value={prefsContextValue}>
        <ShelfContext.Provider value={shelfContextValue}>{children}</ShelfContext.Provider>
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
