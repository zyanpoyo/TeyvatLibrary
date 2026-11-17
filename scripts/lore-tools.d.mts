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

export function parseCliArgs(argv: string[]): ParsedCliArgs;

export function buildInspectReport(params: {
  sourceType: string | null;
  rawId: string | null;
  dbJapanese: Record<string, Record<string, unknown>>;
  booksData?: Array<Record<string, unknown>>;
  rawBookJson?: Record<string, unknown> | null;
  corpusChecker?: ((text: string, contextLabel: string, errors: string[]) => void) | null;
  checkText?: string | null;
}): {
  sourceType: string;
  rawId: string;
  name: string;
  totalRawCharCount: number;
  warnings: string[];
  katakanaIssues: string[];
  paragraphs?: string[];
  chapters?: Array<{ piece: string; name: string; rawCharCount: number; paragraphs: string[] }>;
  volumes?: Array<{ volumeId: number; name: string; rawCharCount: number; paragraphs: string[] }>;
};

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
