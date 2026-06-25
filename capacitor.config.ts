import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor configuration for Shift Secure (iOS + Android).
 *
 * - `webDir` points at the static SPA build emitted by `bun run build:mobile`.
 * - `appId` is the reverse-DNS bundle identifier used by both stores.
 * - `includePlugins: []` makes this diagnostic shell exclude every native
 *   plugin during `npx cap sync`, isolating WKWebView/project configuration.
 */
const config: CapacitorConfig = {
  appId: "com.badexy.shiftsecure",
  appName: "Shift Secure",
  webDir: "dist/spa",
  bundledWebRuntime: false,
  includePlugins: [],
  loggingBehavior: "debug",
  backgroundColor: "#f7f7f2",
  initialFocus: true,
  ios: {
    includePlugins: [],
    webContentsDebuggingEnabled: true,
  },
  android: {
    includePlugins: [],
  },
};

export default config;
