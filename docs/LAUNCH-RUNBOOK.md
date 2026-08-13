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
questions of 510 seeded; the production backend is deployed. **Measured
2026-08-04:** anonymous sign-in works (`accounts:signUp` returns an
`idToken`, where it returned `ADMIN_ONLY_OPERATION` on 2026-08-03), the
InSight web app is registered, and the default hosting site `prvfire33`
exists. **Measured 2026-08-05:** the iOS release workflow archives,
exports and passes both gates with no Mac (run 6).

**Landed 2026-08-07 and 08, and this is where the file was most stale:**

- **Build 1 is on App Store Connect** (run 7, `upload = true`). It is in
  TestFlight now, and internal testing needs no Beta App Review — the
  external group that was submitted only gates people outside the team.
- **The listing text is pushed.** Subtitle, privacy-policy URL,
  description, keywords, promotional text, support and marketing URLs.
- **The age rating is pushed** — all 22 attributes, including the eight
  Apple added (D75). `whatsNew` is the one field that did not go: Apple
  refuses it on a first release, and it applies on the first update (D74).
- **The privacy nutrition label is not pushable at all.** Apple's API has
  no App Privacy resource (D73), so the metadata workflow prints it as the
  form and it is typed in by hand. **Still outstanding.**
- **Trader status: declared** (D69). Waiting on a *bostedsattest* by post
  as the address document.

**Three decisions came out of that week and each is a gate now**: D73 (the
privacy label has no endpoint), D74 (a tick is printed after the write, not
before — it was wrong in three places), D75 (Apple's eight new age-rating
questions, and `check:store-forms` rule 5, which now covers the age-rating
half of `app-privacy.json` that was gated by nothing).

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

**The upload half is proven too, as of run 7** (2026-08-07, `upload =
true`, 6m 41s): `UPLOAD SUCCEEDED with no errors`, delivery UUID
`470b566a-8f2f-4664-a29e-df862d5761c7`. Every step in that workflow has now
done its job against the real Apple, including the one that sends a binary.

*[PARKED] Play's clock, for when this is picked up:* a personal account
created after 2023-11-13 must run **12 opted-in testers × 14 continuous
days** on a closed track before it can apply for production access —
"opted in" means accepted *and installed*, the days are continuous, and
dropping below 12 restarts them. An organization account skips it (D41),
at the price of the ENK → D-U-N-S chain. Both are in D42 with the
arithmetic.

---

## Phase 0 — Do these first (about an hour, one console)

- [ ] **0.0 Decide the Firestore region — the only item here with a
      DEADLINE.** Not a task so much as a fork, and it sits above the seed
      because every day it is not decided makes it more expensive.
      A database's location is fixed at creation, so this stops being a
      setting and becomes a migration the moment real answers accumulate.
      Worth roughly half of every Firestore line, forever, with no
      user-visible change — and worth ~$20/month at the traction this app
      is actually planning for, so the money is not the argument. The
      deadline is.

      [`FIRESTORE-REGION.md`](FIRESTORE-REGION.md) has the arithmetic, the
      three options, the ordered procedure, and the two ways the migration
      fails **silently** (a deploy sub-target that prints "Deploy
      complete!" and ships nothing, and a Firestore trigger that binds to
      the wrong database and simply never fires). Read it before touching
      anything; staying on `nam5` is a legitimate answer and the point of
      the page is that it be an answer rather than a default.

- [ ] **0.1 Seed the production question bank — run 2026-08-07 and already
      stale.** Actions → **Seed content** → Run workflow.
      510 questions land in `v2_questions` — idempotent and, since D34,
      cheap to repeat.

      **This step is now automatic for everything that follows it (D88):**
      *Seed content* chains to a successful **Deploy Firebase backend** via
      `workflow_run`, so any merge that changes the bank deploys it and then
      seeds it, in that order. The manual run stays for the case this box
      is: a bank that changed before the chain existed. Read the summary
      either way — `written: 0` means nothing landed.

      **It is unticked on purpose, and still is.** That run wrote **389**,
      and the bank is **510** after the K=5 test expansion, D103's
      retirement of the Thinking test and D114's continuum questions — so
      the difference is in the repo and not in production. Note that the gap now runs BOTH ways: 20
      `test-cognitive-*` questions are live in `v2_questions` and no longer
      in the bank, and a reseed does not retire them (`active` is only ever
      written on first create). Flip those 20 to `active: false` in the
      console and reseed with `bumpRev: true`. This is exactly the
      standing-instruction case: the box is not "seeded once", it is
      "seeded since the last content change", and every promotion (D30,
      D33) moves it back. **Reseed after merging anything that touches
      `v2content.ts`.**
      `SHIP-CHECKLIST §1`.

      **A reseed reaches devices that already have the app**, so this is
      not gated on a new build: changed and new documents carry a fresh
      `updatedAt`, and the client pages them in against a stored cursor
      (`live.ts`, `insight.bankCache.v2`). Tick **bump_rev** only when the
      cursor cannot see the change — flipping `active` by hand in the
      console is the case it exists for, because that does not move
      `updatedAt`.

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

      **D116 adds a fourth reason to redeploy, and it is the first that is
      a correction rather than a fill-in.** `web/privacy.html` said world
      takes are published "with no name attached" — twice, in the prose
      and again in the who-can-see-what list — which D98 made false and
      D106's rewrite of that very page carried through. The repo copy is
      fixed; **the live page still says it** until hosting is redeployed.
      A privacy policy promising an anonymity the app does not give is the
      failure mode D106 exists to prevent, so this one should not wait for
      a convenient deploy.
- [x] **0.3 Fill the three legal values in `web/terms.html` — done
      2026-08-03.** `olaftaule01@gmail.com`, operator Olaf Taule,
      jurisdiction Norway, launching as a sole trader.
      `check:store-copy` dropped from 6 placeholders to 3, and the
      remaining three are all account-gated IDs from Phases 1–2.
      **Still owed: redeploy hosting** so the live page shows the filled
      values — the committed file is not what a store reviewer reads.
      `SHIP-CHECKLIST §3` also notes one EEA follow-up that is a decision,
      not a blocker.

- [ ] **0.3 Put the protection rules on the `production` environment
      (D87).** GitHub → Settings → Environments → `production`. Five
      fields, one save: required reviewers ON with yourself; **prevent
      self-review OFF**; wait timer 0; **"Allow administrators to bypass
      configured protection rules" OFF** (GitHub ticks it by default, and
      left on it cancels the gate for the owner — the exact caller the
      gate exists for); deployment branches restricted to `main`. Full
      table and per-setting reasoning in
      `docs/DEPLOYMENT.md § Protection rules`.

      Until this is done, a push to `main` touching the backend deploys
      to production with nobody in the loop, and a seed writes
      `v2_questions` the same way. Both draw the service-account key from
      an environment that currently gates nothing.

      **Prevent self-review must be OFF** — one uid holds
      `SEED_ADMIN_UIDS` and it is yours, so preventing self-review would
      block every deploy and every seed permanently, the emergency rules
      fix included. It flips ON the day a second operator exists.

      Verify it took rather than assuming: trigger anything on this path
      and confirm the run sits at **Review pending** instead of
      proceeding. Nothing in CI checks these rules — that gap is recorded
      in D87 rather than closed, so this box and a periodic look at the
      settings page are the only things holding it.

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
- [x] **2.3 APNs key — done 2026-08-07.** Key ID `9GAJ36R328`, uploaded to
      Firebase Console → Cloud Messaging → Apple app configuration for
      `com.cosaxo.insight`. Without it no reveal push arrives on iOS.

      **Into the PRODUCTION row, not development, and the console offers
      both.** `App.entitlements` resolves `aps-environment` to `production`
      for the App target's Release build, and the release workflow refuses
      any build where it is not — so every shipped build registers against
      the production APNs endpoint. A key in the development slot would sit
      unused while no push ever arrived, which is the same silent failure
      the APNs gate exists to catch, one layer further out.

      One Apple auth key serves both environments, so there is no second key
      to make and no reason to fill the development row with a copy.

      Ignore the **APNs Certificates** panel below it entirely — that is the
      older per-environment mechanism, and mixing the two is how a project
      ends up with a certificate that expires annually and nobody watching.
- [x] **2.4 First iOS archive — done 2026-08-05, run 6, no Mac.** Actions →
      **iOS release** → Run workflow, upload unticked: archive, export,
      both silent-failure gates, signed `.ipa` attached as an artifact.
      6m 2s. The four values in [`IOS-RELEASE.md`](IOS-RELEASE.md) are set,
      and it hard-gates on `check-store-copy --ios` before spending runner
      minutes.

      **Build 1 UPLOADED 2026-08-07 (run 7, `upload = true`, 6m 41s).**
      `UPLOAD SUCCEEDED with no errors`, delivery UUID
      `470b566a-8f2f-4664-a29e-df862d5761c7`. That was the last untried step
      in the release chain — every part of `ios-release.yml` has now done its
      job against the real Apple.

      Repeat this whenever the shell or its config changes.

      **`appBuild` must be AHEAD of the last uploaded build — which is not
      the same as "bump before every run", and the difference has already
      cost a number.** App Store Connect refuses a build number it has
      seen, *after* the transfer completes, so a forgotten bump costs a
      full run; that is why this file bumps immediately after an upload
      instead. Both halves of that convention are right and reading only
      the second one is not: on 2026-08-08 `appBuild` was bumped 2 → 3
      before a run, when 2 had never been uploaded. **Build 2 will never
      exist.** Harmless — numbers are free and monotonic is all Apple
      wants — but the check to make is a comparison, not a habit:

      > **Is `appBuild` greater than the highest build in App Store
      > Connect?** If yes, run as-is. If no, bump, then run.

      **It is at 11. Build 10 is the highest one on App Store Connect**
      (run 16, 2026-08-12 10:50Z, at `2933dc0` — its upload step reads
      `success`). Run 15 eight minutes earlier is the archive-only
      rehearsal this section prescribes, and its upload step reads
      `skipped`: the pair confirms the gate works and that only one of
      the two spent a number. Read off those two runs' own step lists
      rather than from memory, which is the comparison above and not the
      habit.

      **BUILD 11 UPLOADED 2026-08-12** (run 17, `ac61c37`, 6m 37s, upload
      step `success`). It carries everything merged since `2933dc0`:
      D103's retired Thinking test and the dot-row rail, D104's test
      users, D105's iOS focus-zoom fix, D107's location purpose string,
      D108–D110's 327 KB off first paint, D111/D112's similarity maps,
      D113/D114's continuum forms, D115's learn lane, and D116's
      corrected store and privacy copy. It was the first run to carry the
      D116 pre-flight (`check:public-copy`), which passed.

      **`appBuild` is now 12**, bumped straight after that upload, which
      is this section's whole convention. **Build 11 is the highest on App
      Store Connect**, so the comparison passes for the next run as-is.

      **Build 12 is pre-flighted and unspent as of 2026-08-13 (D130).** The
      comparison was made rather than assumed — 12 > 11 — and every gate in
      6.1 passes, along with the full suite: 944 client tests, 203 function
      tests, 83 rules tests, lint, `tsc -b`, `check:globals` at its
      baseline, and 19 of the remaining check gates. The two that do not
      pass locally are both environmental and neither is a defect:
      `check:web-firebase` reads `VITE_FIREBASE_*` from repository
      *variables* that exist only in CI (which is the point of it running
      after the build, in the workflow, against `dist/`), and
      `check:fn-runtime` needs `npm run build --prefix functions` first —
      it passes once built. **`test:rules` needs `HTTPS_PROXY` unset**, per
      CLAUDE.md; with it set the emulator dies naming neither the host nor
      the proxy.

      What build 12 carries that 11 did not: D118–D121's phone-reported
      gesture and Answers-tab fixes, D122's handles and invitations,
      D123's dedup gate, D124's cost ceilings, D125's who-voted turn,
      D126–D128's Foresight read half, and D129's polled deck.

      **The store-side audit that D116 made standing was run against those
      and came back with no answer changed** — the reasoning under two of
      them had gone stale, which is D130.

      **`npm run check:versions -- --fix` does NOT increment.** It
      propagates package.json's value into the two native projects and
      nothing more, so "run --fix to bump" is wrong and reports a cheerful
      `versions OK` at the OLD number. Edit `appBuild` by hand first, then
      `--fix` carries it to `versionCode` and `CURRENT_PROJECT_VERSION`.

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

      **Build 1 is in TestFlight and an external group was submitted for
      Beta App Review 2026-08-07.** What is left here is people, not setup.

      **Start with INTERNAL testing, which has no review gate at all.**
      Internal testers are App Store Connect users on the team — up to 100
      — and they get a build as soon as it finishes processing. External
      groups are the ones that need Beta App Review. TestFlight → *Internal
      Testing* → new group → add yourself → add the build; then TestFlight
      on the phone, same Apple ID. Nothing else gates it: export compliance
      is pre-answered in `ios/App/App/Info.plist`
      (`ITSAppUsesNonExemptEncryption = false`), so there is no per-build
      question to answer.

      **Expect your own answer to be the whole crowd, and expect to see
      your own name.** There is no k-floor since D98: the first answer
      publishes exactly, so a count of 1 on your own device is that one
      answer and the who-voted sheet will name you. That is the product
      working, not a leak — the 510 seeded questions are live regardless.
      What used to sit here was the opposite warning (*"You're early"*
      under `AGG_MIN_N`, paused by D81 and removed entirely by D98).
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

The harness, the graphic and the copy all landed 2026-08-03. **The copy is
pushed as of 2026-08-08** and so is the age rating; what is left here is a
**recapture against live data**, the privacy form, and the trader document
in the post.

The recapture is the one with a real precondition: it wants real answers
on screen. Under D81's pause one answer per question is enough (counts
publish from the first); once the floor restores it wants five, or the
empty bank puts *"You're first"* where every crowd figure should be
(there is no floor since D98 — the first answer publishes exactly).
That is a tester-count problem, not a workflow problem.

- [ ] **4.1 Recapture the screenshots in LIVE mode — Actions →
      *Screenshots* → Run workflow.** Capture with upload unticked, download
      the `store-screenshots` artifact, **look at them**, then re-run with
      upload ticked. Six scenes × both store sizes (1320×2868 and
      1080×1920), asserted against the store specs at generation.

      **The committed captures are a demo preview, not the shipping set.**
      The harness names the one that must not ship: the reveal shows
      Comments and "Who voted", both `!S.live`-gated by D1, so no real user
      sees them on a live question (App Store 2.3.3). `asc-push`
      **refuses** to upload anything the manifest flags, and the workflow
      deliberately does not pass `--allow-demo` — if a fresh capture is
      still flagged, the build did not reach live mode, and a failed job is
      the right outcome rather than a rejection found days later by a
      reviewer.

      **Live captures only became possible on 2026-08-07**: before that the
      production bank was empty and the backend could not authenticate at
      all, so there was nothing to capture against.

      Playwright is installed by the workflow and stays out of
      `package.json` on purpose — a ~300 MB browser download that every
      contributor and every CI job would otherwise pay for, to serve a job
      that runs a few times per release.

      The TestFlight week is still the better moment: ten testers put a
      real split on screen rather than one vote per question. A freshly
      seeded bank shows a split from the very first answer (D98 — no
      floor), so what a screenshot lacks before testers arrive is a
      believable crowd, not a permitted one.
      *Note the iPad set every guide lists does not apply —
      `TARGETED_DEVICE_FAMILY = 1`, iPhone only.*
- [x] **4.2 Play feature graphic — done.** `npm run build:feature-graphic`
      → `design/store/feature-graphic.png`, 1024×500, built from
      `mark.svg` and the app's own stylesheet so it cannot drift from the
      palette. Regenerate if the mark or tagline changes.
- [ ] **4.3 Marketing copy — pushed 2026-08-08, CORRECTED 2026-08-12,
      and the correction is not live until it is re-pushed (D116).**
      `design/store/listing.json` carries every field both consoles ask
      for; `npm run check:store-listing` holds each against its character
      limit (all currently fit, the longest at 161/170). No placeholders
      remain: `shared.supportEmail` was filled with 0.3's address on
      2026-08-03.

      **Unticked on purpose, and this one is not a matter of voice.** The
      description pushed on 08-08 was still selling the pre-D98 privacy
      model to every visitor of the listing — *"Your answers are
      owner-only. The database rules enforce it"* and *"Crowd numbers are
      floored"*, under a header reading **BUILT SO THE PRIVACY CLAIMS ARE
      TRUE**. The copy was accurate on the day it was pushed (08-08);
      **D98 falsified it on 08-11** and it has been live and false since.
      D106 swept that model out of `web/` and the docs the next day and
      never enumerated this file. It also advertised five profiles after
      D103 retired the Thinking test.

      The repo copy is fixed and `npm run check:public-copy` now fails on
      that vocabulary in `listing.json`, `web/*.html` and the privacy
      panel. **App Store Connect still serves the old text**: nothing here
      can read it, the same limitation as the age rating (D74/D75), so a
      green tree is not a corrected listing. One dispatch fixes it.

      **You do not have to retype it into the web form.** **Actions → App
      Store metadata** pushes name, subtitle, privacy-policy URL,
      description, keywords, promotional text and the URLs from this file
      — dry run by default, *apply* to write. (`npm run asc:push` is the
      same script locally, and needs the API key on the machine; the
      workflow exists so it does not have to be.)

      **What it does and does not write, now that all three are known:**
      text and the **age rating** are written; **screenshots** are written
      too, but by the *Screenshots* workflow, which captures them first
      because the captures are gitignored build output; the **privacy
      label** is only printed, because Apple exposes no endpoint for it at
      all (D73). Only the last of those is a limitation rather than a
      choice.

      `whatsNew` is sent separately and refused on a first release (D74),
      which is expected and reported as a skip rather than a failure.
- [ ] **4.3b EU trader status (Digital Services Act) — a blocker nothing in
      this repo knew about.** App Store Connect → **Business** → *Trader
      Status*, or via the banner on the Apps list. Apple's wording: *"your
      trader status must be provided or your apps will be removed from the
      App Store in the EU."*

      **Found 2026-08-07 by reading a console banner**, not by any check
      here — which is the point worth keeping. `check:store-copy` and
      `check:store-listing` hold what the repo can see; a store-side legal
      requirement introduced after those were written is invisible to both,
      and there is no gate that could have caught it.

      Two things to decide before filling it in, and neither is a code
      question:

      - **Trader vs non-trader.** Declaring *trader* publishes a name,
        address, phone and email on the listing. Declaring *non-trader*
        keeps them private but costs EU distribution.
      - **Which address.** D42 parked the ENK registration when Play was
        deferred, so there is no company address to use — 0.3 records the
        operator as a sole trader in Norway. A sole trader's address is a
        home address, and this publishes it. **Norway is EEA, not EU**, so
        the Norwegian storefront is unaffected either way; what is at stake
        is the 27 EU storefronts.

      **Decided 2026-08-07: declare trader, and take the EU (D69).** The
      home address goes on the listing. D69 has the reasoning and, more
      usefully, the way out: registering the ENK gives a business address
      that can replace it, which is a second and independent reason to want
      the ENK that D42 parked.

      **Declared 2026-08-07. Waiting on the address document.** Apple asks
      for proof of address; a Norwegian *bostedsattest* from Skatteetaten
      is the one that fits and it arrives by post. This step is open only
      until that envelope does — it is waiting, not work, so do not let it
      block anything below it.
- [ ] **4.4 The privacy nutrition label — the last form, and it is manual.**
      Mandatory; Apple accepts no submission without it.

      **Apple's API cannot write it.** Not through another path — there is
      no App Privacy resource in the App Store Connect API at all, verified
      three ways (D73). So **Actions → App Store metadata** with *privacy*
      selected prints the form, row by row, in the order App Store Connect
      asks, and you copy it across: 7 data types, each **App Functionality
      / linked Yes / tracking No**, tracking overall **No**. Coarse
      Location, never Precise. ~15 minutes, and nothing recalled from
      memory.

      **Read `STORE-FORMS.md` before typing.** What you are entering is a
      legal statement about what the app collects. The printout transcribes
      that decision; it does not make it. Doing it from memory was never
      the safeguard it looked like — it is ~40 clicks that must agree with
      `data-inventory.md`, with nothing checking that they do, which is
      exactly how one false claim survived in three documents at once.

      The three that bite, and why each is worth knowing before you
      approve: **Tracking = No** (no IDFA, no ATT prompt, no ad SDK — the
      Facebook SDK is stripped at postinstall and asserted by
      `check:ios-facebook`); **Coarse location = Yes, optional, never
      Precise** (precise is unobtainable by construction, and `check:store-forms`
      fails if it ever appears); **Sensitive info = Yes** (the politics
      result is GDPR Art. 9 data — the form asks what you *collect*, not
      what you publish).

      Three look tickable and are not — the printout names them with the
      reason: **Device ID** (D29 binding holds no identifier server-side),
      **Product Interaction** (no analytics ship), **Emails or Text
      Messages** (a take is a post to a circle, not a message to a person,
      and its content is already declared under *Other User Content* —
      D79; the reason used to be "no live free-text surface" and D78 part 1
      ended that).

      *Play's Data Safety form is **[PARKED — D42]**.*

- [x] **4.5 The age rating — pushed 2026-08-08, `messagingAndChat`
      re-pushed 08-09, and CONFIRMED in sync 2026-08-12.** All 22
      attributes go in one dispatch of **Actions → App Store metadata**
      with *apply* ticked.

      **Ticked on the strength of a dry run, not a memory.** This entry
      stood open saying `messagingAndChat` was still `false` on App Store
      Connect and needed a re-push (D79). It is not: the 08-12 dry run
      reports `age rating: already matches app-privacy.json`, so run 8 on
      08-09 had already carried it and this box outlived the work. The
      cheap way to check is the dry run itself — *apply* unticked prints
      the diff and writes nothing, which is what it is for.

      That is the same class of error as D116, one layer out: **pushed
      state and the box that tracks it drift in both directions.** D116
      was a box that should have been open; this was a box that should
      have been shut.

      **This is the standing shape of this step, not a one-off.** The age
      rating is pushed state, so it goes stale whenever a feature changes
      what the app *is* rather than what it *says*. `check:store-forms`
      holds the two files to each other; **nothing holds either of them to
      App Store Connect**, so a re-push after any answer moves is manual by
      construction.
      `design/store/app-privacy.json` holds every answer with the reasoning
      on each row, and since D75 `check:store-forms` holds the age-rating
      half equal to `STORE-FORMS.md` as well as the privacy half — key and
      value, both directions.

      **It took three dispatches, and each failure is worth a line because
      the next person hits the same API.** An `?include=` Apple rejects
      (400), a `GET` of a write-only resource (403), then eight required
      attributes nobody knew about — Apple's newer social-media questions,
      which reject the *entire* PATCH rather than the missing fields (D75).
      A fourth thing was found on the way: the script printed ✓ before
      writing, in three separate places (D74).

      **`whatsNew` is the one field that did not go, and that is correct.**
      Apple refuses it on a first release — there is no previous version
      for it to be new against — so `asc-push` sends it in its own request
      and reports the refusal as a skip. It applies on the first update.

      Expect **12+ / 13+**, and **read the Apple 1.2 table in
      `STORE-FORMS.md` before submitting** — the support email from 0.3 is
      a 1.2 dependency, not only a GDPR one. The rating is driven by
      `userGeneratedContent = true` (display names in reveals), not by any
      content answer; every content frequency question is `NONE`, measured
      against all five banks rather than assumed.
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
- [x] **5.6 Version lockstep — holds at 2.0.0 build 12 (verified 2026-08-13).**
      *This line said build 11 until 2026-08-13, one day after 2.4 bumped
      the number it quotes.* Harmless in itself and worth naming anyway: it
      is the D39 shape — a figure kept current by intention — inside the
      very step whose job is to notice numbers disagreeing. The checker
      reads the three files and never this sentence, so run the command
      rather than reading this line.
      `npm run check:versions` (`--fix` writes package.json's values into
      both native projects). `appBuild` + android `versionCode` + iOS
      `CURRENT_PROJECT_VERSION` — five numbers across three files — move
      together for every release, and `--fix` is the only sane way to do
      it by hand. See 2.4 for **when** to bump: the test is whether
      `appBuild` is already ahead of the highest build in App Store
      Connect, not whether a run is about to happen.
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
- [ ] **5.8 Put back the two access controls that were loosened on
      2026-08-12 to unblock the build-11 release (D117).** Both were
      deliberate, both are still off, and **nothing in this repo can see
      either one** — no check, no test, no workflow. This box is the only
      record that they are open.

      1. **`production` → Deployment protection rules → Required
         reviewers.** Re-check it, with yourself; *prevent self-review*
         **off**; *allow administrators to bypass* **off**. That is 0.3's
         configuration, and D87 is why it exists: the deploy and the seed
         both draw the service-account key from that environment.
      2. **GitHub App → Repository permissions → Actions: back to
         `Read`.** `Read and write` lets an agent dispatch *any* workflow
         in the repo, **iOS release with upload ticked included** — which
         spends a build number and pushes to TestFlight irreversibly.

      **Do 1 before there is anything in production worth protecting, and
      2 as soon as the release dispatches are done.** They are independent
      of each other; neither blocks the other.

      Reversing #1 costs nothing. Reversing #2 costs the four clicks per
      dispatch that #2 exists to save, which is the trade being made, and
      it is the cheaper side once releases stop being daily.

## Phase 6 — Submit

- [ ] **6.1 Pre-flight, before every archive and every upload:**
      ```bash
      npm run check:store-copy -- --ios  # must exit 0 — deliberately NOT in CI
      npm run check:store-listing        # every field inside its store limit
      npm run check:public-copy          # no retired-model claims in user-facing copy
      npm run check:versions
      npm run build && npx cap sync
      ```

      **`--ios` is not optional here, and the bare command is what this
      step used to say.** Under D42 the Play signing SHA-256 is parked, so
      `check:store-copy` with no flag exits **1** on a placeholder that is
      a permanent non-blocker (2.7) — which reads as a failed pre-flight
      and invites someone to go filling in a fingerprint for a store that
      is not being shipped to. `--ios` excuses that one and nothing else;
      it is the same flag `ios-release.yml` hard-gates on.

      `check:public-copy` joined the list at D116, and the release
      workflow runs it too: the privacy panel is compiled into the binary,
      so a false claim about who can read an answer ships to the phone
      rather than staying in the repo.
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
