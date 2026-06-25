# QA Checklist — pre-submission regression matrix

Run on a real iOS device (iPhone with Dynamic Island preferred) AND a real
Android device, on the current TestFlight / Internal Testing build.

---

## Auth

- [ ] Sign up with email → confirmation email opens app (deep link)
- [ ] Sign in with email/password
- [ ] Sign out clears all `sb-*` storage; relaunch goes to `/auth`
- [ ] Forgot password → email → opens app → reset form → new password works
- [ ] Force-quit then relaunch while signed in → lands on `/dashboard` with no flash of `/auth`
- [ ] Sign in on device A; sign out on device B; device A continues to work until token refresh

## Deep links

- [ ] `handoffhero://auth/callback?...` opens app and routes correctly
- [ ] `https://handoffhero.app/auth/callback?...` opens app (universal/app link), not browser
- [ ] Cold-start with a deep link (kill app, tap link) works
- [ ] Warm-start (app in background) works
- [ ] Same link tapped twice within 2s deduplicates (no double navigation)

## Voice + AI

- [ ] First record press triggers mic + speech permission prompts
- [ ] Recording shows live partial transcript
- [ ] Stop → final transcript captured
- [ ] Copy transcript button works (clipboard verified)
- [ ] Haptic feedback on start/stop (iOS + Android)
- [ ] "Generate summary" calls Edge Function; SBAR returns within 30s
- [ ] Offline → offline banner appears, recording disabled or gracefully errors
- [ ] Reconnect → banner disappears; retry works

## Subscriptions (sandbox)

- [ ] Paywall opens from the Voice screen when not entitled
- [ ] Monthly purchase completes; UI reflects pro within 60s
- [ ] Annual purchase completes; entitlement persists across relaunch
- [ ] Restore purchases on a fresh install of the same store account unlocks pro
- [ ] User-cancel during purchase shows friendly "Purchase cancelled"
- [ ] Pending purchase (Ask to Buy on iOS) shows pending state, unlocks after approval
- [ ] Sign out → sign in with a different account → entitlement reflects that account
- [ ] Airplane mode: cached entitlement still grants AI access; coming back online refreshes

## Server-side authorization

- [ ] With `ai.summarize` capability stripped (e.g. expired sub), `ai-handoff` returns 402; UI shows paywall, not an error
- [ ] No client-only "is pro" check unlocks AI when the server says no

## Native shell / UI

- [ ] Status bar style matches theme (light text in dark mode, dark text in light mode)
- [ ] Safe-area insets respected on Dynamic Island + notched devices
- [ ] Keyboard show: footer/CTA lifts above keyboard; no content trapped beneath
- [ ] Android hardware back: navigates router history; exits app at root
- [ ] Splash screen hides only after first paint (no white flash)
- [ ] App pause/resume: session intact, no re-fetch storm

## Network

- [ ] Offline banner appears on disconnect within 2s
- [ ] Banner disappears on reconnect
- [ ] No infinite retry loops in console / network log

## Telemetry (sanity, not enforcement)

- [ ] No transcript or PHI text appears in telemetry logs
- [ ] Events fire for: app.ready, auth.signed_in, auth.signed_out, ai.summarize.{start,success,error}, subscription.{purchase_started,purchase_completed,restore_completed,paywall_shown}

## Performance smoke

- [ ] Cold launch < 3s on iPhone 12 / Pixel 6 class device
- [ ] Voice → summary round trip under load completes < 30s
- [ ] No memory growth across 10 record/summarize cycles (Xcode Instruments / Android Profiler)
