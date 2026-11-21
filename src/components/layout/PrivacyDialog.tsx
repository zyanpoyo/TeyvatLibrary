import * as Dialog from "@radix-ui/react-dialog";
import { useId } from "react";
import type { AnalyticsRuntimeStatus } from "../../analytics/ga4";
import { useAnalyticsPrefsStore } from "../../state/AppProviders";
import styles from "./PrivacyDialog.module.css";

export interface PrivacyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function getStatusLabel(status: AnalyticsRuntimeStatus, optOut: boolean): string {
  if (status === "active") return "計測有効";
  if (status === "opted_out") return "停止中（オプトアウト済み）";
  return optOut ? "この環境では無効（停止設定保存済み）" : "この環境では計測無効";
}

export function PrivacyDialog({ open, onOpenChange }: PrivacyDialogProps) {
  const switchId = useId();
  const { prefs, setOptOut, runtimeStatus } = useAnalyticsPrefsStore();
  const analyticsEnabled = !prefs.optOut;
  const statusLabel = getStatusLabel(runtimeStatus, prefs.optOut);

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

          <div className={styles.toggleCard}>
            <div className={styles.toggleRow}>
              <label htmlFor={switchId} className={styles.toggleLabel}>
                アクセス解析（Google Analytics）を有効にする
              </label>
              <input
                id={switchId}
                type="checkbox"
                role="switch"
                className={styles.switchInput}
                checked={analyticsEnabled}
                onChange={(e) => setOptOut(!e.target.checked)}
              />
            </div>
            <div className={styles.statusRow}>
              <span>現在：</span>
              <span
                className={styles.statusBadge}
                data-analytics-status={runtimeStatus}
              >
                {statusLabel}
              </span>
            </div>
          </div>

          <div className={styles.linksSection}>
            <ul className={styles.linksList}>
              <li>
                <a
                  className={styles.externalLink}
                  href="https://policies.google.com/technologies/partner-sites?hl=ja"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Google のサービスを使用するサイトやアプリから収集した情報の Google による使用
                </a>
              </li>
              <li>
                <a
                  className={styles.externalLink}
                  href="https://tools.google.com/dlpage/gaoptout?hl=ja"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Google アナリティクス オプトアウト アドオン
                </a>
              </li>
            </ul>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
