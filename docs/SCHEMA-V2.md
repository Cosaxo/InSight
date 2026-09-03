# v2 schema — the daily/mirror core loop

> **D98 (2026-08-11): answers are public.** Every "owner only" below that
> covers an answer, an anchors snapshot, a profile or a test result is now
> **any signed-in user**; `v2_question_aggs` carries **exact** counts and a
> complete breakdown with no `tooSmall`, no `AGG_MIN_N`, no
> `PUBLISH_EVERY` and no complementary suppression; `publishableCanon` is
> now `canonTopN`, a display cap. Duel answers remain sealed until their
> reveal, enforced by a `surface` test on the read rule — game timing, not
> privacy. Push tokens moved to `v2_users/{uid}/push/tokens`, server-only.
> The per-collection blocks below have been rewritten to match.

Phase-2 collections. Access model per decision D98 (`docs/DECISIONS.md`):
answers are readable by any signed-in user and written only by their
owner; every shared surface is server-written.

This file is the write side. For the read side — which of these documents
each Mirror stop opens, how the anchors snapshot on an answer becomes the
cohort the Mirror slices by, and what is still prototype data — see
[`docs/MIRROR.md`](./MIRROR.md).

## Collections

```
v2_questions/{qid}                 canonical bank, seeded by seedContentV2;
                                   paid questions (id paidq-*) written live
                                   by the payment webhook (paid.ts, D313) in
                                   the same field shape, updatedAt fresh so
                                   the bank's delta fetch carries them with
                                   no deploy. The seed only touches its own
                                   ids, so a reseed never disturbs them
  surface: daily|feed|group|duo|test|learn|pulse|call
  seq: int            rotation order within a surface
  type: binary|choice|scale|rating|vote|duel|rank|dial|field|path|catalog|pulse|call
  domain: pokemon|films|artists   (catalog questions only — names the key
                                   space the trigger validates against, D15)
  prompt: string
  options: string[]   (scale → the 5-point agree scale; rating → "1".."10";
                       pulse → exactly five steps; call → exactly two, and
                       index 0 is the call coming true)
  topic, axis, test   metadata (test != null only on a test's own items)
  active: bool
  until?              feed only (D179): the UTC day after which the card
                      stops being SERVED. A client-side serving filter;
                      `active: false` stays the hard, server-side kill, and
                      answers and aggregates persist either way
  core?               feed only (D161), and ABSENT MEANS TAIL — a question
                      is in the Mirror's corpus only if it says so
  sponsor?            feed only (D195; buyer model D228): { buyer?,
                      audience? } on a question somebody paid to ask —
                      a company or an individual. `buyer` is the name the
                      buyer chose to wear, or absent for a nameless
                      purchase; the PAID band renders from this block's
                      PRESENCE either way (the fact of payment is the
                      app's disclosure, not the buyer's choice).
                      `audience` is one to three dim → bucket entries
                      from the published breakdown dims, matched
                      conjunctively by the DEVICE (data/sponsored.ts) —
                      the server is never asked who should see what — and
                      every matched dim prints on the band. The window
                      is `until` above rather than a field here, so the
                      band's label and the serving filter are one value. A
                      sponsored question is never `core`
  tier/resolvesAt/    call only (D194): the admitted grading tier, the
    rubric?           earliest UTC day it may be graded, and the expression
                      resolveCallsV2 RUNS. The outcome is NOT here — it
                      lives in v2_call_outcomes, so a reseed and the
                      resolver never fight
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
  displayName?, anon?, anchors { city country ageBand age gender
                                 profession jobField education
                                 relationship heightBand },
  testResults? { big5|political|values|attachment: { title, taken,
                                                     dims [{id,label,value 0-100,blurb?}] },
                 logic: server-written only (D57) }
read: any signed-in user (D98 — displayName + anchors are what turn a uid
on an answer into a person; testResults is what D112's kindred-by-scores
reads across users, exactly the read the rules comment promised)
write: owner only, validated key set (testResults: ≤8 keys, `logic`
immutable to clients; the non-logic values are client-written and
shape-unvalidated, so every cross-user reader parses them defensively —
data/similarity.ts parseTestResults is the reference). `fcmTokens` is
GONE from this doc — push tokens live at v2_users/{uid}/push/tokens,
server-only both ways

v2_users/{uid}/answers/{qid}
  qid (== doc id), surface, optionIdx, answeredAt (request.time),
  anchors (snapshot at answer time — public since D98, and deliberately:
    a cohort chip beside a name reads off this, never off the live profile).
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
    Rank questions (bank type "rank" — D233) store `order` in place of
    optionIdx: the item indexes in the answerer's sequence. Rules bound
    the list's SIZE to the question's own item count and refuse a plain
    optionIdx on a rank question (the D12 side door); the trigger
    validates the ELEMENTS (a permutation of 0..n-1, validRankOrder) and
    a malformed order never aggregates. No optionIdx alongside — a
    synthetic index would leak an order into option-shaped folds.
create: owner, validated (question must exist; optionIdx < options.size())
update: owner, ONE shape (D86) — optionIdx moves (+ editedAt ==
request.time), on surfaces daily|feed|test only, bounded by the
question's options, once per 60 s per answer. Everything else is frozen:
anchors and answeredAt (the cohort stamp, D8), learn (D32's
first-attempt measurement), duels (the seal), catalog answers (no canon
delta path), rank answers (no order delta path — D233). The aggregate stays a plain fold because onV2AnswerUpdated
applies the matching -old/+new delta with the total unchanged — the
reconciliation D5 avoided now exists, in one trigger, ledger-deduped.
Since D226 the same trigger also counts the move itself into the
aggregate's public `edits` matrix (below); the answer doc is unchanged
and the client-writable surface does not widen
delete: nobody
read: any signed-in user, EXCEPT duel answers (surface group/duo), which
stay sealed until their reveal — a `surface` value test on the read rule.
Game timing, not privacy. Cross-user reads go through the collection-group
grant `match /{path=**}/answers/{aid}` and must carry a matching
`where("surface","in",[…])` or Firestore refuses the query wholesale (D65)

v2_aggs_private/{qid}              the CATALOG fold's accumulator (no readers).
                                   Vote, edit and rank answers write no
                                   document here at all any more: the
                                   published doc is their accumulator, and
                                   this one held a byte-identical copy of it
                                   until that collapsed
  ent { entity: n }                catalog questions: per-entity counts
                                   in place of counts — bounded by the
                                   catalogue's ~1k keys, so D7's
                                   document arithmetic is unchanged
  entBy { dim: { bucket:           catalog questions: per-entity anchor
           { entity: n } } }       slices (D17), the vote fold transposed
                                   with its own per-cell entity cap (32)
                                   on top of the bucket cap
  pos [ int ], total               rank questions (D233): per-item
                                   position sums in place of counts —
                                   pos[i] is the summed 0-based position
                                   of item i, fixed-length at the item
                                   count, no by map (nothing reads a
                                   rank breakdown yet)
  by { dim: { bucket: {opt:n} } }  per-anchor slices, exact (see D8).
                                   Lives HERE, in the doc the trigger
                                   already writes, so D7's ~1 write/sec
                                   per document is unchanged. Bounded:
                                   low-cardinality anchors only and ≤24
                                   buckets/dim. `city` is a dim since D9
                                   (a closed catalogue); `profession` is
                                   not and cannot be — the pick list is
                                   longer than the cap — so D328 buckets
                                   its derived `jobField` instead.
v2_agg_events/{eventId}            trigger ledger (opaque), four jobs (D28, D268)
  { qid, uid, optionIdx?, at,      dedup: at-least-once delivery can't
    expireAt }                     double-count. Attribution: uid is what
                                   lets an operator subtract a discovered
                                   fake-account ring from the exact counts
                                   and republish (DEPLOYMENT.md,
                                   "Correcting aggregates"). Vote log:
                                   optionIdx (vote and edit arms only —
                                   an edit records the NEW side) is what
                                   the nightly Patterns fit reads as its
                                   stream (patterns.ts); it adds nothing
                                   the answer doc does not publish (D98).
                                   Activity log: the nightly engagement
                                   digest counts people by it — the
                                   fourth job, the purpose D268 widened
                                   D28's list to grant (engagement.ts).
                                   TTL'd at 90 days
                                   (LEDGER_RETENTION_DAYS); a uid's
                                   entries are erased with the account
v2_question_aggs/{qid}             the PUBLIC mirror, EXACT (D98)
  { counts, total }                rewritten on EVERY answer. No
                                   `tooSmall`, no AGG_MIN_N, no
                                   PUBLISH_EVERY — the floor, the cadence
                                   and complementary suppression are all
                                   gone, because the answers these are
                                   folded from are themselves readable.
                                   Still no fresh timestamp, and now for
                                   a plain reason: it would wake every
                                   client's onSnapshot for a field none
                                   of them render
  by { dim: { bucket: {opt:n} } }  the complete breakdown — every cell,
                                   every bucket, every dim, at any size.
                                   An absent cell is ZERO, not withheld.
                                   Includes the political items, whose
                                   D44 carve-out D98 reversed (D8)
  { total, pos }                   rank questions (D233): the position
                                   sums published whole — the client
                                   derives the crowd order by ascending
                                   mean position (deck.ts rankCrowdFor),
                                   subtracting the viewer's own folded
                                   order first
  edits { from: { to: n } }        the edit-flow matrix (D226): every D86
                                   edit counted from → to. MOVES, not
                                   people — one person editing twice
                                   leaves two cells. Absent until a
                                   question has ever been edited; both
                                   answer branches carry it through their
                                   whole-doc rewrites (v2.ts), and the
                                   e2e's 7f step is what proves the carry
  { total,                         catalog questions: the canon — the top
    top {entity:n}, rest,          CANON_TOP_N entities, everything else
    by { dim: { bucket:            summed into `rest`. `canonTopN` is a
      { entity: n } } } }          DISPLAY cap now, not a floor: no
                                   below-floor drop, no boundary-tie
                                   fold, no lone-hole fold. `by` (D17)
                                   holds each segment's ordering of the
                                   board's OWN entities — cut to the
                                   board only to bound the document
  duel-{qid} ids (D40 part 3):     the duel signal — written at reveal
  { plays, total,                   time (foldDuelSignal), summed across
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

v2_ads/{id}                        a feed ad (D197) — path 3, NOT path 2
  advertiser, headline, body       text only. No image, no logo, no brand
                                   colour, no link — check:content refuses
                                   each BY NAME on the source entry
  until                            the UTC day it stops being served, the
                                   same field and filter feed questions use
  audience? {dim: bucket}          at most ONE, from the published
                                   breakdown dims, matched ON THE DEVICE
                                   (data/sponsored.ts). The server is never
                                   asked who should see what
  from?                            D315: a self-serve ad queued behind the
                                   scope's running one starts later than it
                                   was paid — pickPaid holds it until this
                                   day, the exclusivity its flat price buys
  active?, seq, updatedAt
read: signed-in · write: nobody client-side (the seed, and since D315 the
payment webhook at paidad-* ids). An ad takes no answer, so there is no
answer arm for it anywhere in firestore.rules, no aggregate keyed to it
and nothing per-person in it — which is why deleteAccount has nothing to
reach here. The seed DELETES what the bank no longer names, unlike
v2_questions — but SPARES paidad-* ids, whose retirement belongs to the
daily closer (their pen), at window end.

v2_call_outcomes/{qid}             a graded Foresight CALL (D194)
  outcomeIdx: 0|1|-1               the winning option, or -1 for VOID:
                                   nobody scored, and `note` says why
  resolvedAt, resolvedBy           server clock; "auto" for a grade the
                                   rubric produced, a uid for a hand
                                   resolution
  inputs {qid,total,counts,cells?} WHAT THE GRADER SAW — the aggregate,
                                   narrowed to the cells the rubric read.
                                   Without it the outcome is an assertion;
                                   with it the DEVICE re-runs the same
                                   arithmetic (data/callRubric.ts, held
                                   byte-identical to the resolver's copy
                                   by check:calls) and the card prints
                                   whether the two agree
  note?                            required on a void
read: signed-in · write: NOBODY — a client-writable outcomeIdx would make
every score in the feature forgeable in one request. Existence is
load-bearing too: firestore.rules refuses a call answer once this document
exists, or a player reads the grade and then "predicts" it.

v2_patterns/loadings               the Patterns fold (v28 §2, trial D166 §1)
  k                                the vectors' length (8)
  q {qid: {v: number[k], n, sum}}  one loading vector per CORE two-option
                                   question (D161 — the eligible set
                                   compiles from the bank): the streaming
                                   fit's factorisation of the vote log.
                                   n is the answers folded (the basis a
                                   client states or refuses on); sum/n is
                                   the running marginal the fit centres
                                   by — the same figure the question's
                                   public aggregate already carries
  lastDay, folded, at              the last UTC day folded (idempotence),
                                   the last run's fold count, server clock
read: signed-in · write: NOBODY — written once per night by fitPatternsV2
(admin SDK), so D7's per-document write ceiling never hears about it. The
device derives everything else: sim(i,j) is a cosine over two vectors,
position seeds from the first two components, hub-ness is the norm.

v2_users/{uid}/patterns/state      the fit's per-person carry (v28 §2)
  v: number[k], n, at              the latent vector the nightly fold
                                   carries this person's PUBLIC answers
                                   as, and how many it has folded
read: NOBODY · write: NOBODY — the push/ shape; fitPatternsV2 (admin SDK)
writes it, deleteAccount's recursive delete erases it with the account.

v2_engagement_daily/{day}          the engagement digest's trail (R1/D268)
  day, actives, firstTime,         one doc per UTC day: distinct answering
  votes, events,                   accounts, first-timers, deduped
  bySurface {surface: n},          (uid,qid) pairs vs raw ledger events,
  returned {d1,d7,d30:             pairs per surface, and signup-cohort
    {returned, of|null}},          returns — `of` is the cohort day's
  streaksBroken, foldedAt          firstTime, null when that day was
                                   never folded (absent ≠ zero). Plus the
                                   fold's own `meta` cursor doc {lastDay}
  attn {devices,                   D270: the shard fold's sums — per
    s {key: {reach, est}},         feature, devices that used it (reach)
    q {qid: {s|a|p|d:              and a bucket-midpoint estimate (est),
         {reach, est}}},           both scaled by the sampling rate.
    qOther}                        D271 adds the per-question map (seen /
                                   answered / passed / deferred) with the
                                   clients' overflow cells counted apart
                                   as qOther — truncation, never a
                                   phantom qid. Merged additively as late
                                   shards arrive; a doc holding only attn
                                   (its day predates the digest's
                                   catch-up) has no `actives`, and
                                   readers treat that as not-digested,
                                   never as zero
  people {rollups, sessions,       D272: the rollup fold's counts of
    quiet, answers, depthEnd,      PEOPLE — how many rollups folded, the
    fading,                        sessions and quiet sessions they held,
    dayparts {d0..d3},             how many hit the feed's end, how many
    fgBuckets {b0..b4}}            trailing foreground windows are
                                   SINKING (fading — the win-back
                                   trigger), dayparts and foreground
                                   brackets as histograms. Maps rather
                                   than lists because increments need a
                                   field path
read: signed-in · write: NOBODY — written once per night by
digestEngagementV2 (admin SDK). Counts only; no uid, name or anchor
anywhere in it, so deleteAccount has nothing to reach here.

v2_attention/{randomId}            rung 1's anonymous device shards (D270)
  day, build, platform,            one CREATE-ONLY doc per sampled device
  sampled, rate,                   per FINISHED UTC day: bucketed feature
  s {key: 0..4},                   counts (the vocabulary lives in
  qids? {qid:                      src/v2/data/engagement.ts and the
    {s|a|p|d: 0..4}}               rules' field whitelist — the pair is
                                   held equal by hand and by the rules
                                   suite), plus build/platform/rate. The
                                   `qids` map (D271) is capped at 120
                                   keys INCLUDING the client's `_other`
                                   overflow cell, so the cap is honest
read: NOBODY · update/delete: NOBODY — the fold deletes on the admin SDK
as it sums (fold-and-delete, asserted by test). A random id per write and
no uid anywhere: two days from one phone are not joinable, which is the
channel's whole contract (ENGAGEMENT-PLAN §4.1) — and it is what makes
the qids map counts about QUESTIONS rather than anyone's reading list.

v2_users/{uid}/engagement/{day}    rung 2's person rollup (D272)
  day (== doc id), sessions,       one CREATE-ONLY doc per account per
  fgMin 0..4, quiet,               FINISHED UTC day: sessions, the
  dayparts [4 ints],               foreground-time BRACKET (never
  answers, feedB 0..4,             minutes), quiet sessions, local
  depthEnd 0|1, stops,             dayparts, answers, the feed-depth
  lenses, folded, build,           bracket and reached-the-end bit, stop
  platform, expireAt               and lens counts. `folded: false` at
                                   birth; the fold flips it (admin SDK) —
                                   the flag is what makes the sweep
                                   exactly-once, and the collection-group
                                   index on it is a fieldOverride in
                                   firestore.indexes.json
read: NOBODY — the owner included (the push/ posture: measurement, not a
profile surface; what publishes is `people` counts on the day doc).
update/delete: NOBODY client-side; expireAt powers the 90-day TTL
(SHIP-CHECKLIST §5), and the account's erasure takes the subtree
(asserted in e2e-delete-account.mjs). THE hasOnly IS THE TWO-CHANNEL
PIN: no qids, no question id, no reading history on any uid-keyed path.

v2_users/{uid}/engagement/_state   the digest's bookkeeping pair (D268)
  firstDay, lastDay,               when this account first and last
  activeDays, streak,              answered, distinct active days, the
  fg7 [≤7 ints]                    consecutive-day streak — and, D272,
                                   the trailing window of foreground
                                   brackets the rollup fold advances;
                                   "fading" (a window sinking two
                                   brackets) is read from it
read: NOBODY · write: NOBODY — the push/ shape again; digestEngagementV2
(admin SDK) writes it, deleteAccount's recursive delete erases it with
the account. The `_state` id deliberately fails the date-shaped id the
rung-2 create arm admits, which is what keeps it server-only under the
same match block.

v2_avatars/{uid}                   the profile photo's document (D178)
  token: "…"                       the Storage download token for
                                   avatars/{uid}. NOT a URL: the client
                                   builds the URL around it, so this field
                                   can never name a host we do not control
                                   (rules pin the charset — no dot, colon
                                   or slash)
  at: request.time                 when it was set
  hidden: false                    the server's word, never a client's.
                                   True after a remove verdict, and then
                                   the doc takes no client update AND no
                                   client delete — both are the way back
  hiddenMeta?: {by, policyLine,    the appeal's annotation, exactly a
    runId, at}                     take's shape (D22/D65)
read: any signed-in user · create/update/delete: owner only, and refused
outright once hidden. The BYTES live in Storage at avatars/{uid}, one
object per account at a fixed id so the count is bounded by accounts
rather than by uploads. deleteAccount removes both halves.

v2_presence/{uid}                  Near-by-radius presence (D84)
  cell: "la_lo"                    a ~200 m 0.002-degree grid id (D175;
                                   0.01° ≈ 1.1 km before it), computed
                                   ON DEVICE from a precise fix whose
                                   coordinate is discarded (data/locate.ts)
  at: request.time                 last write; the beat refreshes it
  until?: timestamp                when this position STOPS counting
                                   (D174) — the linger for the standing
                                   option, the session deadline for the
                                   timed one, whichever is sooner. The
                                   count filters on it, and the rules cap
                                   it at PRESENCE_LINGER_MIN so no client
                                   grants itself a longer stay. OPTIONAL
                                   for one release (D179): the build that
                                   predates D175 writes no `until`, rules
                                   deploy on merge and apps do not, and
                                   the server reads a missing one as `at`
                                   + the linger and backfills it
  type?: "Host"                    optional: the writer's OWN Big Five
                                   archetype NAME (D176), ≤40 chars. The
                                   phone writes it because the archetype
                                   table lives on the device — this is
                                   the only thing the room's mix folds
                                   from, so the server never joins a
                                   profile and never scores anybody
read: NOBODY (the only read path is nearbyCountV2, which returns a count
over the 3x3 neighborhood, caller excluded, plus a coarse mix of names) ·
create/update/delete: owner only, shape-checked — the cell regex in the
rules is the precision cap in structural form. Opting out deletes the
doc; deleteAccount does too.

v2_presence_mix/{cell}             the room's folded reading (D176)
  top: ["Host", "Explorer"]        archetype names in rank order. NEVER a
                                   share beside a name — a percentage of
                                   a dozen people is a headcount wearing
                                   a disguise
  n: 11                            how many TYPED phones it was folded
                                   from; below ROOM_MIN_TYPED there is no
                                   reading and the refusal itself is
                                   cached, so a quiet room folds once
  at: timestamp                    written at; re-folded past the beat
                                   window, served from here inside it
read/write: NOBODY. Written by nearbyCountV2 on the admin SDK. Derived
from presence, so it carries presence's deny: a client reading a cell it
is not standing in has a map of every room, not a reading about its own.

v2_presence_room/{cell}            the room, folded (D177)
  people: [{uid, type?}]           the sampled roster, <= ROOM_PEOPLE_CAP.
                                   `type` is the archetype the phone wrote
                                   for itself; absent for an untyped phone
  qs: { qid: {optionIdx: n} }      option counts over exactly those
                                   people, in v2_question_aggs' own shape.
                                   Accumulated per qid INSIDE a window and
                                   replaced wholesale when the window
                                   turns, so a stale split is never
                                   republished under a fresh stamp
  at: timestamp                    written at; one beat window
read/write: NOBODY. Written by nearbyRoomV2 on the admin SDK, which
refuses any caller without a live position of their own in that
neighbourhood — the gate is what makes a roster defensible, and a
readable cache would route around it. THE ONE DERIVED DOC THAT HOLDS
UIDS: deleteAccount drops it alongside the leaving account's presence
doc, so an erased account is not left listed in a room.

v2_groups/{gid}                    groups AND duos (mode: group|duo)
  name, mode, ownerUid, memberUids[≤32; duo ≤2], memberNames{uid:name},
  memberJoinedAt{uid:ts},
  inviteCode, streak, lastRevealDay, pendingDays[≤6], createdAt,
  duoMode? (duo docs only: friends|romantic — which 1v1 pool duelQFor
  serves the pair; absent = friends. D40 part 4)
  (memberNames rides on the group doc as a denormalization: it used to be
  because profiles were owner-only, and since D98 it is purely to save
  one profile read per member on every group render;
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
  day, qid, votes { uid: {optionIdx, guessIdx?, pickUid?} }, names, members[], revealedAt
  (pickUid — pick days only, D224: WHO the vote's optionIdx meant, in the
  roster order the answering client used; the index alone is remapped by
  any join/leave. Absent in reveals older than D224)
  (members is the membership snapshot the read rule USED to gate on — not
  the parent group's current roster, which is what kept the guarantee
  retroactive: D5's amendment. D98 retired the gate, not the field: it is
  still the members who were in the group ON `day` rather than at reveal
  time — the two differ by up to one scan interval, and the difference was
  a joiner reading the previous day, D55 §9 — and it is still what
  `deleteAccount` scrubs and what the reveal's names are drawn against)
read: any signed-in user (D98 — the votes inside are world answers'
younger siblings, and this is their only public copy, since the sealed
answers themselves stay owner-only) · write: nobody (D5)

Sealed duel answers live in the same answers subcollection as everything
else, under composite ids (g_{gid}_{day}) with extra fields
gid/day/guessIdx (plus pickUid on a "pick" day, D224 — a current member's
uid, rules-validated) — and they are the ONE surface the D98 public read
excludes, as a `surface` value test rather than an owner-only path. That
is the seal: the owner still reads their own, nobody else reads any, and
the reveal doc publishes the whole table the next day. Rules require
membership and deny creates once the day's reveal exists. Duel surfaces
are excluded from world aggregates.

v2_takes/{takeId}                  comments on a question — circle or world,
                                   NAMED at both scopes since D98
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
in firestore.indexes.json, declared ahead of the UI that will want it.
(`src/v2/data/indexes.test.ts` is the live account of which query shapes
resolve against that file — this sentence used to add "the only entry in
that file's `indexes` array", which stopped being true at the second one.)
(deleteAccount erases a user's takes and flags by uid query)

v2_flags/{takeId}_{uid}            one flag per (take, user), write-only
  takeId, gid, uid, at             anonymous to everyone AND the
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

v2_paid_bookings/{uid_ts}          a self-serve paid-question sale in
  prompt, type, options, topic,    flight (paid.ts, D313). status walks
  scope, dims (≤3, D228),          review → approved|declined → live:
  wearName, buyerName?,            the automated review (gates + model)
  status, note?, review?,          settles it, `quote` locks the rate ×
  quote?, window?, qid?,           idx off the committed card at
  stripe?, stripePaymentIntent?,   approval, and the payment webhook
  reviewAttempts, createdAt        stamps live + window + qid in the
                                   same transaction that writes the
                                   purchase and the question
read: the buyer (uid == auth.uid) · write: nobody (server pens only —
the callable, the review trigger/sweep, the webhook)

v2_purchases/{uid_bid}             one row per completed sale (PAID-PLAN
  uid, kind, qid, prompt,          §7 shape) — written by the payment
  options, scope, place, dims[],   webhook (D313; ad sales D315) or the
  window{start,until}, cadence,    operator's record-purchase.mjs for hand
  budget{cap,capEur,rate…},        contracts; closePaidCampaignsV2 marks
  state, reports[], closed?,       `closed` with the answer count and the
  stripePaymentIntent?             refund it executed. A kind:"ad" row
  — ad rows: adId, advertiser,     carries the flat `priceEur` and its
  headline, body, priceEur         paidad-* id instead of qid/budget —
                                   no meter, no refund, and the closer
                                   also deletes its v2_ads doc at close
read: the buyer (uid == auth.uid) · write: nobody client-side
```

## Functions

- `seedContentV2` (callable; emulator or SEED_ADMIN_UIDS allowlist) — mirrors `/content` question banks
  into `v2_questions` (845 docs, stable ids `daily-000`, `feed-<id>`,
  `pick-<id>`, `group-<id>`, `duo-000`, `test-<key>-NN`; idempotent merge; `active` written only on first create, preserving the
  operational kill switch). Bank source:
  `functions/src/v2content.ts`, generated from `/content/*.json`.
- `onV2AnswerCreated` (Firestore trigger, retry on) — transactionally
  folds each answer into `v2_question_aggs`, the published doc itself
  (a catalogue pick also accumulates into `v2_aggs_private`, where the
  full entity map lives behind the board's top-N);
  idempotent via the `v2_agg_events` ledger (at-least-once
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
- `resolveCallsV2` (scheduled, 04:23 UTC daily; D194,
  docs/FORESIGHT-CALLS.md) — grades every tier-A call past its
  `resolvesAt` by EXECUTING the call's own rubric against
  `v2_question_aggs`, and publishes the counts it read beside the
  outcome. No model, no fetch, no judgement in that path. It never
  guesses (an undecidable rubric returns null and the call waits), never
  grades early (UTC day keys), never rewrites an outcome (the write is
  `create`-shaped) — and after `CALL_VOID_AFTER_DAYS` of failing to
  execute it writes a VOID rather than leaving a guess in the air, which
  is safe precisely because a void asserts nothing.
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
  patternsPool   questions the nightly fit has fitted on `patternsBasis`
                 answers or more — the crowd half of the Patterns tab's
                 mount gate (D265). Written by fitPatternsV2, merged, and
                 the only field here the SWEEP owns (contentRev is the
                 seed's); it lives on this doc rather than on
                 v2_patterns/loadings so a client can read it without
                 fetching ~11 KB of vectors it may never draw
  patternsBasis  the floor that count was taken at, published beside it
                 so the number says what it means — the client refuses a
                 count taken at a looser floor than its own
read: signed-in · write: nobody
```

## Read economics (client)

A live boot costs ~20 reads, not ~380: one `v2_meta/app` read decides
everything. The question bank (845 docs) caches in localStorage keyed by
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
  Live cards show takes — named at both scales since D98, which is the
  same reversal the rest of this bullet describes — and DO show who-voted, by name, from the collection-group
  read D98 opened (`data/voters.ts`, `ui/LiveBreakdownPanel.tsx`'s
  Friends cut and `ui/LiveTakesPanel.tsx`'s side badges, capped at
  `VOTER_FETCH_CAP`). The per-anchor breakdown beside it is exact per
  cell with no floor. This bullet used to end "carrying no names, which
  is 'the split, the totals' D1 allows" — that was D1's read arm, which
  D98 reversed; what survives of D1 is the ban on fabricating people, not
  on naming real ones.
- Auth: `anonSignIn()` / `linkGoogle()` in the firebase layer — Google is
  an account *upgrade* (linking keeps the uid and all answers).

## Verification

- `npm run test:rules` — 175 rules tests (Firestore + Storage; the v2
  surface, the anonymous-default lens, and the retired-v1 guard).
- `firestore-tests/e2e-v2-loop.mjs` under
  `firebase emulators:exec --only auth,firestore,functions` — the full
  SDK loop: anon auth → seed → fetch → vote → exact first publish →
  dup refused → five voters, exact public counts →
  per-anchor breakdown withheld while every cell is sub-floor, then
  published at 5/5 → an 11th answer does not move the mirror off 10 →
  duo create/join-by-code → sealed answers → reveal with votes+guesses →
  streak → non-member refused → post-reveal answering refused by a real
  member → no aggregate leakage.
- `npm run test:e2e:erasure` — deleteAccount, with leftovers observed via
  the admin SDK (rules bypassed, so "gone" means gone rather than
  "permission-denied").
- `npm run test:unit` / `npm run test --prefix functions` — the deck
  rotation and vote state machine; the aggregate fold, reveal and streak math.

**What is NOT covered: rendering.** There is no browser-level test, and no
Playwright — this section previously claimed such a suite existed, which
was the worst kind of documentation defect: a verification gate that
provides no verification. The underlying properties it named are covered
elsewhere — the vote → trigger → exact publish path by the e2e above,
and the S-form's empty comments array (D1) by `deck.test.ts` — so the real
gap is narrower than that bullet implied, but it is a gap: nothing asserts
that a component renders.

Sandbox note: run emulator commands with `HTTPS_PROXY` unset —
firebase-tools routes even localhost HTTP through a proxy dispatcher when
it is set, and the egress gateway denies it.
