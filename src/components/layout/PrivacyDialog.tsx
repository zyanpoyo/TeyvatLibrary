import * as Dialog from "@radix-ui/react-dialog";
import { AnalyticsOptOutControl } from "./AnalyticsOptOutControl";
import styles from "./PrivacyDialog.module.css";

export interface PrivacyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PrivacyDialog({ open, onOpenChange }: PrivacyDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.dialogOverlay} />
        <Dialog.Content id="privacy-dialog" className={styles.privacyDialog}>
          <div className={styles.dialogHeader}>
            <Dialog.Title asChild>
              <h2 className={styles.dialogTitle}>アクセス解析について</h2>
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                className={`${styles.closeBtn} privacy-dialog-close`}
              >
                <span aria-hidden="true">✕</span> 閉じる
              </button>
            </Dialog.Close>
          </div>

          <Dialog.Description className={styles.leadText}>
            テイワット文庫は、収録作品の充実や読みやすさ改善のために Google Analytics（GA4）を用いて利用状況を計測しています。
          </Dialog.Description>

          <p className={styles.detailText}>
            記録されるのは閲覧ページ、物語の開封導線・読了、検索語句、絞り込み操作、用語ガイドの利用状況などの匿名データです。氏名・メールアドレス等の個人を特定する情報は収集しません。
          </p>

          <AnalyticsOptOutControl />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
