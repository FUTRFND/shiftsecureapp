# Release Checklist — TestFlight & Play Internal Testing

Run this end-to-end the first time you ship, and as a smoke test on every
release after that. Pair with `mobile/QA_CHECKLIST.md` for functional QA.

---

## Pre-flight (both platforms)

- [ ] `bun run typecheck && bun run lint && bun run test` all green
- [ ] `bun run build:mobile` produces `dist/spa` with no warnings
- [ ] App version bumped in `package.json`, `ios/App/App.xcodeproj` (CFBundleShortVersionString + CFBundleVersion), `android/app/build.gradle` (versionName + versionCode)
- [ ] All env vars present in `.env.local` (see `mobile/LOCAL_BUILD.md`)
- [ ] Supabase Edge Function `ai-handoff` deployed with `LOVABLE_API_KEY` and `REVENUECAT_SECRET_API_KEY` secrets set
- [ ] Supabase Auth → Additional Redirect URLs contains both the custom scheme and the universal-link URL
- [ ] RevenueCat entitlement `pro` exists with monthly + annual products attached to one offering

---

## App icons + splash screens

- [ ] Generate from a 1024×1024 PNG using `@capacitor/assets`:
      `npx @capacitor/assets generate --iconBackgroundColor #0b1220 --splashBackgroundColor #0b1220`
- [ ] iOS: icons under `ios/App/App/Assets.xcassets/AppIcon.appiconset`
- [ ] Android: icons under `android/app/src/main/res/mipmap-*`
- [ ] Splash matches `capacitor.config.ts` → `backgroundColor #0b1220`
- [ ] Verified on a Dynamic Island device and a small Android phone

---

## iOS — TestFlight

1. **App Store Connect setup**
   - [ ] App record created with bundle id `com.handoffhero.app`
   - [ ] App Privacy questionnaire answered (mic, speech recognition, subscriptions, analytics)
   - [ ] Subscriptions group created, monthly + annual SKUs in **Ready to Submit**
   - [ ] App Store shared secret generated → pasted into RevenueCat iOS app settings
   - [ ] Sandbox testers created (Users and Access → Sandbox Testers)

2. **Local archive**

   ```bash
   bun run mobile:ios
   ```

   In Xcode:
   - [ ] Scheme set to `App` → Any iOS Device
   - [ ] Product → Archive
   - [ ] Distribute App → App Store Connect → Upload
   - [ ] Wait for processing (~10 min)

3. **TestFlight**
   - [ ] Export Compliance answered (uses standard HTTPS; `ITSAppUsesNonExemptEncryption=false` declared in plist)
   - [ ] Add internal testers; verify install link works
   - [ ] Run `mobile/QA_CHECKLIST.md` on a real device with a sandbox Apple ID

---

## Android — Play Internal Testing

1. **Play Console setup**
   - [ ] App created with package `com.handoffhero.app`
   - [ ] App content (privacy policy URL, data safety, target audience) completed
   - [ ] Subscriptions created: `handoffhero_pro_monthly`, `handoffhero_pro_annual`
   - [ ] Service account JSON generated and uploaded to RevenueCat Android app settings
   - [ ] License test accounts added (Setup → License testing)

2. **Signed bundle**

   ```bash
   bun run mobile:android
   ```

   In Android Studio:
   - [ ] Build → Generate Signed App Bundle → AAB
   - [ ] Use the release keystore from `mobile/NATIVE_CONFIG.md`
   - [ ] Output: `android/app/release/app-release.aab`

3. **Upload**
   - [ ] Play Console → Testing → Internal testing → Create new release
   - [ ] Upload AAB, fill release notes
   - [ ] Add tester list (license-test Google accounts)
   - [ ] Verify opt-in link installs successfully
   - [ ] Verify `assetlinks.json` is served (Play Console will flag App Links errors)

---

## Post-release smoke test (both platforms)

- [ ] Sign up with new email → confirmation email opens app via universal link
- [ ] Sign in / sign out / forgot password (deep-link path)
- [ ] Voice dictation → transcript → AI summary (premium gate respected)
- [ ] Paywall opens, sandbox monthly purchase succeeds, entitlement unlocks within 60s
- [ ] Restore purchases works on a fresh reinstall of the same Apple/Google account
- [ ] Airplane mode: cached entitlement still grants access; reconnect refreshes
- [ ] Background → foreground: session restored, no re-login required

---

## Known limitations / manual steps

- **Google Sign-In on native** is **disabled in this build** (web only). To
  add it, install `@codetrix-studio/capacitor-google-auth`, register the
  OAuth client IDs (iOS, Android, web) with Google Cloud, and re-enable the
  Google button on `login.tsx` / `signup.tsx` behind `isNative()`.
- **Push notifications**: not wired. Adapter stub exists in `src/platform/`
  but no APNs/FCM setup. Add when product needs it.
- **Camera / location**: stubbed only; no permissions currently requested.
- **Universal Links / App Links** require you to host the
  `apple-app-site-association` and `assetlinks.json` files on
  `handoffhero.app`. Until then, deep links still work via the custom
  `handoffhero://` scheme — universal links just degrade to opening the
  browser.
- **RevenueCat sandbox** on iOS can take 1–5 minutes to surface a purchase;
  Android licensed-test purchases are instant.
- **`ios/` and `android/` directories** are not committed. Each developer
  recreates them with `npx cap add` on first checkout (see
  `mobile/LOCAL_BUILD.md`).
