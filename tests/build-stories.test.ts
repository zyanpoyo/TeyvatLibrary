import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildProjectStories,
  checkExistingDistOutput,
  runDistOutputSmokeCheck,
  verifyDistOutput,
} from "../scripts/build-stories.mjs";

describe("build-stories smoke checks", () => {
  it("validates real repository story sources without writing dist files", () => {
    const result = buildProjectStories({ validateOnly: true });

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.stats.storyCount).toBeGreaterThan(0);
    expect(result.stats.courseCount).toBeGreaterThan(0);
    expect(result.dist).not.toBeNull();
  });

  it("writes and verifies all dist JSON outputs in an isolated temporary directory", () => {
    const { buildResult, verifyResult } = runDistOutputSmokeCheck();

    expect(buildResult.ok).toBe(true);
    expect(buildResult.errors).toEqual([]);
    expect(verifyResult).not.toBeNull();
    expect(verifyResult?.ok).toBe(true);
    expect(verifyResult?.errors).toEqual([]);
    expect(verifyResult?.stats.storyCount).toBeGreaterThan(0);
    expect(verifyResult?.stats.courseCount).toBe(buildResult.stats.courseCount);
    expect(verifyResult?.stats.searchStoryCount).toBe(verifyResult?.stats.storyCount);
    expect(verifyResult?.stats.storyFileCount).toBe(verifyResult?.stats.storyCount);
    expect(verifyResult?.stats.entityCount).toBeGreaterThan(0);
  });

  it("returns structured errors instead of throwing when verifying a missing directory", () => {
    const result = verifyDistOutput("__nonexistent_dist_output_smoke_dir__");

    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.stats).toEqual({
      storyCount: 0,
      courseCount: 0,
      searchStoryCount: 0,
      storyFileCount: 0,
      entityCount: 0,
    });
  });

  it("verifies existing public/data output integrity when present", () => {
    const existing = checkExistingDistOutput();
    if (!existing.exists) {
      expect(existing.verifyResult).toBeNull();
      return;
    }

    expect(existing.verifyResult).not.toBeNull();
    expect(existing.verifyResult?.ok).toBe(true);
    expect(existing.verifyResult?.errors).toEqual([]);
  });

  it("detects missing entity archive fields and broken evidenceLinks in verifyDistOutput", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "teyvat-entity-verify-"));
    try {
      const built = buildProjectStories({ distDir: tempDir, validateOnly: false });
      expect(built.ok).toBe(true);

      const indexPath = path.join(tempDir, "stories-index.json");
      const indexJson = JSON.parse(fs.readFileSync(indexPath, "utf8"));
      const firstEntityKey = Object.keys(indexJson.entitiesIndex)[0];
      indexJson.entitiesIndex[firstEntityKey].defaultDesc = " ";
      indexJson.entitiesIndex[firstEntityKey].evidenceLinks = [
        { title: "   ", storyId: "crimson_witch" },
        { title: "存在しない作品", storyId: "missing_story_id" },
      ];
      fs.writeFileSync(indexPath, JSON.stringify(indexJson), "utf8");

      const verifyRes = verifyDistOutput(tempDir);
      expect(verifyRes.ok).toBe(false);
      expect(verifyRes.errors.some((e) => e.includes(".defaultDesc が空です"))).toBe(true);
      expect(verifyRes.errors.some((e) => e.includes("evidenceLinks[0] の形式が不正です"))).toBe(
        true
      );
      expect(verifyRes.errors.some((e) => e.includes("missing_story_id"))).toBe(true);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
