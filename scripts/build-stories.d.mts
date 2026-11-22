import type { CompileStoriesResult } from "./lib/story-compiler.mjs";

export interface BuildProjectStoriesOptions {
  rootDir?: string;
  distDir?: string;
  validateOnly?: boolean;
}

export interface BuildProjectStoriesResult extends CompileStoriesResult {
  distDir: string;
}

export interface DistOutputVerifyStats {
  storyCount: number;
  searchStoryCount: number;
  storyFileCount: number;
  entityCount: number;
}

export interface DistOutputVerifyResult {
  ok: boolean;
  errors: string[];
  stats: DistOutputVerifyStats;
}

export interface DistOutputSmokeCheckResult {
  buildResult: BuildProjectStoriesResult;
  verifyResult: DistOutputVerifyResult | null;
}

export interface ExistingDistOutputCheckResult {
  exists: boolean;
  distDir: string;
  verifyResult: DistOutputVerifyResult | null;
}

export function buildProjectStories(
  options?: BuildProjectStoriesOptions
): BuildProjectStoriesResult;

export function verifyDistOutput(distDir: string): DistOutputVerifyResult;

export function runDistOutputSmokeCheck(options?: {
  rootDir?: string;
}): DistOutputSmokeCheckResult;

export function checkExistingDistOutput(rootDir?: string): ExistingDistOutputCheckResult;
