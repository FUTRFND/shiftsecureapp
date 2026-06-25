/**
 * Native shell bootstrap — runs once on app startup inside the Capacitor
 * container. On web this is a no-op.
 *
 * Responsibilities (added incrementally across phases):
 *   - Hide splash screen after first paint.
 *   - Set status-bar style to match the app theme.
 *   - Forward Android hardware-back to TanStack Router history.
 *   - Listen for deep links (custom scheme + Universal/App Links) and
 *     dispatch them to the router. The Supabase auth callback handler
 *     is wired in Phase 3.
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

    // Match the app's dark surface (oklch token approximated in capacitor.config.ts).
    await StatusBar.setStyle({ style: Style.Dark }).catch(() => {});

    // Android hardware back → router history; exit on root.
    App.addListener("backButton", ({ canGoBack }) => {
      if (canGoBack) {
        router.history.back();
      } else {
        void App.exitApp();
      }
    });

    // Deep links — Phase 3 will parse the Supabase auth callback here.
    App.addListener("appUrlOpen", (event) => {
      try {
        const url = new URL(event.url);
        // Handle handoffhero://auth/callback#access_token=... in Phase 3.
        if (url.host === "auth" && url.pathname.startsWith("/callback")) {
          router.navigate({ to: "/", search: () => ({}) });
        }
      } catch {
        /* malformed url — ignore */
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
