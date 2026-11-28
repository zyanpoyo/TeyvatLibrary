import * as Dialog from "@radix-ui/react-dialog";
import { Link } from "react-router";
import commonStyles from "../../styles/common.module.css";
import type { GlossaryEntry } from "../../types/story";
import { AppIcon } from "../common/AppIcon";
import { EvidenceText } from "../common/EvidenceText";
import styles from "./PopoverAndDialog.module.css";

export interface GlossaryDialogProps {
  storyId: string;
  termId: string | null;
  entry: GlossaryEntry | null;
  onClose: () => void;
  onSelectEvidenceLink?: (targetId: string) => void;
}

export function GlossaryDialog({
  storyId,
  termId,
  entry,
  onClose,
  onSelectEvidenceLink,
}: GlossaryDialogProps) {
  const isOpen = Boolean(termId && entry);
  const popoverId = termId ? `pop-${storyId}-${termId}` : undefined;
  const titleId = popoverId ? `${popoverId}-title` : undefined;

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
              {entry.evidence ? (
                <p className={styles.popoverEvidence}>
                  <AppIcon name="books" className={styles.evidenceIcon} />
                  出典・根拠：
                  <EvidenceText
                    evidence={entry.evidence}
                    evidenceLinks={entry.evidenceLinks}
                    linkClassName={styles.evidenceLink}
                    onSelectEvidenceLink={(targetStoryId) => {
                      onSelectEvidenceLink?.(targetStoryId);
                      onClose();
                    }}
                  />
                </p>
              ) : null}
              {entry.entityId ? (
                <div className={styles.popoverFooter}>
                  <Link
                    to={`/entities/${encodeURIComponent(entry.entityId)}`}
                    className={`${commonStyles.goldPillLink} glossary-entity-link`}
                    data-entity-id={entry.entityId}
                    onClick={onClose}
                  >
                    <span>人物・用語名鑑で詳しく見る</span>
                    <span aria-hidden="true">→</span>
                  </Link>
                </div>
              ) : null}
            </>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
