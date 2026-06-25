#!/usr/bin/env node
// Verifies the mobile bundle is the incremental MobileHome build:
// Supabase auth IS allowed (login/session). Router, native plugins,
// AuthProvider, Toaster, and native-shell init are NOT.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(process.cwd());
const required = "MOBILE_HOME_AUTH_LOCAL_STATE";
const forbidden = [
  "@capacitor/preferences",
  "@capacitor/keyboard",
  "@capacitor/status-bar",
  "@capacitor/splash-screen",
  "@capacitor/app",
  "@capacitor/haptics",
  "@capacitor/network",
  "@capacitor/clipboard",
  "@capacitor-community/speech-recognition",
  "App.addListener",
  "Keyboard.addListener",
  "StatusBar.setStyle",
  "SplashScreen.hide",
  "getRouter",
  "RouterProvider",
  "routeTree",
  "native-shell",
  "AuthProvider",
  "Toaster",
];
const roots = [
  join(root, "dist", "spa"),
  join(root, "ios", "App", "App", "public"),
];
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
    console.error(`[verify-mobile] missing ${assetRoot}`);
    failed = true;
    continue;
  }

  const files = listFiles(assetRoot);
  const text = files
    .map((filePath) => readFileSync(filePath, "utf8"))
    .join("\n");

  if (!text.includes(required)) {
    console.error(
      `[verify-mobile] ${assetRoot} missing required fingerprint ${required}`,
    );
    failed = true;
  }

  for (const marker of forbidden) {
    if (text.includes(marker)) {
      console.error(
        `[verify-mobile] ${assetRoot} contains forbidden marker: ${marker}`,
      );
      failed = true;
    }
  }
}

if (existsSync(iosPublic)) {
  try {
    const pattern = forbidden
      .map((m) => m.replace(/[.\/]/g, (c) => `\\${c}`))
      .join("|");
    const matches = execFileSync(
      "grep",
      ["-R", "-n", "-E", pattern, iosPublic],
      { encoding: "utf8" },
    );
    if (matches.trim()) {
      console.error("[verify-mobile] grep found forbidden iOS asset markers:");
      console.error(matches);
      failed = true;
    }
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      error.status !== 1
    ) {
      console.error("[verify-mobile] grep failed while scanning iOS assets");
      failed = true;
    }
  }
}

if (failed) {
  process.exit(1);
}

console.log(
  "[verify-mobile] dist/spa and ios/App/App/public contain only the MobileHome auth shell.",
);
