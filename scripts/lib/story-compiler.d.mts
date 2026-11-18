import type {
  EvidenceLink,
  StoriesIndexData,
  StoryDetail,
} from "../../src/types/story";

export interface RawSourceRef {
  package: string;
  sourceType: string;
  rawId: string;
  piece?: string;
  volumeId?: number;
  field?: string;
  stripPrefix?: string;
  paragraphSlice?: [number, number];
}

export interface StoryInputEntry {
  folderCategory: string;
  fileSlug: string;
  story: unknown;
}

export interface CompiledGlossaryEntry {
  entityId?: string;
  term: string;
  identity: string;
  desc: string;
  evidence: string;
  evidenceLinks?: EvidenceLink[];
}

export interface CompiledStoryDetail extends Omit<StoryDetail, "glossary" | "chapters"> {
  glossary: Record<string, CompiledGlossaryEntry>;
  chapters: Array<
    StoryDetail["chapters"][number] & {
      sourceRef: RawSourceRef;
    }
  >;
}

export interface CompileStoriesInput {
  stories: StoryInputEntry[];
  entities: unknown;
  officialEntities?: {
    ngVariants?: Record<string, string>;
    officialMediaTerms?: string[];
    allowedCommonKatakana?: string[];
  };
  officialCorpus?: {
    terms?: Record<string, number>;
  };
  schemas: {
    story: Record<string, unknown>;
    entities: Record<string, unknown>;
  };
  readRawSnapshot: (sourceRef: RawSourceRef) => unknown;
}

export interface CompileStoriesResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  dist: {
    index: StoriesIndexData;
    storiesById: Record<string, CompiledStoryDetail>;
  } | null;
  stats: {
    storyCount: number;
    corpusTermCount: number;
  };
}

export function compileStories(input: CompileStoriesInput): CompileStoriesResult;
