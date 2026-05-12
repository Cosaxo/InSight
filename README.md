# InSight

A mobile-first personal-insight journal — five tabs (**Around / World / City / Groups / People**) wrapped in an iOS device frame, plus a fan-out FAB that opens a daily report, a journal of mood / habits / fitness / nutrition / finance, the body, the days, a scrapbook, impressions, tests, life details, sharing controls, and a DNA viewer.

Built with React 19, TypeScript, and Vite. Visuals are CSS-variable-driven and hand-drawn — Fraunces + Inter + JetBrains Mono + Caveat on a paper-grain background, OKLCH colour tokens, dark mode + density toggles. Persistence is localStorage by default, with optional Firebase Auth + Firestore sync.

> **⚠️ Pending verification.** The Firebase Auth + Firestore flow (sign-in,
> first-sign-in migration, subscriptions, sign-out) has been written and
> typechecks but **has not yet been exercised end-to-end in a real browser
> against the live Firebase project**. Do not deploy to production until you've
> walked through the flow manually — sign in, log a daily report, edit a city
> rating, sign out, sign back in on another browser, verify the data survives.

## Running locally

```bash
npm install
npm run dev
```

Open the URL Vite prints. Without a `.env` the app runs in **local-only mode** — all data lives in `localStorage` and there's no sign-in screen.

The TweaksPanel (dark mode / density / active tab) toggles with **Cmd/Ctrl/Shift+?**.

## Enabling Google sign-in + Firestore sync

1. `cp .env.example .env`
2. Create a Firebase project at <https://console.firebase.google.com>, add a web app, copy the `firebaseConfig` values into `.env` with the `VITE_FIREBASE_*` prefix.
3. In the console, enable **Authentication → Sign-in method → Google** and **Firestore Database**.
4. Deploy the security rules:
   ```bash
   firebase deploy --only firestore:rules
   ```

Once the required four env vars are set (`VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`) the app shows a sign-in screen instead of going straight into the dashboard.

**Security note:** Firebase *web* API keys aren't secrets — they identify a project but don't grant access. Real access control lives in [`firestore.rules`](./firestore.rules), which scopes every user to `insight_users/{their-uid}/…`. If you fork this repo, point `.env` at your own project so nobody else writes into yours.

## First sign-in

If the user's Firestore subtree doesn't exist yet, the app seeds it with whatever the browser currently has — either defaults or prior localStorage data (daily report, city ratings). After that, Firestore is authoritative and drives the UI via `onSnapshot` subscriptions.

## Data model

```
insight_users/{uid}                             ← profile fields
insight_users/{uid}/relations/{id}
insight_users/{uid}/insight_cityratings/{cityName}
insight_users/{uid}/insight_daily/today         ← today's daily report
insight_users/{uid}/insight_moods/{date}
insight_users/{uid}/insight_habits/{id}
insight_users/{uid}/insight_workouts/{id}
insight_users/{uid}/insight_meals/{id}
insight_users/{uid}/insight_transactions/{id}
```

User-uploaded photo blobs stay in localStorage (`insight.dailyReport.photo.v1`) and are not synced; the stock-photo key (e.g. `fjord`) travels with the remote doc.

## Firebase cost notes

The app is designed to keep Firestore reads cheap:

- **Firebase SDK is lazy-loaded.** Signed-out users never download it; it ships as a separate ~350 kB chunk only when sign-in is enabled.
- **Subscriptions only attach when signed-in.** Each `useX` hook short-circuits in localStorage-only mode.
- **Collections are intentionally small.** Relations, city ratings, habits, daily-report — all under a few dozen docs each.
- **Moods are windowed.** `subscribeMoods` is `orderBy("date","desc") + limit(60)` rather than a full-collection scan. After a year of daily logging this caps per-snapshot reads at 60 instead of 365.
- **Writes are user-driven.** A signed-in user generates roughly 1 write per daily-report save, 1 per star tap, 1 per habit tap, 1 per added person. No background polling, no automatic re-writes.
- **The Firestore SDK deduplicates listeners.** Mounting the same `useX` hook in two components reuses one underlying network listener.

A typical active user, signed in, lands well inside Firebase's free tier (50 k reads + 20 k writes per day).

## Scripts

- `npm run dev` — start Vite dev server
- `npm run build` — typecheck and build for production
- `npm run lint` — run ESLint
- `npm run preview` — preview the production build

## Project layout

```
src/
  index.css                      paper-grain palette, OKLCH tokens, dark mode
  data/seedData.ts               rich seed data for the demo (the plan's data.js)
  types/                         shared domain types (incl. RemoteDailyReport)
  lib/
    firebase.ts                  lazy public API surface
    firebaseImpl.ts              Firebase SDK — code-split chunk
    useAuth.ts                   auth subscription hook
    useTweaks.ts                 design tweaks (dark/density), localStorage-backed
    useDailyReport.ts            today's daily report (local + Firestore)
    useCityRatings.ts            star ratings (local + Firestore)
  components/
    shared/                      IOSDevice frame, TweaksPanel, primitives,
                                 charts (RadarChart / Compass2D / Donut / …),
                                 ConcentricMap
    icons/                       NavGlyph (hand-drawn tab icons)
    insights/                    ProfileCompare, MediaPopularity, GroupBreakdown
    tabs/                        AroundTab, WorldTab, CityTab, GroupsTab,
                                 PeopleTab
    overlays/                    PersonOverlay, ProfileOverlay (politics inc.),
                                 InsightsOverlay (mood + journal-tabs),
                                 TestOverlay, CityOverlay, SharingOverlay,
                                 DnaOverlay, ScrapbookOverlay, BodyOverlay,
                                 DaysOverlay, DailyReportOverlay,
                                 ImpressionsOverlay, LifeOverlay
    panels/                      LoginScreen / LoadingScreen (Firebase gate)
  App.tsx                        root: tab routing, FAB stack, overlay router,
                                 first-sign-in migration
```
