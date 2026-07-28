# functions/

Server-side compute for InSight. Currently one job: the population
aggregator that rolls up Big Five vectors per geohash5 cell with
k-anonymity, so AroundTab's "you vs your area" radar has something
real to compare against.

## Layout

- `src/index.ts` — the aggregator function. Two callable surfaces:
  - `rebuildAreaAggregates` — HTTPS-callable for manual / dev runs.
    **Operator-only**: `assertOperator()` requires the caller's uid to be
    listed in the `SEED_ADMIN_UIDS` runtime variable. With anonymous-first
    auth (D3), "any signed-in user" would have meant "anyone", and this is
    a full-collection scan — a free cost-amplification lever. Idempotent,
    and ends in a rotating batch write.
  - `scheduledAreaAggregates` — runs every 6 hours via Cloud
    Scheduler.

## How the aggregator works

1. Read every doc in `insight_discoverable` (users who've opted in
   to being a discoverable position).
2. For each discoverable, read their `insight_users/{uid}` profile.
   Skip if no Big Five vector, or if `sharePrefs.big5 == "nobody"`.
3. Bucket by the first 5 chars of the user's geohash (≈ 5 km × 5 km).
4. Compute per-axis mean + standard deviation for each cell with
   ≥ 5 contributors.
5. Write to `aggregates_by_geohash5/{hash}`. Cells below the floor
   are skipped (and any previously-published doc gets deleted, so
   we don't leak old aggregates as populations shrink).

## Privacy

- K-anonymity floor (`K_ANON_FLOOR = 20`): cells with fewer contributors
  aren't published, and any previously-published doc for a cell that falls
  below the floor is **deleted** rather than left stale. Separate floors
  apply per stream — see `WORLD_K_ANON_FLOOR`, `CITY_K_ANON_FLOOR`,
  `IMPRESSION_K_ANON_FLOOR` in `src/index.ts` and `AGG_MIN_N` in
  `src/v2.ts`.
- User opt-in chain: must be present in `insight_discoverable` AND
  have shared their Big5 (sharePrefs.big5 ≠ "nobody"). Default
  prefs include them; opting out is one toggle in SharingOverlay.
- The Cloud Function writes via admin SDK (rules bypassed); the
  rules forbid direct client writes to `aggregates_by_geohash5`.
- Reads are open to any signed-in user — the published doc has no
  individual identifiers.

## Deploy

```sh
# From repo root
npm --prefix functions install
firebase deploy --only functions
```

Or with the standalone emulator:

```sh
cd functions
npm install
npm run serve  # starts the functions emulator on the configured project
```

## Trigger manually

After deploy, you can kick the aggregator from the client side or
via `firebase functions:shell`:

```js
rebuildAreaAggregates({})
```

Returns `{ cellsWritten, cellsDeleted, usersConsidered, usersIncluded }`.

## Deployed functions

17 functions ship from this codebase (the deploy's `--only` list also
names `firestore:rules` and `firestore:indexes`, which are not functions).
`scripts/check-deploy-targets.mjs` fails CI if an exported function is
missing from that list — otherwise it would be built, tested, green and
never deployed.

Runtime options are set globally in `src/ops.ts`, not per function, and
`npm run check:fn-runtime` asserts none is left on the gen-2 defaults
(256 MiB / 60 s). That placement is deliberate: `export { x } from "./v2"`
is a hoisted re-export, so putting `setGlobalOptions` in `index.ts` would
apply it to index's own functions and silently miss every v2 one.
