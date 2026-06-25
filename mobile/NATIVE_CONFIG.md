# Native Configuration Reference

Everything you must edit by hand after `npx cap add ios` and
`npx cap add android`. Capacitor scaffolds defaults; the items below are
**not** automated.

---

## iOS — `ios/App/App/`

### Bundle identifier + signing (Xcode → Signing & Capabilities)

- **Bundle Identifier**: `com.badexy.shiftsecure` (must match `appId` in `capacitor.config.ts`)
- **Team**: your Apple Developer team
- **Signing**: Automatically manage signing → ON for development; for
  release, use a distribution provisioning profile.
- **Capabilities to add**:
  - **Associated Domains** → `applinks:handoffhero.app`
  - **In-App Purchase**
  - **Push Notifications** (only if/when notifications are added — currently stubbed)

### `Info.plist` checklist

```xml
<key>NSMicrophoneUsageDescription</key>
<string>Shift Secure records your voice so you can dictate patient handoffs hands-free.</string>

<key>NSSpeechRecognitionUsageDescription</key>
<string>Shift Secure converts your dictation to text on-device so you can review and edit it before sharing.</string>

<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleTypeRole</key><string>Editor</string>
    <key>CFBundleURLName</key><string>com.badexy.shiftsecure</string>
    <key>CFBundleURLSchemes</key>
    <array><string>handoffhero</string></array>
  </dict>
</array>

<key>ITSAppUsesNonExemptEncryption</key><false/>
```

Universal Links: requires `apple-app-site-association` served from
`https://handoffhero.app/.well-known/apple-app-site-association` with:

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "<TEAMID>.com.badexy.shiftsecure",
        "paths": ["/auth/*", "/reset-password", "/dashboard"]
      }
    ]
  }
}
```

### CocoaPods

```bash
cd ios/App
pod install
```

Re-run after any `npx cap sync` that adds a plugin.

### Add RevenueCat Capacitor plugin natively

```bash
cd ios/App
npm install --prefix ../.. @revenuecat/purchases-capacitor    # already in package.json? skip
pod install
```

The web build never resolves this package (it's loaded via
`__lovableNativeImport` at runtime); but the iOS Pods install **does** need it
locally. If `npm install` already added it, just run `pod install`.

---

## Android — `android/app/`

### `build.gradle` (module)

- `applicationId "com.badexy.shiftsecure"` (must match `appId`)
- `minSdkVersion 23`, `targetSdkVersion 34`, `compileSdkVersion 34`
- **Signing config**: create a `release` keystore (`keytool -genkey -v ...`),
  store it outside the repo, reference in `signingConfigs { release { ... } }`
  with credentials read from `gradle.properties` (NOT committed).
- Enable `minifyEnabled true` for release; ProGuard rules for RevenueCat and
  Capacitor are bundled with their plugins.

### `AndroidManifest.xml`

```xml
<uses-permission android:name="android.permission.INTERNET"/>
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
<uses-permission android:name="android.permission.RECORD_AUDIO"/>
<uses-permission android:name="com.android.vending.BILLING"/>

<application ...>
  <activity ...>
    <!-- Custom scheme: handoffhero:// -->
    <intent-filter android:autoVerify="false">
      <action android:name="android.intent.action.VIEW"/>
      <category android:name="android.intent.category.DEFAULT"/>
      <category android:name="android.intent.category.BROWSABLE"/>
      <data android:scheme="handoffhero"/>
    </intent-filter>

    <!-- App Links: https://handoffhero.app/auth/... -->
    <intent-filter android:autoVerify="true">
      <action android:name="android.intent.action.VIEW"/>
      <category android:name="android.intent.category.DEFAULT"/>
      <category android:name="android.intent.category.BROWSABLE"/>
      <data android:scheme="https"
            android:host="handoffhero.app"
            android:pathPrefix="/auth"/>
    </intent-filter>
  </activity>
</application>
```

App Links verification: host `https://handoffhero.app/.well-known/assetlinks.json`:

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.badexy.shiftsecure",
      "sha256_cert_fingerprints": ["<RELEASE_KEYSTORE_SHA256>"]
    }
  }
]
```

### Play Billing + RevenueCat

- Enable **Google Play Billing Library** (added automatically by the
  RevenueCat plugin).
- In Play Console → Monetize → Products → Subscriptions, create:
  - `handoffhero_pro_monthly`
  - `handoffhero_pro_annual`
- License-test accounts: Play Console → Setup → License testing.

---

## Supabase dashboard checklist

| Setting                             | Value                                                                                                                             |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Auth → URL Configuration → Site URL | your web app origin                                                                                                               |
| Auth → Additional Redirect URLs     | `handoffhero://auth/callback`, `https://handoffhero.app/auth/callback`, `https://handoffhero.app/reset-password`, web equivalents |
| Auth → Email templates              | confirm/reset links use `{{ .RedirectTo }}` (default)                                                                             |
| Edge Functions → ai-handoff         | deployed, `verify_jwt = true`                                                                                                     |
| Edge Function secrets               | `LOVABLE_API_KEY`, `REVENUECAT_SECRET_API_KEY`                                                                                    |
| RLS                                 | enabled on every user-data table; policies scope to `auth.uid()`                                                                  |

---

## RevenueCat dashboard checklist

| Item                | Value                                                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| iOS app             | bundle id `com.badexy.shiftsecure`, App Store Connect shared secret configured                                                 |
| Android app         | package `com.badexy.shiftsecure`, Play service-account JSON uploaded                                                           |
| Entitlement         | id `pro` (matches `ENTITLEMENT_IDS.pro` in `src/config/subscription.ts`)                                                       |
| Products attached   | `handoffhero_pro_monthly`, `handoffhero_pro_annual`                                                                            |
| Offering            | one default offering containing both packages                                                                                  |
| API keys            | iOS public, Android public → into `.env.local`; **Secret API key** → Supabase Edge Function secret `REVENUECAT_SECRET_API_KEY` |
| Webhooks (optional) | point to a `/api/public/webhooks/revenuecat` route if you add server-side billing event handling later                         |

---

## Where each identifier is defined in code

| What                | Single source of truth                                             |
| ------------------- | ------------------------------------------------------------------ |
| App bundle id       | `capacitor.config.ts` (`appId`)                                    |
| URL scheme          | `.env.local` → `VITE_APP_URL_SCHEME`, read in `src/config/auth.ts` |
| Universal link host | `.env.local` → `VITE_APP_UNIVERSAL_LINK_HOST`                      |
| Auth callback paths | `src/config/auth.ts`                                               |
| Entitlement ids     | `src/config/subscription.ts` → `ENTITLEMENT_IDS`                   |
| Product ids         | `src/config/subscription.ts` → `PRODUCT_IDS`                       |
| Capabilities        | `src/config/subscription.ts` → `CAPABILITY_ENTITLEMENTS`           |
| RC public API keys  | `.env.local` → `VITE_REVENUECAT_*_KEY`                             |
| RC secret API key   | Supabase Edge Function secret `REVENUECAT_SECRET_API_KEY`          |

Nothing above is hardcoded in screens or business logic. If you ever need to
rename the bundle id or scheme, edit the env var / config file — do **not**
grep-replace through `src/`.
