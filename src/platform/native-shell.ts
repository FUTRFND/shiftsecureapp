/**
 * Native shell bootstrap — runs once on app startup inside the Capacitor
 * container. On web this is a no-op.
 *
 * Responsibilities:
 *   - Hide splash screen after first paint.
 *   - Set status-bar style to match the app theme.
 *   - Forward Android hardware-back to TanStack Router history.
 *
 * Deep links are owned by `@/platform/deep-links` and the auth-specific
 * handler in `@/lib/auth-deep-link`, both wired up by `AuthProvider`. This
 * shell intentionally does NOT listen for `appUrlOpen` so we don't double-fire
 * with the deep-link router.
 *
 * Call `initNativeShell({ router })` from `src/router.tsx` after the router
 * is constructed.
 */
import { isNative } from "@/platform";
import type { Router } from "@tanstack/react-router";

export interface NativeShellOptions {
  router: Router<never, never>;
}

export async function initNativeShell({ router }: NativeShellOptions): Promise<void> {
  if (!isNative()) return;

  try {
    const [{ SplashScreen }, { StatusBar, Style }, { App }] = await Promise.all([
      import("@capacitor/splash-screen"),
      import("@capacitor/status-bar"),
      import("@capacitor/app"),
    ]);

    // Match the app's dark surface.
    await StatusBar.setStyle({ style: Style.Dark }).catch(() => {});

    // Android hardware back → router history; exit on root.
    App.addListener("backButton", ({ canGoBack }) => {
      if (canGoBack) {
        router.history.back();
      } else {
        void App.exitApp();
      }
    });

    // Give the first paint a beat, then hide the splash.
    setTimeout(() => {
      void SplashScreen.hide().catch(() => {});
    }, 250);
  } catch (err) {
    // Never block app boot on shell init failure.
    console.warn("[native-shell] init failed", err);
  }
}
