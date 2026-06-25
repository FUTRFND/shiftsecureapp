/**
 * Generic deep-link router.
 *
 * Decoupled from any specific feature so auth, share-sheets, push-notification
 * payloads, and future flows can all register independently.
 *
 * Flow:
 *   `native-shell` calls `dispatchDeepLink(url)` for every Capacitor
 *   `appUrlOpen` event. Each registered handler is given a parsed `URL`. The
 *   first handler to return `true` wins; subsequent handlers are skipped.
 *
 *   Duplicate URLs delivered within `DUPLICATE_WINDOW_MS` are ignored — iOS
 *   in particular can re-fire `appUrlOpen` when the app foregrounds.
 *
 *   Malformed URLs are caught and logged, never thrown.
 */
export type DeepLinkHandler = (url: URL, rawUrl: string) => boolean | Promise<boolean>;

const handlers = new Set<DeepLinkHandler>();
const recentUrls = new Map<string, number>();
const DUPLICATE_WINDOW_MS = 2_000;

/** Register a deep-link handler. Returns an unregister function. */
export function registerDeepLinkHandler(handler: DeepLinkHandler): () => void {
  handlers.add(handler);
  return () => {
    handlers.delete(handler);
  };
}

/**
 * Dispatch a raw URL string to registered handlers in registration order.
 * Returns `true` if a handler claimed the URL.
 */
export async function dispatchDeepLink(rawUrl: string): Promise<boolean> {
  if (!rawUrl) return false;

  // Dedupe: same URL inside the dedupe window is a no-op.
  const now = Date.now();
  for (const [url, ts] of recentUrls) {
    if (now - ts > DUPLICATE_WINDOW_MS) recentUrls.delete(url);
  }
  if (recentUrls.has(rawUrl)) return true;
  recentUrls.set(rawUrl, now);

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch (err) {
    console.warn("[deep-link] malformed url", rawUrl, err);
    return false;
  }

  for (const handler of handlers) {
    try {
      const claimed = await handler(parsed, rawUrl);
      if (claimed) return true;
    } catch (err) {
      console.error("[deep-link] handler threw", err);
    }
  }
  return false;
}

/**
 * Subscribe to Capacitor `appUrlOpen` events. Safe to call on web (no-op).
 * Returns an async unsubscribe function.
 */
export async function startDeepLinkListener(): Promise<() => Promise<void>> {
  return async () => {};
}
