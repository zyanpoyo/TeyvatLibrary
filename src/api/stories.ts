import type { StoriesIndexData, StoryDetail } from "../types/story";

let indexCache: { data: StoriesIndexData | null; promise: Promise<StoriesIndexData> | null } = {
  data: null,
  promise: null,
};
const storyCache = new Map<string, StoryDetail>();

/** テスト用のキャッシュ初期化ヘルパー */
export function clearStoriesCache(): void {
  indexCache = { data: null, promise: null };
  storyCache.clear();
}

export async function fetchStoriesIndex(): Promise<StoriesIndexData> {
  if (indexCache.data) return indexCache.data;
  if (indexCache.promise) return indexCache.promise;

  indexCache.promise = fetch("./data/stories-index.json")
    .then((res) => {
      if (!res.ok) {
        throw new Error(`書架インデックスの読み込みに失敗しました (HTTP ${res.status})`);
      }
      return res.json() as Promise<StoriesIndexData>;
    })
    .then((data) => {
      indexCache.data = data;
      return data;
    })
    .finally(() => {
      indexCache.promise = null;
    });

  return indexCache.promise;
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
