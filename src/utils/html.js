import { getStoryHash } from "../router.js";

export function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatRegion(region) {
  if (Array.isArray(region)) return region.join(" / ");
  return String(region ?? "");
}

export function formatParagraph(text, storyId) {
  const escaped = escapeHtml(text);

  // 行頭の【鳩が枝を運んだ年】などの隅付き括弧を小見出しスタイルに変換
  const withSubheads = escaped.replace(
    /(^|\n)【([^】]+)】\n?/g,
    '$1<span class="prose-subhead">【$2】</span><br>'
  );

  const withTerms = withSubheads.replace(/\{\{([a-z0-9_]+)\|([^}]+)\}\}/g, (_, termId, surface) => {
    const popoverId = `pop-${storyId}-${termId}`;
    return `<button type="button" class="glossary-term" popovertarget="${popoverId}">${surface}<span class="glossary-badge" aria-hidden="true">?</span></button>`;
  });

  return `<p>${withTerms.replace(/\n/g, "<br>")}</p>`;
}

export function formatEvidenceHtml(evidence, evidenceLinks = []) {
  const linkMap = new Map(
    (evidenceLinks || []).map((l) => [l.title, l.storyId])
  );
  const escaped = escapeHtml(evidence);
  if (linkMap.size === 0) return escaped;

  return escaped.replace(/『([^』]+)』/g, (full, title) => {
    const targetId = linkMap.get(title);
    if (!targetId) return full;
    const href = getStoryHash(targetId);
    return `<a class="evidence-link" href="${href}" data-target-id="${escapeHtml(targetId)}">『${title}』</a>`;
  });
}
