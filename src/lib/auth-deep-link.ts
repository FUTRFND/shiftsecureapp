/**
 * Supabase auth deep-link handler.
 *
 * Translates an inbound auth callback URL (custom scheme on native, or
 * Universal/App Link on either) into a Supabase session and routes the user
 * to the appropriate in-app destination.
 *
 * Supported flows:
 *   - Email confirmation       — `type=signup` or no type, hash tokens
 *   - Magic link               — `type=magiclink`, hash tokens
 *   - Password recovery        — `type=recovery`, hash tokens → /reset-password
 *   - OAuth (PKCE)             — `?code=...` → exchangeCodeForSession
 *   - Auth error               — `?error=...` → surface friendly message
 *
 * Independent of UI: takes a navigate callback so it works from any router.
 */
import type { Router } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  AUTH_CALLBACK_HOST,
  POST_AUTH_REDIRECT_PATH,
  RESET_PASSWORD_ROUTE,
  SIGN_IN_ROUTE,
  isAuthCallbackUrl,
} from "@/config/auth";
import { registerDeepLinkHandler } from "@/platform/deep-links";

type NavigateFn = Router<never, never>["navigate"];

interface CallbackParams {
  accessToken?: string;
  refreshToken?: string;
  type?: string;
  code?: string;
  errorCode?: string;
  errorDescription?: string;
}

/** Parse params from both the hash (implicit flow) and the query (PKCE/error). */
function extractCallbackParams(url: URL): CallbackParams {
  const out: CallbackParams = {};
  const fromHash = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : url.hash);
  const fromQuery = url.searchParams;

  out.accessToken = fromHash.get("access_token") ?? fromQuery.get("access_token") ?? undefined;
  out.refreshToken = fromHash.get("refresh_token") ?? fromQuery.get("refresh_token") ?? undefined;
  out.type = fromHash.get("type") ?? fromQuery.get("type") ?? undefined;
  out.code = fromQuery.get("code") ?? undefined;
  out.errorCode = fromQuery.get("error_code") ?? fromHash.get("error_code") ?? undefined;
  out.errorDescription =
    fromQuery.get("error_description") ?? fromHash.get("error_description") ?? undefined;
  return out;
}

export interface AuthDeepLinkOptions {
  navigate: NavigateFn;
  /** Called with a user-presentable error message. Wire to a toast in the UI. */
  onError?: (message: string) => void;
  /** Called after a successful session is set. */
  onSuccess?: (params: CallbackParams) => void;
}

/**
 * Register the Supabase auth deep-link handler. Returns an unregister fn.
 *
 * Safe to call on both web and native — on web it only fires for in-app
 * Universal-Link navigations (rare); regular browser email-link clicks land
 * directly on the redirect route as normal page navigations.
 */
export function registerAuthDeepLinkHandler(options: AuthDeepLinkOptions): () => void {
  const { navigate, onError, onSuccess } = options;

  return registerDeepLinkHandler(async (url) => {
    if (!isAuthCallbackUrl(url)) return false;

    const params = extractCallbackParams(url);

    // Surface auth errors from the provider.
    if (params.errorCode || params.errorDescription) {
      const message = params.errorDescription || params.errorCode || "Authentication failed";
      onError?.(decodeURIComponent(message));
      await navigate({ to: SIGN_IN_ROUTE, replace: true });
      return true;
    }

    try {
      // PKCE / OAuth code flow.
      if (params.code) {
        const { error } = await supabase.auth.exchangeCodeForSession(params.code);
        if (error) {
          onError?.(error.message);
          await navigate({ to: SIGN_IN_ROUTE, replace: true });
          return true;
        }
      } else if (params.accessToken && params.refreshToken) {
        // Implicit/hash flow (email confirm, magic link, recovery).
        const { error } = await supabase.auth.setSession({
          access_token: params.accessToken,
          refresh_token: params.refreshToken,
        });
        if (error) {
          onError?.(error.message);
          await navigate({ to: SIGN_IN_ROUTE, replace: true });
          return true;
        }
      } else {
        // Auth callback URL but no tokens / code — treat as cancelled.
        onError?.("Sign-in was cancelled or the link expired.");
        await navigate({ to: SIGN_IN_ROUTE, replace: true });
        return true;
      }

      onSuccess?.(params);

      // Route by callback type.
      if (params.type === "recovery") {
        await navigate({ to: RESET_PASSWORD_ROUTE, replace: true });
      } else {
        await navigate({ to: POST_AUTH_REDIRECT_PATH, replace: true });
      }
      return true;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unexpected error during sign-in callback.";
      onError?.(message);
      await navigate({ to: SIGN_IN_ROUTE, replace: true });
      return true;
    }
  });
}

// Re-export for convenience so handler consumers don't need to know the host.
export { AUTH_CALLBACK_HOST };
