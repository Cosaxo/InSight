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

- **Access role: App Manager.** Not Developer. Automatic signing creates
  the distribution certificate and the provisioning profile on demand
  through this key, and a Developer-role key is not allowed to, so the
  archive fails at signing with an error that reads like a certificate
  problem rather than a permissions one.
- Download the `.p8` **immediately**. Apple serves it once and never
  again; a lost key is revoked and replaced, not recovered.
- Note the **Key ID** (10 characters) and the **Issuer ID** (a UUID shown
  above the key list — it is per-account, not per-key, and it is the one
  people miss).

## 2 · The repository values

Settings → Secrets and variables → Actions.

| Name | Kind | Value |
| --- | --- | --- |
| `ASC_KEY_ID` | Secret | the 10-character Key ID |
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

## Why the archive is unsigned

The archive step passes `CODE_SIGNING_ALLOWED=NO` and signing happens only
at export. That looks wrong and is deliberate.

Automatic signing asks for a **development** provisioning profile when it
archives, and Apple refuses to issue one to a team with no registered
devices:

```
Communication with Apple failed: Your team has no devices from which to
generate a provisioning profile.
No profiles for 'com.cosaxo.insight' were found: Xcode couldn't find any
iOS App Development provisioning profiles.
```

Registering a device is the obvious answer and is a trap here: getting an
iPhone's UDID essentially requires a Mac, which is the dependency this
whole workflow exists to remove.

A **distribution** profile has no device requirement — devices are a
development concept — and `exportArchive` is the step that mints one. So
the archive skips signing entirely and the export does it. The exported
`.ipa` is the only artifact that ships, so it is the only one that has to
be signed correctly.

**If this turns out to be wrong**, the post-export gate is what says so:
an export that fails to apply the entitlements yields an empty
`aps-environment` and fails the job. The fallback is manual signing — a
distribution certificate exported as a `.p12`, imported into a keychain on
the runner, with `CODE_SIGN_STYLE=Manual` and an explicit
`PROVISIONING_PROFILE_SPECIFIER`. That is more setup and one more secret,
which is why it is the fallback rather than the first attempt.

---

## Known risk: this has never been run

It was written without an Apple account or a macOS runner to test against,
so treat the first dispatch as the real test. The **code** is known to
compile for iOS — `ios-build.yml` builds the shell on every relevant PR —
so what is untested here is signing, export and upload, which is where iOS
CI usually fails.

Most likely first-run failures, in the order they would appear:

| Symptom | Cause |
| --- | --- |
| Archive fails at signing | The API key is Developer-role, not App Manager |
| `No profiles for 'com.cosaxo.insight'` | The bundle ID has no App Store Connect app record yet — create it first |
| `aps-environment` gate fails as `development` | The project-level `CODE_SIGN_IDENTITY` won; add `CODE_SIGN_IDENTITY="Apple Distribution"` to the archive command |
| Export fails on `method` | An older Xcode image; change `app-store-connect` to `app-store` in the ExportOptions plist |
| Upload rejected for build number | `appBuild` was not bumped |

None of these are ambiguous once seen. Each is one line in the workflow.
