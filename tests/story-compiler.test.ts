import { describe, expect, it } from "vitest";
import entitiesSchema from "../data/schemas/entities.schema.json";
import storySchema from "../data/schemas/story.schema.json";
import {
  compileStories,
  type CompileStoriesInput,
  type RawSourceRef,
} from "../scripts/lib/story-compiler.mjs";

const BASE_ENTITIES = {
  rosalyne: {
    name: "ロザリン（淑女）",
    kind: "character",
    defaultIdentity: "正体：炎の魔女「ロザリン」",
    defaultDesc: "愛する人を失い炎となった魔女。",
    defaultEvidence: "聖遺物『炎の魔女』",
  },
  rustan: {
    name: "ルースタン",
    kind: "character",
    defaultIdentity: "正体：騎士「ルースタン」",
    defaultDesc: "モンドを守り抜いた騎士。",
    defaultEvidence: "武器『終焉の詩』",
  },
};

const BASE_OFFICIAL_ENTITIES = {
  ngVariants: {
    ツァーリツァ: "氷の女皇",
  },
  officialMediaTerms: ["ロザリン", "ルースタン"],
  allowedCommonKatakana: ["モンド"],
};

const BASE_OFFICIAL_CORPUS = {
  terms: {
    ロザリン: 10,
    ルースタン: 8,
    モンド: 20,
  },
};

const BASE_RAW_SNAPSHOTS: Record<string, unknown> = {
  "artifact/crimsonwitchofflames": {
    flower: {
      story: "少女の頃の記憶。\n\n炎に焼かれる前の約束。",
    },
  },
  "weapon/elegyfortheend": {
    story: "騎士は静かに剣を置いた。",
  },
  "material/ashenheart": {
    description: "定型前置き文。\n真紅の灰が残された。",
  },
};

function createStubSnapshotReader(overrides: Record<string, unknown> = {}) {
  const snapshots: Record<string, unknown> = { ...BASE_RAW_SNAPSHOTS, ...overrides };
  return (ref: RawSourceRef) => {
    const key = `${ref.sourceType}/${ref.rawId}`;
    if (!(key in snapshots)) {
      throw new Error(`Raw snapshot not found: ${key}`);
    }
    return snapshots[key];
  };
}

function createValidCrimsonStory(overrides: Record<string, unknown> = {}) {
  return {
    id: "crimson_witch",
    title: "炎の魔女",
    shelfCategory: "artifact",
    categoryLabel: "聖遺物（連作短編）",
    region: ["モンド"],
    era: "災厄の時代",
    addedAt: "2026-11-15",
    hook: "涙が枯れた日に炎となった少女の記録",
    tags: ["ロザリン"],
    preGuide: ["舞台：五百年前のモンド"],
    overallTruth: "彼女こそ炎の魔女である。",
    gameEffect: "炎元素威力上昇",
    connected: [
      {
        targetId: "elegy",
        relation: "対になる視点（武器：終焉の詩）",
        desc: "『終焉の詩』——帰りを待ち続けた騎士の最期",
        reverseRelation: "表視点の記録（聖遺物：炎の魔女）",
        reverseDesc: "『炎の魔女』——恋人への想いを胸に炎となった少女",
      },
    ],
    glossary: {
      cw_girl: {
        entityId: "rosalyne",
        term: "少女",
        descOverride: "留学前の若き日のロザリン。",
        evidenceOverride: "聖遺物『炎の魔女』（花）・武器『終焉の詩』",
      },
    },
    chapters: [
      {
        sourceRef: {
          package: "genshin-db",
          sourceType: "artifact",
          rawId: "crimsonwitchofflames",
          piece: "flower",
        },
        partLabel: "第一章",
        heading: "炎の誓い",
        epigraph: "炎の記憶",
        paragraphs: [
          "{{cw_girl|少女}}の頃の記憶。",
          "炎に焼かれる前の約束。",
        ],
      },
    ],
    ...overrides,
  };
}

function createValidElegyStory(overrides: Record<string, unknown> = {}) {
  return {
    id: "elegy",
    title: "終焉の詩（追憶の弓）",
    shelfCategory: "weapon",
    categoryLabel: "武器（短編小説）",
    region: ["モンド"],
    era: "災厄の時代",
    hook: "騎士が最期に残した詩",
    tags: ["ルースタン"],
    preGuide: ["主人公：モンドの騎士"],
    overallTruth: "ルースタンは最期まで民を守った。",
    gameEffect: "元素熟知上昇",
    glossary: {
      el_knight: {
        entityId: "rustan",
        term: "騎士",
      },
    },
    chapters: [
      {
        sourceRef: {
          package: "genshin-db",
          sourceType: "weapon",
          rawId: "elegyfortheend",
        },
        partLabel: "本編",
        heading: "静かな終焉",
        epigraph: "古い弓の銘文",
        paragraphs: ["{{el_knight|騎士}}は静かに剣を置いた。"],
      },
    ],
    ...overrides,
  };
}

function createBaseInput(overrides: Partial<CompileStoriesInput> = {}): CompileStoriesInput {
  return {
    stories: [
      {
        folderCategory: "artifact",
        fileSlug: "crimson_witch",
        story: createValidCrimsonStory(),
      },
      {
        folderCategory: "weapon",
        fileSlug: "elegy",
        story: createValidElegyStory(),
      },
    ],
    entities: BASE_ENTITIES,
    officialEntities: BASE_OFFICIAL_ENTITIES,
    officialCorpus: BASE_OFFICIAL_CORPUS,
    schemas: {
      story: storySchema,
      entities: entitiesSchema,
    },
    readRawSnapshot: createStubSnapshotReader(),
    ...overrides,
  };
}

describe("StoryCompiler (compileStories)", () => {
  it("compiles valid stories, resolves entities/evidenceLinks, expands bidirectional connections, and returns dist payloads", () => {
    const result = compileStories(createBaseInput());

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.dist).not.toBeNull();
    if (!result.dist) return;

    // 配信インデックス検証
    expect(result.dist.index.totalCount).toBe(2);
    expect(result.dist.index.categoryCounts).toEqual({
      book: 0,
      artifact: 1,
      weapon: 1,
      attire: 0,
      chronicle: 0,
    });
    expect(result.dist.index.entitiesIndex.rosalyne.storyIds).toEqual(["crimson_witch"]);
    expect(result.dist.index.entitiesIndex.rustan.storyIds).toEqual(["elegy"]);

    // Entity継承＋Override＋出典自動リンク解決（自作品除外＋括弧付きベースタイトル解決）
    const crimsonDist = result.dist.storiesById.crimson_witch;
    expect(crimsonDist.addedAt).toBe("2026-11-15");
    expect(crimsonDist.readingTime).toBe("約1分");
    expect(crimsonDist.charCount).toBe("少女の頃の記憶。炎に焼かれる前の約束。".length);
    expect(crimsonDist.chapterCount).toBe(1);
    expect(crimsonDist.glossary.cw_girl.identity).toBe("正体：炎の魔女「ロザリン」");
    expect(crimsonDist.glossary.cw_girl.desc).toBe("留学前の若き日のロザリン。");
    expect(crimsonDist.glossary.cw_girl.evidenceLinks).toEqual([
      { title: "終焉の詩", storyId: "elegy" },
    ]);

    // 双方向 connected 自動展開
    const elegyDist = result.dist.storiesById.elegy;
    expect(elegyDist.connected).toEqual([
      {
        targetId: "crimson_witch",
        title: "炎の魔女",
        relation: "表視点の記録（聖遺物：炎の魔女）",
        desc: "『炎の魔女』——恋人への想いを胸に炎となった少女",
      },
    ]);
  });

  it("does not overwrite existing explicit reverse links and emits non-blocking entity hints", () => {
    const input = createBaseInput({
      stories: [
        {
          folderCategory: "artifact",
          fileSlug: "crimson_witch",
          story: createValidCrimsonStory(),
        },
        {
          folderCategory: "weapon",
          fileSlug: "elegy",
          story: createValidElegyStory({
            // 本文にロザリン言及があるが glossary.entityId に rosalyne が無い → warning 対象
            overallTruth: "ロザリンを想いながらルースタンは民を守った。",
            connected: [
              {
                targetId: "crimson_witch",
                relation: "手動定義の逆参照",
                desc: "『炎の魔女』——明示優先の確認",
              },
            ],
          }),
        },
      ],
    });

    const result = compileStories(input);
    expect(result.ok).toBe(true);
    expect(result.warnings.some((w) => w.includes("ロザリン") && w.includes("rosalyne"))).toBe(true);
    expect(result.dist?.storiesById.elegy.connected).toEqual([
      {
        targetId: "crimson_witch",
        title: "炎の魔女",
        relation: "手動定義の逆参照",
        desc: "『炎の魔女』——明示優先の確認",
      },
    ]);
  });

  it("safely aborts at the schema gate without crashing when chapters or entities are missing/malformed", () => {
    const brokenStory = createValidElegyStory();
    delete (brokenStory as Record<string, unknown>).chapters;

    const result = compileStories(
      createBaseInput({
        stories: [
          {
            folderCategory: "artifact",
            fileSlug: "crimson_witch",
            story: createValidCrimsonStory(),
          },
          {
            folderCategory: "weapon",
            fileSlug: "elegy",
            story: brokenStory,
          },
        ],
      })
    );

    expect(result.ok).toBe(false);
    expect(result.dist).toBeNull();
    expect(result.errors.some((e) => e.includes("[JSONスキーマ]") && e.includes("chapters"))).toBe(true);
    // Schema ゲート中断により、不合格作品 elegy への偽のリンク切れエラーが連鎖しないこと
    expect(result.errors.some((e) => e.includes("[リンク切れ]"))).toBe(false);

    const nullEntitiesResult = compileStories(
      createBaseInput({
        entities: null,
      })
    );
    expect(nullEntitiesResult.ok).toBe(false);
    expect(nullEntitiesResult.dist).toBeNull();
    expect(nullEntitiesResult.errors.some((e) => e.includes("entities"))).toBe(true);

    const emptyStoriesResult = compileStories(createBaseInput({ stories: [] }));
    expect(emptyStoriesResult.ok).toBe(false);
    expect(emptyStoriesResult.dist).toBeNull();
    expect(emptyStoriesResult.errors.some((e) => e.includes("1件も見つかりません"))).toBe(true);
  });

  it("detects folder/slug mismatches, duplicate story IDs, invalid ISO calendar dates, and whitespace-only fields", () => {
    const result = compileStories(
      createBaseInput({
        stories: [
          {
            folderCategory: "weapon",
            fileSlug: "wrong_slug",
            story: createValidCrimsonStory({
              addedAt: "2026-02-30",
              hook: "   ",
            }),
          },
          {
            folderCategory: "artifact",
            fileSlug: "crimson_witch",
            story: createValidCrimsonStory(),
          },
        ],
      })
    );

    expect(result.ok).toBe(false);
    expect(result.dist).toBeNull();
    expect(result.errors.some((e) => e.includes("ファイル名 (wrong_slug.json)"))).toBe(true);
    expect(result.errors.some((e) => e.includes("配置フォルダ (weapon/)"))).toBe(true);
    expect(result.errors.some((e) => e.includes("[重複ID]"))).toBe(true);
    expect(result.errors.some((e) => e.includes("addedAt"))).toBe(true);
    expect(result.errors.some((e) => e.includes("crimson_witch.hook"))).toBe(true);
  });

  it("rejects missing or whitespace-only glossary.desc on local glossary items and validates entityId/evidence/identity", () => {
    const result = compileStories(
      createBaseInput({
        stories: [
          {
            folderCategory: "weapon",
            fileSlug: "elegy",
            story: createValidElegyStory({
              glossary: {
                local_missing_desc: {
                  term: "騎士",
                  identity: "解説：モンドの騎士",
                  evidence: "武器『終焉の詩』",
                },
                local_blank_desc: {
                  term: "剣",
                  identity: "解説：遺された剣",
                  desc: "   ",
                  evidence: "武器『終焉の詩』",
                },
                missing_entity: {
                  entityId: "unknown_hero",
                  term: "を置いた",
                },
              },
              chapters: [
                {
                  sourceRef: {
                    package: "genshin-db",
                    sourceType: "weapon",
                    rawId: "elegyfortheend",
                  },
                  partLabel: "本編",
                  heading: "静かな終焉",
                  epigraph: "",
                  paragraphs: ["{{local_missing_desc|騎士}}は静かに{{local_blank_desc|剣}}{{missing_entity|を置いた}}。"],
                },
              ],
            }),
          },
        ],
      })
    );

    expect(result.ok).toBe(false);
    expect(result.dist).toBeNull();
    expect(result.errors.some((e) => e.includes("[解説欠落]") && e.includes("local_missing_desc"))).toBe(true);
    expect(result.errors.some((e) => e.includes("[解説欠落]") && e.includes("local_blank_desc"))).toBe(true);
    expect(result.errors.some((e) => e.includes("[マスタ参照切れ]") && e.includes("unknown_hero"))).toBe(true);
  });

  it("detects raw text mismatch, missing snapshot, undefined tags, NG terms, unregistered katakana, and broken connected links", () => {
    const result = compileStories(
      createBaseInput({
        stories: [
          {
            folderCategory: "artifact",
            fileSlug: "crimson_witch",
            story: createValidCrimsonStory({
              hook: "ツァーリツァと未知カタカナの記録",
              connected: [
                {
                  targetId: "crimson_witch",
                  relation: "自己参照",
                  desc: "自己参照テスト",
                },
                {
                  targetId: "missing_story",
                  relation: "欠落リンク",
                  desc: "存在しない作品",
                },
              ],
              chapters: [
                {
                  sourceRef: {
                    package: "genshin-db",
                    sourceType: "artifact",
                    rawId: "crimsonwitchofflames",
                    piece: "flower",
                  },
                  partLabel: "第一章",
                  heading: "炎の誓い",
                  epigraph: "",
                  paragraphs: [
                    "{{cw_girl|少女}}と{{undefined_tag|謎の語}}の記憶。",
                    "原文と異なる改変文。",
                  ],
                },
              ],
            }),
          },
          {
            folderCategory: "chronicle",
            fileSlug: "missing_raw",
            story: createValidElegyStory({
              id: "missing_raw",
              shelfCategory: "chronicle",
              chapters: [
                {
                  sourceRef: {
                    package: "genshin-db",
                    sourceType: "material",
                    rawId: "nonexistent_material",
                  },
                  partLabel: "第一幕",
                  heading: "欠損",
                  epigraph: "",
                  paragraphs: ["{{el_knight|騎士}}は静かに剣を置いた。"],
                },
              ],
            }),
          },
        ],
      })
    );

    expect(result.ok).toBe(false);
    expect(result.dist).toBeNull();
    expect(result.errors.some((e) => e.includes("[NG固有名詞検出]"))).toBe(true);
    expect(result.errors.some((e) => e.includes("[公式コーパス未登録カタカナ]") && e.includes("カタカナ"))).toBe(true);
    expect(result.errors.some((e) => e.includes("[自己参照]"))).toBe(true);
    expect(result.errors.some((e) => e.includes("[リンク切れ]") && e.includes("missing_story"))).toBe(true);
    expect(result.errors.some((e) => e.includes("[未定義用語タグ]") && e.includes("undefined_tag"))).toBe(true);
    expect(result.errors.some((e) => e.includes("[原文不一致]"))).toBe(true);
    expect(result.errors.some((e) => e.includes("[原典解決エラー]"))).toBe(true);
  });
});
