import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { compileStories } from "./lib/story-compiler.mjs";
import { VALID_SHELF_CATEGORIES } from "./lib/validator.mjs";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");
const RAW_DIR = path.join(DATA_DIR, "raw");
const SCHEMAS_DIR = path.join(DATA_DIR, "schemas");
const SHARED_DIR = path.join(DATA_DIR, "shared");
const STORIES_DIR = path.join(DATA_DIR, "stories");
const DIST_DIR = path.join(ROOT, "public", "data");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function collectStoryEntries() {
  const files = [];
  for (const category of VALID_SHELF_CATEGORIES) {
    const catDir = path.join(STORIES_DIR, category);
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

function readRawSnapshot(sourceRef) {
  const rawPath = path.join(RAW_DIR, sourceRef.sourceType, `${sourceRef.rawId}.json`);
  if (!fs.existsSync(rawPath)) {
    throw new Error(`Raw snapshot not found: ${path.relative(ROOT, rawPath)}`);
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

function main() {
  const validateOnly = process.argv.includes("--validate-only");
  const result = compileStories({
    stories: collectStoryEntries(),
    entities: readJson(path.join(SHARED_DIR, "entities.json")),
    officialEntities: readJson(path.join(SHARED_DIR, "official-entities.json")),
    officialCorpus: readJson(path.join(SHARED_DIR, "official-corpus.json")),
    schemas: {
      entities: readJson(path.join(SCHEMAS_DIR, "entities.schema.json")),
      story: readJson(path.join(SCHEMAS_DIR, "story.schema.json")),
    },
    readRawSnapshot,
  });

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

  writeDistOutput(DIST_DIR, result.dist);
  console.log(
    `✅ ビルド＆検証成功: 全 ${result.dist.index.totalCount} 作品を検証し、public/data/ (stories-index.json + search-index.json + stories/*.json) を生成しました。`
  );
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main();
}
