import type { SearchIndexData, StoriesIndexData, StoryDetail } from "../types/story";

interface CachedEntry<T> {
  data: T | null;
  promise: Promise<T> | null;
}

function createSingletonFetcher<T>(url: string, errorLabel: string) {
  const entry: CachedEntry<T> = { data: null, promise: null };

  return {
    fetch(): Promise<T> {
      if (entry.data) return Promise.resolve(entry.data);
      if (entry.promise) return entry.promise;

      entry.promise = fetch(url)
        .then((res) => {
          if (!res.ok) {
            throw new Error(`${errorLabel} (HTTP ${res.status})`);
          }
          return res.json() as Promise<T>;
        })
        .then((data) => {
          entry.data = data;
          return data;
        })
        .finally(() => {
          entry.promise = null;
        });

      return entry.promise;
    },
    clear(): void {
      entry.data = null;
      entry.promise = null;
    },
  };
}

const storiesIndexFetcher = createSingletonFetcher<StoriesIndexData>(
  "./data/stories-index.json",
  "書架インデックスの読み込みに失敗しました"
);
const searchIndexFetcher = createSingletonFetcher<SearchIndexData>(
  "./data/search-index.json",
  "検索インデックスの読み込みに失敗しました"
);
const storyCache = new Map<string, StoryDetail>();

/** テスト用のキャッシュ初期化ヘルパー */
export function clearStoriesCache(): void {
  storiesIndexFetcher.clear();
  searchIndexFetcher.clear();
  storyCache.clear();
}

export function fetchStoriesIndex(): Promise<StoriesIndexData> {
  return storiesIndexFetcher.fetch();
}

export function fetchSearchIndex(): Promise<SearchIndexData> {
  return searchIndexFetcher.fetch();
}

export async function fetchStoryDetail(storyId: string): Promise<StoryDetail> {
  const cached = storyCache.get(storyId);
  if (cached) {
    return cached;
  }
  const url = `./data/stories/${encodeURIComponent(storyId)}.json`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`作品「${storyId}」の読み込みに失敗しました (HTTP ${res.status})`);
  }
  const data = (await res.json()) as StoryDetail;
  storyCache.set(storyId, data);
  return data;
}
