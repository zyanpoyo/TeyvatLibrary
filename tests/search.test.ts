import { describe, expect, it } from "vitest";
import {
  evaluateCatalogSearch,
  normalizeSearchText,
  splitHighlightedText,
  tokenizeSearchQuery,
} from "../src/domain/search";
import type { SearchIndexData, StoriesIndexData } from "../src/types/story";

const INDEX_DATA: StoriesIndexData = {
  generatedAt: "2026-11-18T00:00:00.000Z",
  totalCount: 2,
  categoryCounts: {
    book: 1,
    artifact: 1,
    weapon: 0,
    attire: 0,
    chronicle: 0,
  },
  entitiesIndex: {
    rosalyne: {
      name: "ロザリン（淑女）",
      kind: "character",
      storyIds: ["crimson_witch"],
    },
    rustan: {
      name: "ルースタン",
      kind: "character",
      storyIds: ["crimson_witch"],
    },
    orobashi: {
      name: "オロバシノミコト",
      kind: "god",
      storyIds: ["byakuyakoku"],
    },
  },
  stories: [
    {
      id: "crimson_witch",
      title: "燃え盛る炎の魔女",
      shelfCategory: "artifact",
      categoryLabel: "聖遺物（連作短編）",
      region: ["モンド", "スメール"],
      era: "500年前の災厄",
      readingTime: "約4分",
      charCount: 2000,
      hook: "液体の炎へと変えた少女",
      tags: ["ロザリン（淑女）"],
      entityIds: ["rosalyne", "rustan"],
    },
    {
      id: "byakuyakoku",
      title: "白夜国館蔵",
      shelfCategory: "book",
      categoryLabel: "書籍（古文書・禁書）",
      region: ["淵下宮"],
      era: "白夜国時代",
      readingTime: "約8分",
      charCount: 4000,
      hook: "深海の民と白蛇の記録",
      tags: ["オロバシ", "太陽の子"],
      entityIds: ["orobashi"],
    },
  ],
};

const SEARCH_INDEX: SearchIndexData = {
  generatedAt: "2026-11-18T00:00:00.000Z",
  stories: {
    crimson_witch: {
      id: "crimson_witch",
      title: "燃え盛る炎の魔女",
      hook: "液体の炎へと変えた少女",
      categoryLabel: "聖遺物（連作短編）",
      era: "500年前の災厄",
      region: ["モンド", "スメール"],
      tags: ["ロザリン（淑女）"],
      entityNames: ["ロザリン（淑女）", "ルースタン"],
      preGuide: ["舞台：スメールの教令院へ留学していた少女の記録"],
      chapters: [
        {
          chapterIndex: 0,
          partLabel: "第一章（時の砂）",
          heading: "静止した水時計",
          epigraph: "炎に捧げた歳月。",
          paragraphs: [
            "特製の水時計が一周回る時間は、教令院で勉強する時間と同じ。",
            "時計をくれた人はすでに災いの糧となっていた。",
          ],
          chapterNote: "帰郷した少女を待っていたのは恋人の死でした。",
        },
        {
          chapterIndex: 1,
          partLabel: "第二章（生の花）",
          heading: "余燼の誓い",
          epigraph: "炎の記憶。",
          paragraphs: ["煙と余燼の中から、炎の魔女が誕生した。"],
        },
      ],
      glossary: [
        {
          termId: "cw_lover",
          term: "時計をくれた人",
          identity: "正体：西風騎士団の騎士「ルースタン」",
          desc: "ロザリンの恋人であり、水時計を贈った人物。",
          firstChapterIndex: 0,
          firstParagraphIndex: 1,
        },
      ],
      truth: {
        overallTruth: "この魔女こそファデュイ執行官第八位『シニョーラ』である。",
        gameEffect: "2セット：炎元素ダメージ+15%。",
      },
    },
    byakuyakoku: {
      id: "byakuyakoku",
      title: "白夜国館蔵",
      hook: "深海の民と白蛇の記録",
      categoryLabel: "書籍（古文書・禁書）",
      era: "白夜国時代",
      region: ["淵下宮"],
      tags: ["オロバシ", "太陽の子"],
      entityNames: ["オロバシノミコト"],
      preGuide: ["舞台：太陽の届かぬ暗黒の海"],
      chapters: [
        {
          chapterIndex: 0,
          partLabel: "第1巻",
          heading: "常世国龍蛇伝",
          epigraph: "海淵の伝承。",
          paragraphs: ["大日御輿の光が民を照らし、白夜と常夜が巡る。"],
        },
      ],
      glossary: [],
      truth: {
        overallTruth: "大蛇オロバシはイスタロトの導きで民を救った。",
        gameEffect: "ゲーム内書籍全5巻。",
      },
    },
  },
};

describe("search domain", () => {
  it("normalizes kana/katakana, full/half-width, and case while preserving original highlight offsets", () => {
    expect(normalizeSearchText("ＳＮＥＺＨＮＡＹＡ　シニョーラ")).toBe("snezhnaya しにょーら");
    expect(tokenizeSearchQuery("  ろざりん　水時計  ろざりん ")).toEqual(["ろざりん", "水時計"]);

    const segments = splitHighlightedText("執行官『シニョーラ』とｼﾆｮｰﾗの記録", "しにょーら");
    expect(segments).toEqual([
      { text: "執行官『", highlighted: false },
      { text: "シニョーラ", highlighted: true },
      { text: "』と", highlighted: false },
      { text: "ｼﾆｮｰﾗ", highlighted: true },
      { text: "の記録", highlighted: false },
    ]);
  });

  it("supports cross-field AND search across entity/tags and chapter prose", () => {
    const result = evaluateCatalogSearch({
      indexData: INDEX_DATA,
      searchIndex: SEARCH_INDEX,
      query: "ろざりん 水時計",
      includeTruth: false,
    });

    expect(result.hasQuery).toBe(true);
    expect(Array.from(result.matchesByStoryId.keys())).toEqual(["crimson_witch"]);

    const match = result.matchesByStoryId.get("crimson_witch");
    expect(match).toBeDefined();
    expect(match!.snippets.some((s) => s.kind === "chapter" && s.target.chapterIndex === 0)).toBe(true);
    expect(match!.snippets.some((s) => s.kind === "glossary" && s.target.termId === "cw_lover")).toBe(true);
  });

  it("protects overallTruth from unread stories unless includeTruth is true or the story is read", () => {
    // 未読＋includeTruth=false では真相メモ内の語「イスタロト」「シニョーラ」がヒットしない
    const hidden = evaluateCatalogSearch({
      indexData: INDEX_DATA,
      searchIndex: SEARCH_INDEX,
      query: "シニョーラ",
      includeTruth: false,
      isStoryRead: () => false,
    });
    expect(hidden.matchesByStoryId.size).toBe(0);

    // 読了済みなら includeTruth=false でもその作品の真相メモは検索対象になる
    const readAllowed = evaluateCatalogSearch({
      indexData: INDEX_DATA,
      searchIndex: SEARCH_INDEX,
      query: "シニョーラ",
      includeTruth: false,
      isStoryRead: (id) => id === "crimson_witch",
    });
    expect(Array.from(readAllowed.matchesByStoryId.keys())).toEqual(["crimson_witch"]);
    expect(readAllowed.matchesByStoryId.get("crimson_witch")?.snippets[0].kind).toBe("truth");

    // includeTruth=true なら未読作品の真相メモも検索対象になる
    const optInAllowed = evaluateCatalogSearch({
      indexData: INDEX_DATA,
      searchIndex: SEARCH_INDEX,
      query: "イスタロト",
      includeTruth: true,
      isStoryRead: () => false,
    });
    expect(Array.from(optInAllowed.matchesByStoryId.keys())).toEqual(["byakuyakoku"]);
  });

  it("falls back gracefully to stories-index metadata when searchIndex is null", () => {
    const fallback = evaluateCatalogSearch({
      indexData: INDEX_DATA,
      searchIndex: null,
      query: "るーすたん",
    });
    expect(Array.from(fallback.matchesByStoryId.keys())).toEqual(["crimson_witch"]);
  });
});
