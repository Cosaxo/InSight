# Releasing on Google Play — the readiness assessment

**Play is parked ([D42](DECISIONS.md#d42--insight-launches-on-ios-alone-play-is-deferred-and-the-path-to-it-gets-cheaper-while-it-waits)).**
This page is not a decision to un-park it. It is the answer to "what
would it take", written down while nothing is urgent, so that the day
the owner says go the work is transcription rather than discovery —
the same reason [`STORE-FORMS.md`](STORE-FORMS.md) §3 keeps a derived
Data Safety form for an app nobody is shipping.

[`IOS-RELEASE.md`](IOS-RELEASE.md) is the sibling and the model. The
difference in tone is deliberate: that page describes a pipeline that
has delivered 28 builds, so it can afford to be a procedure. This one
describes a path nothing has walked, so it names what is **verified**,
what is **built but unexercised**, and what is a **decision rather than
work** — and keeps those three apart, because conflating them is how a
launch estimate goes wrong.

---

## 0 · The short answer

Less is missing than the parked status suggests. The shell is complete,
the listing copy is written and gated, and both Play image assets
generate from the product's own stylesheet. What is missing is
**four pieces of code, one web page, and three decisions** — and one of
the four pieces of code fails silently in exactly the way this repo has
been bitten by twice before.

| | Item | Kind | State |
| --- | --- | --- | --- |
| 1 | Release signing — `buildTypes.release` has no `signingConfig` | code | **done** (D340) — built and verified against a real build |
| 2 | No `play-release.yml` — the AAB has no way out of CI | code | **done** (D340) — written; the four Play API calls are untested |
| 3 | App Check → Play Integrity, or **every callable fails on Android** | console | **written down** (SHIP-CHECKLIST §2); the console work is account-gated |
| 4 | `google-services.json`, downloaded in the right order | console | account-gated |
| 5 | An account-deletion **URL** — Play requires one, Apple does not | web page | **done** — `web/delete-account.html` |
| 6 | The Data Safety **Shared** column after D98 | owner decision | open |
| 7 | The account type — re-read D41 under D42's condition | owner decision | **decided** — ENK, so D41's organization route (D340) |
| 8 | The payments-policy read on D313/D315's Stripe checkout | owner decision | open |

Everything else is either done or trails the submission.

**Worked 2026-09-01, second pass (D340):** Play un-parked onto D41's
organization route on the owner's call, items 1 and 2 built, and §2.6
measured rather than reasoned. **What remains needs a Play Console account
or an owner's ruling — there is no longer any Play work in this tree that
somebody could just sit down and do.**

**Worked 2026-09-01, first pass:** item 5 built,
item 3 written into the checklist that was missing it, §3.2's transposed
row corrected, §3.4's stale rationale restated in both copies, and §4's
proposed third leg on `check:store-forms` built with tests. What is left
is the two code items, the console work nobody without an account can do,
and the three decisions — which is the point of splitting the table this
way: **everything on it that did not need an account or an owner is now
done.**

---

## 1 · What is already built

Worth listing first, because the parked status reads as "nothing", and
D42's decision to park rather than delete is the reason this column is
long. It said so at the time — *"Do not remove those jobs to tidy up —
the whole value of parking rather than deleting is that the shell still
compiles on the day this is revisited"* — and the shell does.

- **The shell compiles on every PR.** `android-build` in `ci.yml` runs
  `cap sync android` then `./gradlew assembleDebug`; `native-sync-drift`
  catches an unsynced native tree. Both survived the park.
- **The API levels are above Play's floor.** `variables.gradle` sets
  `compileSdkVersion = 36` and `targetSdkVersion = 36`, `minSdkVersion = 24`.
  Play's target-API requirement for new submissions is met with a year in
  hand.
- **The manifest is finished, not scaffolded.** App Links on
  `/join/` with `autoVerify`, the `insight://join` custom scheme
  ([D238](DECISIONS.md)) that carries invites while the fingerprint is
  unfilled, the three FCM meta-data entries (icon, colour, default
  channel) without which a backgrounded reveal push is dropped in
  silence, `POST_NOTIFICATIONS`, the coarse/fine location pair with its
  reasoning, and `allowBackup="false"` ([D6](DECISIONS.md)).
- **The launcher icons are generated**, all 16, from
  `design/icon/mark.svg` via `scripts/gen-icons.mjs`
  ([D302](DECISIONS.md)).
- **The Play listing copy is written and length-gated.**
  `design/store/listing.json` carries `play.title`, `play.shortDescription`
  and `play.fullDescription`; `npm run check:store-listing` holds all
  three inside Play's limits, and `npm run check:public-copy` holds them
  against the retired pre-D98 privacy vocabulary ([D116](DECISIONS.md)).
  The second gate is the one that matters — length is easy to check and
  truth is the thing that went stale.
- **Both Play image assets generate from the running app.**
  `npm run build:feature-graphic` rasterises the mandatory 1024×500 from
  `mark.svg` inside the app's own document, so it cannot drift from the
  palette; `npm run build:screenshots` captures the `play-phone` profile
  at 1080×1920. Both need Playwright installed on demand — deliberately
  not a dependency.
- **The Data Safety answers are derived**, in
  [`STORE-FORMS.md`](STORE-FORMS.md) §3, from the same audited
  `data-inventory.md` Apple's labels come from.
- **`versionCode` is already in lockstep.** `check:versions` has been
  carrying `android/app/build.gradle` alongside the iOS project the whole
  time it was parked — D42 called that harmless and cheaper than
  special-casing it, and it means there is no version reconciliation to do.
- **The D3 account-upgrade path is wired on the Gradle side.**
  `rgcfaIncludeGoogle = true` in `variables.gradle`; without it Google
  sign-in compiles and throws at the tap.

## 2 · The code and config gaps

### 2.1 · Release signing does not exist

`android/app/build.gradle`'s `release` block sets `minifyEnabled false`
and proguard files, and **no `signingConfig`**. `./gradlew bundleRelease`
today produces an unsigned AAB, which Play will not accept.

**Built at D340 and verified against a real build.** `android/app/build.gradle`
now reads the keystore from the environment first (CI secrets) and an
untracked `android/keystore.properties` second. **With neither present the
release stays unsigned on purpose** — a clean clone, `assembleDebug`, and
the `android-build` job D42 kept alive all keep working, and a
configure-time warning says what is missing. `signingConfig` is left null
rather than defaulted to debug: a debug-signed AAB is worse than an
unsigned one, because it uploads, installs, and can never be updated by a
correctly-signed build.

You still generate and hold the keystore. Under Play App Signing, Google
holds the app signing key and this one is only the upload key, replaceable
if lost — which is the single thing that makes a lost keystore survivable.
Enroll rather than opting out.

Verified, not assumed: `assembleDebug` still succeeds; `bundleRelease`
with nothing configured succeeds and produces an unsigned bundle;
`bundleRelease` with a throwaway keystore succeeds and carries a signature
block.

`minifyEnabled false` is worth a second look at the same time but is not
a blocker: it costs download size, not correctness, and turning R8 on for
a Capacitor shell is a change that wants its own testing pass rather than
a line in a signing commit.

### 2.2 · There is no `play-release.yml`

`ios-release.yml` exists because a Mac was the only hard dependency
between this tree and a live app. Android has no such dependency, which
is why the analogue was never written — and also why it is much cheaper
than its sibling: an `ubuntu-latest` runner rather than macOS at 10×
billing, no cloud signing, no provisioning profiles, none of the four
runs of signing archaeology that `ios-release.yml`'s comments preserve.

**Built at D340.** What it carries, and why each piece is where it is:

- The same pre-flight — but `node scripts/check-store-copy.mjs` **without**
  `--ios`. That flag exists to excuse D42's parked Play fingerprint
  (`IOS_ONLY` in the script); on the Play path the fingerprint is the
  thing being filled, so excusing it would defeat the check. See §4.
- `npm run check:public-copy` and `npm run check:versions`, for the same
  reasons the iOS job runs them: the privacy panel is compiled into the
  binary, and a reused version code is refused after the upload
  completes.
- The same `VITE_*` variables and the same `check:web-firebase` +
  `check:bundle` assertions against `dist/` **before** `cap sync` — the
  iOS job's comment on that ordering is the whole lesson, and it applies
  unchanged: a mock-mode demo bundle builds, signs, uploads and installs.
- `google-services.json` written from a secret and linted, the exact
  mirror of the plist step, with the same reasoning: its absence is
  silent and the first symptom is a user seeing an app that never loads
  a question.
- `./gradlew bundleRelease`, artifact upload, and — behind a
  `workflow_dispatch` boolean, as on iOS — publication through the Play
  Developer API with a service-account JSON secret.

The `upload=false` first run is copied verbatim from the iOS job. It is
how you find out whether signing works before it matters.

Three things the iOS job has no equivalent of:

- **`scripts/play-upload.mjs`** does the publish with **no dependency at
  all** — Node 22's `fetch` plus `node:crypto` for the RS256 assertion,
  against the Play Developer API v3. The obvious move is a marketplace
  action, and this tree's bar is visible in `ci.yml`, which declined even
  `gradle/actions/setup-gradle` for "one fewer third-party action to pin
  and audit". An upload step holds the one credential that can publish to
  real users. Its pure helpers are tested; the four API calls are not, and
  cannot be until an account exists.
- **`--first-upload`** on `check:store-copy`, for the bootstrap in §2.5.
- **Three assertions on the bundle itself** — signed, Firebase config
  actually compiled in (`google_app_id` in `resources.pb`, matched on the
  exact resource name because a looser grep for "firebase" passes on a
  config-less bundle), and 16 KB alignment. Each was verified in both
  directions against real bundles.

**None of it has run against a real Play account, because there is not one
yet.** Written and unexercised, said plainly here rather than discovered
at the first dispatch.

### 2.3 · App Check, and the silent failure that is not in the checklist

**This is the one to be careful about.** Every callable in this tree
demands App Check attestation ([D36](DECISIONS.md),
`npm run check:appcheck` on the deploy path). `src/lib/appcheck.ts`
initialises the native plugin, which auto-selects the platform provider:
DeviceCheck on iOS, **Play Integrity on Android**.

Play Integrity attestation requires the Firebase Android app to be
registered in App Check with the Play Integrity provider, the Play
Integrity API enabled on the linked Cloud project, and the Play Console
account linked to it. Miss any of that on a build that reaches users and
the app opens, renders, and every callable is rejected.

That is the same shape as the two traps SHIP-CHECKLIST §2 already names
— the missing `REVERSED_CLIENT_ID` and the `google-services.json`
downloaded before a SHA-1 was registered — and it is not currently
written down anywhere for Android, because on iOS it was satisfied as a
side effect of enrolling in the Apple Developer Program. It should be
added to the checklist when Play is un-parked.
[`DEVICE-BIND.md`](DEVICE-BIND.md) §1 already carries the Play Integrity
console steps for D29's purposes; the App Check registration is a
different switch on the same API.

### 2.4 · `google-services.json`, and the order it must be downloaded in

SHIP-CHECKLIST §2 has this in full and it does not need repeating here,
only pointing at, because the trap is an ordering one and ordering traps
are what get skipped: the file contains an Android `oauth_client` entry
**only if a SHA-1 is registered for the package at the moment you
download it**. Without one, FCM works, Firestore works, and
`signInWithGoogle` fails with `DEVELOPER_ERROR` — D3's only
account-upgrade path, dead on one platform, on a build that compiled.

Two fingerprints from two places at two times: the debug keystore's now,
and Play App Signing's only **after** the first upload. The file is a
snapshot, not a live lookup, so it must be re-downloaded after the second
one exists.

### 2.5 · `assetlinks.json`

`web/.well-known/assetlinks.json` ships with
`REPLACE_WITH_PLAY_SIGNING_SHA256`. The value comes from Play Console →
Setup → App signing and therefore cannot exist before the first upload,
which makes this a post-upload step rather than a pre-flight one.

That chicken-and-egg is handled rather than tolerated: `check:store-copy
--first-upload` excuses the placeholder for exactly one run and says
loudly that it is good for one, and `play-release.yml` runs the check
**bare** by default, so every upload after the first fails until the
fingerprint is filled. The flag is deliberately separate from `--ios`,
which excuses the same line for the opposite reason — "not my store"
versus "not yet mintable".

It is a **quality gap, not a blocker**, and D238 is why: the hosted
`/join` page's "Open in InSight" button navigates to `insight://join/CODE`,
a custom scheme that needs no fingerprint, so a tapped invite already
reaches the app. What the fingerprint buys is the `https` route working
directly, without the interstitial page.

### 2.6 · 16 KB page size — unverified, and it can block a release

Since 1 November 2025 Play blocks releases of apps targeting Android 15+
whose native libraries are not 16 KB-page-aligned. An app with no native
code is compliant by construction, and almost everything here is: the
Capacitor plugins, Firestore and Play Integrity are managed code.
**`@sentry/capacitor` is the exception** — the Sentry Android SDK ships
`.so` files.

**Measured at D340, and the answer is that nothing needs doing.** The
Android SDK and `node_modules` were installed and the release bundle
built. It carries three native libraries across four ABIs —
`libsentry.so` and `libsentry-android.so` as predicted, plus
`libdatastore_shared_counter.so`, which was **not** predicted: it comes
from androidx.datastore, and it is the reminder that "which dependencies
ship native code" is a question to measure rather than to reason about.

**Every LOAD segment on both 64-bit ABIs reports `0x4000` — 16384 exactly,
the requirement.** So the app is compliant today with no work.

That measurement is now **a step in `play-release.yml`** rather than a
sentence here, because what makes it true is a dependency version and
nothing else in the tree would notice it regressing. A document recording
a passing measurement is the thing that goes stale; a gate is not.

## 3 · What Play asks that Apple did not

The forms are not a translation of Apple's. Four of these have no App
Store counterpart at all, which is why "we already filed on Apple" is not
a shortcut.

### 3.1 · The account-deletion URL — a real gap, and a cheap one

Play requires every app that offers account creation to provide **both**
an in-app deletion path **and** a web URL where deletion can be
requested without installing the app. The URL is submitted in the Data
Safety form and enforced independently of the rest of it. It must be
publicly reachable without a login, over HTTPS, and link **directly** to
the deletion resource — a homepage with a buried link does not satisfy
it — and it must say what is deleted, what is retained and why, and how
long it takes.

InSight has the in-app half and does it well: the privacy panel's delete
button, and `web/privacy.html`'s *"Deleting everything"* section, which
already enumerates what goes and names the two things that survive with
the reason each survives. What it does not have is a **URL that is the
deletion resource** — that section is a section of a long policy page,
and the request route is the support address further down it.

**Built 2026-09-01: `web/delete-account.html`.** It carries both routes —
the in-app button, and an email route for someone who no longer has the
app — the full list of what is deleted, the two things that survive with
the reason each survives, and a 30-day answer window. `web/privacy.html`
links it from its own *Deleting everything* section, so it is
discoverable as well as addressable, and `firebase.json` already publishes
the whole `web/` directory, so it is served with no hosting change. The
URL is carried in `design/store/play-data-safety.json` and held to the
page's existence by `check:store-forms` rule 6 — a rename in `web/` now
fails the gate rather than becoming a dead link on a filed form.

**One limit is stated on the page rather than papered over.** InSight
gives every install an account without asking anyone to sign up
([D3](DECISIONS.md)), so an account that never linked Google and never
claimed a handle carries nothing that can be matched to an email. The
web route genuinely cannot reach it, and the page says so plainly instead
of implying otherwise. That is a property of anonymous-first, not a gap in
the page: such an account holds no name, no address and no identifier, and
the device's own delete button is its route.

Note it is required *because account creation is offered at all* — the
fact that InSight is anonymous-first and every install becomes an account
silently ([D3](DECISIONS.md)) makes the requirement more clearly
applicable, not less.

### 3.2 · The Data Safety "Shared" column — an owner decision

[`STORE-FORMS.md`](STORE-FORMS.md) §3 already carries this, flagged
`OPEN AFTER D98`, and it is deliberately left unresolved there. Every row
files **Shared = No**; Play defines sharing as transfer to a *third
party* and carves out user-initiated transfers, so "answers are visible
to other users of the same app, which the app states plainly" is arguably
still Not Shared.

Arguably is not good enough for a filing, and that page is right that
flipping six rows on an engineer's reading would be as wrong as leaving
them. **Resolve it before filing, not while filing.** The Collected
column is unaffected either way.

Three smaller ones live next to it. §3's table had a row whose columns
were visibly transposed — Precise location read
`Yes (D175) | App Functionality | Not linked… | No` against a
`Collected | Shared | Optional? | Purpose` header — **corrected
2026-09-01**, and it is now the regression pinned by rule 6's tests,
because it is precisely what a machine-readable twin exists to catch.

Two more are flagged in §3 itself rather than changed, because both are
re-derivations against `data-inventory.md` rather than typos: the **App
activity** row files No while §1's Apple table carries Product Interaction
as collected since D270 and linked since D272 — the under-declaring
direction — and the **Purchases** row predates D313/D315 existing at all.
Neither should be transcribed as it stands.

And the file's own D322 note records that Play's rows gain a
**Personalization** purpose when the form is actually filed.

### 3.3 · The forms with no Apple counterpart

- **IARC content rating questionnaire.** Play's own, administered by
  IARC. STORE-FORMS §2's Apple answers are the right *input* — the
  measured "every content frequency question is None", the scan across
  all four committed banks — but the questionnaire differs and the answers
  are not transferable field for field.
- **Target audience and content**, which drives Families policy
  applicability. Made for Kids is No; the answer is straightforward but
  the form is mandatory.
- **Ads declaration.** Since D315 the app carries paid ad placements,
  so this is **Yes** — and it is worth noticing that this is a place
  where the honest answer changed after the Apple filing was made.
- **News, government, financial-features, health declarations.** All No,
  but each must be answered.

### 3.4 · The payments-policy read — flag it, do not assume Apple settled it

Since [D313](DECISIONS.md) and D315 a user can buy a paid question or an
ad from inside the app: `suggestions.jsx` calls `SG.payFor(id)` →
`requestCheckout` → `createPaidCheckoutV2`, and opens the returned Stripe
URL with `window.open(url, '_blank')`, which leaves the app for the
system browser. `NEXT-FUNCTIONALITY.md` §6's rule — commerce stays on the
web side — is what put it there.

Apple has already passed builds carrying this. **That does not settle
Play.** Google's Payments policy is worded differently, and the thing
being bought — a sponsored question, an ad slot — is *served inside the
app*, which is the fact that makes the "consumed outside the app"
exemption a question rather than an answer. The 2025 injunction relaxed
link-out rules for US users specifically, which does not resolve it for
a worldwide listing.

This wants a read in the Play Console policy flow before the first
submission, not an engineer's conclusion. Two things that are **not** in
doubt: there are no Google Play Billing products, so the store listing's
*In-app purchases* declaration stays a truthful **No** — that checkbox
asks about Play Billing products, and the policy question is a separate
one, so answering the checkbox does not dispose of it. And
`app-privacy.json`'s `lootBox: false` stays correct; its `$lootBox`
rationale ("No in-app purchases at all") is the sentence that has gone
stale, in the D116 shape — right answer, reasoning that no longer holds.

### 3.5 · The account type — re-read D41 *and* D42 together

**Decided at D340: the owner is going for an ENK**, which is D41's
organization route and the before-an-installed-base branch, so **D41
stands in full and nothing in it needs re-deriving.** The rest of this
section is why that is the cheaper branch, and what has moved under it.

[D41](DECISIONS.md) chose an organization account, backed by an ENK and a
D-U-N-S, to escape the closed-testing gate. [D42](DECISIONS.md) made that
**conditional rather than settled**: if Play opens before there is an
installed base, D41 stands; after one, the gate may be satisfiable by
asking existing users, and the organization account becomes optional.
D42 was explicit that both halves be re-read rather than assumed, which is
what this is.

What has changed since D41 was written, and it moves in the app's favour:
the requirement is now **12** testers rather than the 20 it launched at,
still for 14 continuous days, still only for personal accounts created
after 13 November 2023. Reporting through 2026 says Google additionally
checks that testers genuinely used the app, which raises the bar on
*quality* of testers while lowering the count — so a real installed base
helps twice and a tester farm helps not at all (D41 rejected those
outright, and the reason stands: the downside is account termination).

D42's unverified link is also still unverified and **is now the live
question**, because the ENK is being registered: whether Google's
organization verification accepts an Enhetsregisteret-only ENK, or wants
what Foretaksregisteret provides. If the latter, the free path becomes a
~3,000 kr one. Check it in the account-type flow **before paying for a
D-U-N-S expedite**. No code depends on the answer.

**And one follow-up the ENK itself creates.** If it is registered under a
business name, `web/terms.html`'s operator line has to name the entity a
user is actually contracting with rather than Olaf Taule personally. D41
and SHIP-CHECKLIST both say so, and `check:store-copy` **cannot** raise it
— it only sees placeholders, and a stale name looks exactly like a correct
one. Answer it when the ENK exists.

## 4 · What changes in the gates

- **`check:store-copy` has stopped being a known-permanent failure.** D42
  recorded the bare run's single remaining placeholder as a permanent
  non-blocker; D340 retires that status — the fingerprint is now merely
  *unminted*, which is a different thing, and `--first-upload` (§2.5) is
  the one-run excuse that says so. `play-release.yml` runs the check bare
  by default, so the fingerprint is enforced from the second upload on.

  **Two things still to do here, once the fingerprint is filled.** The
  `--ios` flag in `ios-release.yml`'s pre-flight becomes a hole rather than
  a courtesy — it excuses a value that is now obtainable — and with both
  release paths running the bare check, the script can finally go into CI,
  which is the thing it was kept out of CI *for*.
- **`check:store-forms` got its third leg, 2026-09-01.**
  `design/store/play-data-safety.json` is now the machine-readable twin of
  STORE-FORMS §3, and **rule 6** holds them equal row for row — total in
  both directions, unlike rules 1–2, which compare only the collected set,
  and which a transposition passes straight through. It also holds the
  deletion URL to being `https` and naming a page that exists in `web/`.
  `scripts/check-store-forms.test.mjs` pins the parser against synthetic
  markdown, including the transposed row as it actually shipped, because a
  gate parser that silently matches nothing is this repo's most-repeated
  failure (D179, D197, D275) — and the success line now reports the Play
  row count so a fall to zero is visible rather than green. The file is
  also under `check:public-copy` now, so a parked form cannot quietly
  carry retired pre-D98 vocabulary either.
- **`check:versions`** already covers `versionCode` — nothing to do.
- **`check:public-copy`** already covers `listing.json`, so the Play
  description is under the same truth gate as Apple's.
- **`check:appcheck`** is unchanged by any of this. It asserts the
  server demands attestation; whether Android can *produce* one is a
  console fact no script here can see, which is exactly why §2.3 is a
  checklist item rather than a gate.

## 5 · The order, if it is un-parked

**It is un-parked (D340), so this is the live order.** Struck items are
done; everything left needs an account or a ruling.

1. ~~**Account type**~~ — decided: ENK, D41's organization route.
2. **Register the ENK** → organisasjonsnummer → D-U-N-S → Play Console
   organization account. Check the Enhetsregisteret-vs-Foretaksregisteret
   question (§3.5) before paying for any expedite, and answer the
   `web/terms.html` operator-line question if it trades under a name.
3. **Console, because two code steps need values only it can mint:** app
   created → Play Integrity + App Check registration (§2.3) →
   `google-services.json` with the debug SHA-1 (§2.4) → a service account
   with Play Developer API access, for `PLAY_SERVICE_ACCOUNT_JSON`.
4. **The secrets and variables** `play-release.yml` names in its header,
   including generating the upload keystore and enrolling in Play App
   Signing.
5. ~~**Code**~~ — signing, the workflow, the deletion page and the 16 KB
   check are all built (D340).
6. **The first dispatch: `upload=false`.** It builds, signs, and runs
   every assertion without Play seeing anything.
7. **Then `upload=true first_upload=true track=internal`.** Not
   production — see §2.2 on why that track is an explicit choice.
8. **Immediately after, the two things Play App Signing has just made
   possible:** the SHA-256 into `assetlinks.json` and a hosting deploy
   (§2.5 — the next dispatch fails until this is done), and the SHA-1 into
   Firebase with a `google-services.json` re-download (§2.4).
9. **The forms** (§3.2, §3.3), including the two rows that need
   re-deriving first, and **recaptured screenshots** against seeded
   production — the committed set is a demo-mode preview and one capture
   shows affordances a live question never has.
10. **Production access**, then the production track.

The one thing no step here covers: **nobody has run this app on an
Android phone.** CI compiles `assembleDebug`, which proves the Gradle
config parses. SHIP-CHECKLIST §4's on-device list is unchecked and written
iPhone-first. Step 6 gives you an installable artifact; walking that list
on a real handset is the cheapest bug-finding on this page.

## 6 · Sourcing

Stated because it is weaker than this file's norm, and for the same
reason D41 stated its own: **`support.google.com` is blocked by this
environment's egress proxy**, so Google's primary policy pages could not
be read directly. The Play-side claims here — the 12×14 testing rule and
its 2024 reduction from 20, the account-deletion URL's specification, the
16 KB enforcement date and its scope, the 2025 US billing injunction —
come from search results and secondary write-ups accessed 2026-08-31, not
from the policy pages themselves.

That is enough to plan against and to know what to look for. It is not
enough to file a form against, and none of it should be transcribed into
a console without reading the console's own text. The repo-side claims
above — every file, gate, script and manifest entry — were read in the
tree rather than recalled, with §2.6 the one explicitly-flagged
exception.
