// RevenueCat REST helper (server-side authorization source of truth).
//
// The client tells us what it thinks the user can do; the edge function
// verifies it independently before granting access to premium features.
// We call the RC REST API directly — keeping this isolated in one file means
// swapping providers later only touches this module and the platform
// adapter, not application logic.

const RC_BASE = "https://api.revenuecat.com/v1";

export type ServerEntitlementCheck = {
  active: boolean;
  /** Active entitlement identifiers. */
  entitlements: string[];
  /** Whether the user is in a billing grace period — still considered active. */
  inGracePeriod: boolean;
};

/**
 * Check entitlements for a user via the RC REST API. Returns an "inactive"
 * result if RC is unreachable so we fail closed for premium features.
 *
 * Requires the `REVENUECAT_SECRET_API_KEY` Supabase secret.
 */
export async function getEntitlementsForUser(userId: string): Promise<ServerEntitlementCheck> {
  const apiKey = Deno.env.get("REVENUECAT_SECRET_API_KEY");
  if (!apiKey) {
    // No key configured — treat everyone as free tier. Logged so prod misconfigs are visible.
    console.warn("[revenuecat] REVENUECAT_SECRET_API_KEY not configured; denying premium access.");
    return { active: false, entitlements: [], inGracePeriod: false };
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5_000);
  try {
    const res = await fetch(`${RC_BASE}/subscribers/${encodeURIComponent(userId)}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
      signal: ctrl.signal,
    });
    if (!res.ok) {
      console.warn(`[revenuecat] subscriber lookup failed status=${res.status}`);
      return { active: false, entitlements: [], inGracePeriod: false };
    }
    const json = (await res.json()) as {
      subscriber?: {
        entitlements?: Record<
          string,
          { expires_date?: string | null; grace_period_expires_date?: string | null }
        >;
      };
    };
    const now = Date.now();
    const entitlements: string[] = [];
    let inGracePeriod = false;
    const ents = json.subscriber?.entitlements ?? {};
    for (const [id, ent] of Object.entries(ents)) {
      const exp = ent.expires_date ? Date.parse(ent.expires_date) : Infinity;
      const grace = ent.grace_period_expires_date ? Date.parse(ent.grace_period_expires_date) : 0;
      if (exp > now) {
        entitlements.push(id);
      } else if (grace > now) {
        entitlements.push(id);
        inGracePeriod = true;
      }
    }
    return { active: entitlements.length > 0, entitlements, inGracePeriod };
  } catch (err) {
    console.warn("[revenuecat] subscriber lookup threw", err);
    return { active: false, entitlements: [], inGracePeriod: false };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Server-side capability resolution. Keep in sync with
 * `src/config/subscription.ts`.
 */
export const CAPABILITY_ENTITLEMENTS: Record<string, readonly string[]> = {
  "ai.summarize": ["pro"],
  "templates.unlimited": ["pro"],
  "alerts.advanced": ["pro"],
  "history.unlimited": ["pro"],
};

export function entitlementsGrant(
  check: ServerEntitlementCheck,
  capability: keyof typeof CAPABILITY_ENTITLEMENTS,
): boolean {
  const required = CAPABILITY_ENTITLEMENTS[capability] ?? [];
  return required.some((e) => check.entitlements.includes(e));
}
