import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadDistStoriesIndex } from "../src/server/dist-data.server.mjs";
import { generateAllOgImages } from "./lib/og-image-generator.mjs";

function parseArgs(argv) {
  let outDir = path.join(process.cwd(), "build", "client");
  let siteUrl = process.env.VITE_SITE_URL;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--out" && argv[i + 1]) {
      outDir = path.resolve(process.cwd(), argv[++i]);
    } else if (arg === "--site-url" && argv[i + 1]) {
      siteUrl = argv[++i];
    }
  }

  return { outDir, siteUrl };
}

async function main() {
  const { outDir, siteUrl } = parseArgs(process.argv.slice(2));
  const indexData = loadDistStoriesIndex();
  const result = await generateAllOgImages({
    clientDir: outDir,
    indexData,
    siteUrl,
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
