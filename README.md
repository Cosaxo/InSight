# InSight

**An interior social network.** InSight is a private journal of your own
inner life — mood, habits, body, dreams, personality, politics, values, taste —
that doubles as a lens onto the inner lives of the people, city, and world
around you. The bet: the thing humans are most curious about is themselves and
each other, and no app serves that directly and honestly.

Five tabs move from the world inward to the people next to you —
**Around / World / City / Interests / People** — wrapped in an iOS device
frame, with a fan-out menu for your own surfaces: daily report, a journal
(mood / habits / fitness / nutrition / finance), the body, the days, a
scrapbook, impressions, personality/politics/values tests, life details,
sharing controls, and a DNA viewer.

Built with **React 19 + TypeScript + Vite**, wrapped as a native **iOS +
Android** app via **Capacitor**, backed by **Firebase** (Auth + Firestore +
Cloud Functions), with an **on-device LLM** (Gemma) for private reflections.
Visuals are hand-drawn and CSS-variable-driven — Fraunces + Inter + JetBrains
Mono + Caveat on a paper-grain background, OKLCH colour tokens, per-tab accent
colours, dark mode + density toggles. Persistence is `localStorage` by default,
with optional Firebase Auth + Firestore sync.

> **⚠️ Pending end-to-end verification.** The Firebase Auth + Firestore flow,
> the Cloud Functions (aggregators, the rate-limited impression callable,
> account deletion, taxonomy seeding), and the security rules typecheck and
> build but **have not been exercised against a live Firebase project**. Before
> production: deploy `firebase deploy --only firestore:rules,functions`, then
> walk the flows — sign in, log a daily report, leave an impression on a
> friend, confirm circle-shared data reads through, run the rebuild callables
> and watch the aggregates populate, sign out and back in on another browser to
> confirm data survives.

## The idea, in one loop

The self-tracking surfaces aren't just a journal — they're the content you
*produce* so that other people's equivalent content becomes worth seeing. You
take the personality test to see how you compare; that same act lets your circle
see you. Reciprocity is the engine: the more of yourself you make legible, the
more of others you get back.

The signature mechanic is **impressions** — people in your circle can leave
anonymous, traits-only impressions of you ("careful listener", "quietly funny",
"guarded") from a curated palette. It's deliberately built to *survive* where
Sarahah / NGL / Gas imploded: real identity behind the scenes, curated traits
(not free text), mutual-add required, a recipient trait-blocklist, one-tap
block, and server-side rate limiting.

## Running locally

```bash
npm install
npm run dev
```

Open the URL Vite prints. Without a `.env` the app runs in **local-only mode** —
all data lives in `localStorage` and there's no sign-in screen.

The TweaksPanel (dark mode / density / active tab) toggles with
**Cmd/Ctrl/Shift+?**.

## Enabling Google sign-in + Firestore sync

1. `cp .env.example .env`
2. Create a Firebase project at <https://console.firebase.google.com>, add a web
   app, copy the `firebaseConfig` values into `.env` with the `VITE_FIREBASE_*`
   prefix.
3. In the console, enable **Authentication → Sign-in method → Google** and
   **Firestore Database**.
4. Deploy the rules **and functions** (several features now depend on the
   functions — see below):
   ```bash
   firebase deploy --only firestore:rules,functions
   ```

Once the required four env vars are set (`VITE_FIREBASE_API_KEY`,
`VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`)
the app shows a sign-in screen instead of going straight into the dashboard.

**Security note:** Firebase *web* API keys aren't secrets — they identify a
project but don't grant access. Real access control lives in
[`firestore.rules`](./firestore.rules), which scopes every user to
`insight_users/{their-uid}/…` and gates every cross-user read. If you fork this
repo, point `.env` at your own project so nobody else writes into yours.

## First sign-in

If the user's Firestore subtree doesn't exist yet, the app seeds it with
whatever the browser currently has — defaults or prior localStorage data. After
that, Firestore is authoritative and drives the UI via `onSnapshot`
subscriptions.

## Architecture

**Client** — React 19 + Vite, ~60 `useX` hooks, lazy-loaded overlays. The
Firebase SDK is code-split so signed-out users never download it.

**Firestore** — per-user data under `insight_users/{uid}/…` (owner-only by
default), plus opt-in cross-user reads gated by the rules.

**Cloud Functions** (`functions/src/index.ts`, admin SDK — bypasses rules):

| Function | Purpose |
|---|---|
| `rebuildAreaAggregates` / `scheduledAreaAggregates` (6h) | Per-geohash5 Big-Five / politics / morals **and media** rollups, k-anonymised. Also writes the global `aggregates_media/world` doc. |
| `rebuildWorldAggregates` / `scheduledWorldAggregates` (24h) | Userbase snapshot — personality, demographics, top interests by country + global. |
| `rebuildCityAggregates` / `scheduledCityAggregates` (24h) | Per-city rating averages **plus** per-city Big-Five + media (from each rater's profile). |
| `sendInboundImpression` (callable) | The **only** write path for impressions. Enforces the circle/accept-from gate, the recipient's trait blocklist, and a per-sender rate limit (rules can't count writes). Client direct-creates are denied. |
| `seedTaxonomies` / `scheduledTaxonomies` (24h) | Mirrors canonical reference data (interest categories, …) into the read-only `taxonomies` collection so it's editable without a redeploy. |
| `deleteAccount` (callable) | Wipes the user's subtree + every cross-user reference (sent impressions, relations pointing at them) + the auth account. Required by both app stores. |

## Sharing model

Every category of personal data has a four-level visibility dial —
**nobody / circle / city / world** — set in the Sharing overlay, with sensitive
fields (politics, dreams, weigh-ins) defaulting to private. Enforcement:

- **Daily report** — `firestore.rules` reads the owner's `sharePrefs.daily_report`
  and grants a circle member the read.
- **Subcollections** (workouts, meals, weigh-ins, moods, scrapbook, dreams,
  books, visits, homes, languages, jobs, milestones, time-use) — a mutual friend
  (a `circle/{uid}` grant) may **read** the collection when the owner's
  per-category level is circle / city / world. Writes stay owner-only;
  non-shareable collections (finance, habits, private impression sketches) are
  never exposed.
- **Big-Five / politics / morals / media** — fed into the **anonymised
  aggregates** (area / world / city) per their share level; they're not yet
  exposed as raw per-friend values.
- **Discoverable location** — opt-in; presence of an `insight_discoverable/{uid}`
  doc *is* the toggle. Location is fuzzed to geohash5 (~5 km) everywhere.

City / world tiers for raw per-user reads are not wired yet (circle tier is).

## Data model

Per-user subtree (`insight_users/{uid}` is owner-only; some children are
circle-readable per the sharing model):

```
insight_users/{uid}                          ← profile: personality (Big5),
                                                political/politicalAxes, morals,
                                                media (MediaMap), sharePrefs,
                                                likes/dislikes, bio/role, …
  /relations/{id}                             ← people you've added (UserPerson)
  /circle/{viewerUid}                         ← friend grants (read access)
  /followers/{uid}  /friendRequests/{uid}  /blocks/{uid}
  /insight_daily/today                        ← today's daily report
  /insight_moods/{date}                       ← mood 1..5 per day
  /insight_inbound_impressions/{id}           ← anonymous traits left *for* you
  /insight_cityratings/{cityName}
  /insight_habits|workouts|meals|transactions|weighins
  /insight_scrapbook|dreams|books|visits|homes|languages|jobs|milestones|time_blocks
  /insight_interests/{id}
```

Top-level collections:

```
insight_discoverable/{uid}        ← opt-in public projection: geohash5,
                                    personality, age/role/bio/country/interests
aggregates_by_geohash5/{hash5}    ← area Big5/politics/morals/media (k-anon)
aggregates_world/snapshot         ← userbase stats by country + global
aggregates_city/{slug}            ← per-city ratings + Big5 + media
aggregates_media/world            ← global media popularity
taxonomies/{key}                  ← canonical reference data (read-only)
insight_ratelimits/{senderUid}    ← impression send ledger (server-only)
Cities/{id}                       ← world cities catalogue (read-only)
insight_interest_items/{id}       ← community-voted interest items
```

User-uploaded photo blobs stay in localStorage (`insight.dailyReport.photo.v1`)
and are not synced; the stock-photo key (e.g. `fjord`) travels with the remote
doc.

## Privacy posture

- **On-device AI.** The daily reflection is generated locally by Gemma — no
  mood/journal data leaves the device.
- **Photos stay local** by default (opt-in cloud backup exists).
- **Coarse location only** — geohash5 (~5 km) is the floor everywhere; precise
  coordinates are never shared.
- **k-anonymity** on every aggregate — 20 contributors per cell for area/world,
  3 per city; below-floor cells are dropped, never published.
- **Account deletion + (roadmap) export** — `deleteAccount` wipes everything,
  including cross-user references.

The [`docs/data-inventory.md`](./docs/data-inventory.md) maps every field to the
App Store Privacy Nutrition Label and Play Data Safety categories.

## Firebase cost notes

The app is designed to keep Firestore reads cheap:

- **Firebase SDK is lazy-loaded.** Signed-out users never download it.
- **Subscriptions only attach when signed-in.** Each `useX` hook short-circuits
  in localStorage-only mode.
- **Moods are windowed.** `subscribeMoods` is `orderBy("date","desc") +
  limit(60)` rather than a full-collection scan.
- **Aggregates are one-doc reads.** The World tab reads a single snapshot doc;
  City reads one doc per city — the Cloud Functions fan out so clients don't.
- **Writes are user-driven.** No background polling, no automatic re-writes.

A typical active user lands well inside Firebase's free tier (50 k reads + 20 k
writes per day).

## Native iOS + Android (Capacitor)

The mobile experience ships as a native iOS + Android app via
[Capacitor](https://capacitorjs.com). The whole React/Vite app runs inside a
system WebView wrapped in a thin native shell — the same code we deploy to the
web. The `ios/` and `android/` directories are committed as project shells
(Xcode + Gradle); your local build state is gitignored.

Bundle ID: `com.cosaxo.insight`. App name: `InSight`.

### Build flow

```bash
npm run build:mobile     # vite build + cap sync (copies dist/ into both shells)
npm run ios              # open the Xcode project (macOS only)
npm run android          # open Android Studio
```

### What's wired

- `@capacitor/splash-screen` — paper-coloured splash hides the WebView first-paint flash.
- `@capacitor/status-bar` — overlay drawing, so `env(safe-area-inset-*)` keeps working.
- `@capacitor/keyboard` — resize the WebView when the keyboard opens.
- `@capacitor/app` — back-button handling on Android, app-state events.
- `@capacitor-firebase/authentication` — native Google Sign-In; the plugin runs
  OAuth natively and we exchange the ID token for a Firebase credential so every
  Firestore call uses the same auth instance. On web we fall back to the popup.
- `@capacitor/camera` — daily-report photo capture via the OS picker (falls back
  to `<input type="file">` on web).
- `@capgo/capacitor-llm` — on-device Gemma 4 E2B. The daily report generates a
  one-sentence reflection from the last week of moods, **on device**. First
  launch downloads the model (~2 GB int4) and caches the path; subsequent
  inferences are offline. Hidden on web. Model URL overridable via
  `VITE_LLM_MODEL_URL`.

### Native setup (required before first device build)

Two platform-specific Firebase config files are required for native Google
Sign-In (project-specific, so not committed):

- **iOS** — drop `GoogleService-Info.plist` into `ios/App/App/`, add it to the
  Xcode target, and replace the `REVERSED_CLIENT_ID` placeholder in
  `ios/App/App/Info.plist`.
- **Android** — drop `google-services.json` into `android/app/`.

Both Firebase apps must register the bundle/application ID `com.cosaxo.insight`.

### Permissions

- iOS `Info.plist`: `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`,
  `NSPhotoLibraryAddUsageDescription`.
- Android `AndroidManifest.xml`: `CAMERA`, `READ_MEDIA_IMAGES` (13+),
  `READ_EXTERNAL_STORAGE` (≤ 12). Camera hardware is `android:required="false"`.

### Planned, not yet wired

`@capacitor/push-notifications`, `@capacitor/local-notifications`,
`@capacitor/share`, `@capacitor/preferences`.

## Scripts

- `npm run dev` — start Vite dev server
- `npm run build` — typecheck and build for production (web)
- `npm run build:mobile` — build for web, then `cap sync` into iOS + Android
- `npm run sync` — `cap sync` only
- `npm run ios` / `npm run android` — open the native projects
- `npm run doctor` — Capacitor environment diagnostic
- `npm run lint` — run ESLint
- `npm run preview` — preview the production build (web)
- `npm run test:rules` — Firestore security-rules tests (needs the emulator; see
  [`firestore-tests/README.md`](./firestore-tests/README.md))

## Project layout

```
src/
  index.css                      paper-grain palette, OKLCH tokens, per-tab
                                 accents, dark mode
  data/                          seedData + taxonomies (interests, politics)
  types/                         shared domain types
  lib/                           ~60 hooks: useAuth, useProfile, useMoods,
                                 useDailyReport, useNearbyPeople,
                                 useAreaAggregate, useWorldAggregates,
                                 useCityAggregate, useGlobalMedia,
                                 useFriendShared, useTaxonomies, firebase(Impl), …
  components/
    shared/                      IOSDevice, TweaksPanel, primitives, charts
                                 (RadarChart, Compass2D, CompareCompass,
                                 BellCurve, Big5Grid, Ridgeline, NetworkGraph,
                                 ClockDial, DowStripes, …), ConcentricMap
    icons/                       NavGlyph (hand-drawn tab icons)
    insights/                    ProfileCompare, MediaPopularity
    tabs/                        AroundTab, WorldTab, CityTab, InterestsTab,
                                 PeopleTab
    overlays/                    PersonOverlay, ProfileOverlay, InsightsOverlay,
                                 TestOverlay, CityOverlay, SharingOverlay,
                                 DnaOverlay, ScrapbookOverlay, BodyOverlay,
                                 DaysOverlay, DailyReportOverlay,
                                 ImpressionsOverlay, LifeOverlay
    panels/                      LoginScreen / LoadingScreen (Firebase gate)
  App.tsx                        root: tab routing, FAB, overlay router,
                                 first-sign-in migration
functions/src/index.ts          Cloud Functions (aggregators, impression
                                 callable, deleteAccount, taxonomy seeding)
firestore.rules                  per-user scoping + cross-user read carve-outs
firestore-tests/                 security-rules unit tests (emulator)
```
