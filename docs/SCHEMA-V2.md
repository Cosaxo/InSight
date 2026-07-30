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

v2_users/{uid}/answers/{qid}
  qid (== doc id), surface, optionIdx, answeredAt (request.time),
  anchors (snapshot at answer time — owner-only doc, so no leak).
    Populated from the profile's Basics card via LIVE.saveAnchors; the
    snapshot is taken at vote time so a later profile edit cannot move a
    past answer into a different cohort. Empty for users who skipped the
    card, which simply folds into no breakdown cell. See D8.
    (An earlier version of this line claimed a BigQuery extension
    targeted this collection. None is configured, in firebase.json or
    anywhere else; it described an intended path, not a deployed one.)
    Catalog questions (bank type "catalog" — docs/CATALOG-QUESTIONS.md,
    D14) store `entity` in place of optionIdx: an integer catalogue key,
    0 = "Not listed". Rules bound it to [0, 2048); the trigger holds the
    real ceiling (CATALOG_MAX_ENTITY) and an unknown key never
    aggregates.
create: owner, validated (question must exist; optionIdx < options.size())
update/delete: nobody — immutability is what lets the aggregate be a
plain increment with no reconciliation
read: owner only

v2_aggs_private/{qid}              exact counts — server-only (opaque)
  counts, total                    exact, never floored
  ent { entity: n }                catalog questions: per-entity counts
                                   in place of counts/by — bounded by
                                   the catalogue's ~1k keys, so D7's
                                   document arithmetic is unchanged
  by { dim: { bucket: {opt:n} } }  per-anchor slices, exact (see D8).
                                   Lives HERE, in the doc the trigger
                                   already writes, so D7's ~1 write/sec
                                   per document is unchanged. Bounded:
                                   low-cardinality anchors only (no city,
                                   no profession) and ≤24 buckets/dim.
v2_agg_events/{eventId}            trigger idempotency ledger (opaque)
v2_question_aggs/{qid}             the PUBLIC mirror, k-floored
  { tooSmall: true }               while total < AGG_MIN_N (5)
  { counts, total, tooSmall:false } at/above the floor, and only on every
                                   5th answer (shouldPublishAgg) — clients
                                   hold an onSnapshot, so a per-answer
                                   rewrite would stream one attributable
                                   vote per step (D7 amendment). No fresh
                                   timestamp either, for the same reason
  by { dim: { bucket: {opt:n} } }  the breakdown's OWN floor, per cell,
                                   plus complementary suppression so a
                                   lone hidden cell can't be recovered by
                                   subtraction. A dim with <2 publishable
                                   buckets is omitted (D8)
  { total, tooSmall:false,         catalog questions: the canon — top
    top {entity:n}, rest }         entities above the floor, boundary
                                   ties and lone holes folded whole
                                   (publishableCanon, D14); bare total
                                   when nothing survives the fold
read: signed-in · write: nobody

v2_groups/{gid}                    groups AND duos (mode: group|duo)
  name, mode, ownerUid, memberUids[≤32; duo ≤2], memberNames{uid:name},
  inviteCode, streak, lastRevealDay, pendingDays[≤6], createdAt
  (memberNames rides on the group doc because profiles are owner-only;
  callables maintain it on create/join/leave)
  (pendingDays: day keys with an answer and no reveal yet. onV2AnswerCreated
  arrayUnions; the reveal scan removes a day once it settles it and prunes
  past PENDING_DAYS_KEEP. It is how scheduledDuelReveals finds its work with
  an indexed query instead of reading every group — D16)
read: members · write: callables only (create/join/leave — codes, caps
and pairing can't be forged client-side)

v2_groups/{gid}/reveals/{day}      materialized by the reveal pipeline
  day, qid, votes { uid: {optionIdx, guessIdx?} }, names, members[], revealedAt
  (members is the membership snapshot AT REVEAL TIME, and it is load-bearing:
  the read rule gates on THIS array, not the parent group's current roster,
  which is what keeps the guarantee retroactive — D5's amendment)
read: the reveal's own members · write: nobody (D5)

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
  mock fallback on timeout. The daily tab reads `LIVE.deck()` when live.
  Live cards show no takes (D1: free text is circle-scoped) but DO show
  who-voted — that panel is the real per-anchor breakdown, floored per
  cell and carrying no names, which is "the split, the totals" D1 allows.
- Auth: `anonSignIn()` / `linkGoogle()` in the firebase layer — Google is
  an account *upgrade* (linking keeps the uid and all answers).

## Verification

- `npm run test:rules` — 32 rules tests (Firestore + Storage; the v2
  surface, the anonymous-default lens, and the retired-v1 guard).
- `firestore-tests/e2e-v2-loop.mjs` under
  `firebase emulators:exec --only auth,firestore,functions` — the full
  SDK loop: anon auth → seed → fetch → vote → below-floor tooSmall →
  dup refused → five voters cross the floor → exact public counts →
  per-anchor breakdown withheld while every cell is sub-floor, then
  published at 5/5 → an 11th answer does not move the mirror off 10 →
  duo create/join-by-code → sealed answers → reveal with votes+guesses →
  streak → non-member refused → post-reveal answering refused by a real
  member → no aggregate leakage.
- `npm run test:e2e:erasure` — deleteAccount, with leftovers observed via
  the admin SDK (rules bypassed, so "gone" means gone rather than
  "permission-denied").
- `npm run test:unit` / `npm run test --prefix functions` — the deck
  rotation and vote state machine; the k-anon floor, reveal and streak math.

**What is NOT covered: rendering.** There is no browser-level test, and no
Playwright — this section previously claimed such a suite existed, which
was the worst kind of documentation defect: a verification gate that
provides no verification. The underlying properties it named are covered
elsewhere — the vote → trigger → k-floor path by the emulator e2e above,
and the S-form's empty comments array (D1) by `deck.test.ts` — so the real
gap is narrower than that bullet implied, but it is a gap: nothing asserts
that a component renders.

Sandbox note: run emulator commands with `HTTPS_PROXY` unset —
firebase-tools routes even localhost HTTP through a proxy dispatcher when
it is set, and the egress gateway denies it.
