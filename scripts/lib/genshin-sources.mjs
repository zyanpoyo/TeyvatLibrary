import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export const SOURCE_TYPE_TO_DB_FOLDER = {
  artifact: "artifacts",
  weapon: "weapons",
  material: "materials",
  windglider: "windgliders",
};

/**
 * node_modules 内の genshin-db / genshin-data パスを返す。
 */
export function getGenshinSourcePaths(rootDir = process.cwd()) {
  return {
    dbJsonPath: path.join(rootDir, "node_modules", "genshin-db", "src", "min", "data.min.json"),
    dataDistDir: path.join(rootDir, "node_modules", "genshin-data", "dist"),
  };
}

/**
 * genshin-db の日本語コレクション辞書をロードする。
 */
export function loadGenshinDbJapanese(rootDir = process.cwd()) {
  const { dbJsonPath } = getGenshinSourcePaths(rootDir);
  if (!fs.existsSync(dbJsonPath)) {
    throw new Error(`genshin-db data not found at ${dbJsonPath}. Run 'npm install' first.`);
  }
  const db = JSON.parse(fs.readFileSync(dbJsonPath, "utf8"));
  return db?.data?.Japanese || {};
}

/**
 * genshin-data の日本語書籍メタ配列をロードする。
 */
export function loadGenshinDataBooks(rootDir = process.cwd()) {
  const { dataDistDir } = getGenshinSourcePaths(rootDir);
  if (!fs.existsSync(dataDistDir)) {
    throw new Error(`genshin-data dist not found at ${dataDistDir}. Run 'npm install' first.`);
  }
  const bookFile = fs.readdirSync(dataDistDir).find(
    (f) => f.startsWith("data_japanese_books.") && f.endsWith(".cjs")
  );
  if (!bookFile) {
    throw new Error("Could not find data_japanese_books.*.cjs in genshin-data.");
  }
  const mod = require(path.join(dataDistDir, bookFile));
  return mod.default || mod;
}

/**
 * genshin-data の日本語モジュール（data_japanese_*.cjs）すべてをロードする。
 */
export function loadGenshinDataJapaneseModules(rootDir = process.cwd()) {
  const { dataDistDir } = getGenshinSourcePaths(rootDir);
  if (!fs.existsSync(dataDistDir)) {
    throw new Error(`genshin-data dist not found at ${dataDistDir}. Run 'npm install' first.`);
  }
  const dataFiles = fs.readdirSync(dataDistDir).filter(
    (f) => f.startsWith("data_japanese_") && f.endsWith(".cjs")
  );
  return dataFiles.map((file) => {
    const mod = require(path.join(dataDistDir, file));
    return { file, data: mod.default || mod };
  });
}
