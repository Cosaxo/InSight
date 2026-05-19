# functions/

Server-side compute for InSight. Currently one job: the population
aggregator that rolls up Big Five vectors per geohash5 cell with
k-anonymity, so AroundTab's "you vs your area" radar has something
real to compare against.

## Layout

- `src/index.ts` — the aggregator function. Two callable surfaces:
  - `rebuildAreaAggregates` — HTTPS-callable for manual / dev runs.
    Any signed-in user can invoke; it's idempotent and ends in a
    single batch write.
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

- K-anonymity floor (`K_ANON_FLOOR = 5`): cells with fewer
  contributors aren't published. In production, raise this to ≥ 20.
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

## Future work

- Per-axis aggregates for politics + values (same shape, different
  source fields).
- Per-city aggregates joined against the existing `Cities`
  catalogue (so the UI can label "your area" as "Oslo" not just
  a geohash prefix).
- Cooldown / rate-limit for inbound impressions (separate function,
  pre-write trigger on `insight_inbound_impressions`).
- Activity rollups (workouts / meals / etc.) — possibly per-user
  weekly summaries to make the journal-tab charts cheaper on
  read.
