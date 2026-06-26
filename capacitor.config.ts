import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor configuration for Shift Secure (iOS + Android).
 *
 * `cap sync` auto-includes any installed Capacitor plugin from package.json
 * (RevenueCat, Speech Recognition, Network, Preferences, etc.) — do NOT add
 * `includePlugins: []` here or those plugins will be excluded from the build.
 */
const config: CapacitorConfig = {
  appId: "com.badexy.shiftsecure",
  appName: "Shift Secure",
  webDir: "dist/spa",
  bundledWebRuntime: false,
  loggingBehavior: "debug",
  backgroundColor: "#f7f7f2",
  initialFocus: true,
  ios: {
    webContentsDebuggingEnabled: true,
  },
};

export default config;
