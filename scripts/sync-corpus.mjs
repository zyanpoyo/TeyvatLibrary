import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  buildOfficialCorpus,
  getGenshinSourcePaths,
  loadGenshinDataJapaneseModules,
  loadGenshinDbJapanese,
} from "./lib/genshin-sources.mjs";

const ROOT = process.cwd();
const RAW_DIR = path.join(ROOT, "data", "raw");
const CORPUS_PATH = path.join(ROOT, "data", "shared", "official-corpus.json");

function readRawSnapshots(dir, snapshots = []) {
  if (!fs.existsSync(dir)) return snapshots;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      readRawSnapshots(fullPath, snapshots);
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
      snapshots.push(JSON.parse(fs.readFileSync(fullPath, "utf8")));
    }
  }
  return snapshots;
}

function main() {
  const dataModules = loadGenshinDataJapaneseModules(ROOT);
  const { dbJsonPath } = getGenshinSourcePaths(ROOT);
  const jpDb = fs.existsSync(dbJsonPath) ? loadGenshinDbJapanese(ROOT) : {};
  const rawSnapshots = readRawSnapshots(RAW_DIR);

  const gdataPkg = JSON.parse(
    fs.readFileSync(path.join(ROOT, "node_modules", "genshin-data", "package.json"), "utf8")
  );
  const gdbPkg = JSON.parse(
    fs.readFileSync(path.join(ROOT, "node_modules", "genshin-db", "package.json"), "utf8")
  );

  const output = buildOfficialCorpus({
    dataModules,
    jpDb,
    rawSnapshots,
    genshinDataVersion: gdataPkg.version,
    genshinDbVersion: gdbPkg.version,
  });

  fs.mkdirSync(path.dirname(CORPUS_PATH), { recursive: true });
  fs.writeFileSync(CORPUS_PATH, JSON.stringify(output, null, 2) + "\n", "utf8");
  console.log(
    `[sync-corpus] Synced ${output.meta.termCount} unique katakana terms ` +
    `(genshin-data v${gdataPkg.version}, genshin-db v${gdbPkg.version}, raw snapshots: ${output.meta.rawFileCount}).`
  );
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main();
}
