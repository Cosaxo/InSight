# Launch runbook — the owner's ordered list

Everything between this tree and a live App Store listing, in the order it
has to happen, with the command or console path for each step. Nothing
here is engineering work: the code side is complete (LAUNCH-PLAN.md's
workstreams all landed in PR #60), so every remaining step needs an
account, a device, or a legal fact. **A Mac is no longer on that list** —
it was, and removing it was the last piece of engineering this file
required (`IOS-RELEASE.md`).

**This document holds order and status only.** Every *why* lives in
[`SHIP-CHECKLIST.md`](SHIP-CHECKLIST.md), which stays canonical — where the
two disagree, the checklist wins and this file is stale. Steps below cite
the section that explains them; read that before doing anything whose
reasoning is not obvious, especially the App Check ordering (§ hardening)
and the reveal/rules deploy order.

State verified 2026-08-05: `npm run check:store-copy` reports **1**
unfilled placeholder, and it is `REPLACE_WITH_PLAY_SIGNING_SHA256` — a
permanent non-blocker under D42, excused by `--ios`. **For an iOS launch
the count is zero**, which is a change from 2026-08-04: the Team ID and the
`REVERSED_CLIENT_ID` were the other two and both are filled.

`check:store-listing` and `check:versions` pass; the daily bank is at 90
questions of 389 seeded; the production backend is deployed. **Measured
2026-08-04:** anonymous sign-in works (`accounts:signUp` returns an
`idToken`, where it returned `ADMIN_ONLY_OPERATION` on 2026-08-03), the
InSight web app is registered, and the default hosting site `prvfire33`
exists. **Measured 2026-08-05:** the iOS release workflow archives,
exports and passes both gates with no Mac (run 6).

Those two question counts are held by `npm run check:figures` against
`functions/src/v2content.ts`, because a number quoted in prose and kept
current by intention is the one documentation error this repo keeps
re-committing (D39).

> ## iOS only, as of 2026-08-04 (D42)
>
> **Google Play is deferred**, and revisited after iOS has users rather
> than on a date. Every Android step below is marked **[PARKED]** — left
> in place, not deleted, because the shell still builds in CI and the work
> is real when it is picked up.
>
> The reason is not only cost. The two routes onto Play move in opposite
> directions over time: the organization account (D41) costs the same
> whenever it is taken, while the 12-testers × 14-days route is brutal
> cold and easy once you have users with Android phones. Deferring may
> convert the expensive option into the cheap one, and retire D41 unused.
> **Re-read D41 and D42 together at that moment; assume neither half.**

## One clock you cannot compress

Everything else is initiative. This one is waiting, so start it on day one
and do the rest while it runs:

1. **App Check: a 24–48h metrics soak** before enforcement is flipped.
   Registering the apps starts it; enforcement without it is how you find
   out a platform is misconfigured from users instead of a graph.

Apple has no gate of its own — enrollment is ~1–2 days, review usually
24–48h. **iOS can be live in ~2 weeks.**

**A Mac is no longer required.** It used to be the only hard dependency
left once D42 parked Play, so `.github/workflows/ios-release.yml` now does
the signed archive, the two silent-failure gates and the App Store Connect
upload on a macOS runner — see [`IOS-RELEASE.md`](IOS-RELEASE.md) for the
four values it needs. (`ios-build.yml` does **not** substitute: it is
deliberately simulator-only and unsigned, so the native project had
coverage before any Apple account existed.) A Mac is still the more
comfortable way to debug a signing failure.

**Measured 2026-08-05: it works.** Run 6 archived, exported and passed both
gates in 6m 2s — `archive aps-environment = production`, still `production`
in the exported `.ipa`, Firebase config in the bundle at both ends. It took
six dispatches, and the five failures are each worth one line because they
are the ones anyone repeating this will hit: a missing `VITE_FIREBASE_*`
(run 1 — a signed *demo* app), a manual signing identity conflicting with
automatic (2), automatic signing demanding a device the team does not have
(3), an App-Manager-role API key that cannot mint a distribution
certificate (4), and an unsigned archive that carried no entitlements for
export to forward (5). `IOS-RELEASE.md` has each in full.

**The upload half is still untried** — every run so far has been
`upload=false`, deliberately.

*[PARKED] Play's clock, for when this is picked up:* a personal account
created after 2023-11-13 must run **12 opted-in testers × 14 continuous
days** on a closed track before it can apply for production access —
"opted in" means accepted *and installed*, the days are continuous, and
dropping below 12 restarts them. An organization account skips it (D41),
at the price of the ENK → D-U-N-S chain. Both are in D42 with the
arithmetic.

---

## Phase 0 — Do these first (about an hour, one console)

- [x] **0.1 Seed the production question bank — DONE 2026-08-07**
      (`written 389, skipped 0`). Actions → **Seed content** → Run workflow;
      389 questions land in `v2_questions`. Idempotent and, since D34, cheap
      to repeat — **reseed whenever content lands**, which is the reason this
      stays a standing instruction rather than a ticked box.
      `SHIP-CHECKLIST §1`.

      **This was the first successful write to production Firestore, ever**,
      and getting there found that the backend had never worked: a `gaxios`
      override in `functions/package.json` broke credential fetch for every
      function, so `scheduledDuelReveals` had been failing every two hours
      unnoticed. The seed was simply the first thing that tried. A green run
      here therefore proves more than the bank — it proves the runtime can
      authenticate at all.
      *Until this runs the deployed backend serves an empty app, so it
      blocks every screenshot and every tester.* **It is also the only step
      that proves the operator gate works end to end**, so a green run here
      is worth more than its own output.

      **No longer blocked on 1.3, and no longer blocked on anything.**
      `seedContentV2` needs `request.auth` with a uid in `SEED_ADMIN_UIDS`
      (`functions/src/ops.ts`), which used to mean signing in as that
      Google account by hand. The workflow mints a token for the uid with
      the service-account key the deploy already uses, so the sign-in
      provider is no longer this step's precondition. It grants nothing
      new — that key deploys the rules protecting `v2_questions` — and it
      goes through the callable rather than writing the collection
      directly, so CI runs the same seeding path the app does.

      **Two earlier drafts of this step could not be performed as written.**
      The first named a `firebase.functions()...` call — v8 syntax on a
      modular-SDK app. The second said "from the app's browser console",
      and there is no browser build: hosting serves `web/` (home, join,
      privacy, terms) and the app ships only as the iOS shell. Both
      survived because running the instruction needed something nobody
      had. See the checklist.
- [ ] **0.2 Confirm the hosting pages are actually live.** Open
      `https://prvfire33.web.app/privacy.html` and
      `https://prvfire33.web.app/`. Both store listings require these
      URLs. The hosting step of *Deploy Firebase backend* is
      `continue-on-error`, so a green workflow run does **not** mean the
      pages deployed — read that step's log. `SHIP-CHECKLIST §3`.
      **The default site now exists** (`prvfire33`, created 2026-08-04 when
      the web app was registered), so the "no default site" failure this
      step was written to catch is closed. What remains is confirming the
      deploy actually published — and 0.3 still owes a redeploy so the live
      terms page shows the filled legal values.
- [x] **0.3 Fill the three legal values in `web/terms.html` — done
      2026-08-03.** `olaftaule01@gmail.com`, operator Olaf Taule,
      jurisdiction Norway, launching as a sole trader.
      `check:store-copy` dropped from 6 placeholders to 3, and the
      remaining three are all account-gated IDs from Phases 1–2.
      **Still owed: redeploy hosting** so the live page shows the filled
      values — the committed file is not what a store reviewer reads.
      `SHIP-CHECKLIST §3` also notes one EEA follow-up that is a decision,
      not a blocker.

## Phase 1 — Day 1: open the account, start the clock

- [x] **1.1 Apple Developer Program — done 2026-08-05, as an
      *individual*** ($99/yr). Team ID `U2LVW456S7`, which is what
      `web/.well-known/apple-app-site-association` and every signing step
      below use. Convertible to an organization later; enrolling as an org
      first costs 1–2 weeks of entity + D-U-N-S verification for nothing
      launch needs. **This reasoning is Apple-only** — it inverts on Play,
      which is why 1.2 goes the other way (D41).

      The App ID carries **Push Notifications** and **Associated Domains**
      and deliberately nothing else. A provisioning profile cannot grant an
      entitlement the App ID lacks, so a missing capability fails the
      *archive*, not just the feature — and an unused one is an entitlement
      to carry and a question to answer at review.
- [ ] **1.1b [PARKED — D42] Register the ENK and apply for the D-U-N-S.**
      *Not being done: Play is deferred until iOS has users.* Notify Brønnøysundregistrene via Altinn; registration in
      Enhetsregisteret is free and yields the organisasjonsnummer a D-U-N-S
      application needs. The D-U-N-S itself is free from D&B, usually ~1–2
      weeks, quoted up to ~30 business days. Everything else on this list
      runs while it waits. `D41`.
- [ ] **1.2 [PARKED — D42] Google Play Console account — as an
      *organization*, not personal** ($25 one-time, identity check). The organization type
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
- [x] **1.3 Firebase Console → Authentication → Sign-in method: enable
      Anonymous AND Google — Anonymous done 2026-08-04.** Measured, not
      read off a toggle: `accounts:signUp` now returns an `idToken` where
      on 2026-08-03 it returned `ADMIN_ONLY_OPERATION`. D3's first-run path
      is alive, and the scorecard fetch (`QUESTION-FARM.md` Phase A) is
      unblocked. `SHIP-CHECKLIST §2`.

      **Google is enabled but UNVERIFIED.** The project-config endpoint
      returns only `authorizedDomains` to an unauthenticated caller, no
      `idpConfig`, so there is no remote probe for it. It is verified by
      tapping *Link Google* in the app — which 0.1 requires anyway, since
      the seed gate matches a Google-account uid. Treat 0.1 succeeding as
      the proof.
- [ ] **1.4 Firebase Console → App Check: register web + iOS** — web
      (reCAPTCHA v3 provider), iOS (DeviceCheck/App Attest). Android (Play
      Integrity) is **[PARKED — D42]**. Do this on day 1 so the soak
      overlaps the rest of the work. **Register, do not enforce yet** —
      enforcement is step 3.4. Registering the web app is separate from
      setting the site key in the build; having one without the other
      looks identical to having neither. `SHIP-CHECKLIST § hardening`.

      **The iOS half needs 2.2 first.** App Check registers *apps*, and
      the iOS app does not exist in the project until it is added — so
      only the web half is doable on day 1. Earlier drafts had all three
      here as though they were parallel; they are not, and the Android
      one was blocked the same way before it was parked.

      **Status:** the web app was registered 2026-08-04 (app id
      `…:web:4c3d2ec4e1bbe13ab8a760`) and the iOS app with the DeviceCheck
      provider on 2026-08-05, which starts the soak clock — 3.4 is the
      earliest thing that can now happen, and it cannot happen before
      2026-08-07. What remains here is the **web reCAPTCHA v3 provider**,
      and it is worth naming why it is easy to think is done: registering
      the app and configuring its provider are two separate actions in the
      same console page, and having one without the other looks identical
      to having neither.

      DeviceCheck needs a `.p8` key, not a toggle — an earlier note in
      this conversation said "one click, no keys" and that was wrong.

## Phase 2 — Wire the native builds (needs Phase 1 accounts)

- [ ] **2.1 [PARKED — D42] Android config.** Firebase Console → Project settings → Add app
      → Android, package `com.cosaxo.insight`. **Add the debug keystore
      SHA-1 first**, then download `google-services.json` → drop into
      `android/app/`. This also activates FCM for reveal pushes.
      Gitignored on purpose — never commit it. `SHIP-CHECKLIST §2`.
      ```bash
      keytool -list -v -keystore ~/.android/debug.keystore \
        -alias androiddebugkey -storepass android
      ```
      *Skipping the fingerprint is silent, the Android twin of 2.2:* the
      downloaded file carries no Android `oauth_client`, so the build
      compiles and ships and `signInWithGoogle` fails at runtime with
      `DEVELOPER_ERROR` (status 10). Add the **Play App Signing** SHA-1 too
      once 2.6 gives you one, and **re-download** the file — it is a
      snapshot, not a live lookup.
- [x] **2.2 iOS config — done 2026-08-05.** The iOS app is registered and
      `GoogleService-Info.plist` lives in the `GOOGLE_SERVICE_INFO_PLIST`
      repository secret, base64. `Info.plist`'s
      `REPLACE_WITH_REVERSED_CLIENT_ID` is filled.
      *Skipping the URL scheme is silent:* the build succeeds, the account
      sheet opens, and Google sign-in never returns — taking D3's only
      account-upgrade path with it. `SHIP-CHECKLIST §2`.

      **"Add it to the App target in Xcode" is the step a runner cannot
      do**, and it is the reason `scripts/ios-link-firebase-plist.rb`
      exists: it adds the `PBXFileReference` at build time. The reference
      is deliberately not committed — a reference to a file absent from
      every checkout is a hard build error, and `ios-build.yml` asserts the
      plist is *absent* from the simulator bundle so a committed secret
      cannot pass unnoticed. Both release gates confirm it lands: it is in
      the archived bundle and in the exported `.ipa` (run 6).
- [ ] **2.3 APNs key.** Apple Developer → Keys → create an APNs key →
      upload in Firebase Console → Cloud Messaging → Apple app
      configuration. Without it no reveal push arrives on iOS.
- [x] **2.4 First iOS archive — done 2026-08-05, run 6, no Mac.** Actions →
      **iOS release** → Run workflow, upload unticked: archive, export,
      both silent-failure gates, signed `.ipa` attached as an artifact.
      6m 2s. The four values in [`IOS-RELEASE.md`](IOS-RELEASE.md) are set,
      and it hard-gates on `check-store-copy --ios` before spending runner
      minutes.

      Repeat this whenever the shell or its config changes. `appBuild` must
      go up before any run with upload ticked — App Store Connect refuses a
      build number it has seen, *after* the transfer completes.

      *With a Mac, if you ever want to debug a signing failure
      interactively:* `npm run build && npx cap sync`, then `npm run ios`.
- [x] **2.5 Verify the APNs environment before uploading — automated, and
      it has already caught one.** The release workflow reads it at both
      ends and fails on anything but `production`, so this is manual only
      when you archive from a Mac:
      ```bash
      codesign -d --entitlements :- /path/to/App.app | grep -A1 aps-environment
      ```
      This failure is completely silent — the device registers with the
      APNs sandbox, FCM sends to production, nothing errors and no push
      ever arrives. `SHIP-CHECKLIST § hardening`.

      **Run 5 is the proof it is worth automating.** The export succeeded
      and produced a valid, signed, uploadable `.ipa` whose entitlement was
      empty, because the archive it came from was unsigned and Xcode
      applies entitlements at signing time. Nothing else in the build said
      a word. The one time this gate has fired, it fired on this repo's own
      workflow rather than on a mistake from outside.
- [ ] **2.6 [PARKED — D42] Android signing.** Generate the upload keystore **outside the
      repo**, and **enrol in Play App Signing** so a lost upload key is
      recoverable. Before the first release commit run `git status
      --ignored` and confirm nothing sensitive is tracked — a `git add -A`
      after a signing session is an incident a revert cannot fix.
      `SHIP-CHECKLIST § hardening`.
- [ ] **2.7 The app-link fingerprints — the file is filled, the deploy is
      owed.** `web/.well-known/apple-app-site-association` carries the real
      Team ID as of 2026-08-05 (`U2LVW456S7.com.cosaxo.insight`). The
      `assetlinks.json` SHA-256 comes from Play Console → Setup → App
      signing and is **[PARKED — D42]**, so `check:store-copy` will keep
      reporting that one placeholder: a known permanent non-blocker, not
      an unfinished task.

      **What remains is a hosting redeploy**, which this step shares with
      0.2 and 0.3 — three separate reasons the live site is behind the
      repo, one deploy that closes all three. *The committed file is not
      what iOS fetches.* Then reinstall and tap a `/join/CODE` link.
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

- [ ] **3.1 [PARKED — D42] Upload a signed AAB to a Play testing track.** With the organization account (D41) this is testing, not a
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

      **You do not have to retype it into the web form.**
      `npm run asc:push` pushes name, subtitle, description, keywords,
      promotional text and the URLs to App Store Connect from this file —
      dry run by default, `-- --apply` to write. Same API key as the
      release workflow (`IOS-RELEASE.md`). It deliberately does NOT touch
      screenshots, the privacy questionnaire or the age rating; those are
      attestations, and `STORE-FORMS.md` is the transcribe-by-hand answer.
- [ ] **4.4 + 4.5 Privacy nutrition labels and the age rating — read, then
      one dispatch.** Mandatory; Apple accepts no submission without both.

      **Both are now data.** `design/store/app-privacy.json` holds every
      answer with the reasoning on each row, `npm run check:store-forms`
      holds it equal to `docs/STORE-FORMS.md`, and **Actions → App Store
      metadata** pushes it. Dry-run by default: the first run prints the
      exact diff — every field, every privacy row it would add or remove —
      and writes nothing.

      **Read `STORE-FORMS.md` before ticking apply.** What you are
      approving is a legal statement about what the app collects. The
      workflow transcribes that decision; it does not make it. Typing it by
      hand was never the safeguard it looked like — it is ~40 clicks that
      must agree with `data-inventory.md`, with nothing checking that they
      do, which is exactly how one false claim survived in three documents
      at once.

      The three that bite, and why each is worth knowing before you
      approve: **Tracking = No** (no IDFA, no ATT prompt, no ad SDK — the
      Facebook SDK is stripped at postinstall and asserted by
      `check:ios-facebook`); **Coarse location = Yes, optional, never
      Precise** (precise is unobtainable by construction, and `check:store-forms`
      fails if it ever appears); **Sensitive info = Yes** (the politics
      result is GDPR Art. 9 data — the form asks what you *collect*, not
      what you publish).

      Expect **12+ / 13+**. **Read the Apple 1.2 table in `STORE-FORMS.md`
      before submitting** — the support email from 0.3 is a 1.2 dependency,
      not only a GDPR one.

      *Play's Data Safety form is **[PARKED — D42]**.*

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
- [ ] **5.5 Apply the two monitoring alerts** (`monitoring/*.json`):
      ```bash
      npm run monitoring:apply -- --email you@example.com           # report
      npm run monitoring:apply -- --email you@example.com --apply   # do it
      ```
      One command for what used to be four console steps with a channel id
      pasted between them. Idempotent and dry-run by default. Neither
      policy is applied by the pipeline, and this script must not be put on
      it — the deploy service account has no monitoring role, and widening
      it for two policies is the worse trade. Both cover failures that look like nothing from the
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
      primary path is anonymous, no account is required, and Google is an
      optional upgrade rather than a login wall. Only add the Apple
      provider if a reviewer insists.

      **This step used to end "…and no email or name is collected through
      it". It is deleted, and do not say it.** Google's default scopes put
      an email and a display name on the Firebase Auth record, so the
      sentence contradicts the app's own privacy label — a listing that
      argues against its own nutrition label is a worse problem than the
      one it was trying to solve. `STORE-FORMS.md` has the reasoning; this
      was the third copy of the claim, after `SHIP-CHECKLIST` and the
      forms doc.
- [ ] **6.3 [PARKED — D42] Apply for Play production access** — a three-section
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
