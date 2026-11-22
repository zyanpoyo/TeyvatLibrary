import path from "node:path";
import type { Config } from "@react-router/dev/config";
import { writePostBuildSeoAssets } from "./scripts/lib/post-build-seo.mjs";
import {
  listPrerenderStoryPaths,
  loadDistStoriesIndex,
} from "./src/server/dist-data.server.mjs";

export default {
  appDirectory: "src",
  buildDirectory: "build",
  ssr: false,
  async prerender() {
    const storyPaths = listPrerenderStoryPaths();
    return ["/", "/about", "/404", ...storyPaths];
  },
  async buildEnd({ reactRouterConfig }) {
    const clientDir = path.join(reactRouterConfig.buildDirectory, "client");
    const indexData = loadDistStoriesIndex();
    writePostBuildSeoAssets({
      clientDir,
      indexData,
      siteUrl: process.env.VITE_SITE_URL,
    });
  },
} satisfies Config;
