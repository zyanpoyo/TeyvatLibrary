import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { flushSync } from "react-dom";
import {
  evaluateNavVisibility,
  INITIAL_NAV_SCROLL_STATE,
  type NavScrollState,
} from "../domain/scroll-session";

export function useAutoHideNav(
  navRowRef: RefObject<HTMLElement | null>,
  isMounted: boolean,
  isDisplayPopoverOpen: boolean,
  storyId: string | undefined
): { isNavHidden: boolean; resetNavVisibility: () => void } {
  const [isNavHidden, setIsNavHidden] = useState(false);
  const navStateRef = useRef<NavScrollState>(INITIAL_NAV_SCROLL_STATE);

  const resetNavVisibility = useCallback(() => {
    navStateRef.current = INITIAL_NAV_SCROLL_STATE;
    setIsNavHidden(false);
  }, []);

  useEffect(() => {
    resetNavVisibility();
  }, [storyId, resetNavVisibility]);

  useEffect(() => {
    if (isDisplayPopoverOpen) {
      navStateRef.current = { ...navStateRef.current, isHidden: false };
      setIsNavHidden(false);
    }
  }, [isDisplayPopoverOpen]);

  useEffect(() => {
    if (!isMounted) return;

    const handleScroll = () => {
      const navEl = navRowRef.current;
      if (!navEl) return;
      const maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      const hideThreshold = navEl.offsetHeight + 24;
      const prevHidden = navStateRef.current.isHidden;
      const { isHidden, nextState } = evaluateNavVisibility(
        navStateRef.current,
        window.scrollY,
        maxY,
        hideThreshold,
        isDisplayPopoverOpen
      );
      navStateRef.current = nextState;
      if (isHidden !== prevHidden) {
        flushSync(() => {
          setIsNavHidden(isHidden);
        });
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [isMounted, navRowRef, isDisplayPopoverOpen]);

  return { isNavHidden, resetNavVisibility };
}
