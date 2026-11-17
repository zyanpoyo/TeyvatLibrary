import type { EvidenceLink } from "../types/story";

export type ParagraphToken =
  | { type: "text"; value: string }
  | { type: "br" }
  | { type: "subhead"; label: string }
  | { type: "term"; termId: string; surface: string };

export type EvidenceToken =
  | { type: "text"; value: string }
  | { type: "link"; title: string; storyId: string };

export function formatRegion(region?: string | string[]): string {
  if (Array.isArray(region)) return region.join(" / ");
  return String(region ?? "");
}

const GENDER_PLACEHOLDER_PATTERN =
  /\{M#([^}]*)\}\{F#([^}]*)\}|\{F#([^}]*)\}\{M#([^}]*)\}/g;

/**
 * 原文に含まれるゲーム内性別分岐記法 {M#...}{F#...} を可読表記へ展開する。
 */
export function formatGenderPlaceholders(text: string): string {
  return String(text ?? "").replace(
    GENDER_PLACEHOLDER_PATTERN,
    (
      _match,
      m1: string | undefined,
      f1: string | undefined,
      f2: string | undefined,
      m2: string | undefined
    ) => {
      const male = m1 ?? m2 ?? "";
      const female = f1 ?? f2 ?? "";
      return male === female ? male : `${male}／${female}`;
    }
  );
}

function appendTextToken(tokens: ParagraphToken[], value: string): void {
  if (!value) return;
  const last = tokens[tokens.length - 1];
  if (last && last.type === "text") {
    last.value += value;
  } else {
    tokens.push({ type: "text", value });
  }
}

/**
 * 本文段落テキストを構造化トークン配列に変換する純粋パーサー。
 * 行頭の【小見出し】、インライン注釈 {{termId|surface}}、性別分岐記法 {M#...}{F#...}、改行 \n をReact要素向けトークンに分解する。
 */
export function parseParagraphTokens(text: string): ParagraphToken[] {
  const input = String(text ?? "");
  if (!input) return [];

  const tokens: ParagraphToken[] = [];
  const pattern =
    /【([^】]+)】\n?|\{\{([a-z0-9_]+)\|((?:[^}{]|\{[MF]#[^}]*\}|\{(?!\{|[MF]#))+)\}\}|\{M#([^}]*)\}\{F#([^}]*)\}|\{F#([^}]*)\}\{M#([^}]*)\}|\n/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(input)) !== null) {
    const matchIndex = match.index;
    if (matchIndex > cursor) {
      appendTextToken(tokens, input.slice(cursor, matchIndex));
    }

    const full = match[0];
    const subheadLabel = match[1];
    const termId = match[2];
    const surface = match[3];
    const m1 = match[4];
    const f2 = match[6];

    if (subheadLabel !== undefined) {
      const isLineStart = matchIndex === 0 || input[matchIndex - 1] === "\n";
      if (isLineStart) {
        tokens.push({
          type: "subhead",
          label: formatGenderPlaceholders(subheadLabel),
        });
        tokens.push({ type: "br" });
        cursor = matchIndex + full.length;
      } else {
        // 文中の【...】は小見出しにせず、内部に{{...}}が含まれる可能性も残すため「【」1文字だけ進める
        appendTextToken(tokens, "【");
        cursor = matchIndex + 1;
        pattern.lastIndex = cursor;
      }
      continue;
    }

    if (termId !== undefined && surface !== undefined) {
      tokens.push({
        type: "term",
        termId,
        surface: formatGenderPlaceholders(surface),
      });
      cursor = matchIndex + full.length;
      continue;
    }

    if (m1 !== undefined || f2 !== undefined) {
      appendTextToken(tokens, formatGenderPlaceholders(full));
      cursor = matchIndex + full.length;
      continue;
    }

    // 改行 \n
    tokens.push({ type: "br" });
    cursor = matchIndex + full.length;
  }

  if (cursor < input.length) {
    appendTextToken(tokens, input.slice(cursor));
  }

  return tokens;
}

function appendEvidenceText(tokens: EvidenceToken[], value: string): void {
  if (!value) return;
  const last = tokens[tokens.length - 1];
  if (last && last.type === "text") {
    last.value += value;
  } else {
    tokens.push({ type: "text", value });
  }
}

/**
 * 出典・根拠テキスト内の『作品名』を evidenceLinks に基づきリンク用トークンに分解する。
 */
export function parseEvidenceTokens(
  evidence: string,
  evidenceLinks: ReadonlyArray<EvidenceLink> = []
): EvidenceToken[] {
  const input = String(evidence ?? "");
  if (!input) return [];

  const linkMap = new Map<string, string>(
    (evidenceLinks || []).map((l) => [l.title, l.storyId])
  );
  if (linkMap.size === 0) {
    return [{ type: "text", value: input }];
  }

  const tokens: EvidenceToken[] = [];
  const pattern = /『([^』]+)』/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(input)) !== null) {
    if (match.index > cursor) {
      appendEvidenceText(tokens, input.slice(cursor, match.index));
    }
    const title = match[1];
    const targetId = linkMap.get(title);
    if (targetId) {
      tokens.push({ type: "link", title, storyId: targetId });
    } else {
      appendEvidenceText(tokens, match[0]);
    }
    cursor = match.index + match[0].length;
  }

  if (cursor < input.length) {
    appendEvidenceText(tokens, input.slice(cursor));
  }

  return tokens;
}
