import type { EvidenceLink } from "../types/story";

export type ParagraphToken =
  | { type: "text"; value: string }
  | { type: "br" }
  | { type: "subhead"; label: string }
  | { type: "term"; termId: string; surface: string };

export type EvidenceToken =
  | { type: "text"; value: string }
  | { type: "link"; title: string; storyId: string };

export interface InlineTagReference {
  termId: string;
  surface: string;
  raw: string;
}

const INLINE_TAG_SOURCE = String.raw`\{\{([a-z0-9_]+)\|((?:[^}{]|\{[MF]#[^}]*\}|\{(?!\{|[MF]#))+)\}\}`;
const GENDER_PLACEHOLDER_SOURCE = String.raw`\{M#([^}]*)\}\{F#([^}]*)\}|\{F#([^}]*)\}\{M#([^}]*)\}`;
const CITED_TITLE_SOURCE = String.raw`『([^』]+)』`;

export function formatRegion(region?: string | string[]): string {
  if (Array.isArray(region)) return region.join(" / ");
  return String(region ?? "");
}

/**
 * 原文に含まれるゲーム内性別分岐記法 {M#...}{F#...} を可読表記へ展開する。
 */
export function formatGenderPlaceholders(text: string): string {
  return String(text ?? "").replace(
    new RegExp(GENDER_PLACEHOLDER_SOURCE, "g"),
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

/**
 * テキスト内のインライン注釈 {{termId|surface}} をすべて抽出する（{M#...}{F#...} 内包に対応）。
 */
export function extractInlineTagReferences(text: string): InlineTagReference[] {
  const input = String(text ?? "");
  const refs: InlineTagReference[] = [];
  for (const match of input.matchAll(new RegExp(INLINE_TAG_SOURCE, "g"))) {
    refs.push({
      termId: match[1],
      surface: match[2],
      raw: match[0],
    });
  }
  return refs;
}

/**
 * インライン注釈 {{termId|surface}} のタグ記法を剥がし、表示対象文字列（surface）のみを復元する。
 */
export function stripInlineTags(text: string): string {
  return String(text ?? "").replace(new RegExp(INLINE_TAG_SOURCE, "g"), "$2");
}

/**
 * テキスト内の『タイトル』形式の引用名を出現順に抽出する。
 */
export function extractCitedTitles(text: string): string[] {
  const input = String(text ?? "");
  const titles: string[] = [];
  for (const match of input.matchAll(new RegExp(CITED_TITLE_SOURCE, "g"))) {
    titles.push(match[1]);
  }
  return titles;
}

/**
 * YYYY-MM-DD 形式かつ実在するカレンダー日付であれば UTC 00:00:00 のミリ秒を返し、不正値なら null を返す。
 */
export function parseIsoDateUtcMs(dateStr: unknown): number | null {
  if (typeof dateStr !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return null;
  }
  const [y, m, d] = dateStr.split("-").map(Number);
  const utcMs = Date.UTC(y, m - 1, d);
  const dt = new Date(utcMs);
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    return null;
  }
  return utcMs;
}

/**
 * YYYY-MM-DD 形式の実在日付文字列かを判定する。
 */
export function isValidIsoDateString(value: unknown): value is string {
  return parseIsoDateUtcMs(value) !== null;
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
  const pattern = new RegExp(
    String.raw`【([^】]+)】\n?|${INLINE_TAG_SOURCE}|${GENDER_PLACEHOLDER_SOURCE}|\n`,
    "g"
  );
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
      // 短く完結した単一行の見出しのみを小見出しとして扱い、長文の訳注ブロックやインライン注釈を含む【...】は通常本文として展開する
      const isProseSubhead =
        isLineStart &&
        !subheadLabel.includes("\n") &&
        !subheadLabel.includes("。") &&
        !subheadLabel.includes("{{") &&
        subheadLabel.length <= 60;
      if (isProseSubhead) {
        tokens.push({
          type: "subhead",
          label: formatGenderPlaceholders(subheadLabel),
        });
        tokens.push({ type: "br" });
        cursor = matchIndex + full.length;
      } else {
        // 通常テキスト扱いの【...】は内部に{{...}}や改行が含まれる可能性があるため「【」1文字だけ進める
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
  const pattern = new RegExp(CITED_TITLE_SOURCE, "g");
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
