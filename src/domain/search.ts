import type {
  EntityIndexEntry,
  SearchIndexData,
  SearchJumpTarget,
  SearchMatchKind,
  SearchStoryDocument,
  StoriesIndexData,
  StoryIndexItem,
} from "../types/story";

export interface HighlightSegment {
  text: string;
  highlighted: boolean;
}

export interface SearchSnippet {
  id: string;
  kind: SearchMatchKind;
  label: string;
  text: string;
  score: number;
  target: SearchJumpTarget;
}

export interface StorySearchMatch {
  storyId: string;
  score: number;
  snippets: SearchSnippet[];
  totalSnippetCount: number;
}

export interface SearchEvaluationInput {
  indexData: StoriesIndexData | null;
  searchIndex?: SearchIndexData | null;
  query: string;
  includeTruth?: boolean;
  isStoryRead?: (storyId: string) => boolean;
}

export interface SearchEvaluationResult {
  hasQuery: boolean;
  normalizedTokens: string[];
  matchesByStoryId: Map<string, StorySearchMatch>;
}

interface NormalizedTextMap {
  normalized: string;
  startOffsets: number[];
  endOffsets: number[];
}

interface TextRange {
  start: number;
  end: number;
}

interface SearchFieldCandidate {
  id: string;
  kind: SearchMatchKind;
  label: string;
  text: string;
  weight: number;
  order: number;
  emitSnippet: boolean;
  target: Omit<SearchJumpTarget, "query">;
}

const SNIPPET_CONTEXT_BEFORE = 34;
const SNIPPET_CONTEXT_AFTER = 48;
const MAX_STORED_SNIPPETS = 30;

function normalizeCharUnit(ch: string): string {
  const nfkc = ch.normalize("NFKC");
  let out = "";
  for (let i = 0; i < nfkc.length; i += 1) {
    const code = nfkc.charCodeAt(i);
    if (code === 0x3000) {
      out += " ";
    } else if (code >= 0x30a1 && code <= 0x30f6) {
      // カタカナ（ァ〜ヶ・ヴ含む）をひらがなへ統一
      out += String.fromCharCode(code - 0x60);
    } else if (code >= 0xff01 && code <= 0xff5e) {
      out += String.fromCharCode(code - 0xfee0).toLowerCase();
    } else {
      out += nfkc[i].toLowerCase();
    }
  }
  return out;
}

function buildNormalizedTextMap(raw: string): NormalizedTextMap {
  const input = String(raw ?? "");
  let normalized = "";
  const startOffsets: number[] = [];
  const endOffsets: number[] = [];

  let offset = 0;
  for (const cp of input) {
    const cpLen = cp.length;
    const normSegment = normalizeCharUnit(cp);
    for (let j = 0; j < normSegment.length; j += 1) {
      normalized += normSegment[j];
      startOffsets.push(offset);
      endOffsets.push(offset + cpLen);
    }
    offset += cpLen;
  }

  return { normalized, startOffsets, endOffsets };
}

/**
 * 検索用に文字列を正規化する（全角/半角・英数大小・カタカナ/ひらがなを統一）。
 */
export function normalizeSearchText(text: string): string {
  return buildNormalizedTextMap(text).normalized;
}

/**
 * 全角・半角スペース区切りの検索クエリを正規化済み・重複除去済みトークン配列へ分解する。
 */
export function tokenizeSearchQuery(query: string): string[] {
  const trimmed = String(query ?? "").trim();
  if (!trimmed) return [];
  const seen = new Set<string>();
  const tokens: string[] = [];
  for (const part of trimmed.split(/[\s\u3000]+/)) {
    const norm = normalizeSearchText(part).trim();
    if (norm && !seen.has(norm)) {
      seen.add(norm);
      tokens.push(norm);
    }
  }
  return tokens;
}

function findMatchedRanges(
  text: string,
  normalizedTokens: ReadonlyArray<string>
): { ranges: TextRange[]; matchedTokenIndices: number[] } {
  if (!text || normalizedTokens.length === 0) {
    return { ranges: [], matchedTokenIndices: [] };
  }

  const mapped = buildNormalizedTextMap(text);
  const ranges: TextRange[] = [];
  const matchedTokenIndices: number[] = [];

  normalizedTokens.forEach((token, tokenIdx) => {
    if (!token) return;
    let searchFrom = 0;
    let foundThisToken = false;

    while (searchFrom <= mapped.normalized.length - token.length) {
      const hitIdx = mapped.normalized.indexOf(token, searchFrom);
      if (hitIdx === -1) break;
      foundThisToken = true;

      const origStart = mapped.startOffsets[hitIdx];
      const origEnd = mapped.endOffsets[hitIdx + token.length - 1];
      if (origStart !== undefined && origEnd !== undefined && origEnd > origStart) {
        ranges.push({ start: origStart, end: origEnd });
      }
      searchFrom = hitIdx + token.length;
    }

    if (foundThisToken) {
      matchedTokenIndices.push(tokenIdx);
    }
  });

  return { ranges: mergeRanges(ranges), matchedTokenIndices };
}

function mergeRanges(ranges: ReadonlyArray<TextRange>): TextRange[] {
  if (ranges.length <= 1) return ranges.slice();
  const sorted = ranges
    .slice()
    .sort((a, b) => a.start - b.start || b.end - a.end);
  const merged: TextRange[] = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i += 1) {
    const curr = sorted[i];
    const last = merged[merged.length - 1];
    if (curr.start <= last.end) {
      last.end = Math.max(last.end, curr.end);
    } else {
      merged.push({ ...curr });
    }
  }
  return merged;
}

/**
 * テキスト内の検索語一致箇所をハイライト用セグメント配列に分割する。
 */
export function splitHighlightedText(
  text: string,
  query: string | ReadonlyArray<string>
): HighlightSegment[] {
  const input = String(text ?? "");
  if (!input) return [];
  const tokens = Array.isArray(query) ? query : tokenizeSearchQuery(query as string);
  if (tokens.length === 0) {
    return [{ text: input, highlighted: false }];
  }

  const { ranges } = findMatchedRanges(input, tokens);
  if (ranges.length === 0) {
    return [{ text: input, highlighted: false }];
  }

  const segments: HighlightSegment[] = [];
  let cursor = 0;
  for (const range of ranges) {
    if (range.start > cursor) {
      segments.push({ text: input.slice(cursor, range.start), highlighted: false });
    }
    segments.push({ text: input.slice(range.start, range.end), highlighted: true });
    cursor = range.end;
  }
  if (cursor < input.length) {
    segments.push({ text: input.slice(cursor), highlighted: false });
  }
  return segments;
}

function createExcerpt(text: string, firstMatch: TextRange): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  if (clean.length <= SNIPPET_CONTEXT_BEFORE + SNIPPET_CONTEXT_AFTER + 16) {
    return clean;
  }

  // 元文字列の改行圧縮によるオフセット差異を避けるため、元文字列をそのままスライスしてから空白整形する
  const sliceStart = Math.max(0, firstMatch.start - SNIPPET_CONTEXT_BEFORE);
  const sliceEnd = Math.min(text.length, firstMatch.end + SNIPPET_CONTEXT_AFTER);
  let excerpt = text.slice(sliceStart, sliceEnd).replace(/\s+/g, " ").trim();
  if (sliceStart > 0) excerpt = `…${excerpt}`;
  if (sliceEnd < text.length) excerpt = `${excerpt}…`;
  return excerpt;
}

function appendMetaCandidates(
  candidates: SearchFieldCandidate[],
  params: {
    id: string;
    title: string;
    hook: string;
    tags: ReadonlyArray<string>;
    region: ReadonlyArray<string>;
    era: string;
    categoryLabel: string;
    entityNames: ReadonlyArray<string>;
  }
): void {
  const push = (
    suffix: string,
    kind: SearchMatchKind,
    label: string,
    text: string,
    weight: number,
    emitSnippet: boolean
  ) => {
    if (!text.trim()) return;
    candidates.push({
      id: `${params.id}:${suffix}`,
      kind,
      label,
      text,
      weight,
      order: candidates.length,
      emitSnippet,
      target: { kind },
    });
  };

  push("title", "title", "タイトル", params.title, 100, false);
  if (params.tags.length > 0) {
    push("tags", "meta", "タグ", params.tags.join(" / "), 60, false);
  }
  if (params.entityNames.length > 0) {
    push(
      "entities",
      "meta",
      "登場人物・用語",
      params.entityNames.join(" / "),
      60,
      true
    );
  }
  if (params.region.length > 0) {
    push("region", "meta", "地域", params.region.join(" / "), 60, false);
  }
  const eraAndCategory = [params.era, params.categoryLabel].filter(Boolean).join(" / ");
  if (eraAndCategory) {
    push("era", "meta", "時代・分類", eraAndCategory, 50, true);
  }
  push("hook", "meta", "導入", params.hook, 45, false);
}

function collectMetadataFallbackCandidates(
  story: StoryIndexItem,
  entitiesIndex: Record<string, EntityIndexEntry> | undefined
): SearchFieldCandidate[] {
  const entityNames = (story.entityIds || [])
    .map((id) => entitiesIndex?.[id]?.name || "")
    .filter(Boolean);
  const candidates: SearchFieldCandidate[] = [];
  appendMetaCandidates(candidates, {
    id: story.id,
    title: story.title,
    hook: story.hook,
    tags: story.tags || [],
    region: story.region || [],
    era: story.era,
    categoryLabel: story.categoryLabel,
    entityNames,
  });
  return candidates;
}

function collectCorpusCandidates(
  doc: SearchStoryDocument,
  includeStoryTruth: boolean
): SearchFieldCandidate[] {
  const candidates: SearchFieldCandidate[] = [];
  appendMetaCandidates(candidates, doc);

  const pushCandidate = (c: Omit<SearchFieldCandidate, "order">) => {
    if (!c.text.trim()) return;
    candidates.push({ ...c, order: candidates.length });
  };

  doc.preGuide.forEach((line, idx) => {
    pushCandidate({
      id: `${doc.id}:preGuide:${idx}`,
      kind: "preGuide",
      label: "前提ガイド",
      text: line,
      weight: 45,
      emitSnippet: true,
      target: { kind: "preGuide" },
    });
  });

  doc.glossary.forEach((entry) => {
    const combined = [entry.term, entry.identity, entry.desc].filter(Boolean).join(" — ");
    pushCandidate({
      id: `${doc.id}:glossary:${entry.termId}`,
      kind: "glossary",
      label: `用語ガイド：${entry.term}`,
      text: combined,
      weight: 50,
      emitSnippet: true,
      target: {
        kind: "glossary",
        termId: entry.termId,
        chapterIndex: entry.firstChapterIndex,
        paragraphIndex: entry.firstParagraphIndex,
      },
    });
  });

  doc.chapters.forEach((ch) => {
    const chLabel = ch.partLabel || `第${ch.chapterIndex + 1}章`;
    const headingText = [ch.partLabel, ch.heading].filter(Boolean).join(" ");
    pushCandidate({
      id: `${doc.id}:ch:${ch.chapterIndex}:heading`,
      kind: "chapter",
      label: chLabel,
      text: headingText,
      weight: 40,
      emitSnippet: true,
      target: { kind: "chapter", chapterIndex: ch.chapterIndex },
    });

    if (ch.epigraph) {
      pushCandidate({
        id: `${doc.id}:ch:${ch.chapterIndex}:epigraph`,
        kind: "chapter",
        label: `${chLabel}（エピグラフ）`,
        text: ch.epigraph,
        weight: 28,
        emitSnippet: true,
        target: { kind: "chapter", chapterIndex: ch.chapterIndex },
      });
    }

    ch.paragraphs.forEach((p, pIdx) => {
      pushCandidate({
        id: `${doc.id}:ch:${ch.chapterIndex}:p:${pIdx}`,
        kind: "chapter",
        label: chLabel,
        text: p,
        weight: 25,
        emitSnippet: true,
        target: {
          kind: "chapter",
          chapterIndex: ch.chapterIndex,
          paragraphIndex: pIdx,
        },
      });
    });

    if (ch.chapterNote) {
      pushCandidate({
        id: `${doc.id}:ch:${ch.chapterIndex}:note`,
        kind: "chapter",
        label: `${chLabel}（章補足メモ）`,
        text: ch.chapterNote,
        weight: 28,
        emitSnippet: true,
        target: { kind: "chapter", chapterIndex: ch.chapterIndex },
      });
    }
  });

  if (includeStoryTruth) {
    const truthText = [doc.truth.overallTruth, doc.truth.gameEffect].filter(Boolean).join(" ");
    pushCandidate({
      id: `${doc.id}:truth`,
      kind: "truth",
      label: "真相・考察メモ",
      text: truthText,
      weight: 30,
      emitSnippet: true,
      target: { kind: "truth" },
    });
  }

  return candidates;
}

function evaluateStoryCandidates(
  storyId: string,
  candidates: ReadonlyArray<SearchFieldCandidate>,
  rawQuery: string,
  normalizedTokens: ReadonlyArray<string>
): StorySearchMatch | null {
  const coveredTokens = new Set<number>();
  let totalScore = 0;
  const snippets: SearchSnippet[] = [];

  for (const candidate of candidates) {
    const { ranges, matchedTokenIndices } = findMatchedRanges(candidate.text, normalizedTokens);
    if (matchedTokenIndices.length === 0) continue;

    for (const tokenIdx of matchedTokenIndices) {
      coveredTokens.add(tokenIdx);
    }

    const coOccurrenceBonus = matchedTokenIndices.length > 1 ? matchedTokenIndices.length * 25 : 0;
    const fieldScore = candidate.weight + coOccurrenceBonus + Math.min(ranges.length, 3) * 4;
    totalScore += fieldScore;

    if (candidate.emitSnippet && ranges.length > 0) {
      const excerpt = createExcerpt(candidate.text, ranges[0]);
      if (excerpt) {
        snippets.push({
          id: candidate.id,
          kind: candidate.kind,
          label: candidate.label,
          text: excerpt,
          score: fieldScore,
          target: { ...candidate.target, query: rawQuery },
        });
      }
    }
  }

  // 全トークンがいずれかの有効フィールドで出現している必要がある（クロスフィールドAND）
  if (coveredTokens.size < normalizedTokens.length) {
    return null;
  }

  snippets.sort((a, b) => b.score - a.score);
  return {
    storyId,
    score: totalScore,
    snippets: snippets.slice(0, MAX_STORED_SNIPPETS),
    totalSnippetCount: snippets.length,
  };
}

/**
 * 全収録作品に対して日本語正規化・クロスフィールドAND・ネタバレ制御つき横断検索を評価する。
 */
export function evaluateCatalogSearch({
  indexData,
  searchIndex = null,
  query,
  includeTruth = false,
  isStoryRead,
}: SearchEvaluationInput): SearchEvaluationResult {
  const rawQuery = String(query ?? "").trim();
  const normalizedTokens = tokenizeSearchQuery(rawQuery);
  const matchesByStoryId = new Map<string, StorySearchMatch>();

  if (!indexData || normalizedTokens.length === 0) {
    return { hasQuery: false, normalizedTokens, matchesByStoryId };
  }

  for (const story of indexData.stories) {
    const doc = searchIndex?.stories?.[story.id] ?? null;
    const allowTruth = Boolean(includeTruth || isStoryRead?.(story.id));
    const candidates = doc
      ? collectCorpusCandidates(doc, allowTruth)
      : collectMetadataFallbackCandidates(story, indexData.entitiesIndex);

    const match = evaluateStoryCandidates(story.id, candidates, rawQuery, normalizedTokens);
    if (match) {
      matchesByStoryId.set(story.id, match);
    }
  }

  return {
    hasQuery: true,
    normalizedTokens,
    matchesByStoryId,
  };
}
