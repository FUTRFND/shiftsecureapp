import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor configuration for Shift Secure (iOS + Android).
 *
 * - `webDir` points at the static SPA build emitted by `bun run build:mobile`.
 * - `appId` is the reverse-DNS bundle identifier used by both stores.
 * - `server.androidScheme: "https"` makes the in-app origin `https://localhost`
 *   which Supabase Auth + Lovable AI Gateway accept as a same-origin caller.
 * - `SplashScreen.launchAutoHide: true` — temporary native-shell isolation so
 *   app startup does not depend on JS-driven splash hide/show calls.
 * - `Keyboard.resize: "body"` lets CSS env(safe-area-inset-bottom) and
 *   --keyboard-height work together cleanly on both platforms.
 */
const config: CapacitorConfig = {
  appId: "com.badexy.shiftsecure",
  appName: "Shift Secure",
  webDir: "dist/spa",
  bundledWebRuntime: false,
  server: {
    androidScheme: "https",
  },
  ios: {
    // `never` lets the WebView extend under the status bar so our CSS
    // safe-area paddings own the inset — required for Dynamic Island devices.
    contentInset: "never",
    limitsNavigationsToAppBoundDomains: false,
    scrollEnabled: true,
  },
  android: {
    allowMixedContent: false,
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
