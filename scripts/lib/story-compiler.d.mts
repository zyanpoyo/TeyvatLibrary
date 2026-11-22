import type {
  ChapterSourceRef,
  EvidenceLink,
  SearchIndexData,
  StoriesIndexData,
  StoryDetail,
} from "../../src/types/story";

export type RawSourceRef = ChapterSourceRef;

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
  courses?: unknown;
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
    courses?: Record<string, unknown>;
  };
  readRawSnapshot: (sourceRef: RawSourceRef) => unknown;
}

export interface CompileStoriesResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  dist: {
    index: StoriesIndexData;
    searchIndex: SearchIndexData;
    storiesById: Record<string, CompiledStoryDetail>;
  } | null;
  stats: {
    storyCount: number;
    courseCount: number;
    corpusTermCount: number;
  };
}

export function compileStories(input: CompileStoriesInput): CompileStoriesResult;
