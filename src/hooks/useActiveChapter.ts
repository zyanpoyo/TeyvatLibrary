import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { resolveClosestChapterIndex } from "../domain/scroll-session";
import type { StoryDetail } from "../types/story";

export interface UseActiveChapterResult {
  currentChapterIndex: number;
  currentChapterLabel: string;
  resolveActiveChapter: () => number;
}

export function useActiveChapter(
  story: StoryDetail | null,
  chaptersContainerRef: RefObject<HTMLElement | null>
): UseActiveChapterResult {
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const currentIndexRef = useRef(0);
  const chapters = story?.chapters ?? [];

  const resolveActiveChapter = useCallback((): number => {
    const container = chaptersContainerRef.current;
    if (!container || chapters.length === 0) {
      currentIndexRef.current = 0;
      setCurrentChapterIndex(0);
      return 0;
    }

    const sections = container.querySelectorAll<HTMLElement>(".chapter-section");
    if (sections.length === 0) {
      currentIndexRef.current = 0;
      setCurrentChapterIndex(0);
      return 0;
    }

    const rects = Array.from(sections, (el) => {
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom };
    });

    const nextIndex = resolveClosestChapterIndex(
      rects,
      window.scrollY,
      document.documentElement.scrollHeight,
      window.innerHeight,
      currentIndexRef.current
    );

    if (nextIndex !== currentIndexRef.current) {
      currentIndexRef.current = nextIndex;
      setCurrentChapterIndex(nextIndex);
    }
    return nextIndex;
  }, [chaptersContainerRef, chapters.length]);

  useEffect(() => {
    currentIndexRef.current = 0;
    setCurrentChapterIndex(0);

    const container = chaptersContainerRef.current;
    if (!story || !container || chapters.length <= 1 || typeof IntersectionObserver === "undefined") {
      return;
    }

    const sections = container.querySelectorAll<HTMLElement>(".chapter-section");
    if (sections.length <= 1) return;

    const observer = new IntersectionObserver(
      () => {
        resolveActiveChapter();
      },
      {
        rootMargin: "-18% 0px -22% 0px",
        threshold: 0,
      }
    );

    sections.forEach((section) => observer.observe(section));
    return () => {
      observer.disconnect();
    };
  }, [story, chapters.length, chaptersContainerRef, resolveActiveChapter]);

  const currentChapterLabel = chapters[currentChapterIndex]?.partLabel ?? "";

  return {
    currentChapterIndex,
    currentChapterLabel,
    resolveActiveChapter,
  };
}
