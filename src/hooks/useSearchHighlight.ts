import { useLayoutEffect, useMemo, useRef, type RefObject } from "react";
import { useLocation } from "react-router";
import { parseReaderJumpParams } from "../router/search-params";
import type { SearchJumpTarget, StoryDetail } from "../types/story";

const FOCUS_HIGHLIGHT_DURATION_MS = 2200;

export interface UseSearchHighlightOptions {
  story: StoryDetail | null;
  chaptersContainerRef: RefObject<HTMLDivElement | null>;
  loreDetailsRef: RefObject<HTMLDetailsElement | null>;
  isProgrammaticLoreOpenRef: RefObject<boolean>;
  onScrollSettled?: () => void;
  isHydrated?: boolean;
}

export interface UseSearchHighlightResult {
  searchTarget: SearchJumpTarget | null;
  hasSearchTarget: boolean;
  highlightQuery: string;
}

function findJumpTargetElement(
  target: SearchJumpTarget,
  chaptersContainer: HTMLDivElement | null,
  loreDetails: HTMLDetailsElement | null
): HTMLElement | null {
  if (target.kind === "truth") {
    return loreDetails;
  }

  if (target.kind === "preGuide") {
    return document.getElementById("reader-pre-guide");
  }

  if (target.kind === "glossary" && target.termId && chaptersContainer) {
    const escapedTermId =
      typeof CSS !== "undefined" && typeof CSS.escape === "function"
        ? CSS.escape(target.termId)
        : target.termId;
    const termEl = chaptersContainer.querySelector<HTMLElement>(
      `[data-term-id="${escapedTermId}"]`
    );
    if (termEl) return termEl;
  }

  if (chaptersContainer && target.chapterIndex !== undefined) {
    if (target.paragraphIndex !== undefined) {
      const paragraphEl = chaptersContainer.querySelector<HTMLElement>(
        `[data-chapter-index="${target.chapterIndex}"][data-paragraph-index="${target.paragraphIndex}"]`
      );
      if (paragraphEl) return paragraphEl;
    }
    const chapterEl = document.getElementById(`chapter-${target.chapterIndex + 1}`);
    if (chapterEl) return chapterEl;
  }

  return chaptersContainer?.querySelector<HTMLElement>("mark") ?? null;
}

/**
 * 検索結果からリーダー画面へ遷移した際の該当箇所スクロール・真相メモ展開・一時フォーカス強調を管理する。
 */
export function useSearchHighlight({
  story,
  chaptersContainerRef,
  loreDetailsRef,
  isProgrammaticLoreOpenRef,
  onScrollSettled,
  isHydrated = true,
}: UseSearchHighlightOptions): UseSearchHighlightResult {
  const location = useLocation();
  const effectiveSearch = isHydrated ? location.search : "";

  const searchTarget = useMemo(
    () => parseReaderJumpParams(effectiveSearch),
    [effectiveSearch]
  );
  const handledKeyRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    if (!story || !searchTarget) return;

    const jumpKey = `${story.id}:${location.key}:${location.search}`;
    if (handledKeyRef.current === jumpKey) return;
    handledKeyRef.current = jumpKey;

    if (searchTarget.kind === "truth" && loreDetailsRef.current && !loreDetailsRef.current.open) {
      isProgrammaticLoreOpenRef.current = true;
      loreDetailsRef.current.open = true;
    }

    const targetEl = findJumpTargetElement(
      searchTarget,
      chaptersContainerRef.current,
      loreDetailsRef.current
    );

    let rafId: number | null = null;
    let timerId: ReturnType<typeof setTimeout> | null = null;

    const scrollToTarget = () => {
      if (targetEl && typeof targetEl.scrollIntoView === "function") {
        const reduceMotion =
          typeof window.matchMedia === "function" &&
          window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        targetEl.scrollIntoView({
          behavior: (reduceMotion ? "instant" : "auto") as ScrollBehavior,
          block: "center",
        });
      }
      onScrollSettled?.();
    };

    if (targetEl) {
      targetEl.setAttribute("data-search-focus", "true");
      scrollToTarget();
      rafId = requestAnimationFrame(scrollToTarget);
      timerId = setTimeout(() => {
        targetEl.removeAttribute("data-search-focus");
      }, FOCUS_HIGHLIGHT_DURATION_MS);
    } else {
      onScrollSettled?.();
    }

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (timerId !== null) clearTimeout(timerId);
      targetEl?.removeAttribute("data-search-focus");
    };
  }, [
    story,
    searchTarget,
    location.key,
    location.search,
    chaptersContainerRef,
    loreDetailsRef,
    isProgrammaticLoreOpenRef,
    onScrollSettled,
  ]);

  return {
    searchTarget,
    hasSearchTarget: Boolean(searchTarget),
    highlightQuery: searchTarget?.query ?? "",
  };
}
