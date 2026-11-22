import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseArgs } from "../scripts/generate-og-images.mjs";
import {
  generateAllOgImages,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_WIDTH,
  runOgImageGeneratorSmokeCheck,
} from "../scripts/lib/og-image-generator.mjs";
import { loadDistStoriesIndex } from "../src/server/dist-data.server.mjs";

describe("static OGP image generator", () => {
  it("renders valid 1200x630 PNGs for site, about, and all stories with zero missing glyphs and reuses cache", async () => {
    const realIndex = loadDistStoriesIndex();
    const { firstRun, secondRun, sampleChecks } = await runOgImageGeneratorSmokeCheck({
      indexData: realIndex,
      siteUrl: "https://teyvat-bunko.com",
    });

    expect(firstRun.missingChars).toEqual([]);
    expect(firstRun.totalGenerated).toBe(realIndex.stories.length + 2);
    expect(firstRun.renderedCount).toBe(realIndex.stories.length + 2);
    expect(firstRun.cacheHits).toBe(0);

    expect(sampleChecks.length).toBeGreaterThanOrEqual(5);
    for (const check of sampleChecks) {
      expect(check.exists).toBe(true);
      expect(check.validSignature).toBe(true);
      expect(check.byteLength).toBeGreaterThan(1000);
      expect(check.width).toBe(OG_IMAGE_WIDTH);
      expect(check.height).toBe(OG_IMAGE_HEIGHT);
    }

    expect(secondRun.totalGenerated).toBe(firstRun.totalGenerated);
    expect(secondRun.renderedCount).toBe(0);
    expect(secondRun.cacheHits).toBe(firstRun.totalGenerated);
  }, 30000);

  it("supports targeted generation with --only, forced re-render with --force, and rejects unknown targets", async () => {
    const realIndex = loadDistStoriesIndex();
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "teyvat-og-options-"));
    const clientDir = path.join(tempRoot, "client");
    const cacheDir = path.join(tempRoot, "cache");

    try {
      const targeted = await generateAllOgImages({
        clientDir,
        indexData: realIndex,
        siteUrl: "https://teyvat-bunko.com",
        cacheDir,
        only: ["site", "crimson_witch"],
      });

      expect(targeted.totalGenerated).toBe(2);
      expect(targeted.renderedCount).toBe(2);
      expect(targeted.cacheHits).toBe(0);
      expect(fs.existsSync(path.join(clientDir, "og", "site.png"))).toBe(true);
      expect(fs.existsSync(path.join(clientDir, "og", "story", "crimson_witch.png"))).toBe(true);
      expect(fs.existsSync(path.join(clientDir, "og", "about.png"))).toBe(false);

      const cached = await generateAllOgImages({
        clientDir,
        indexData: realIndex,
        siteUrl: "https://teyvat-bunko.com",
        cacheDir,
        only: ["site", "crimson_witch"],
      });
      expect(cached.renderedCount).toBe(0);
      expect(cached.cacheHits).toBe(2);

      const forced = await generateAllOgImages({
        clientDir,
        indexData: realIndex,
        siteUrl: "https://teyvat-bunko.com",
        cacheDir,
        only: ["site", "crimson_witch"],
        force: true,
      });
      expect(forced.totalGenerated).toBe(2);
      expect(forced.renderedCount).toBe(2);
      expect(forced.cacheHits).toBe(0);

      await expect(
        generateAllOgImages({
          clientDir,
          indexData: realIndex,
          siteUrl: "https://teyvat-bunko.com",
          cacheDir,
          only: ["nonexistent_story_id"],
        })
      ).rejects.toThrow("nonexistent_story_id");
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  }, 30000);

  it("parses --force, --only, --out, and --site-url CLI arguments", () => {
    const parsed = parseArgs([
      "--force",
      "--only",
      "site,about",
      "--only",
      "crimson_witch",
      "--out",
      "build/custom",
      "--site-url=https://teyvat-bunko.com",
    ]);

    expect(parsed.force).toBe(true);
    expect(parsed.help).toBe(false);
    expect(parsed.only).toEqual(["site", "about", "crimson_witch"]);
    expect(parsed.siteUrl).toBe("https://teyvat-bunko.com");
    expect(parsed.outDir).toBe(path.resolve(process.cwd(), "build/custom"));
  });
});
