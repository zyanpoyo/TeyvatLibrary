import * as Dialog from "@radix-ui/react-dialog";
import { Link } from "react-router";
import { parseEvidenceTokens } from "../../domain/text-parser";
import type { GlossaryEntry } from "../../types/story";
import styles from "./PopoverAndDialog.module.css";

export interface GlossaryDialogProps {
  storyId: string;
  termId: string | null;
  entry: GlossaryEntry | null;
  onClose: () => void;
}

export function GlossaryDialog({ storyId, termId, entry, onClose }: GlossaryDialogProps) {
  const isOpen = Boolean(termId && entry);
  const popoverId = termId ? `pop-${storyId}-${termId}` : undefined;
  const titleId = popoverId ? `${popoverId}-title` : undefined;
  const evidenceTokens = entry?.evidence
    ? parseEvidenceTokens(entry.evidence, entry.evidenceLinks)
    : [];

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className={styles.dialogOverlay} />
        <Dialog.Content
          id={popoverId}
          className={`${styles.termDialog} term-popover`}
          aria-labelledby={titleId}
          aria-describedby={undefined}
        >
          {entry ? (
            <>
              <div className={styles.popoverHeader}>
                <Dialog.Title asChild>
                  <h3 className={styles.popoverTermTitle} id={titleId}>
                    「{entry.term}」
                  </h3>
                </Dialog.Title>
                <Dialog.Close asChild>
                  <button type="button" className={`${styles.popoverClose} popover-close`}>
                    ✕ 閉じる
                  </button>
                </Dialog.Close>
              </div>
              <p className={styles.popoverIdentity}>{entry.identity}</p>
              <p className={styles.popoverDesc}>{entry.desc}</p>
              {evidenceTokens.length > 0 ? (
                <p className={styles.popoverEvidence}>
                  📚 出典・根拠：
                  {evidenceTokens.map((token, idx) =>
                    token.type === "link" ? (
                      <Link
                        key={`${token.storyId}-${idx}`}
                        className={`${styles.evidenceLink} evidence-link`}
                        to={`/story/${encodeURIComponent(token.storyId)}`}
                        data-target-id={token.storyId}
                        onClick={onClose}
                      >
                        『{token.title}』
                      </Link>
                    ) : (
                      <span key={`txt-${idx}`}>{token.value}</span>
                    )
                  )}
                </p>
              ) : null}
            </>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
