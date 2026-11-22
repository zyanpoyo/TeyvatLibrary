import path from "node:path";
import type { Config } from "@react-router/dev/config";
import { generateAllOgImages } from "./scripts/lib/og-image-generator.mjs";
import { writePostBuildSeoAssets } from "./scripts/lib/post-build-seo.mjs";
import {
  listPrerenderCoursePaths,
  listPrerenderStoryPaths,
  loadDistStoriesIndex,
} from "./src/server/dist-data.server.mjs";

export default {
  appDirectory: "src",
  buildDirectory: "build",
  ssr: false,
  async prerender() {
    const coursePaths = listPrerenderCoursePaths();
    const storyPaths = listPrerenderStoryPaths();
    return ["/", "/courses", "/about", "/404", ...coursePaths, ...storyPaths];
  },
  async buildEnd({ reactRouterConfig }) {
    const clientDir = path.join(reactRouterConfig.buildDirectory, "client");
    const indexData = loadDistStoriesIndex();
    writePostBuildSeoAssets({
      clientDir,
      indexData,
      siteUrl: process.env.VITE_SITE_URL,
    });
    await generateAllOgImages({
      clientDir,
      indexData,
      siteUrl: process.env.VITE_SITE_URL,
    });
  },
} satisfies Config;
