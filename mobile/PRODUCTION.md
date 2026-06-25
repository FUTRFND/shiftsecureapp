# Production readiness — TestFlight & Google Play Internal Testing

This document covers the remaining native-only steps. Everything in the
web/JS layer is already wired by Phases 1–6 and is verified by
`bun run typecheck` and the standard Lovable build.

## Prerequisites (local dev machine)

| Tool           | Version                 | Why                                                |
| -------------- | ----------------------- | -------------------------------------------------- |
| Xcode          | 15.4+                   | iOS build, simulator, archive upload to TestFlight |
| CocoaPods      | latest (`brew install`) | iOS native dep resolution                          |
| Android Studio | Hedgehog 2023.1.1+      | Android SDK 34, build, Play Console upload         |
| JDK            | 17                      | Required by AGP 8.x                                |
| Bun            | matches `package.json`  | Project build                                      |

## One-time setup

```bash
bun install
bun run build:mobile      # produces dist/spa
npx cap add ios
npx cap add android
bunx cap sync
```

## iOS — Info.plist additions

Open `ios/App/App/Info.plist` and add:

```xml
<key>NSMicrophoneUsageDescription</key>
<string>Shift Secure needs the microphone to record your dictated handoffs.</string>
<key>NSSpeechRecognitionUsageDescription</key>
<string>Speech recognition turns your dictation into the transcript that becomes an SBAR handoff.</string>
<key>UIBackgroundModes</key><array/>
<key>ITSAppUsesNonExemptEncryption</key><false/>
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array><string>handoffhero</string></array>
  </dict>
</array>
```

For Universal Links, also add the `Associated Domains` entitlement
(`applinks:auth.handoffhero.app`) in Xcode → Signing & Capabilities.

## Android — Manifest additions

In `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.INTERNET" />
<queries>
  <intent>
    <action android:name="android.speech.RecognitionService" />
  </intent>
</queries>
```

Add the deep-link intent filter inside the main `<activity>`:

```xml
<intent-filter android:autoVerify="true">
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="handoffhero" />
</intent-filter>
```

## Splash & icons

Generate from a 1024×1024 source PNG:

```bash
bunx @capacitor/assets generate \
  --iconBackgroundColor "#0b1220" \
  --splashBackgroundColor "#0b1220"
```

Drop the source at `assets/icon.png` and `assets/splash.png` (light + dark
variants — `splash-dark.png` is auto-detected).

## Status bar / safe areas

Already handled by `src/platform/native-shell.ts` + the `safe-*` utility
classes in `src/styles.css`. No native code edits required.

## App version

Bump both:

- `ios/App/App.xcodeproj/project.pbxproj` → `MARKETING_VERSION`,
  `CURRENT_PROJECT_VERSION`
- `android/app/build.gradle` → `versionName`, `versionCode`

Also set `VITE_APP_VERSION` before `bun run build:mobile` so telemetry
emits the right tag.

## TestFlight upload

```bash
bun run build:mobile
bunx cap sync ios
bunx cap open ios
# Xcode: Product → Archive → Distribute App → App Store Connect → Upload
```

In App Store Connect, attach the build to a TestFlight group. First
upload triggers Apple's Export Compliance review (~24 h).

## Google Play Internal Testing

```bash
bun run build:mobile
bunx cap sync android
cd android && ./gradlew bundleRelease
# Output: android/app/build/outputs/bundle/release/app-release.aab
```

Upload the `.aab` to Play Console → Testing → Internal testing → Create
new release. Add testers by email or a Google Group.

## Verification checklist before TestFlight / Play submission

- [ ] App launches without a white flash (splash → first paint is clean)
- [ ] Status bar overlays the WebView, content is not clipped
- [ ] Notch + Dynamic Island + Android cutouts do not cover content
- [ ] Mic permission prompt appears on first record tap
- [ ] Speech transcript appears live, finalizes on stop
- [ ] AI summary generates and the request ID surfaces in console
      telemetry as `ai.summarize_handoff.success`
- [ ] Offline banner appears when airplane mode is on
- [ ] Deep link `handoffhero://auth/callback?...` opens the app and
      routes to `/dashboard` (signed in) or `/reset-password`
- [ ] Sign out clears the session and returns to `/login`
- [ ] Hardware back on Android navigates router history; exits at root
- [ ] Keyboard does not cover the submit button on login / signup /
      forgot-password / voice screens
- [ ] Dark mode flips the status bar style live

## Outstanding production blockers (out of Phase 6 scope)

1. **RevenueCat** — Phase 7. Payments still stubbed in `src/platform/payments.ts`.
2. **App Store / Play Console listings** — screenshots, descriptions,
   privacy policy URL, support URL. Project-management task, not code.
3. **Sentry / Bugsnag native crash reporting** — telemetry layer is
   ready to receive a sink; integration is a follow-up.
4. **Apple Sign In** — required by App Review whenever a third-party
   social sign-in is offered. Currently we hide Google sign-in on native,
   so this is dormant until Google is enabled natively.
