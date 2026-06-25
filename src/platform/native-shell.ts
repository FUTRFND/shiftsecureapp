/**
 * Native shell bootstrap — runs once on app startup inside the Capacitor
 * container. On web this is a no-op aside from a single `html.native = false`
 * class hint and a theme-color sync.
 *
 * Responsibilities:
 *   - Tag <html> with `native` / `platform-ios` / `platform-android` so CSS
 *     can branch (safe-area paddings, fixed-bar offsets) without JS runtime
 *     checks in screens.
 *   - Configure status bar + keyboard + dark-mode listeners.
 *   - Hide splash only AFTER the app signals ready (prevents white flash).
 *   - Forward Android hardware-back to TanStack Router history.
 *   - Surface app lifecycle (pause/resume/active) to telemetry.
 *
 * Deep links are owned by `@/platform/deep-links` and the auth-specific
 * handler in `@/lib/auth-deep-link`, both wired up by `AuthProvider`.
 */
import { isNative, getPlatform } from "@/platform";
import { telemetry } from "@/platform/telemetry";
import type { Router } from "@tanstack/react-router";

export interface NativeShellOptions {
  router: Router<never, never>;
}

// Resolved when the React tree has rendered enough to hide the splash safely.
let appReadyResolve: (() => void) | undefined;
const appReadyPromise = new Promise<void>((resolve) => {
  appReadyResolve = resolve;
});

/**
 * Signal that the app is ready to be shown. Called by the root component
 * after first paint. Idempotent.
 */
export function signalAppReady(): void {
  appReadyResolve?.();
  appReadyResolve = undefined;
}

function tagHtml(): void {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  const platform = getPlatform();
  html.classList.toggle("native", isNative());
  html.classList.toggle("platform-ios", platform === "ios");
  html.classList.toggle("platform-android", platform === "android");
  html.classList.toggle("platform-web", platform === "web");
}

function syncThemeColor(): void {
  if (typeof document === "undefined") return;
  // Pull the resolved --background token so the browser status bar / Android
  // edge matches the active theme (light or dark).
  const bg = getComputedStyle(document.documentElement).getPropertyValue("--background").trim();
  if (!bg) return;
  let tag = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!tag) {
    tag = document.createElement("meta");
    tag.name = "theme-color";
    document.head.appendChild(tag);
  }
  tag.content = `oklch(${bg})`;
}

export async function initNativeShell({ router }: NativeShellOptions): Promise<void> {
  tagHtml();
  syncThemeColor();

  // Web: nothing more to do. Theme-color reacts to manual class toggles via
  // the MutationObserver below.
  if (typeof document !== "undefined") {
    const obs = new MutationObserver(() => syncThemeColor());
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  }

  if (!isNative()) return;

  // Register a dynamic importer that defeats Vite's static analysis. Native-
  // only optional plugins (RevenueCat, etc.) route through this so the web
  // build never tries to resolve them. Uses `new Function` because a literal
  // `import(spec)` call would still be analyzed by Rollup.
  try {
    const g = globalThis as { __lovableNativeImport?: (s: string) => Promise<unknown> };
    if (!g.__lovableNativeImport) {
      g.__lovableNativeImport = new Function("s", "return import(s)") as (
        s: string,
      ) => Promise<unknown>;
    }
  } catch {
    /* CSP may forbid Function(); native plugins will simply degrade. */
  }

  try {
    const [{ SplashScreen }, { StatusBar, Style }, { App }, { Keyboard }] = await Promise.all([
      import("@capacitor/splash-screen"),
      import("@capacitor/status-bar"),
      import("@capacitor/app"),
      import("@capacitor/keyboard"),
    ]);

    // ---- Status bar: react to color-scheme changes ----------------------
    const applyStatusBar = async () => {
      const dark =
        typeof window !== "undefined" &&
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches;
      try {
        await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light });
      } catch {
        // some Android skins reject style changes; non-fatal
      }
    };
    await applyStatusBar();
    if (typeof window !== "undefined" && window.matchMedia) {
      window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
        void applyStatusBar();
        syncThemeColor();
      });
    }

    // ---- Keyboard: tag <html> so CSS can lift fixed footers ------------
    Keyboard.addListener("keyboardWillShow", (info) => {
      document.documentElement.style.setProperty("--keyboard-height", `${info.keyboardHeight}px`);
      document.documentElement.classList.add("keyboard-open");
    });
    Keyboard.addListener("keyboardWillHide", () => {
      document.documentElement.style.setProperty("--keyboard-height", "0px");
      document.documentElement.classList.remove("keyboard-open");
    });

    // ---- Android hardware back → router history; exit on root ----------
    App.addListener("backButton", ({ canGoBack }) => {
      if (canGoBack) {
        router.history.back();
      } else {
        void App.exitApp();
      }
    });

    // ---- Lifecycle telemetry -------------------------------------------
    App.addListener("appStateChange", (state) => {
      telemetry.info("app.state", { active: state.isActive });
    });
    App.addListener("pause", () => telemetry.info("app.pause"));
    App.addListener("resume", () => telemetry.info("app.resume"));

    // ---- Splash hide: wait for app-ready OR a hard 3s ceiling ----------
    const ceiling = new Promise<void>((r) => setTimeout(r, 3000));
    await Promise.race([appReadyPromise, ceiling]);
    await SplashScreen.hide().catch(() => {});
    telemetry.info("app.ready");
  } catch (err) {
    console.warn("[native-shell] init failed", err);
    telemetry.error("app.shell_init_failed", {
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
