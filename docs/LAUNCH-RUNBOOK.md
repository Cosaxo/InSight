# Launch runbook — the owner's ordered list

Everything between this tree and two live store listings, in the order it
has to happen, with the command or console path for each step. Nothing
here is engineering work: the code side is complete (LAUNCH-PLAN.md's
workstreams all landed in PR #60), so every remaining step needs an
account, a device, a Mac, or a legal fact.

**This document holds order and status only.** Every *why* lives in
[`SHIP-CHECKLIST.md`](SHIP-CHECKLIST.md), which stays canonical — where the
two disagree, the checklist wins and this file is stale. Steps below cite
the section that explains them; read that before doing anything whose
reasoning is not obvious, especially the App Check ordering (§ hardening)
and the reveal/rules deploy order.

State verified 2026-08-03: `npm run check:store-copy` reports **6**
unfilled placeholders (three legal values, three account-gated IDs); the
daily bank is at 90 questions; the production backend is deployed.

## Two clocks you cannot compress

Everything else is initiative. These two are waiting, so start them on day
one and do the rest while they run:

1. **Google Play: 12 opted-in testers × 14 continuous days**, then a
   production-access application Google reviews in up to ~7 days. Personal
   developer accounts created after 2023-11-13 cannot ship to production
   without it; organization accounts (D-U-N-S) are exempt. "Opted in" means
   the tester accepted *and installed* — invited-not-installed does not
   count. The clock starts when a signed build reaches the closed track,
   not when the account opens. **Realistic Android floor: 3–4 weeks.**
2. **App Check: a 24–48h metrics soak** before enforcement is flipped.
   Registering the apps starts it; enforcement without it is how you find
   out a platform is misconfigured from users instead of a graph.

Apple has no equivalent gate — enrollment is ~1–2 days, review usually
24–48h. **iOS can be live in ~2 weeks; both stores in ~3–4.**

---

## Phase 0 — Do these first (about an hour, no accounts needed)

- [ ] **0.1 Seed the production question bank.** Signed in as the operator
      account, from the app's console:
      `firebase.functions().httpsCallable("seedContentV2")()`.
      369 questions land in `v2_questions`. Idempotent and, since D34,
      cheap to repeat — reseed whenever content lands. `SHIP-CHECKLIST §1`.
      *Until this runs the deployed backend serves an empty app, so it
      blocks every screenshot and every tester.*
- [ ] **0.2 Confirm the hosting pages are actually live.** Open
      `https://prvfire33.web.app/privacy.html` and
      `https://prvfire33.web.app/`. Both store listings require these
      URLs. The hosting step of *Deploy Firebase backend* is
      `continue-on-error`, so a green workflow run does **not** mean the
      pages deployed — read that step's log. If it failed for want of a
      default site, create one in Firebase Console → Hosting and re-run.
      `SHIP-CHECKLIST §3`.
- [ ] **0.3 Fill the three legal values in `web/terms.html`** — support
      email, legal entity name, country/state. As a sole trader these are
      answerable today; waiting on incorporation is the one thing that can
      silently add weeks. The support address is not cosmetic:
      `web/privacy.html` routes GDPR erasure requests to it, so until it is
      real a user exercising a legal right lands on a bracket. Redeploy
      hosting after editing. `SHIP-CHECKLIST §3`.

## Phase 1 — Day 1: open the accounts, start both clocks

- [ ] **1.1 Apple Developer Program — enroll as an *individual*** ($99/yr,
      ~1–2 days). Convertible to an organization later; enrolling as an org
      first costs 1–2 weeks of entity + D-U-N-S verification for nothing
      launch needs. Start it before anything else on this list.
- [ ] **1.2 Google Play Console account** ($25 one-time, identity check).
      Open it today even though the build is days away — the account has
      to exist before a build can start the 14-day clock.
- [ ] **1.3 Firebase Console → Authentication → Sign-in method:** enable
      **Google**, and confirm **Anonymous** stays enabled (D3's entire
      first-run path depends on it). `SHIP-CHECKLIST §2`.
- [ ] **1.4 Firebase Console → App Check: register all three apps** — web
      (reCAPTCHA provider), iOS (DeviceCheck/App Attest), Android (Play
      Integrity). Do this on day 1 so the soak overlaps the rest of the
      work. **Register, do not enforce yet** — enforcement is step 3.4.
      Registering the web app is separate from setting the site key in the
      build; having one without the other looks identical to having
      neither. `SHIP-CHECKLIST § hardening`.

## Phase 2 — Wire the native builds (needs Phase 1 accounts + a Mac)

- [ ] **2.1 Android config.** Firebase Console → Project settings → Add app
      → Android, package `com.cosaxo.insight` → download
      `google-services.json` → drop into `android/app/`. This also
      activates FCM for reveal pushes. Gitignored on purpose — never commit
      it. `SHIP-CHECKLIST §2`.
- [ ] **2.2 iOS config.** Add app → iOS → download
      `GoogleService-Info.plist` → add to `ios/App/App/` **and to the App
      target in Xcode** (AppDelegate skips `FirebaseApp.configure()`
      without it). Then copy that file's `REVERSED_CLIENT_ID` over the
      `REPLACE_WITH_REVERSED_CLIENT_ID` placeholder in `Info.plist`.
      *Skipping the URL scheme is silent:* the build succeeds, the account
      sheet opens, and Google sign-in never returns — taking D3's only
      account-upgrade path with it. `SHIP-CHECKLIST §2`.
- [ ] **2.3 APNs key.** Apple Developer → Keys → create an APNs key →
      upload in Firebase Console → Cloud Messaging → Apple app
      configuration. Without it no reveal push arrives on iOS.
- [ ] **2.4 First iOS archive** (Mac + Xcode). `npm run build && npx cap
      sync`, then `npm run ios`. Signing & Capabilities: confirm Push
      Notifications appears from the entitlements file and the provisioning
      profile regenerates with `aps-environment`. Archive.
- [ ] **2.5 Verify the archive's APNs environment before uploading:**
      ```bash
      codesign -d --entitlements :- /path/to/App.app | grep -A1 aps-environment
      ```
      It must say `production`. This failure is completely silent — the
      device registers with the APNs sandbox, FCM sends to production,
      nothing errors and no push ever arrives. `SHIP-CHECKLIST § hardening`.
- [ ] **2.6 Android signing.** Generate the upload keystore **outside the
      repo**, and **enrol in Play App Signing** so a lost upload key is
      recoverable. Before the first release commit run `git status
      --ignored` and confirm nothing sensitive is tracked — a `git add -A`
      after a signing session is an incident a revert cannot fix.
      `SHIP-CHECKLIST § hardening`.
- [ ] **2.7 The two app-link fingerprints.** Play Console → Setup → App
      signing gives the SHA-256 for
      `web/.well-known/assetlinks.json`; Apple Developer → Membership gives
      the Team ID for `web/.well-known/apple-app-site-association`.
      Replace both, redeploy hosting, reinstall, tap a `/join/CODE` link.
      Android verifies with `adb shell pm get-app-links com.cosaxo.insight`;
      iOS re-fetches AASA on install (CDN-cached, allow a day). Until then
      invite links open the fallback page — degraded, not broken, so this
      does not block submission. `SHIP-CHECKLIST §3b`.

## Phase 3 — The testing tracks (the clocks run here)

- [ ] **3.1 Upload a signed AAB to the Play closed track the day you have
      one.** This is what starts the 14 days. Recruit **12+ testers who
      actually install**; churn mid-window resets nothing but a drop below
      12 pauses progress.
- [ ] **3.2 TestFlight with ten testers, not five.** The public mirror
      publishes once per 5 answers (D7), so a group of 6–9 watches the
      world count sit on "5+" and never move — accurate, and it reads as
      broken. Test **duels first**: they work at N=2, need no crowd, and
      are the most distinctive surface in the product. `SHIP-CHECKLIST §3`.
- [ ] **3.3 Walk the on-device verification list** — six checks, first
      build, `SHIP-CHECKLIST §4`: frameless layout in light+dark, anonymous
      session surviving restart, Google link → reinstall → history
      restored, cross-device duo reveal + push, daily vote → map dot,
      account deletion actually emptying Firestore.
- [ ] **3.4 Only after 24–48h of App Check metrics showing verified
      requests near 100%,** flip enforcement — Firestore first, then
      Storage. Not reversible without a window where clients fail. The
      callables already enforce in prod; `APPCHECK_ENFORCE=false` on the
      production environment is the incident switch.
      `SHIP-CHECKLIST § hardening`.

## Phase 4 — Build the listings (do this while the clocks run)

- [ ] **4.1 Screenshots — capture in LIVE mode against seeded production,
      after real answers exist.** The TestFlight week is the natural
      moment: ten testers put real k-floored splits on screen. Five screens
      are worth showing — today's question, a reveal split, the Mirror map,
      a duel reveal, the logic test mid-puzzle. A Playwright harness
      against the web build at store viewports renders the same React tree
      the shells wrap, so those are honest app pixels. Demo mode is the
      fallback and its honesty badges will show. `LAUNCH-PLAN.md` §store
      chain.
- [ ] **4.2 Play feature graphic (1024×500)** — generate from
      `design/icon/mark.svg` + wordmark + tagline, the way
      `scripts/gen-icons.mjs` rasterises the launcher set. A build
      artifact, not a photoshoot.
- [ ] **4.3 Marketing copy** — title, subtitle, description, keywords, for
      both stores. The one launch item with no repo material at all.
- [ ] **4.4 Privacy nutrition labels (Apple) + Data safety form (Google).**
      Mandatory; neither store accepts a submission without one. Answer
      from the table in `SHIP-CHECKLIST §3`, which is
      `docs/data-inventory.md` translated into their categories. The three
      that bite: **Tracking = No** (no IDFA, no ATT prompt, no ad SDK of
      any kind — the Facebook SDK is stripped at postinstall and asserted
      by `check:ios-facebook`); **Coarse location = Yes, optional, never
      Precise** (precise is unobtainable by construction, and the reason is
      written down if a reviewer asks); **Sensitive info = Yes** (the
      politics result is GDPR Art. 9 data — the form asks what you
      *collect*, not what you publish).
- [ ] **4.5 Age rating / IARC questionnaire.** Answer it deliberately —
      the politics test and user display names in group reveals are the
      inputs that need care. Likely 12+/Teen.

## Phase 5 — Production hygiene before the app is public

- [ ] **5.1 Enable TTL on the aggregate event ledger** (one-time):
      ```bash
      gcloud firestore fields ttls update expireAt \
        --collection-group=v2_agg_events --enable-ttl --project=prvfire33
      ```
      Without it the ledger grows forever. `SHIP-CHECKLIST §5`.
- [ ] **5.2 Confirm the Authentication billing edition** — 30 seconds in
      the console, and the largest unknown on the bill. Anonymous-first
      means every install becomes an authenticated identity: free forever
      on Firebase Authentication, MAU-priced on Identity Platform. At 1.5M
      MAU that is $0 vs ~$6,015/month for zero code difference. Cloud
      Console → Billing → Reports grouped by service is the unambiguous
      check. Record the answer next to `SHIP-CHECKLIST §5`.
- [ ] **5.3 Scrub the dead v1 collection:**
      ```bash
      node scripts/scrub-v1-discoverable.mjs --project prvfire33          # report
      node scripts/scrub-v1-discoverable.mjs --project prvfire33 --apply  # delete
      ```
      It holds Big Five, politics, age, bio and display names with no
      writer and no reader. The store privacy answers are gated on this
      having run. `SHIP-CHECKLIST § hardening`.
- [ ] **5.4 Storage bucket: check, empty, then lock down.** Firebase
      Console → Storage. If objects exist under `users/{uid}/dailyPhotos/`,
      delete them **before** reducing `storage.rules` to a catch-all deny —
      `deleteAccount` does not touch Storage, so revoking access while
      objects remain converts a dead feature into an erasure gap. Update
      `firestore-tests/storage.rules.test.ts` in the same commit.
- [ ] **5.5 Apply the one monitoring alert** (`monitoring/onV2AnswerCreated-errors.json`)
      — create a notification channel, then the policy. It is not applied
      by the pipeline. This is the failure that looks like nothing from the
      outside: the app keeps serving while the Mirror stops moving.
      `DEPLOYMENT.md § Alerting`.
- [ ] **5.6 Version lockstep.** `npm run check:versions` (`--fix` writes
      package.json's values into both native projects). Bump `appBuild` +
      android `versionCode` + iOS `CURRENT_PROJECT_VERSION` together for
      every release.

## Phase 6 — Submit

- [ ] **6.1 Pre-flight, before every archive and every upload:**
      ```bash
      npm run check:store-copy   # must exit 0 — deliberately NOT in CI
      npm run check:versions
      npm run build && npx cap sync
      ```
- [ ] **6.2 Submit to App Store review.** Budget one rejection round on
      guideline 4.8 (Sign in with Apple). **Do not pre-build it** — the
      reply is already drafted in `SHIP-CHECKLIST § hardening`: the app's
      primary path is anonymous, no account is required, Google is an
      optional upgrade rather than a login wall, and no email or name is
      collected through it. Only add the Apple provider if a reviewer
      insists.
- [ ] **6.3 Apply for Play production access** once the 14 days complete —
      a three-section application, reviewed in up to ~7 days. Then submit
      the production release.

## Not blockers — these can trail the launch

- **Device binding enforcement (D29).** Four owner steps in
  `docs/DEVICE-BIND.md`: DeviceCheck key → deploy env vars; Play Integrity
  linkage; the two native token bridges; then flip `deviceBindEnforced()`
  in `firestore.rules` to `true`. Until the flip the claim is stamped but
  not demanded — soft-enforced, which is a working state.
- **Sign in with Apple.** See 6.2 — only if a reviewer cites 4.8.
- **The `check:store-copy` app-link placeholders** (2.7) block *linking*,
  not *shipping*.
- Everything in `SHIP-CHECKLIST § Known deferrals`.

---

## Sources for the store-policy claims

- [App testing requirements for new personal developer accounts — Play Console Help](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)
- [Google Play closed testing: 12 testers, 14 days](https://www.testerscommunity.com/google-play-closed-testing)
