import type { Dispatch, SetStateAction } from "react";
import type { Session, SupabaseClient, User } from "@supabase/supabase-js";

import { subscriptionService } from "@/services/subscription";

type HardSignOutParams = {
  supabase: SupabaseClient;
  setSession: Dispatch<SetStateAction<Session | null>>;
  setUser: Dispatch<SetStateAction<User | null>>;
  setSignedIn: Dispatch<SetStateAction<boolean>>;
  onLogoutStep?: (step: string) => void;
};

const AUTH_KEY_MARKERS = ["supabase", "sb-", "auth-token"];

function logLogoutStep(step: string, payload?: unknown) {
  if (payload === undefined) {
    console.log(`[logout] ${step}`);
    return;
  }
  console.log(`[logout] ${step}`, payload);
}

function sanitizeSessionResult(result: Awaited<ReturnType<SupabaseClient["auth"]["getSession"]>>) {
  return {
    sessionPresent: Boolean(result.data.session),
    userId: result.data.session?.user?.id ?? null,
    expiresAt: result.data.session?.expires_at ?? null,
    error: result.error ?? null,
  };
}

function isAuthStorageKey(key: string) {
  const lower = key.toLowerCase();
  return AUTH_KEY_MARKERS.some((marker) => lower.includes(marker));
}

function getStorageKeys(storage: Storage | undefined) {
  if (!storage) return [];
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (key) keys.push(key);
  }
  return keys;
}

function getBrowserAuthStorageKeys() {
  if (typeof window === "undefined") {
    return { localStorage: [] as string[], sessionStorage: [] as string[] };
  }

  let localStorageKeys: string[] = [];
  let sessionStorageKeys: string[] = [];

  try {
    localStorageKeys = getStorageKeys(window.localStorage).filter(isAuthStorageKey);
  } catch (error) {
    console.warn("[logout] localStorage key scan failed", error);
  }

  try {
    sessionStorageKeys = getStorageKeys(window.sessionStorage).filter(isAuthStorageKey);
  } catch (error) {
    console.warn("[logout] sessionStorage key scan failed", error);
  }

  return { localStorage: localStorageKeys, sessionStorage: sessionStorageKeys };
}

function clearBrowserStorage() {
  if (typeof window === "undefined") return;

  const authKeysBefore = getBrowserAuthStorageKeys();

  try {
    window.localStorage?.clear();
  } catch (error) {
    console.warn("[logout] localStorage clear failed", error);
  }

  try {
    window.sessionStorage?.clear();
  } catch (error) {
    console.warn("[logout] sessionStorage clear failed", error);
  }

  const remainingAuthKeys = getBrowserAuthStorageKeys();
  logLogoutStep("local/session storage cleared", {
    removedAuthKeys: authKeysBefore,
    remainingAuthKeys,
  });
}

async function clearCapacitorAuthPreferences() {
  try {
    const { Preferences } = await import("@capacitor/preferences");
    const { keys } = await Preferences.keys();
    const authKeys = new Set(
      keys.filter(isAuthStorageKey).concat(["supabase", "auth-token"]),
    );

    await Promise.all(
      Array.from(authKeys).map((key) => Preferences.remove({ key })),
    );

    const { keys: remainingKeys } = await Preferences.keys();
    const remainingAuthKeys = remainingKeys.filter(isAuthStorageKey);
    logLogoutStep("Capacitor Preferences cleared", {
      removedKeys: Array.from(authKeys),
      remainingAuthKeys,
    });
  } catch (error) {
    console.warn("[logout] Capacitor Preferences clear skipped", error);
  }
}

async function logoutRevenueCatSafely() {
  try {
    logLogoutStep("RevenueCat logout attempted");
    await subscriptionService.logout();
    logLogoutStep("RevenueCat logout completed");
  } catch (error) {
    console.warn("[logout] RevenueCat logout failed", error);
  }
}

export async function hardSignOut({
  supabase,
  setSession,
  setUser,
  setSignedIn,
  onLogoutStep,
}: HardSignOutParams): Promise<void> {
  const mark = (step: string, payload?: unknown) => {
    onLogoutStep?.(step);
    logLogoutStep(step, payload);
  };

  console.log("[auth] hard sign out start");
  mark("hardSignOut() entered");

  let signOutError: unknown = null;

  try {
    mark("supabase.auth.signOut() started");
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) {
      signOutError = error;
      console.error("[logout] supabase.auth.signOut() returned error", error);
    }
    mark("supabase.auth.signOut() completed", { errorPresent: Boolean(error) });
  } catch (error) {
    signOutError = error;
    console.error("[logout] supabase.auth.signOut() threw", error);
    mark("supabase.auth.signOut() threw", error);
  }

  try {
    const sessionResult = await supabase.auth.getSession();
    mark("supabase.auth.getSession() immediately after signOut()", sanitizeSessionResult(sessionResult));
  } catch (error) {
    console.error("[logout] supabase.auth.getSession() after signOut() threw", error);
    mark("supabase.auth.getSession() after signOut() threw", error);
  }

  clearBrowserStorage();
  mark("local/session storage cleared");
  await clearCapacitorAuthPreferences();
  mark("Capacitor Preferences cleared");
  mark("RevenueCat logout attempted");
  await logoutRevenueCatSafely();
  mark("RevenueCat logout completed");

  setSession(null);
  setUser(null);
  setSignedIn(false);
  mark("top-level auth state updated");

  mark("hardSignOut() completed");

  if (signOutError) throw signOutError;
}