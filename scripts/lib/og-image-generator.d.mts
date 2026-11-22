import type { StoriesIndexData } from "../../src/types/story";

export const OG_IMAGE_WIDTH: number;
export const OG_IMAGE_HEIGHT: number;
export const OG_TEMPLATE_VERSION: string;

export interface OgGenerationResult {
  totalGenerated: number;
  cacheHits: number;
  renderedCount: number;
  missingChars: string[];
}

export interface OgSampleCheck {
  relPath: string;
  exists: boolean;
  byteLength: number;
  validSignature: boolean;
  width: number;
  height: number;
}

export interface OgSmokeCheckResult {
  firstRun: OgGenerationResult;
  secondRun: OgGenerationResult;
  sampleChecks: OgSampleCheck[];
}

export function generateAllOgImages(options: {
  clientDir: string;
  indexData: StoriesIndexData;
  siteUrl?: string | null;
  cacheDir?: string;
  fontPkgDir?: string;
  force?: boolean;
  only?: string | string[] | null;
}): Promise<OgGenerationResult>;

export function runOgImageGeneratorSmokeCheck(options: {
  indexData: StoriesIndexData;
  siteUrl?: string | null;
}): Promise<OgSmokeCheckResult>;
