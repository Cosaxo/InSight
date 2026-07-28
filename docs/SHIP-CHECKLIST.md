# Ship checklist — from green builds to phones

Phase-5 state: the code side is done — the app renders frameless with
safe-area insets on any phone-sized screen or native shell, reveal push
notifications are wired end-to-end (server send + client registration),
and the account/privacy panel (name, Google linking, truthful sharing
explainer, delete) lives at the top of the profile. What remains is
account-gated and device-gated work only a human can do.

## 1 · Seed production (5 minutes, once)

The deployed backend is live but the question bank is empty until an
operator seeds it:

1. Run the app once against production (any build with `VITE_FIREBASE_*`
   set and `VITE_V2_LIVE=true`) and copy your uid — it's shown by
   `window.LIVE.uid` in the browser console, or in Firebase Console →
   Authentication.
2. Set that uid as the `SEED_ADMIN_UIDS` variable on the **production**
   environment (GitHub → Settings → Environments → `production` →
   Variables), then re-run **Deploy Firebase backend** via
   `workflow_dispatch`. The deploy writes `functions/.env.prvfire33` from
   that variable, so the uid reaches the deployed runtime.
   Comma-separate for several operators.

   > Not a committed file: `.env` and `.env.*` are gitignored (including
   > under `functions/`), so the value cannot travel in the repo — the
   > workflow variable is the only path. A deploy with the variable unset
   > still succeeds but logs a warning, and every operator callable stays
   > `permission-denied`.
3. From the app's console:
   `firebase.functions().httpsCallable("seedContentV2")()` — or simply
   tap through any flow that calls it; 191 questions land in
   `v2_questions`. Re-running is safe (idempotent, never resets the
   `active` kill switch).

## 2 · Native Firebase config files (account-gated)

Both apps must be registered under `com.cosaxo.insight`:

- **Android** — Firebase Console → Project settings → Add app →
  Android → download `google-services.json` → drop into `android/app/`.
  This also activates FCM delivery for reveal pushes.
- **iOS** — Add app → iOS → download `GoogleService-Info.plist` → add to
  `ios/App/App/` in Xcode (add to target), and set the
  `REVERSED_CLIENT_ID` in `Info.plist` for native Google sign-in.
  For push: Apple Developer → Keys → create an APNs key and upload it in
  Firebase Console → Cloud Messaging → Apple app configuration.
- **Enable the provider** — Firebase Console → Authentication → Sign-in
  method → enable **Google** (and keep **Anonymous** enabled; D3 depends
  on it). The client side is wired: `capacitor.config.ts` declares
  `providers: ["google.com"]` and `android/variables.gradle` sets
  `rgcfaIncludeGoogle = true`. Both are required — without the Gradle
  flag the Google libraries are `compileOnly`, so an Android build
  compiles and ships but throws the moment anyone taps *Link Google*.
- Run `npm run sync` after any `capacitor.config.ts` change — the native
  shells read the copied config, not this file.

## 3 · Store accounts & builds (device-gated)

- Apple Developer Program (~2 days to approve — start early) and a Mac
  with Xcode for the iOS build; Play Console for Android.
- Build flow: `npm run build && npx cap sync`, then open the native
  projects (`npm run ios` / `npm run android`), set signing, archive.
- TestFlight / internal testing track for the five-friend test.

## 4 · On-device verification list (first build)

- [ ] App opens frameless, header clear of the notch, dock clear of the
      home indicator (light + dark).
- [ ] Anonymous session survives app restarts (same uid, map intact).
- [ ] Link Google from the privacy panel; reinstall the app; sign in —
      history restored.
- [ ] Create a duo on one phone, join by code on another, both seal —
      after the next UTC midnight the reveal push arrives and opens the
      app.
- [ ] Daily vote → payoff → "added to your map" → dot on the Mirror.
- [ ] Delete account from the panel: profile, answers, and memberships
      gone (check Firestore console).

## 5 · Post-deploy ops toggles

- **TTL for the aggregate event ledger** (one-time, console or gcloud):
  `gcloud firestore fields ttls update expireAt --collection-group=v2_agg_events --enable-ttl --project=prvfire33`
  — the trigger stamps `expireAt` (+7 days); without the policy the
  dedup ledger grows forever (harmless, but why pay for it).
- **Release versioning:** bump `appBuild` in package.json each store
  release; set `latestBuild` (soft banner) and, only when an old client
  would misbehave, `minBuild` (hard gate) plus `updateUrl` on the
  `v2_meta/app` doc in the console.

## Before-public hardening (not friends-test blockers)

- **FCM token binding** — token registration should move behind a
  callable that verifies token↔uid; today a stolen token could be
  planted on another account for reveal-push spam (needs the victim's
  token, so friend-scale risk is nil).
- **App Check enforcement** — the callables enforce it in prod
  (functions/src/ops.ts, `ENFORCE_APP_CHECK`; set the `APPCHECK_ENFORCE`
  production variable to `false` to soft-disable during an incident).
  A production **web** build with Firebase configured but no
  `VITE_APPCHECK_RECAPTCHA_SITE_KEY` now fails the build rather than
  shipping unattested (`vite.config.ts`); native bundles set
  `CAPACITOR_BUILD=1` and need no key (DeviceCheck / Play Integrity).

  Console steps, in this order — enforcement is not reversible without a
  window where clients fail:
  1. **Register the web app as a reCAPTCHA provider** in Firebase Console
     → App Check. This is separate from setting the site key in the build:
     the key is the client half, the registration is the server half, and
     having only one of them looks identical to having neither.
  2. Register the iOS (DeviceCheck/App Attest) and Android (Play
     Integrity) apps.
  3. Ship builds carrying attestation, then watch App Check → Metrics for
     **24–48h**. Verified requests should approach 100% before anything
     is enforced; anything else means a platform is misconfigured.
  4. Only then flip enforcement for Firestore, then Storage.
- **iOS reveal push — Mac-side finish.** The structural pieces are now
  committed: Package.swift lists the real plugin set (push-notifications,
  app-check, sentry), AppDelegate bridges APNs → Firebase Messaging and
  posts the **FCM** token to the Capacitor plugin, FirebaseCore +
  FirebaseMessaging are linked to the App target, and
  `App/App.entitlements` carries `aps-environment` (wired via
  `CODE_SIGN_ENTITLEMENTS`). What still needs a Mac + console:
  1. Drop `GoogleService-Info.plist` into `ios/App/App` and add it to
     the App target (it is intentionally untracked; AppDelegate skips
     `FirebaseApp.configure()` without it). Replace the
     `REVERSED_CLIENT_ID` placeholder in Info.plist from the same file.
  2. Xcode → Signing & Capabilities: confirm the Push Notifications
     capability shows up from the entitlements file and the
     provisioning profile regenerates with `aps-environment`.
  3. Apple Developer → upload the APNs key to Firebase (step already
     listed above), then verify the reveal flow end-to-end on device.
- **Reveal membership snapshot — second deploy still owed.** Reveal reads
  are gated on a group's *current* `memberUids`, so joining a group today
  exposes every past day's votes and display names, including those of
  members who have since left. The fix is two deploys, and only the first
  has shipped:
  1. **Done** — `revealGroupDay` now writes a `members` array onto each
     reveal doc (functions/src/v2social.ts).
  2. **Owed** — once that function is live in production *and* the
     backfill decision is made for reveals written before it, change the
     `v2_groups/{gid}/reveals/{day}` read rule to gate on
     `resource.data.members` instead of the parent group's `memberUids`,
     and stop surfacing `permission-denied` in the client's reveal
     listener so a late joiner does not generate a Sentry firehose.

  Do **not** collapse these into one deploy: a released ruleset applies
  instantly while gen2 functions roll out over minutes, so reveals written
  in that window would carry no `members` field and be permanently
  unreadable by their own members.
- **Storage bucket — confirm empty, then lock down.** `storage.rules` was
  configured in `firebase.json` and deployed by nothing; the deploy
  workflow now applies it as its own step (watch that step's outcome — it
  is `continue-on-error`, because `storage:rules` fails outright on a
  project with no bucket provisioned). The only path it grants,
  `users/{uid}/dailyPhotos/`, backed the v1 daily-report photo backup,
  removed in D4. Before locking it to a catch-all deny:
  1. Check whether a bucket exists and whether it holds any objects
     (Firebase Console → Storage).
  2. If objects exist, delete them first. `deleteAccount` does **not**
     touch Storage, so revoking access while objects remain converts a
     dead feature into an erasure gap — the data survives with no path
     to remove it on request.
  3. Only then reduce `storage.rules` to the catch-all deny, and update
     `firestore-tests/storage.rules.test.ts` in the same commit.
- **Verify the archive's APNs environment.** `App.entitlements` now reads
  `$(APS_ENVIRONMENT)` — development for Debug, production for the App
  target's Release. The build settings are the fix; *this check* is what
  catches it, because the failure is silent (the device registers with the
  APNs sandbox, FCM sends to production, nobody errors and no push
  arrives). On the archived app, before uploading:

  ```bash
  codesign -d --entitlements :- /path/to/App.app | grep -A1 aps-environment
  ```

  It must say `production`. If it is empty, `APS_ENVIRONMENT` is not
  reaching the target — it is defined at project level for both
  configurations precisely so it cannot expand empty.
- **Signing material never enters the repo.** `.gitignore` covers
  `*.keystore`, `*.jks`, `*.p12`, `*.p8`, `*.mobileprovision`,
  `keystore.properties`, `signing.properties`, plus both Firebase config
  files — but ignore rules do nothing for a file already tracked, so:
  1. Keep the upload keystore **outside the repo** entirely. The
     `.gitignore` entries are a backstop, not the plan.
  2. Enrol in **Play App Signing** so Google holds the app signing key and
     a lost upload key is recoverable.
  3. Before the first release commit, run `git status --ignored` and
     confirm nothing sensitive is tracked. A `git add -A` after a signing
     session is an incident a revert cannot fix — the object stays in
     history and the key must be rotated.
- **Sign in with Apple (guideline 4.8) — prepared, not built.** Google is
  currently the only third-party sign-in on iOS, which 4.8 says must be
  accompanied by an equivalent privacy-preserving option. We expect to
  pass without it, because the app's *primary* path is anonymous: no
  account is required, nothing is requested, and Google is an optional
  upgrade rather than a login wall. If a reviewer cites 4.8, reply with
  that, and note the app collects no email or name via Google either.

  Only if they insist: add the Apple provider. Enable the capability in
  the developer portal **before** committing the entitlement, and use
  `rawNonce` when exchanging the credential or `linkWithCredential` fails.
  Do not pre-build this — an unused sign-in path is its own review
  surface.
- **Version lockstep** — bump package.json `appBuild` + android
  `versionCode` + iOS `CURRENT_PROJECT_VERSION` together each release.

- **Discoverable location scrub** — rules now cap
  `insight_discoverable` writes to a bare geohash5 cell (no exact
  GeoPoint, no long hashes). Docs written before that rule may still
  carry `location.geopoint` / full-precision hashes: run a one-time
  admin scrub that truncates `location.geohash` to 5 chars and
  deletes `location.geopoint` on every doc.

## Known deferrals (tracked, not blockers)

- ~~Functions runtime Node 20 → upgrade before 2026-10-30
  decommission.~~ Done: nodejs22 + firebase-functions v6 +
  firebase-admin v13. Verify the first scheduled runs after deploy.
- `onV2AnswerCreated` region (us-central1) vs Firestore (eur3) — works,
  cross-region hop; relocate when convenient (requires delete+recreate
  of the trigger).
- Ranking/scale feed card types; Circle/Near mirror population fields
  (need geo opt-in + circle data); world comments are OUT by decision D1.
- Bundle is one ~900KB chunk — split after the feature surface settles.
