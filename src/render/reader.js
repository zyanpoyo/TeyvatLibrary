import { escapeHtml, formatEvidenceHtml, formatParagraph, formatRegion } from "../utils/html.js";
import { getStoryHash } from "./shelf.js";

function getReadButtonLabel(isRead, isCompletionBtn) {
  if (isCompletionBtn) {
    return isRead ? "✦ 読了済み（クリックで未読に戻す）" : "✧ この作品を読了にする";
  }
  return isRead ? "✦ 読了済み" : "✧ 読了にする";
}

export function updateReaderStateButtons(readerViewEl, { isRead, isBookmarked }) {
  if (!readerViewEl) return;
  readerViewEl.querySelectorAll('[data-action="toggle-bookmark"]').forEach((btn) => {
    btn.setAttribute("aria-pressed", String(isBookmarked));
  });
  readerViewEl.querySelectorAll('[data-action="toggle-read"]').forEach((btn) => {
    btn.setAttribute("aria-pressed", String(isRead));
    const labelEl = btn.querySelector(".reader-read-btn-label");
    if (labelEl) {
      labelEl.textContent = getReadButtonLabel(isRead, btn.classList.contains("reader-completion-btn"));
    }
  });
}

export function renderStoryReader(elements, story, readingState = null) {
  const {
    readerHeader,
    chapterToc,
    chaptersContainer,
    popoversContainer,
    connectedContainer,
  } = elements;

  const regionLabel = formatRegion(story.region);
  const isRead = Boolean(readingState?.isRead(story.id));
  const isBookmarked = Boolean(readingState?.isBookmarked(story.id));

  readerHeader.innerHTML = `
    <div class="reader-kicker">
      <span class="category-badge">${escapeHtml(story.categoryLabel)}</span>
      <span>⏱ 読了目安 ${escapeHtml(story.readingTime)}（約${(story.charCount || 0).toLocaleString()}字）</span>
      <span>舞台：${escapeHtml(regionLabel)}</span>
      ${story.era ? `<span>時代：${escapeHtml(story.era)}</span>` : ""}
    </div>
    <h1 class="reader-title">${escapeHtml(story.title)}</h1>
    <p class="reader-hook">${escapeHtml(story.hook)}</p>
    <div class="reader-state-bar">
      <button
        type="button"
        class="control-pill reader-bookmark-btn"
        data-action="toggle-bookmark"
        data-story-id="${escapeHtml(story.id)}"
        aria-pressed="${isBookmarked}"
      >
        <span aria-hidden="true">🔖</span>
        <span>あとで読む</span>
      </button>
      <button
        type="button"
        class="control-pill reader-read-btn"
        data-action="toggle-read"
        data-story-id="${escapeHtml(story.id)}"
        aria-pressed="${isRead}"
      >
        <span class="reader-read-btn-label">${escapeHtml(getReadButtonLabel(isRead, false))}</span>
      </button>
    </div>
    <div class="pre-guide">
      <p class="pre-guide-title">✦ 読む前の前提ガイド（ネタバレなし）</p>
      <ul class="pre-guide-list">
        ${(story.preGuide || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
      </ul>
    </div>
  `;

  if ((story.chapters || []).length > 1) {
    chapterToc.hidden = false;
    chapterToc.innerHTML = story.chapters.map((ch, idx) => `
      <a class="toc-pill" href="#chapter-${idx + 1}">第${idx + 1}章：${escapeHtml(ch.heading)}</a>
    `).join("");
  } else {
    chapterToc.hidden = true;
    chapterToc.innerHTML = "";
  }

  chaptersContainer.innerHTML = (story.chapters || []).map((ch, idx) => `
    <section class="chapter-section" id="chapter-${idx + 1}" data-chapter-index="${idx}">
      <p class="chapter-label">${escapeHtml(ch.partLabel)}</p>
      <h2 class="chapter-heading">${escapeHtml(ch.heading)}</h2>
      <p class="chapter-epigraph">${escapeHtml(ch.epigraph)}</p>
      <div class="novel-prose">
        ${(ch.paragraphs || []).map((p) => formatParagraph(p, story.id)).join("")}
      </div>
      ${ch.chapterNote ? `<aside class="chapter-note-box">💡 ${escapeHtml(ch.chapterNote)}</aside>` : ""}
    </section>
  `).join("") + `
    <details class="lore-details">
      <summary>🔍 読了後の真相・考察メモ（誰の物語だったのか？）</summary>
      <div class="lore-details-body">
        <p>${escapeHtml(story.overallTruth)}</p>
        <p class="lore-game-effect">【ゲーム内データ】${escapeHtml(story.gameEffect)}</p>
      </div>
    </details>
    <div class="reader-completion-box">
      <button
        type="button"
        class="control-pill reader-read-btn reader-completion-btn"
        data-action="toggle-read"
        data-story-id="${escapeHtml(story.id)}"
        aria-pressed="${isRead}"
      >
        <span class="reader-read-btn-label">${escapeHtml(getReadButtonLabel(isRead, true))}</span>
      </button>
    </div>
  `;

  popoversContainer.innerHTML = Object.entries(story.glossary || {}).map(([termId, info]) => {
    const popoverId = `pop-${story.id}-${termId}`;
    const evidenceHtml = info.evidence
      ? formatEvidenceHtml(info.evidence, info.evidenceLinks)
      : "";
    return `
      <div id="${popoverId}" popover="auto" class="term-popover" role="dialog" aria-labelledby="${popoverId}-title">
        <div class="popover-header">
          <h3 class="popover-term-title" id="${popoverId}-title">「${escapeHtml(info.term)}」</h3>
          <button type="button" class="popover-close" popovertarget="${popoverId}" popovertargetaction="hide">✕ 閉じる</button>
        </div>
        <p class="popover-identity">${escapeHtml(info.identity)}</p>
        <p class="popover-desc">${escapeHtml(info.desc)}</p>
        ${evidenceHtml ? `<p class="popover-evidence">📚 出典・根拠：${evidenceHtml}</p>` : ""}
      </div>
    `;
  }).join("");

  if (story.connected && story.connected.length > 0) {
    connectedContainer.hidden = false;
    connectedContainer.innerHTML = `
      <h2 class="connected-heading">🔗 この物語と裏表で繋がる作品</h2>
      <div class="connected-list">
        ${story.connected.map((c) => {
          const targetId = c.targetId || c.id;
          return `
            <a class="connected-item" href="${getStoryHash(targetId)}" data-target-id="${escapeHtml(targetId)}">
              <div>
                <div class="connected-item-title">${escapeHtml(c.relation)}</div>
                <div class="connected-item-desc">${escapeHtml(c.desc)}</div>
              </div>
              <span aria-hidden="true">→</span>
            </a>
          `;
        }).join("")}
      </div>
    `;
  } else {
    connectedContainer.hidden = true;
    connectedContainer.innerHTML = "";
  }
}
