import type { InlineTagReference } from "../../src/domain/text-parser";
import type {
  ArtifactPieceId,
  ChapterSourceRef,
  EvidenceLink,
  IdentityPrefix,
  StoryCategoryId,
} from "../../src/types/story";

export const VALID_SHELF_CATEGORIES: StoryCategoryId[];
export const VALID_IDENTITY_PREFIXES: IdentityPrefix[];
export const VALID_PIECES: ArtifactPieceId[];

export { extractInlineTagReferences, stripInlineTags, type InlineTagReference };

export function normalizeWhitespaceForComparison(text: string): string;
export function splitIntoParagraphBlocks(rawText: string): string[];
export function extractTargetField(
  rawJson: unknown,
  sourceRef: Partial<ChapterSourceRef> & { sourceType: string }
): string;
export function sanitizeRawSourceText(
  rawText: string,
  options?: {
    stripPrefix?: string;
    paragraphSlice?: [number, number];
  }
): string;
export function resolveExpectedRawText(
  rawJson: unknown,
  sourceRef: Partial<ChapterSourceRef> & { sourceType: string }
): string;
export function resolveActualPlainText(paragraphs: string[]): string;
export function findFirstDiffContext(
  expected: string,
  actual: string
): { index: number; expectedSnippet: string; actualSnippet: string } | null;

export type CorpusChecker = (text: string, contextLabel: string, errors?: string[]) => string[];

export function createCorpusChecker(
  officialEntities: {
    ngVariants?: Record<string, string>;
    officialMediaTerms?: string[];
    allowedCommonKatakana?: string[];
  },
  officialCorpus: { terms?: Record<string, number> }
): CorpusChecker;

export function extractEvidenceLinks(
  evidence: string,
  titleLookup: Map<string, string>,
  selfId?: string | null
): EvidenceLink[];

export function buildTitleLookup(
  rawStories: Array<{ id: string; title: string }>
): Map<string, string>;

export function findSubtitleLinkErrors(
  evidence: string,
  contextLabel: string,
  titleLookup: Map<string, string>,
  selfId?: string | null,
  errors?: string[]
): string[];

export function findEntityLinkHints(
  story: {
    id?: string;
    overallTruth?: string;
    chapters?: Array<{ paragraphs?: string[] }>;
  },
  entities: Record<string, { name?: string }>,
  usedEntityIds?: Set<string> | string[]
): string[];
