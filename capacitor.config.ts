import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor configuration for Shift Secure (iOS + Android).
 *
 * - `webDir` points at the static SPA build emitted by `bun run build:mobile`.
 * - `appId` is the reverse-DNS bundle identifier used by both stores.
 * - `server.androidScheme: "https"` makes the in-app origin `https://localhost`
 *   which Supabase Auth + Lovable AI Gateway accept as a same-origin caller.
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
  server: {
    iosScheme: "capacitor",
    androidScheme: "https",
  },
  ios: {
    contentInset: "automatic",
    includePlugins: [],
    limitsNavigationsToAppBoundDomains: false,
    scrollEnabled: true,
    webContentsDebuggingEnabled: true,
  },
  android: {
    allowMixedContent: false,
    includePlugins: [],
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: "#0b1220",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    Keyboard: {
      resize: "body",
      resizeOnFullScreen: true,
    },
    StatusBar: {
      // Translucent so CSS env(safe-area-inset-top) controls layout.
      overlaysWebView: true,
      style: "DEFAULT",
    },
  },
};

export default config;
