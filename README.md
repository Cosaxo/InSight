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
  spec/            UI modules (shared-global style, shrinking module by
                   module under a ratchet — see src/v2/README.md, D39)
  data/live.ts     the live data layer: window.LIVE (deck, feed, social)
  data/push.ts     reveal push registration (native only)
  styles.css       the design system, verbatim from the spec
src/lib/           firebase init + anonymous-first auth + emulator wiring
functions/src/     v2.ts (seed + aggregates) · v2social.ts (groups, duos,
                   reveals, push) · index.ts (account deletion)
firestore.rules    the access model (owner-only answers, k-floored aggs,
                   member-only groups/reveals) — 45 emulator tests
firestore.rules.v1-archive  the retired v1 client rules (D4) — reference,
                   NOT deployed
monitoring/        Cloud Monitoring policies, put live by
                   `npm run monitoring:apply` rather than by the pipeline
                   (DEPLOYMENT.md § Alerting); plus the pulse console's
                   rate card and its day-by-day trail
                   (`npm run pulse` — MONITORING.md, D47)
content/           canonical question banks & archetypes (seed source)
design/            the frozen design spec (read-only reference)
docs/              DECISIONS · SCHEMA-V2 · DEPLOYMENT · LOCAL-TESTING ·
                   SHIP-CHECKLIST · LAUNCH-RUNBOOK · data-inventory ·
                   DEVICE-BIND · MONETIZATION · COSTS · MONITORING
```

## Testing & CI

Local:

- `npm run test:unit` — client store, pure deck logic, and the spec-layer
  mount tests (vitest + jsdom, no emulator).
- `npm run test --prefix functions` — the k-anon floor, reveal and streak math.
- `npm run test:rules` — 45 security-rules tests (Firestore + Storage)
  against the emulator. `npm run check:figures` holds this number and the
  one in the repo map above equal to the suites, because both said 40 for
  long enough to be quoted twice.
- `npm run test:e2e` — the v2 core loop under `emulators:exec`: anon auth →
  seed → vote → aggregate trigger → k-floor → duel create/join/seal/reveal.
- `npm run test:e2e:erasure` — deleteAccount, with leftovers observed via
  the admin SDK (rules bypassed, so "gone" means gone).
- `npm run test:coverage` (and `--prefix functions`) — **report only, never a
  gate.** Scoped to the typed layers where an untested branch is where a
  wrong number reaches a screen: `src/v2/data` on the client, `pure.ts` +
  `deviceBind.ts` on the backend. `spec/` is excluded on purpose — its only
  tests are mount smoke tests, so a coverage number there would be both
  meaningless and an invitation to raise it without asserting anything.
  What it says today: `pure.ts` 98% statements / 96% branches and `deck.ts`
  / `groupPortrait.ts` at 100% — the honesty arithmetic is genuinely
  covered — against `deviceBind.ts`'s Apple/Google verification at 27%,
  which is the half D29 can only prove on a real device (D37).
- `npm run check:globals` — the spec layer's shared-global wiring: dangling
  references, files `spec-index.js` forgot, undefined JSX tags, and
  (**rule 4**) a ratchet on how much shared-global coupling is left. The
  count may only go down, so new coupling fails and a conversion asks for
  the baseline to come down with it. It prints the live figure on every
  run; `src/v2/README.md` has the migration procedure (decision D39).
- `npm run check:labels` — every `htmlFor` / `aria-labelledby` /
  `aria-describedby` / `aria-controls` resolves to an id in the same file.
  jsx-a11y only checks such an attribute is present, never that it points at
  anything.
- `npm run check:versions` / `check:bundle` / `check:deploy-targets` —
  version lockstep across the three projects, the bundle budget, and every
  exported function appearing in the deploy list.
- `npm run check:appcheck` — every callable either demands App Check
  attestation or is named with the reason it cannot (decision D36). The
  five that cannot are the operator and moderator instruments, gated on
  uid allowlists instead; the gate fails in both directions, so an
  exemption cannot outlive its reason or spread by copy-paste.
- `npm run check:monitoring` — the alert chain, from the log line a
  function emits, through the log-based metric that selects on it, to the
  policy whose condition reads that metric. Every link fails the same
  silent way: the policy exists, the console is green, and it can never
  fire. It cannot see Cloud Monitoring — policies are applied by hand
  (D47) — so it checks the half that lives in the repo, and each of its
  four rules was verified by breaking that link and watching it fail.
- `npm run check:figures` — the counts this file quotes, held equal to the
  suites. It exists because the rules-test figure said 40 in two places
  while the suite ran 44, which was the fourth instance of one error: a
  number kept current by intention does not stay current. `check:a11y` and
  `check:globals` carry the same treatment for the figures they own.
- `npm run check:store-copy` — no unfilled placeholders in the store-facing
  legal pages. A pre-submission gate, not a CI one (see
  [`docs/SHIP-CHECKLIST.md`](./docs/SHIP-CHECKLIST.md) §3 for why).

CI ([`.github/workflows/`](./.github/workflows/)):

- **`backend-checks.yml`** holds the functions build + tests, rules tests
  and both e2e suites. It is a reusable workflow called by *both* `ci.yml`
  and `firebase-deploy.yml`, so what guards a PR is exactly what guards
  production.
- `ci.yml` adds the client-only gates (lint, globals, versions, typecheck +
  bundle budget, unit tests), an advisory `npm audit`, a Capacitor
  sync-drift warning and an Android `assembleDebug`. None of these sit on
  the deploy path — they must not be able to block an emergency rules fix.
- `security-audit.yml` runs the audit weekly, blocking, and files an issue.
- Push to `main` touching `functions/**`, `firestore.rules` or
  `storage.rules` auto-deploys once `backend-checks` is green
  ([`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md)).

## Shipping

The code side is complete through Phase 5 (native shell, reveal push,
account/privacy panel). The remaining human steps — production seed,
platform config files, store accounts, on-device verification — are in
[`docs/SHIP-CHECKLIST.md`](./docs/SHIP-CHECKLIST.md), and the same work
in dependency order as a to-do list is
[`docs/LAUNCH-RUNBOOK.md`](./docs/LAUNCH-RUNBOOK.md).

## History

InSight v1 was a private journal ("an interior social network") — its UI
was removed after the v2 pivot (decision D4; it lives in git history
before `src/legacy` was deleted), its rules retired to
`firestore.rules.v1-archive`, and its compute deleted in D13 once it was
traced that nothing had written those collections since the client went.
`deleteAccount` is the one v1-era function that carries forward, and it
still erases the v1 collections. The full design evolution is preserved
in `design/`.
