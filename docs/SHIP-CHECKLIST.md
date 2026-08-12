# Ship checklist — from green builds to phones

> **Doing the launch rather than reading about it?**
> [`LAUNCH-RUNBOOK.md`](LAUNCH-RUNBOOK.md) is the same work as an ordered
> to-do list — open steps only, dependency order, one line each. It holds
> order and status; this file holds the reasoning and stays canonical. If
> they ever disagree, this file is right and the runbook is stale.

Phase-5 state: the code side is done — the app renders frameless with
safe-area insets on any phone-sized screen or native shell, reveal push
notifications are wired end-to-end (server send + client registration),
and the account/privacy panel (name, Google linking, truthful sharing
explainer, delete) lives at the top of the profile. What remains is
account-gated and device-gated work only a human can do.

## 1 · Seed production (5 minutes, once)

The deployed backend is live but the question bank is empty until an
operator seeds it. **Steps 1–2 are done** (2026-07-31): `SEED_ADMIN_UIDS`
is set on the production environment to the maintainer's uid and a deploy
has carried it into the runtime — the deploy log's env step shows the
value and no empty-warning. Only step 3 remains, and it must be run
**signed in as that account** (the gate matches the exact signed-in uid).

**So §2's provider switch comes first, and the dependency is easy to
miss** — the two facts live in different sections of this file. `runSeedV2`
throws `unauthenticated` without `request.auth` before it ever consults
`SEED_ADMIN_UIDS` (`functions/src/ops.ts`), and the uid it wants is a
**Google-account** uid. LAUNCH-RUNBOOK 0.1 carries the same warning,
because it had this step filed under "no accounts needed".

**Status 2026-08-04: the switch is thrown, so this is unblocked** —
Anonymous is measured working (`accounts:signUp` returns an `idToken`,
where the same probe returned `ADMIN_ONLY_OPERATION` a day earlier).
Google is enabled but **unverified**: the project-config endpoint returns
only `authorizedDomains` to an unauthenticated caller, never `idpConfig`,
so there is no remote probe for it. Signing in and running the seed IS
the verification — treat a successful seed as proof of both.

1. ~~Copy your uid~~ — done; the maintainer's Google-account uid, the
   same one `MOD_UIDS` holds. (For a future extra operator: it's shown by
   `window.LIVE.uid` in the browser console, or in Firebase Console →
   Authentication.)
2. ~~Set the `SEED_ADMIN_UIDS` variable~~ — done (GitHub → Settings →
   Environments → `production` → Variables), carried by deploy run
   30648976978. Comma-separate to add operators, and re-run **Deploy
   Firebase backend** after any change — the value only reaches the
   runtime on the next deploy.

   > Not a committed file: `.env` and `.env.*` are gitignored (including
   > under `functions/`), so the value cannot travel in the repo — the
   > workflow variable is the only path. A deploy with the variable unset
   > still succeeds but logs a warning, and every operator callable stays
   > `permission-denied`.
3. **The remaining step: Actions → *Seed content* → Run workflow.** No
   sign-in, no dev machine, nothing to install.

   510 questions land in `v2_questions`. Re-running is safe (idempotent,
   never resets the `active` kill switch) and, since D34, genuinely cheap:
   it rewrites only documents whose content changed and leaves `contentRev`
   alone, so a reseed no longer costs every returning device a 510-read
bank refetch. The job summary reports `{written, skipped}` — a no-op
   reseed reports `written: 0`.

   Tick **bump_rev** only after flipping a question's `active` flag **by
   hand in the Firebase console**: that changes no document the seed
   writes, so cached clients keep showing the question without it. Nothing
   is at risk while you wait — `firestore.rules` re-checks `active` on
   every answer write, so a killed question still on screen is refused
   server-side rather than silently accepted.

   In-app, `await window.LIVE.seedContent()` still does the same thing and
   is what `live.ts` exposes. It is no longer the instruction here, because
   there is nowhere to type it.

   **This step has now been documented wrong twice, and both failures share
   one cause.** It first read
   `firebase.functions().httpsCallable("seedContentV2")()` — Firebase v8
   namespaced syntax on a modular-SDK app (`firebase ^12`) that publishes no
   global `firebase`, so it threw `ReferenceError: firebase is not defined`.
   It then read "from the app's browser console", and **there is no browser
   console**: `firebase.json` serves `web/` — home, join, privacy, terms —
   and the app ships only as the native iOS shell, so `prvfire33.web.app` is
   a landing page. Both survived review because running the instruction
   needed something nobody had, so nobody ran it. `scripts/seed-content.mjs`
   is covered by `scripts/seed-content.test.mjs`, which is the only form of
   "verified" that stays true after the day it is written.

   The helper that does it correctly was module-private in `live.ts` with no
   way in, which is why `LIVE.seedContent` now exists. It adds no
   privilege: `assertOperator` + `SEED_ADMIN_UIDS` was always the control,
   and under D3 "signed in" is not one. `vote.test.ts` pins the callable
   name, region and payload, because a typo here is an `internal` error
   with nothing to read.

   **One failure is not a bug and must not be retried away.** Since D58 the
   seed **refuses** to edit the option set of a question that has already
   shipped, and fails the whole run with `failed-precondition` naming each
   one. Answers store `(qid, optionIdx)` and nothing else, so swapping two
   options re-keys every vote already cast (D52). The legitimate writes in
   that run are already durable; what you do next is fix the content, not
   re-run. To retire a question set `active: false`; to replace one, append
   a new qid.

## 2 · Native Firebase config files (account-gated)

Both apps must be registered under `com.cosaxo.insight`:

- **Android** — Firebase Console → Project settings → Add app →
  Android → download `google-services.json` → drop into `android/app/`.
  This also activates FCM delivery for reveal pushes.

  **Register the signing SHA-1 BEFORE downloading that file**, or Google
  sign-in is dead on Android in exactly the way the iOS
  `REVERSED_CLIENT_ID` below is dead — silently, at runtime, on a build
  that compiled and shipped. `google-services.json` only contains an
  Android `oauth_client` entry (client_type 1) if a SHA-1 is registered
  for the package at the moment you download it; without one the file is
  valid, FCM works, Firestore works, and `signInWithGoogle` fails with
  `DEVELOPER_ERROR` (status 10). D3's only account-upgrade path, gone on
  one platform.

  Two fingerprints, from different places at different times:

  | Which | Where | When |
  | --- | --- | --- |
  | Debug keystore SHA-1 | `keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android` | Now — it is what makes sign-in work on a dev install |
  | Play App Signing SHA-1 | Play Console → Setup → App signing | Only after the first upload — same screen as §3b's SHA-256 |

  Re-download `google-services.json` after adding the Play fingerprint;
  the file is a snapshot, not a live lookup. Nothing in this repo can see
  either omission: the file is gitignored and account-gated, so
  `check:store-copy` and CI are both blind to it.
- **iOS** — Add app → iOS → download `GoogleService-Info.plist` → add to
  `ios/App/App/` in Xcode (add to target), then copy that file's
  `REVERSED_CLIENT_ID` value over the `REPLACE_WITH_REVERSED_CLIENT_ID`
  placeholder in `Info.plist` → `CFBundleURLTypes` for native Google
  sign-in. `npm run check:store-copy` fails while it is unreplaced.

  That block is the OAuth callback route: the plugin's
  `GoogleAuthProviderHandler` calls `GIDSignIn.signIn(withPresenting:)`,
  and GoogleSignIn-iOS returns the result through that custom URL scheme.
  Without it the build succeeds, the account sheet opens, and the flow
  never comes back — taking D3's only anonymous-account upgrade path with
  it. It is device-only and silent; no other gate in this repo sees it.

  For push: Apple Developer → Keys → create an APNs key and upload it in
  Firebase Console → Cloud Messaging → Apple app configuration.
- ~~**Enable the provider**~~ — **done 2026-08-04.** Firebase Console →
  Authentication → Sign-in method: both **Google** and **Anonymous** are
  on. D3 depends on Anonymous and it is measured, not assumed — the same
  `accounts:signUp` probe that returned `ADMIN_ONLY_OPERATION` on
  2026-08-03 now returns an `idToken`. Google is enabled but has no remote
  probe (§1 explains why); the seed run verifies it. The client side is
  wired: `capacitor.config.ts` declares
  `providers: ["google.com"]` and `android/variables.gradle` sets
  `rgcfaIncludeGoogle = true`. Both are required — without the Gradle
  flag the Google libraries are `compileOnly`, so an Android build
  compiles and ships but throws the moment anyone taps *Link Google*.
- Run `npm run sync` after any `capacitor.config.ts` change — the native
  shells read the copied config, not this file.

## 3 · Store accounts & builds (device-gated)

- **App icon — done, but it is a first pass.** Both shells shipped the
  stock Capacitor mark until now, which is a hard rejection on iOS and an
  instant tell on Android; nothing in this checklist mentioned it. The
  mark now lives in `design/icon/mark.svg` (the Mirror in one glyph: you,
  and the people you are placed among) in the design system's own colours,
  and `node scripts/gen-icons.mjs` rasterises all 16 launcher assets from
  it. Replace the SVG and re-run if a designer takes it further — do not
  hand-edit the PNGs, they are generated.
  - **The rest of the imagery is generated too, as of 2026-08-03.**
    `npm run build:screenshots` drives the real app through six scenes at
    both stores' pixel sizes (`design/store/screenshots/`), and
    `npm run build:feature-graphic` rasterises the Play 1024×500 from the
    same `mark.svg` plus the app's own loaded stylesheet, so neither can
    drift from the product's palette. Marketing copy lives in
    `design/store/listing.json`, held against both stores' character
    limits by `npm run check:store-listing`.

    **Length is not the only thing that file gets wrong.** Both
    descriptions were still selling the pre-D98 privacy model — *"Your
    answers are owner-only"*, *"Crowd numbers are floored"* — four days
    after the copy was pushed to App Store Connect and a day after D106
    swept the same claims out of `web/` without enumerating this file
    (D116). `npm run check:public-copy` now holds `listing.json`,
    `web/*.html` and the in-app privacy panel against the retired model's
    closed vocabulary; it runs in CI and on the iOS release pre-flight.
    Character limits and truth are separate gates, and only one of them
    was ever being checked.

    Both generators need Playwright, which is deliberately **not** a
    package.json dependency — `npm i -D playwright && npx playwright
    install chromium` when you need them. Adding it would make every
    `npm ci` fetch a browser for a job that runs a few times per release;
    `gen-icons.mjs` takes the same trade with Chromium.

    **The captures committed today are a demo-mode preview, not the
    shipping set.** The harness says so, and names the one capture that
    must not be uploaded as-is: the reveal shows Comments and "Who voted",
    both gated on `!S.live` by D1, so a real user never sees them on a
    live question. Recapture against seeded production once real answers
    exist — App Store 2.3.3 wants screenshots that reflect the app.
- **Legal pages — filled 2026-08-03 (owner-confirmed).** `web/terms.html`
  now names `olaftaule01@gmail.com`, operator **Olaf Taule**, jurisdiction
  **Norway**. That resolves the three values this entry used to hold open
  for a company address; launching as a sole trader was chosen instead
  (LAUNCH-RUNBOOK 1.1 — enrolling as an organization first costs 1–2 weeks
  of D-U-N-S verification for nothing launch needs).

  **That parenthesis is about Apple, and it was wrong to read it as
  settling both stores (D41).** On Apple an organization enrollment buys
  nothing launch needs, so individual is right. On Play the same 1–2 weeks
  buy exemption from a 12-testers × 14-days closed-testing gate that is
  otherwise a 3–4 week floor, so the trade inverts: **the Play Console
  account opens as an organization**, backed by an ENK and a D-U-N-S.
  Two stores, two answers.

  **Superseded on timing by [D42](DECISIONS.md) (2026-08-04): Play is
  deferred and InSight launches on iOS alone.** D41's answer is not
  reversed, it is conditional — organization is still the right account
  type *if Play is opened before there is an installed base*. After one,
  the 12×14 gate may be satisfiable by asking existing users, because the
  two routes' costs move in opposite directions: the ENK chain costs the
  same whenever taken, while recruiting twelve installed testers is brutal
  cold and easy with an audience. So deferring may retire D41 unused
  rather than merely postponing it. Nothing below about Apple changes.

  Registering the ENK does not change the values above — an ENK is not a
  separate legal person, so the operator is still Olaf Taule. **If it is
  registered under a business name, revisit this page**: the operator line
  should name the entity a user is actually contracting with, and
  `check:store-copy` cannot tell a correct name from a stale one.

  It closes three separate dependencies at once, which is why it was the
  schedule wildcard: `web/privacy.html` routes erasure requests to "the
  support address listed on the terms of service page", so a user
  exercising a legal right used to land on a bracket; Apple guideline 1.2
  requires published contact info for a UGC app; and both store listings
  ask for a support contact.

  **Norway is EEA, so GDPR applies in full — and the follow-up this entry
  used to hold open is done.** It read: *"EEA users have the right to
  lodge a complaint with a supervisory authority (here, Datatilsynet), and
  `web/privacy.html` does not mention it — the page has no
  jurisdiction-specific language at all."* Measured 2026-08-04: the page
  carries an **"If you are in the EEA"** section that says the GDPR applies
  in full, names Datatilsynet, links datatilsynet.no, and states the right
  can be exercised without raising it here first. That is GDPR Art. 13(2)(d)
  satisfied.

  The gap closed and this paragraph did not, which is the documentation
  error this repo keeps re-committing (D39) wearing a different hat: not a
  stale *number* this time but a stale *status*, on the one page a store
  reviewer and a regulator both read. `check:figures` cannot see it — its
  subject is README test counts — so the only guard is looking at the file,
  which is what turned it up.

  `npm run check:store-copy` is the tripwire. **Run it before every store
  upload**; it exits non-zero while any placeholder remains. Three remain,
  all account-gated (the Play signing SHA-256, the Apple Team ID, the
  `REVERSED_CLIENT_ID`), so it is still deliberately *not* in CI — it
  would red the tree today, and the first response to that would be to
  delete the check.
- **Hosting — done, but verify the first deploy.** `firebase.json` serves
  the `web/` directory on the project's default site, so the store-required
  URLs are:
  - `https://prvfire33.web.app/privacy.html` — the privacy-policy URL both
    listings ask for
  - `https://prvfire33.web.app/` — a spare landing page (App Store also
    wants a support URL)

  It deploys as the **last** step of *Deploy Firebase backend*, and that
  step is `continue-on-error` on purpose: static HTML must never abort a
  rules or functions deploy. **So check that step's outcome** — a green
  run does not by itself mean the pages are live. Hosting has never been
  initialised on this project, so the very first deploy is the one to
  watch; if it fails because no default site exists, create one once in
  Firebase Console → Hosting and re-run.

  The privacy panel links both pages (`LP_SITE`). Buying a real domain
  later changes that one constant and the hosting target, nothing else.

  `web/` is a dedicated site directory, NOT Vite's `public/`. Two reasons,
  both found by running the hosting emulator rather than reasoning about
  the config: an `index.html` in `public/` silently collides with the app's
  own entry, and `ignore` is applied at upload time so it cannot stop the
  emulator — or a misconfiguration — from serving the licensed webfont kit
  that lives there. A separate directory has neither failure mode, and the
  legal pages no longer ship inside the app bundle, since the panel links
  the hosted copies.
- **Privacy nutrition labels (Apple) / Data safety form (Google).** Both
  are mandatory — neither store lets you submit without one — and both are
  a per-data-type declaration you attest to, not free text. Answer them
  from `docs/data-inventory.md`, which is the audited list; the draft
  below is that list translated into their categories.

  > **[`STORE-FORMS.md`](STORE-FORMS.md) is the same answers as a
  > field-by-field sheet to transcribe**, including the categories to
  > leave *unticked* and why three of them look tickable but are not. Use
  > it at submission time; the table below is the summary, and
  > `data-inventory.md` stays the source both derive from. It also carries
  > the age-rating answers and flags one inconsistency in this file's own
  > guideline 4.8 talking point.
  >
  > **The two halves ship differently, and only one is automated.** The
  > **age rating** is pushed by *Actions → App Store metadata* — done
  > 2026-08-08, all 22 attributes including the eight Apple added (D75).
  > The **privacy label cannot be pushed at all**: the App Store Connect
  > API has no App Privacy resource (D73), so that workflow prints the
  > form and it is typed in by hand. `check:store-forms` now holds both
  > halves equal to `STORE-FORMS.md`, key and value.

  | Their category | InSight | Linked to user? | Used for |
  | --- | --- | --- | --- |
  | Identifiers → User ID | Firebase uid (anonymous by default) | Yes | App functionality |
  | Contact info → Email | Only if the user links Google | Yes | App functionality |
  | Contact info → Name | Optional display name, shown in reveals | Yes | App functionality |
  | User content → Other | Answers, test results | Yes | App functionality |
  | **Sensitive info** | Politics test result; gender if entered | Yes | App functionality |
  | Location → Coarse | City name (see below) | Yes | App functionality |
  | Diagnostics → Crash data | Sentry, **on by default, opt-out in the privacy panel** (D76), uid only | Yes | App functionality |
  | Purchases, Browsing, Search, Contacts, Ads | **None** | — | — |

  Three things to get right, because they are the ones that bite:
  - **Tracking = No.** Nothing here follows a user across other companies'
    apps or sites, and there is no IDFA/ATT prompt. Answer "No" on Apple's
    tracking question and leave Google's advertising boxes unticked.
  - **Location is now a real Yes — Coarse, and only Coarse.** This row used
    to read "None", on the argument that city and country were fields the
    user typed. D9 added an optional "Use my location" button, so that
    argument is dead and the honest answer is Coarse Location, linked,
    for App Functionality.

    Declare it that way even though **no coordinate is ever transmitted**.
    The fix is resolved to a city name on the device
    (`src/v2/data/locate.ts`) and discarded, so what is *collected* in
    Apple's sense — sent off the device — is a city name and nothing
    finer. A city name is still coarse location data, and under-declaring
    is the direction that gets an app pulled.

    Do **not** tick Precise Location. It is unobtainable by construction,
    not by policy: iOS sets `NSLocationDefaultAccuracyReduced` and never
    calls `requestTemporaryFullAccuracy`, and Android declares
    `ACCESS_FINE_LOCATION` with `maxSdkVersion="30"` — so on Android 12+,
    where the OS added the Approximate/Precise choice, the app cannot hold
    the precise permission at all. The manifest comment explains why the
    capped declaration exists (a Capacitor alias resolves as all-or-none
    below API 31); if a reviewer asks, that is the answer.

    Google's Data safety form additionally asks whether location is
    *required*: it is **optional**. Declining leaves the city picker
    working, and the app never prompts unless the button is tapped.
  - **Sensitive info is a real Yes.** The politics test result is
    special-category data under GDPR Art. 9. It never leaves the owner
    document and IS sliced and published since D98, and the form asks what you
    *collect*, not what you publish.

  **Facebook SDK — resolved, excluded (D16).** It *was* linked into every
  iOS binary and never initialised, which is exactly the mismatch these
  forms exist to catch. It is now stripped at `postinstall`
  (`scripts/strip-facebook-sdk.mjs`) and the removal is asserted by
  `npm run check:ios-facebook` in CI. **Answer both forms with no Facebook
  SDK and no advertising SDK of any kind** — and note that the row above
  already says Ads: None, which is now true of the binary as well as the
  product.

  The rest of this note is kept because the linkage is invisible to every
  obvious check, so a future upgrade can reintroduce it quietly.

  *Where it came from, since this is easy to "verify" wrongly.* It is a
  transitive **SwiftPM** dependency of `@capacitor-firebase/authentication`,
  declared in that plugin's own manifest inside `node_modules`:

  ```
  node_modules/@capacitor-firebase/authentication/Package.swift
    .package(url: "https://github.com/facebook/facebook-ios-sdk.git", from: "18.0.0")
    → products FacebookCore, FacebookLogin
    → swiftSettings: .define("RGCFA_INCLUDE_FACEBOOK")
  ```

  Three greps say it is absent and all three are wrong: `package-lock.json`
  (npm does not model SPM edges), `ios/App/CapApp-SPM/Package.swift` (names
  the plugin, not the plugin's own dependencies) and `project.pbxproj` (SPM
  resolves at build time, not in the project file). The only file that
  shows it is the plugin's manifest — so check there, or check a resolved
  `Package.resolved` after a build.

  **The platforms differed, which was the tell.** On Android the same
  plugin gates each provider behind a flag, and `rgcfaIncludeFacebook`
  defaults to `false` — `android/variables.gradle` sets only
  `rgcfaIncludeGoogle`, so Facebook was always absent from the Android
  build. The iOS SPM manifest had no equivalent gate: both defines were
  unconditional. So "we don't use Facebook login" was true of the product,
  true of the Android binary, and false of the iOS binary — the two stores
  would have taken different correct answers.

  That asymmetry is why the strip exists and has no Android twin. If
  `check:ios-facebook` ever fails, the manifest layout changed in an
  upgrade and the SDK is back in the binary: fix
  `FACEBOOK_PATTERNS` in the stripper rather than relaxing the check, and
  re-check this row before submitting.
- **Age rating (Apple) / IARC questionnaire (Google) — answer from the
  mechanics, not from the questions.** Nothing in this repo had considered
  it before 2026-08-03.

  Every *content* frequency question on both forms is **None**. That is
  measured, not assumed: scanning all four committed banks for violence,
  sex, substances, gambling and profanity returns four hits, and all four
  are references rather than depictions — "Pub" as a place option,
  "Cry in a film — freely, or fight it?", an etymology card for the word
  *alcohol*, and a history card naming the Second World War. Re-run the
  scan if the banks grow substantially; the farm (D33) writes the spec
  layer, and promotion (D30) is the gate where new content reaches users.

  What actually drives the rating is three structural facts:

  1. **Users see each other's names.** Group and duel reveals show display
     names. That is user-generated content and social interaction on both
     forms, whatever the questions say.
  2. **Coarse location exists** (D9, optional). Both forms ask; answer
     consistently with the privacy table above.
  3. **Free-text takes are LIVE, at world scale, and NAMED** — D78 part 1
     shipped the report control, D83 shipped world takes, and D98 put the
     author's name on every one of them. So the app ships *with* a live,
     public, attributed free-text surface. Answer both forms on that
     basis; `userGeneratedContent` and `messagingAndChat` are already
     true (D79) and stay true.

  Expect **12+ / Teen**, and answer it deliberately rather than accepting
  a default.

  **The trap is Apple guideline 1.2, and it is worth getting right before
  submitting.** 1.2 demands four things of any app with user-generated
  content: a content filter, a report mechanism with timely response, a
  way to block abusive users, and published contact info. Where this app
  stands:

  | 1.2 requires | Here |
  | --- | --- |
  | Filter objectionable content | Moderation substrate deployed and **enforcing** — `MOD_ADVISORY = false` since D83; a remove verdict really hides |
  | Report mechanism | **Live** — `flagTake` writes to `v2_flags` from the takes panel (D78 part 1), and since D98 any signed-in user may flag any take at either scope |
  | Block abusive users | **Hide author** — the per-author mute on every take, at every scope (`data/mutes.ts`): local, silent, immediate |
  | Published contact info | The support address owed in `web/terms.html` |

  Two things follow. First, **the support email is a 1.2 dependency**, not
  only a GDPR one — a second reason it cannot stay a bracket.

  Second, the block answer was re-derived at **D98** and it is worth
  knowing what it replaced, because the old one would now be a rejection
  risk. It used to be "leaving a circle IS the block, because circle
  members are the only people whose content you can see" — true while
  takes were circle-scoped and world takes were anonymous. D98 names
  every take at world scale, so leaving a circle no longer bounds who you
  see, and an answer resting on that would collapse under a reviewer's
  first follow-up question. The real, universal control is **Hide
  author**, and it applies everywhere. `leaveGroupV2` still exists and
  still stops that circle's content, but it is a membership action now,
  not the 1.2 answer. (Still no owner-side *remove* callable, D55 §14.)

  The sentence that used to close this block — "1.2 stops being
  comfortable if a live takes surface ships later" — has come due twice
  over: the surface shipped at D83 with the report control alongside it,
  and D98 attached names. Both obligations are met above; keep them met.
- Apple Developer Program (~2 days to approve — start early, as an
  **individual** enrollment). **A Mac is no longer required**: since
  2026-08-05 `.github/workflows/ios-release.yml` archives, exports and
  uploads on a macOS runner, measured working end to end. Play Console for
  Android, as an **organization** account (D41 — it is the exemption from
  the closed-testing gate, and it needs the ENK's D-U-N-S in hand first,
  so start that chain on day one).
- Build flow: `npm run build && npx cap sync`, then open the native
  projects (`npm run ios` / `npm run android`), set signing, archive.
- TestFlight / internal testing track for the friends test. **Invite ten,
  not five.** The public mirror publishes once per 5 answers (D7's
  amendment), so a group of 6-9 sees the world count sit on "5+" and never
  move — accurate, and it reads as broken. At ten it steps to 10, and
  cohort breakdowns need ≥5 per bucket *and* two publishable buckets, so
  they stay withheld below roughly a dozen answers per question either way.
  Test **duels first**: they work at N=2, need no crowd, and are the most
  distinctive surface in the product.

## 3b · Invite links — two fingerprints (account-gated)

The code half is live: sharing copies a `/join/CODE` link, the hosted
fallback page works today, and the app prefills a tapped code. Direct
app-open needs:

1. `web/.well-known/assetlinks.json` — replace
   `REPLACE_WITH_PLAY_SIGNING_SHA256` with the Play App Signing SHA-256
   (Play Console → Setup → App signing).
2. `web/.well-known/apple-app-site-association` — replace
   `REPLACE_WITH_TEAM_ID` with the Apple Team ID.
3. Redeploy hosting, reinstall the app, tap a link. Android:
   `adb shell pm get-app-links com.cosaxo.insight` should show verified.
   iOS re-fetches AASA on install (CDN-cached; allow up to a day).

Until then links open the fallback page — degraded, not broken.

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
  — the trigger stamps `expireAt` (+90 days, `LEDGER_RETENTION_DAYS`).
  The window is sized for attribution, not dedup: entries carry the
  answering uid so a discovered fake-account ring can be subtracted from
  the exact counts months later (D28; the correction runbook is in
  DEPLOYMENT.md). Without the policy the ledger grows forever (harmless,
  but why pay for it — and a bounded retention is part of the D28
  privacy trade).
- **Confirm the Authentication billing edition — console-only, 30 seconds,
  and the largest unknown on the bill.** D3 makes the app anonymous-first,
  so *every install that reaches first paint* becomes an authenticated
  identity before the user has tapped anything. That is free forever on
  **Firebase Authentication**, and MAU-priced on **Firebase Authentication
  with Identity Platform** — 50k MAU free, then $0.0055/MAU tapering to
  $0.0032. At 1.5M MAU the two answers are $0 and ~$6,015/month, with no
  code difference whatsoever (docs/COSTS.md, finding 3).

  Firebase Console → **Authentication**. An un-upgraded project shows an
  *"Upgrade to Identity Platform"* call to action; an upgraded one does
  not, and its Settings carry the Identity-Platform-only tabs (multi-factor,
  blocking functions, user actions). The unambiguous version of the same
  question is Cloud Console → **Billing → Reports**, grouped by service:
  if *Identity Platform* is not listed for `prvfire33`, it is not billing.

  Two things make this cheap to resolve either way. The upgrade is an
  explicit, deliberate console action, and nothing in this repo's history
  has ever taken it — Identity Platform appears in no commit, and the
  deploy workflow touches only rules, indexes, functions, storage and
  hosting, never auth configuration. And the app uses **no Identity
  Platform feature at all**: `signInAnonymously` and `GoogleAuthProvider`
  are the entire surface (`src/lib/firebaseImpl.ts`) — no phone/SMS, no
  SAML or OIDC, no MFA, no tenants. So an upgraded project here would be
  paying per user for capabilities the product does not use.

  Record the answer next to this line once checked; it is the difference
  between "infrastructure is free below 5k DAU" being true and being
  approximately true.

- **Release versioning:** bump `appBuild` in package.json each store
  release; set `latestBuild` (soft banner) and, only when an old client
  would misbehave, `minBuild` (hard gate) plus `updateUrl` on the
  `v2_meta/app` doc in the console. The device-bind flip below is the
  first concrete instance of "would misbehave" — a pre-activation client
  votes into a silent rollback once enforcement is on (D37).
- **Device binding (D29, docs/DEVICE-BIND.md)** — four owner steps, in
  order: (1) Apple DeviceCheck key → `DC_TEAM_ID`/`DC_KEY_ID` variables +
  `DC_PRIVATE_KEY` secret on the deploy environment; (2) Play Console →
  App integrity → link the Cloud project, opt in to device recall,
  enable the Play Integrity API for the functions service account;
  (3) paste the two native token bridges in Xcode / Android Studio
  (DEVICE-BIND.md §2 — the JS side waits for them, nothing breaks
  meanwhile); (4) after the staging probe (§3), raise `minBuild` to the
  first activation-capable build, read the two rates, and only then flip
  `deviceBindEnforced()` in `firestore.rules` to `true` and deploy —
  the flipped text is already pinned by rules tests. Until (4), the
  claim is stamped but not demanded.

  Step (4) is a sequence rather than a moment (D37, DEVICE-BIND.md §4):
  `minBuild` first, because it is a hard gate and empties the
  old-build population outright instead of waiting for it to shrink;
  then error rate **< 1%** with **zero** `DeviceCheck auth rejected`,
  and Android `verdict without deviceRecall` **< 5%**, each over 24h.
  An early flip is silent — a refused answer write rolls the vote back
  with no message to the user — so it produces a product that feels
  flaky rather than reports that name the cause.
- **A second operator uid, before launch** (docs/DEPLOYMENT.md →
  Operator continuity). `SEED_ADMIN_UIDS` and `MOD_UIDS` each hold one
  uid, the same person's. Losing that Google account does not break the
  app — the scheduled twins keep running and rules keep enforcing — it
  removes the ability to seed content, force a reveal, or moderate, with
  no in-repo path back. Both variables are already comma-separated, so
  the fix is one edit each plus a deploy. Keep the lists **disjoint**
  (D22), and verify the new uid by checking it is *denied* the
  instrument it should not have, since a silently dropped uid looks
  exactly like one that was never added. The service-account secret and
  the two store accounts are single-holder too and need account-level
  delegation instead.

## Before-public hardening (not friends-test blockers)

- ~~**FCM token binding**~~ Done (2026-07-29): registration goes through
  the `registerPushToken` callable (App Check–enforced, dry-run token
  validation, server-side cap/rotation), and `firestore.rules` refuses
  client mutation of `fcmTokens` — the key stays in `hasOnly` because
  merges evaluate the post-merge doc, but any write that introduces or
  changes the list is denied (negative tests in
  `firestore-tests/rules.test.ts`). The binding is by App Check
  attestation, not cryptographic possession proof; if that is ever
  warranted, the shape is a nonce sent to the token that the device
  echoes back, and the callable is where it lives.
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
  `CODE_SIGN_ENTITLEMENTS`). **Two of the three steps below no longer need
  a Mac**, which is what changed on 2026-08-05:
  1. ~~Drop `GoogleService-Info.plist` into `ios/App/App` and add it to the
     App target~~ — **done, and automated.** The file lives in the
     `GOOGLE_SERVICE_INFO_PLIST` repository secret;
     `scripts/ios-link-firebase-plist.rb` adds it to the target at build
     time, because "drag it onto the target in Xcode" is precisely the step
     a runner cannot do. The `REVERSED_CLIENT_ID` placeholder in
     `Info.plist` is filled. Both release gates assert the file is in the
     bundle — AppDelegate skips `FirebaseApp.configure()` without it, and
     the app then ships with no backend at all.
  2. ~~Xcode → Signing & Capabilities: confirm the provisioning profile
     regenerates with `aps-environment`~~ — **done, and automated.** The
     workflow reads the entitlement out of the archive *and* the exported
     `.ipa` and fails on anything but `production`. Run 6 reports
     `production` at both ends.
  3. **Still outstanding, and it is console work rather than Mac work:**
     Apple Developer → upload the APNs key to Firebase (step already listed
     above), then verify the reveal flow end-to-end on device. A device is
     still a device — that half cannot be automated.
- **Reveal membership snapshot — both deploys shipped.** Reveal reads used
  to be gated on a group's *current* `memberUids`, so joining a group
  exposed every past day's votes and display names. The fix was two
  deploys and both have landed:
  1. **Done** — `revealGroupDay` writes a `members` array onto each reveal
     doc (functions/src/v2social.ts).
  2. **Done** — the `v2_groups/{gid}/reveals/{day}` read rule gates on
     `resource.data.get("members", [])`, and the client's reveal listener
     treats `permission-denied` as the expected state of a late joiner
     rather than reporting it (src/v2/data/live.ts). Backfill was decided
     as unnecessary — see D5's amendment in `docs/DECISIONS.md` for the
     arithmetic, and re-check it before seeding if this repo has been
     deployed somewhere the checklist did not track.

  They could not be collapsed into one deploy: a released ruleset applies
  instantly while gen2 functions roll out over minutes, so reveals written
  in that window would carry no `members` field and be permanently
  unreadable by their own members. Removing the field later has to run in
  the opposite order — rule first, then payload.
- **Storage bucket — confirm empty, then lock down.** `storage.rules` was
  configured in `firebase.json` and deployed by nothing; the deploy
  workflow applies it as its own step, and as of 2026-07-31 that step
  **works and has released the rules** (deploy run 30644637683). It had
  silently failed on every prior run — the step used `--only
  storage:rules`, which names a nonexistent deploy target, and
  `continue-on-error` (there for the no-bucket case) swallowed the error;
  PR #51 fixed the flag to `--only storage`. The step stays
  `continue-on-error`, so keep checking its log, not its checkmark, after
  workflow changes. The only path the rules grant,
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
  that — and **stop there**.

  **This bullet used to add "and the app collects no email or name via
  Google either". Delete that from any reply; it is false.**
  `linkGoogle()` calls `new GoogleAuthProvider()` with no `addScope`
  (`src/lib/firebaseImpl.ts:167`), and Firebase requests `email` and
  `profile` by default — so the Firebase Auth user record holds an email
  address and a display name for every linked account. No Firestore
  document of ours stores them, which is probably how the sentence got
  written, but Apple's question is what the app and its partners
  *collect*, not what our own schema keeps.

  The consequence is not the 4.8 reply, which stands without that clause.
  It is the privacy questionnaire: **Contact Info → Email Address** and
  **Contact Info → Name** are collected, linked to identity, and used for
  App Functionality. `docs/STORE-FORMS.md` is the file to answer from, and
  it has this right — this bullet was the copy that did not.

  Only if they insist: add the Apple provider. Enable the capability in
  the developer portal **before** committing the entitlement, and use
  `rawNonce` when exchanging the credential or `linkWithCredential` fails.
  Do not pre-build this — an unused sign-in path is its own review
  surface.
- **Version lockstep** — bump package.json `appBuild` + android
  `versionCode` + iOS `CURRENT_PROJECT_VERSION` together each release.

- **Discoverable scrub — now a delete, not a truncate.** This entry used
  to say "rules cap `insight_discoverable` writes to a bare geohash5 cell,
  so truncate `location.geohash` to 5 chars and delete `location.geopoint`".
  That cap is `isValidDiscoverableWrite()` in **`firestore.rules.v1-archive`**
  — undeployed since D4. The live ruleset has no `insight_discoverable`
  block at all, and `rules.test.ts` pins read *and* write as denied.

  With the cap gone the remedy changes, because truncating one field
  leaves the rest of the document standing: `personality` (Big Five),
  `political` (econ/social — GDPR Art. 9), `age`, `bio`, `role`,
  `displayName`. `docs/data-inventory.md` already says the honest scope is
  "the whole document, not just its location field", and gates the store
  privacy answers on this having run. The collection has no writer (D4
  deleted the v1 client) and no reader (D13 deleted the aggregators), so
  there is nothing to preserve:

  ```bash
  node scripts/scrub-v1-discoverable.mjs --project prvfire33          # report
  node scripts/scrub-v1-discoverable.mjs --project prvfire33 --apply  # delete
  ```

  Dry run by default; it counts field *presence* and never prints a value
  or a uid, so the report is safe to paste. Needs
  `GOOGLE_APPLICATION_CREDENTIALS` or `gcloud auth application-default
  login`. Verified against the Firestore emulator, not just reasoned about.

## Known deferrals (tracked, not blockers)

- ~~Functions runtime Node 20 → upgrade before 2026-10-30
  decommission.~~ Done: nodejs22 + firebase-functions v6 +
  firebase-admin v13. Verify the first scheduled runs after deploy.
- `onV2AnswerCreated` region (us-central1) vs Firestore (eur3) — works,
  cross-region hop; relocate when convenient (requires delete+recreate
  of the trigger).
- Ranking/scale feed card types; Circle/Near mirror population fields
  (need geo opt-in + circle data); world comments are OUT by decision D1.
- Bundle: the world feed now loads after first paint (D25), taking the
  entry chunk to ~850 KB from ~947. The rest of the split — the Mirror tab
  (~168 KB) and the overlays (~176 KB) — still waits on the feature
  surface settling. Note the cost this is buying down is parse and eval on
  a cold start, not network: the bundle ships inside the native package.
