#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(process.cwd());
const required = "MOBILE_DIAGNOSTIC_NO_CAPACITOR_IMPORTS";
const forbidden = [
  "@capacitor",
  "Preferences",
  "Keyboard",
  "StatusBar",
  "SplashScreen",
  "App.addListener",
  "supabase",
  "getRouter",
  "RouterProvider",
];
const roots = [join(root, "dist", "spa"), join(root, "ios", "App", "App", "public")];
const iosPublic = roots[1];

let failed = false;

function listFiles(dir) {
  const entries = readdirSync(dir);
  return entries.flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

for (const assetRoot of roots) {
  if (!existsSync(assetRoot)) {
    console.error(`[verify-mobile-diagnostic] missing ${assetRoot}`);
    failed = true;
    continue;
  }

  const files = listFiles(assetRoot);
  const text = files.map((filePath) => readFileSync(filePath, "utf8")).join("\n");

  if (!text.includes(required)) {
    console.error(`[verify-mobile-diagnostic] ${assetRoot} is not the diagnostic bundle`);
    failed = true;
  }

  for (const marker of forbidden) {
    if (text.includes(marker)) {
      console.error(`[verify-mobile-diagnostic] ${assetRoot} contains forbidden marker: ${marker}`);
      failed = true;
    }
  }
}

if (existsSync(iosPublic)) {
  try {
    const matches = execFileSync(
      "grep",
      ["-R", "-n", "-E", forbidden.map((marker) => marker.replace(".", "\\.")).join("|"), iosPublic],
      { encoding: "utf8" },
    );
    if (matches.trim()) {
      console.error("[verify-mobile-diagnostic] grep found forbidden iOS asset markers:");
      console.error(matches);
      failed = true;
    }
  } catch (error) {
    if (typeof error === "object" && error !== null && "status" in error && error.status !== 1) {
      console.error("[verify-mobile-diagnostic] grep failed while scanning iOS assets");
      failed = true;
    }
  }
}

if (failed) {
  process.exit(1);
}

console.log("[verify-mobile-diagnostic] dist/spa and ios/App/App/public contain only the standalone diagnostic shell.");