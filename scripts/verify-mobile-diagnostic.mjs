#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(process.cwd());
const required = "SHIFT_SECURE_DIAGNOSTIC_2026_06_25_REACT_ONLY";
const forbidden = ["/_build/assets/client.js", '<div id="app"></div>', "MobileHome", "AuthProvider"];
const paths = [
  join(root, "dist", "spa", "index.html"),
  join(root, "ios", "App", "App", "public", "index.html"),
];

let failed = false;

for (const filePath of paths) {
  if (!existsSync(filePath)) {
    console.error(`[verify-mobile-diagnostic] missing ${filePath}`);
    failed = true;
    continue;
  }

  const html = readFileSync(filePath, "utf8");

  if (!html.includes(required)) {
    console.error(`[verify-mobile-diagnostic] ${filePath} is not the diagnostic bundle`);
    failed = true;
  }

  for (const marker of forbidden) {
    if (html.includes(marker)) {
      console.error(`[verify-mobile-diagnostic] ${filePath} contains stale marker: ${marker}`);
      failed = true;
    }
  }
}

if (failed) {
  process.exit(1);
}

console.log("[verify-mobile-diagnostic] dist/spa and ios/App/App/public contain the diagnostic shell.");