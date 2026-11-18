import type { CorpusChecker } from "./lib/validator.mjs";

export interface ParsedCliArgs {
  command: string | null;
  type: string | null;
  id: string | null;
  json: boolean;
  checkText: string | null;
  collection: string;
  limit: number;
  keyword: string | null;
}

export interface ArtifactInspectChapter {
  piece: string;
  name: string;
  epigraph: string;
  rawCharCount: number;
  nonWhitespaceCharCount: number;
  paragraphs: string[];
}

export interface BookInspectVolume {
  volumeId: number;
  name: string;
  epigraph: string;
  storyId: string;
  rawCharCount: number;
  paragraphs: string[];
}

export interface InspectReport {
  sourceType: string;
  rawId: string;
  name: string;
  rarityList?: number[];
  effect2Pc?: string;
  effect4Pc?: string;
  rarity?: number | null;
  weaponText?: string | null;
  effectName?: string | null;
  effectTemplateRaw?: string | null;
  epigraph?: string;
  totalRawCharCount: number;
  nonWhitespaceCharCount?: number;
  warnings: string[];
  katakanaIssues: string[];
  paragraphs?: string[];
  chapters?: ArtifactInspectChapter[];
  volumes?: BookInspectVolume[];
}

export function parseCliArgs(argv: string[]): ParsedCliArgs;

export function collectKatakanaIssues(
  labeledTexts: Array<{ label: string; text: string }>,
  corpusChecker?: CorpusChecker | null
): string[];

export function buildInspectReport(params: {
  sourceType: string | null;
  rawId: string | null;
  dbJapanese: Record<string, Record<string, unknown>>;
  booksData?: Array<Record<string, unknown>>;
  rawBookJson?: Record<string, unknown> | null;
  corpusChecker?: CorpusChecker | null;
  checkText?: string | null;
}): InspectReport;

export function searchLoreEntries(params: {
  keyword: string;
  dbJapanese?: Record<string, Record<string, unknown>>;
  booksData?: Array<Record<string, unknown>>;
  rawBookMap?: Record<string, Record<string, unknown>>;
  collection?: string;
  limit?: number;
}): Array<{
  collection: string;
  rawId: string;
  name: string;
  matchedField: string;
  snippet: string;
}>;
