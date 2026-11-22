import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { StoryShareMethod } from "../../analytics/ga4";
import { buildStoryShareUrl, buildXShareIntentUrl } from "../../domain/share";
import commonStyles from "../../styles/common.module.css";
import type { StoryDetail } from "../../types/story";
import { AppIcon } from "../common/AppIcon";
import styles from "./StoryShareBar.module.css";

export interface StoryShareBarProps {
  story: Pick<StoryDetail, "id" | "title" | "shelfCategory" | "categoryLabel" | "tags">;
  onShare?: (method: StoryShareMethod) => void;
}

const FEEDBACK_DURATION_MS = 2200;

/**
 * リーダー末尾に控えめに配置する作品単位のシェアバー（X シェア／URL コピー）。
 */
export function StoryShareBar({ story, onShare }: StoryShareBarProps) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [statusText, setStatusText] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAnnouncedRef = useRef("");

  const shareUrl = useMemo(() => buildStoryShareUrl(story.id), [story.id]);
  const xIntentUrl = useMemo(() => buildXShareIntentUrl(story), [story]);

  useEffect(() => {
    setCopyState("idle");
    setStatusText("");
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, [story.id]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const announceResult = useCallback((ok: boolean) => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }

    const baseMessage = ok ? "URL をコピーしました" : "コピーできませんでした";
    const nextMessage =
      baseMessage === lastAnnouncedRef.current ? `${baseMessage}\u00A0` : baseMessage;
    lastAnnouncedRef.current = nextMessage;

    setCopyState(ok ? "copied" : "failed");
    setStatusText(nextMessage);

    timerRef.current = setTimeout(() => {
      setCopyState("idle");
      setStatusText("");
      timerRef.current = null;
    }, FEEDBACK_DURATION_MS);
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      const clipboard = typeof navigator !== "undefined" ? navigator.clipboard : undefined;
      if (!clipboard || typeof clipboard.writeText !== "function") {
        throw new Error("Clipboard API unavailable");
      }
      await clipboard.writeText(shareUrl);
      announceResult(true);
      onShare?.("copy");
    } catch {
      announceResult(false);
    }
  }, [shareUrl, announceResult, onShare]);

  return (
    <div className={styles.shareBar} id="story-share-bar" aria-label="作品を共有">
      <a
        href={xIntentUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`${commonStyles.controlPill} ${styles.shareAction}`}
        data-action="share-story-x"
        onClick={() => onShare?.("x")}
      >
        <AppIcon name="share" />
        <span>X でシェア</span>
      </a>

      <span className={styles.copyGroup}>
        <button
          type="button"
          className={`${commonStyles.controlPill} ${styles.shareAction}`}
          data-action="copy-story-url"
          data-copied={copyState === "copied" ? "true" : undefined}
          data-failed={copyState === "failed" ? "true" : undefined}
          onClick={handleCopy}
        >
          <AppIcon name={copyState === "copied" ? "check" : "copy-link"} />
          <span>URL をコピー</span>
        </button>
        <span
          role="status"
          className={styles.copyStatus}
          data-visible={statusText ? "true" : "false"}
          data-error={copyState === "failed" ? "true" : "false"}
        >
          {statusText}
        </span>
      </span>
    </div>
  );
}
