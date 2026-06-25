import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { defineConfig, loadEnv } from "vite";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, "..");

// Mobile diagnostic build: NO minification, inline sourcemaps, readable stack
// traces so the first JS exception inside WKWebView can be debugged via
// Safari's Web Inspector (Develop → <Device> → Shift Secure).
export default defineConfig(({ mode }) => {
  // Vite's automatic .env loading uses `root` (= mobile-shell/) as the search
  // directory, so VITE_* vars in the project-root .env never reach the bundle.
  // Load them explicitly from the project root and pass them through `define`.
  const env = {
    ...loadEnv(mode, projectRoot, ""),
    // Allow the shell environment (CI / local export) to override .env values.
    ...Object.fromEntries(
      Object.entries(process.env).filter(([k]) => k.startsWith("VITE_")),
    ),
  };

  const required = ["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"];
  const missing = required.filter((k) => !env[k]);
  if (missing.length) {
    throw new Error(
      `[vite.mobile] missing required env vars in project-root .env: ${missing.join(", ")}`,
    );
  }

  const exposed = Object.fromEntries(
    Object.entries(env)
      .filter(([k]) => k.startsWith("VITE_"))
      .map(([k, v]) => [`import.meta.env.${k}`, JSON.stringify(v)]),
  );

  return {
    base: "./",
    root: resolve(projectRoot, "mobile-shell"),
    publicDir: false,
    envDir: projectRoot,
    resolve: {
      alias: {
        "/src": resolve(projectRoot, "src"),
        "@": resolve(projectRoot, "src"),
      },
    },
    plugins: [react()],
    define: {
      "process.env.NODE_ENV": JSON.stringify("development"),
      ...exposed,
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
  };
});
