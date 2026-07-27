# InSight

**Answer one question. See where you stand. Know your people.**

InSight is a two-tab app — **daily · mirror** — built around three loops:

- **The daily.** One blind vote a day (plus a finite question feed to
  snack on). You answer first, *then* see how the world split — with
  honest, k-anonymous counts.
- **Duels.** Groups and 1v1s with your real people: one question a day,
  everyone's answers **sealed until tomorrow**, then revealed with names.
  Duos add a guess — did you call what they'd pick? — and a shared streak.
- **The map.** Every answer becomes a dot in your constellation on the
  Mirror tab. The four core tests (Big Five, politics, values, social)
  fill themselves passively from marked cards in the feed — no homework.

Built with **React 19 + TypeScript + Vite**, wrapped for **iOS + Android**
via **Capacitor**, backed by **Firebase** (anonymous-first Auth,
Firestore, Cloud Functions) with CI auto-deploy.

## Honesty is the architecture

Every privacy claim in the UI is enforced server-side, not promised:

- **Answers are owner-only, forever.** One create per question, immutable,
  readable by you alone (`firestore.rules`, decision D5).
- **World stats are k-floored.** Exact counts live in a server-only
  collection; the public mirror shows nothing below 5 answers and carries
  no per-vote timestamps (`v2_question_aggs`, AGG_MIN_N).
- **Reveals are materialized server-side.** Group/duo answers become
  visible only when a Cloud Function writes the reveal doc — rules deny
  answering a day that's already revealed, so nobody peeks then plays.
- **No fake anything.** No seeded comments, no synthetic users, no demo
  progress in live mode (decision D1). Passive tests start at zero.
- **Anonymous-first.** The app works instantly with no sign-in; Google is
  an *upgrade* via account linking that keeps your uid and history
  (decision D3). Deletion wipes everything, cross-references included.

## Running it

```bash
npm install
npm run dev          # mock mode — full UI on demo data, no backend
```

**Live mode** (real backend on the local emulators — see
[`docs/LOCAL-TESTING.md`](./docs/LOCAL-TESTING.md)):

```bash
cp .env.emulator .env
firebase emulators:start --only auth,firestore,functions --project prvfire33   # terminal 1
npm run dev                                                                    # terminal 2
```

On a desktop viewport the app renders inside a device mockup; at phone
width (or under Capacitor) it goes full-bleed with safe-area insets.

## Repo map

```
src/v2/            the app — ported from the frozen design spec
  spec/            UI modules (shared-global style; see src/v2/README.md)
  data/live.ts     the live data layer: window.LIVE (deck, feed, social)
  data/push.ts     reveal push registration (native only)
  styles.css       the design system, verbatim from the spec
src/lib/           firebase init + anonymous-first auth + emulator wiring
functions/src/     v2.ts (seed + aggregates) · v2social.ts (groups, duos,
                   reveals, push) · index.ts (v1-era aggregates & account
                   deletion, still deployed)
firestore.rules    the access model (owner-only answers, k-floored aggs,
                   member-only groups/reveals) — 23 emulator tests
content/           canonical question banks & archetypes (seed source)
design/            the frozen design spec (read-only reference)
docs/              DECISIONS · SCHEMA-V2 · DEPLOYMENT · LOCAL-TESTING ·
                   SHIP-CHECKLIST · data-inventory
```

## Testing & CI

- `npm run test:rules` — 23 security-rules tests against the emulator.
- `firestore-tests/e2e-v2-loop.mjs` — the 14-step SDK end-to-end (seed →
  vote → k-floor → duel lifecycle) under `emulators:exec`.
- Push to `main` touching `functions/**` or `firestore.rules` auto-deploys
  via GitHub Actions ([`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md)).

## Shipping

The code side is complete through Phase 5 (native shell, reveal push,
account/privacy panel). The remaining human steps — production seed,
platform config files, store accounts, on-device verification — are in
[`docs/SHIP-CHECKLIST.md`](./docs/SHIP-CHECKLIST.md).

## History

InSight v1 was a private journal ("an interior social network") — its UI
was removed after the v2 pivot (decision D4; it lives in git history
before `src/legacy` was deleted). The v1 backend (geo aggregates,
account deletion) remains deployed and carried forward. The full design
evolution is preserved in `design/`.
