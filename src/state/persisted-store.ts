export interface PersistedStoreOptions<T> {
  key: string;
  createDefault: () => T;
  deserialize: (raw: unknown) => T;
  deferInitialLoad?: boolean;
}

export interface PersistedStoreCore<T> {
  load(): T;
  commit(nextState: T): void;
  getSnapshot(): T;
  subscribe(listener: () => void): () => void;
}

/**
 * localStorage 永続化・例外安全な復元・別タブ間の storage イベント購読を一元管理するストア基盤。
 */
export function createPersistedStore<T>({
  key,
  createDefault,
  deserialize,
  deferInitialLoad = false,
}: PersistedStoreOptions<T>): PersistedStoreCore<T> {
  const listeners = new Set<() => void>();

  function readFromStorage(): T {
    try {
      if (typeof localStorage !== "undefined") {
        const raw = localStorage.getItem(key);
        if (raw) {
          return deserialize(JSON.parse(raw));
        }
      }
    } catch {
      // 制限環境や破損JSON時はデフォルト状態へ安全にフォールバックする
    }
    return createDefault();
  }

  function writeToStorage(value: T): void {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(key, JSON.stringify(value));
      }
    } catch {
      // 制限環境での書き込み失敗は無視してメモリ上の状態を維持する
    }
  }

  let state: T = deferInitialLoad ? createDefault() : readFromStorage();

  function emit(): void {
    for (const listener of listeners) {
      listener();
    }
  }

  function load(): T {
    state = readFromStorage();
    emit();
    return state;
  }

  function commit(nextState: T): void {
    state = nextState;
    writeToStorage(state);
    emit();
  }

  function getSnapshot(): T {
    return state;
  }

  function handleStorageEvent(event: StorageEvent): void {
    if (event.key === key || event.key === null) {
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
    commit,
    getSnapshot,
    subscribe,
  };
}
