import type { Dispatch, SetStateAction } from "react";
import type { Session, SupabaseClient, User } from "@supabase/supabase-js";

import { subscriptionService } from "@/services/subscription";

type HardSignOutParams = {
  supabase: SupabaseClient;
  setSession: Dispatch<SetStateAction<Session | null>>;
  setUser: Dispatch<SetStateAction<User | null>>;
  setSignedIn: Dispatch<SetStateAction<boolean>>;
};

const AUTH_KEY_MARKERS = ["supabase", "sb-", "auth-token"];

function isAuthStorageKey(key: string) {
  const lower = key.toLowerCase();
  return AUTH_KEY_MARKERS.some((marker) => lower.includes(marker));
}

function clearBrowserStorage() {
  if (typeof window === "undefined") return;

  try {
    window.localStorage?.clear();
  } catch (error) {
    console.warn("[auth] localStorage clear failed", error);
  }

  try {
    window.sessionStorage?.clear();
  } catch (error) {
    console.warn("[auth] sessionStorage clear failed", error);
  }
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
  } catch (error) {
    console.warn("[auth] Capacitor Preferences clear skipped", error);
  }
}

async function logoutRevenueCatSafely() {
  try {
    await subscriptionService.logout();
  } catch (error) {
    console.warn("[auth] RevenueCat logout failed", error);
  }
}

export async function hardSignOut({
  supabase,
  setSession,
  setUser,
  setSignedIn,
}: HardSignOutParams): Promise<void> {
  console.log("[auth] hard sign out start");

  let signOutError: unknown = null;

  try {
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) signOutError = error;
  } catch (error) {
    signOutError = error;
  }

  clearBrowserStorage();
  await clearCapacitorAuthPreferences();
  await logoutRevenueCatSafely();

  setSession(null);
  setUser(null);
  setSignedIn(false);

  console.log("[auth] hard sign out complete");

  if (signOutError) throw signOutError;
}