import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { compileStories } from "./lib/story-compiler.mjs";
import { VALID_SHELF_CATEGORIES } from "./lib/validator.mjs";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function collectStoryEntries(storiesDir) {
  const files = [];
  for (const category of VALID_SHELF_CATEGORIES) {
    const catDir = path.join(storiesDir, category);
    if (!fs.existsSync(catDir)) continue;
    for (const entry of fs.readdirSync(catDir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith(".json")) {
        files.push({
          folderCategory: category,
          fileSlug: entry.name.replace(/\.json$/, ""),
          filePath: path.join(catDir, entry.name),
        });
      }
    }
  }
  return files
    .sort((a, b) => a.filePath.localeCompare(b.filePath))
    .map(({ folderCategory, fileSlug, filePath }) => ({
      folderCategory,
      fileSlug,
      story: readJson(filePath),
    }));
}

function readRawSnapshot(rawDir, rootDir, sourceRef) {
  const rawPath = path.join(rawDir, sourceRef.sourceType, `${sourceRef.rawId}.json`);
  if (!fs.existsSync(rawPath)) {
    throw new Error(`Raw snapshot not found: ${path.relative(rootDir, rawPath)}`);
  }
  return readJson(rawPath);
}

function writeDistOutput(distDir, dist) {
  const distStoriesDir = path.join(distDir, "stories");
  fs.rmSync(distDir, { recursive: true, force: true });
  fs.mkdirSync(distStoriesDir, { recursive: true });

  for (const compiled of Object.values(dist.storiesById)) {
    fs.writeFileSync(
      path.join(distStoriesDir, `${compiled.id}.json`),
      JSON.stringify(compiled, null, 2) + "\n",
      "utf8"
    );
  }

  fs.writeFileSync(
    path.join(distDir, "stories-index.json"),
    JSON.stringify(dist.index, null, 2) + "\n",
    "utf8"
  );

  if (dist.searchIndex) {
    fs.writeFileSync(
      path.join(distDir, "search-index.json"),
      JSON.stringify(dist.searchIndex) + "\n",
      "utf8"
    );
  }
}

/**
 * プロジェクトのストーリー群を検証し、validateOnly でない場合は distDir へ配信 JSON 一式を出力する。
 */
export function buildProjectStories({
  rootDir = process.cwd(),
  distDir = path.join(rootDir, "public", "data"),
  validateOnly = false,
} = {}) {
  const dataDir = path.join(rootDir, "data");
  const rawDir = path.join(dataDir, "raw");
  const schemasDir = path.join(dataDir, "schemas");
  const sharedDir = path.join(dataDir, "shared");
  const storiesDir = path.join(dataDir, "stories");

  const result = compileStories({
    stories: collectStoryEntries(storiesDir),
    entities: readJson(path.join(sharedDir, "entities.json")),
    officialEntities: readJson(path.join(sharedDir, "official-entities.json")),
    officialCorpus: readJson(path.join(sharedDir, "official-corpus.json")),
    schemas: {
      entities: readJson(path.join(schemasDir, "entities.schema.json")),
      story: readJson(path.join(schemasDir, "story.schema.json")),
    },
    readRawSnapshot: (sourceRef) => readRawSnapshot(rawDir, rootDir, sourceRef),
  });

  if (result.ok && result.dist && !validateOnly) {
    writeDistOutput(distDir, result.dist);
  }

  return {
    ...result,
    distDir,
  };
}

function readJsonSafe(filePath, label, errors) {
  if (!fs.existsSync(filePath)) {
    errors.push(`${label} が存在しません: ${filePath}`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errors.push(`${label} の JSON 解析に失敗しました (${message}): ${filePath}`);
    return null;
  }
}

function compareIdSets(expectedIds, actualIds, actualLabel, errors) {
  for (const id of expectedIds) {
    if (!actualIds.has(id)) {
      errors.push(`${actualLabel} に作品 ID "${id}" が不足しています`);
    }
  }
  for (const id of actualIds) {
    if (!expectedIds.has(id)) {
      errors.push(`${actualLabel} に stories-index.json 未登録の余剰 ID "${id}" があります`);
    }
  }
}

function verifyStoriesIndex(index, errors, stats) {
  const storyById = new Map();
  if (!index || typeof index !== "object" || Array.isArray(index)) {
    errors.push("stories-index.json のルートがオブジェクトではありません");
    return storyById;
  }

  if (!Array.isArray(index.stories) || index.stories.length === 0) {
    errors.push("stories-index.json の stories が非空配列ではありません");
    return storyById;
  }

  stats.storyCount = index.stories.length;
  if (index.totalCount !== index.stories.length) {
    errors.push(
      `stories-index.json の totalCount (${index.totalCount}) と stories.length (${index.stories.length}) が一致しません`
    );
  }

  if (!index.categoryCounts || typeof index.categoryCounts !== "object" || Array.isArray(index.categoryCounts)) {
    errors.push("stories-index.json の categoryCounts がオブジェクトではありません");
  } else {
    const categorySum = Object.values(index.categoryCounts).reduce(
      (sum, count) => sum + (typeof count === "number" ? count : 0),
      0
    );
    if (categorySum !== index.totalCount) {
      errors.push(
        `stories-index.json の categoryCounts 合計 (${categorySum}) と totalCount (${index.totalCount}) が一致しません`
      );
    }
  }

  for (const story of index.stories) {
    if (!story || typeof story !== "object" || typeof story.id !== "string" || story.id.length === 0) {
      errors.push("stories-index.json に不正な作品エントリがあります");
      continue;
    }
    if (storyById.has(story.id)) {
      errors.push(`stories-index.json 内で作品 ID "${story.id}" が重複しています`);
      continue;
    }
    storyById.set(story.id, story);
  }

  return storyById;
}

function verifyEntitiesIndex(index, expectedIds, errors, stats) {
  if (!index || typeof index !== "object" || !index.entitiesIndex || typeof index.entitiesIndex !== "object") {
    errors.push("stories-index.json の entitiesIndex がオブジェクトではありません");
    return;
  }
  const entries = Object.entries(index.entitiesIndex);
  stats.entityCount = entries.length;
  for (const [entityId, entry] of entries) {
    if (!entry || !Array.isArray(entry.storyIds)) {
      errors.push(`entitiesIndex["${entityId}"].storyIds が配列ではありません`);
      continue;
    }
    for (const refStoryId of entry.storyIds) {
      if (!expectedIds.has(refStoryId)) {
        errors.push(
          `entitiesIndex["${entityId}"] が存在しない作品 ID "${refStoryId}" を参照しています`
        );
      }
    }
  }
}

function verifyStoryDetailFiles(storiesDir, storyById, expectedIds, errors, stats) {
  if (!fs.existsSync(storiesDir) || !fs.statSync(storiesDir).isDirectory()) {
    errors.push(`stories ディレクトリが存在しません: ${storiesDir}`);
    return;
  }

  const fileIds = fs
    .readdirSync(storiesDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name.replace(/\.json$/, ""));

  stats.storyFileCount = fileIds.length;
  const fileIdSet = new Set(fileIds);
  if (expectedIds.size > 0) {
    compareIdSets(expectedIds, fileIdSet, "stories/*.json", errors);
  }

  for (const fileId of fileIds) {
    const filePath = path.join(storiesDir, `${fileId}.json`);
    const detail = readJsonSafe(filePath, `stories/${fileId}.json`, errors);
    if (!detail || typeof detail !== "object") continue;

    const summary = storyById.get(fileId);
    if (summary) {
      if (detail.id !== summary.id) {
        errors.push(`stories/${fileId}.json の id ("${detail.id}") が index ("${summary.id}") と不一致です`);
      }
      if (detail.title !== summary.title) {
        errors.push(`stories/${fileId}.json の title ("${detail.title}") が index ("${summary.title}") と不一致です`);
      }
      if (detail.shelfCategory !== summary.shelfCategory) {
        errors.push(
          `stories/${fileId}.json の shelfCategory ("${detail.shelfCategory}") が index ("${summary.shelfCategory}") と不一致です`
        );
      }
    }
    if (!Array.isArray(detail.chapters) || detail.chapters.length === 0) {
      errors.push(`stories/${fileId}.json の chapters が空または配列ではありません`);
    }
  }
}

/**
 * 出力済み distDir（stories-index.json / search-index.json / stories/*.json）のファイル実在と相互整合を検証する。
 */
export function verifyDistOutput(distDir) {
  const errors = [];
  const stats = {
    storyCount: 0,
    searchStoryCount: 0,
    storyFileCount: 0,
    entityCount: 0,
  };

  if (!fs.existsSync(distDir) || !fs.statSync(distDir).isDirectory()) {
    errors.push(`配信ディレクトリが存在しません: ${distDir}`);
    return { ok: false, errors, stats };
  }

  const index = readJsonSafe(path.join(distDir, "stories-index.json"), "stories-index.json", errors);
  const storyById = verifyStoriesIndex(index, errors, stats);
  const expectedIds = new Set(storyById.keys());

  if (index) {
    verifyEntitiesIndex(index, expectedIds, errors, stats);
  }

  const searchIndex = readJsonSafe(
    path.join(distDir, "search-index.json"),
    "search-index.json",
    errors
  );
  if (searchIndex !== null) {
    if (!searchIndex || typeof searchIndex !== "object" || !searchIndex.stories || typeof searchIndex.stories !== "object" || Array.isArray(searchIndex.stories)) {
      errors.push("search-index.json の stories がオブジェクトではありません");
    } else {
      const searchIds = new Set(Object.keys(searchIndex.stories));
      stats.searchStoryCount = searchIds.size;
      if (expectedIds.size > 0) {
        compareIdSets(expectedIds, searchIds, "search-index.json", errors);
      }
    }
  }

  verifyStoryDetailFiles(path.join(distDir, "stories"), storyById, expectedIds, errors, stats);

  return {
    ok: errors.length === 0,
    errors,
    stats,
  };
}

/**
 * 本番 public/data/ を変更せずに一時ディレクトリへ実ファイルを書き出し、配信データ一式の整合性を検証する。
 */
export function runDistOutputSmokeCheck({ rootDir = process.cwd() } = {}) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "teyvat-build-smoke-"));
  try {
    const buildResult = buildProjectStories({
      rootDir,
      distDir: tempDir,
      validateOnly: false,
    });
    const verifyResult = buildResult.ok && buildResult.dist ? verifyDistOutput(tempDir) : null;
    return { buildResult, verifyResult };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

/**
 * 既存の public/data/ が存在する場合に限り、その配信データ一式の整合性を検証する。
 */
export function checkExistingDistOutput(rootDir = process.cwd()) {
  const distDir = path.join(rootDir, "public", "data");
  if (!fs.existsSync(distDir)) {
    return { exists: false, distDir, verifyResult: null };
  }
  return {
    exists: true,
    distDir,
    verifyResult: verifyDistOutput(distDir),
  };
}

function main() {
  const validateOnly = process.argv.includes("--validate-only");
  const result = buildProjectStories({ validateOnly });

  if (result.warnings.length > 0) {
    console.warn(`\n⚠️ ヒント (${result.warnings.length} 件):`);
    result.warnings.forEach((w) => console.warn("  - " + w));
    console.warn("");
  }

  if (!result.ok || !result.dist) {
    console.error(`\n❌ 検証失敗: ${result.errors.length} 件のエラーが見つかりました:\n`);
    result.errors.forEach((e) => console.error("  - " + e));
    process.exit(1);
  }

  if (validateOnly) {
    console.log(
      `✅ 検証成功 (--validate-only): 全 ${result.stats.storyCount} 作品（原文1文字一致・スキーマ・公式コーパス ${result.stats.corpusTermCount} 語・マスタ・リンク整合性）すべて正常です。`
    );
    return;
  }

  console.log(
    `✅ ビルド＆検証成功: 全 ${result.dist.index.totalCount} 作品を検証し、public/data/ (stories-index.json + search-index.json + stories/*.json) を生成しました。`
  );
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main();
}
