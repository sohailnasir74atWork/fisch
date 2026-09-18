# Steal an Egg Values — setup checklist

Fresh React Native 0.87.1 scaffold (New Architecture + Hermes), with mm2values'
`Code/` tree ported across. Bundle id **com.fischvaluescalc** on both platforms.

## Done (no action needed)

- RN 0.87.1 / React 19.2.3 scaffold, bundle id set on Android + iOS
- All 54 dependencies installed, pinned to mm2values' known-good versions
  (only `react-native`, `react-native-worklets` 0.12.2 and
  `react-native-nitro-modules` 0.37.1 moved, because reanimated 4.6 — the
  0.87-compatible line — hard-requires worklets 0.12.x)
- `Code/` (169 files, ~74k lines), `App.js`, `index.js`, `i18n.js`, assets,
  Firebase rules/indexes, `functions/`, `scripts/` copied over
- **JS bundles clean on 0.87.1** — verified, zero errors
- Android: Firebase + Crashlytics gradle plugins, notifee maven repo,
  vector-icons fonts, ABI filters (incl. x86_64 — the SoLoader crash fix),
  proguard on for release, permissions, bootsplash + notification resources
- iOS: Podfile with static frameworks + `$RNFirebaseAsStaticFramework`,
  deployment target floor 15.1, purpose strings written as real sentences
- `edgeToEdgeEnabled=false` — RN 0.87 flips this default to `true`, which would
  push content under the status bar on every screen in the ported UI
- **Deleted the template's empty `NSLocationWhenInUseUsageDescription`** — an
  empty purpose string is the auto-rejection you hit before, and this app
  never uses location
- `Code/config/game.js` added as the single place for per-game values

## Your part

### 1. Firebase — DONE except SHA fingerprints and rules
Project `stealanegg-5ac52` (number 935991110555). Both config files are
installed and verified against `com.fischvaluescalc`; RTDB and Storage are
provisioned. The iOS `REVERSED_CLIENT_ID` is wired into `Info.plist`.

Still yours:

- **Register SHA fingerprints.** The installed `google-services.json` contains
  only a `client_type: 3` (web) OAuth client and **no certificate hash**, which
  means no SHA-1 is registered yet. Google Sign-In on Android will fail with a
  silent `DEVELOPER_ERROR` until you add these in Firebase console ->
  Project settings -> your Android app, then re-download the file:

      debug SHA-1:   5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25
      debug SHA-256: FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C

  Add the **release** keystore's fingerprints too, once that keystore exists.
- Confirm these are enabled: Authentication (Google, Apple, Anonymous),
  Firestore, Cloud Messaging, Crashlytics.
- Deploy the rules already in the repo (`database.rules.json`,
  `firestore.rules`, `firestore.indexes.json`) to the new project before the
  app goes anywhere near real users. They are the hardened MM2 set.

### 2. AdMob
- Create an AdMob app for `com.fischvaluescalc` on each platform.
- Put the two app ids in `app.json` (currently Google's **test** ids — the app
  runs, but serves test ads only).
- Put the ad unit ids in `Code/Ads/ads.js`.
- Do not paste MM2's ids: revenue would be attributed to the MM2 AdMob app.

### 3. Google / Apple Sign-In
- iOS `CFBundleURLTypes` / `REVERSED_CLIENT_ID`: **done**, taken from the
  installed `GoogleService-Info.plist`.
- Android still needs the SHA fingerprints registered — see section 1.
- Enable **Sign in with Apple** for the app id in the Apple Developer portal
  and add the capability in Xcode. Apple requires it wherever Google Sign-In
  is offered.

### 4. RevenueCat + Mixpanel
- New RevenueCat project, products, entitlements; public SDK keys into the app.
- Mixpanel project token.

### 5. Android release keystore
Left as is, per your call — MM2 untouched, and this project stays on debug
signing. Nothing to do until you want release builds; tell me which keystore
to use then.

### 6. The values data pipeline — the real new work
- `Code/config/game.js` -> `cdn.values` is `null`; the values screen has no
  data until it points somewhere.
- Create a Bunny CDN zone for this app and publish `{ meta, data }` to it, the
  same shape mm2values consumes.
- `scraper.js` is still MM2's (it scrapes mm2values.com). It needs rewriting
  for a Steal an Egg source. Note that Steal an Egg has **no official value
  list** — the community prices pets by income/sec x rarity x mutation — so
  decide which source is authoritative before building the scraper.
- Keep an old path alive as a copy if these URLs ever move: a shipped build
  cannot be re-pointed.

### 7. Branding
Currently MM2's artwork, as placeholders:
- `android/app/src/main/res/mipmap-*/` — launcher icons
- `android/app/src/main/res/drawable-*/bootsplash_logo.png`
- `android/app/src/main/res/drawable-*/ic_notification.png`
- `assets/` — `MM2logo.webp`, `logo.png`, `logo.webp`
- Confirm the display name: currently **"Steal an Egg Values"**.

### 8. Legal / store
- A privacy policy URL **for this app**. The ported code points at
  `bloxfruitscalc.com/privacy-policy/` in 13 places — inherited from an
  earlier fork, and wrong for this app in store review.
- Play Console + App Store Connect listings.

## Known inherited residue

The ported code carries 116 `bloxfruitscalc.com` URLs (77 of them the default
avatar), plus store links pointing at four different apps. These came from the
earlier copy-paste forks. `Code/config/game.js` exists to centralise them;
migrating the call sites to it is follow-up work, tracked but not yet done.
