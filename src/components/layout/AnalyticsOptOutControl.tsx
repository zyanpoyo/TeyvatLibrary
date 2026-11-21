import { useId } from "react";
import type { AnalyticsRuntimeStatus } from "../../analytics/ga4";
import { useAnalyticsPrefsStore } from "../../state/AppProviders";
import styles from "./AnalyticsOptOutControl.module.css";

export interface AnalyticsOptOutControlProps {
  showExternalLinks?: boolean;
}

function getStatusLabel(status: AnalyticsRuntimeStatus, optOut: boolean): string {
  if (status === "active") return "計測有効";
  if (status === "opted_out") return "停止中（オプトアウト済み）";
  return optOut ? "この環境では無効（停止設定保存済み）" : "この環境では計測無効";
}

/**
 * GA4 オプトアウト切替スイッチ、現在の稼働ステータス、公式関連リンクを提供する共通コントロール。
 */
export function AnalyticsOptOutControl({ showExternalLinks = true }: AnalyticsOptOutControlProps) {
  const switchId = useId();
  const { prefs, setOptOut, runtimeStatus } = useAnalyticsPrefsStore();
  const analyticsEnabled = !prefs.optOut;
  const statusLabel = getStatusLabel(runtimeStatus, prefs.optOut);

  return (
    <>
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
          <span className={styles.statusBadge} data-analytics-status={runtimeStatus}>
            {statusLabel}
          </span>
        </div>
      </div>

      {showExternalLinks ? (
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
      ) : null}
    </>
  );
}
