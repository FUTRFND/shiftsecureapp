import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor configuration for Handoff Hero (iOS + Android).
 *
 * - `webDir` points at the static SPA build emitted by `bun run build:mobile`.
 * - `appId` is the reverse-DNS bundle identifier used by both stores.
 * - `server.androidScheme: "https"` makes the in-app origin `https://localhost`
 *   which Supabase Auth + Lovable AI Gateway accept as a same-origin caller.
 */
const config: CapacitorConfig = {
  appId: "com.handoffhero.app",
  appName: "Handoff Hero",
  webDir: "dist/spa",
  bundledWebRuntime: false,
  server: {
    androidScheme: "https",
  },
  ios: {
    contentInset: "always",
    limitsNavigationsToAppBoundDomains: false,
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: "#0b1220",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    Keyboard: {
      resize: "native",
      resizeOnFullScreen: true,
    },
  },
};

export default config;
