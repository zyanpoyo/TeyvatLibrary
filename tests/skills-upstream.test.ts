import { describe, expect, it } from "vitest";
import { parseCliArgs } from "../scripts/check-skills-upstream.mjs";
import {
  buildSkillPatchFiles,
  classifyUpstreamChanges,
  loadAndValidateProjectManifest,
  markManifestSynced,
  renderUpstreamReport,
  validateSkillsManifest,
  type SkillsUpstreamManifest,
} from "../scripts/lib/skills-upstream.mjs";

const SAMPLE_MANIFEST: SkillsUpstreamManifest = {
  $schemaVersion: 1,
  upstream: {
    owner: "mattpocock",
    repo: "skills",
    branch: "main",
    url: "https://github.com/mattpocock/skills",
    license: "MIT",
    copyright: "Copyright (c) 2026 Matt Pocock",
  },
  lastSyncedCommit: "5863806dd4e15c63174bee4e7515a4256792ecfa",
  lastSyncedAt: "2026-11-17",
  localConventions: ["日本語トリガーを維持する", ".scratch/ を維持する"],
  trackedSkills: {
    tdd: {
      upstreamDir: "skills/engineering/tdd",
      localDir: ".agents/skills/tdd",
      files: {
        "SKILL.md": "SKILL.md",
        "tests.md": "references/tests.md",
      },
    },
    handoff: {
      upstreamDir: "skills/productivity/handoff",
      localDir: ".agents/skills/handoff",
      files: {
        "SKILL.md": "SKILL.md",
      },
    },
  },
  ignoredUpstreamSkills: {
    "skills/engineering/pr": "未採用",
  },
  ignoredCategories: ["skills/deprecated", "skills/in-progress", "skills/misc"],
};

describe("skills-upstream", () => {
  it("validates the real repository manifest against local files and NOTICE", () => {
    const result = loadAndValidateProjectManifest();
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
    expect(Object.keys(result.manifest?.trackedSkills || {})).toHaveLength(18);
  });

  it("detects missing NOTICE entries and duplicate tracked/ignored skills", () => {
    const broken: SkillsUpstreamManifest = {
      ...SAMPLE_MANIFEST,
      ignoredUpstreamSkills: {
        "skills/engineering/tdd": "重複テスト",
      },
    };
    const result = validateSkillsManifest({
      manifest: broken,
      noticeText: "mattpocock/skills: tdd only",
    });

    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("handoff"))).toBe(true);
    expect(result.errors.some((e) => e.includes("両方に登録"))).toBe(true);
  });

  it("parses CLI flags accurately", () => {
    expect(
      parseCliArgs([
        "--from",
        "abc1234",
        "--output-dir",
        ".scratch/custom",
        "--no-write",
        "--json",
      ])
    ).toEqual({
      validateOnly: false,
      markSynced: null,
      date: null,
      from: "abc1234",
      outputDir: ".scratch/custom",
      noWrite: true,
      json: true,
      help: false,
    });

    expect(parseCliArgs(["--mark-synced", "1234567890abcdef", "--date", "2026-12-01"])).toMatchObject({
      markSynced: "1234567890abcdef",
      date: "2026-12-01",
    });
  });

  it("classifies tracked updates, references mapping, unmapped files, new skills, removals, and license changes", () => {
    const classified = classifyUpstreamChanges({
      manifest: SAMPLE_MANIFEST,
      compareFiles: [
        {
          filename: "skills/engineering/tdd/tests.md",
          status: "modified",
          additions: 5,
          deletions: 1,
          patch: "@@ -1 +1 @@\n-old\n+new",
        },
        {
          filename: "skills/engineering/tdd/NEW-GUIDE.md",
          status: "added",
          additions: 12,
          deletions: 0,
          patch: "@@ -0,0 +1 @@\n+# New Guide",
        },
        {
          filename: "skills/engineering/tdd/agents/openai.yaml",
          status: "modified",
          additions: 1,
          deletions: 1,
          patch: "@@ -1 +1 @@",
        },
        {
          filename: "skills/deprecated/handoff/SKILL.md",
          previous_filename: "skills/productivity/handoff/SKILL.md",
          status: "renamed",
        },
        {
          filename: "skills/engineering/pr/SKILL.md",
          status: "modified",
        },
        {
          filename: "skills/engineering/brand-new/SKILL.md",
          status: "added",
        },
        {
          filename: "skills/in-progress/experimental/SKILL.md",
          status: "added",
        },
        {
          filename: "LICENSE",
          status: "modified",
          additions: 1,
          deletions: 1,
        },
      ],
      headTreePaths: [
        "skills/engineering/tdd/SKILL.md",
        "skills/engineering/brand-new/SKILL.md",
        "skills/productivity/another-new/SKILL.md",
        "skills/misc/ignored-misc/SKILL.md",
      ],
    });

    expect(classified.updatedTracked).toHaveLength(1);
    expect(classified.updatedTracked[0]).toMatchObject({
      skill: "tdd",
      upstreamPath: "skills/engineering/tdd/tests.md",
      localPath: ".agents/skills/tdd/references/tests.md",
    });

    expect(classified.unmappedTrackedFiles).toHaveLength(2);
    expect(classified.unmappedTrackedFiles.find((f) => f.relativePath === "NEW-GUIDE.md")?.isAgentMeta).toBe(
      false
    );
    expect(
      classified.unmappedTrackedFiles.find((f) => f.relativePath === "agents/openai.yaml")?.isAgentMeta
    ).toBe(true);

    expect(classified.deprecatedOrRemoved).toEqual([
      {
        skill: "handoff",
        previousPath: "skills/productivity/handoff/SKILL.md",
        currentPath: "skills/deprecated/handoff/SKILL.md",
        status: "renamed",
      },
    ]);

    expect(classified.ignoredUpdates).toHaveLength(1);
    expect(classified.licenseChanged).toHaveLength(1);
    expect(classified.newSkills.map((s) => s.upstreamDir)).toEqual([
      "skills/engineering/brand-new",
      "skills/productivity/another-new",
    ]);

    const patches = buildSkillPatchFiles(classified);
    expect(patches.has("tdd")).toBe(true);
    const tddPatch = patches.get("tdd") || "";
    expect(tddPatch).toContain("# Local:    .agents/skills/tdd/references/tests.md");
    expect(tddPatch).toContain("# Upstream (UNMAPPED): skills/engineering/tdd/NEW-GUIDE.md");
    expect(tddPatch).not.toContain("openai.yaml");

    const report = renderUpstreamReport({
      manifest: SAMPLE_MANIFEST,
      baseCommit: "5863806dd4e15c63174bee4e7515a4256792ecfa",
      headCommit: "abcdef1234567890abcdef1234567890abcdef12",
      headDate: "2026-12-01",
      commits: [{ sha: "abcdef1234567", date: "2026-12-01", message: "tdd: clarify seams" }],
      classified,
    });
    expect(report).toContain("⚠ ライセンス・NOTICE の変更");
    expect(report).toContain(".agents/skills/tdd/references/tests.md");
    expect(report).toContain("skills/engineering/brand-new");
    expect(report).toContain("--mark-synced abcdef1234567890abcdef1234567890abcdef12");
  });

  it("immutably updates lastSyncedCommit and validates input in markManifestSynced", () => {
    const updated = markManifestSynced(SAMPLE_MANIFEST, {
      commit: "abcdef1234567890abcdef1234567890abcdef12",
      date: "2026-12-01",
    });
    expect(updated.lastSyncedCommit).toBe("abcdef1234567890abcdef1234567890abcdef12");
    expect(updated.lastSyncedAt).toBe("2026-12-01");
    expect(SAMPLE_MANIFEST.lastSyncedCommit).toBe("5863806dd4e15c63174bee4e7515a4256792ecfa");

    expect(() => markManifestSynced(SAMPLE_MANIFEST, { commit: "not-a-sha" })).toThrow();
  });
});
