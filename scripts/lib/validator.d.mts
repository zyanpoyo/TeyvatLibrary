export const VALID_SHELF_CATEGORIES: string[];
export const VALID_ENTITY_KINDS: string[];
export const VALID_IDENTITY_PREFIXES: string[];
export const VALID_SOURCE_TYPES: string[];
export const VALID_PACKAGES: string[];
export const VALID_PIECES: string[];

export function stripInlineTags(text: string): string;
export function normalizeWhitespaceForComparison(text: string): string;
export function splitIntoParagraphBlocks(rawText: string): string[];
export function resolveExpectedRawText(rawJson: unknown, sourceRef: Record<string, unknown>): string;
export function resolveActualPlainText(paragraphs: string[]): string;
export function findFirstDiffContext(
  expected: string,
  actual: string
): { index: number; expectedSnippet: string; actualSnippet: string } | null;

export type CorpusChecker = (text: string, contextLabel: string, errors: string[]) => void;

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
): Array<{ title: string; storyId: string }>;

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

export function validateStoryJsonSchema(
  story: unknown,
  storySchema: Record<string, unknown>,
  fileSlug: string,
  errors: string[]
): void;

export function validateEntitiesJsonSchema(
  entities: unknown,
  entitiesSchema: Record<string, unknown>,
  errors: string[]
): void;
