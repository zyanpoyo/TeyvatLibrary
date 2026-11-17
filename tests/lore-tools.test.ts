import { describe, expect, it } from "vitest";
import { createCorpusChecker } from "../scripts/lib/validator.mjs";
import { buildInspectReport, parseCliArgs, searchLoreEntries } from "../scripts/lore-tools.mjs";

const MOCK_DB = {
  artifacts: {
    marechausseehunter: {
      name: "ファントムハンター",
      rarityList: [4, 5],
      effect2Pc: "通常攻撃ダメージ+15%",
      effect4Pc: "会心率上昇",
      flower: { name: "狩人の胸花", description: "古い勲章。", story: "ファントムハンターの本文。" },
      plume: { name: "傑作の序曲", description: "工具。", story: "アラン・ギヨタンの記録。" },
    },
  },
  weapons: {
    splendoroftranquilwaters: {
      name: "静水流転の輝き",
      rarity: 5,
      weaponText: "片手剣",
      effectName: "湖光の朝夕",
      effectTemplateRaw: "HP上昇",
      description: "至純の水をまとう杖。",
      story: "",
    },
    ateaspoonoftranscendence: {
      name: "超越の鍵",
      rarity: 5,
      weaponText: "両手剣",
      effectName: "白の女皇",
      effectTemplateRaw: "攻撃力上昇",
      description: "空想のアイテム。",
      story: "第1段落です。\n\n第2段落のアランの話。",
    },
  },
  characters: {
    sandrone: {
      name: "サンドローネ",
      description: "ファデュイ執行官第七位「傀儡」。",
    },
  },
};

describe("lore-tools", () => {
  it("parses inspect and search CLI flags", () => {
    expect(
      parseCliArgs(["inspect", "--type", "weapon", "--id", "ateaspoonoftranscendence", "--json", "--check-text", "本文"])
    ).toEqual({
      command: "inspect",
      type: "weapon",
      id: "ateaspoonoftranscendence",
      json: true,
      checkText: "本文",
      collection: "all",
      limit: 20,
      keyword: null,
    });

    expect(parseCliArgs(["search", "ギヨタン", "--collection", "artifacts", "--limit", "5"])).toEqual({
      command: "search",
      type: null,
      id: null,
      json: false,
      checkText: null,
      collection: "artifacts",
      limit: 5,
      keyword: "ギヨタン",
    });
  });

  it("warns on 0-char weapon stories and splits paragraphs while checking unregistered katakana", () => {
    const emptyReport = buildInspectReport({
      sourceType: "weapon",
      rawId: "splendoroftranquilwaters",
      dbJapanese: MOCK_DB,
    });
    expect(emptyReport.totalRawCharCount).toBe(0);
    expect(emptyReport.warnings[0]).toContain("0 文字");

    const corpusChecker = createCorpusChecker({}, { terms: { アラン: 1 } });
    const spoonReport = buildInspectReport({
      sourceType: "weapon",
      rawId: "ateaspoonoftranscendence",
      dbJapanese: MOCK_DB,
      corpusChecker,
      checkText: "未登録テキスト",
    });
    expect(spoonReport.paragraphs).toEqual(["第1段落です。", "第2段落のアランの話。"]);
    expect(spoonReport.warnings[0]).toContain("短文");
    expect(spoonReport.katakanaIssues.some((msg) => msg.includes("「テキスト」"))).toBe(true);
    expect(spoonReport.katakanaIssues.some((msg) => msg.includes("「アイテム」"))).toBe(true);
  });

  it("searches across collections and books with collection filter and limit", () => {
    const hits = searchLoreEntries({
      keyword: "ギヨタン",
      dbJapanese: MOCK_DB,
      booksData: [{ id: "sample_book", name: "ギヨタン記", volumes: [] }],
      limit: 10,
    });
    expect(hits.map((h) => `${h.collection}:${h.rawId}`)).toEqual([
      "artifacts:marechausseehunter",
      "books:sample_book",
    ]);

    const limited = searchLoreEntries({
      keyword: "の",
      dbJapanese: MOCK_DB,
      collection: "weapons",
      limit: 1,
    });
    expect(limited).toHaveLength(1);
    expect(limited[0].collection).toBe("weapons");
  });
});
