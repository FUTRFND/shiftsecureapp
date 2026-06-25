/**
 * Native shell bootstrap.
 *
 * Temporarily disabled on Capacitor while isolating WebView freezes. Native
 * plugin listeners, router forwarding, and splash/status/keyboard side effects
 * must not run in the native shell during this test.
 */
import { isNative, getPlatform } from "@/platform";

/**
 * Signal that the app is ready to be shown. Called by the root component
 * after first paint. Idempotent.
 */
export function signalAppReady(): void {}

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

export async function initNativeShell(): Promise<void> {
  if (isNative()) return;

  tagHtml();
  syncThemeColor();

  // Web: nothing more to do. Theme-color reacts to manual class toggles via
  // the MutationObserver below.
  if (typeof document !== "undefined") {
    const obs = new MutationObserver(() => syncThemeColor());
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  }
}
