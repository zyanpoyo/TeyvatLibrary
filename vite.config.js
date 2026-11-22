import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { reactRouter } from "@react-router/dev/vite";

export default defineConfig({
  base: "/",
  publicDir: "public",
  plugins: [process.env.VITEST ? react() : reactRouter()],
  optimizeDeps: {
    include: ["@radix-ui/react-dialog", "@radix-ui/react-popover"],
  },
  build: {
    target: "es2022",
    cssCodeSplit: false,
  },
  test: {
    globals: true,
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: ["tests/**/*.test.ts"],
          exclude: [
            "tests/analytics.test.ts",
            "tests/prefs.test.ts",
            "tests/reading-state.test.ts",
          ],
        },
      },
      {
        extends: true,
        test: {
          name: "dom",
          environment: "jsdom",
          include: [
            "tests/**/*.test.tsx",
            "tests/analytics.test.ts",
            "tests/prefs.test.ts",
            "tests/reading-state.test.ts",
          ],
          setupFiles: ["./tests/setup.ts"],
        },
      },
    ],
  },
});
