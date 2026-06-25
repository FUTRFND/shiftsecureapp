/**
 * Central auth/deep-link configuration.
 *
 * Every URL, scheme, host, and callback path referenced by auth code MUST be
 * read from here — no string literals scattered across pages. Override any
 * value via the corresponding `VITE_*` env var in `.env.local` / production.
 *
 * Web and native diverge on one thing: the redirect URL Supabase sends users
 * back to after email confirmation, password reset, OAuth, magic link, etc.
 *   - Web → `${window.location.origin}<path>` (e.g. https://app.handoffhero.com/dashboard)
 *   - Native → `${customScheme}://<host><path>` (e.g. handoffhero://auth/callback)
 *
 * `buildAuthRedirectUrl(path)` returns the right one for the current runtime.
 * Supabase Auth must whitelist BOTH the web origin and the custom-scheme URL
 * under Authentication → URL Configuration → Additional Redirect URLs.
 */
import { isNative } from "@/platform/runtime";

const env = (import.meta as unknown as { env: Record<string, string | undefined> }).env;

/** Custom URL scheme registered with iOS/Android for the Capacitor app. */
export const APP_URL_SCHEME = env.VITE_APP_URL_SCHEME ?? "handoffhero";

/** Universal Link / App Link host (owned domain). */
export const APP_UNIVERSAL_LINK_HOST = env.VITE_APP_UNIVERSAL_LINK_HOST ?? "handoffhero.app";

/**
 * Single host segment used inside both custom-scheme and Universal-Link auth
 * callback URLs. Keep it stable — it's part of every Supabase redirect URL
 * registered in the dashboard.
 */
export const AUTH_CALLBACK_HOST = "auth";

/** Path of the deep-link auth callback (after the scheme://host). */
export const AUTH_CALLBACK_PATH = "/callback";

/** Path of the password-reset deep-link target. */
export const AUTH_RESET_PASSWORD_PATH = "/reset-password";

/** In-app route the user lands on after a successful auth callback. */
export const POST_AUTH_REDIRECT_PATH = "/dashboard";

/** In-app route used for password reset form (top-level public route). */
export const RESET_PASSWORD_ROUTE = "/reset-password";

/** In-app route used as the sign-in destination. */
export const SIGN_IN_ROUTE = "/login";

/** Returns the native custom-scheme callback URL. */
export function nativeAuthCallbackUrl(path = AUTH_CALLBACK_PATH): string {
  const cleaned = path.startsWith("/") ? path : `/${path}`;
  return `${APP_URL_SCHEME}://${AUTH_CALLBACK_HOST}${cleaned}`;
}

/** Returns the web auth callback URL using the current browser origin. */
export function webAuthCallbackUrl(routePath: string): string {
  if (typeof window === "undefined") return routePath;
  const cleaned = routePath.startsWith("/") ? routePath : `/${routePath}`;
  return `${window.location.origin}${cleaned}`;
}

/**
 * Pick the right redirect URL for the current runtime.
 *
 * @param webRoutePath  In-app route path used on the web (e.g. "/dashboard").
 * @param nativePath    Optional override for the native scheme path. Defaults
 *                      to `AUTH_CALLBACK_PATH` so all native auth callbacks
 *                      funnel through a single handler.
 */
export function buildAuthRedirectUrl(webRoutePath: string, nativePath?: string): string {
  if (isNative()) return nativeAuthCallbackUrl(nativePath ?? AUTH_CALLBACK_PATH);
  return webAuthCallbackUrl(webRoutePath);
}

/**
 * Truthy when a URL is one of our auth deep links — used by the deep-link
 * router to decide whether to hand the URL to the Supabase auth handler.
 */
export function isAuthCallbackUrl(url: URL): boolean {
  // Custom scheme: handoffhero://auth/callback
  if (url.protocol === `${APP_URL_SCHEME}:`) {
    return url.host === AUTH_CALLBACK_HOST;
  }
  // Universal Link: https://handoffhero.app/auth/callback
  if (url.host === APP_UNIVERSAL_LINK_HOST) {
    return url.pathname.startsWith(`/${AUTH_CALLBACK_HOST}/`);
  }
  return false;
}
