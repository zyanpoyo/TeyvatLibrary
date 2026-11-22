import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Link, useLocation } from "react-router";
import { analytics } from "../../analytics/ga4";
import {
  readDefaultSiteContactConfig,
  type SiteContactConfig,
} from "../../config/site-contact";
import { ABOUT_DOCUMENT_TITLE } from "../../domain/seo";
import { BASE_DOCUMENT_TITLE } from "../../state/AppProviders";
import { AnalyticsOptOutControl } from "../layout/AnalyticsOptOutControl";
import styles from "./AboutPage.module.css";

export { ABOUT_DOCUMENT_TITLE };

interface AboutTocItem {
  readonly id: string;
  readonly label: string;
}

const ABOUT_TOC_ITEMS: ReadonlyArray<AboutTocItem> = [
  { id: "about-site", label: "当サイトについて" },
  { id: "about-copyright", label: "著作権・引用について" },
  { id: "about-analytics", label: "アクセス解析ツール" },
  { id: "about-storage", label: "ブラウザのデータ保存" },
  { id: "about-disclaimer", label: "免責事項" },
  { id: "about-contact", label: "お問い合わせ" },
];

export interface AboutPageProps {
  contactConfig?: SiteContactConfig;
}

/**
 * 運営方針・権利表記・アクセス解析設定・localStorage説明・免責・連絡先を案内する About ページ。
 */
export function AboutPage({ contactConfig }: AboutPageProps) {
  const location = useLocation();
  const lastTrackedKeyRef = useRef<string | null>(null);

  const resolvedContact = useMemo(
    () => contactConfig ?? readDefaultSiteContactConfig(),
    [contactConfig]
  );

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [location.key]);

  useEffect(() => {
    document.title = ABOUT_DOCUMENT_TITLE;
    return () => {
      document.title = BASE_DOCUMENT_TITLE;
    };
  }, []);

  useEffect(() => {
    if (lastTrackedKeyRef.current === location.key) return;
    lastTrackedKeyRef.current = location.key;
    analytics.trackPageView({
      pagePath: "/about",
      pageTitle: ABOUT_DOCUMENT_TITLE,
    });
  }, [location.key]);

  const handleTocClick = (sectionId: string) => {
    const section = document.getElementById(sectionId);
    if (!section) return;
    const reduceMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    section.scrollIntoView({
      behavior: (reduceMotion ? "instant" : "smooth") as ScrollBehavior,
      block: "start",
    });
    const heading = document.getElementById(`${sectionId}-heading`);
    heading?.focus({ preventScroll: true });
  };

  return (
    <article id="about-view" className={styles.aboutView}>
      <nav className={styles.aboutNavRow} aria-label="ページ遷移">
        <Link to="/" id="about-back-to-shelf-link" className={styles.backLink}>
          ← 書架へ戻る
        </Link>
      </nav>

      <header className={styles.aboutHeader}>
        <p className={styles.aboutEyebrow} aria-hidden="true">
          ✦ About ✦
        </p>
        <h1 className={styles.aboutTitle}>このサイトについて</h1>
        <p className={styles.aboutLead}>
          テイワット文庫の運営方針、著作権・引用の扱い、アクセス解析・データ保存、お問い合わせ先をご案内します。
        </p>
      </header>

      <nav className={styles.tocNav} aria-label="このページの目次">
        {ABOUT_TOC_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={styles.tocPill}
            data-target-section={item.id}
            onClick={() => handleTocClick(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className={styles.sectionsContainer}>
        <section id="about-site" className={styles.aboutSection}>
          <h2 id="about-site-heading" className={styles.sectionHeading} tabIndex={-1}>
            当サイトについて
          </h2>
          <p className={styles.bodyText}>
            「テイワット文庫」は、『原神（Genshin Impact）』ゲーム内の書籍・聖遺物・武器・風の翼・突破育成素材などに収録されているテキストを、小説を読む感覚で通読できるよう整理した、個人運営による非営利の二次創作・非公式ファンアーカイブサイトです。
          </p>
          <p className={styles.bodyText}>
            当サイトは、株式会社COGNOSPHERE（COGNOSPHERE PTE. LTD.）および HoYoverse グループ各社とは一切関係がなく、公式に承認・提携されたサービスではありません。
          </p>
        </section>

        <section id="about-copyright" className={styles.aboutSection}>
          <h2 id="about-copyright-heading" className={styles.sectionHeading} tabIndex={-1}>
            著作権・引用について
          </h2>
          <p className={styles.bodyText}>
            当サイトに掲載している『原神』のゲーム内テキスト、設定、固有名詞および用語等の著作権・知的財産権は、すべて株式会社COGNOSPHERE（COGNOSPHERE PTE. LTD. / HoYoverse）に帰属します。
          </p>
          <p className={styles.bodyText}>
            当サイトは非営利のファン活動・解説および閲覧補助を目的として、ゲーム内テキストの原文を改変せず出典を明示したうえで、著作権法（第32条の引用の趣旨等）および公式ガイドラインに配慮して運用しています。権利者様からの削除・修正のご要請があった場合は、確認次第速やかに対応いたします。
          </p>
          <p className={styles.bodyText}>
            当サイト独自の解説文章（読む前の前提ガイド、用語ガイド、章補足メモ、真相・考察メモ等）および物語構成の著作権は当サイト運営者に帰属します。出典（サイト名・URL）を明記したうえでの引用・紹介は差し支えありませんが、解説文章の無断転載はご遠慮ください。なお、当サイトのアプリケーションソースコードは公開リポジトリ記載の MIT License に基づき提供しています。
          </p>
        </section>

        <section id="about-analytics" className={styles.aboutSection}>
          <h2 id="about-analytics-heading" className={styles.sectionHeading} tabIndex={-1}>
            アクセス解析ツールについて
          </h2>
          <p className={styles.bodyText}>
            テイワット文庫では、収録作品の充実や読みやすさの改善を目的として、アクセス解析ツール「Google Analytics 4（GA4）」を利用しています。
          </p>
          <p className={styles.bodyText}>
            Google Analytics はトラフィックデータの収集のために Cookie を使用することがあります。記録されるのは閲覧ページ、物語の開封導線・読了、検索語句（メールアドレスや電話番号に類する文字列には簡易マスク処理を実施）、絞り込み操作などの匿名データであり、氏名・メールアドレス等の個人を特定する情報は収集しません。
          </p>
          <p className={styles.bodyText}>
            データ収集は、お使いのブラウザ設定による Cookie の無効化、Google 公式のオプトアウトアドオン、または下のスイッチからいつでも停止できます。サイト内スイッチで停止した場合は設定がブラウザの <code>localStorage</code> に保存され、既存の Google Analytics 用 Cookie も削除されます。
          </p>
          <div className={styles.controlWrapper}>
            <AnalyticsOptOutControl />
          </div>
        </section>

        <section id="about-storage" className={styles.aboutSection}>
          <h2 id="about-storage-heading" className={styles.sectionHeading} tabIndex={-1}>
            ブラウザのデータ保存（localStorage）について
          </h2>
          <p className={styles.bodyText}>
            当サイトではアカウント登録やログイン機能を持たず、快適な閲覧体験を提供するためにお使いのブラウザの <code>localStorage</code> に以下の設定・記録を保存します。これらのデータはご利用端末のブラウザ内にのみ保存され、外部サーバーへ送信されることはありません。
          </p>
          <ul className={styles.infoList}>
            <li>
              <strong>読書状態</strong>：読了済み作品の記録、「あとで読む」ブックマーク、最後に読んでいた物語・章・スクロール位置（途中しおり）
            </li>
            <li>
              <strong>表示設定</strong>：文字サイズ（小・標準・大）、書体（明朝・ゴシック）、背景テーマ（夜空・生成り紙・セピア）
            </li>
            <li>
              <strong>アクセス解析設定</strong>：サイト内オプトアウト（計測停止）の選択状態
            </li>
          </ul>
          <p className={styles.bodyText}>
            保存されたデータは、ブラウザの設定メニューにある「サイトデータ」または「閲覧履歴データの削除」からいつでも消去できます。なお、プライベートブラウジングやストレージが制限された環境では記録が保持されない場合がありますが、物語の閲覧自体は問題なくご利用いただけます。
          </p>
        </section>

        <section id="about-disclaimer" className={styles.aboutSection}>
          <h2 id="about-disclaimer-heading" className={styles.sectionHeading} tabIndex={-1}>
            免責事項
          </h2>
          <p className={styles.bodyText}>
            当サイトに掲載するゲーム内テキストの正確性や用語解説の整合性には細心の注意を払っていますが、ゲームのアップデート・翻訳改定・仕様変更等により最新の内容と異なる場合や、解説・考察に誤りが含まれる場合があります。
          </p>
          <p className={styles.bodyText}>
            当サイトの利用、または利用できなかったことにより生じたいかなる損害についても、運営者は一切の責任を負いかねます。また、当サイトからリンクや移動先として案内される外部サイトで提供される情報・サービスについても、一切の責任を負いません。
          </p>
          <p className={styles.bodyText}>
            当サイトの内容・構成は予告なく変更、削除、または公開を停止する場合があります。あらかじめご了承ください。
          </p>
        </section>

        <section id="about-contact" className={styles.aboutSection}>
          <h2 id="about-contact-heading" className={styles.sectionHeading} tabIndex={-1}>
            お問い合わせ
          </h2>
          <p className={styles.bodyText}>
            権利者様からの削除・修正のご要請、誤記・リンク切れ・表示不具合のご報告、収録作品のリクエストなどは以下の窓口よりご連絡ください。すべてのご連絡への返信を確約するものではありませんが、権利者様からのご連絡には確認次第速やかに対応いたします。
          </p>
          <ul className={styles.contactList}>
            <li className={styles.contactItem}>
              <span className={styles.contactLabel}>不具合報告・収録リクエスト（GitHub Issues）</span>
              <a
                href={resolvedContact.githubIssuesUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.contactLink}
              >
                GitHub Issues で報告・確認する
              </a>
            </li>
            {resolvedContact.contactFormUrl ? (
              <li className={styles.contactItem}>
                <span className={styles.contactLabel}>
                  権利者様からの削除申請・個別のお問い合わせ（専用フォーム）
                </span>
                <a
                  href={resolvedContact.contactFormUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.contactLink}
                >
                  お問い合わせフォームを開く
                </a>
              </li>
            ) : null}
            {resolvedContact.contactXUrl ? (
              <li className={styles.contactItem}>
                <span className={styles.contactLabel}>
                  運営者（{resolvedContact.operatorName}）・SNS
                </span>
                <a
                  href={resolvedContact.contactXUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.contactLink}
                >
                  @{resolvedContact.operatorName}（X / 旧Twitter）
                </a>
              </li>
            ) : null}
            {resolvedContact.contactEmail ? (
              <li className={styles.contactItem}>
                <span className={styles.contactLabel}>連絡用メールアドレス</span>
                <a
                  href={`mailto:${resolvedContact.contactEmail}`}
                  className={styles.contactLink}
                >
                  {resolvedContact.contactEmail}
                </a>
              </li>
            ) : null}
          </ul>
        </section>
      </div>
    </article>
  );
}
