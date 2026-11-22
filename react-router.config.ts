import fs from "node:fs";
import path from "node:path";
import type { Config } from "@react-router/dev/config";
import { listPrerenderStoryPaths } from "./src/server/dist-data.server.mjs";

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
    const notFoundHtml = path.join(clientDir, "404", "index.html");
    const rootNotFoundHtml = path.join(clientDir, "404.html");
    if (fs.existsSync(notFoundHtml)) {
      fs.copyFileSync(notFoundHtml, rootNotFoundHtml);
    }
  },
} satisfies Config;
