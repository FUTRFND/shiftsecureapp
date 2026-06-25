import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { defineConfig } from "vite";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, "..");

export default defineConfig({
  base: "./",
  root: resolve(projectRoot, "mobile-shell"),
  publicDir: false,
  resolve: {
    alias: {
      "/src": resolve(projectRoot, "src"),
    },
  },
  plugins: [react()],
  build: {
    outDir: resolve(projectRoot, "dist/spa"),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(projectRoot, "mobile-shell/index.html"),
    },
  },
});
