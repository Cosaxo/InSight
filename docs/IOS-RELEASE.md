# Releasing iOS without a Mac

`.github/workflows/ios-release.yml` produces a signed archive and, on
request, uploads it to App Store Connect. It exists because after D42
deferred Play, a Mac with Xcode was the **only** hard dependency left
between this tree and a live app — and a macOS runner has Xcode.

**Read this before the first run.** Four values have to exist first, and
one of them takes two minutes in a web UI that is easy to misconfigure in
a way that only shows up as a signing failure twenty minutes into a build.

---

## 1 · The App Store Connect API key

App Store Connect → **Users and Access** → **Integrations** → **App Store
Connect API** → **+**.

- **Access role: Admin.** Not App Manager, and definitely not Developer.
  Export uses Apple's *cloud signing* to create the distribution
  certificate and the provisioning profile on demand, and **only an Admin
  key may create a distribution certificate.** App Manager can manage
  profiles, which is why it looks sufficient and is not. A key with too
  little access fails at export like this:

  ```
  error: exportArchive Cloud signing permission error
  error: exportArchive No signing certificate "iOS Distribution" found
  error: exportArchive No profiles for 'com.cosaxo.insight' were found
  ```

  Note that the certificate error and the profile error appear together:
  the profile cannot exist because the certificate it would reference
  cannot be created. Chasing the profile line first is the wrong end.

  **This file said App Manager until 2026-08-05**, and run 4 is how that
  was found — after the archive itself had already succeeded.
- Download the `.p8` **immediately**. Apple serves it once and never
  again; a lost key is revoked and replaced, not recovered.
- Note the **Key ID** (10 characters) and the **Issuer ID** (a UUID shown
  above the key list — it is per-account, not per-key, and it is the one
  people miss).

## 2 · The repository values

Settings → Secrets and variables → Actions.

| Name | Kind | Value |
| --- | --- | --- |
| `ASC_KEY_ID` | Secret | the 10-character Key ID (from an **Admin**-role key — see § 1) |
| `ASC_ISSUER_ID` | Secret | the Issuer UUID |
| `ASC_PRIVATE_KEY` | Secret | the **contents** of the `.p8`, including the `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----` lines |
| `GOOGLE_SERVICE_INFO_PLIST` | Secret | `base64 -i GoogleService-Info.plist` — paste the output |
| `VITE_SENTRY_DSN` | Secret | optional; without it the release ships with no crash reporting |
| `APPLE_TEAM_ID` | **Variable** | the 10-character Team ID |
| `VITE_FIREBASE_API_KEY` | **Variable** | from the Firebase console → Project settings → your **web** app |
| `VITE_FIREBASE_AUTH_DOMAIN` | **Variable** | same panel, e.g. `prvfire33.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | **Variable** | same panel, e.g. `prvfire33` |
| `VITE_FIREBASE_APP_ID` | **Variable** | same panel, the `1:…:web:…` string |
| `VITE_FIREBASE_STORAGE_BUCKET` | **Variable** | optional |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | **Variable** | optional |
| `VITE_FIREBASE_MEASUREMENT_ID` | **Variable** | optional |

`APPLE_TEAM_ID` and the `VITE_FIREBASE_*` values are variables rather than
secrets on purpose: they ship in every binary — the Team ID is published in
`web/.well-known/apple-app-site-association`, and the Firebase web keys
identify a project rather than authorise anything, because access control
lives in `firestore.rules`. Storing a public value as a secret only makes it
harder to read in logs when a build fails.

**The four required `VITE_FIREBASE_*` values are not optional in the way
they look.** `GoogleService-Info.plist` configures the *native* half of the
app; these configure the JavaScript half, and the app talks to Firestore
from the JavaScript. `src/lib/firebase.ts` treats any one of them being
empty as "run in mock mode", so a release built without them is a working
demo app — signed, uploadable, and showing whoever installs it a deck of
questions nobody else can see. `npm run check:web-firebase` runs
immediately after the build, against `dist/` rather than against the
environment, and fails the job before `cap sync` copies anything into the
shell. It is the JS-side counterpart to the `plutil -lint` on the plist.

On macOS, `base64 -i file`. On Linux, `base64 -w0 file`.

## 3 · Two things still to fill in the repo

Neither is secret and both are guarded by `npm run check:store-copy --ios`,
which the workflow runs as a hard gate before spending any runner minutes:

- **`ios/App/App/Info.plist`** — replace `REPLACE_WITH_REVERSED_CLIENT_ID`
  with the `REVERSED_CLIENT_ID` value from `GoogleService-Info.plist`.
  Without it the Google sign-in sheet opens and never returns, taking D3's
  only account-upgrade path with it.
- **`web/.well-known/apple-app-site-association`** — replace
  `REPLACE_WITH_TEAM_ID` with the Team ID, then redeploy hosting.

The Play fingerprint in `assetlinks.json` stays unfilled and is **parked**
under D42. `--ios` excuses that one and nothing else.

---

## Running it

**First run: `upload = false`.** Actions → *iOS release* → Run workflow →
leave upload unticked.

That does everything except talk to App Store Connect: it archives, runs
both silent-failure gates, and attaches the signed `.ipa` as an artifact.
It is how you find out whether signing works before a mistake is visible
to anyone.

**Then `upload = true`** when the archive is clean and the App Store
Connect app record exists.

### Bump the build number every time

`appBuild` in `package.json`, kept in lockstep with the native projects by
`npm run check:versions` (`--fix` writes it into both). **App Store Connect
refuses a build number it has already seen**, and it refuses it *after* the
upload transfers, so a forgotten bump costs a full run.

---

## What the workflow checks that a human would forget

Two failures in this project are completely silent — they produce a
working-looking build that is broken on a device, with nothing in any log:

1. **`aps-environment` must be `production`.** A development entitlement
   means the device registers with the APNs sandbox while FCM sends to
   production: no error anywhere, and no reveal push ever arrives. The
   workflow reads the entitlement out of the exported **`.ipa`** and fails
   if it is anything else.

   **Out of the `.ipa`, not the archive, and the difference is the whole
   point.** Under `CODE_SIGN_STYLE = Automatic`, `xcodebuild archive` signs
   with a **development** profile and `exportArchive` re-signs for
   distribution. So the archive's entitlement is not the one that ships.
   Checking the archive — which this workflow did on its first two runs —
   fails every correct build.

   The related trap, learned the same way: **do not set
   `CODE_SIGN_IDENTITY` at all when signing automatically.** An earlier
   commit set it to `"Apple Distribution"` at project level, reasoning that
   an archive should be distribution-signed. Xcode refused outright:

   ```
   App has conflicting provisioning settings. App is automatically signed
   for development, but a conflicting code signing identity Apple
   Distribution has been manually specified.
   ```

   Automatic signing resolves the identity per action, and any explicit
   value is a conflict rather than a hint. The project-level Release entry
   is now absent; Debug keeps `"iPhone Developer"`, which is correct for it
   and never reached by an archive.

2. **`GoogleService-Info.plist` must be inside the bundle.** It is
   gitignored, and it is *not referenced in `project.pbxproj`* — in Xcode
   you add it by dragging it onto the target, which is precisely the step
   a runner cannot do. `scripts/ios-link-firebase-plist.rb` adds the
   reference at build time; the workflow then asserts the file is actually
   in the built `.app`.

   Without it, `AppDelegate` skips `FirebaseApp.configure()` and the app
   ships with no backend at all. It installs and opens; it simply never
   loads a question.

   The reference is deliberately **not** committed: a `PBXFileReference` to
   a file that is not on disk is a hard build error, and the file is absent
   on every checkout — including `ios-build.yml`'s simulator job, which
   asserts the plist is *absent* from the bundle so that a committed secret
   cannot pass unnoticed. Committing the reference would break that job to
   fix this one.

---

## Cost, and why this is dispatch-only

macOS runners bill at **10x** the Linux rate, so a ~15-minute job spends
~150 minutes of quota. `ios-build.yml` documents the same arithmetic as its
reason for staying off the PR path. A release workflow runs a few times per
release, which is the same trade this repo already takes for
`gen-icons.mjs` and the screenshot harness.

The second reason is that the upload is outward-facing. A build that
reaches App Store Connect is visible to TestFlight testers and cannot be
withdrawn, only superseded by a higher build number.

---

## Why the archive is ad-hoc signed

Both of the settings you would reach for first fail, in opposite
directions, and the two runs that prove it are worth keeping.

**`CODE_SIGN_STYLE=Automatic` (run 3)** asks Apple for a **development**
profile, and a team with no registered devices cannot have one:

```
GatherProvisioningInputs
error: Communication with Apple failed: Your team has no devices from which
to generate a provisioning profile.
error: No profiles for 'com.cosaxo.insight' were found: Xcode couldn't find
any iOS App Development provisioning profiles.
```

Automatic signing provisions development at archive time and re-signs for
distribution at export. Registering a device would satisfy it, but that
needs a UDID, which needs the Mac this workflow exists to remove.

This was briefly read as a *fallback* caused by the API key's role, since
run 4 had just shown that an App Manager key cannot create a distribution
certificate. **The log refutes it.** There is no failed distribution
attempt anywhere in run 3 — no `No signing certificate "iOS Distribution"
found`, which is exactly what run 4's export logs when the role is the
problem. Xcode went straight to development. The role and the profile type
are independent, and an Admin key does not move this.

**`CODE_SIGNING_ALLOWED=NO` (run 5)** avoids the profile and loses the
entitlements with it. Xcode applies `CODE_SIGN_ENTITLEMENTS` at **signing**
time, so an unsigned archive carries none and `exportArchive` has nothing
to forward:

```
aps-environment is 'empty', must be 'production'
```

The export succeeded and the `.ipa` existed. It simply would never have
received a push, and nothing in the build would have said so — which is why
that gate exists, and the one time it has fired it was on this repo's own
workflow rather than on a mistake from outside.

**Ad-hoc has neither problem.** `codesign -s -` embeds
`CODE_SIGN_ENTITLEMENTS`, so `APS_ENVIRONMENT` expands to `production` from
the App target's Release config and lands in the signature, while needing no
certificate, no profile and no device. The signature is throwaway:
`exportArchive` re-signs for distribution with the Admin key's cloud
signing and keeps the entitlements it reads there.

`AD_HOC_CODE_SIGNING_ALLOWED` defaults to `NO` for iOS and has to be turned
on explicitly — that one setting is the difference between this working and
reading like run 5 again.

**If the archive fails with entitlements missing**, ad-hoc is not embedding
them and the fallback is a real distribution identity, which the Admin key
can mint without a Mac: generate a key and CSR with `openssl` on the
runner, `POST /v1/certificates` and `POST /v1/profiles` (`IOS_APP_STORE`)
against the App Store Connect API, import into a temporary keychain, archive
with `CODE_SIGN_STYLE=Manual` and an explicit
`PROVISIONING_PROFILE_SPECIFIER`, then `DELETE /v1/certificates/{id}` in an
`always()` step so the account's certificate slots do not accumulate.

---

## What is proven — all of it, as of run 7

It was written without an Apple account or a macOS runner to test against.
**Run 7 closed the last gap** (`1b988c9`, 2026-08-07, 6m 41s, `upload =
true`): every step in this workflow has now done its job against the real
Apple, including the one that sends a binary.

| Step | State |
| --- | --- |
| Build, `check:web-firebase`, `cap sync` | proven (run 1 caught the missing `VITE_FIREBASE_*` — a signed demo app) |
| Plist write, `plutil -lint`, Ruby link step | proven |
| ASC key auth, Swift package resolution | proven |
| Archive, ad-hoc | proven (run 6) — `Signing Identity: "Sign to Run Locally"`, then `archive aps-environment = production` |
| Export via cloud signing | proven (run 5), with an **Admin** key |
| `aps-environment` gate | proven at both ends — it refused run 5's `.ipa` and passed run 6's |
| **Upload to App Store Connect** | **proven (run 7)** — `UPLOAD SUCCEEDED with no errors`, delivery UUID `470b566a-8f2f-4664-a29e-df862d5761c7`, 5,876,676 bytes |

The one thing worth reading twice: the archive's entitlement came out
`production` under a throwaway ad-hoc signature, and survived being
re-signed for distribution. That is the mechanism this whole section is
about, and it is measured rather than argued.

**Seven dispatches, six of them failures, and none of the failures
repeated** — each bought one fact: a missing `VITE_FIREBASE_*`, a manual
identity conflicting with automatic signing, automatic signing demanding a
device the team does not have, an App-Manager key that cannot mint a
distribution certificate, an unsigned archive with no entitlements to
forward, and finally none. That is the shape to expect from anyone
repeating this, and the reason each error is quoted verbatim above rather
than summarised.

Failures still worth recognising on sight:

| Symptom | Cause |
| --- | --- |
| Archive fails, entitlements missing | Ad-hoc did not embed them; see the fallback above |
| `Cloud signing permission error` at export | The API key is App Manager, not Admin — § 1 |
| `No profiles for 'com.cosaxo.insight'` at export | The bundle ID has no App Store Connect app record yet — create it first |
| Export fails on `method` | An older Xcode image; change `app-store-connect` to `app-store` in the ExportOptions plist |
| Upload rejected for build number | `appBuild` was not bumped |
| `ITMS-90683` emailed *after* a successful delivery | A purpose string is missing for an API some linked package references, whether or not this app calls it. Fix the plist, not the caller — `npm run check:ios-location` and D107. The delivered build stands; the fix rides the next one |

**The bump has a trap in the other direction too, and it has fired.** This
file and the runbook both bump `appBuild` immediately *after* an upload, so
that a forgotten bump can never cost a run. Read alone, "bump before every
release" then bumps a number that was already fresh: on 2026-08-08 `appBuild`
went 2 → 3 while 1 was still the highest build on App Store Connect, so build
2 will never exist. Harmless — Apple only wants monotonic — but the check is
a **comparison, not a habit**: is `appBuild` already greater than the highest
build in App Store Connect? If yes, run as-is.

**Both directions have now fired, and the original one is the expensive
one.** On 2026-08-13 run 18 uploaded build 12 and the post-upload bump was
skipped, so `appBuild` sat at 12 with 12 already delivered. Nothing in the
tree could see it: every gate passes at a stale build number, and the
refusal would have come *after* the transfer — a full macOS run, at 10x,
for a number. The over-eager bump costs an unused integer; the forgotten
one costs ~150 minutes of quota.

**The forgotten bump has now happened twice in a row** — run 19
(`0e65741`, 2026-08-13, upload step `success`) delivered build 13 and the
bump was skipped again, caught the next day by build 14's pre-flight
(D143). Twice is the format failing rather than a person forgetting: the
release commit lands, *then* the run is dispatched from it, so the tree is
always one event behind the fact it is asserting. **The post-upload bump is
still the right habit — it is just not a guarantee**, and the only thing
that is, is reading the run list before dispatching.

**Run 20 (`8cf48a1`, 2026-08-14, upload step `success`) delivered build 14,
and `appBuild` went to 15 in the same session, off that step's
conclusion.** That is the habit working for the first time in three
releases, and it is worth naming what made the difference: the bump was
done while the run's own step list was on screen, rather than deferred to
whoever opened the repo next. The gap the last two fell into is the one
between "the upload finished" and "someone came back to the tree".

**And the pre-flight after it found nothing to do, which is what the habit
working looks like downstream** (D153, 2026-08-14). The comparison was made
against run 20's step list — `success`, `appBuild` 14 at `8cf48a1` — and
the tree was already at 15, so the answer was *run as-is* and no number
moved. Three pre-flights running had opened on a spent build; this is the
first that did not, and the only thing that changed between them is where
the bump happened.

**Run 21 (`3c03752`, 2026-08-14, upload step `success`) delivered build
15, and `appBuild` went to 16 off that step's conclusion.** Two releases
running where the bump happened while the run's own step list was on
screen, which is the only thing that has ever made it stick. Run 21 also
ran D144's `check:bundle` on the release path for the first time on a
dispatch that shipped: 2255 KB total against 2265, 969 eager against 978.

**Run 22 (`67af354`, 2026-08-15, upload step `success`, 1m 23s of
transfer) delivered build 16, and `appBuild` went to 17 off that step's
conclusion.** Third release running where the bump landed while the run's
own step list was on screen.

**Run 22 also found the one thing the comparison still had loose: which
commit it is made at** (D159). A dispatch runs against the branch *as it
is when the dispatch is accepted*, not against the commit you merged — and
since D145 gave four question lanes and the daily pulse their own
Routines, `main` gains commits on a schedule with no human in the loop.
The release prep merged as `6a98697`; run 22 archived `67af354`, a pulse
trail row pushed in between. `appBuild` was 16 at both, so this cost
nothing, but the general case does not: **read `appBuild` at the run's own
`head_sha`.** Every record below names a run and a sha, which invites
reading that sha as the release commit; run 22's is a Routine's.

**Runs 23 and 24 delivered build 17 as a dry run and an upload, and the
bump after them was skipped** (D180, caught 2026-08-16). Both archived
`9a5f803` eight minutes apart — run 23's upload step `skipped`, run 24's
`success` (18:37:44Z → 18:39:39Z, 1m 55s of transfer). That is the second
pair shaped like runs 15 and 16, and the reason this file says to read the
STEP's conclusion rather than the run's: both runs are `success` at the
job level and only one of them spent a number.

**The skip after run 24 refutes the explanation the last three releases
had earned.** D143 named the gap as the one between "the upload finished"
and "someone came back to the tree", and runs 20–22 each closed it by
bumping while the step list was on screen. Here somebody came back
*specifically to record the upload* — commit `5798623`, the next day,
citing the run id and writing sixteen lines into the runbook — and left
`appBuild` at 17. **The record and the number are two different edits**,
and a session can discharge the first while the second, which is the one
that costs ~150 minutes of macOS quota, sits untouched. Three skips now
(runs 18, 19, 24) against three that held.

**Runs 25 and 26 delivered build 18 as a dry run and an upload, and this
time neither edit happened** (D184, caught 2026-08-16). Both archived
`810b3af` seven minutes apart — run 25 (`31954391079`, 15:01:04Z) upload
step `skipped`, run 26 (`31954752095`, 15:08:19Z) `success` (15:13:07Z →
15:14:46Z, 1m 39s of transfer). Third pair of this shape after 15/16 and
23/24.

**The fourth skip breaks the explanation the third one earned.** D180
diagnosed the failure as the record and the number being two separate
edits, only one of which has a habit — and proposed a gate keyed on the
record: *if the runbook claims build N was uploaded, `appBuild` must
exceed N*. Here **no record was written at all** — nothing in `docs/`
mentions run 25, run 26, either run id, or build 18 being delivered — so
that gate would have stayed silent. The tree was returned to twice after
the upload (#201 at 15:51Z, #202 at 16:48Z) by sessions doing feature
work, which had no reason to think about a build number. Four skips now
(runs 18, 19, 24, 26) against three that held. **The sound invariant keys
on the run list, which nothing in this tree can read** — so this stays a
procedure, and the procedure is the next line.

**Runs 27 and 28 delivered build 19, and the bump landed off step 17's
conclusion** (D186, 2026-08-16). Both archived `e76731d` six minutes
apart — run 27 (`31963630320`, 18:07:00Z) upload step `skipped`, run 28
(`31963956792`, 18:13:34Z) `success` (18:17:39Z → 18:18:55Z, 1m 16s of
transfer). Fourth pair of this shape.

**This is the first release where the dry run, the upload, the bump and
the record all happened in one session**, which is the only arrangement
that has ever made the bump stick — and the point is not the diligence
but the ordering: the bump was made *from* step 17's conclusion, not from
a memory of it. Four that held (20, 21, 22, 28) against four skipped (18,
19, 24, 26).

**Build 20's pre-flight found nothing to do, and turned up a gap in a
gate instead** (D191, 2026-08-17). Run 28 was still the highest run, its
step 17 still `success`, and `appBuild` at `e76731d` still 19 against a
tree at 20 — so *run as-is*, and no number moved. Third pre-flight to come
out that way, and the correspondence is now four for four in both
directions: every bump that held was made off the step list while it was
on screen, every skip was a session that came back later or not at all.

What it did find is that `check:bundle` documented two load-bearing
variables and guarded one. Building the release bundle without
`VITE_SENTRY_DSN` drops the 445 KB Sentry group as dead code, and the gate
reported `SHIPPING bundle (VITE_V2_LIVE=true), 1877 KB total` — 454 KB
light, against a total ceiling with 3 KB of headroom. The script now
withholds the total ceiling when the DSN is absent rather than passing it,
and names both halves of the artifact in its verdict; it does not fail,
because a Sentry-less release is a supported build and this workflow
passes the secret straight through as optional.

**Runs 32 and 33 delivered build 21, and the bump landed off step 17's
conclusion** (D199, 2026-08-19). Both archived `d547f7a` seven and a half
minutes apart — run 32 (`32228796376`, 07:38:55Z) step 17 `skipped`, the
dry run, 5m 18s; run 33 (`32229389551`, 07:46:29Z) `success`, 07:52:10Z →
07:54:11Z, 2m 01s of transfer. `UPLOAD SUCCEEDED with no errors`, delivery
UUID `f1ab4ae5-0673-4a89-a4f3-c3ab03c6e87d`, 6,037,139 bytes. Fifth pair of
this shape after 15/16, 23/24, 25/26 and 27/28.

`appBuild` went 21 → 22 in the same session, read off step 17 rather than
recalled. Five that held (20, 21, 22, 28, 33) against five skipped (18, 19,
24, 26, 31) — and this is the first release run under D198's reading, which
is narrower than "remember to bump": the bump is not a follow-up task, it is
the reading of step 17.

**D159's trap fired again and the rule caught it.** `5c9c4a5` merged; both
runs archived `d547f7a`, a pulse trail row pushed in the ~40 seconds
between. `appBuild` was 21 at both, so it cost nothing — the same outcome as
run 22 — but it is the second worked example of why the comparison is made
at the run's own `head_sha` and not at the commit you merged.


**Runs 29, 30 and 31 delivered build 20, and the bump was skipped — by the
pre-flight session itself** (D198, caught 2026-08-19). All three archived
`f8c8465`, which is D191's own commit: run 29 (`32019625202`, 10:19:31Z)
cancelled at Resolve Swift packages, run 30 (`32019849917`, 10:22:28Z)
step 17 `skipped` — the dry run — and run 31 (`32020442257`, 10:30:02Z)
`success`, 10:34:21Z → 10:35:38Z, 1m 17s of transfer. Fifth skip (runs 18,
19, 24, 26, 31) against four that held.

**This one refutes the correspondence D191 had just claimed.** That entry
closed four for four: every skip a session that came back later or not at
all, every bump that held made off the step list while it was on screen.
`f8c8465` landed at 10:19:05Z and run 29 was dispatched **26 seconds
later** — one session, holding the run list, cancelling one of its own
three dispatches. It made the comparison *first*, got *run as-is*, and
then spent the number that answer was about. **A pre-flight verdict has a
shelf life of exactly one dispatch**, so "no number moved" is a report
about a comparison and never a statement about the tree — the same claim
this file struck for build 12, in the past tense. As in D184, no record
was written either: nothing in `docs/` named any of the three runs or
build 20's delivery until build 21's pre-flight read the run list.


**Runs 34–36 delivered build 22 and the bump held; runs 37 and 38
delivered build 23 and it did not** (D229, caught 2026-08-22). Both
releases went out on 2026-08-20, and **neither was recorded** until this
pre-flight read the run list — the D184 shape again, twice over.

Build 22: run 34 (`32343292688`, 07:17:04Z) cancelled, run 35
(`32343608284`, 07:21:11Z) step 17 `skipped` — the dry run — and run 36
(`32344235798`, 07:29:16Z) `success`, 07:34:31Z → 07:36:04Z, 1m 33s of
transfer. `UPLOAD SUCCEEDED with no errors`, delivery UUID
`9da8aa74-295d-4c29-884f-c2d1f73e2187`, 6,067,024 bytes. All three
archived `8a51773`, a pulse trail row. `appBuild` went 22 → 23 that
evening in `1c13fb6` (#246) — the sixth bump to hold.

Build 23: run 37 (`32407729599`, 19:15:59Z) step 17 `skipped` — the dry
run — and run 38 (`32409230777`, 19:32:37Z) `success`, 19:37:30Z →
19:38:52Z, 1m 22s of transfer. `UPLOAD SUCCEEDED with no errors`,
delivery UUID `52d5a479-a4dd-4976-8f97-da9e381fad53`, 6,059,740 bytes.
Sixth pair of this shape after 15/16, 23/24, 25/26, 27/28 and 32/33 — and
the bump after it was skipped. Six that held (20, 21, 22, 28, 33, 36)
against six skipped (18, 19, 24, 26, 31, 38).

**Two releases sixteen hours apart on one working day, and the habit held
for the first and not the second.** Nothing separates them except that
build 22's number was read off step 17 and build 23's was not, which is
D198's reading at its sharpest: the bump is not a follow-up task, it is
the reading of step 17. Both uploads printed the workflow's own `Bump
appBuild in package.json before the next run` line at step 18, so the
reminder is not the missing part — it was on screen both times.

**Build 23's two runs archived different commits, which is D159's trap
firing on something that is not a pulse row.** Run 37 archived `1c13fb6`,
run 38 archived `fe6a8e2`: D219 landed in the sixteen minutes between
them, and what D219 moves is `ios-release.yml`'s `VITE_REQUIRE_SIGNIN`
default, `'true'` → `'false'`. With `vars.REQUIRE_SIGNIN` unset — which
is what D219 and 5.6's neighbour at 4.8 both assert — the dry run
therefore archived a **walled** app and the upload shipped a **wall-less**
one. `appBuild` was 23 at both, so the comparison this file is about cost
nothing: the third worked example after runs 22 and 32/33, and the first
where the commit in the gap is a feature rather than a Routine's trail
row.

**What it did cost is narrower than it reads, and worth stating exactly.**
The diff between the two commits touches the build step's env and nothing
after it — the plist write, the Ruby link step, the ad-hoc archive, the
cloud-signed export and both entitlement gates are identical, so
everything the dry run exists to prove was proven on the inputs the
upload used. What went unrehearsed is the bundle: build 23 is the first
wall-less build, and no dry run has ever archived that bundle. **A dry
run derisks the signing, not the build** — and the two are the same run
only when both dispatches name one commit.


**Runs 39 and 40 delivered build 24, and the bump was skipped by the
session that had just made one** (D273, caught 2026-08-24). Both archived
`1ade973` thirteen minutes apart — run 39 (`32573914036`, 12:46:43Z) step
17 `skipped`, the dry run, 7m 21s; run 40 (`32574502233`, 12:59:43Z)
`success`, 13:04:06Z → 13:05:33Z, 1m 27s of transfer. `UPLOAD SUCCEEDED
with no errors`, delivery UUID `007fd1db-b647-4d7a-8133-6d3cc31b6094`,
5,994,956 bytes. Seventh pair of this shape after 15/16, 23/24, 25/26,
27/28, 32/33 and 37/38. Six that held (20, 21, 22, 28, 33, 36) against
seven skipped (18, 19, 24, 26, 31, 38, 40).

**`1ade973` is D229's own commit — the one that bumped 23 → 24 because
build 23's upload was owed it — and run 39 was dispatched 68 seconds
after it landed.** So the session that made the bump is the session that
spent it. This is D198's shape with the last excuse removed: there was no
gap between "the upload finished" and "someone came back to the tree",
because the tree had been edited a minute earlier by the same hands. What
D198 read as a verdict's shelf life is better stated about the number
itself — **a bump has a shelf life of exactly one upload.** A session that
bumps to N and then uploads N has discharged one debt and incurred an
identical one in the same sitting, and nothing on screen distinguishes
the two: `package.json` reads 24 both before the dispatch and after it,
and step 18 printed its reminder into a session that had already done a
bump that day.

Both runs archived one commit, so D159's trap did not fire — the first
release since run 21 where the dry run and the upload name the same
tree, and the one place this release was clean.

**No record was written either, which is the D184 shape for the third
time** — nothing in `docs/` named run 39, run 40, or build 24's delivery
until this pre-flight read the run list. The tree was returned to for two
days and 27 commits, none of which had any reason to think about a build
number.


**Runs 41 and 42 delivered build 25, and the bump landed off step 17's
conclusion** (D274, 2026-08-24). Run 41 (`32715780408`, 10:14:34Z)
archived `fcc51d4` with step 17 `skipped` — the dry run, 4m 55s; run 42
(`32716503010`, 10:23:03Z) archived `01d5570`, step 17 `success`,
10:28:28Z → 10:29:42Z, 1m 14s of transfer. `UPLOAD SUCCEEDED with no
errors`, delivery UUID `857d1e15-7b99-40b8-a457-7b0095d8a29e`,
6,039,930 bytes. Eighth pair of this shape. Seven that held (20, 21, 22,
28, 33, 36, 42) against seven skipped (18, 19, 24, 26, 31, 38, 40).

**The bump was made in the same session, from step 17's step list rather
than from a memory of it** — the arrangement D186 named and the only one
that has ever made it stick. D273 had just been written *about* this
release's predecessor skipping it.

**D159's trap fired, and this is the fourth worked example.** The dry run
archived `fcc51d4` and the upload archived `01d5570`: two commits landed
in the eight and a half minutes between the dispatches — `c304647`, a
content batch of six feed questions (#278), and a pulse trail row. So the
gap held a **content** change this time, between run 22's pulse row and
build 23's feature. `appBuild` was 25 at both, so the comparison this
file is about cost nothing.

**What the gap cost is again the bundle, and again not the signing.** The
diff is content plus a JSONL row; every step from the plist write through
the ad-hoc archive, the cloud-signed export and both entitlement gates is
identical, so what run 41 proved was proved on the inputs run 42 used.
Six more feed questions than the dry run archived did reach the binary —
but unlike build 23, nothing about that shipped unguarded: `check:bundle`
and `check:web-firebase` run on the release path *before* `cap sync`, so
run 42 measured its own bundle against the ceiling before it archived
anything, and a break would have failed the job with no number spent.
**A dry run derisks the signing; the gates on the release path derisk the
bundle** — which is the half D229 could not say, because it was reading a
run where the unrehearsed change was behavioural rather than content.

**Build 26's pre-flight found nothing to do, and found a surface no gate
on this path reads** (D324, 2026-08-27). Run 42 was still the highest run
— nothing dispatched for three days — its step 17 still `success`, and
`appBuild` at run 42's own `head_sha` `01d5570` still 25 against a tree at
26. So *run as-is*, and no number moved. Fourth pre-flight to come out
that way after D153, D158 and D191, and it is build 25's bump (D274, read
off step 17 while the step list was on screen) that made it come out that
way.

**What it found instead is that the app icon is in neither half of the
pair the last two releases settled.** D229 and D274 read: *a dry run
derisks the signing; the gates on the release path derisk the bundle.*
Both of those gates read `dist/` — `check:web-firebase` asks whether the
JavaScript saw the config, `check:bundle` weighs the JavaScript `cap sync`
is about to copy into the shell. `AppIcon-512@2x.png` reaches the binary
from `ios/App/App/Assets.xcassets/` instead, which `cap sync` does not
write and neither gate reads; `scripts/gen-icons.mjs` is the only thing
that writes it, and it has no `package.json` entry and no workflow.
Build 26 is the first build to carry the iris (D302), and it carries it
because somebody ran that script by hand — verified for this build
(`f819cc6` touched the file, tree clean at `ac9072f`) and unanswerable in
general. D324 has why it is recorded rather than closed: the honest gate
re-renders and compares, PNG rasterisation is not byte-reproducible across
Chromium versions, and a flaky red on this path costs ~150 minutes of
macOS quota.

193 commits rode in that gap — the widest between two builds so far,
against two days for 24 → 25 and sixteen hours for 22 → 23.

**Runs 43 and 44 then delivered build 26, and the bump landed off step
17's conclusion** (D324, 2026-08-27). Run 43 (`33070525476`, 12:08:58Z)
step 17 `skipped` — the dry run, 6m 12s; run 44 (`33071251527`,
12:18:34Z) `success`, 12:25:22Z → 12:27:13Z, 1m 51s of transfer.
`UPLOAD SUCCEEDED with no errors`, delivery UUID
`b1562663-98fe-4166-8aae-863bbcc5241d`, 6,128,733 bytes. Ninth pair of
this shape. `appBuild` went 26 → 27 read off step 17 rather than
recalled — **eight that held** (20, 21, 22, 28, 33, 36, 42, 44) against
seven skipped (18, 19, 24, 26, 31, 38, 40).

**D159's trap did not fire, and this time that was arranged rather than
lucky.** Both runs archived `ac9072f`: `main` was read between the
dispatches and had not moved, and the pre-flight record was deliberately
left unmerged on its own branch so that merging it could not become the
commit in the gap. That is the second release since run 21 where the dry
run and the upload name one tree, and the first where the gap was closed
on purpose — so what run 43 proved was proved on exactly the bundle run
44 shipped, which is what D229 could not say about build 23.


**Runs 45 and 46 delivered build 27, and the bump was skipped** (D339,
caught 2026-08-31). Both archived `b78cd9c` nine minutes apart — run 45
(`33324889659`, 17:18:30Z) step 17 `skipped`, the dry run, 6m 08s; run 46
(`33325304169`, 17:27:23Z) `success`, 17:31:54Z → 17:33:17Z, 1m 23s of
transfer. `UPLOAD SUCCEEDED with no errors`, delivery UUID
`16213c73-cb2e-4b3f-804e-7ad281523986`, 6,131,570 bytes. Tenth pair of
this shape. Eight that held (20, 21, 22, 28, 33, 36, 42, 44) against
**eight skipped** (18, 19, 24, 26, 31, 38, 40, 46) — the first time the
two counts have been level.

**No record was written either, which is the D184 shape for the fourth
time** after runs 25/26, 29–31 (D198) and 39/40 (D273): nothing in
`docs/` named run 45, run 46, or build 27's delivery until this
pre-flight read the run list. The tree was returned to for a day and 40
commits — D337, and the 2026-08-31 night audit's 35 (D338) — none of
which had any reason to think about a build number.

**The one line that looks like it should have caught this is not wrong,
and that is the finding.** LAUNCH-RUNBOOK 5.6 read *"holds at 2.0.0
build 27"* and was **correct**: `check:figures` holds that sentence to
`package.json`, and `package.json` did say 27. A figure gate proves the
tree agrees with itself. It cannot prove the tree agrees with Apple, and
D184 already established that the sound invariant keys on the run list,
which nothing in this tree can read. So the gate that fired during this
release prep fired *because* the number moved — it is downstream of the
bump, never upstream of it.

**D159's trap did not fire.** Both runs archived `b78cd9c` — the third
release since run 21 where the dry run and the upload name one tree,
after 39/40 and 43/44. `b78cd9c` is itself a pulse trail row rather than
any release commit, which is run 22's shape exactly: the dispatch ran
against the branch as it stood, and reading `appBuild` at the run's own
`head_sha` is what makes the comparison answerable.

130 commits rode in the 26 → 27 gap, over three days — the second widest
after build 26's 193.

**Build 28's pre-flight found the debt rather than a clean tree** (D339,
2026-08-31). Run 46 is the highest run in `ios-release.yml`'s list, its
step 17 `success`, and `appBuild` at run 46's own `head_sha` `b78cd9c`
is **27** — against a tree at `ed9ecf9` reading **27**. 27 is not greater
than 27, so the answer is **bump**, and `appBuild` went 27 → 28 with
`check:versions --fix` before anything was dispatched.

That is the fifth pre-flight to open on a spent build (builds 12, 13, 14,
and now 28 — D143's shape), against four that found nothing to do (D153,
D158, D191, D324). **The comparison is the only thing that catches it**,
and the cost of skipping it is not a red build: App Store Connect refuses
a reused number *after* the transfer completes, so every gate in this
repo passes, the archive signs, the upload runs, and ~150 minutes of
macOS quota is spent on a rejection.

**Runs 47 and 48 then delivered build 28, and the bump landed off step
17's conclusion** (D339 amendment, 2026-08-31). Run 47 (`33424574013`,
18:21:42Z) step 17 `skipped` — the dry run, 5m 51s; run 48
(`33425156532`, 18:27:58Z) `success`, 18:33:57Z → 18:35:41Z, 1m 44s of
transfer. `UPLOAD SUCCEEDED with no errors`, delivery UUID
`0b481684-32d0-46d5-b0cb-bb0488dd3741`, 6,131,775 bytes. Eleventh pair of
this shape. `appBuild` went 28 → 29 read off step 17 rather than recalled
— **nine that held** (20, 21, 22, 28, 33, 36, 42, 44, 48) against eight
skipped (18, 19, 24, 26, 31, 38, 40, 46).

**D159's trap did not fire, and the gap was closed on purpose for the
second time** after runs 43/44. Both runs archived `8abb8e5`, and `main`
was re-read between the dispatches and confirmed unmoved before the
upload was sent. So what run 47 proved was proved on exactly the bundle
run 48 shipped — the signing *and* the bundle, which is the pair D229 and
D274 could only state by halves.

**What is new here is which commit that one tree is.** Runs 43/44 closed
the gap by leaving the release record unmerged, so the archived commit
was `ac9072f`, a pulse trail row. This time the archived commit is
`8abb8e5` — the merge of the release prep itself, carrying the bump that
made the build number legal. The dry run and the upload therefore name
the release commit rather than whatever the Routines happened to push
last, which is the first time that has been true since run 21.

42 commits rode in the 27 → 28 gap, over one day.

**Build 29's pre-flight found nothing to do, and turned the app icon's
provenance from a worry into a fact** (D352, 2026-09-02). Run 48 is still
the highest run in this workflow's list — nothing dispatched for two days
— its step 17 still `success`, and `appBuild` at run 48's own `head_sha`
`8abb8e5` is still **28**, against a tree at `ec2fd15` reading **29**. So
*run as-is*, and no number moved. Fifth pre-flight to come out that way
after D153, D158, D191 and D324, and it is build 28's bump — read off step
17 while the step list was on screen — that made it come out that way.

What it found instead closes half of what D324 left open. D324 recorded
that `AppIcon-512@2x.png` reaches the binary from
`ios/App/App/Assets.xcassets/`, which `cap sync` does not write and which
neither release-path gate reads (both read `dist/`), and called the
question *"verified for this build and unanswerable in general"*. For
build 29 it is answerable **from git rather than from a rasteriser**: D340
moved the icon to the paper tile in one commit, `29b0e67`, which changed
`design/icon/mark.svg` and every rasterisation of it together, and nothing
has touched the SVG since. Build 29 is therefore the first build carrying
the paper tile — build 28 shipped D302's ink tile — and the shipped file
measures 1024×1024, PNG colour type 2, chunks `IHDR IDAT IEND`, **no
alpha channel**, which is the property the marketing icon is rejected for
lacking.

**The general gate is cheaper than the one D324 refused.** That record
ruled out *re-render and compare* because PNG rasterisation is not
byte-reproducible across Chromium versions and a flaky red here costs
~150 minutes of macOS quota. But the question is not whether the bytes
match a fresh render — it is whether the SOURCE has moved since the
outputs did, which history answers with no rasteriser and no flake: if the
newest commit touching `design/icon/mark.svg` is not an ancestor of the
newest commit touching the generated icons, the icons are stale. D352 has
it recorded and deliberately not built.

151 commits rode in the 28 → 29 gap, over two days — the second widest
after build 26's 193, ahead of build 27's 130 and build 28's 42.

**Build 16's pre-flight found nothing to do either, which is the first
time that has happened twice running** (D158, 2026-08-15). Run 21 was
still the highest run in the list, its upload step still `success`,
`appBuild` at `3c03752` still 15, and the tree at 16 — so *run as-is*, and
no number moved. Two pre-flights and two releases where the bump landed
while the run's step list was on screen: the habit has now held long
enough to be a pattern rather than a good day.

**So make the comparison against the runs, not against the docs.** The
`Upload to App Store Connect` step's own conclusion is the record —
`success` spent that build, `skipped` did not — and runs 15 and 16 (same
commit, eight minutes apart, `skipped` then `success`) are the worked
example. The runbook's prose said build 12 was "unspent" while it was
being uploaded, because the sentence shipped in the very commit the run
archived. A doc cannot see App Store Connect; the run list is the closest
thing that can.

**That sentence was then written again, about build 13, in the commit run
19 uploaded** — by the same pre-flight that had just diagnosed it. Three
releases, three identical false status lines, which is why the runbook now
strikes its line rather than restating it: the claim is not fixable by
wording, only by not storing it. Ask the run list.

Each is one line in the workflow. What no line fixes is the archive's
signing style, which is why the reasoning for it is written out above
rather than compressed into this table.
