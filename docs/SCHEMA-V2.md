# v2 schema — the daily/mirror core loop

Phase-2 collections. Access model per decisions D1/D3/D5
(`docs/DECISIONS.md`): answers are owner-only forever; every shared surface
is server-written (aggregates now, reveals in Phase 3).

This file is the write side. For the read side — which of these documents
each Mirror stop opens, how the anchors snapshot on an answer becomes the
cohort the Mirror slices by, and what is still prototype data — see
[`docs/MIRROR.md`](./MIRROR.md).

## Collections

```
v2_questions/{qid}                 canonical bank, seeded by seedContentV2
  surface: daily|feed|group|duo|test|learn
  seq: int            rotation order within a surface
  type: binary|choice|scale|rating|vote|duel|ranking|catalog
  domain: pokemon|films|artists   (catalog questions only — names the key
                                   space the trigger validates against, D15)
  prompt: string
  options: string[]   (scale → the 5-point agree scale; rating → "1".."10")
  topic, axis, test   metadata (test != null only on a test's own items)
  active: bool
read: signed-in · write: nobody (admin SDK only)
  Learn cards (surface "learn", D32) carry only prompt/options/topic —
  the correctness metadata (correct index, trap, authored estimate, map
  label) stays client-side in content/learn-questions.json; the server
  never learns which option is right, and "% got it right" is
  counts[correct]/total computed on the device from the public agg.
  A user's ONLY server-side learn answer is their first attempt per card
  (create-only answers make retries unrecordable by construction — D5);
  the scheduler's spaced retries stay in device localStorage.

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
    0 = "Not listed". Rules bound it to [0, 1e9) — QID scale, D15; the
    trigger validates against the question's own domain (a range for
    pokemon, generated QID key sets for films/artists) and an unknown
    key never aggregates.
create: owner, validated (question must exist; optionIdx < options.size())
update: owner, ONE shape (D86) — optionIdx moves (+ editedAt ==
request.time), on surfaces daily|feed|test only, bounded by the
question's options, once per 60 s per answer. Everything else is frozen:
anchors and answeredAt (the cohort stamp, D8), learn (D32's
first-attempt measurement), duels (the seal), catalog answers (no canon
delta path). The aggregate stays a plain fold because onV2AnswerUpdated
applies the matching -old/+new delta with the total unchanged — the
reconciliation D5 avoided now exists, in one trigger, ledger-deduped
delete: nobody
read: owner only

v2_aggs_private/{qid}              exact counts — server-only (opaque)
  counts, total                    exact, never floored
  ent { entity: n }                catalog questions: per-entity counts
                                   in place of counts — bounded by the
                                   catalogue's ~1k keys, so D7's
                                   document arithmetic is unchanged
  entBy { dim: { bucket:           catalog questions: per-entity anchor
           { entity: n } } }       slices (D17), the vote fold transposed
                                   with its own per-cell entity cap (32)
                                   on top of the bucket cap
  by { dim: { bucket: {opt:n} } }  per-anchor slices, exact (see D8).
                                   Lives HERE, in the doc the trigger
                                   already writes, so D7's ~1 write/sec
                                   per document is unchanged. Bounded:
                                   low-cardinality anchors only (no city,
                                   no profession) and ≤24 buckets/dim.
v2_agg_events/{eventId}            trigger ledger (opaque), two jobs (D28)
  { qid, uid, at, expireAt }       dedup: at-least-once delivery can't
                                   double-count. Attribution: uid is what
                                   lets an operator subtract a discovered
                                   fake-account ring from the exact counts
                                   and republish (DEPLOYMENT.md,
                                   "Correcting aggregates"). TTL'd at 90
                                   days (LEDGER_RETENTION_DAYS); a uid's
                                   entries are erased with the account
v2_question_aggs/{qid}             the PUBLIC mirror, k-floored
  { tooSmall: true }               while total < AGG_MIN_N (5 by design; 1 under D81's launch pause)
  { counts, total, tooSmall:false } at/above the floor, republished every
                                   PUBLISH_EVERY-th answer — 5 by design,
                                   1 under D81's launch pause: clients
                                   hold an onSnapshot, so a per-answer
                                   rewrite streams one attributable vote
                                   per step, which the design cadence
                                   exists to batch away and the pause
                                   accepts (D7 amendment). No fresh
                                   timestamp either, for the same reason
  by { dim: { bucket: {opt:n} } }  the breakdown's OWN floor, per cell,
                                   plus complementary suppression so a
                                   lone hidden cell can't be recovered by
                                   subtraction. A dim with <2 publishable
                                   buckets is omitted (D8)
  { total, tooSmall:false,         catalog questions: the canon — top
    top {entity:n}, rest,          entities above the floor, boundary
    by { dim: { bucket:            ties and lone holes folded whole
      { entity: n } } } }          (publishableCanon, D14); bare total
                                   when nothing survives the fold. `by`
                                   (D17) holds each segment's ordering
                                   of the board's OWN entities — floored
                                   on the shown cohort with the same
                                   complementary suppression as vote
                                   breakdowns, never a segment-local
                                   long tail
  duel-{qid} ids (D40 part 3):     the duel signal — written at reveal
  { plays, total, tooSmall:false,   time (foldDuelSignal), summed across
    counts?, guessTotal?,           ALL groups. plays = group-days,
    guessMatches? }                 total = persons (the floor's unit);
                                   counts only for bank-option questions
                                   (a pick's optionIdx indexes each
                                   group's own members — never summed);
                                   guess fields only when a duo guessed.
                                   Same floor, crossing-based cadence
                                   (a reveal folds a batch), no
                                   timestamp. Never: gids, uids, names,
                                   member sets, per-group anything
read: signed-in · write: nobody

v2_presence/{uid}                  Near-by-radius presence (D84)
  cell: "la_lo"                    a ~1 km 0.01-degree grid id, computed
                                   ON DEVICE from a coarse fix whose
                                   coordinate is discarded (data/locate.ts)
  at: request.time                 freshness; docs older than 10 min do
                                   not count as "here"
read: NOBODY (the only read path is nearbyCountV2, which returns a count
of fresh presence in the 3x3 neighborhood, caller excluded) ·
create/update/delete: owner only, shape-checked — the cell regex in the
rules is the precision cap in structural form. Opting out deletes the
doc; deleteAccount does too.

v2_groups/{gid}                    groups AND duos (mode: group|duo)
  name, mode, ownerUid, memberUids[≤32; duo ≤2], memberNames{uid:name},
  memberJoinedAt{uid:ts},
  inviteCode, streak, lastRevealDay, pendingDays[≤6], createdAt,
  duoMode? (duo docs only: friends|romantic — which 1v1 pool duelQFor
  serves the pair; absent = friends. D40 part 4)
  (memberNames rides on the group doc because profiles are owner-only;
  callables maintain it on create/join/leave)
  (memberJoinedAt is read only by revealGroupDay, to scope a day's reveal to
  the members who were in the group FOR that day. Maintained on the same
  three paths as memberNames, plus deleteAccount — a uid left in either map
  outlives the account. Absent for members who predate the field, which
  revealMembersFor reads as "joined before any day it will be asked about")
  (pendingDays: day keys with an answer and no reveal yet. onV2AnswerCreated
  arrayUnions; the reveal scan removes a day once it settles it and prunes
  past PENDING_DAYS_KEEP. It is how scheduledDuelReveals finds its work with
  an indexed query instead of reading every group — D19)
read: members · write: callables only (create/join/leave — codes, caps
and pairing can't be forged client-side), with ONE member-writable field:
a duo member may update duoMode alone (closed enum, affectedKeys-pinned —
the rule expresses the whole invariant, so no callable; D40 part 4)

v2_groups/{gid}/reveals/{day}      materialized by the reveal pipeline
  day, qid, votes { uid: {optionIdx, guessIdx?} }, names, members[], revealedAt
  (members is the membership snapshot the read rule gates on — not the
  parent group's current roster, which is what keeps the guarantee
  retroactive: D5's amendment. It is the members who were in the group ON
  `day`, not at reveal time; the two differ by up to one scan interval, and
  the difference was a joiner reading the previous day — D55 §9)
read: the reveal's own members · write: nobody (D5)

Sealed duel answers live in the owner-only answers subcollection under
composite ids (g_{gid}_{day}) with extra fields gid/day/guessIdx; rules
require membership and deny creates once the day's reveal exists. Duel
surfaces are excluded from world aggregates.

v2_takes/{takeId}                  circle-scoped comments (D1; MODERATION.md)
  gid, authorUid, qid?, text ≤280, createdAt (request.time)
  hidden  (bool, REQUIRED,         soft-hide (D22): the circle loses it,
    false on create)               the author keeps reading it — appeal
  hiddenMeta? { by, policyLine,    stays possible against visible text
    runId, at }
create: circle members, shape-validated · update: nobody (an edit
invalidates the flags cast on what it used to say — delete and repost)
delete: author · read: circle members, minus hidden-for-non-authors

`hidden` is a required boolean rather than an optional annotation map, and
a LIST of this collection must carry `where("hidden","==",false)` or it is
refused. Both facts are one fact: the read gate is `hidden == false`, and
only an equality on a present field is enforceable against a query — the
presence test this replaced returned hidden takes to the whole circle on a
`where("gid","==",…)` while denying the same document to `getDoc` (D65).
An ordered list needs the `(gid ASC, hidden ASC, createdAt DESC)` composite
in firestore.indexes.json — the only entry in that file's `indexes` array,
declared ahead of the UI that will want it.
(deleteAccount erases a user's takes and flags by uid query)

v2_flags/{takeId}_{uid}            one flag per (take, user), write-only
  takeId, gid, uid, at             anonymous to the circle AND the
                                   moderation run — only server-folded
                                   counts are ever read
create: circle members, doc-id-pinned, never on a hidden take
read/update/delete: nobody

v2_mod_queue/{takeId}              server-built daily (buildModQueue):
  text copy, flags, escalated?,    the top-K most-flagged takes — the
  advisoryVerdict?                 ONLY thing the moderation run reads
v2_mod_verdicts/{takeId}           audit log, one per queue generation
read/write: nobody client-side — both reachable solely through the
MOD_UIDS-gated callables (the D22 confinement)
```

## Functions

- `seedContentV2` (callable; emulator or SEED_ADMIN_UIDS allowlist) — mirrors `/content` question banks
  into `v2_questions` (513 docs, stable ids `daily-000`, `feed-<id>`,
  `group-<id>`, `duo-000`, `test-<key>-NN`; idempotent merge; `active` written only on first create, preserving the
  operational kill switch). Bank source:
  `functions/src/v2content.ts`, generated from `/content/*.json`.
- `onV2AnswerCreated` (Firestore trigger, retry on) — transactionally
  folds each answer into `v2_aggs_private` and mirrors the k-floored
  public doc; idempotent via the `v2_agg_events` ledger (at-least-once
  delivery can't double-count), which also records uid attribution so a
  discovered fake-account ring can be subtracted after the fact (D28).
- `deleteAccount` also recursively deletes `v2_users/{uid}`.
- Social callables: `createGroupV2` (invite code minted server-side),
  `joinGroupV2` (by code; duo cap 2, group cap 32), `leaveGroupV2`
  (last member out deletes the group + reveals).
- `scheduledDuelReveals` (hourly) / `revealDuelsNowV2` (emulator or
  operator) — materialize yesterday's reveals: groups reveal with ≥1
  answer; duos only when BOTH played (and the shared streak advances or
  resets accordingly).
- `activateDeviceV2` (callable; D29, docs/DEVICE-BIND.md) — verifies a
  platform attestation token against the per-device bits Apple/Google
  hold (one counted account per device per calendar month) and stamps
  the `db` custom claim; `firestore.rules` demands the claim on
  aggregate-feeding answer creates once `deviceBindEnforced()` flips.
  Emulator: grants unconditionally. Stores nothing about the device.
- Moderation (docs/MODERATION.md, D22): `buildModQueue` (scheduled,
  05:00 UTC daily) folds flags into the queue, with `buildModQueueNow`
  as its moderator-gated on-demand twin (the revealDuelsNowV2 pattern);
  `fetchModQueue` / `submitModVerdict` (callables, `MOD_UIDS` allowlist
  — deliberately separate from `SEED_ADMIN_UIDS`) are the moderation
  run's only two instruments, and verdicts stay advisory until the
  trust ladder's flip. Transport e2e-tested: `test:e2e:moderation`.

## Metadata

```
v2_meta/app                        operator/seed-written metadata
  contentRev     the FULL-invalidation lever for the client's local
                 question-bank cache. Written on the first seed of an
                 empty project, and on seedContentV2({bumpRev:true}) —
                 which is how a hand-flipped `active` reaches clients.
                 Ordinary content growth does NOT move it: changed docs
                 carry a fresh `updatedAt` and clients page the delta
                 (D34, docs/COSTS.md)
  latestBuild    soft in-app "update available" banner when > appBuild
  minBuild       hard "update needed" gate when > appBuild
  updateUrl      store link the prompts open (web falls back to reload)
read: signed-in · write: nobody
```

## Read economics (client)

A live boot costs ~20 reads, not ~380: one `v2_meta/app` read decides
everything. The question bank (513 docs) caches in localStorage keyed by
`contentRev`, and refreshes **incrementally** — one query for docs newer
than the cache's `updatedAt` cursor, so a promotion cycle costs the
handful of questions it added rather than the whole bank (D34;
docs/COSTS.md has the arithmetic for why that mattered more than it
looks). Answer creates never refetch, so that local cache pulls docs
newer than its high-water mark — plus, since D86 made optionIdx mutable,
a second cursor over `editedAt` so another device's edit is heard about
without moving the frozen answeredAt watermark; aggregates cache locally and fetch only
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

- `npm run test:rules` — 61 rules tests (Firestore + Storage; the v2
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
