# Phase 7 — Subscriptions

This document covers the production setup for RevenueCat-backed
subscriptions on iOS and Android, plus the application-side architecture
that lets us swap the provider later without touching screens.

## Architecture (one paragraph)

`screens` → `useSubscription` / `useCapability` →
`subscriptionService` → `platformPayments` → **RevenueCat SDK**.

Screens only ask the app-facing service about _capabilities_ (`ai.summarize`,
`templates.unlimited`). The service derives capabilities from RC
entitlements via `src/config/subscription.ts`, caches state in
`platformStorage` for offline launches, and fans out updates to React via
context. The native SDK is only imported inside `src/platform/payments.ts`.

The AI Edge Function re-checks entitlement server-side via RC REST
(`supabase/functions/_shared/revenuecat.ts`). Client checks are UX only;
the server is the source of truth.

## Required environment

**Client (Vite, public — safe to ship):**

- `VITE_REVENUECAT_IOS_KEY` — RC public API key for iOS
- `VITE_REVENUECAT_ANDROID_KEY` — RC public API key for Android

**Server (Supabase secret — never ship to client):**

- `REVENUECAT_SECRET_API_KEY` — RC secret API key (Project → API keys → "Secret")

Add the client keys to `.env`, the server key with `supabase secrets set`.

## Install the native plugin (local machine)

```bash
bun add @revenuecat/purchases-capacitor
bun run cap:sync
```

The platform adapter dynamic-imports the plugin; if it isn't installed the
adapter degrades to "web" behaviour so the web build still loads.

## RevenueCat dashboard setup

1. **App:** create iOS + Android apps. Bundle id `com.badexy.shiftsecure`.
2. **Products:** `handoffhero_pro_monthly`, `handoffhero_pro_annual`
   (mirror these in App Store Connect and Google Play Console).
3. **Entitlement:** create one entitlement with identifier **`pro`** and
   attach both products to it. The identifier MUST be `pro` — it's hard-
   referenced in `src/config/subscription.ts` and the edge function helper.
4. **Offering:** create a `default` offering with the two packages
   (`$rc_monthly` + `$rc_annual`).
5. Copy the **public** SDK keys → `VITE_REVENUECAT_*` envs.
6. Copy the **secret** REST key → `REVENUECAT_SECRET_API_KEY` secret.

## App Store / Play Console

- App Store Connect: configure auto-renewing subscriptions in a single
  subscription group; add localized review screenshots.
- Google Play: create the subscription, base plan (monthly/annual), and
  attach to the in-app product id above. Enable Real-time Developer
  Notifications and point them at RevenueCat.

## Manual test matrix

| Scenario                         | Expected                                                          |
| -------------------------------- | ----------------------------------------------------------------- |
| Fresh install, free user         | Generate button shows "Unlock AI summaries"; tap opens paywall    |
| Purchase monthly (sandbox)       | Toast "Welcome to Pro"; Generate works immediately                |
| Restore on new device            | Restore button reactivates entitlement                            |
| Sign out → sign in (other user)  | Entitlement clears, then reflects the new user                    |
| Offline cold start (paying user) | Cached entitlement keeps AI unlocked; refresh on reconnect        |
| Subscription expired             | Server returns `entitlement_required`; paywall reopens            |
| Billing grace period             | Treated as active by both client cache and server check           |
| User cancels purchase            | No error toast, paywall stays open                                |
| Web build                        | Paywall explains "subscribe in the mobile apps"; restore disabled |

## Replacing RevenueCat later

Three files own RC; nothing else does.

1. `src/platform/payments.ts` — replace the SDK adapter.
2. `supabase/functions/_shared/revenuecat.ts` — replace the REST helper.
3. `src/config/subscription.ts` — update entitlement / product identifiers.

The capability map, paywall, gating, and screens require no changes.
