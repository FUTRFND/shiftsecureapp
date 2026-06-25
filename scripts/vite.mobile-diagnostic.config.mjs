import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { defineConfig } from "vite";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, "..");

// Mobile diagnostic build: NO minification, inline sourcemaps, readable stack
// traces so the first JS exception inside WKWebView can be debugged via
// Safari's Web Inspector (Develop → <Device> → Shift Secure).
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
  define: {
    "process.env.NODE_ENV": JSON.stringify("development"),
  },
  build: {
    outDir: resolve(projectRoot, "dist/spa"),
    emptyOutDir: true,
    minify: false,
    sourcemap: "inline",
    cssMinify: false,
    target: "es2020",
    rollupOptions: {
      input: resolve(projectRoot, "mobile-shell/index.html"),
      output: {
        compact: false,
      },
    },
  },
});
