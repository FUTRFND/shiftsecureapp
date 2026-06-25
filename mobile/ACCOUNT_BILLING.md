# Account + Billing (Native iOS / Android)

## What's included
- `src/mobile/account.tsx` — Account tab: profile, plan, usage, upgrade, restore.
- Account is the 6th bottom-tab in `src/mobile-home.entry.tsx`.
- RevenueCat is engaged on native via `src/platform/payments.ts`
  (`nativePaymentsEnabled() === isNative()`); web stays a no-op.

## Native dependency
Already added to `package.json`:

```
bun add @revenuecat/purchases-capacitor
```

After pulling, run a native sync before opening Xcode / Android Studio:

```
bun run build:mobile        # produce dist/spa
npx cap sync ios            # or: npx cap sync android
```

## Required env vars (build-time, Vite)
- `VITE_REVENUECAT_IOS_KEY` — RevenueCat **public** iOS SDK key (appl_...).
- `VITE_REVENUECAT_ANDROID_KEY` — RevenueCat **public** Android SDK key (goog_...).
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` — already set.

## RevenueCat dashboard expectations
- Entitlement id: **`pro`** (see `src/config/subscription.ts`).
- Offering with at least one monthly package, e.g. `handoffhero_pro_monthly`.
- 14-day intro trial configured on the App Store / Play Console product.

## Behavior
- Web preview: shows the Account screen, but billing actions show an info
  banner ("Subscriptions are managed inside the iOS or Android app").
  No RC calls are made on web.
- Native: `subscriptionService.init(userId)` is invoked when the Account tab
  mounts; offerings load from RC; purchase / restore flow through the SDK.
- Entitlement state is cached locally via the existing `subscriptionService`
  cache (`hh.subscription.cache.v1`). No new Supabase schema was added —
  RevenueCat is the source of truth.

## Feature gating (first pass — non-breaking)
The Account screen shows clear "Free plan" / "Team feature" / "Unlocked"
pills and a usage meter for handoffs. Existing screens are **not** blocked
in this pass; they will start enforcing limits in a follow-up using the
existing `subscriptionService.can(...)` capability API.

## Files changed
- `src/platform/payments.ts` — `nativePaymentsEnabled()` now returns `isNative()`.
- `src/mobile-home.entry.tsx` — Account tab + icon; removed redundant top-right Sign out.
- `src/mobile/account.tsx` — new screen.
- `package.json` — added `@revenuecat/purchases-capacitor`.
