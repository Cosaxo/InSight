# v2 schema — the daily/mirror core loop

Phase-2 collections. Access model per decisions D1/D3/D5
(`docs/DECISIONS.md`): answers are owner-only forever; every shared surface
is server-written (aggregates now, reveals in Phase 3).

## Collections

```
v2_questions/{qid}                 canonical bank, seeded by seedContentV2
  surface: daily|feed|group|duo|test
  seq: int            rotation order within a surface
  type: binary|choice|scale|rating|vote|duel|ranking
  prompt: string
  options: string[]   (scale → the 5-point agree scale; rating → "1".."10")
  topic, axis, test   metadata (test != null only on a test's own items)
  active: bool
read: signed-in · write: nobody (admin SDK only)

v2_users/{uid}
  displayName?, anon?, anchors { city country ageBand gender
                                 profession education relationship }
read/write: owner only (validated key set; Phase 3 adds display carve-outs)

v2_users/{uid}/answers/{qid}       ← BigQuery extension targets "answers"
  qid (== doc id), surface, optionIdx, answeredAt (request.time),
  anchors (snapshot at answer time — owner-only doc, so no leak)
create: owner, validated (question must exist; optionIdx < options.size())
update/delete: nobody — immutability is what lets the aggregate be a
plain increment with no reconciliation
read: owner only

v2_aggs_private/{qid}              exact counts — server-only (opaque)
v2_agg_events/{eventId}            trigger idempotency ledger (opaque)
v2_question_aggs/{qid}             the PUBLIC mirror, k-floored
  { tooSmall: true }               while total < AGG_MIN_N (5)
  { counts, total, tooSmall:false } at/above the floor — no fresh
                                   timestamp, so per-vote timing deltas
                                   aren't attributable
read: signed-in · write: nobody

v2_groups/{gid}                    groups AND duos (mode: group|duo)
  name, mode, ownerUid, memberUids[≤32; duo ≤2], memberNames{uid:name},
  inviteCode, streak, lastRevealDay, createdAt
  (memberNames rides on the group doc because profiles are owner-only;
  callables maintain it on create/join/leave)
read: members · write: callables only (create/join/leave — codes, caps
and pairing can't be forged client-side)

v2_groups/{gid}/reveals/{day}      materialized by the reveal pipeline
  day, qid, votes { uid: {optionIdx, guessIdx?} }, names, revealedAt
read: members · write: nobody (D5)

Sealed duel answers live in the owner-only answers subcollection under
composite ids (g_{gid}_{day}) with extra fields gid/day/guessIdx; rules
require membership and deny creates once the day's reveal exists. Duel
surfaces are excluded from world aggregates.
```

## Functions

- `seedContentV2` (callable; emulator or SEED_ADMIN_UIDS allowlist) — mirrors `/content` question banks
  into `v2_questions` (191 docs, stable ids `daily-000`, `feed-<id>`,
  `group-<id>`, `duo-000`, `test-<key>-NN`; idempotent merge; `active` written only on first create, preserving the
  operational kill switch). Bank source:
  `functions/src/v2content.ts`, generated from `/content/*.json`.
- `onV2AnswerCreated` (Firestore trigger, retry on) — transactionally
  folds each answer into `v2_aggs_private` and mirrors the k-floored
  public doc; idempotent via the `v2_agg_events` ledger (at-least-once
  delivery can't double-count).
- `deleteAccount` also recursively deletes `v2_users/{uid}`.
- Social callables: `createGroupV2` (invite code minted server-side),
  `joinGroupV2` (by code; duo cap 2, group cap 32), `leaveGroupV2`
  (last member out deletes the group + reveals).
- `scheduledDuelReveals` (hourly) / `revealDuelsNowV2` (emulator or
  operator) — materialize yesterday's reveals: groups reveal with ≥1
  answer; duos only when BOTH played (and the shared streak advances or
  resets accordingly).

## Metadata

```
v2_meta/app                        operator/seed-written metadata
  contentRev     bumped by seedContentV2 — invalidates the client's
                 local question-bank cache
  latestBuild    soft in-app "update available" banner when > appBuild
  minBuild       hard "update needed" gate when > appBuild
  updateUrl      store link the prompts open (web falls back to reload)
read: signed-in · write: nobody
```

## Read economics (client)

A live boot costs ~10 reads, not ~380: one `v2_meta/app` read decides
everything. The question bank (191 docs) caches in localStorage keyed by
`contentRev`; answers are immutable, so the local cache only pulls docs
newer than its high-water mark; aggregates cache locally and fetch only
answered questions' missing docs (feed cards are blind pre-vote — there
is nothing to show). The 7 deck aggregates keep live snapshots; voted
aggregates refresh once, delayed. Push tokens write once per new token,
not per boot. `LIVE.stats` reports `bankSource` / `answersFetched` /
`aggsFetched` for spot checks.

## Client

- `src/v2/data/live.ts` — `window.LIVE`: anonymous-first boot (D3),
  deterministic daily rotation (`dayIndex % bankSize`, local midnight),
  aggregate snapshots per deck question, optimistic votes with rollback,
  mock fallback on timeout. The daily tab reads `LIVE.deck()` when live;
  comments/who-voted are hidden for live cards (D1).
- Auth: `anonSignIn()` / `linkGoogle()` in the firebase layer — Google is
  an account *upgrade* (linking keeps the uid and all answers).

## Verification

- `npm run test:rules` — 23 rules tests (12 legacy + 11 v2/social).
- `firestore-tests/e2e-v2-loop.mjs` under
  `firebase emulators:exec --only auth,firestore,functions` — the full
  SDK loop: anon auth → seed → fetch → vote → below-floor tooSmall →
  dup refused → five voters cross the floor → exact public counts →
  duo create/join-by-code → sealed answers → reveal with votes+guesses →
  streak → post-reveal lockout → no aggregate leakage.
- Browser e2e (Playwright, dev server + emulators): live deck renders a
  seeded question, vote writes the answer doc, agg total increments,
  no Comments affordance.

Sandbox note: run emulator commands with `HTTPS_PROXY` unset —
firebase-tools routes even localhost HTTP through a proxy dispatcher when
it is set, and the egress gateway denies it.
