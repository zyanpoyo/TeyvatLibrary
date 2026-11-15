export type StoryCategoryId = "book" | "artifact" | "weapon" | "attire" | "chronicle";
export type ShelfCategoryId = "all" | StoryCategoryId;
export type EntityKind = "character" | "god" | "organization" | "concept" | "place";
export type ReadingStatusFilter = "all" | "unread" | "read" | "bookmarked";
export type SortMode = "recommended" | "newest" | "shortest";

export type ThemeMode = "night" | "paper" | "sepia";
export type FontSizeMode = "small" | "medium" | "large";
export type FontFamilyMode = "mincho" | "gothic";

export interface StoryIndexItem {
  id: string;
  title: string;
  shelfCategory: StoryCategoryId;
  categoryLabel: string;
  region: string[];
  era: string;
  addedAt?: string;
  readingTime: string;
  charCount: number;
  chapterCount?: number;
  hook: string;
  tags: string[];
  entityIds?: string[];
}

export interface EntityIndexEntry {
  name: string;
  kind: EntityKind;
  storyIds: string[];
}

export interface StoriesIndexData {
  generatedAt: string;
  totalCount: number;
  categoryCounts: Record<StoryCategoryId, number>;
  entitiesIndex: Record<string, EntityIndexEntry>;
  stories: StoryIndexItem[];
}

export interface EvidenceLink {
  title: string;
  storyId: string;
}

export interface GlossaryEntry {
  entityId?: string;
  term: string;
  identity: string;
  desc: string;
  evidence?: string;
  evidenceLinks?: EvidenceLink[];
}

export interface StoryChapter {
  partLabel: string;
  heading: string;
  epigraph: string;
  paragraphs: string[];
  chapterNote?: string;
}

export interface ConnectedStoryLink {
  targetId?: string;
  id?: string;
  title?: string;
  relation: string;
  desc: string;
}

export interface StoryDetail extends StoryIndexItem {
  preGuide: string[];
  overallTruth: string;
  gameEffect: string;
  connected?: ConnectedStoryLink[];
  glossary: Record<string, GlossaryEntry>;
  chapters: StoryChapter[];
}

export interface ShelfFilters {
  category: ShelfCategoryId;
  status: ReadingStatusFilter;
  entityId: string;
  region: string;
  query: string;
  sort: SortMode;
}

export interface LastSessionSnapshot {
  storyId: string;
  chapterIndex: number;
  scrollRatio: number;
  updatedAt: string;
}

export interface ReadStoryRecord {
  readAt: string;
}

export interface ReadingStateSnapshot {
  readStories: Record<string, ReadStoryRecord>;
  bookmarks: string[];
  lastSession: LastSessionSnapshot | null;
}

export interface DisplayPrefs {
  fontSize: FontSizeMode;
  fontFamily: FontFamilyMode;
  theme: ThemeMode;
}
