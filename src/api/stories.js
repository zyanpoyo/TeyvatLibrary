const indexCache = { data: null, promise: null };
const storyCache = new Map();

export async function fetchStoriesIndex() {
  if (indexCache.data) return indexCache.data;
  if (indexCache.promise) return indexCache.promise;

  indexCache.promise = fetch("./data/stories-index.json")
    .then((res) => {
      if (!res.ok) {
        throw new Error(`書架インデックスの読み込みに失敗しました (HTTP ${res.status})`);
      }
      return res.json();
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

export async function fetchStoryDetail(storyId) {
  if (storyCache.has(storyId)) {
    return storyCache.get(storyId);
  }
  const url = `./data/stories/${encodeURIComponent(storyId)}.json`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`作品「${storyId}」の読み込みに失敗しました (HTTP ${res.status})`);
  }
  const data = await res.json();
  storyCache.set(storyId, data);
  return data;
}
