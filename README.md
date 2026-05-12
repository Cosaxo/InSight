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
