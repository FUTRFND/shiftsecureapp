#!/usr/bin/env node
import { execSync } from "node:child_process";
import { readFileSync, renameSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(process.cwd());
const indexMobileHtml = join(root, "dist", "spa", "index.mobile.html");
const indexHtml = join(root, "dist", "spa", "index.html");

console.log("[build:mobile] building standalone React diagnostic screen");
execSync("vite build --config scripts/vite.mobile-diagnostic.config.mjs", {
  stdio: "inherit",
});

renameSync(indexMobileHtml, indexHtml);

const size = readFileSync(indexHtml).byteLength;
console.log(`[build:mobile] diagnostic dist/spa ready (index.html ${size} bytes).`);
