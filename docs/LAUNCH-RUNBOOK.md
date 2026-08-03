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

State verified 2026-08-03: `npm run check:store-copy` reports **3**
unfilled placeholders, all account-gated IDs (the three legal values were
filled the same day); `check:store-listing` and `check:versions` pass; the
daily bank is at 90 questions; the production backend is deployed.

## Two clocks you cannot compress

Everything else is initiative. These two are waiting, so start them on day
one and do the rest while they run:

1. **Google Play: the D-U-N-S wait** — because the account opens as an
   **organization** (D41), which is exempt from the closed-testing gate
   personal accounts face. What is left is the entity chain: ENK →
   organisasjonsnummer → D-U-N-S → Google's org verification, then a
   production-access application reviewed in up to ~7 days. A D-U-N-S is
   free and usually lands in ~1–2 weeks, but D&B quotes up to ~30 business
   days. **Start it on day one — it is the long pole, and it is pure
   waiting.**

   *The path this replaces, kept because the fallback is real:* a personal
   account created after 2023-11-13 must run **12 opted-in testers × 14
   continuous days** on a closed track first. "Opted in" means accepted
   *and installed*, the 14 days are continuous, and dropping below 12
   restarts them — so 3–4 weeks is that path's floor, not its estimate. If
   the org exemption does not hold when you reach the account-type flow,
   this is where you land, having lost only a wait that overlapped Apple's.
2. **App Check: a 24–48h metrics soak** before enforcement is flipped.
   Registering the apps starts it; enforcement without it is how you find
   out a platform is misconfigured from users instead of a graph.

Apple has no equivalent gate — enrollment is ~1–2 days, review usually
24–48h. **iOS can be live in ~2 weeks; both stores in ~3–4**, and the iOS
date does not depend on which way Play's account type resolves.

---

## Phase 0 — Do these first (about an hour, one console)

- [ ] **0.1 Seed the production question bank — but do 1.3 first.** Signed
      in as the operator account, from the app's console:
      `firebase.functions().httpsCallable("seedContentV2")()`.
      369 questions land in `v2_questions`. Idempotent and, since D34,
      cheap to repeat — reseed whenever content lands. `SHIP-CHECKLIST §1`.
      *Until this runs the deployed backend serves an empty app, so it
      blocks every screenshot and every tester.*

      **This step is not account-free, which earlier drafts had wrong.**
      `seedContentV2` throws `unauthenticated` without `request.auth` and
      then gates on a uid in `SEED_ADMIN_UIDS` (`functions/src/ops.ts`) —
      the maintainer's **Google-account** uid. With no sign-in provider
      enabled in Firebase Auth there is no way to be that uid, so **1.3
      is this step's precondition**, not a parallel task. Nothing else in
      Phase 0 depends on it; do 1.3, then come back here.
- [ ] **0.2 Confirm the hosting pages are actually live.** Open
      `https://prvfire33.web.app/privacy.html` and
      `https://prvfire33.web.app/`. Both store listings require these
      URLs. The hosting step of *Deploy Firebase backend* is
      `continue-on-error`, so a green workflow run does **not** mean the
      pages deployed — read that step's log. If it failed for want of a
      default site, create one in Firebase Console → Hosting and re-run.
      `SHIP-CHECKLIST §3`.
- [x] **0.3 Fill the three legal values in `web/terms.html` — done
      2026-08-03.** `olaftaule01@gmail.com`, operator Olaf Taule,
      jurisdiction Norway, launching as a sole trader.
      `check:store-copy` dropped from 6 placeholders to 3, and the
      remaining three are all account-gated IDs from Phases 1–2.
      **Still owed: redeploy hosting** so the live page shows the filled
      values — the committed file is not what a store reviewer reads.
      `SHIP-CHECKLIST §3` also notes one EEA follow-up that is a decision,
      not a blocker.

## Phase 1 — Day 1: open the accounts, start both clocks

- [ ] **1.1 Apple Developer Program — enroll as an *individual*** ($99/yr,
      ~1–2 days). Convertible to an organization later; enrolling as an org
      first costs 1–2 weeks of entity + D-U-N-S verification for nothing
      launch needs. Start it before anything else on this list. **This
      reasoning is Apple-only** — it inverts on Play, which is why 1.2 goes
      the other way (D41).
- [ ] **1.1b Register the ENK and apply for the D-U-N-S — day one, before
      1.2.** Notify Brønnøysundregistrene via Altinn; registration in
      Enhetsregisteret is free and yields the organisasjonsnummer a D-U-N-S
      application needs. The D-U-N-S itself is free from D&B, usually ~1–2
      weeks, quoted up to ~30 business days. Everything else on this list
      runs while it waits. `D41`.
- [ ] **1.2 Google Play Console account — open it as an *organization*,
      not personal** ($25 one-time, identity check). The organization type
      is exempt from the 12-testers × 14-days closed-testing gate; a
      personal account created after 2023-11-13 is not, and that is a 3–4
      week floor (D41). Needs the D-U-N-S from 1.1b, so this step waits on
      that one — which is the whole reason 1.1b is a day-one task.

      **Do not open a personal account "to get started".** Sources
      disagree on whether Play Console converts personal → organization at
      all, and the ones that say it does disagree on whether the testing
      requirement follows the converted account. Picking organization at
      creation costs nothing and makes the question moot; the fallback if
      you pick wrong is a second account plus an app transfer.

      **Confirm the exemption in the account-type flow before paying for a
      D-U-N-S expedite.** D41 records why: the claim is sourced from
      secondary write-ups rather than Google's own policy page, which the
      research environment could not reach.
- [ ] **1.3 Firebase Console → Authentication → Sign-in method:** enable
      **Anonymous** AND **Google**. Earlier drafts said "confirm Anonymous
      stays enabled" — measured 2026-08-03 (anonymous sign-up returns
      `ADMIN_ONLY_OPERATION`): it was never on, so this is an enablement,
      not a confirmation. D3's entire first-run path depends on it, and
      the scorecard fetch (`QUESTION-FARM.md` Phase A) is blocked on the
      same switch. `SHIP-CHECKLIST §2`.
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

## Phase 3 — The testing tracks

Under D41 the Play clock no longer runs here — it runs in 1.1b, as the
D-U-N-S wait, and these tracks are for finding bugs rather than for
satisfying a gate. The App Check soak (3.4) is the one clock still in this
phase. On the personal-account fallback, 3.1 is also where the 14 days
start.

- [ ] **3.1 Upload a signed AAB to a Play testing track the day you have
      one.** With the organization account (D41) this is testing, not a
      gate — no tester minimum, no 14-day clock, and no reason to wait for
      a headcount before uploading. Use it the way TestFlight is used in
      3.2: real installs on real Android hardware, duels first.

      *If the org exemption did not hold and the account is personal:* this
      upload is what starts the 14 days, and it needs **12+ testers who
      actually install** — churn mid-window resets nothing, but a drop
      below 12 pauses progress.
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

The harness, the graphic and the copy all landed 2026-08-03 — what is
left here is a **recapture against live data**, plus the two forms.

- [ ] **4.1 Recapture the screenshots in LIVE mode.** The harness is
      built and committed:
      ```bash
      npm i -D playwright && npx playwright install chromium   # once
      npm run build && npm run build:screenshots
      ```
      Six scenes × both store sizes (1320×2868 and 1080×1920), asserted
      against the store specs at generation. **The committed captures are
      a demo preview, not the shipping set** — the harness names the one
      that must not be uploaded as-is (the reveal shows Comments and "Who
      voted", both `!S.live`-gated by D1, so no real user sees them on a
      live question — App Store 2.3.3). The TestFlight week is the moment
      to recapture: ten testers put real k-floored splits on screen.
      *Note the iPad set every guide lists does not apply —
      `TARGETED_DEVICE_FAMILY = 1`, iPhone only.*
- [ ] **4.2 Play feature graphic — done.** `npm run build:feature-graphic`
      → `design/store/feature-graphic.png`, 1024×500, built from
      `mark.svg` and the app's own stylesheet so it cannot drift from the
      palette. Regenerate if the mark or tagline changes.
- [ ] **4.3 Marketing copy — drafted, needs your read.**
      `design/store/listing.json` carries every field both consoles ask
      for; `npm run check:store-listing` holds each against its character
      limit (all currently fit, the longest at 161/170). Edit the voice to
      taste — it is a draft, not a decision. No placeholders remain:
      `shared.supportEmail` was filled with 0.3's address on 2026-08-03,
      and `check:store-listing` passes.
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
- [ ] **4.5 Age rating / IARC questionnaire.** The answers are now written
      down in `SHIP-CHECKLIST §3`, including the scan showing every
      *content* category is None and the three structural facts that
      actually drive the rating. Expect 12+/Teen. **Read the Apple 1.2
      table there before submitting** — the support email from 0.3 is a
      1.2 dependency, not only a GDPR one.

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
- [ ] **5.5 Apply the two monitoring alerts** (`monitoring/*.json`) — create
      a notification channel, then the error policy, then the
      `agg_contention` log-based metric and its policy. Neither is applied
      by the pipeline. Both cover failures that look like nothing from the
      outside: the app keeps serving while the Mirror stops moving, or
      keeps moving while falling further behind. `DEPLOYMENT.md § Alerting`.
- [ ] **5.6 Version lockstep.** `npm run check:versions` (`--fix` writes
      package.json's values into both native projects). Bump `appBuild` +
      android `versionCode` + iOS `CURRENT_PROJECT_VERSION` together for
      every release.
- [ ] **5.7 Add a second operator uid.** `SEED_ADMIN_UIDS` and `MOD_UIDS`
      each hold one uid, the same person's. Losing that Google account
      breaks nothing — the scheduled twins keep running and rules keep
      enforcing — but it removes the ability to seed content, force a
      reveal, or moderate, with no in-repo path back. Both variables are
      already comma-separated, so this is one edit each plus a re-run of
      **Deploy Firebase backend** (values only reach the runtime on a
      deploy). Keep the two lists **disjoint** (D22), and verify the new
      uid by confirming it is *denied* the instrument it should not have —
      a silently dropped uid looks identical to one never added.
      `DEPLOYMENT.md § Operator continuity`.

## Phase 6 — Submit

- [ ] **6.1 Pre-flight, before every archive and every upload:**
      ```bash
      npm run check:store-copy      # must exit 0 — deliberately NOT in CI
      npm run check:store-listing   # every field inside its store limit
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
- [ ] **6.3 Apply for Play production access** — a three-section
      application, reviewed in up to ~7 days, then submit the production
      release. On the organization account (D41) nothing gates this but the
      application itself; on the personal fallback it cannot be filed until
      the 14 days complete.

## Not blockers — these can trail the launch

- **Device binding enforcement (D29, D37).** Four owner steps in
  `docs/DEVICE-BIND.md`: DeviceCheck key → deploy env vars; Play Integrity
  linkage; the two native token bridges; then the flip. Until the flip the
  claim is stamped but not demanded — soft-enforced, which is a working
  state.

  **The flip is a sequence, not a moment** (D37, DEVICE-BIND §4): raise
  `v2_meta.minBuild` to the first activation-capable build **first** —
  it is a hard gate, so it empties the old-build population outright
  instead of waiting for it to shrink — then read two rates over 24h
  (activation errors **< 1%** with **zero** `DeviceCheck auth rejected`;
  Android `verdict without deviceRecall` **< 5%**), and only then set
  `deviceBindEnforced()` to `true`. Flipping early is silent: a refused
  answer write rolls the vote back with no message, so it reads as a flaky
  app rather than a refusal, and produces no report that names the cause.
- **Sign in with Apple.** See 6.2 — only if a reviewer cites 4.8.
- **The `check:store-copy` app-link placeholders** (2.7) block *linking*,
  not *shipping*.
- Everything in `SHIP-CHECKLIST § Known deferrals`.

---

## Sources for the store-policy claims

- [App testing requirements for new personal developer accounts — Play Console Help](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)
- [Choose a developer account type — Play Console Help](https://support.google.com/googleplay/android-developer/answer/13634885?hl=en)
- [Google Play closed testing: 12 testers, 14 days](https://www.testerscommunity.com/google-play-closed-testing)
- [Starting and registering a sole proprietorship — Altinn](https://info.altinn.no/en/start-and-run-business/planning-starting/registration-of-the-enterprise/starting-and-registering-a-sole-proprietorship/)

The two Play Console Help pages are the authority for D41's account-type
exemption and **neither was read directly** — the environment this was
researched from returned 403 at its proxy for every outbound host, so the
exemption is sourced from secondary write-ups. Read them before spending
money on a D-U-N-S expedite; D41 records the fallback if they say something
different.
