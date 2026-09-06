# functions/

The server half of the v2 loop. Read [`docs/SCHEMA-V2.md`](../docs/SCHEMA-V2.md)
for what gets written and [`docs/ORIENTATION.md`](../docs/ORIENTATION.md) §3
for where everything else lives.

*This file described a geohash5 population aggregator with a k-anonymity
floor until 2026-08-20. D13 deleted that subsystem and D98 retired the
model behind it; the text survived because `check:public-copy` is scoped to
copy a USER reads, and ORIENTATION sends every newcomer here first. The
rewrite is D223.*

## Layout

- `src/ops.ts` — **where `setGlobalOptions` lives**, plus the two uid
  allowlists (`assertOperator` → `SEED_ADMIN_UIDS`, `assertModerator` →
  `MOD_UIDS`, deliberately disjoint) and `ENFORCE_APP_CHECK`.
- `src/db.ts` — the one accessor for the named database (D165). Never call
  `getFirestore()` directly; a bare handle binds to `(default)` and writes
  land in a database nothing reads, with no error anywhere.
- `src/v2.ts` — the seed callable and the aggregate triggers.
  `onV2AnswerCreated` folds one answer into the private and published
  aggregates through an idempotency ledger; `onV2AnswerUpdated` folds the
  D86 edit's −old/+new delta through the same path.
- `src/v2social.ts` — groups, duos, invites, the duel reveal scan and its
  streaks, presence and the Near room fold, push token registration.
- `src/nightly.ts` — **the one nightly pass over the ledger** (D398):
  `digestEngagementV2` reads yesterday's agg-events once and runs the
  engagement digest, the Patterns fit and the taste fold on the same
  entries, then the attention and rollup folds — each isolated, each
  heartbeat emitted only for the fold that completed. Its header says why
  the pass wears the digest's name.
- `src/patterns.ts` — the Patterns fit the pass runs: it folds the ledger
  day through the online rank-K fit (`src/patternsFit.ts`, pure),
  compacts each person's current answers onto their private state doc,
  re-solves the batch candidate over every such map (`src/patternsAls.ts`,
  pure — the same model, a batch solver, the whole core corpus), scores
  both one step ahead against one marginal-only baseline, and publishes
  `v2_patterns/loadings` (the Patterns tab's only source) with whichever
  engine has won the last fortnight in `q` and the other under
  `candidates` (D394). Beside it, the drawable-pool count on `v2_meta/app`
  that decides whether the tab is in the bar at all (D265).
  Deliberately off the hot write path.
- `src/moderation.ts` — the flag tally, the server-picked queue, and the
  moderator's three instruments. `docs/MODERATION.md` is the design.
- `src/replay.ts` — the other direction through the fold (D290): rebuild a
  question's aggregate from the answers that made it, rather than from the
  running total. `rebuildAggregateV2` is the operator callable
  (`npm run rebuild:agg`); `replay.test.ts` pins the batch replay against
  the trigger's incremental accumulation, which is the property that makes
  every aggregate a disposable projection instead of a thing that must
  never break.
- `src/index.ts` — account deletion, and the re-exports the deploy reads.
- `src/pure.ts` — the fold arithmetic, with no Firebase in it, so every
  number this codebase publishes can be tested without an emulator. Most
  of what is worth reading twice is here.

## The one write

Answering anything appends one answer document carrying a snapshot of the
profile anchors it was written under. A trigger folds that snapshot into
per-cohort counts and publishes them exactly, from the first answer.
**Answers are public (D98)** — there is no k-anonymity floor, no publish
cadence and no suppressed cells. Three things stay closed, none of them
answers: the unscored logic answer key, flag authorship, and the presence
cell.

## Testing

`npm test` runs the pure suites — the fold, the reveal and streak
arithmetic, the queue, the allowlists — in plain node, no emulator. The
loop-level suites live at the repo root and need Java 21:
`npm run test:e2e`, `:erasure`, `:moderation`. `CLAUDE.md` §2 has the
table of what each runner covers; they are not interchangeable.

## Deploy

Rules and functions ship through `.github/workflows/firebase-deploy.yml`,
which calls the same `backend-checks.yml` a pull request does — so what
guards a PR is exactly what guards production. `docs/DEPLOYMENT.md` is the
account of how it is wired.

```sh
npm --prefix functions install
npm --prefix functions run build     # the emulator loads functions/lib
```

## Deployed functions

41 functions ship from this codebase (the deploy's `--only` list also
names `firestore:rules` and `firestore:indexes`, which are not functions).
`scripts/check-deploy-targets.mjs` fails CI if an exported function is
missing from that list — otherwise it would be built, tested, green and
never deployed.

Runtime options are set globally in `src/ops.ts`, not per function, and
`npm run check:fn-runtime` asserts none is left on the gen-2 defaults
(256 MiB / 60 s). That placement is deliberate: `export { x } from "./v2"`
is a hoisted re-export, so putting `setGlobalOptions` in `index.ts` would
apply it to index's own functions and silently miss every v2 one.

Every callable either demands App Check attestation or is named in
`scripts/check-appcheck.mjs`'s exemption list with the reason it cannot
and the allowlist that stands in — and since D221 that script checks the
callable actually calls the gate its exemption names.
