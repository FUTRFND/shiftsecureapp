/**
 * PlatformStorage — key/value storage abstraction.
 *
 * Web: `localStorage` (synchronous behind an async facade).
 * Native: `@capacitor/preferences` (backed by NSUserDefaults / SharedPreferences).
 *
 * Used by the Supabase auth client as the session store so tokens survive
 * cold starts on device without depending on the WebView's localStorage,
 * which can be cleared by iOS under storage pressure.
 */
import { isNative } from "./runtime";

export interface PlatformStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
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
  async clear() {
    const { Preferences } = await import("@capacitor/preferences");
    await Preferences.clear();
  },
};

export const platformStorage: PlatformStorage = isNative() ? nativeStorage : webStorage;

/**
 * Synchronous adapter shaped like `Storage` for libraries (e.g. Supabase Auth)
 * that expect `getItem`/`setItem`/`removeItem`. On native we proxy to
 * Preferences asynchronously but cache reads in-memory so the synchronous
 * contract holds after the first hydration round-trip.
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
    void platformStorage.set(key, value);
  },
  removeItem(key: string): void {
    memoryCache.delete(key);
    void platformStorage.remove(key);
  },
};

/** Hydrate the sync cache from native Preferences before app boot. */
export async function hydratePlatformStorageSync(keys: string[]): Promise<void> {
  if (!isNative()) return;
  await Promise.all(
    keys.map(async (key) => {
      const value = await platformStorage.get(key);
      if (value !== null) memoryCache.set(key, value);
    }),
  );
}
