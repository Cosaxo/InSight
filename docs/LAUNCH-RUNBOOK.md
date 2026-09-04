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
unfilled placeholder, and it is `REPLACE_WITH_PLAY_SIGNING_SHA256`.
**It stopped being permanent at D345**: it was a non-blocker only while
Play was parked, and it is now a real value that Play Console mints at
App signing — which nothing can produce until something has been
uploaded, so `--first-upload` excuses it for that one run and `--ios`
still excuses it for an iOS build. **For an iOS launch the count is
zero**, which is a change from 2026-08-04: the Team ID and the
`REVERSED_CLIENT_ID` were the other two and both are filled.

`check:store-listing` and `check:versions` pass; the daily bank is at 130
questions of 845 seeded; the production backend is deployed. **Measured
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
- **Trader status: declared** (D69), **and the address document was
  uploaded 2026-08-30.** The *bostedsattest* arrived 23 days after the
  declaration and went up the same day. 4.3b now waits on Apple's
  verification, which gates only the EU-27 storefronts.

**Three decisions came out of that week and each is a gate now**: D73 (the
privacy label has no endpoint), D74 (a tick is printed after the write, not
before — it was wrong in three places), D75 (Apple's eight new age-rating
questions, and `check:store-forms` rule 5, which now covers the age-rating
half of `app-privacy.json` that was gated by nothing).

Those two question counts are held by `npm run check:figures` against
`functions/src/v2content.ts`, because a number quoted in prose and kept
current by intention is the one documentation error this repo keeps
re-committing (D39).

> ## BOTH STORES, as of 2026-09-01 (D345) — this file said iOS only for three days after it stopped being true
>
> **Play is un-parked**, onto D41's organization route: an ENK, a D-U-N-S,
> and a Play Console organization account, which is exempt from the
> closed-testing gate. The owner's word was *"yes, do both and i will go
> for a ENK"*. The two code items that blocked any Android artifact at all
> — release signing in `android/app/build.gradle` and
> `.github/workflows/play-release.yml` — were built in the same decision,
> so the Android steps below are **work, not backlog**.
>
> **Every step the park covered now reads `[UN-PARKED — D345]`**, so the
> lift has a scope rather than a mood. They are: 1.1b, 1.2, 2.1, 2.6, 3.1,
> 6.3, the Android half of 1.4, the Play half of 2.7, and Play's Data
> Safety form.
>
> **This is the documentation error the tree keeps re-committing (D39),
> in the file whose whole job is to say what is left.** D345 merged
> 2026-09-01 and named neither this file nor `SHIP-CHECKLIST.md`, which is
> canonical — so for three days the owner's ordered list understated the
> remaining launch work by an entire platform, in the direction that looks
> like progress. No gate could see it: `check:docs` proves the map names
> every document, `check:figures` proves a listed number equals the tree,
> and neither reads whether a sentence is still true. That gap is
> `docs/DOC-SWEEP.md`'s subject, and this is the shape it exists to catch.
>
> **What D42's reasoning bought is still worth keeping**, because it is
> why the route taken is the right one: the two paths onto Play move in
> opposite directions over time — the organization account (D41) costs the
> same whenever it is taken, while the 12-testers × 14-days route is
> brutal cold and easy once you have users with Android phones. Choosing
> the ENK **before** an installed base is choosing the branch D42 said was
> right in exactly that case, so **D41 stands in full and nothing in it
> needs re-deriving**. Two of its numbers are stale in the direction that
> favours this choice: the gate is 12 testers rather than the 20 D41
> launched at, and tester *engagement* is now checked as well as count.
>
> **The one thing still unverified is the one that costs money:** whether
> Google's organization verification accepts an Enhetsregisteret-only ENK
> or wants what Foretaksregisteret provides (~3,000 kr). **Check it in the
> Play Console account-type flow before paying for a D-U-N-S expedite.**

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

- [x] **0.0 The Firestore region — TAKEN 2026-08-15 (D165), and the
      procedure finished 2026-08-27 (D333).** Production is `insight` /
      `europe-west1`, a single region; `nam5` is the option not taken,
      and deleting `(default)` was the last step. This carried the only
      DEADLINE in the file, because a database's location is fixed at
      creation and becomes a migration the moment real answers
      accumulate — which is exactly why it was taken before they did.

      **The box stayed unticked for two weeks after the fact**, and that
      is the documentation error this repo keeps re-committing (D39): the
      tree said `europe-west1` the whole time — `FIRESTORE_LOCATION` in
      `functions/src/db.ts`, `FUNCTIONS_REGION` in `functions/src/ops.ts`
      — and only the checkbox lagged. It read as the largest open item on
      the list while being the most finished thing on it.

      [`FIRESTORE-REGION.md`](FIRESTORE-REGION.md) keeps its argument in
      the present tense of a decision that was still open, on purpose:
      the arithmetic, the three options, the ordered procedure, and the
      two ways the migration fails **silently** (a deploy sub-target that
      prints "Deploy complete!" and ships nothing, and a Firestore
      trigger that binds to the wrong database and simply never fires).
      Read it before touching a database region again, here or anywhere.

      **DONE 2026-08-15 (D165): `insight` / `europe-west1` is live** —
      created, rules + functions deployed, bank seeded and verified. The
      `(default)` deletion it left waiting **happened 2026-08-27 (D333)**,
      twelve days later, after measuring that `insight` serves and that
      nothing but D13's stranded schedulers had written to `(default)`
      since the move — so the whole of 0.0 is closed and the project has
      one database. Original decision note below.

      **DECIDED 2026-08-15 (D165): option A — a new regional database in
      the same project, recommended region `europe-west1`.** The existing
      answers are NOT migrated: the owner is the only person who has
      answered anything so far, so there is nothing to preserve and this
      is the last free reset. FIRESTORE-REGION.md's procedure is the
      steps; D165 is the reasoning. The console half (create, deploy
      rules, seed, verify) is the operator's; the three code edits are a
      separate commit that lands **after** the database exists, because a
      PR that cannot be merged until a console action happens is a trap.

- [x] **0.1 Seed the production question bank — CLOSED, measured
      2026-08-20.** A client-path read of the live `insight` database
      (anonymous auth, the same read every install does) returned
      **exactly 600 documents and zero `test-cognitive-*` docs**: the
      flip-and-bump instruction below described the pre-D165 `(default)`
      database, and the D165 fresh reset (2026-08-15) reseeded from the
      post-D103 bank, so the 20 retired questions never entered the
      database the app now reads. Nothing to flip. The bank is current
      by the D88 chain (seed run 52 rode today's deploy), and run 53
      (bump_rev, same day) bumped `contentRev` besides — harmless, spent
      on an instruction this measurement retired. Original text kept
      below because it documents how the gap was reasoned about while it
      was real.
      Actions → **Seed content** → Run workflow.
      845 questions land in `v2_questions` — idempotent and, since D34,
      cheap to repeat.

      **This step is now automatic for everything that follows it (D88):**
      *Seed content* chains to a successful **Deploy Firebase backend** via
      `workflow_run`, so any merge that changes the bank deploys it and then
      seeds it, in that order. The manual run stays for the case this box
      is: a bank that changed before the chain existed. Read the summary
      either way — `written: 0` means nothing landed.

      **It is unticked on purpose, and still is.** That run wrote **389**,
      and the bank is **845** after the K=5 test expansion, D103's
      retirement of the Thinking test, D114's continuum questions and the
      D14 go-live's pick promotion — so
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
- [x] **0.2 Confirm the hosting pages are actually live — confirmed
      2026-08-20.** The *Deploy hosting* step of deploy run 99 reports
      **success** (09:52 UTC), read at the step itself because the step
      is `continue-on-error` and only its own outcome counts — which is
      exactly the check this box prescribed. That one green step also
      closes the redeploy debt 0.3 and 2.7 share with this box: the
      D116-corrected `privacy.html`, the filled terms values and the
      AASA published together. Original instruction: open
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
      **Closed 2026-08-20**: hosting has deployed green repeatedly since
      (see 0.2), so the live page carries the filled values.
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
- [ ] **1.1b [UN-PARKED — D345] Register the ENK and apply for the D-U-N-S.**
      *Not being done: Play is deferred until iOS has users.* Notify Brønnøysundregistrene via Altinn; registration in
      Enhetsregisteret is free and yields the organisasjonsnummer a D-U-N-S
      application needs. The D-U-N-S itself is free from D&B, usually ~1–2
      weeks, quoted up to ~30 business days. Everything else on this list
      runs while it waits. `D41`.
- [ ] **1.2 [UN-PARKED — D345] Google Play Console account — as an
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
      Integrity) is **[UN-PARKED — D345]**. Do this on day 1 so the soak
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

      **AND THE REMAINING HALF IS NOT BEING DONE (D337, 2026-08-30).**
      The owner's reading, checked against the tree and correct: there is
      no public web client and none is planned. `web/` is seven static
      pages, none of which loads Firebase — `web/home.html` says so in its
      own comment, *"Deliberately NOT the app: InSight is a native
      product"* — and the shipping product attests through DeviceCheck.
      So the web reCAPTCHA provider was never for users. It is for the two
      browsers that read production Firestore: **a developer's, and the
      screenshot job's**, both of which stop working the moment 3.4 flips.
      This step never said that, which is why it read as a launch item.

      **The supported answer for both is a debug token, not reCAPTCHA** —
      Firebase's own debug-provider documentation says so for CI, and the
      reason is that reCAPTCHA v3 scores behaviour and a headless browser
      is what it is built to score low. `src/lib/appcheck.ts` takes one in
      `VITE_APPCHECK_DEBUG`: `true` mints a token and prints it for you to
      register once, any other value IS a registered token, which is the
      only form a job can use.

      **The three actions, in order. Two tokens, not one** — a token is a
      credential, and one shared between a laptop and a public CI log is
      revoked in both places at once when either leaks:

      1. **Mint yours.** Put `VITE_APPCHECK_DEBUG=true` in `.env` and run
         the app locally. The browser console prints the token.
      2. **Register it.** Firebase Console → **App Check** → **Apps** →
         the web app → the three-dot menu → **Manage debug tokens** →
         paste it in.
      3. **Repeat for CI**, with its own token, and put that one in
         GitHub → Settings → Secrets and variables → Actions as
         **`APPCHECK_DEBUG_TOKEN`**. That is the name
         `.github/workflows/screenshots.yml` already reads.

      All three before 3.4, not after — the flip is what makes them
      load-bearing.

      **A debug token is a bypass, not an attestation.** Whoever holds it
      is past App Check. One per environment, in secrets, never in a build
      that reaches users — `shipsDebugToken` in `scripts/appcheck-guard.ts`
      refuses a production build carrying one, which is why the screenshot
      job builds `--mode capture`. Provision reCAPTCHA only if a public
      web build ever ships.

      DeviceCheck needs a `.p8` key, not a toggle — an earlier note in
      this conversation said "one click, no keys" and that was wrong.

## Phase 2 — Wire the native builds (needs Phase 1 accounts)

- [ ] **2.1 [UN-PARKED — D345] Android config.** Firebase Console → Project settings → Add app
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

      The way to make that comparison is to read the **upload step's own
      conclusion** on the release runs — `success` spent a number,
      `skipped` did not — rather than to read this file. Runs 15 and 16
      are the worked example: same commit `2933dc0`, eight minutes apart,
      `skipped` then `success`, so only one of the two spent a build.

      **BUILD 12 UPLOADED 2026-08-13** (run 18, `d0cf435`, 5m 32s, upload
      step `success`). Builds 11 and 12 went up a day apart — run 17
      (`ac61c37`, 2026-08-12) carried D103–D116, and run 18 carried
      D118–D129's handles, dedup gate, cost ceilings, who-voted turn,
      Foresight read half and polled deck.

      **The bump after run 18 did not happen, and that is the first time
      this convention's FIRST half has been skipped.** The section above
      warns about bumping too eagerly, because that is the way it had
      failed before; this is the other way, and it is the expensive one.
      `appBuild` sat at 12 with build 12 already on App Store Connect, so
      the next run would have archived, exported, passed both gates,
      transferred the binary and *then* been refused — a full run for a
      number. It was caught on 2026-08-13 by making the comparison
      against run 18's step list, which is the only thing in this
      procedure that can catch it.

      **What made it worth catching is that this file said otherwise.**
      The paragraph here read *"Build 12 is pre-flighted and unspent"* —
      written in `d0cf435`, which is the exact commit run 18 then
      uploaded. The assertion was true when it was committed and false a
      few hours later, and nothing in the repo can see App Store Connect
      to notice (D73's shape, one layer out). **So the comparison is the
      procedure and this paragraph is only its record**: where the two
      disagree, the run list wins.

      **READ `appBuild` AT THE RUN'S OWN `head_sha`, NOT AT THE COMMIT YOU
      MERGED.** The two are routinely different now and run 22 is the
      worked example: the release prep merged as `6a98697`, and by the time
      the dispatch was accepted a Routine had pushed a pulse trail row, so
      run 22 archived **`67af354`**. `appBuild` was 16 at both, so nothing
      was harmed — but the comparison is only sound if it is made at the
      sha the run actually built. D159 has why this is new: since D145 gave
      the question lanes and the pulse their Routines, `main` has an
      automated writer, and the window between merging a release commit and
      dispatching from it is no longer quiet.

      **BUILD 21 IS IN TESTFLIGHT, AND THE NUMBER MOVED WITH IT**
      (2026-08-19). Run 32 (`32228796376`, `d547f7a`, 07:38:55Z) was the
      dry run — step 17 `skipped`, 5m 18s, signed `.ipa` kept as artifact
      `9356608227` — and run 33 (`32229389551`, same sha, 07:46:29Z)
      uploaded: step 17 `success`, 07:52:10Z → 07:54:11Z, 2m 01s of
      transfer, `UPLOAD SUCCEEDED with no errors`, delivery UUID
      `f1ab4ae5-0673-4a89-a4f3-c3ab03c6e87d`. Both silent-failure gates
      passed at both ends on both runs — `aps-environment = production`
      out of the exported `.ipa`, Firebase config in the bundle.

      **`appBuild` is now 22, read off step 17 rather than recalled.**
      Five bumps have held (runs 20, 21, 22, 28, 33) against five skipped
      (18, 19, 24, 26, 31). D159's trap fired once more and cost nothing:
      `5c9c4a5` merged, both runs archived `d547f7a` after a pulse trail
      row landed in between, and `appBuild` was 21 at both. D199.


      **BUILD 20 WAS UPLOADED BY RUN 31, AND BUILD 21'S PRE-FLIGHT HAD TO
      BUMP** (2026-08-19). Three runs sit at `f8c8465` and no document
      named any of them: run 29 (`32019625202`, 10:19:31Z) cancelled at
      Resolve Swift packages, run 30 (`32019849917`, 10:22:28Z) upload
      step `skipped` — the dry run — and run 31 (`32020442257`,
      10:30:02Z) `success`, 10:34:21Z → 10:35:38Z, 1m 17s of transfer.
      `appBuild` at that run's own `head_sha` is **20**, and the tree was
      **also** at 20: equal is not greater, so **bump**, and it went to
      21. Fifth skip (18, 19, 24, 26, 31) against four that held.

      **The skip refutes the explanation the entry below earned.**
      `f8c8465` is D191's own commit, and it landed at 10:19:05Z — run 29
      was dispatched **26 seconds later**. Same session, run list on
      screen, cancelling one of its own three dispatches: it made the
      comparison *first*, got *run as-is*, and then spent the number that
      answer was about. So a pre-flight verdict has a shelf life of
      exactly one dispatch, and "no number moved" is a report about a
      comparison rather than a statement about the tree — the same claim
      this section struck for build 12, in the past tense. As at runs 25
      and 26, no record was written either, so a gate keyed on the record
      would again have had nothing to fire on. D198.

      **BUILD 20'S PRE-FLIGHT FOUND NOTHING TO DO** (2026-08-17). The
      comparison was made against the run list: run 28 is still the
      highest run, its step 17 still `success`, and `appBuild` at that
      run's own `head_sha` (`e76731d`) is 19 against a tree at 20. So
      `appBuild` is already ahead of the highest build App Store Connect
      has seen — **run as-is**, and no number moved. Third pre-flight to
      come out this way (D153, D158, D191), and all three follow a
      release where the bump was made off the step list in the session
      that dispatched the run. D191.

      **BUILD 19 WAS UPLOADED BY RUN 28** (`e76731d`, 2026-08-16 18:13Z,
      5m 23s, upload step `success`, 1m 16s of it transfer). Run 27 is the
      **same commit six minutes earlier** with its upload step `skipped` —
      the dry run — making it the fourth pair of this shape. Both
      silent-failure gates passed at both ends: the archive carried the
      Firebase config and the APNs entitlement, and the exported `.ipa`
      was production-signed.

      **`appBuild` is now 20, bumped off step 17's own conclusion in the
      same session that dispatched the run.** Four bumps have now held
      (runs 20, 21, 22, 28) against four skipped (18, 19, 24, 26). What is
      new here is that the dry run, the upload, the bump and the record
      were one session rather than four — the bump was made *from* the
      step list, not from a memory of it, which is the only arrangement
      that has ever worked. D186.

      **BUILD 18 WAS UPLOADED BY RUN 26** (`810b3af`, 2026-08-16 15:08Z,
      6m 32s, upload step `success`, 1m 39s of it transfer). Run 25 is the
      **same commit seven minutes earlier** with its upload step `skipped`
      — the dry run — making it the third runs-15/16-shaped pair after runs
      23/24.

      **The bump after run 26 did not happen either, and neither did the
      record.** That is four skips (runs 18, 19, 24, 26) against three that
      held (20, 21, 22), and it is a different failure from D180's. There,
      somebody came back *specifically to record* the upload and left the
      integer; the proposed remedy followed that shape — a gate asserting
      `appBuild` exceeds whatever build this file claims was uploaded.
      **Here nothing was written down at all**: no mention of run 25, run
      26, either run id, or build 18 being delivered existed anywhere in
      `docs/`, so that gate would have been silent. The tree was returned
      to twice after the upload — #201 at 15:51Z and #202 at 16:48Z — by
      sessions doing feature work, which had no reason to touch a build
      number. **The invariant that would actually hold keys on the run
      list, and nothing here can read it** (D73's shape again). Caught
      2026-08-16 by build 19's pre-flight. D184.

      **BUILD 17 WAS UPLOADED BY RUN 24** (`9a5f803`, 2026-08-15 18:31Z,
      8m 42s, upload step `success`, 1m 55s of it transfer). Run 23 is the
      **same commit eight minutes earlier** with its upload step `skipped`
      — the dry run — which makes it the second runs-15/16-shaped pair and
      the reason the conclusion is read per STEP: both runs are `success`
      at the job level and only one of them spent a number.

      **The bump after run 24 did not happen**, and it is the third time
      (runs 18, 19, 24) against three that held (runs 20, 21, 22).
      `appBuild` sat at 17 with 17 already delivered, caught 2026-08-16 by
      build 18's pre-flight. **What is new is that somebody did come back
      to the tree.** Commit `5798623` — "Build 17 is in TestFlight" —
      returned the next day *specifically to record this upload*, cited the
      run id, noted the dry run, wrote sixteen lines into 3.2 below, and
      left the integer at 17. So D143's gap ("the upload finished" vs
      "someone came back") is not the mechanism: **the record and the
      number are two separate edits, and only one of them has a habit.** A
      session can discharge the whole felt obligation and still leave the
      number that costs ~150 minutes of macOS quota. D180.

      **BUILD 16 WAS UPLOADED BY RUN 22** (`67af354`, 2026-08-15 11:07Z,
      5m 25s, upload step `success`, 1m 23s of it transfer). Both APNs
      gates passed and the Firebase config was verified in the archive and
      again in the exported `.ipa`. **`appBuild` is now 17**, bumped off
      that step's conclusion in the same session — the third consecutive
      release where the habit held.

      **BUILD 15 WAS UPLOADED BY RUN 21** (`3c03752`, 2026-08-14 20:58Z,
      7m 05s, upload step `success`, 1m 26s of it transfer). Both APNs
      gates passed and the Firebase config was verified in the archive and
      again in the exported `.ipa`. **`appBuild` is now 16**, bumped off
      that step's conclusion in the same session — the second consecutive
      release where the habit held rather than being reconstructed later.

      **BUILD 14 WAS UPLOADED BY RUN 20** (`8cf48a1`, 2026-08-14 16:39Z,
      7m 32s, upload step `success`, 1m 42s of it transfer). Both APNs
      gates passed and the Firebase config was verified in the archive and
      again in the exported `.ipa`. **`appBuild` is now 15**, bumped
      immediately after that conclusion was read — the convention D142 and
      D143 exist because it was skipped twice running.

      **BUILD 13 WAS UPLOADED BY RUN 19** (`0e65741`, 2026-08-13 20:19Z,
      6m 58s, upload step `success`) — the run dispatched from the very
      commit that wrote the paragraph below.

      *This file states what finished runs did. It does not state what is
      unspent, and the section below is why.*

      **THE PARAGRAPH BELOW IS KEPT AS A RECORD OF THE TRAP FIRING A THIRD
      TIME, AND IT IS WRONG.** It says build 13 is unspent; run 19 spent
      it about two hours after the commit landed. This is now three for
      three — D130 wrote "Build 12 is pre-flighted and unspent" in the
      commit run 18 uploaded, D142 caught that and wrote the identical
      sentence about build 13 in the commit run 19 uploaded. **A status
      line in this file cannot survive the run it describes**, because the
      run happens after the commit and nothing in the tree can see App
      Store Connect (D73's shape, one layer out). Read the run list, never
      this paragraph:

      > **Is `appBuild` greater than the highest build in App Store
      > Connect?** Read the `Upload to App Store Connect` step's own
      > conclusion on the newest release run — `success` spent that
      > build, `skipped` did not.

      *Build 13's pre-flight, 2026-08-13 (D142), kept as its record —* it
      read "pre-flighted and unspent", 13 > 12 verified against run 18
      rather than assumed, and run 19 spent it hours later. Every gate in
      6.1 passed, along with the full suite: 969 client tests, 203
      function tests, 83 rules tests, 168 script tests, lint, `tsc -b`,
      `check:globals` at its baseline, and 28 of the 29 check gates. The
      one that does not pass locally is environmental and is not a defect:
      `check:web-firebase` reads `VITE_FIREBASE_*` from repository
      *variables* that exist only in CI, which is the point of it running
      after the build, in the workflow, against `dist/`. (`check:fn-runtime`
      is no longer on that list — it passes once `npm run build --prefix
      functions` has run, and this pre-flight ran it.) **`test:rules` needs
      `HTTPS_PROXY` unset**, per CLAUDE.md; with it set the emulator dies
      naming neither the host nor the proxy.

      What build 13 carries that 12 did not: D131's written-down region
      decision, **D132 and D133 — two defects found in build 12 itself**,
      D134's test-track sign-in wall, and D135's Overview-first Mirror
      stops. D132 is the one that justifies the release on its own: every
      instrument read "0 of N answered" to someone who had answered them
      all, because `LIVE.myVotes()` is string-valued and the fold gated on
      `Number.isInteger`.

      **Build 14 pre-flighted 2026-08-14 (D143).** `appBuild` 13 → 14,
      propagated to `versionCode` and `CURRENT_PROJECT_VERSION`. Measured,
      not asserted: 984 client, 214 function, 168 script tests, `lint`,
      `tsc -b`, `check:globals` at its 414 baseline, and every check gate
      except `check:web-firebase` — environmental, as below. `test:rules`
      and the three e2e suites are green on CI run 394 at this tree.

      **`check:bundle` was RED on main and this pre-flight is what found
      it** (CI run 394, `typecheck-build`). The **total** was 36 KB over —
      2220 against 2184 — from D137–D141's features, all of it in lazy
      chunks. The **eager** graph, which is the half that guarantees
      something, measured 963 against 966 and was never in danger. Ceiling
      raised to 2230 with the arithmetic in `scripts/check-bundle.mjs`;
      D143 has why a raise rather than a trim, and why the eager constant
      was not touched.

      What build 14 carries that 13 did not: D137's global-bridge sweep,
      **D138's suggestion board and its server** — the first collection
      users write free text into — D139's daily pulse, **D140's height
      band**, the eighth anchor and seventh breakdown dim, and D141's
      type-mix card on the People lens.

      **The store filing moved for the first time since D116, and only its
      reasoning.** Question suggestions and the height band both land in
      rows that were already Yes, so nothing needs re-typing into App Store
      Connect — but *Other User Content* said "answers and test results",
      which a free-text suggestion is not, and the **Health** row went from
      obviously-No to a judgement the moment a body measurement entered the
      profile. Both are written out in docs/STORE-FORMS.md, the second with
      the trip-wire that flips it (weight, or anything that makes a BMI).

      **`check:bundle` used to pass locally on a bundle nobody ships, and
      since D144 it refuses to.** Two variables decide which artifact you
      are weighing: without `VITE_SENTRY_DSN` the build omits a 445 KB
      chunk, and without `VITE_V2_LIVE=true` it is the demo bundle — 12 KB
      lighter in total and 9 KB lighter in the eager graph than the one
      that installs. The script now exits 1 unless the second is set, so
      the answer is the command in docs/LOCAL-TESTING.md rather than a
      caveat to remember. The release workflow runs the same gate on its
      own `dist/`, which is the copy that gets signed.

      **Build 15 pre-flighted 2026-08-14 (D153) — and nothing was
      bumped, which is the finding.** Run 20's `Upload to App Store
      Connect` step reads `success` and `appBuild` at `8cf48a1` was 14, so
      build 14 is spent and the tree's 15 is already ahead. The question
      above answers *run as-is*. **Three pre-flights in a row opened on a
      spent number and this one does not**, because run 20's post-upload
      bump landed in the session that read its step list — the one thing
      D143 named as making the difference.

      Measured, not asserted: 1064 client, 214 function, 183 script and 89
      rules tests, `lint`, `tsc -b`, `check:globals` at its 412 baseline,
      and every check gate. `check:store-copy` passes with `--ios` (D42's
      parked Play fingerprint is the one placeholder) and
      `check:web-firebase` is environmental, as below. CI run 436
      (`2423e4f`) is green across all nine jobs, `native-sync-drift`
      included — which is the one that speaks to this release, since build
      15 carries `@capacitor/ios` 8.3.3 → 8.4.2 and two more shell-facing
      bumps.

      **`check:bundle` is green on the shipping bundle for the first time
      at a pre-flight**: 2255 KB total against 2265, 969 KB eager against
      978. It was the yield of both previous pre-flights and, at D143, red
      on a bundle nobody installs; D144 re-pointed it. Both numbers now sit
      single-digit KB under their ceilings, so the next feature of any size
      meets one of them.

      *One test failed once under parallel load and passed 3/3 alone and
      1064/1064 on two clean runs —* `learn-reserve.test.jsx` spends ~10.8 s
      of the 15 s timeout it sets itself, so a loaded runner can exhaust it.
      D153 has the arithmetic; read it before calling a red there a D95
      regression.

      **Build 16 pre-flighted 2026-08-15 (D158) — and again nothing was
      bumped.** Run 21's `Upload to App Store Connect` step reads
      `success`, `appBuild` at `3c03752` was 15, and no run 22 exists, so
      build 15 is spent and the tree's 16 is already ahead. **Second
      pre-flight running to answer *run as-is*, and second release running
      whose bump landed in the session that read the run's step list** —
      D143's gap, closed twice now rather than once.

      Measured, not asserted: 1152 client, 214 function, 183 script and 90
      rules tests, all three e2e suites, `lint`, `tsc -b`,
      `check:globals` at **409** (down from 412 — `edf18d8` took three off
      the ratchet), and every check gate. CI run 449 (`f159af9`) is green
      across all nine jobs. `learn-reserve.test.jsx` passed this time,
      1152/1152 in one clean run; D153's thin-margin note stands as one
      sample against this one.

      **Three gates are environmental, not the two D153 listed.**
      `check:fn-runtime` joins them: it reads `functions/lib/index.js`, so
      run `npm run build --prefix functions` before a local battery or it
      is the one red you get. `check:store-copy` still needs `--ios` (D42's
      parked Play fingerprint) and `check:web-firebase` still needs CI's
      variables — verified here against an injected config, which proves
      the mechanism and not the values.

      **`check:bundle` is green, and the total's headroom is the tightest
      it has been on a release path**: 2278 KB against 2285, so 7 KB, where
      build 15 had 10. The eager graph went the other way — 961 against
      978, 17 KB of room, up from 9 — because build 16's features landed
      lazy. The total is the ceiling with a raise history; the eager one is
      not, and D144 and D152 both declined to move it.

      **Build 16 changes nothing under `ios/`, `android/` or either
      `package.json` except the build number.** Build 15 carried
      `@capacitor/ios` 8.3.3 → 8.4.2 and two more native bumps; this one is
      a pure JavaScript payload — D154's Map boundary, D155's bottom-pinned
      tabs and exact age, D156's rebuilt 1v1 and Group, D157's test
      surfaces — so the archive has less new surface than the last run that
      succeeded, and the store filing does not move.

      **Build 19 pre-flighted 2026-08-16 (D184) — and this one bumped
      too.** Run 26's upload step reads `success` and `appBuild` at
      `810b3af` was 18, so build 18 is spent and the tree's 18 was NOT
      ahead. `appBuild` 18 → 19 by hand, propagated by `--fix` to
      `versionCode` and both `CURRENT_PROJECT_VERSION` entries. Two
      pre-flights running have now had to bump.

      **Build 19 is a pure JavaScript payload**, the first since build 16.
      Against run 26's commit it touches nothing under `ios/` or
      `android/`, neither lockfile, neither rules file, and neither
      store-filing file — 57 files, +1367/−609, all `src/`, `docs/` and
      `web/privacy.html`. It carries **D181** (Near's field drew the city
      it is not about, reported from a device) and **D182/D183** (the copy
      pass, and the long disclosures moving out of the app into
      `web/privacy.html` behind `check:policy-claims`). **So 4.4's store
      filing does not move** and stands at the nine rows D180 corrected it
      to — the window that opened there is unchanged, not closed: the live
      label still describes build 17.

      **The bundle's tight half moved the right way.** D180 left the eager
      graph at 975 against 978 and named the answer "trim, not raise". The
      copy pass trimmed it: **2321 KB total / 970 KB eager** against
      2334 / 978, measured in the workflow's own build shape. First time
      the eager number has gone *down* on a release path.

      Measured, not asserted: **1216 client, 202 script, 228 function and
      106 rules tests**, all three e2e suites green (each `npm` exit 0 with
      its own `Script exited successfully`), `lint`, `tsc -b`,
      `check:globals` at **409** across 183 files — its baseline, unmoved.
      **D183 shipped with `test:rules` and the e2e suites unrun** for want
      of Java 21 in its authoring environment; they were run here, so that
      gap is closed rather than inherited.

      **Build 18 pre-flighted 2026-08-16 (D180) — and this one bumped.**
      Run 24's upload step reads `success` and `appBuild` at `9a5f803` was
      17, so build 17 is spent and the tree's 17 was NOT ahead. `appBuild`
      17 → 18 by hand, propagated by `--fix` to `versionCode` and both
      `CURRENT_PROJECT_VERSION` entries. Three pre-flights running had
      answered *run as-is*; this one does not, and the paragraph above
      about run 24 has why.

      **It was pre-flighted twice, because #199 landed underneath it** —
      D170–D179, which also took this entry's original number. Every figure
      here is the re-measurement against the merged tree. That is worth
      naming as a shape rather than an accident: a pre-flight measures a
      tree, `main` has automated and human writers, and the answer is
      re-measurement rather than a faster hand. D159 made the same point
      about the *commit* a dispatch archives.

      Measured, not asserted: **1218 client, 228 function, 183 script and
      106 rules tests**, all three e2e suites, `lint`, `tsc -b`,
      `check:globals` at **409** (its baseline, unmoved — the payload added
      no coupling), and 28 check gates. The same three are environmental as
      at D158, and `check:web-firebase` has a wrinkle worth knowing: it
      reads `VITE_FIREBASE_*` from the **environment** as well as from
      `dist/`, so it must run inside the same env block as the build —
      which is how the workflow invokes it, and is not obvious from the
      name. Verified against an injected config: 72 chunks carrying a fake
      project id.

      **6.1's own `cap sync` found a drift that had been in the tree since
      build 15.** `ios/App/CapApp-SPM/Package.swift` pinned
      `capacitor-swift-pm` at `8.3.3` while `@capacitor/ios` has been 8.4.2
      since dependabot's `831f808`; the file had never been committed at
      8.4.2. **Nothing shipped wrong** — both `ios-build.yml` and
      `ios-release.yml` run `cap sync` before building, so every archive
      since build 15 used 8.4.2 from a regenerated file — but a human
      opening Xcode without syncing resolved a different Capacitor than the
      release did. `native-sync-drift` had been reporting it all along as a
      `::warning::` whose step exits 0, so that job being green has never
      meant *in sync*. #199's own sync committed the identical line hours
      later, so the fix landed twice and the merge is a no-op on that file.

      **`check:bundle` is green, and the tight half is now the one that
      cannot be raised.** 2329 KB total against a ceiling #199 moved to
      2334, so 5 KB — but the **eager graph reads 975 against 978, 3 KB**,
      where build 16 had 17. That constant is the one D144 and D152 each
      refused to raise and whose own header says it cannot be. The total
      has a raise history; the eager one has a refusal history, so the next
      change landing in the entry graph meets a "trim, not raise" answer.

      **Build 18 is NOT the pure JavaScript payload build 16 was**, and
      this line said it was until #199 merged. It now carries
      `ios/App/App/Info.plist`, `android/…/AndroidManifest.xml`,
      `storage.rules` (+58), `firestore.rules` (+196) and ~740 lines across
      `functions/src`. `package-lock.json` is still untouched, so no
      dependency moved — but the archive has real new native surface, and
      the plist change alters what the OS prompts for.

      **The store filing moves, for the first time since D141**, and 4.4
      below has the detail: **PRECISE_LOCATION** (D175 — the app now
      requests a precise fix) and **PHOTOS_OR_VIDEOS** (D178 — an optional
      profile photo). Nine rows, not seven. **The upload does not need the
      label updated first; the submission does.**

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
- [ ] **2.6 [UN-PARKED — D345] Android signing.** Generate the upload keystore **outside the
      repo**, and **enrol in Play App Signing** so a lost upload key is
      recoverable. Before the first release commit run `git status
      --ignored` and confirm nothing sensitive is tracked — a `git add -A`
      after a signing session is an incident a revert cannot fix.
      `SHIP-CHECKLIST § hardening`.
- [ ] **2.7 The app-link fingerprints — the file is filled, the deploy
      landed 2026-08-20 (see 0.2); the on-device link tap is what
      remains.** `web/.well-known/apple-app-site-association` carries the real
      Team ID as of 2026-08-05 (`U2LVW456S7.com.cosaxo.insight`). The
      `assetlinks.json` SHA-256 comes from Play Console → Setup → App
      signing. **[UN-PARKED — D345]**, so this is now an unfinished task
      rather than the permanent non-blocker it was while Play was
      deferred: `check:store-copy` reports it until the Play Console
      issues the fingerprint, and `--first-upload` is the flag that
      excuses it for the upload that mints it.

      **The hosting redeploy this step shared with 0.2 and 0.3 landed**
      (2026-08-20 — see 0.2), so the live AASA carries the Team ID and
      what remains is on-device: reinstall and tap a `/join/CODE` link.
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

- [ ] **3.1 [UN-PARKED — D345] Upload a signed AAB to a Play testing track.** With the organization account (D41) this is testing, not a
      gate — no tester minimum, no 14-day clock, and no reason to wait for
      a headcount before uploading. Use it the way TestFlight is used in
      3.2: real installs on real Android hardware, duels first.

      *If the org exemption did not hold and the account is personal:* this
      upload is what starts the 14 days, and it needs **12+ testers who
      actually install** — churn mid-window resets nothing, but a drop
      below 12 pauses progress.
- [ ] **3.2 TestFlight — two testers is enough to start. THE "TEN" WAS
      PRE-D98 AND IS RETIRED HERE.** This step read *"ten testers, not
      five"* and gave the reason in its own next clause: *"the public
      mirror publishes once per 5 answers (D7), so a group of 6–9 watches
      the world count sit on '5+' and never move — accurate, and it reads
      as broken."* **That machinery no longer exists.** D98 removed the
      k-floor outright on 2026-08-11 — `AGG_MIN_N` and `PUBLISH_EVERY` are
      gone, and `functions/src/v2.ts` says so where they used to live —
      so a count of 1 is published as 1. The step even carried the
      correction further down (*"There is no k-floor since D98: the first
      answer publishes exactly"*) while its heading still demanded a
      crowd the removed cadence needed. One step, two answers; D98's is
      the live one.

      **So the tester count is a bug-finding decision, not a threshold.**
      Test **duels first**: they work at N=2, need no crowd, and are the
      most distinctive surface in the product. Two phones exercise
      everything that needs more than one person — the sealed duel and
      its next-day reveal, cross-device push, a second name in the
      who-voted sheet. Add testers to widen device and iOS coverage,
      which is a real reason; do not wait on a headcount to start.
      `SHIP-CHECKLIST §3`.

      **Build 1 is in TestFlight and an external group was submitted for
      Beta App Review 2026-08-07.** What is left here is people, not setup.

      **Build 17 uploaded 2026-08-15** (`ios-release.yml`, run
      31901336491) — the first build carrying the D161–D165 work: the
      paged bank fetch, the `core` corpus flag, and the move to the
      `insight` / `europe-west1` database. The dry run (`upload=false`)
      was run first and went green before the upload, which is the order
      that workflow's header asks for and the reason a bad archive did
      not spend the build number.

      **This is the first build that talks to `insight` rather than
      `(default)`,** so it is the one that proves the migration end to
      end on a real device. Two things worth watching on first launch,
      because both would be silent: the daily card renders (the bank
      loaded from the new database) and answering it moves the count (the
      trigger fired on the new database — D165's third silent failure is
      exactly a trigger that never runs).

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
      working, not a leak — the 845 seeded questions are live regardless.
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

      **Two browsers break on this flip, and both are yours.** A dev
      browser and the screenshot job read production Firestore without
      attesting, which is fine only while enforcement is off. Register
      the debug tokens 1.4 describes BEFORE flipping: afterwards a
      screenshot run fails at the size gate with nothing in its output
      about why, and `npm run dev` against real data simply stops
      returning rows.

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
- [x] **4.3 Marketing copy — pushed 2026-08-08, CORRECTED 2026-08-12,
      RE-PUSHED the same evening, and this box only learned that
      2026-08-20 (see the correction below).**
      `design/store/listing.json` carries every field both consoles ask
      for; `npm run check:store-listing` holds each against its character
      limit (all currently fit, the longest at 161/170). No placeholders
      remain: `shared.supportEmail` was filled with 0.3's address on
      2026-08-03.

      **Unticked on purpose while the store served stale copy — resolved;
      the paragraph after next has the evidence.** The
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
      panel. **"App Store Connect still serves the old text" — it does
      not, and it had not for eight days when this box was re-read on
      2026-08-20**: metadata run 9 was the dry run and run 10 the apply
      (2026-08-12 19:02 UTC, `what=all`, on the correction commit
      itself), and run 10's summary reads **"Applied."** The box stayed
      unticked because nothing in the repo can read the store — the
      D74/D75 limitation — but the run log CAN be read, and reading it
      is what closed this. Run 11 (2026-08-20, privacy report) reported
      "nothing to write" against the same key, so the pipe still works.

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

      **Declared 2026-08-07. The document arrived 2026-08-30**, 23 days
      later — the *bostedsattest* from Skatteetaten, which is the
      Norwegian record that fits Apple's ask for proof of address. The
      wait this step was open for is over, and both of the exits it
      carried are spent.

      **It is not in this repo, and it must not be.** The page carries a
      fødselsnummer and a date of birth next to the address, and a git
      history is the wrong place for any of the three — irrevocable by
      construction, and mirrored by every clone. What is recorded here is
      that the document arrived, not what it says.

      **Uploaded 2026-08-30**, through App Store Connect → **Business**
      → *Trader Status*. **The step stays open anyway, and D74 is why:**
      the upload is a fact, EU distribution being unblocked is not one
      yet. It closes when the console reports the status verified — that
      is Apple's to run, not work in this file. If the document comes
      back instead, the open question is whether to send the
      fødselsnummer unmasked: Apple's wording asks only for records
      verifying **name and address**, so no part of the form needs it,
      and that is the owner's call rather than this file's.

      **Nothing below waits on it.** Verification gates ONLY EU
      distribution — Norway is EEA (D69), so submission (6.2),
      TestFlight and every non-EU storefront are untouched while it
      runs. Pricing and Availability can still exclude the EU 27 at
      launch and add them on verification without a new review, which
      stays the way to register the ENK (D69's way out) before the home
      address publishes on any listing.
- [ ] **4.4 The privacy nutrition label — the last form, and it is manual.**
      Mandatory; Apple accepts no submission without it.

      **NINE ROWS SINCE D175 AND D178, AND THIS STEP SAID SEVEN UNTIL
      BUILD 18's PRE-FLIGHT.** Precise Location and Photos or Videos are
      now declared, and the paragraph below used to end *"Coarse Location,
      never Precise"* — the exact claim D175 reversed. #199 changed
      `app-privacy.json`, `STORE-FORMS.md` and the gate, and did not come
      back for this step, so the instruction for typing the form was
      telling you to under-declare two rows. That is the direction
      `app-privacy.json` itself calls "the direction that gets an app
      pulled", in the one step whose output is a legal statement. D180.

      **Apple's API cannot write it.** Not through another path — there is
      no App Privacy resource in the App Store Connect API at all, verified
      three ways (D73). So **Actions → App Store metadata** with *privacy*
      selected prints the form, row by row, in the order App Store Connect
      asks, and you copy it across: **11 data types**, each **linked Yes
      / tracking No**, ten of them **App Functionality** and Product
      Interaction **Analytics**, tracking overall **No**. ~15 minutes, and
      nothing recalled from memory — least of all from this paragraph,
      which is why the printout is the artefact and the prose is not.

      **The two new rows ship in build 18, so the label and the binary move
      together or the label is wrong.** Uploading does not need it —
      TestFlight internal testing has no review gate — but **submission
      (6.2) does**, and the gap between them is the window where the live
      label describes a build that no longer exists.

      **IT WENT STALE TWICE MORE, THE SAME WAY, AND THE SECOND TIME MADE
      A SENTENCE FALSE RATHER THAN SHORT** (D273, build 25's pre-flight).
      `ca8f4eb` took `app-privacy.json` to ten rows — D203's Health row,
      the pulse's sleep and energy questions — and did not come back here,
      two days after D180 diagnosed exactly that. D272 then took it to
      eleven, and Product Interaction is the first row in the filing whose
      purpose is **Analytics** rather than App Functionality, so the
      blanket "each App Functionality" above stopped being a shorthand and
      started being wrong. Under-declaring by two rows, twice, in the one
      step whose output is a legal statement.

      **`check:figures` owns the row count now**, read off
      `app-privacy.json`'s `collected` array, so this sentence is current
      or CI is red. That is 5.6's remedy applied to 4.4 — the same fix,
      after the same failure, for the reason D39 gives. It holds the
      *count*; nothing can hold the purposes, so read the printout.

      **The engagement ladder's row ships in build 25** (D268–D272), so
      this is build 18's situation again: the label and the binary move
      together or the label is wrong.

      **Read `STORE-FORMS.md` before typing.** What you are entering is a
      legal statement about what the app collects. The printout transcribes
      that decision; it does not make it. Doing it from memory was never
      the safeguard it looked like — it is ~40 clicks that must agree with
      `data-inventory.md`, with nothing checking that they do, which is
      exactly how one false claim survived in three documents at once.

      The three that bite, and why each is worth knowing before you
      approve: **Tracking = No** (no IDFA, no ATT prompt, no ad SDK — the
      Facebook SDK is stripped at postinstall and asserted by
      `check:ios-facebook`); **Location = Yes on BOTH rows since D175**
      (the app asks the OS for a precise fix, so the label says Precise
      whatever the app does with it next — the coordinate is still folded
      to a ~220 m cell on the device and discarded; `check:store-forms`
      now holds the row and `NSLocationDefaultAccuracyReduced` to each
      other **in both directions**, so it fails if either moves alone
      rather than failing whenever Precise appears); **Photos or Videos =
      Yes since D178** (an optional profile photo, off by default, EXIF
      dropped on the device); **Sensitive info = Yes** (the politics
      result is GDPR Art. 9 data — the form asks what you *collect*, not
      what you publish).

      Three look tickable and are not — the printout names them with the
      reason: **Device ID** (D29 binding holds no identifier server-side),
      **Product Interaction** (no analytics ship), **Emails or Text
      Messages** (a take is a post to a circle, not a message to a person,
      and its content is already declared under *Other User Content* —
      D79; the reason used to be "no live free-text surface" and D78 part 1
      ended that).

      *Play's Data Safety form is **[UN-PARKED — D345]**.*

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

- [x] **5.1 Enable TTL on all THREE collection groups that stamp
      `expireAt` — DONE 2026-08-27 (D333), all three `ACTIVE` on the
      `insight` database.** Set through the Firestore Admin REST API with
      the deploy credential and read back the same way:
      `ttlConfig.state=ACTIVE` for `v2_agg_events`, `engagement` and
      `v2_ratelimits`. The privacy page's 90-day rolling-window sentence
      is now held by a real setting.

      **The command below was wrong in one silent way, and it is kept as
      the record:** it names no `--database`, and gcloud defaults that to
      `(default)` — which on 2026-08-27 still existed. All three
      collection groups live in `insight` (`functions/src/db.ts`), so the
      command as written would have configured TTL on a database none of
      them are in, reported success, and left all three policies exactly
      as unverifiable as this step complained. Add
      `--database=insight` if it is ever re-run:
      ```bash
      for cg in v2_agg_events engagement v2_ratelimits; do
        gcloud firestore fields ttls update expireAt \
          --collection-group="$cg" --enable-ttl --project=prvfire33 \
          --database=insight
      done
      ```
      Stamping `expireAt` does nothing on its own — a TTL policy is a
      per-collection-group setting on the database, and the field is inert
      until somebody turns it on. Nothing in this repository can read
      whether one is enabled, so the verification above lives in D333
      rather than in a gate.

      This step named `v2_agg_events` alone until 2026-08-26, which
      under-counted the console work by two and left out the half with a
      promise attached:

      - **`v2_agg_events`** — the aggregate event ledger. Without the
        policy it grows forever (`SHIP-CHECKLIST §5`).
      - **`v2_users/{uid}/engagement/{yyyy-mm-dd}`** (D272,
        `ROLLUP_TTL_DAYS = 90`) — **`web/privacy.html` promises this one in
        so many words**: "each note deletes itself 90 days after its day,
        so the account-linked trail is a rolling window". Deleting the
        account still erases it immediately (phase 1b's recursive delete,
        asserted in `e2e-delete-account.mjs`), so the promise's *erasure*
        half holds regardless — it is the ROLLING-WINDOW half that is a
        console toggle nobody was asked to flip. A promise in a privacy
        policy kept by a setting no runbook names is the D183 failure with
        a legal edge on it.
      - **`v2_ratelimits`** (`suggestions.ts`, `v2social.ts` — `expireAt`
        at double the rate-limit window) — the smallest of the three:
        `deleteAccount` removes a living account's own ledgers by exact id,
        so the residue is bounded per account rather than per request. Slow
        growth, not runaway, and listed here because the comment asserting
        the sweep should not be the only place it is asserted.
- [x] **5.2 Confirm the Authentication billing edition — ANSWERED
      2026-08-27 (D333): Firebase Authentication, the free edition.**
      Read off the API rather than a console: the Identity Toolkit admin
      config reports `subtype: FIREBASE_AUTH`, and
      `identityplatform.googleapis.com` is not activated on the project.
      Recorded next to `SHIP-CHECKLIST §5` as that item asks. 5.12's
      BigQuery export is what turns this from a checked answer into a
      standing one. Original stakes: anonymous-first
      means every install becomes an authenticated identity: free forever
      on Firebase Authentication, MAU-priced on Identity Platform. At 1.5M
      MAU that is $0 vs ~$6,015/month for zero code difference.
- [x] **5.3 Scrub the dead v1 collection — RUN 2026-08-27 (D333), and it
      measured ZERO documents.** The report pass found `insight_discoverable`
      already empty, so there was nothing to `--apply` to: the exposure this
      step guards — Big Five, politics, age, bio, display names with no
      writer and no reader — was already gone, and the script's own text
      names 0 as the expected end state whose precondition the store
      privacy answers need. That precondition is met, measured rather than
      assumed. The same day's `(default)` deletion (step 5 of
      FIRESTORE-REGION) removed the collection's very container, so the
      scrub can never be needed again. `SHIP-CHECKLIST § hardening`.
      ```bash
      node scripts/scrub-v1-discoverable.mjs --project prvfire33          # report
      node scripts/scrub-v1-discoverable.mjs --project prvfire33 --apply  # delete
      ```
- [x] **5.4 Storage bucket: check, empty, then lock down — DONE
      2026-08-27 (D333), in that order.** Checked: `prvfire33.appspot.com`
      held **117 objects, none of them under the path the rules kept
      open** — 115 under `users/{uid}/uploads/` (6 uids, ~60 MB, the old
      app's) and 2 under `users/{uid}/daily_snaps/`, newest 2026-02-08;
      zero under `users/{uid}/dailyPhotos/` and zero under `avatars/`.
      Those paths were already denied by the catch-all, which means the
      erasure gap this step exists to avoid ALREADY existed for them —
      personal photos no owner could reach or remove. Emptied: all 117
      deleted, bucket read back at 0 objects. Locked down: the
      `dailyPhotos` read/delete block is out of `storage.rules` (the
      avatars path stays — it is D178's live feature, not the legacy one),
      `firestore-tests/storage.rules.test.ts` updated in the same commit,
      153/153 rules tests green. The rules deploy rides the next pipeline
      run, as every rules change does. Original ordering rule, still the
      reason it went this way: delete the objects **before** reducing the
      rules — `deleteAccount` does not touch this path, so revoking access
      while objects remain converts a dead feature into an erasure gap.
- [ ] **5.5 Apply the nine monitoring alerts — EIGHT VERIFIED ARMED AND
      WIRED 2026-08-27 (D333); the NINTH is committed and not applied.**
      **REOPENED 2026-09-02 (D349).** `monitoring/paid-refund-stuck.json`
      landed with the paid pipeline's first alert of any kind, and with
      the two log-based metrics it selects on. Nothing in this tree arms
      a policy — `monitoring:apply` does, and it has not been run since —
      so the money alert is committed, gated by `check:monitoring`, and
      silent. Dispatch **Arm monitoring** once more; the 2026-08-27
      verification below stands for the eight it names and says nothing
      about the ninth, which is why moving this heading's count from
      eight to nine was not an edit that could be made on its own.
      Found already applied on 2026-08-27 (the D303 path had run):
      the dry run reports every object `already exists`, `observe` reads
      `armed: true`, and — the half a green count cannot see — a direct
      policy read shows **all eight policies carry the `InSight oncall`
      email channel**, which points at the owner's address and is enabled.
      A policy with no channel is enabled, visible, green and pages
      nobody; that is the state this box existed to rule out, and it is
      ruled out by reading the channel id off each policy rather than by
      counting policies. Original instructions kept below.
      Dispatch **Arm monitoring** with `apply` off to see what is missing,
      then again with it on. It runs behind the `production` environment
      gate on `FIREBASE_SERVICE_ACCOUNT`, needs nothing on your machine, and
      is idempotent. Locally it is the same script:
      ```bash
      npm run monitoring:apply -- --email you@example.com           # report
      npm run monitoring:apply -- --email you@example.com --apply   # do it
      ```
      Then dispatch **Observe production** and check `armed` reads true —
      the step is done when the instrument says so, not when the job is
      green. They cover failures that look like nothing from the outside:
      the app keeps serving while the Mirror stops moving, or keeps moving
      while falling further behind. `DEPLOYMENT.md § Alerting`.

      **This step was open for two days with a script that could do it,
      and the reason is worth keeping.** The script existed on 2026-08-24
      and shelled out to `gcloud`. Nobody had a `gcloud auth login` against
      this project, so it never ran — and on 2026-08-26 the observer read
      the project and found **zero** policies and **zero** log-based
      metrics (D300). The tool was written, tested, documented and
      unrunnable, which is the same failure D300 named one instrument
      earlier: a tool that runs beats a better-provisioned tool that does
      not. D303 moved it onto the REST APIs, over the credential four
      workflows already use.

      **What the old refusal said, and which half of it survived.** This
      item used to say the step must not be automated because "the deploy
      service account has no monitoring role" — the **last place still
      asserting** a reason D47 retired on 2026-08-04. Counted rather than
      guessed: `git show ca7097bc` finds that sentence in three files, and
      the other two (`DEPLOYMENT.md`, `MONITORING.md`) both quote it in
      order to correct it. This item was the only one still standing on it.
      The account holds `Editor`, which includes
      `monitoring.alertPolicies.create`; permission was never the obstacle,
      and it is now the thing that makes the REST path work. What survives
      is the narrow refusal: not on the DEPLOY PATH, because a pipeline
      that can rewrite an alert policy can delete one silently in a deploy
      about something else. A `workflow_dispatch` behind the `production`
      gate is not that pipeline, and the item's own paragraph had already
      said so — it called building one "an open question with arguments
      both ways" and left it, on 2026-08-25. It was answered the next
      day, and not by new information: `seed-content.yml` had been the
      proof of that shape since 2026-08-06.

      The count above is held by `check:figures`. D291 found **four
      quotations of two figures, none of them right** — this step's title
      said "the two monitoring alerts", its refusal priced a trade against
      "two policies" (4x off), and `apply-monitoring.mjs`'s header said
      three policies and two metrics. `DEPLOYMENT.md § Alerting`'s heading,
      `COSTS.md`'s sentence and `MONITORING.md`'s instruments row are held
      to the same lists now (D303), for the same reason: the heading read
      "three alerts, deliberately" for as long as there were eight, and
      `MONITORING.md` said seven through a sweep that claimed to have found
      every copy.
- [x] **5.6 Version lockstep — holds at 2.0.0 build 29.**
      *This line was stale three times, each one a bump behind 2.4 — build
      11 on 2026-08-13, build 12 later the same day, then 13 against a tree
      at 22.* It is the D39 shape — a figure kept current by intention —
      inside the very step whose job is to notice numbers disagreeing, and
      three times is not a slip. Its own paragraph had already drawn the
      conclusion ("this number will be wrong again") and stopped one move
      short of the remedy: **`check:figures` owns both numbers now**, read
      off `package.json`, so this sentence is current or CI is red. That is
      the same fix `src/v2/README.md`'s suppression count took, for the
      same reason, after the same two failures.
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

- [x] **5.9b Delete the twelve OLD-PROJECT functions in `us-central1` —
      DONE 2026-08-27 (D333), in this box's own order.** `onUserDeleted`
      first and alone, verified by generation/runtime at both ends (the
      census read GEN_1 · nodejs18 · `user.delete` on
      `resource=projects/prvfire33` · last deployed 2024-12-12, and the
      CLI's delete line itself said "Node.js 18 (1st Gen)") — so account
      deletion no longer executes foreign code. Then the other eleven in
      one command, each confirmed 1st Gen as it went. The Cloud Scheduler
      leftover this box warns about did NOT materialize: the shared
      `firebase-schedule-scheduledDeletePastEvents-us-central1` job and
      topic were both removed with their functions, and no orphaned job
      remained. One inert residue was left in place: the topic
      `firebase-schedule-scheduledUpdateNewStatus-us-central1` (the deploy
      collision's other name), with no job, no subscription and no
      publisher — clutter, not billed work. Verified with the instrument:
      `strayCount` fell by exactly twelve. Original text below.
      Read out of production by `npm run observe -- --functions` on
      2026-08-26 (D301). These are **not this project's code** — Gen-1,
      nodejs10/18/20, last deployed 2024–2025, from an app that shared the
      `prvfire33` GCP project. The owner confirmed their provenance.

      **Do `onUserDeleted` FIRST, on its own, and knowingly.** It is the
      only one of the twelve that can see current data:

      ```bash
      npx firebase functions:delete onUserDeleted \
        --project prvfire33 --region us-central1 --force
      ```

      It is a **Firebase Auth `user.delete` trigger scoped to the whole
      project** (`resource=projects/prvfire33`) — Auth is project-wide, so
      the database split does not isolate it. `functions/src/index.ts:882`
      calls `getAuth().deleteUser(uid)`, which means **every InSight account
      deletion runs 2024-era code from a different application.** What that
      code does is unknown; the source is not in this repository. It is
      executing on the erasure path either way, which is the argument for
      removing it rather than against.

      **Then the other eleven**, which are inert: every one is a Firestore
      trigger or HTTPS function on the **`(default)`** database, and v2 lives
      in **`insight`** (`functions/src/db.ts:29`). They cannot see v2 data.

      ```bash
      npx firebase functions:delete \
        addFcmToken aggregatePollResults createLiveStream findSimilarUsers \
        recalculateVoterPersonality scheduledDeletePastEvents \
        sendChatNotificationsTrigger sendPushNotificationsTrigger \
        sendUserPushNotificationsTrigger updateIsNewFieldNew \
        updatePollResults \
        --project prvfire33 --region us-central1 --force
      ```

      **Two of them bill on a timer** and are the only ones costing anything
      today: `scheduledDeletePastEvents` and `updateIsNewFieldNew`. Both are
      wired to the SAME Pub/Sub topic
      (`firebase-schedule-scheduledDeletePastEvents-us-central1`) and
      `updateIsNewFieldNew`'s entry point is `scheduledUpdateIsNewStatus` —
      a deploy collision in the old project, inherited here. **Deleting a
      Gen-1 scheduled function does not always remove its Cloud Scheduler
      job and topic**; check for leftovers under Cloud Scheduler afterwards,
      because a job whose target is gone still runs and still fails.

      **Verify with the instrument rather than by eye:** re-run
      `npm run observe -- --functions`. `strayCount` should fall by twelve
      and no `us-central1` line should name a Gen-1 function.

- [ ] **5.9c The Algolia extension in `europe-west3` — UNINSTALLED
      2026-08-27 (D333), and the box stays open because `ext:list` found
      FOUR MORE.** The `-6ct7` instance was confirmed by id via
      `ext:list` and by the Extensions API (params:
      `COLLECTION_PATH=Cities`, `INDEX_NAME=Cities`,
      `LOCATION=europe-west3`), then uninstalled by calling
      `deleteInstance` on the Extensions API directly — the same call the
      Console's Uninstall button makes, and the one the pinned CLI's
      `ext:uninstall` never reaches (see below). The operation completed
      and took both `europe-west3` functions with it.

      **What `ext:list` surfaced that the function census could not:**
      four MORE `algolia/firestore-algolia-search` instances —
      `firestore-algolia-search`, `-stream`, `-intrests`, `-courts`,
      created 2023-09 → 2024-07 — all ACTIVE **with no deployed functions
      anywhere**, i.e. already in exactly the "installed and broken" state
      this box warns hand-deleting creates; the old project evidently did
      it four times. They index nothing (their source collections lived in
      `(default)`, deleted the same day), cost nothing here, and belong to
      the old app — left for the owner to uninstall the same way, which is
      why this box keeps its tick open. The Algolia-side warning below
      still stands for all five: uninstalling does not delete the Algolia
      indexes or revoke their API keys, and an Algolia plan may still be
      billing outside this project.

      Original record: two functions there were
      `ext-firestore-algolia-search-6ct7-*`, installed 2024-06-03, indexing
      a `Cities/{documentID}` collection in `(default)` into Algolia. No
      document in this repository mentions it.

      **`functions:delete` is the wrong tool** — an extension's functions
      are managed by the extension, and removing them by hand leaves the
      instance installed and broken.

      **`ext:uninstall` is ALSO the wrong tool, which is not what its name
      or its own `--help` suggests.** In the pinned firebase-tools
      (15.24.0) its entire action body is
      `manifest.removeFromManifest(instanceId, config)` — it edits
      `firebase.json` and never calls the Extensions API. The only caller of
      `extensionsApi.deleteInstance` in the whole CLI is
      `lib/deploy/extensions/tasks.js`, reachable only through
      `deploy --only extensions`. And this repo's `firebase.json` has no
      `extensions` key, so the command throws
      `Extension instance … not found in firebase.json` before doing even
      its local no-op. Verified by running `removeFromManifest` against this
      repo's real config, not by reading the help text.

      **Confirm the id, then uninstall in the Console:**

      ```bash
      npx firebase ext:list --project prvfire33      # this one IS correct
      ```

      Firebase Console → Extensions → the `firestore-algolia-search-…`
      instance → Uninstall. That is the only route that does not involve
      this repository's `firebase.json`.

      *(The CLI route exists — `ext:export` to write the installed instances
      into the manifest, delete the entry, then `deploy --only extensions`
      — but that last step reconciles the WHOLE project against the local
      manifest: anything `ext:export` missed is deleted too. Not worth it to
      remove one instance.)*

      It may also still be costing an Algolia plan outside this bill, and
      uninstalling does not delete the Algolia index or revoke its API key.

- [x] **5.9d The nine stranded `us-central1` copies — DELETED 2026-08-27
      (D333), with DEPLOYMENT.md's command as written.** All nine
      confirmed GEN_2 · nodejs22 · last deployed 2026-07-29 before the
      command ran, and 2nd Gen again in each delete line. Their four Cloud
      Scheduler jobs went with them, so the nightly billed work that
      produced nothing — and that was the only thing still WRITING to
      `(default)` (see D333's attribution) — is over. `us-central1` now
      holds **zero functions and zero scheduler jobs**; D13's one-off
      cleanup is finally not owed. THIS project's, and
      a different decision from 5.9b's: `rebuildAreaAggregates`,
      `rebuildCityAggregates`, `rebuildWorldAggregates`,
      `scheduledAreaAggregates`, `scheduledCityAggregates`,
      `scheduledWorldAggregates`, `scheduledTaxonomies`, `seedTaxonomies`,
      `sendInboundImpression`.

      These are **Gen-2, nodejs22, deployed 2026-07-29** — InSight's own
      code. **D13 dropped them from the deploy `--only` list**, so they
      stopped being deployed anywhere; they sit in `us-central1` because
      that is simply where they last landed, before D201 moved the region
      for everything still being deployed. D13 is the cause, not D201.

      **This heading read `europe-west1` until it was reviewed** — the
      region where all 42 LIVE functions are, one line above a nine-name
      `--force` delete, in the item that points at a command whose own
      documentation says in bold that the region must not be "fixed" to
      match D201. The body two lines down said `us-central1` the whole time.
      Three independent reviewers caught it; nothing mechanical would
      have. `docs/DEPLOYMENT.md` § "One-off cleanup
      still owed in production (D13)" has the command and it is correct as
      written.

      Kept separate from 5.9b **because the provenance is different**, and
      the runbook conflated them until D301: twelve are another
      application's, nine are ours. A single "delete the us-central1
      leftovers" step would have been one command over two unrelated
      decisions.

- [x] **5.9 Deploy the functions to `europe-west1` (D201), then confirm
      the old region is empty — CLOSED 2026-08-27 (D333).** The three
      halves closed on three different days: the deploy half on D300's
      reading (all live functions in `europe-west1`), the build half when
      builds 22+ shipped calling the new region (21 and earlier are
      superseded — build 26 is in TestFlight, D324), and the confirmation
      half today: **`us-central1` reads zero functions and zero Cloud
      Scheduler jobs**, measured by `observe` after 5.9b and 5.9d ran.
      The census that replaced this box's sweep clause is those two items
      plus 5.9c, and all three are executed. Original text below.
      The code is merged and every gate is
      green; this is the operator half, and it is the one deploy here that
      can corrupt data rather than just fail.

      **Why now:** every client calls the region its own bundle names, so
      this gets more expensive with each install — the same "last free
      reset" argument D165 made about the database, one layer up. It also
      ends the split D200 measured: the database has been in Europe since
      2026-08-15 and the functions were still in Iowa.

      **The hazard, in one sentence:** a region is part of a function's
      identity, so the deploy CREATES the new copies and leaves the old
      ones running, and while both exist **both Firestore triggers fire
      and every answer folds twice** — the event-ledger dedup keys on the
      CloudEvent id, which makes a retry safe and says nothing about a
      second subscription.

      The full procedure, the verification command and the rollback are in
      [`DEPLOYMENT.md`](DEPLOYMENT.md) § Moving the functions. The short
      form: deploy while nothing is being answered, then check what is left
      in the old region.

      **The sweep clause here used to say "delete anything that is not one
      of D13's nine v1 leftovers" — i.e. SPARE the nine — while 5.9d says
      delete them.** Two open boxes in one document telling an operator
      opposite things about the same nine functions. The census is now
      5.9b/5.9c/5.9d, which split `us-central1` by provenance rather than
      by "is it on D13's list", and this clause defers to them.

      **The deploy half has already happened** (D300's reading: all 42 live
      functions are in `europe-west1`, and `us-central1` holds only the 12
      old-app functions and the 9 D13 leftovers). What keeps this box open
      is the build bump below, not the deploy.

      **Then bump the build and ship it** (2.4). Every build shipped before
      this deploy — 21 and earlier — keeps
      calling `us-central1` and get a 404 the app reports as `internal` on
      every callable — account deletion, push registration, the logic test,
      circles and duels, device activation, suggestions. The daily and the
      Mirror keep working, because they read Firestore directly and never
      go through a callable.

- [x] **5.10 Dry-run the replay tool once, on a question with real
      answers.** **DONE 2026-08-26 on `daily-019`** (Actions run 6,
      `apply` off): the scan pulled 5 real answers out of
      `v2_users/{uid}/answers`, rebuilt the vote fold, and matched the
      published aggregate exactly — `rebuilt total 5 counts {"0":5}` ·
      `published total 5 counts {"0":5}` · `drift: none`. That is the
      property the whole of D290 rests on, checked against production
      rather than against an emulator, and it is the first non-vacuous
      run: the 2026-08-25 attempt scanned zero (D295/D296).

      D290 shipped `rebuildAggregateV2` and its unit tests, but
      the callable had never run against production data. Its first
      execution should not be during an incident, which is the only other
      time anyone reaches for it.

      **Actions → Rebuild aggregate → Run workflow**, with the qid and
      `apply` left off. No checkout, no Node, no credentials on a laptop —
      the same shape as *Seed content*, and for the same reason: a step
      that needs a dev machine set up is a step that does not happen. The
      local path still works if you have the environment
      (`npm run rebuild:agg -- --qid <id>`).

      Dry by default; nothing is written without `apply`. **The expected
      output is `drift: none`** — the published aggregate already matches
      the answers. Anything else is a real finding, not a tool bug, and it
      is worth understanding before the numbers are ever quoted: it means
      the trigger and the answers disagree, which the incremental fold has
      no other way of telling anyone.

      **`nothing to compare` is not that green.** It means the scan matched
      no answers and the aggregate is empty too — consistent, and nothing
      verified. If you expected answers for that question, the query is
      what to look at, not the fold.

      The workflow reads the seed's own credentials
      (`FIREBASE_SERVICE_ACCOUNT`, `SEED_ADMIN_UIDS`,
      `VITE_FIREBASE_API_KEY`) from the `production` environment, so there
      is nothing new to grant.

      **WHAT THE FIRST RUN ACTUALLY FOUND (2026-08-25, D295).** The step was
      performed the day the tool merged, and it failed twice before it
      passed. Both failures were about the deploy, not the tool, and both
      are worth knowing before anyone reaches for this during an incident:

      1. **Dispatched five seconds after the merge**, while the backend
         deploy was still running. `cloudfunctions.net` answered with a 404
         HTML page for a function that did not exist yet. **Wait for the
         backend deploy to finish** before dispatching a rebuild that
         depends on a just-merged change.
      2. **Dispatched a minute after the deploy finished**, and got a bare
         `INTERNAL`. The composite index the scan orders by (`qid` +
         `answeredAt`, collection group) ships in `firestore.indexes.json`
         and is created by the same deploy — but a freshly created index is
         **not queryable until it finishes BUILDING**, which for this
         collection takes minutes rather than seconds. The third dispatch,
         2.5 minutes later and otherwise identical, succeeded. If a rebuild
         fails right after an index change, **wait and re-run before
         debugging anything**.
      3. It then reported `scanned 0 … nothing to compare` — true of
         `daily-000`, which nobody has answered. **So the plumbing is
         verified and the fold is not**: the call reaches the function, the
         scan runs, the fold runs and the comparison runs, over zero
         answers. The fold itself is covered against emulated functions with
         real answers (e2e steps 7h, 7i, 9e).

         **Pick a qid that HAS answers.** This entry first said the project
         held none, quoting `answersCounted: 0` from the pulse trail; D296
         found that number to be a broken reader, not a measurement — there
         are 104 questions with answers in production. `daily-019` (total 5)
         is the one with more than a single vote, and is what run 6
         verified. `feed-f03` would exercise the rank arm the same way if
         a rank fold ever needs the same confidence.

- [ ] **5.12 Turn on Cloud Billing export to BigQuery — so the prediction
      can be diffed against the invoice.** Cloud Console → Billing →
      **Billing export** → BigQuery export → enable *Standard usage cost*
      into a dataset in the **EU** (D165's residency argument applies to
      this as much as to answers).

      **Why this and not a dashboard.** `docs/COSTS.md` opens by saying
      every figure in it is a prediction, written down with its inputs
      "so the first real invoice can be diffed against it rather than
      merely survived". `pulse.mjs` has carried `burnUsd5k`, `burnUsd50k`
      and `revenueUsd` since it was written — **all three modelled** — and
      the trail has never held a single actual number. There is nothing to
      diff against, so the diff has never happened.

      Two consoles already disagree about the same month: Firebase's
      *Project cost* read **kr10.74** for August 2026 while Cloud Billing's
      *Services – this month* read **kr6.04** for Aug 1–24. Overlapping but
      not identical periods, so that is not necessarily a contradiction —
      it is exactly why one queryable source beats two dashboards somebody
      has to screenshot.

      **What it unlocks, in order of value:**

      1. **A fixed-cost term the model does not have.** The model is purely
         DAU-driven and predicts **$0.00 at 50 DAU**. The invoice is
         non-zero at *zero* DAU, because twelve scheduled functions run
         nightly and hourly whether or not anyone shows up. That is D67's
         shape one layer up — counting per-user activity and calling it the
         bill. Sizing the floor needs the real per-service split.
      2. **The Authentication tier, permanently.** 5.2 asks whether auth is
         Firebase Authentication (free forever) or Identity Platform
         (MAU-priced, ~$6,015/mo at 1.5M MAU). With SKU-level export that
         stops being a console hunt and becomes a query — and it stays
         answered, instead of being re-checked by hand whenever somebody
         wonders.
      3. **Actual beside predicted in the daily trail**, so a drift shows
         up as a row rather than as a surprise on a statement.

      **The access shape, which is the part worth getting right.** The
      export needs no credential handed to anybody: it is a console toggle
      that writes into your own project. Reading it later needs a service
      account with `roles/bigquery.dataViewer` **on that dataset only** —
      a NEW secret, never a widening of `FIREBASE_SERVICE_ACCOUNT`, for the
      same reason D291 records about the deploy role. Read-only, one
      dataset, and the `production` environment's approval in front of any
      workflow that uses it.

      **Not built yet, deliberately.** The collector that reads this is
      worth writing against the real dataset rather than against an assumed
      schema — this session has already spent one round on a workflow that
      parsed as YAML and would not run. Enable the export, let a day of
      data land, and the pulse extension follows.

- [ ] **5.13 Stand up the read-only observer (D292).** Five commands and
      one GitHub setting. It gives the project a collector that can answer
      "are the alerts armed", "what did we actually spend", and "is
      Authentication on Identity Platform" without anyone opening a
      console — and it proves the Workload Identity setup on an account
      that cannot break a deploy.

      **Do this BEFORE the WIF cutover in `DEPLOYMENT.md`, not after.**
      Steps 1–2 below are the same pool and provider that cutover needs, so
      this is a rehearsal of it on something read-only. That file's own
      warning is the reason: a misconfigured provider discovered on the
      deploy credential leaves you with no way to ship; discovered here, a
      report is late.

      Run these in **Cloud Shell** — the `>_` icon in the Cloud Console, or
      shell.cloud.google.com. `gcloud` is already installed there and
      already signed in as you, so there is nothing to set up locally and
      no credential to handle on a laptop.

      ```bash
      # 1 · the pool, and a provider pinned to THIS repo
      gcloud iam workload-identity-pools create github \
        --project prvfire33 --location global

      gcloud iam workload-identity-pools providers create-oidc github \
        --project prvfire33 --location global --workload-identity-pool github \
        --issuer-uri "https://token.actions.githubusercontent.com" \
        --attribute-mapping "google.subject=assertion.sub,attribute.repository=assertion.repository" \
        --attribute-condition "assertion.repository == 'Cosaxo/InSight'"

      # 2 · the observer itself — no key is ever created
      gcloud iam service-accounts create insight-observer \
        --project prvfire33 --display-name "InSight read-only observer"

      # 3 · read-only roles (Firestore is deliberately absent — D292)
      for R in roles/monitoring.viewer roles/logging.viewer \
               roles/cloudfunctions.viewer roles/bigquery.dataViewer \
               roles/bigquery.jobUser; do
        gcloud projects add-iam-policy-binding prvfire33 \
          --member "serviceAccount:insight-observer@prvfire33.iam.gserviceaccount.com" \
          --role "$R"
      done

      # 4 · the project NUMBER (not the id) — the next command needs it
      NUM=$(gcloud projects describe prvfire33 --format='value(projectNumber)')
      echo "$NUM"

      # 5 · let this repo's Actions impersonate the observer.
      #     Split out rather than nested in a command substitution: this is
      #     the line most likely to be retyped by hand on a re-run, and a
      #     mangled principalSet does not fail here — it fails at RUN time
      #     as a permission denial, which is the worst place to debug it.
      gcloud iam service-accounts add-iam-policy-binding \
        insight-observer@prvfire33.iam.gserviceaccount.com --project prvfire33 \
        --role roles/iam.workloadIdentityUser \
        --member "principalSet://iam.googleapis.com/projects/$NUM/locations/global/workloadIdentityPools/github/attribute.repository/Cosaxo/InSight"

      # 6 · print the provider path the workflow needs
      gcloud iam workload-identity-pools providers describe github \
        --project prvfire33 --location global --workload-identity-pool github \
        --format 'value(name)'
      ```

      Then add step 6's output as the repository **variable**
      `WIF_PROVIDER` (a variable, not a secret — it is a resource path, not
      a credential, and having it readable makes the workflow debuggable).

      **What you are NOT doing here:** creating a key, touching
      `FIREBASE_SERVICE_ACCOUNT`, or granting anything that can write. If
      any command above asks for a write role, stop — that is not this
      step.

      Tell me when step 6 has printed, and the collector follows. It is
      deliberately unwritten until then (D292): four Google APIs nobody
      here can reach is not a thing to code against an assumed schema.

- [ ] **5.11 Install the BigQuery mirror WITH the first real users — not
      before, and not after.** Firebase Extensions → *Stream Firestore to
      BigQuery*, on the `answers` collection group, **dataset in the EU** so
      it agrees with D165's residency argument. Nothing in the app changes;
      no rules change; no read path moves.

      **Why the timing is the whole step.** The extension streams from the
      moment it is installed. Install it late and you are running
      `fs-bq-import-collection` to catch up, and rows belonging to accounts
      deleted in the interim never arrive at all — right-to-erasure wins
      over analytics, correctly, but it means the gap does not heal.
      `answers` is append-only, so a late import recovers most of it; this
      is a mild cost, not the sharp one D290's collapse carried. It is
      still a cost, and it is paid in the weeks whose data is most worth
      having: the first ones.

      Installing it EARLY is equally pointless — there is nothing to mirror
      at `answersCounted: 0`, and an extension streaming an empty
      collection is a monthly line item and a thing to forget about.

      **What it buys:** SQL over the archive without touching the app. It is
      what answers "which questions bore people" and the rest of
      `ENGAGEMENT-PLAN.md`'s rungs 1–2 without building either, and it is
      the honest first move if the Postgres question ever reopens (D290
      layer 4). If you find yourself writing the same query weekly and
      wishing the app served it live, that is the migration signal — and by
      then there is data worth migrating.

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

      **RESOLVED 2026-08-20 (D219): the fork went the drop-the-wall way,
      and the default itself now says so.** This step used to read: the
      drafted reply is false for any build this workflow makes, because
      `ios-release.yml` defaulted `VITE_REQUIRE_SIGNIN` to `true` (D134)
      and a release build opened on a mandatory Google sign-in — every
      clause of the 4.8 answer described the build the flag turns OFF.
      The owner resolved it on the release thread (condition — everyone
      has an account, answers attributed, duplicates hard — checked and
      holding without the wall; D219 has the reasoning), and the workflow
      default flipped to `'false'` **in the repo rather than in the
      settings page**, so the record is where the next reader looks. The
      variable survives as the override for a deliberately walled test
      build (`REQUIRE_SIGNIN=true`); `signInRequired()` still compares to
      the literal `true`, on purpose. Build 23 is the first wall-less
      build; 22 and earlier ship the wall and are superseded. Adding
      Apple instead remains un-pre-built (`SHIP-CHECKLIST § 4.8`) — it
      joins only if a reviewer insists, in the rejection round this step
      budgets.

      **The wall is also a 5.1.1(v) question, not only a 4.8 one**, and
      that is the more expensive half: Apple expects an app to be usable
      without an account unless its core features genuinely need one, and
      this app's core loop demonstrably does not — it ran anonymously for
      twelve builds. 4.8 costs a provider; 5.1.1(v) argues about the
      product.

      **This does not apply to the TestFlight builds**, which is the whole
      point of D134 — the wall exists so a tester's fortnight of answers
      cannot die with their handset. Build 13 is a test-track build and
      ships walled on purpose. The flag becomes a blocker at exactly one
      moment, which is this step.

      **This step used to end "…and no email or name is collected through
      it". It is deleted, and do not say it.** Google's default scopes put
      an email and a display name on the Firebase Auth record, so the
      sentence contradicts the app's own privacy label — a listing that
      argues against its own nutrition label is a worse problem than the
      one it was trying to solve. `STORE-FORMS.md` has the reasoning; this
      was the third copy of the claim, after `SHIP-CHECKLIST` and the
      forms doc.
- [ ] **6.3 [UN-PARKED — D345] Apply for Play production access** — a three-section
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
