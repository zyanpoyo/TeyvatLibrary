export function getStoryHash(storyId) {
  return `#story/${encodeURIComponent(storyId)}`;
}

export function getShelfUrl(href = location.href) {
  return href.split("#")[0];
}

export function parseRouteFromHash(hash = "", validStoryIds = null) {
  if (/^#chapter-\d+$/.test(hash)) {
    return { view: "chapter-anchor", storyId: null };
  }
  const match = /^#story\/(.+)$/.exec(hash);
  if (!match) {
    return { view: "shelf", storyId: null };
  }
  let rawId = match[1];
  try {
    rawId = decodeURIComponent(rawId);
  } catch {
    // Keep raw hash segment if percent-decoding fails
  }
  if (validStoryIds && !validStoryIds.has(rawId)) {
    return { view: "shelf", storyId: null };
  }
  return { view: "story", storyId: rawId };
}

export function createRouter({
  getValidStoryIds,
  getActiveRoute,
  onBeforeLeaveShelf,
  onOpenStory,
  onShowShelf,
}) {
  let currentDepth = 0;
  let shelfDepth = 0;

  function navigateToStory(storyId, { restoreScrollRatio = null } = {}) {
    const validStoryIds = getValidStoryIds();
    if (!validStoryIds.has(storyId)) return;

    const active = getActiveRoute();
    if (active.view === "story" && active.storyId === storyId) {
      window.scrollTo({ top: 0, behavior: "instant" });
      return;
    }

    if (active.view === "shelf") {
      onBeforeLeaveShelf?.(storyId);
    }

    const newDepth = currentDepth + 1;
    if (shelfDepth !== null && newDepth <= shelfDepth) {
      shelfDepth = null;
    }
    history.pushState(
      { depth: newDepth, view: "story", storyId },
      "",
      getStoryHash(storyId)
    );
    currentDepth = newDepth;
    onOpenStory(storyId, { moveFocus: true, restoreScrollRatio });
  }

  function navigateToShelf() {
    if (shelfDepth !== null && currentDepth > shelfDepth) {
      history.go(shelfDepth - currentDepth);
      return;
    }

    const newDepth = currentDepth + 1;
    shelfDepth = newDepth;
    history.pushState({ depth: newDepth, view: "shelf" }, "", getShelfUrl());
    currentDepth = newDepth;
    onShowShelf({ restoreFocus: true, restoreScroll: false });
  }

  function syncRouteFromUrl(state) {
    const validStoryIds = getValidStoryIds();
    const parsed = parseRouteFromHash(location.hash, validStoryIds);
    const active = getActiveRoute();

    if (parsed.view === "story" && parsed.storyId) {
      const { storyId } = parsed;
      if (state && typeof state.depth === "number") {
        currentDepth = state.depth;
      } else if (active.view !== "story" || active.storyId !== storyId) {
        currentDepth += 1;
        if (shelfDepth !== null && currentDepth <= shelfDepth) {
          shelfDepth = null;
        }
        history.replaceState({ depth: currentDepth, view: "story", storyId }, "");
      }
      if (active.view !== "story" || active.storyId !== storyId) {
        if (active.view === "shelf") {
          onBeforeLeaveShelf?.(storyId);
        }
        onOpenStory(storyId, { moveFocus: true });
      }
      return;
    }

    if (parsed.view === "chapter-anchor" && active.view === "story") {
      return;
    }

    if (state && typeof state.depth === "number") {
      currentDepth = state.depth;
    } else if (active.view !== "shelf") {
      currentDepth += 1;
      shelfDepth = currentDepth;
      history.replaceState({ depth: currentDepth, view: "shelf" }, "");
    }

    if (active.view !== "shelf") {
      onShowShelf({ restoreFocus: true, restoreScroll: true });
    }
  }

  async function initInitialRoute({ getInitialScrollRatio } = {}) {
    const validStoryIds = getValidStoryIds();
    const parsed = parseRouteFromHash(location.hash, validStoryIds);

    if (parsed.view === "story" && parsed.storyId) {
      const initialStoryId = parsed.storyId;
      currentDepth = 0;
      shelfDepth = null;
      history.replaceState({ depth: 0, view: "story", storyId: initialStoryId }, "");
      const restoreScrollRatio = getInitialScrollRatio
        ? getInitialScrollRatio(initialStoryId)
        : null;
      await onOpenStory(initialStoryId, { moveFocus: false, restoreScrollRatio });
    } else {
      currentDepth = 0;
      shelfDepth = 0;
      history.replaceState({ depth: 0, view: "shelf" }, "");
      onShowShelf({ restoreFocus: false, restoreScroll: false });
    }
  }

  function bindEvents() {
    window.addEventListener("popstate", (event) => {
      syncRouteFromUrl(event.state);
    });

    window.addEventListener("hashchange", () => {
      syncRouteFromUrl(history.state);
    });
  }

  return {
    navigateToStory,
    navigateToShelf,
    syncRouteFromUrl,
    initInitialRoute,
    bindEvents,
  };
}
