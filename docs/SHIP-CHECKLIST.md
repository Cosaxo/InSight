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
2. `cp functions/.env.example functions/.env`, put that uid in
   `SEED_ADMIN_UIDS=`, commit and push (CI redeploys the functions with
   the env baked in).
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

## Known deferrals (tracked, not blockers)

- Functions runtime Node 20 → upgrade before 2026-10-30 decommission.
- `onV2AnswerCreated` region (us-central1) vs Firestore (eur3) — works,
  cross-region hop; relocate when convenient (requires delete+recreate
  of the trigger).
- Ranking/scale feed card types; Circle/Near mirror population fields
  (need geo opt-in + circle data); world comments are OUT by decision D1.
- Bundle is one ~900KB chunk — split after the feature surface settles.
