#!/usr/bin/env node
import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(process.cwd());
const distSpa = join(root, "dist", "spa");
const indexHtml = join(distSpa, "index.html");
const staleDistMobileIndex = join(root, "dist", "index.mobile.html");
const iosPublic = join(root, "ios", "App", "App", "public");

console.log("[build:mobile] building standalone React diagnostic screen");
rmSync(staleDistMobileIndex, { force: true });
execSync("vite build --config scripts/vite.mobile-diagnostic.config.mjs", {
  stdio: "inherit",
});

if (!existsSync(indexHtml)) {
  throw new Error(
    `[build:mobile] expected ${indexHtml} after vite build but it is missing.`,
  );
}

// Hard fail if a stale index.mobile.html somehow appears in the output.
const strayMobile = join(distSpa, "index.mobile.html");
if (existsSync(strayMobile)) {
  rmSync(strayMobile);
  console.warn("[build:mobile] removed stray dist/spa/index.mobile.html");
}

if (existsSync(staleDistMobileIndex)) {
  rmSync(staleDistMobileIndex);
  throw new Error(
    "[build:mobile] vite emitted dist/index.mobile.html; expected dist/spa/index.html.",
  );
}

rmSync(iosPublic, { recursive: true, force: true });
mkdirSync(iosPublic, { recursive: true });
cpSync(distSpa, iosPublic, { recursive: true });
console.log("[build:mobile] copied diagnostic assets to ios/App/App/public.");

const size = readFileSync(indexHtml).byteLength;
console.log(`[build:mobile] diagnostic dist/spa ready (index.html ${size} bytes).`);
