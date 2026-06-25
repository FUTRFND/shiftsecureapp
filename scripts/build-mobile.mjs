#!/usr/bin/env node
import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(process.cwd());
const distSpa = join(root, "dist", "spa");
const indexMobileHtml = join(root, "dist", "spa", "index.mobile.html");
const indexHtml = join(root, "dist", "spa", "index.html");
const iosPublic = join(root, "ios", "App", "App", "public");

console.log("[build:mobile] building standalone React diagnostic screen");
execSync("vite build --config scripts/vite.mobile-diagnostic.config.mjs", {
  stdio: "inherit",
});

renameSync(indexMobileHtml, indexHtml);

if (existsSync(iosPublic)) {
  rmSync(iosPublic, { recursive: true, force: true });
  mkdirSync(iosPublic, { recursive: true });
  cpSync(distSpa, iosPublic, { recursive: true });
  console.log("[build:mobile] copied diagnostic assets to ios/App/App/public.");
}

const size = readFileSync(indexHtml).byteLength;
console.log(`[build:mobile] diagnostic dist/spa ready (index.html ${size} bytes).`);
