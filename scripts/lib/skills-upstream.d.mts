export interface UpstreamConfig {
  owner: string;
  repo: string;
  branch: string;
  url: string;
  license: string;
  copyright: string;
}

export interface TrackedSkillEntry {
  upstreamDir: string;
  localDir: string;
  files: Record<string, string>;
}

export interface SkillsUpstreamManifest {
  $schemaVersion: number;
  upstream: UpstreamConfig;
  lastSyncedCommit: string;
  lastSyncedAt: string;
  localConventions: string[];
  trackedSkills: Record<string, TrackedSkillEntry>;
  ignoredUpstreamSkills?: Record<string, string>;
  ignoredCategories?: string[];
}

export interface CompareFileItem {
  filename: string;
  previous_filename?: string;
  status?: string;
  additions?: number;
  deletions?: number;
  patch?: string;
}

export interface UpdatedTrackedItem {
  skill: string;
  upstreamPath: string;
  localPath: string;
  status: string;
  additions: number;
  deletions: number;
  patch: string;
}

export interface UnmappedTrackedItem {
  skill: string;
  upstreamPath: string;
  relativePath: string;
  status: string;
  isAgentMeta: boolean;
  additions: number;
  deletions: number;
  patch: string;
}

export interface DeprecatedOrRemovedItem {
  skill: string;
  previousPath: string;
  currentPath: string | null;
  status: string;
}

export interface NewSkillCandidate {
  upstreamDir: string;
  files: string[];
  fromDiff: boolean;
}

export interface LicenseChangedItem {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch: string;
}

export interface ClassifiedUpstreamChanges {
  updatedTracked: UpdatedTrackedItem[];
  unmappedTrackedFiles: UnmappedTrackedItem[];
  deprecatedOrRemoved: DeprecatedOrRemovedItem[];
  newSkills: NewSkillCandidate[];
  ignoredUpdates: Array<{ upstreamDir: string; filename: string; status: string }>;
  licenseChanged: LicenseChangedItem[];
}

export function validateSkillsManifest(params: {
  manifest: SkillsUpstreamManifest;
  rootDir?: string;
  noticeText?: string | null;
}): { ok: boolean; errors: string[]; warnings: string[] };

export function classifyUpstreamChanges(params: {
  manifest: SkillsUpstreamManifest;
  compareFiles?: CompareFileItem[];
  headTreePaths?: string[];
}): ClassifiedUpstreamChanges;

export function buildSkillPatchFiles(
  classified: ClassifiedUpstreamChanges
): Map<string, string>;

export function renderUpstreamReport(params: {
  manifest: SkillsUpstreamManifest;
  baseCommit: string;
  headCommit: string;
  headDate?: string;
  commits?: Array<{ sha: string; date?: string; message?: string }>;
  classified: ClassifiedUpstreamChanges;
}): string;

export function markManifestSynced(
  manifest: SkillsUpstreamManifest,
  params: { commit: string; date?: string }
): SkillsUpstreamManifest;

export function loadAndValidateProjectManifest(rootDir?: string): {
  ok: boolean;
  manifest: SkillsUpstreamManifest | null;
  errors: string[];
  warnings: string[];
};
