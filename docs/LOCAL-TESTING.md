# Local testing with the Firebase Emulator Suite

How to run the full app — UI plus a live (local) Auth + Firestore + Cloud
Functions backend — on your own machine, with no real Firebase project and
no cost. This is the recommended day-to-day testing workflow.

## What this setup covers

Works:

- The full web UI (every tab, every overlay, the iOS device frame, design).
- The real sign-in screen (the Auth emulator stands in for Google — pick
  any email).
- Live Firestore reads and writes from the app via `onSnapshot`.
- Cloud Functions: `rebuildAreaAggregates`, `rebuildWorldAggregates`,
  `rebuildCityAggregates`, `sendInboundImpression`, `deleteAccount`,
  `seedTaxonomies`. (Scheduled variants are skipped because the Pub/Sub
  emulator is not started — you can trigger the `rebuild*` HTTP versions
  manually from the Emulator UI for the same effect.)
- Multi-user social features: open a second account in an incognito
  window to test circles, friend grants, and inbound impressions.
- The Firestore security-rules unit tests (`npm run test:rules`).

Does **not** work in this setup (intentional):

- The on-device LLM (Gemma 3n E2B). `useLLM` is gated to
  `Capacitor.isNativePlatform()`, so the AI features are hidden on web —
  the daily report's verdict line, body insights, and life age-facts fall
  back to non-AI output. The AI requires a native build.
- Native Google Sign-In via `@capacitor-firebase/authentication` (web
  uses the popup, which the emulator stands in for).
- Native plugins (camera, splash screen, status bar, keyboard) — web
  fallbacks apply.

## How it's wired

The Firebase SDK init in `src/lib/firebaseImpl.ts` checks
`import.meta.env.VITE_USE_EMULATOR === "true"`. When set, it points Auth,
Firestore, Functions, and Storage at the local emulators (127.0.0.1) and
skips App Check (the emulator does not enforce it). When unset
(production builds), nothing changes.

Emulator ports are declared in `firebase.json` under `emulators` (auth
9099, functions 5001, firestore 8080, storage 9199, UI 4000).

A committed preset, `.env.emulator`, holds the four required
`VITE_FIREBASE_*` placeholders plus `VITE_USE_EMULATOR=true`. The
emulator does not validate the placeholder values; only the project id
should match the emulator's project id.

## One-time prerequisites

Install on your machine (skip what you already have):

1. **Node.js** LTS — <https://nodejs.org>
2. **Java JDK 11+** (the Firestore + Auth emulators need it) — Adoptium
   Temurin: <https://adoptium.net>. On Windows, run the MSI installer and
   make sure **Modify PATH** and **Set or override JAVA_HOME** are both
   enabled on the Custom Setup screen.
3. **Firebase CLI** — `npm install -g firebase-tools`
4. **Git** — <https://git-scm.com> (Windows) or your OS's package manager.

> Windows PowerShell only: if `npm` is blocked by the execution policy
> (`File ... .ps1 cannot be loaded because running scripts is disabled`),
> run once: `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`.

## One-time project setup

```bash
git clone https://github.com/Cosaxo/InSight.git
cd InSight
cp .env.emulator .env           # Windows PowerShell: cp works too
npm install
npm --prefix functions install
npm --prefix functions run build
```

## Each session — two commands, two terminals

**Terminal 1 — start the backend.** Leave it running for the whole
session.

```bash
firebase emulators:start --project prvfire33
```

Wait for the box that says `All emulators ready!`. The Emulator UI is
then at <http://127.0.0.1:4000/>.

The `--project prvfire33` flag is required because `.firebaserc` is not
in the repo on a fresh clone — it names a local namespace for the data
and matches `VITE_FIREBASE_PROJECT_ID` in `.env.emulator`. The yellow
"not currently authenticated" and "Unable to look up project number"
warnings are expected for an emulator-only run; they do not affect the
flows above.

**Terminal 2 — start the app.**

```bash
cd InSight     # if you opened a fresh terminal
npm run dev
```

Open <http://localhost:5173>. At the sign-in screen click **Sign in with
Google** — the Auth emulator's fake account page opens. Click **Add new
account**, type any email, and you are in.

To stop everything, press `Ctrl+C` in each terminal.

## Data persistence (optional)

By default the emulator wipes all data on shutdown — every session is a
clean slate. To keep data across sessions, swap Terminal 1's command for:

```bash
firebase emulators:start --project prvfire33 \
  --import=./emulator-data --export-on-exit
```

On the first run, the folder is created empty (that is fine). On
`Ctrl+C`, the emulator writes the current state to `./emulator-data/`,
and the next start re-imports it.

## After pulling new code

```bash
git pull origin main
npm install
npm --prefix functions install
npm --prefix functions run build
```

Then run the two terminals as usual. Skip the install/build commands if
`git pull` reports no relevant changes.

## Useful endpoints

- App: <http://localhost:5173>
- Emulator UI: <http://127.0.0.1:4000>
  - `/auth` — inspect / create users
  - `/firestore` — browse stored documents
  - `/functions` — see function logs
  - `/storage` — uploaded files (cloud photos opt-in)
- HTTP function entry points: `http://127.0.0.1:5001/prvfire33/us-central1/<functionName>`

## Security-rules unit tests

These run against the emulator and exercise the cross-user access
carve-outs in `firestore.rules` without booting the app:

```bash
npm run test:rules
```

12 tests; should report `12 passed`.
