import { useCallback, useEffect, useState } from "react";
import { fetchSearchIndex } from "../api/stories";
import type { SearchIndexData } from "../types/story";

export interface UseSearchIndexResult {
  searchIndex: SearchIndexData | null;
  isLoadingSearchIndex: boolean;
  ensureSearchIndex: () => void;
}

/**
 * 全文検索用の search-index.json をフォーカスまたは検索語入力時に1回だけ遅延取得して保持する。
 */
export function useSearchIndex(query: string): UseSearchIndexResult {
  const [searchIndex, setSearchIndex] = useState<SearchIndexData | null>(null);
  const [isLoadingSearchIndex, setIsLoadingSearchIndex] = useState(false);
  const [shouldFetch, setShouldFetch] = useState(() => query.trim().length > 0);

  const ensureSearchIndex = useCallback(() => {
    setShouldFetch(true);
  }, []);

  useEffect(() => {
    if (query.trim().length > 0) {
      setShouldFetch(true);
    }
  }, [query]);

  useEffect(() => {
    if (!shouldFetch || searchIndex !== null) return;

    let cancelled = false;
    setIsLoadingSearchIndex(true);

    fetchSearchIndex()
      .then((data) => {
        if (!cancelled) {
          setSearchIndex(data);
          setIsLoadingSearchIndex(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          // 取得失敗時は stories-index.json のメタデータ検索へフォールバックさせる
          setIsLoadingSearchIndex(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [shouldFetch, searchIndex]);

  return {
    searchIndex,
    isLoadingSearchIndex,
    ensureSearchIndex,
  };
}
