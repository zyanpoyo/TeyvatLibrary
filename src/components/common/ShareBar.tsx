import { useCallback, useEffect, useRef, useState } from "react";
import type { StoryShareMethod } from "../../analytics/ga4";
import commonStyles from "../../styles/common.module.css";
import { AppIcon } from "./AppIcon";
import styles from "./ShareBar.module.css";

export interface ShareBarProps {
  id: string;
  ariaLabel: string;
  shareUrl: string;
  xIntentUrl: string;
  xActionName: string;
  copyActionName: string;
  resetKey: string;
  onShare?: (method: StoryShareMethod) => void;
}

const FEEDBACK_DURATION_MS = 2200;

/**
 * 作品詳細・コース詳細で共有利用する X シェア／URL コピーバー。
 */
export function ShareBar({
  id,
  ariaLabel,
  shareUrl,
  xIntentUrl,
  xActionName,
  copyActionName,
  resetKey,
  onShare,
}: ShareBarProps) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [statusText, setStatusText] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAnnouncedRef = useRef("");

  useEffect(() => {
    setCopyState("idle");
    setStatusText("");
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, [resetKey]);

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
    <div className={styles.shareBar} id={id} aria-label={ariaLabel}>
      <a
        href={xIntentUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`${commonStyles.controlPill} ${styles.shareAction}`}
        data-action={xActionName}
        onClick={() => onShare?.("x")}
      >
        <AppIcon name="share" />
        <span>X でシェア</span>
      </a>

      <span className={styles.copyGroup}>
        <button
          type="button"
          className={`${commonStyles.controlPill} ${styles.shareAction}`}
          data-action={copyActionName}
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
