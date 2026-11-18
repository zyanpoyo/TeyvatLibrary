import type { SearchJumpTarget, SearchMatchKind } from "../types/story";

const VALID_JUMP_KINDS = new Set<SearchMatchKind>([
  "title",
  "meta",
  "chapter",
  "preGuide",
  "glossary",
  "truth",
]);

function parseNonNegativeInt(raw: string | null): number | undefined {
  if (raw === null || !/^\d+$/.test(raw)) return undefined;
  const num = Number(raw);
  return Number.isSafeInteger(num) ? num : undefined;
}

export interface ParsedShelfSearchParams {
  query: string;
  includeTruth: boolean;
}

/**
 * 書架URLのクエリ文字列（?q=...&truth=1）から検索語と真相メモ検索トグルを復元する。
 */
export function parseShelfSearchParams(search: string): ParsedShelfSearchParams {
  const params = new URLSearchParams(search || "");
  return {
    query: params.get("q") || "",
    includeTruth: params.get("truth") === "1",
  };
}

/**
 * 書架URLのクエリ文字列を構築する（検索語が空の時はクリーンな URL のため空文字を返す）。
 */
export function buildShelfSearchParams(query: string, includeTruth: boolean): string {
  if (!query.trim()) return "";
  const params = new URLSearchParams();
  params.set("q", query);
  if (includeTruth) {
    params.set("truth", "1");
  }
  return params.toString();
}

/**
 * リーダーURLのクエリ文字列から検索ジャンプ先とハイライト対象語を抽出する。
 */
export function parseReaderJumpParams(search: string): SearchJumpTarget | null {
  const params = new URLSearchParams(search || "");
  const query = (params.get("q") || "").trim();
  if (!query) return null;

  const rawKind = params.get("kind") as SearchMatchKind | null;
  const kind: SearchMatchKind =
    rawKind && VALID_JUMP_KINDS.has(rawKind) ? rawKind : "chapter";

  const chapterIndex = parseNonNegativeInt(params.get("ch"));
  const paragraphIndex = parseNonNegativeInt(params.get("p"));
  const termId = params.get("term") || undefined;

  return {
    query,
    kind,
    ...(chapterIndex !== undefined ? { chapterIndex } : {}),
    ...(paragraphIndex !== undefined ? { paragraphIndex } : {}),
    ...(termId ? { termId } : {}),
  };
}

/**
 * 検索ジャンプ先をリーダーURL用のクエリ文字列へ変換する。
 */
export function buildReaderJumpParams(target?: SearchJumpTarget | null): string {
  if (!target || !target.query.trim()) return "";
  const params = new URLSearchParams();
  params.set("q", target.query);
  params.set("kind", target.kind);
  if (target.chapterIndex !== undefined) {
    params.set("ch", String(target.chapterIndex));
  }
  if (target.paragraphIndex !== undefined) {
    params.set("p", String(target.paragraphIndex));
  }
  if (target.termId) {
    params.set("term", target.termId);
  }
  return params.toString();
}
