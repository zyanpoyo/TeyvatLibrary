import { describe, expect, it } from "vitest";
import entitiesSchema from "../data/schemas/entities.schema.json";
import storySchema from "../data/schemas/story.schema.json";
import { validateAgainstJsonSchema } from "../scripts/lib/json-schema.mjs";
import {
  VALID_IDENTITY_PREFIXES,
  buildTitleLookup,
  createCorpusChecker,
  extractEvidenceLinks,
  findEntityLinkHints,
  findSubtitleLinkErrors,
  resolveActualPlainText,
  resolveExpectedRawText,
} from "../scripts/lib/validator.mjs";

const STORY_SCHEMA_SAMPLE = {
  type: "object",
  required: ["id", "title", "chapters"],
  additionalProperties: false,
  properties: {
    id: { type: "string", pattern: "^[a-z0-9_]+$" },
    title: { type: "string", minLength: 1 },
    chapters: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        required: ["sourceRef"],
        additionalProperties: false,
        properties: {
          sourceRef: {
            type: "object",
            required: ["package", "sourceType", "rawId"],
            additionalProperties: false,
            properties: {
              package: { type: "string", enum: ["genshin-db", "genshin-data", "yatta"] },
              sourceType: { type: "string", enum: ["artifact", "weapon", "windglider", "book", "material"] },
              rawId: { type: "string", minLength: 1 },
            },
          },
        },
      },
    },
  },
};

describe("validateAgainstJsonSchema", () => {
  it("passes valid objects and rejects additionalProperties, missing required keys, and pattern mismatches", () => {
    const valid = {
      id: "pale_flame",
      title: "蒼白の炎",
      chapters: [{ sourceRef: { package: "genshin-db", sourceType: "artifact", rawId: "paleflame" } }],
    };
    const okErrors = validateAgainstJsonSchema(valid, STORY_SCHEMA_SAMPLE, "pale_flame");
    expect(okErrors).toEqual([]);

    const invalid = {
      id: "Invalid-Id",
      extraTopKey: true,
      chapters: [{ sourceRef: { package: "unknown", sourceType: "artifact", rawId: "x", unexpected: 1 } }],
    };
    const badErrors = validateAgainstJsonSchema(invalid, STORY_SCHEMA_SAMPLE, "invalid_story");

    expect(badErrors.some((e) => e.includes("必須フィールド 'title'"))).toBe(true);
    expect(badErrors.some((e) => e.includes("パターン"))).toBe(true);
    expect(badErrors.some((e) => e.includes("extraTopKey"))).toBe(true);
    expect(badErrors.some((e) => e.includes("許可された値"))).toBe(true);
    expect(badErrors.some((e) => e.includes("unexpected"))).toBe(true);
  });
});

describe("validator text, corpus, and link checks", () => {
  it("verifies raw text with stripPrefix and paragraphSlice against stripped inline tags", () => {
    const rawMaterial = {
      description: "武器に突破の力を付与する材料。\n第1段落です。<br/>改行続き。\n\n第2段落です。",
    };
    const expected = resolveExpectedRawText(rawMaterial, {
      sourceType: "material",
      rawId: "sample",
      stripPrefix: "武器に突破の力を付与する材料。\n",
      paragraphSlice: [0, 2],
    });
    const actual = resolveActualPlainText([
      "{{tag_one|第1段落}}です。\n改行続き。",
      "第2段落です。",
    ]);
    expect(actual).toBe(expected);
  });

  it("detects unregistered katakana with suggestions and NG variants", () => {
    const checker = createCorpusChecker(
      {
        ngVariants: { ツァーリツァ: "氷の女皇" },
        officialMediaTerms: ["シニョーラ"],
        allowedCommonKatakana: ["マント"],
      },
      { terms: { ヴァネッサ: 10, シニョーラ: 5 } }
    );

    const errors: string[] = [];
    checker("バネッサとツァーリツァとシニョーラのテキストとマント", "test.desc", errors);

    expect(errors.some((e) => e.includes("[NG固有名詞検出]") && e.includes("氷の女皇"))).toBe(true);
    expect(errors.some((e) => e.includes("「バネッサ」") && e.includes("ヴァネッサ"))).toBe(true);
    expect(errors.some((e) => e.includes("「テキスト」"))).toBe(true);
    expect(errors.some((e) => e.includes("シニョーラ") || e.includes("マント"))).toBe(false);
  });

  it("detects broken subtitle citations for other stories while ignoring self citations", () => {
    const titleLookup = buildTitleLookup([
      { id: "pale_flame", title: "蒼白の炎" },
      { id: "crimson_witch", title: "燃え盛る炎の魔女" },
      { id: "byakuyakoku", title: "白夜国館蔵（日月前事 ほか全五巻）" },
    ]);

    const errors: string[] = [];
    findSubtitleLinkErrors(
      "聖遺物『蒼白の炎（無垢の花）』・書籍『白夜国館蔵』・聖遺物『燃え盛る炎の魔女（時の砂）』",
      "crimson_witch.glossary.cw_girl.evidence",
      titleLookup,
      "crimson_witch",
      errors
    );

    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("蒼白の炎（無垢の花）");
    expect(errors[0]).toContain("pale_flame");

    const fixedLinks = extractEvidenceLinks(
      "聖遺物『蒼白の炎』（無垢の花）・書籍『白夜国館蔵』",
      titleLookup,
      "crimson_witch"
    );
    expect(fixedLinks).toEqual([
      { title: "蒼白の炎", storyId: "pale_flame" },
      { title: "白夜国館蔵", storyId: "byakuyakoku" },
    ]);
  });

  it("emits non-blocking hints when known entity names appear without entityId links", () => {
    const hints = findEntityLinkHints(
      {
        id: "distant_sea",
        overallTruth: "オロバシノミコトの自己犠牲を描く。",
        chapters: [{ paragraphs: ["{{tag|蛇神}}は民を導いた。"] }],
      },
      {
        orobashi: { name: "オロバシノミコト" },
        rosalyne: { name: "ロザリン（淑女）" },
      },
      new Set(["rosalyne"])
    );

    expect(hints).toHaveLength(1);
    expect(hints[0]).toContain("オロバシノミコト");
    expect(hints[0]).toContain("orobashi");
  });

  it("enforces the 3 purified identity prefixes across validator and JSON schemas", () => {
    expect(VALID_IDENTITY_PREFIXES).toEqual(["正体：", "解説：", "有力説："]);

    const validEntityErrors = validateAgainstJsonSchema(
      {
        test_a: {
          name: "テストA",
          kind: "character",
          defaultIdentity: "正体：テスト",
          defaultDesc: "説明",
          defaultEvidence: "記録",
        },
        test_b: {
          name: "テストB",
          kind: "concept",
          defaultIdentity: "解説：テスト",
          defaultDesc: "説明",
          defaultEvidence: "記録",
        },
        test_c: {
          name: "テストC",
          kind: "god",
          defaultIdentity: "有力説：テスト",
          defaultDesc: "説明",
          defaultEvidence: "記録",
        },
      },
      entitiesSchema,
      "entities"
    );
    expect(validEntityErrors).toEqual([]);

    const invalidEntityErrors = validateAgainstJsonSchema(
      {
        "Invalid-Entity": {
          name: "テストD",
          kind: "character",
          defaultIdentity: "鳴神名：テスト",
          defaultDesc: "説明",
          defaultEvidence: "記録",
        },
        legacy_b: {
          name: "テストE",
          kind: "god",
          defaultIdentity: "真名：テスト",
          defaultDesc: "説明",
          defaultEvidence: "記録",
        },
      },
      entitiesSchema,
      "entities"
    );
    expect(invalidEntityErrors.filter((e) => e.includes("パターン"))).toHaveLength(3);

    const storyWithLegacyIdentityErrors = validateAgainstJsonSchema(
      {
        id: "sample_story",
        title: "サンプル",
        shelfCategory: "weapon",
        categoryLabel: "武器",
        region: ["モンド"],
        era: "現代",
        hook: "フック",
        tags: [],
        preGuide: ["前提"],
        overallTruth: "真相",
        gameEffect: "効果",
        glossary: {
          "Bad-Key": {
            term: "語句",
            identity: "鳴神名：テスト",
          },
        },
        chapters: [
          {
            sourceRef: { package: "genshin-db", sourceType: "weapon", rawId: "sample" },
            partLabel: "第一章",
            heading: "見出し",
            epigraph: "",
            paragraphs: ["本文"],
          },
        ],
      },
      storySchema,
      "sample_story"
    );
    expect(storyWithLegacyIdentityErrors.some((e) => e.includes("Bad-Key"))).toBe(true);
    expect(storyWithLegacyIdentityErrors.some((e) => e.includes("glossary.Bad-Key.identity"))).toBe(true);
  });
});
