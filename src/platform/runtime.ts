/**
 * Runtime detection for the platform abstraction layer.
 *
 * `isNative()` is true inside a Capacitor iOS/Android shell.
 * `isWeb()` is true in browsers (including the in-editor preview).
 *
 * All checks are SSR-safe: they return `false` on the server.
 */
let cachedIsNative: boolean | null = null;

export function isNative(): boolean {
  if (cachedIsNative !== null) return cachedIsNative;
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  cachedIsNative = Boolean(cap?.isNativePlatform?.());
  return cachedIsNative;
}

export function isWeb(): boolean {
  return !isNative() && typeof window !== "undefined";
}

export function getPlatform(): "ios" | "android" | "web" {
  if (typeof window === "undefined") return "web";
  const cap = (window as unknown as { Capacitor?: { getPlatform?: () => string } }).Capacitor;
  const p = cap?.getPlatform?.();
  if (p === "ios" || p === "android") return p;
  return "web";
}
