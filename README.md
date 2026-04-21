# InSight

A mobile-first personal-insight dashboard. Five tabs — **Around / World / City / Groups / People** — with personality (Big Five), political compass, and core-values compasses rendered against group averages. Plus a Personal Insights panel covering mood, habits, fitness, nutrition, and finance.

Built with React 19, TypeScript, Vite, and Recharts. Persistence is either localStorage (default) or Firebase Auth + Firestore (opt-in via env vars).

> **⚠️ Pending verification.** The Firebase Auth + Firestore flow (sign-in,
> first-sign-in migration, subscriptions, sign-out) has been written and
> typechecks but **has not yet been exercised end-to-end in a real browser
> against the live Firebase project**. Do not deploy to production until you've
> walked through the flow manually — sign in, log a few items, sign out,
> sign back in on another browser, verify data survives. Tracked as a TODO.

## Running locally

```bash
npm install
npm run dev
```

Open the URL Vite prints. Without a `.env` the app runs in **local-only mode** — all data lives in `localStorage` and there's no sign-in screen.

## Enabling Google sign-in + Firestore sync

1. `cp .env.example .env`
2. The defaults point at a project called `prvfire33`. To use your own Firebase project instead:
   - Create a project at <https://console.firebase.google.com>
   - Add a web app — copy the `firebaseConfig` values into `.env` with the `VITE_FIREBASE_*` prefix
   - Enable **Authentication → Sign-in method → Google**
   - Enable **Firestore Database**
3. Deploy the security rules:
   ```bash
   firebase deploy --only firestore:rules
   ```

Once the required four env vars are set (`VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`) the app will show a sign-in screen instead of starting straight into the dashboard.

**Security note:** Firebase *web* API keys aren't secrets — they identify a project but don't grant access. Real access control lives in [`firestore.rules`](./firestore.rules), which scopes every user to `insight_users/{their-uid}/…`. If you fork this repo, point `.env` at your own project so nobody else writes into yours.

## First sign-in

If the user's Firestore subtree is empty (first time signing in on any device), the app seeds it with whatever the browser currently has — either defaults or prior localStorage data. After that, Firestore is authoritative and drives the UI via `onSnapshot` subscriptions.

## Data model

```
insight_users/{uid}                             ← profile fields
insight_users/{uid}/relations/{id}
insight_users/{uid}/insight_cityratings/{cityName}
insight_users/{uid}/insight_moods/{date}
insight_users/{uid}/insight_habits/{id}
insight_users/{uid}/insight_workouts/{id}
insight_users/{uid}/insight_meals/{id}
insight_users/{uid}/insight_transactions/{id}
```

## Scripts

- `npm run dev` — start Vite dev server
- `npm run build` — typecheck and build for production
- `npm run lint` — run ESLint
- `npm run preview` — preview the production build

## Project layout

```
src/
  theme.ts              design tokens
  types/                shared domain types
  data/                 defaults + seed data + test banks
  utils/                helpers + localStorage driver
  lib/                  firebase init, auth hook, remoteStorage driver
  components/
    shared/             primitives (Card, SLabel, Pill, Av, BarFill, …)
    icons/              in-house SVG icon sets
    insights/           radar + compasses + compare panels
    panels/             ProfilePanel, PersonProfilePanel, TestFlow,
                        LoginScreen, InsightsPanel + sub-panels
    tabs/               Around / World / City / Groups / People
    FAB/                per-tab action stack
  App.tsx               root
```
