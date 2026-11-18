import { describe, expect, it } from "vitest";
import {
  buildOfficialCorpus,
  createYattaBookFetcher,
  extractRawSourceSnapshot,
} from "../scripts/lib/genshin-sources.mjs";
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

  it("inspects extracted raw book volumes via sanitizeRawSourceText without synthetic volume wrappers", () => {
    const report = buildInspectReport({
      sourceType: "book",
      rawId: "sample_book",
      dbJapanese: MOCK_DB,
      booksData: [
        {
          _id: 1001,
          id: "sample_book",
          name: "白夜国館蔵",
          rarity: 4,
          volumes: [{ _id: 1, name: "第一巻", description: "要約", storyId: "201" }],
        },
      ],
      rawBookJson: {
        id: "sample_book",
        volumes: [
          { id: 1, name: "第一巻", text: "<color=#FFF>第一章</color><br/>本文テキストです。" },
        ],
      },
    });

    expect(report.volumes).toHaveLength(1);
    expect(report.volumes?.[0].paragraphs).toEqual(["第一章\n本文テキストです。"]);
  });

  it("extracts raw snapshots via genshin-sources and injectable Yatta HTTP adapter", async () => {
    const dbSnapshot = await extractRawSourceSnapshot({
      sourceType: "weapon",
      rawId: "ateaspoonoftranscendence",
      dbJapanese: MOCK_DB,
    });
    expect(dbSnapshot.sourceType).toBe("weapon");
    expect(dbSnapshot.rawId).toBe("ateaspoonoftranscendence");
    expect(dbSnapshot.data.name).toBe("超越の鍵");

    const requestedUrls: string[] = [];
    const mockFetch = async (url: string) => {
      requestedUrls.push(url);
      if (url.endsWith("/book/1001")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: { volume: [{ id: 1, name: "第一巻", storyId: 901 }] } }),
        };
      }
      if (url.endsWith("/readable/Book901")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: "白夜国の記録。" }),
        };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    };

    const bookSnapshot = await extractRawSourceSnapshot({
      sourceType: "book",
      rawId: "1001",
      booksData: [
        {
          _id: 1001,
          id: "byakuya_book",
          name: "白夜国館蔵",
          rarity: 4,
          volumes: [{ _id: 1, name: "第一巻", description: "要約", storyId: "201" }],
        },
      ],
      fetchBookRaw: createYattaBookFetcher(mockFetch, "https://mock.yatta/api/v2/jp"),
    });

    expect(requestedUrls).toEqual([
      "https://mock.yatta/api/v2/jp/book/1001",
      "https://mock.yatta/api/v2/jp/readable/Book901",
    ]);
    expect(bookSnapshot.rawId).toBe("byakuya_book");
    expect(bookSnapshot.data.volumes).toEqual([
      {
        id: 1,
        name: "第一巻",
        description: "要約",
        storyId: "901",
        text: "白夜国の記録。",
      },
    ]);

    await expect(
      extractRawSourceSnapshot({
        sourceType: "unknown",
        rawId: "x",
        dbJapanese: MOCK_DB,
      })
    ).rejects.toThrow("Unsupported sourceType");
  });

  it("builds official corpus with title/name weighting and without dead customLoreTerms", () => {
    const corpus = buildOfficialCorpus({
      dataModules: [{ file: "data_japanese_books.cjs", data: [{ title: "ファデュイ", body: "モラ" }] }],
      jpDb: { weapons: { test: { name: "ロザリン", story: "モラとファデュイ" } } },
      rawSnapshots: [{ text: "モラは大切" }],
      genshinDataVersion: "0.65.1",
      genshinDbVersion: "5.2.15",
      updatedAt: "2026-11-18T00:00:00.000Z",
    });

    expect("customLoreTerms" in corpus).toBe(false);
    expect(corpus.meta.termCount).toBe(3);
    expect(corpus.meta.rawFileCount).toBe(1);
    expect(corpus.terms).toEqual({
      ファデュイ: 6,
      ロザリン: 5,
      モラ: 3,
    });
  });
});
