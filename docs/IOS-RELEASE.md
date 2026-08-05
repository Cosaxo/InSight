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

## What is proven, and what is not

It was written without an Apple account or a macOS runner to test against.
Five dispatches have since moved most of it from written to demonstrated:

| Step | State |
| --- | --- |
| Build, `check:web-firebase`, `cap sync` | proven (run 1 caught the missing `VITE_FIREBASE_*` — a signed demo app) |
| Plist write, `plutil -lint`, Ruby link step | proven |
| ASC key auth, Swift package resolution | proven |
| Archive | proven under automatic signing (run 2), then blocked on the development profile (run 3). **Ad-hoc signing is untried.** |
| Export via cloud signing | proven (run 5), with an **Admin** key |
| `aps-environment` gate | proven — it is what refused run 5's `.ipa` |
| Upload to App Store Connect | **untried.** Every run so far has been `upload = false`. |

Failures still worth recognising on sight:

| Symptom | Cause |
| --- | --- |
| Archive fails, entitlements missing | Ad-hoc did not embed them; see the fallback above |
| `Cloud signing permission error` at export | The API key is App Manager, not Admin — § 1 |
| `No profiles for 'com.cosaxo.insight'` at export | The bundle ID has no App Store Connect app record yet — create it first |
| Export fails on `method` | An older Xcode image; change `app-store-connect` to `app-store` in the ExportOptions plist |
| Upload rejected for build number | `appBuild` was not bumped |

Each is one line in the workflow. What no line fixes is the archive's
signing style, which is why the reasoning for it is written out above
rather than compressed into this table.
