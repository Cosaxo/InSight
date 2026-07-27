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

v2_groups/{gid}                    Phase-3 foundations
  name, ownerUid, memberUids[≤32], createdAt
read: members · create: owner (must be a member) · update/delete: frozen
until the invite flow lands
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

## Client

- `src/v2/data/live.ts` — `window.LIVE`: anonymous-first boot (D3),
  deterministic daily rotation (`dayIndex % bankSize`, local midnight),
  aggregate snapshots per deck question, optimistic votes with rollback,
  mock fallback on timeout. The daily tab reads `LIVE.deck()` when live;
  comments/who-voted are hidden for live cards (D1).
- Auth: `anonSignIn()` / `linkGoogle()` in the firebase layer — Google is
  an account *upgrade* (linking keeps the uid and all answers).

## Verification

- `npm run test:rules` — 20 rules tests (12 legacy + 8 v2).
- `firestore-tests/e2e-v2-loop.mjs` under
  `firebase emulators:exec --only auth,firestore,functions` — the full
  SDK loop: anon auth → seed → fetch → vote → below-floor tooSmall →
  dup refused → five voters cross the floor → exact public counts.
- Browser e2e (Playwright, dev server + emulators): live deck renders a
  seeded question, vote writes the answer doc, agg total increments,
  no Comments affordance.

Sandbox note: run emulator commands with `HTTPS_PROXY` unset —
firebase-tools routes even localhost HTTP through a proxy dispatcher when
it is set, and the egress gateway denies it.
