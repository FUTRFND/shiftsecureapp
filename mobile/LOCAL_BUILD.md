# Local Build Guide — Handoff Hero (iOS + Android)

This is the **one-stop guide** for taking the repo from a fresh clone to a
running app on a physical device or simulator. Companion docs:

- `mobile/NATIVE_CONFIG.md` — every native setting you have to edit by hand
- `mobile/RELEASE_CHECKLIST.md` — TestFlight + Play Internal Testing flow
- `mobile/QA_CHECKLIST.md` — pre-submission regression matrix
- `mobile/AUTH.md` / `mobile/SUBSCRIPTIONS.md` / `mobile/PRODUCTION.md` —
  feature-specific deep dives (still authoritative for their topics)

---

## 0. Prerequisites (one-time, local machine)

- **macOS** with Xcode 15+ (iOS) and Command Line Tools (`xcode-select --install`)
- **Android Studio Hedgehog (2023.1)** or newer with Android SDK 34+
- **JDK 17** (Android Gradle Plugin 8 requirement)
- **Node 20+** and **bun** (`npm i -g bun`)
- **CocoaPods** (`sudo gem install cocoapods`)
- Apple Developer account + App Store Connect access
- Google Play Console access
- RevenueCat dashboard access

---

## 1. Install + environment

```bash
git clone <repo>
cd handoff-hero
bun install
cp .env.example .env.local        # fill in every value (see checklist below)
```

### Environment variable checklist (`.env.local`)

| Var                             | Where to get it                                   | Required for                                   |
| ------------------------------- | ------------------------------------------------- | ---------------------------------------------- |
| `VITE_SUPABASE_URL`             | Supabase project settings                         | web + native                                   |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase project settings                         | web + native                                   |
| `VITE_SUPABASE_PROJECT_ID`      | Supabase project settings                         | web + native                                   |
| `SUPABASE_URL`                  | same as above                                     | server fns (dev)                               |
| `SUPABASE_PUBLISHABLE_KEY`      | same                                              | server fns (dev)                               |
| `SUPABASE_SERVICE_ROLE_KEY`     | Supabase project settings                         | server fns (dev)                               |
| `LOVABLE_API_KEY`               | Lovable AI gateway                                | dev only — prod lives in Edge Function secrets |
| `VITE_REVENUECAT_IOS_KEY`       | RevenueCat → Project settings → API keys → Apple  | iOS build                                      |
| `VITE_REVENUECAT_ANDROID_KEY`   | RevenueCat → Project settings → API keys → Google | Android build                                  |
| `VITE_APP_URL_SCHEME`           | leave as `handoffhero` unless you renamed it      | deep links                                     |
| `VITE_APP_UNIVERSAL_LINK_HOST`  | your owned domain (e.g. `handoffhero.app`)        | universal/app links                            |

Note: **never** put `SUPABASE_SERVICE_ROLE_KEY`, `LOVABLE_API_KEY`, or the
RevenueCat **secret** API key into the mobile bundle. The mobile app only
reads `VITE_*` vars.

---

## 2. Build verification (run these before touching native projects)

```bash
bun run typecheck     # tsc against tsconfig.prebuild.json
bun run lint
bun run test
bun run build         # full SSR build (sanity)
bun run build:mobile  # emits dist/spa — what Capacitor ships
```

All five must pass on a clean checkout. If any fail, fix before continuing.

---

## 3. Capacitor — first-time native project creation

The repo does **not** commit the `ios/` and `android/` folders. You create
them locally once per machine:

```bash
bun run build:mobile       # MUST exist before `cap add` so webDir resolves
npx cap add ios
npx cap add android
npx cap sync
```

Then make all manual native edits described in `mobile/NATIVE_CONFIG.md`
(bundle ID, signing, Info.plist, AndroidManifest, associated domains,
intent filters, RevenueCat product setup in the stores, etc.).

Commit `ios/` and `android/` to a **separate** native repo (or a `mobile/`
worktree) if you want reproducible native builds across machines. Do **not**
commit them into this repo — they conflict with the Lovable web build.

---

## 4. Day-to-day workflow

After any web/TypeScript change:

```bash
bun run build:mobile       # rebuilds dist/spa
npx cap sync               # copies dist/spa + plugins into ios/ and android/
npx cap open ios           # opens Xcode workspace
npx cap open android       # opens Android Studio project
```

Run on device/simulator from inside Xcode / Android Studio.

For native-only changes (Info.plist, Gradle, pods): edit, then build from
the IDE — no `cap sync` needed unless web assets changed too.

---

## 5. Edge Function deployment (one-time per env)

Supabase Edge Functions are deployed via the Supabase CLI from this repo:

```bash
supabase login
supabase link --project-ref <project-ref>
supabase functions deploy ai-handoff
supabase secrets set LOVABLE_API_KEY=...
supabase secrets set REVENUECAT_SECRET_API_KEY=...   # server-side entitlement check
```

The `ai-handoff` function has `verify_jwt = true` (see `supabase/config.toml`)
so requests without a valid Supabase session are rejected.

---

## 6. Command quick reference

| Goal                        | Command                                |
| --------------------------- | -------------------------------------- |
| Install deps                | `bun install`                          |
| Typecheck                   | `bun run typecheck`                    |
| Web dev server              | `bun run dev`                          |
| Web production build        | `bun run build`                        |
| Static SPA for Capacitor    | `bun run build:mobile`                 |
| Sync web → native           | `npx cap sync` (or `bun run cap:sync`) |
| Open iOS project            | `npx cap open ios`                     |
| Open Android project        | `npx cap open android`                 |
| Build + sync + open iOS     | `bun run mobile:ios`                   |
| Build + sync + open Android | `bun run mobile:android`               |

---

## 7. Troubleshooting

- **`webDir not found`** — run `bun run build:mobile` before `cap add` / `cap sync`.
- **Pods out of date** — `cd ios/App && pod install`.
- **Gradle JDK error** — Android Studio → Settings → Build Tools → Gradle → JDK 17.
- **RevenueCat purchases fail in simulator** — purchases require a real device + sandbox tester (iOS) or licensed tester account (Android).
- **Deep link doesn't open the app** — confirm the URL scheme in `Info.plist`/`AndroidManifest.xml` matches `VITE_APP_URL_SCHEME` and that Supabase Auth → Additional Redirect URLs includes the custom-scheme URL.
- **`Unauthorized` from `ai-handoff`** — user isn't signed in or the bearer middleware isn't attached. Confirm sign-in flow works first.
