import { Fragment, type MouseEvent, type RefObject } from "react";
import { Link } from "react-router";
import { formatRegion, parseParagraphTokens } from "../../domain/text-parser";
import commonStyles from "../../styles/common.module.css";
import type { StoryDetail } from "../../types/story";
import styles from "./ReaderArticle.module.css";

function getReadButtonLabel(isRead: boolean, isCompletionBtn: boolean): string {
  if (isCompletionBtn) {
    return isRead ? "✦ 読了済み（クリックで未読に戻す）" : "✧ この作品を読了にする";
  }
  return isRead ? "✦ 読了済み" : "✧ 読了にする";
}

function ParagraphBlock({
  text,
  onSelectTerm,
}: {
  text: string;
  onSelectTerm: (termId: string) => void;
}) {
  const tokens = parseParagraphTokens(text);
  return (
    <p>
      {tokens.map((token, idx) => {
        if (token.type === "br") {
          return <br key={`br-${idx}`} />;
        }
        if (token.type === "subhead") {
          return (
            <span key={`sub-${idx}`} className={`${styles.proseSubhead} prose-subhead`}>
              【{token.label}】
            </span>
          );
        }
        if (token.type === "term") {
          return (
            <button
              key={`term-${idx}-${token.termId}`}
              type="button"
              className={`${styles.glossaryTerm} glossary-term`}
              onClick={() => onSelectTerm(token.termId)}
            >
              {token.surface}
              <span className={`${styles.glossaryBadge} glossary-badge`} aria-hidden="true">
                ?
              </span>
            </button>
          );
        }
        return <Fragment key={`txt-${idx}`}>{token.value}</Fragment>;
      })}
    </p>
  );
}

export interface ReaderArticleProps {
  story: StoryDetail;
  isRead: boolean;
  isBookmarked: boolean;
  chaptersContainerRef: RefObject<HTMLDivElement | null>;
  onToggleBookmark: () => void;
  onToggleRead: () => void;
  onLoreOpened: () => void;
  onSelectTerm: (termId: string) => void;
}

export function ReaderArticle({
  story,
  isRead,
  isBookmarked,
  chaptersContainerRef,
  onToggleBookmark,
  onToggleRead,
  onLoreOpened,
  onSelectTerm,
}: ReaderArticleProps) {
  const regionLabel = formatRegion(story.region);
  const chapters = story.chapters || [];
  const hasMultipleChapters = chapters.length > 1;
  const connected = story.connected || [];

  const handleTocClick = (event: MouseEvent<HTMLAnchorElement>, targetId: string) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }
    event.preventDefault();
    const target = document.getElementById(targetId);
    if (!target) return;
    const reduceMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({
      behavior: (reduceMotion ? "instant" : "smooth") as ScrollBehavior,
      block: "start",
    });
  };

  return (
    <>
      <header className={styles.readerHeader} id="reader-header">
        <div className={styles.readerKicker}>
          <span className={commonStyles.categoryBadge}>{story.categoryLabel}</span>
          <span>
            ⏱ 読了目安 {story.readingTime}（約{(story.charCount || 0).toLocaleString()}字）
          </span>
          <span>舞台：{regionLabel}</span>
          {story.era ? <span>時代：{story.era}</span> : null}
        </div>

        <h1 className={`${styles.readerTitle} reader-title`}>{story.title}</h1>
        <p className={styles.readerHook}>{story.hook}</p>

        <div className={`${styles.readerStateBar} reader-state-bar`}>
          <button
            type="button"
            className={`${commonStyles.controlPill} ${styles.readerStatePill} reader-bookmark-btn`}
            data-action="toggle-bookmark"
            data-story-id={story.id}
            aria-pressed={isBookmarked}
            onClick={onToggleBookmark}
          >
            <span aria-hidden="true">🔖</span>
            <span>あとで読む</span>
          </button>

          <button
            type="button"
            className={`${commonStyles.controlPill} ${styles.readerStatePill} reader-read-btn`}
            data-action="toggle-read"
            data-story-id={story.id}
            aria-pressed={isRead}
            onClick={onToggleRead}
          >
            <span className="reader-read-btn-label">{getReadButtonLabel(isRead, false)}</span>
          </button>
        </div>

        <div className={styles.preGuide}>
          <p className={styles.preGuideTitle}>✦ 読む前の前提ガイド（ネタバレなし）</p>
          <ul className={`${styles.preGuideList} pre-guide-list`}>
            {(story.preGuide || []).map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>
      </header>

      <nav
        className={styles.chapterToc}
        id="chapter-toc"
        aria-label="章目次"
        hidden={!hasMultipleChapters}
      >
        {hasMultipleChapters
          ? chapters.map((ch, idx) => {
              const targetId = `chapter-${idx + 1}`;
              return (
                <a
                  key={targetId}
                  className={`${styles.tocPill} toc-pill`}
                  href={`#${targetId}`}
                  onClick={(e) => handleTocClick(e, targetId)}
                >
                  第{idx + 1}章：{ch.heading}
                </a>
              );
            })
          : null}
      </nav>

      <div id="chapters-container" ref={chaptersContainerRef} className={styles.chaptersContainer}>
        {chapters.map((ch, idx) => (
          <section
            key={`chapter-${idx + 1}`}
            className={`${styles.chapterSection} chapter-section`}
            id={`chapter-${idx + 1}`}
            data-chapter-index={idx}
          >
            <p className={styles.chapterLabel}>{ch.partLabel}</p>
            <h2 className={styles.chapterHeading}>{ch.heading}</h2>
            <p className={styles.chapterEpigraph}>{ch.epigraph}</p>
            <div className={`${styles.novelProse} novel-prose`}>
              {(ch.paragraphs || []).map((p, pIdx) => (
                <ParagraphBlock key={pIdx} text={p} onSelectTerm={onSelectTerm} />
              ))}
            </div>
            {ch.chapterNote ? (
              <aside className={`${styles.chapterNoteBox} chapter-note-box`}>
                💡 {ch.chapterNote}
              </aside>
            ) : null}
          </section>
        ))}

        <details
          key={`lore-${story.id}`}
          className={`${styles.loreDetails} lore-details`}
          onToggle={(e) => {
            if (e.currentTarget.open) {
              onLoreOpened();
            }
          }}
        >
          <summary>🔍 読了後の真相・考察メモ（誰の物語だったのか？）</summary>
          <div className={`${styles.loreDetailsBody} lore-details-body`}>
            <p>{story.overallTruth}</p>
            <p className={`${styles.loreGameEffect} lore-game-effect`}>
              【ゲーム内データ】{story.gameEffect}
            </p>
          </div>
        </details>

        <div className={styles.readerCompletionBox}>
          <button
            type="button"
            className={`${commonStyles.controlPill} reader-read-btn ${styles.readerCompletionBtn} reader-completion-btn`}
            data-action="toggle-read"
            data-story-id={story.id}
            aria-pressed={isRead}
            onClick={onToggleRead}
          >
            <span className="reader-read-btn-label">{getReadButtonLabel(isRead, true)}</span>
          </button>
        </div>
      </div>

      {connected.length > 0 ? (
        <aside className={styles.connectedBox} id="connected-container">
          <h2 className={styles.connectedHeading}>🔗 この物語と裏表で繋がる作品</h2>
          <div className={styles.connectedList}>
            {connected.map((c) => {
              const targetId = c.targetId || c.id || "";
              return (
                <Link
                  key={targetId}
                  className={`${styles.connectedItem} connected-item`}
                  to={`/story/${encodeURIComponent(targetId)}`}
                  data-target-id={targetId}
                >
                  <div>
                    <div className={styles.connectedItemTitle}>{c.relation}</div>
                    <div className={styles.connectedItemDesc}>{c.desc}</div>
                  </div>
                  <span aria-hidden="true">→</span>
                </Link>
              );
            })}
          </div>
        </aside>
      ) : (
        <aside className={styles.connectedBox} id="connected-container" hidden />
      )}
    </>
  );
}
