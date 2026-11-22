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
    environment: "jsdom",
    globals: true,
    include: ["tests/**/*.test.{ts,tsx}"],
    setupFiles: ["./tests/setup.ts"],
  },
});
