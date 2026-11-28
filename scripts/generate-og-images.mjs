import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadDistStoriesIndex } from "../src/server/dist-data.server.mjs";
import { generateAllOgImages } from "./lib/og-image-generator.mjs";

const USAGE_TEXT = `使用法: node scripts/generate-og-images.mjs [オプション]

オプション:
  --out <dir>          出力先クライアントディレクトリ（既定: build/client）
  --site-url <url>     フッター等に表示する公開基準 URL（既定: VITE_SITE_URL）
  --only <id[,id...]>  生成対象を絞り込む（site, about, courses, course/<id>, entities, entity/<id>, または story.id。複数回・カンマ区切り可）
  --force, -f          .cache/og/ のキャッシュを無視して強制再生成する
  --help, -h           このヘルプを表示する`;

function appendOnlyTokens(targets, rawValue) {
  const tokens = String(rawValue)
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
  if (tokens.length === 0) {
    throw new Error("--only には 1 件以上の対象 ID（site, about, courses, course/<id>, entities, entity/<id>, または story.id）を指定してください。");
  }
  targets.push(...tokens);
}

export function parseArgs(argv = []) {
  let outDir = path.join(process.cwd(), "build", "client");
  let siteUrl = process.env.VITE_SITE_URL;
  let force = false;
  let help = false;
  const onlyTargets = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      help = true;
    } else if (arg === "--force" || arg === "-f") {
      force = true;
    } else if (arg === "--out") {
      const next = argv[++i];
      if (!next || next.startsWith("-")) {
        throw new Error("--out にはディレクトリパスを指定してください。");
      }
      outDir = path.resolve(process.cwd(), next);
    } else if (arg.startsWith("--out=")) {
      const value = arg.slice("--out=".length);
      if (!value) throw new Error("--out にはディレクトリパスを指定してください。");
      outDir = path.resolve(process.cwd(), value);
    } else if (arg === "--site-url") {
      const next = argv[++i];
      if (!next || next.startsWith("-")) {
        throw new Error("--site-url には URL を指定してください。");
      }
      siteUrl = next;
    } else if (arg.startsWith("--site-url=")) {
      const value = arg.slice("--site-url=".length);
      if (!value) throw new Error("--site-url には URL を指定してください。");
      siteUrl = value;
    } else if (arg === "--only") {
      const next = argv[++i];
      if (!next || next.startsWith("-")) {
        throw new Error("--only には対象 ID を指定してください。");
      }
      appendOnlyTokens(onlyTargets, next);
    } else if (arg.startsWith("--only=")) {
      appendOnlyTokens(onlyTargets, arg.slice("--only=".length));
    } else {
      throw new Error(`不明なオプションです: ${arg}`);
    }
  }

  return {
    outDir,
    siteUrl,
    force,
    only: onlyTargets.length > 0 ? Array.from(new Set(onlyTargets)) : null,
    help,
  };
}

async function main() {
  const { outDir, siteUrl, force, only, help } = parseArgs(process.argv.slice(2));
  if (help) {
    console.log(USAGE_TEXT);
    return;
  }

  const indexData = loadDistStoriesIndex();
  const result = await generateAllOgImages({
    clientDir: outDir,
    indexData,
    siteUrl,
    force,
    only,
  });
  console.log(
    `✅ 静的 OGP 画像生成完了: 計 ${result.totalGenerated} 枚 (新規生成 ${result.renderedCount} 枚 / キャッシュ再利用 ${result.cacheHits} 枚) -> ${path.join(outDir, "og")}`
  );
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch((err) => {
    console.error("❌ 静的 OGP 画像生成に失敗しました:", err);
    process.exit(1);
  });
}
