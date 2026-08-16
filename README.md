# InSight

**Answer things. See what they add up to.**

InSight is a two-tab app — **daily · mirror**. One tab is where you
answer; the other is where the answering turns into a picture of you
against every population you belong to. Answering is the smaller half.

## Answering — three ways in, all blind until you've played

- **The daily.** One blind vote a day, *then* how the world split, with
  exact counts — plus a finite question feed underneath to
  snack on.
- **Duels.** Groups and 1v1s with your real people: one question a day,
  everyone's answers **sealed until tomorrow**, then revealed with names.
  Duos add a guess — did you call what they'd pick? — and a shared streak.
- **Tests with no test to sit.** Big Five, politics, values and social
  fill themselves from marked cards in that same feed, alongside a row of
  smaller lenses. No homework — and passive progress starts at zero, so
  nothing is filled in that you didn't answer.

## The Mirror — one tab, one verb: see yourself against a population

Seven stops on a single ruler you drag along, from fully retracted to
fully extended:

```
you · circle · groups · near · city · country · world
```

Six of them in live mode: **Near** *is* your city there, so a City stop
would be the same cohort offered twice (decision D9).

**You** is the Map: every answer you've given becomes a dot, filed under
its question's branch and sitting further from the centre the more
unusual it was — mastered Learn facts land on the same canvas. **Groups**
is your named circles, their alignment computed from real reveal history.
**Near**, **Country** and **World** are the same question at three radii.
**Circle** is the accounts you follow, ranked by how alike your answers
are (decision D101) — a follow is a bookmark, not a permission grant, so
there is no request to send and nothing to accept.

The slicing is the whole trick, and it costs one write. An answer is
stored once, readable by anyone, carrying a snapshot of the profile
fields it was answered under. A server trigger folds that snapshot into
per-cohort counts and publishes them exactly, from the first answer — and
the Mirror reads any bucket back out.

[`docs/MIRROR.md`](./docs/MIRROR.md) is the full read path: what each stop
shows, where its numbers come from, how a test result becomes a cut line
on everyone else's answers, and which parts are still the prototype's
furniture.

Built with **React 19 + TypeScript + Vite**, wrapped for **iOS + Android**
via **Capacitor**, backed by **Firebase** (anonymous-first Auth,
Firestore, Cloud Functions) with CI auto-deploy.

## Answers are public — and honesty is still the architecture

InSight is not a private app, and says so at the top of the account
panel. What the UI claims about who can see what is enforced
server-side, not promised — that discipline is unchanged; what it
enforces is the opposite of what it used to (decision **D98**):

- **Your answers are public.** Any signed-in user can read what you
  answered, under your display name, with the age band, gender, city,
  country, education and relationship status you filled in. Showing how
  one person's answers link to everyone else's is the entire product.
  Writes stay yours alone: one create per question, and the option can be
  moved afterwards (D86) while the cohort snapshot and answer time
  cannot.
- **Counts are exact, from the first answer.** No k-anonymity floor, no
  publish cadence, no suppressed cells, no `tooSmall`. In a small cohort
  a count of 1 is visibly one person's answer.
- **Every question slices, including the political ones.** D44's
  special-category carve-out is gone; there is no category held back.
- **Reveals are materialized server-side.** Group/duo answers stay sealed
  until a Cloud Function writes the reveal doc the next day — that is the
  *game*, not a privacy promise, and rules deny answering a day that is
  already revealed so nobody peeks then plays.
- **No fake anything.** Still binding, and now the only reason anything
  is ever hidden: no seeded comments, no synthetic users, no demo
  progress in live mode (decision D1). Passive tests start at zero. Where
  a live surface shows nothing, it is because the data is absent — never
  because it is withheld.
- **Three things are still closed, none of them answers.** The unscored
  logic answer key (anti-cheat), who flagged a comment
  (anti-retaliation), and the ~200 m presence cell (physical safety: the
  app publishes what you answered, not where you are standing).
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
                   module under a ratchet — see src/v2/README.md, D39).
                   mirror-*.jsx and map-*.js* are the Mirror tab;
                   docs/MIRROR.md maps them to what they draw
  data/live.ts     the live data layer: window.LIVE (deck, feed, social)
  data/groupPortrait.ts  the Groups mirror's arithmetic, from reveals
  data/push.ts     reveal push registration (native only)
  ui/              the typed panels born in this repo, not ported: the
                   live Mirror bodies (cohorts, groups) and the duel,
                   privacy, city and search panels
  styles.css       the design system, verbatim from the spec
src/lib/           firebase init + anonymous-first auth + emulator wiring
functions/src/     v2.ts (seed + aggregates) · v2social.ts (groups, duos,
                   reveals, push) · index.ts (account deletion)
firestore.rules    the access model (public answers, exact aggs,
                   member-only groups/reveals) — 106 emulator tests
firestore.rules.v1-archive  the retired v1 client rules (D4) — reference,
                   NOT deployed
monitoring/        Cloud Monitoring policies, put live by
                   `npm run monitoring:apply` rather than by the pipeline
                   (DEPLOYMENT.md § Alerting); plus the pulse console's
                   rate card and its day-by-day trail
                   (`npm run pulse` — MONITORING.md, D47)
content/           canonical question banks & archetypes (seed source)
design/            the frozen design spec (read-only reference)
docs/              DECISIONS · MIRROR (what the app shows, and how one
                   answer reaches every surface) · SCHEMA-V2 · DEPLOYMENT ·
                   LOCAL-TESTING · SHIP-CHECKLIST · LAUNCH-RUNBOOK ·
                   data-inventory · DEVICE-BIND · MONETIZATION · COSTS ·
                   MONITORING
```

## Testing & CI

Local:

- `npm run test:unit` — client store, pure deck logic, and the spec-layer
  mount tests (vitest + jsdom, no emulator).
- `npm run test --prefix functions` — the aggregate fold, reveal and streak math.
- `npm run test:rules` — 106 security-rules tests (Firestore + Storage)
  against the emulator. `npm run check:figures` holds this number and the
  one in the repo map above equal to the suites, because both said 40 for
  long enough to be quoted twice.
- `npm run test:e2e` — the v2 core loop under `emulators:exec`: anon auth →
  seed → vote → aggregate trigger → exact publish → duel create/join/seal/reveal.
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
