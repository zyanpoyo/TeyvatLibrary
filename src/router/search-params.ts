import type { SearchJumpTarget, SearchMatchKind } from "../types/story";

const JUMP_KIND_MAP: Record<SearchMatchKind, true> = {
  title: true,
  meta: true,
  chapter: true,
  preGuide: true,
  unreleased: true,
  glossary: true,
  truth: true,
};

function isValidJumpKind(raw: string | null): raw is SearchMatchKind {
  return raw !== null && Object.prototype.hasOwnProperty.call(JUMP_KIND_MAP, raw);
}

const VALID_COURSE_ID_PATTERN = /^[a-z0-9_]+$/;

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

  const rawKind = params.get("kind");
  const kind: SearchMatchKind = isValidJumpKind(rawKind) ? rawKind : "chapter";

  const chapterIndex = parseNonNegativeInt(params.get("ch"));
  const paragraphIndex = parseNonNegativeInt(params.get("p"));
  const volumeIndex = parseNonNegativeInt(params.get("vol"));
  const termId = params.get("term") || undefined;

  return {
    query,
    kind,
    ...(chapterIndex !== undefined ? { chapterIndex } : {}),
    ...(paragraphIndex !== undefined ? { paragraphIndex } : {}),
    ...(volumeIndex !== undefined ? { volumeIndex } : {}),
    ...(termId ? { termId } : {}),
  };
}

/**
 * リーダーURLのクエリ文字列から進行中コースID（?course=<id>）を抽出する。
 */
export function parseReaderCourseParam(search: string): string | null {
  const params = new URLSearchParams(search || "");
  const raw = (params.get("course") || "").trim();
  return raw && VALID_COURSE_ID_PATTERN.test(raw) ? raw : null;
}

/**
 * 物語IDと任意の進行中コースID・検索ジャンプ先からリーダーURLパスを構築する。
 */
export function buildReaderStoryPath(
  storyId: string,
  options?: { courseId?: string | null; searchTarget?: SearchJumpTarget | null }
): string {
  const pathname = `/story/${encodeURIComponent(storyId)}`;
  const params = new URLSearchParams();

  if (options?.courseId && VALID_COURSE_ID_PATTERN.test(options.courseId)) {
    params.set("course", options.courseId);
  }
  const jumpQuery = buildReaderJumpParams(options?.searchTarget);
  if (jumpQuery) {
    for (const [k, v] of new URLSearchParams(jumpQuery).entries()) {
      params.set(k, v);
    }
  }

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
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
  if (target.volumeIndex !== undefined) {
    params.set("vol", String(target.volumeIndex));
  }
  if (target.termId) {
    params.set("term", target.termId);
  }
  return params.toString();
}
