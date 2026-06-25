#!/usr/bin/env node
/**
 * build-mobile.mjs — assembles a static `dist/spa` folder for Capacitor.
 *
 * Phase 2 scaffold: runs the standard TanStack Start build, then copies the
 * client-side public assets emitted by Nitro into `dist/spa` so `npx cap sync`
 * has a `webDir` to package.
 *
 * The Supabase-auth ↔ deep-link wiring (Phase 3) and the SSR→SPA route audit
 * (Phase 4, after AI moves to an Edge Function) refine this script. Until then
 * use this build only for device-side plumbing tests, not feature QA.
 */
import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(process.cwd());
const SPA_DIR = join(root, "dist", "spa");
// Nitro's preset emits client assets under `dist/client` for this template.
// If the layout changes again, update this single path.
const NITRO_PUBLIC = existsSync(join(root, ".output", "public"))
  ? join(root, ".output", "public")
  : join(root, "dist", "client");

console.log("[build:mobile] running vite build");
execSync("vite build", { stdio: "inherit", env: { ...process.env, MOBILE_BUILD: "1" } });

if (!existsSync(NITRO_PUBLIC)) {
  console.error(`[build:mobile] expected client assets at ${NITRO_PUBLIC} but none were found.`);
  console.error(
    "[build:mobile] If the TanStack/Nitro output layout has changed, update scripts/build-mobile.mjs.",
  );
  process.exit(1);
}

rmSync(SPA_DIR, { recursive: true, force: true });
mkdirSync(SPA_DIR, { recursive: true });
cpSync(NITRO_PUBLIC, SPA_DIR, { recursive: true });

// Ensure an index.html exists for Capacitor's WebView entry point.
const indexHtml = join(SPA_DIR, "index.html");
if (!existsSync(indexHtml)) {
  console.warn("[build:mobile] no prerendered index.html found — emitting SPA shell.");
  const shell = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
    <title>Shift Secure</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/_build/assets/client.js"></script>
  </body>
</html>`;
  writeFileSync(indexHtml, shell, "utf8");
  console.warn(
    "[build:mobile] SPA shell is a placeholder; client entry path is finalized in Phase 4.",
  );
}

const size = readFileSync(indexHtml).byteLength;
console.log(`[build:mobile] dist/spa ready (index.html ${size} bytes). Run \`npx cap sync\` next.`);
