/**
 * PlatformStorage — key/value storage abstraction.
 *
 * Web: `localStorage` (synchronous behind an async facade).
 * Native: `@capacitor/preferences` (backed by NSUserDefaults / SharedPreferences,
 * which survives WebView storage pressure that can wipe `localStorage`).
 *
 * Used by the Supabase auth client as the session store so tokens survive
 * cold starts on device.
 */
import { isNative } from "./runtime";

export interface PlatformStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
  keys(): Promise<string[]>;
  clear(): Promise<void>;
}

const webStorage: PlatformStorage = {
  async get(key) {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(key);
  },
  async set(key, value) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, value);
  },
  async remove(key) {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(key);
  },
  async keys() {
    if (typeof window === "undefined") return [];
    const result: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const k = window.localStorage.key(i);
      if (k) result.push(k);
    }
    return result;
  },
  async clear() {
    if (typeof window === "undefined") return;
    window.localStorage.clear();
  },
};

const nativeStorage: PlatformStorage = {
  async get(key) {
    const { Preferences } = await import("@capacitor/preferences");
    const { value } = await Preferences.get({ key });
    return value;
  },
  async set(key, value) {
    const { Preferences } = await import("@capacitor/preferences");
    await Preferences.set({ key, value });
  },
  async remove(key) {
    const { Preferences } = await import("@capacitor/preferences");
    await Preferences.remove({ key });
  },
  async keys() {
    const { Preferences } = await import("@capacitor/preferences");
    const { keys } = await Preferences.keys();
    return keys;
  },
  async clear() {
    const { Preferences } = await import("@capacitor/preferences");
    await Preferences.clear();
  },
};

export const platformStorage: PlatformStorage = isNative() ? nativeStorage : webStorage;

/**
 * Synchronous adapter shaped like the DOM `Storage` interface for libraries
 * (Supabase Auth) that require sync `getItem`/`setItem`/`removeItem`.
 *
 * On web this is a thin pass-through to `localStorage`.
 * On native the in-memory cache fronts an async write-through to Preferences;
 * the cache MUST be hydrated (`hydrateAuthStorage`) before the Supabase client
 * makes its first auth read, or session restoration after cold start fails.
 */
const memoryCache = new Map<string, string>();

export const platformStorageSync = {
  getItem(key: string): string | null {
    if (memoryCache.has(key)) return memoryCache.get(key) ?? null;
    if (!isNative() && typeof window !== "undefined") {
      return window.localStorage.getItem(key);
    }
    return null;
  },
  setItem(key: string, value: string): void {
    memoryCache.set(key, value);
    if (!isNative() && typeof window !== "undefined") {
      window.localStorage.setItem(key, value);
      return;
    }
    void platformStorage.set(key, value);
  },
  removeItem(key: string): void {
    memoryCache.delete(key);
    if (!isNative() && typeof window !== "undefined") {
      window.localStorage.removeItem(key);
      return;
    }
    void platformStorage.remove(key);
  },
};

/** Hydrate specific keys from native Preferences into the sync cache. */
export async function hydratePlatformStorageSync(keys: string[]): Promise<void> {
  if (!isNative()) return;
  await Promise.all(
    keys.map(async (key) => {
      const value = await platformStorage.get(key);
      if (value !== null) memoryCache.set(key, value);
    }),
  );
}

/**
 * Hydrate ALL Supabase auth keys (`sb-*`) from native Preferences.
 *
 * Supabase stores the access token under `sb-<project-ref>-auth-token` plus
 * helpers like `sb-<ref>-auth-token-code-verifier` (PKCE). Enumerating
 * Preferences avoids hard-coding the project ref.
 */
export async function hydrateAuthStorage(): Promise<void> {
  if (!isNative()) return;
  const allKeys = await platformStorage.keys();
  const authKeys = allKeys.filter((k) => k.startsWith("sb-"));
  await hydratePlatformStorageSync(authKeys);
}

/** Wipe every Supabase auth key from both the cache and persistent storage. */
export async function clearAuthStorage(): Promise<void> {
  const allKeys = await platformStorage.keys();
  await Promise.all(
    allKeys
      .filter((k) => k.startsWith("sb-"))
      .map(async (k) => {
        memoryCache.delete(k);
        await platformStorage.remove(k);
      }),
  );
}
