import type { SourceTypeId } from "../../src/types/story";

export const VALID_SOURCE_TYPES: SourceTypeId[];
export const SOURCE_TYPE_TO_DB_FOLDER: Record<Exclude<SourceTypeId, "book">, string>;

export interface BookVolumeMeta {
  _id: number;
  id?: number;
  name: string;
  description?: string;
  storyId?: string | number;
}

export interface BookMeta {
  _id: number;
  id: string;
  name: string;
  rarity?: number;
  volumes?: BookVolumeMeta[];
}

export interface YattaFetchResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

export type FetchLike = (url: string) => Promise<YattaFetchResponse>;

export interface OfficialCorpusPayload {
  meta: {
    source: string;
    genshinDataVersion: string;
    genshinDbVersion: string;
    updatedAt: string;
    dataModuleCount: number;
    dbFolderCount: number;
    rawFileCount: number;
    termCount: number;
  };
  terms: Record<string, number>;
}

export function getGenshinSourcePaths(rootDir?: string): {
  dbJsonPath: string;
  dataDistDir: string;
};

export function loadGenshinDbJapanese(
  rootDir?: string
): Record<string, Record<string, Record<string, unknown>>>;

export function loadGenshinDataBooks(rootDir?: string): BookMeta[];

export function loadGenshinDataJapaneseModules(
  rootDir?: string
): Array<{ file: string; data: unknown }>;

export function findBookMeta(
  booksData: ReadonlyArray<Record<string, unknown>> | undefined,
  rawId: string
): Record<string, unknown> | null;

export function resolveDbSourceEntry(
  dbJapanese: Record<string, Record<string, Record<string, unknown>>> | undefined,
  sourceType: string,
  rawId: string
): Record<string, unknown>;

export function createYattaBookFetcher(
  fetchImpl?: FetchLike,
  baseUrl?: string
): (bookMeta: BookMeta) => Promise<Record<string, unknown>>;

export function extractRawSourceSnapshot(params: {
  sourceType: string;
  rawId: string;
  dbJapanese?: Record<string, Record<string, Record<string, unknown>>>;
  booksData?: ReadonlyArray<BookMeta | Record<string, unknown>>;
  fetchBookRaw?: (bookMeta: BookMeta) => Promise<Record<string, unknown>>;
}): Promise<{
  sourceType: SourceTypeId;
  rawId: string;
  data: Record<string, unknown>;
}>;

export function buildOfficialCorpus(params: {
  dataModules?: Array<{ file?: string; data: unknown } | unknown>;
  jpDb?: Record<string, unknown>;
  rawSnapshots?: unknown[];
  genshinDataVersion?: string;
  genshinDbVersion?: string;
  updatedAt?: string;
}): OfficialCorpusPayload;
