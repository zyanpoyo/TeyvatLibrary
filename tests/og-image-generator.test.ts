import { describe, expect, it } from "vitest";
import {
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
});
