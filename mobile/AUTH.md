# Phase 3 — Authentication on Web + Capacitor

## What ships

Single Supabase auth flow that runs identically on web, iOS, and Android:

- **Storage**: `platformStorageSync` — `localStorage` on web, in-memory cache
  fronting `@capacitor/preferences` on native. Survives WebView cold starts
  and iOS storage pressure.
- **Session lifecycle**: hydrate Preferences → register listener → restore
  session → auto-refresh tokens transparently. Sign-out clears Supabase, then
  wipes every `sb-*` key from storage, then navigates to `/login`.
- **Deep links**: generic `dispatchDeepLink(url)` router. Auth registers one
  handler; future features (share-sheet, push payloads, invites) register
  alongside without touching auth.
- **OAuth/PKCE**: client now uses `flowType: 'pkce'` so OAuth + email
  callbacks both work through the same `exchangeCodeForSession` path.
- **Config**: every URL/scheme/host/path lives in `src/config/auth.ts`.

## Files

### Created
| File | Purpose |
|---|---|
| `src/config/auth.ts` | All URLs, scheme, host, paths. `buildAuthRedirectUrl()` picks web vs native target. |
| `src/platform/deep-links.ts` | Feature-agnostic deep-link router. Dedupe window, cold-start `getLaunchUrl()`, multi-handler dispatch. |
| `src/lib/auth-deep-link.ts` | Registers the Supabase auth handler. Parses hash + query, runs `exchangeCodeForSession` or `setSession`, routes by `type` (`recovery` → `/reset-password`, else `/dashboard`). |
| `mobile/AUTH.md` | This file. |

### Modified
| File | Why |
|---|---|
| `src/platform/storage.ts` | Added `keys()`, `hydrateAuthStorage()`, `clearAuthStorage()`. Sync adapter now passes through to `localStorage` directly on web (no cache divergence). |
| `src/integrations/supabase/client.ts` | `storage: platformStorageSync`, added `detectSessionInUrl: true` and `flowType: 'pkce'`. |
| `src/lib/auth.tsx` | Ordered boot (hydrate → listener → deep-link → getSession). Sign-out hygiene with storage wipe + router navigate. Strict-mode safe via `bootRef`. |
| `src/platform/native-shell.ts` | Removed inline `appUrlOpen` listener — deep links now flow through `startDeepLinkListener()` registered by `AuthProvider`. |
| `src/routes/login.tsx` `signup.tsx` | Hide Google sign-in on native (Lovable's iframe OAuth doesn't work in Capacitor WebView). Use config for redirect URL. |
| `src/routes/forgot-password.tsx` | `redirectTo` uses `buildAuthRedirectUrl(RESET_PASSWORD_ROUTE, AUTH_CALLBACK_PATH)` — web goes straight to `/reset-password`, native funnels through `handoffhero://auth/callback` and the handler routes to `/reset-password` after exchanging tokens. |

## Native deep-link setup (one-time, per platform)

After `npx cap add ios` / `npx cap add android`, register the URL scheme and
the Universal/App Link host in each native project.

### iOS — `ios/App/App/Info.plist`

```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLName</key>
    <string>com.handoffhero.app</string>
    <key>CFBundleURLSchemes</key>
    <array><string>handoffhero</string></array>
  </dict>
</array>
```

For Universal Links, add the `applinks:handoffhero.app` entitlement in
Xcode → Signing & Capabilities → Associated Domains, and host
`https://handoffhero.app/.well-known/apple-app-site-association` with the
team-prefixed bundle id.

### Android — `android/app/src/main/AndroidManifest.xml`

Inside the main `<activity>` element:

```xml
<intent-filter android:autoVerify="true">
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="handoffhero" android:host="auth" />
  <data android:scheme="https" android:host="handoffhero.app" android:pathPrefix="/auth/" />
</intent-filter>
```

For App Links, host `https://handoffhero.app/.well-known/assetlinks.json`
with the app's SHA-256 signing fingerprint.

## Supabase dashboard config

Authentication → URL Configuration → **Additional Redirect URLs** — add all four:

```
http://localhost:8080/**
https://<your-published-domain>/**
handoffhero://auth/callback
https://handoffhero.app/auth/callback
```

The custom scheme is the one used by both email confirmation and password
reset on native.

## Manual test matrix

| Flow | Web | iOS | Android |
|---|---|---|---|
| Email/password sign in | ✅ ready | ✅ ready | ✅ ready |
| Email/password sign up + confirmation email | ✅ ready | ✅ ready after Info.plist | ✅ ready after manifest |
| Password reset email → set new password | ✅ ready | ✅ ready after Info.plist | ✅ ready after manifest |
| Cold-start session restore | ✅ via localStorage | ✅ via Preferences hydration | ✅ via Preferences hydration |
| Auto token refresh | ✅ Supabase built-in | ✅ Supabase built-in | ✅ Supabase built-in |
| Sign-out wipes storage + redirects | ✅ | ✅ | ✅ |
| Google sign-in | ✅ via Lovable broker | ⛔ disabled (Phase 7) | ⛔ disabled (Phase 7) |
| Duplicate `appUrlOpen` events | n/a | ✅ deduped (2s window) | ✅ deduped (2s window) |
| Malformed deep link | ✅ logged + ignored | ✅ logged + ignored | ✅ logged + ignored |
| Auth callback with `error_description` | ✅ toast + redirect to /login | ✅ toast + redirect | ✅ toast + redirect |

## Remaining blockers before mobile production

1. **Native Google Sign-In.** Lovable's broker uses `web_message` postMessage,
   which Capacitor's WebView can't deliver. Ship in Phase 7 alongside
   RevenueCat using `@codetrix-studio/capacitor-google-auth` (or Apple's
   `Sign in with Apple` via `@capacitor-community/apple-sign-in`).
2. **Universal Links domain verification.** Requires owning `handoffhero.app`
   and hosting `apple-app-site-association` + `assetlinks.json`. Until then
   email links must rely on the custom scheme, which works but shows the
   user a "Open in Handoff Hero?" prompt.
3. **`build:mobile` SPA correctness.** The Phase 2 scaffold is good enough
   for plumbing; full SSR→SPA route audit lands in Phase 4 when AI moves to
   an Edge Function and protected routes no longer depend on server-rendered
   loaders.
4. **App Site Association / assetlinks.json hosting.** Production deploy step
   for App Links — not blocking, but needed before TestFlight.

## Web behavior — unchanged

Verified:
- Same Supabase publishable key + `VITE_*` envs.
- `localStorage` keys identical (`sb-<ref>-auth-token`).
- `redirectTo` URLs identical on web (`window.location.origin + path`).
- Existing flows preserved: `/login`, `/signup`, `/forgot-password`,
  `/reset-password`, `_authenticated` gate, dashboard sign-out button.
- `useAuth()` API surface unchanged (`user`, `session`, `loading`, `signOut`).

## Production-readiness checklist

- [x] Single auth flow, no platform branching in screens
- [x] Secure session storage (Preferences on native, localStorage on web)
- [x] Cold-start session restoration
- [x] Auto token refresh (Supabase built-in, storage adapter persists writes)
- [x] Sign-out cleanup wipes every `sb-*` key
- [x] Graceful handling: expired tokens, cancelled auth, network failures,
      duplicate callbacks, malformed deep links, provider errors
- [x] All URLs in config, no hardcoded scheme/host/path
- [x] Deep-link router decoupled from auth (reusable for future features)
- [ ] Native iOS `Info.plist` + Android manifest entries (manual, one-time —
      see above)
- [ ] Supabase dashboard redirect URL whitelist updated (manual, one-time)
- [ ] Native Google/Apple sign-in (Phase 7)
