# What InSight costs to run

The arithmetic behind the bill, at five sizes. Written 2026-08-01 against
`08ac631`, before launch, so every number here is a *prediction* — the
point is that it is a prediction with its inputs written down, so the
first real invoice can be diffed against it rather than merely survived.

Same discipline as D7: fix what breaks at any size, write down what breaks
at scale with its arithmetic, and do not build for it yet.

Reproduce with `node scripts/cost-model.mjs` (add `--multi-region` for the
counterfactual). Which price sheet is the default is **read from
`functions/src/db.ts`** rather than assumed, since D200. It prints every table below except the fixed
costs, including the read decomposition, the egress band and the crossover
the walls section quotes — the arithmetic lives in
`scripts/cost-arith.mjs`, which `scripts/pulse.test.mjs` holds to the tree.

This document answers *what will this cost*. It deliberately does not
answer *is that a lot*, because that needs a denominator the model cannot
supply — somebody else's invoice.
[`docs/COST-COMPARISON.md`](COST-COMPARISON.md) is that comparison
(`npm run costs:compare`), rating these same figures against Snap, Signal,
Wikimedia and a typical app on the same stack. Its finding is about shape
rather than level. When it was written the totals below were small and the
**cost per user rose 87× between 500 and 500,000 DAU** — the fan-out of
finding 2, seen from the unit-economics side. **D129 closed that**: the
rise is now 2.1×, essentially all of it the free tier at the small end, and
every scenario grades B against a same-stack peer where the range used to
run A+ through F. [`docs/COST-REDUCTION.md`](COST-REDUCTION.md)
(`npm run costs:levers`) prices what is left, and the largest remaining
lever is a console setting rather than any code on this page.

A third script answers a question this page does not: **`npm run
costs:scale`** prices a *change to the content pipeline* rather than the
app as built — what an order-of-magnitude increase in question production
costs, and (the finding) that bank SIZE bills nothing at all, because
D34's delta paging makes it a one-time install cost.
[`docs/SCALE-PLAN.md`](SCALE-PLAN.md) is the plan those numbers were
computed for. It is deliberately a separate table: mixing a hypothetical
into the as-built one below is how a prediction gets read as a
measurement.

## The unit economics, read out of the code

Every constant below is sourced, not assumed:

| Operation | Cost | Where it comes from |
| --- | --- | --- |
| One world answer | 1 client write + 1 server write (`v2_agg_events`) | `onV2AnswerCreated`, functions/src/v2.ts |
| …plus the published aggregate | +1 write **per answer**, always | no cadence since D98; it IS the fold's working document since the private mirror collapsed |
| …plus the ledger's death | 1 delete, 90 days later | `LEDGER_RETENTION_DAYS` |
| One duel answer | 1 client write + 1 `pendingDays` arrayUnion | v2.ts group branch |
| One trigger invocation | 512 MiB, 1 vCPU, concurrency 20, ~200 ms | `HOT_TRIGGER`, functions/src/ops.ts |
| One warm boot | ~15 reads (meta, profile, answers query, 7 deck aggregates, groups, 2 group docs, 2 reveals) | `hydrate()`, src/v2/data/live.ts. The deck reads are one batched fetch since D129, not seven listener attachments |
| One cold boot | **+764 reads** — the whole question bank | `V2_QUESTIONS`, 764 docs / 217.4 KiB of JSON |
| Agg top-up | ≤120 reads, ≤1 per qid per 6 h | `AGG_ID_CAP`, `AGG_RECHECK_MS` |
| One world answer, again | +1 **rule** read (the question doc) + 2 **server** reads (ledger event, private agg) | `isWorldAnswer` in firestore.rules; the `runAggTransaction` in v2.ts |
| One duel answer, again | +3 rule reads (group, reveal, question); the trigger's duel branch reads nothing | `isDuelAnswer`; "one blind write, no read" |
| One ledger entry | +1 read the night it is scanned | `ledgerVelocityScan`, functions/src/velocity.ts (D54) |
| One group-day reveal | `4 + 3m` reads for `m` members — 10 for a duo | `revealGroupDay`, functions/src/v2social.ts |
| One who-voted sheet | ≤200 answer reads + ≤200 profile reads (names), once per question per session | `VOTER_FETCH_CAP`, src/v2/data/voters.ts (D102 — was unbounded, ~DAU reads per open). "Per session" became true on 2026-08-13: `loadVoters` guarded only on the fetch being IN FLIGHT, so the panel's `[qid]` effect re-ran the whole thing on every open, and this row described an intention rather than a behaviour |
| One Kindred first view | ≤12 sheets' worth, shared with the sheet cache | `KINDRED_QUESTIONS`, src/v2/data/live.ts (D99) |
| One pulse open | **Today only: one `documentId() in` query over as many per-day agg ids as there are pulses** (≤5), once per UTC day per session — a same-day answer forces one refresh so the reveal's bins include you. The 21-day window is `ensureTrend`, one 21-id query, paid on the tap that opens a reading | `DAYS`, src/v2/data/pulse.ts (D139, roster D203). **Five pulses cost FEWER reads per open than one did**, and that is the point of the split: D139 fetched the whole 21-day window on every open although the card only ever draws today, so a naive ×5 would have been 105 ids — over the 30-clause `documentId() in` cap, hence 4+ queries per open for data the first screen never reads. The template read is gone too: `splitBanks` now keeps a pulse lane, so the roster's prompts come from the bank `hydrate()` already cached (it also means `active: false` finally reaches the client — before D203 a killed pulse still drew a tappable card whose every write the rules refused). Your own series still costs zero — derived from the hydrated vote mirror |
| One Roles tab open | Up to 14 day-key `getDoc`s per room, once per room per session — the SAME cache the duel panel fills, so a room you have already opened costs nothing here | `REVEAL_HIST_DAYS`, src/v2/data/live.ts (D156, D204). This is the first surface that wants EVERY room's history rather than the one you are looking at, so on a cold session it pays for the rooms you have not opened yet: ~14 reads each, loaded sequentially rather than in parallel so a profile tab does not spike the read rate. The fold itself is free — `data/roles.ts` is pure arithmetic over documents already in hand, with no new field and no new collection |
| One buyer's-room open | One `uid ==` list query over `v2_purchases`, sized by the buyer's own contract count — for almost every account that is zero rows, and for a buyer it is a handful | firestore.rules `v2_purchases` (D288 §3, PAID-PLAN §7). Session-cached like every owner list; the public split on each purchase card reads the sponsored question's own agg, which the feed already fetched. The pricing fold costs the SERVER nothing at runtime: `scripts/build-pricing.mjs` is operator-run at contract time, and the door reads the committed `content/pricing.json` |
| The Patterns fit, nightly | The day's ledger entries re-read as the vote log (the velocity scan's shape, second reader), one private state read+write per active answerer, one model doc read+write per project, one merged write to `v2_meta/app` (the tab's mount gate, D265) | functions/src/patterns.ts (v28 §2, trial D166 §1). Measured BEFORE the fold shipped — the dated note under the scenario table has the movement |
| The engagement digest, nightly | The day's ledger entries re-read a THIRD time as the activity log, one bookkeeping state read+write per active answerer, one public day doc per project | functions/src/engagement.ts (R1/D268). A separate scan rather than a rider on velocity's, deliberately — its header carries the windowing argument. Measured before the deploy — dated note below |
| One attention shard | 1 write the day after (the device's flush), then 1 read + 1 delete the night the fold sweeps it — per SAMPLED device per day, at the client's own `SHARD_SAMPLE_RATE` | src/v2/data/engagement.ts + the fold in functions/src/engagement.ts (R2/D270). The rate is read from source by the model (`ATTN_SAMPLE_RATE`), because it is the designed lever if this term ever matters |
| One person rollup | 1 write the day after (unsampled — the person channel), then the fold's 1 read + 1 folded-mark write + 1 fg-window read + write on `_state`; the TTL deletes it 90 days on | src/v2/data/engagement.ts + runRollupFold (R3/D272). Not deleted by the fold — the TTL is the deletion, and the flag is what makes the sweep exactly-once |
| One Circle open | 1 + one query per member: ≤50 members × ≤300 answers, +1 followers query | `FOLLOW_CAP` / `CIRCLE_ANSWER_CAP`, src/v2/data/circle.ts (D101). Also once per session since 2026-08-13, with `setFollowing` the one caller that may force a refetch — it changes the membership the fold is over |
| One takes panel | ≤100 world takes per question, ≤500 per group, once per scope per session | `TAKE_FETCH_CAP` / `TAKE_GROUP_FETCH_CAP`, src/v2/data/live.ts — both caps and the cache are new on 2026-08-13; the world query had no `limit()` and returned roughly everyone who spoke that day |

Note the shape of the third row. There is no "under the floor" any more
(D98 removed the floor and the cadence both), so the mirror is rewritten
once per answer at every size and the whole bank runs at a flat 3 server
writes per answer. The old shape — cold start costing *more* per answer
than maturity, because `{tooSmall: true}` was rewritten until the fifth
answer — is gone with the flag. Flat is easier to model and slightly
worse at volume: the cadence used to buy an ~80% cut in mirror writes
once a question matured, and that discount no longer exists.

## The bill, at five sizes

Behaviour assumptions (the soft numbers — stated, not buried): 4 world
answers (daily + feed + learn + the D139 pulse, which is world-shaped in
every charged pipeline) + 1 duel answer per active user per day, 1.4 app opens, 3 minutes
of open app plus 4 background→foreground cycles (which since D129 sets the
poll count and the foreground refreshes rather than listener-minutes),
concentrated in
D7's 4-hour morning window, MAU = 3 × DAU, one
reseed per week, and duels played in duos rather than larger groups — which
is the *worse* case per user, because a reveal's fixed reads divide across
the members it serves. Prices are Blaze at **`europe-west1`**, the single
region production has been on since D165; a multi-region database is
roughly double on the three operation lines.

| Scenario | DAU | reads/day | writes/day | Firestore $/mo | Functions $/mo | **Total $/mo** |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Launch / TestFlight | 50 | 10.2 K | 1.0 K | 0.00 | 0.00 | **0.00** |
| Friends-of-friends | 500 | 179 K | 10.1 K | 1.16 | 0.00 | **1.16** |
| Real traction | 5,000 | 2.2 M | 101 K | 23 | 0.00 | **23** |
| Scale | 50,000 | 22.4 M | 1.0 M | 255 | 2.20 | **257** |
| Hit | 500,000 | 224 M | 10.1 M | 2,568 | 43 | **2,611** |

> **Re-measured 2026-08-24: the private mirror collapsed.** The trigger
> wrote two aggregate documents per world answer — `v2_aggs_private/{qid}`
> and the published `v2_question_aggs/{qid}` — and since D98 removed the
> floor, the private one held byte-for-byte what the public one did on the
> vote, edit and rank paths. It is gone on those three; the published
> document is the fold's working document now, which it can be because
> `allow write: if false` leaves the trigger as its only writer. The
> catalog path keeps its own, where the accumulator is the whole ~1k-entity
> map behind a bounded top-N board.
>
> The write term in `scripts/cost-arith.mjs` goes `1 + 2 + pub` → `1 + 1 +
> pub` per world answer: **writes/day −16.5% at every size** (121 K → 101 K
> at 5 k DAU), **$262 → $257 at 50 k and $2,665 → $2,611 at 500 k**. Two
> percent of the bill, and worth saying why it is only two: reads dominate
> this model at every size, so a third of the trigger's writes is a small
> slice of a small line. What it buys beyond the money is a shorter
> transaction on the contended per-qid document — one less document under
> D7's ceiling, though NOT a higher ceiling, since both docs were keyed by
> the same qid and the transaction was already bounded by one of them.
>
> The model errs one write LOW on catalogue picks, which keep a second
> document: `B.worldAnswers` does not resolve them separately. That is the
> right direction to be wrong in on a slice this small, and it is stated
> rather than corrected because inventing a split would be a softer number
> than the one it replaced.

> **Measured 2026-08-19, BEFORE the fold shipped (VISION-V28 §11.4).**
> The Patterns fit (v28 §2, trial D166 §1) joined the model:
> `PATTERNS_READS_PER_LEDGER_ENTRY` and `PATTERNS_USER_STATE_OPS` in
> `scripts/cost-arith.mjs`. The nightly sweep re-reads the day's ledger as
> its vote log (the velocity scan's own shape, a second reader of the same
> entries) and carries one private state doc per active answerer — server
> reads 17 → 22 per user-day, one write per user-day, $247 → $251 at
> 50 k and $2,517 → $2,555 at 500 k (re-derived after the merge with
> D203, whose cost note keeps `worldAnswers` at 4). Deliberately NOT on the answer
> trigger: a read and a write on the app's hottest path would move
> `TRIGGER_READS.world` and D7's contention wall for vectors nobody needs
> in real time — a map redraws nightly. The named lever if the ledger
> re-read ever matters: flag eligible entries at write time and query the
> flag, dropping the term by the ineligible share.

> **The mount gate (D265, 2026-08-23) costs nothing on either side**, and
> that is the reason it is shaped the way it is. The fit's nightly run
> gains ONE merged write to `v2_meta/app` — one document per project per
> night, on a doc nothing else writes hot, so D7's wall never hears about
> it. The client gains no read at all: the count rides the `v2_meta/app`
> fetch `hydrate()` already pays, and the viewer's half is a walk of two
> banks the device is holding. The alternative — fetching the ~11 KB
> loadings doc at every cold start to decide whether to draw a BUTTON —
> is the read the bank cache exists to avoid, on every device including
> the ones that never open the tab.

> **Measured 2026-08-23, before the deploy.** The engagement digest
> (R1/D268, `docs/ENGAGEMENT-PLAN.md` rung 0) joined the model:
> `ENGAGEMENT_READS_PER_LEDGER_ENTRY` and `ENGAGEMENT_USER_STATE_OPS` in
> `scripts/cost-arith.mjs`. A THIRD nightly reader of the same ledger
> entries plus one bookkeeping state read+write per active answerer —
> server reads 22 → 27 per user-day, one more write per user-day,
> $251 → $255 at 50 k and $2,555 → $2,593 at 500 k. A separate scan
> rather than a rider on the velocity pass, deliberately: velocity's
> window is a cursor (lastScanAt → now, capped 72 h) and the digest's is
> the calendar day, and coupling the two semantics to save one read per
> entry per night is the wrong trade — the argument lives in
> functions/src/engagement.ts's header, where a revisit would start.

> **Measured 2026-08-23, same day, before the deploy.** Rung 1's
> attention shards (R2/D270) joined the model: `ATTN_SAMPLE_RATE` in
> `scripts/cost-arith.mjs`, read from the client's own
> `SHARD_SAMPLE_RATE` so the model tracks the lever rather than a memory
> of it. One anonymous shard write per sampled device-day, one fold read
> and one fold delete the night after — at the launch rate of 1: server
> reads 27 → 28 per user-day, one more write and one more delete per
> user-day, **$255 → $257 at 50 k and $2,593 → $2,613 at 500 k**. This
> is the term sampling exists to shrink: at 0.1 the whole addition is a
> tenth of these lines, and the shard carries its rate so the fold's
> estimates rescale with no server change.

> **Measured 2026-08-24, before the deploy.** Rung 2's person rollups
> (R3/D272) joined the model — `ENGAGEMENT_ROLLUP_CLIENT_WRITES` and the
> two fold constants in `scripts/cost-arith.mjs`: one uid-keyed rollup
> write per active device-day, the fold's two reads and two writes (the
> rollup's mark and the `_state` fg window), and a TTL delete 90 days on.
> Server reads 28 → 30 per user-day, three more writes and one more
> delete per user-day, **$257 → $262 at 50 k and $2,613 → $2,665 at
> 500 k**. This is deliberately the ladder's priciest rung per user —
> the person channel is unsampled by design — and it is still under 2 %
> of the bill at every size, because the bill is read-dominated and this
> channel adds no client reads at all.

> **The tab's client half (2026-08-19, same day)** adds reads too small
> for the model's terms, stated so nobody hunts for them later: ONE
> loadings-doc read per session (session-cached, absence cached too), and
> the pair card's exact 2×2 at two bounded voter queries (≤ 200 docs
> each) per FIRST tap on a pair — the strongest link only, session-cached
> per pair, silent under 12 shared voters. The Oracle adds zero reads: it
> folds the loadings doc and the viewer's own votes, both already on the
> device, and its votes go through the ordinary answer path.

> **Corrected 2026-08-18 (D200) — the region was already decided and this
> page had not heard.** D165 moved production to `europe-west1` on
> 2026-08-15. The model went on pricing `nam5` for three days, because the
> region was a DEFAULT PARAMETER (`costModel({ regional = false })`) with a
> comment beside it saying multi-region "is what prvfire33 is on" — so
> every row above was roughly double, and the pulse console published the
> doubled figure every morning. **$4,774 → $2,517 at 500 k, $472 → $247 at
> 50 k, $44 → $22 at the traction this app is planning for.**
>
> Nothing about the app changed and no estimate was revised: this is one
> input that had been true and stopped being, which is why it is worth more
> than the money. `check:figures` could not see it — it compares quoted
> figures against the tree, and a premise is not a quotation. The input now
> comes from `FIRESTORE_LOCATION` in `functions/src/db.ts`, the same file
> the backend takes the database from, and `scripts/pulse.test.mjs` pins
> the link both ways.
>
> **Figures further down this page are NOT all re-derived.** The scenario
> table, the walls and the levers move with the model on every run; prose
> that quotes a dollar figure inline was written against `nam5` and is
> marked where it matters. Halve an operation-priced figure and you have
> the current answer; `npm run costs` prints the real one.

> **D129 (2026-08-13) — the deck is polled, and this table changed shape
> rather than size.** The seven `onSnapshot` listeners are gone; the client
> reads the deck on boot and each foreground, then re-reads *today alone*
> once a minute while visible. The 500 k row falls from $194,332 to $4,448,
> and more usefully **reads/user/day are now flat at 416 at every size** —
> the decomposition has no DAU term left in it. What it costs: other
> people's votes no longer land on the card while you watch. Your own still
> confirms in ~2.5 s, which never depended on the listener.

> **Corrected 2026-08-14 (D139).** The pulse joined the budget —
> `B.worldAnswers` 3 → 4 — and every row above moved with it ($440 → $472
> at 50 k). Not a re-estimate and not a price change: a fourth
> world-shaped answer per user per day, charged through the same terms as
> the other three (1 rule read, 2 trigger reads, 1 velocity read, the
> answer + ledger + agg writes). The decomposition below moved the same
> way — rules 6 → 7, server 14 → 17, the social column's answer-scaled
> reads with them — and its flat total is now 435, which supersedes the
> 416 the D129 note above records.

The Firestore column includes network egress, which Google bills separately
but Firestore is what serves. It is the softest line here — see the band
below.


> **Corrected 2026-08-04 (D47).** This table used to charge every returning
> user a full 369-document bank refetch per reseed, which is the *pre-D34*
> world — and finding 1 below has said so in prose since D34 landed while
> these numbers went on describing the version it fixed. The model had no
> way to express the shipped state: its only reseed inputs were "whole bank"
> and "nothing", and D34 is neither. `B.changedPerReseed` (default 7, D30's
> promotion cadence) is that input, and the table above is its output.
> The old figures are not deleted — they are finding 1's arithmetic, which
> is still what justified the change.

> **Corrected again 2026-08-07 (D67).** Every row above went up by roughly
> half, and not because anything got more expensive. The model counted
> reads the CLIENT issues and nothing else — so security-rule `get()`s,
> reads issued by Cloud Functions, index storage and egress were all
> billed at zero. They are in it now. The correction is not a re-estimate:
> the two read terms are counts of call sites in the shipped rules file and
> the shipped trigger, and `scripts/pulse.test.mjs` carries tripwires that
> fail when either moves.
>
> This is the same failure as the D47 note above, one level out. That one
> was prose the arithmetic did not implement; this was a whole category of
> cost the arithmetic had no term for, which reads as "free" and is the
> most expensive way to be wrong.

> **Corrected 2026-08-12 (D102), twice in one pass.** First: every table
> here was still the *pre-D98* run. D98 set the publish cadence to 1 — the
> unit-economics row above said so — but nobody reran the model, so the
> fan-out column (which scales with publishes) sat at a fifth of its real
> value in every row: the old "Hit" total of $17,166 was really $60k+ the
> day D98 merged. Second: D98–D101 shipped three surfaces that read *other
> users' answers* on demand — named who-voted, Kindred, Circle — and the
> model had no term for any of them, which is the D67 failure recommitted
> the day after its note was reread. The `social` column below is that
> term, and its bounds are now pinned to source like DECK_DAYS
> (`VOTER_FETCH_CAP`, `KINDRED_QUESTIONS`, `FOLLOW_CAP`,
> `CIRCLE_ANSWER_CAP`). The voters cap did not exist until this pass:
> `fetchVoters` was the app's one unbounded read, ~DAU documents per
> sheet open. The bill below assumes the cap.

> **Corrected 2026-08-13 (D124), and this one went UP because it got more
> honest rather than because anything got worse.** The fan-out is linear in
> how long a listener stays attached, and until this pass *nothing bounded
> that*: `live.ts` tore listeners down on a uid change and on account
> deletion, and nowhere else, so a resident WebView kept receiving publishes
> for as long as the OS let it live. The model charged `onlineMin: 3` — a
> fair guess at how long someone looks at the app, and simply not the
> quantity Firestore was billing.
>
> The idle detach bounds it, and the arithmetic now says what it bounds it
> *to*: `onlineMin + bgCycles × grace`, plus `DECK_DAYS` re-attach reads per
> cycle (the new `reattach` column). At 4 background cycles a day that is 7
> listener-minutes, not 3, so the fan-out column roughly doubles and the
> totals move with it — **$46 → $59 at 5,000 DAU, $1,224 → $2,335 at
> 50,000**. The pre-detach code was not cheaper than these figures; it had
> no ceiling at all, and the old numbers were describing a best case as if
> it were the case.
>
> `bgCycles` is a guess and is the most leveraged one in the file now that
> the tail is closed. It is also the cheapest to settle: it is a question
> about how often a phone is picked up, answerable from a week of real
> usage.
>
> **This moves the wall ordering, and the direction is the bad one.** The
> read crossover is now ~14,145 DAU against D7's write-contention wall at
> 14,400 — the read line crosses *first*, by a margin well inside the error
> on a guessed input. See the walls section, which no longer claims the
> comfortable ordering.

Two things fall out immediately. **Compute is free and stays free** —
the trigger is 5 invocations per user per day at 200 ms, and Cloud Run's
free tier (180 k vCPU-s/month) covers ~900 k answers/month on its own;
even at 500 k DAU the functions bill is $43. And **reads still dominate
the bill at every size** — writes never exceed 3% of the total.

So the entire cost story of this app is *reads*, and reads have **seven**
sources. It said three until D67 (the three a client issues at boot and
idle), six until D102 — the seventh is the one D98 was for: clients
reading each other's answers.

## Where the reads actually go

Per active user per day:

| DAU | boot | agg top-up | reseed delta | poll | re-attach | rule reads | server reads | **D98 surfaces** | total/user |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 50 | 21 | 42 | 3 | 3 | 28 | 7 | 22 | 71 | 197 |
| 500 | 21 | 42 | 3 | 3 | 28 | 7 | 22 | 224 | 350 |
| 5,000 | 21 | 2 | 3 | 3 | 28 | 7 | 22 | **354** | 440 |
| 50,000 | 21 | 2 | 3 | 3 | 28 | 7 | 22 | 354 | 440 |
| 500,000 | 21 | 2 | 3 | 3 | 28 | 7 | 22 | 354 | 440 |

**Every column is now flat in DAU, and that is the headline.** The
`fanOut` column above is the poll (D129) — three reads a day, because the
client re-reads today's aggregate once a minute while visible, and nobody
else's behaviour appears in the expression. It used to read 1 / 15 / 146 /
1,458 / 14,583 down that column. `re-attach` (28) is now the second-largest
client term and the next one worth looking at; it is `bgCycles × DECK_DAYS`,
the whole-deck refresh on each foreground.

The paragraph below is kept as written, because it is what the table said
before D129 and finding 2 is the record of why it no longer does.

~~The fan-out is still the only source that grows without bound~~ — five
times steeper than the last run of this table, because D98 retired the
publish cadence that divided it. Everything else is flat in DAU,
including the new column: the **D98 surfaces** term is the largest read
source at every size below ~30 k DAU, and it goes flat at 200 DAU
because that is where `VOTER_FETCH_CAP` starts binding. Uncapped it
would scale with DAU — a second quadratic, which is what this pass
existed to prevent.

**Rule reads** (6). Every `get()` and `exists()` inside a security rule is a
billed read charged to the project, on top of the operation that triggered
it. A world answer's create rule touches one document (`v2_questions/{aid}`,
three times — repeats of the same document are free); a duel answer's
touches three distinct ones. Reads pay nothing: `v2_questions` and
`v2_question_aggs` are `allow read: if request.auth != null`, with no
document access at all, so this term scales with *answers*, not opens.

> Same-document repeats being free is measured, not assumed. Rules cap
> document accesses at 10 per single-document request; a probe rule doing
> fifteen `get()`s of one document passes, while eleven `get()`s of eleven
> documents is refused. The limit counts distinct documents, so the
> evaluator's cache is real — and it is the same cache billing sees. Counted
> un-deduped the figure would be 14 rather than 6.

**Server reads** (14). Three sources, none of them visible from the client:
the aggregate transaction reads two documents per world answer (the ledger
event for dedup, the private aggregate); the nightly velocity scan (D54)
reads **every ledger entry written that day**, which is one per world
answer; and the reveal pipeline reads `(4 + 3m)/m` per member per group-day,
which is 5 for a duo. The velocity scan alone is the size of the top-up and
the reseed delta put together, and it was invisible.

**The D98 surfaces** (339 at maturity). Who-voted sheets, Kindred and
Circle — one mechanism at three surfaces, a client reading other users'
answer documents on demand, which no read source above does. Charged per
*open*, so its soft inputs are open rates (`B.sheetOpens`,
`B.kindredViews`, `B.circleOpens` — guesses about curiosity, stated in
scripts/cost-arith.mjs), and its hard inputs are the four caps, pinned to
source. The decomposition at maturity: who-voted ≈ 60 (0.15 opens ×
200-voter page × 2 for names), Kindred ≈ 144 (0.03 views × 12 capped
lists × 2), Circle ≈ 135 (0.1 opens × 5 members × ~270 answers each).
The ×2 is the no-overlap ceiling on name resolution — crowds overlap and
names cache per session, so the steady state runs cheaper than this
column, which is the direction a prediction should err.

**What this does to the document's own claim about its shape.** The
sentence here used to read "below 50 k DAU the whole per-user read cost is
now the boot and the top-up — both flat, both cheap, neither worth
optimising." At 5,000 DAU the real decomposition is **social 339**,
fan-out 146, re-attach 28, boot 21, server 14, rules 6, reseed 3, top-up
2 — and the figure this document has quoted at that size has gone $7.26 →
$46 → $59 across three passes, without the app changing. The conclusion
survives at this size ($59/month is still nothing at real traction), and
what has changed twice now is *which* line is biggest and why.

`social` is still the largest single term below ~10 k DAU, and it is the
one a product knob moves directly. But the fan-out is no longer a distant
second: at 5,000 DAU it is 146 against social's 339, and it is the only
term that grows with the square of the population — so the two swap places
just past 10 k, and the walls section below is now about that swap rather
than about a comfortable gap.

## The egress band, and why it is a band

Firestore bills the bytes it serves, at Google Cloud's internet egress rate,
and the model charged nothing for them until D67. It counted document
*count* and never document *size* — which is exactly backwards for the
listener fan-out, whose every delivery ships the published aggregate whole.

The size of that document is the swing variable, and it is not knowable
before launch: a question nobody has answered with a filled-in Basics card
publishes a bare `{counts, total}` of a few hundred bytes, while
one with a full `by` breakdown carries 6 dimensions × up to 24 buckets ×
options (`BREAKDOWN_DIMS` / `BREAKDOWN_MAX_BUCKETS`, functions/src/pure.ts).

| DAU | 0.3 KB/agg | 2.4 KB (modelled) | 7 KB/agg |
| ---: | ---: | ---: | ---: |
| 50 | $0 | $0 | $0 |
| 500 | $0 | $0 | $0 |
| 5,000 | $0.73 | $2.93 | $7.75 |
| 50,000 | $46 | $266 | $748 |
| 500,000 | $3,303 | $25,306 | $73,502 |

The headline table charges the middle column. Two honest caveats: the price
($0.12/GiB) is one this project has never been invoiced for, and the whole
line only becomes material at a size where the fan-out itself is the thing
to fix — polling instead of streaming removes most of these bytes along
with most of the reads. It is in the model because "not modelled" reads as
"free", and free is the one thing it certainly is not.

### Finding 1 — the weekly reseed was the biggest line until ~50k DAU · **FIXED (D34)**

> Closed 2026-08-02. The seed now skips unchanged documents, `updatedAt`
> is a real cursor, and the client pages the delta instead of refetching
> the bank — a weekly promotion costs 7 reads per device instead of 369,
> so the 148 reads/user/day below becomes ~3. The rest of this section is
> kept because it is the arithmetic that justified the change.
>
> **The tables above now say ~3 too** (D47, 2026-08-04). For two days they
> did not: this note claimed the fix and the model kept charging 148,
> because `cost-model.mjs` had no input for "documents changed per reseed"
> — only whole-bank or nothing. A prose correction that the arithmetic
> beside it does not implement is the same failure `check:figures` exists
> for, one layer down. `B.changedPerReseed` is the missing input.


`runSeedV2` ends with an **unconditional** `contentRev` bump
(functions/src/v2.ts:159 — a `serverTimestamp()` written on every run,
whether or not any question changed). The client caches the bank keyed on
that value (`insight.bankCache.v1`), so a bump invalidates every device's
cache and each returning user re-reads all 369 documents.

At the launch plan's promotion cadence — one reseed a week — that is
`369 × 4/30 × 3` ≈ **148 reads per active user per day**, which is 70–80%
of all reads below 50 k DAU. It is pure overhead: the payload is 80 KiB of
static content that changed by perhaps 7 questions.

Worse, it is charged against *MAU*, not DAU. A monthly user who opens the
app once pays the full 369 reads for a bank they will barely use.

**What was done (D34).** Not the one-line hash that first suggested
itself — that only makes *no-op* reseeds free, and a weekly promotion is
not a no-op, so it would have left the 148 essentially untouched. The
change that actually pays is incremental: the seed rewrites only changed
documents, which makes the `updatedAt` it was already stamping mean
something, and the client asks `where("updatedAt", ">", cursor)` against
its cached bank. Seven changed questions cost seven reads.

**Still available, if it is ever worth it.** Serve the bank as a static
asset: 369 documents / 80.2 KiB is one gzipped JSON file on Hosting,
CDN-cached, one conditional GET instead of any billable reads. That
removes the cold-boot 369 as well as the delta — but the cold boot is
once per device, so it is now a rounding error. Deferred.

### Finding 2 — the deck listeners are quadratic in DAU · **FIXED (D129)**

> Closed 2026-08-13. `subscribeAggs` is gone. The client reads the deck on
> boot and on each foreground, then re-reads **today alone** once a minute
> while visible (`AGG_POLL_MS`, src/v2/data/live.ts). The term below —
> `DAU²/80` reads a day, 94% of the bill at the top row — is now 3 flat
> reads per user per day, and `src/v2/data/idle-detach.test.ts` proves the
> deck attaches no snapshot listener at all rather than merely few.
>
> **The saving is smaller than the lever analysis promised, because that
> analysis priced polling at zero.** `pollAggs` set both `fanOut` and
> `reattach` to 0 — D67's "not modelled reads as free", aimed at our own
> remedy, in the one term the whole argument rested on. Charged honestly
> the 500 k row is $4,448 rather than $1,664. `AGG_POLL_MS` is read from
> source like `IDLE_DETACH_MS`, and `pulse.test.mjs` pins that the polled
> term is non-zero and flat in DAU.
>
> The rest of this section is kept because it is the arithmetic that
> justified the change, and because the walls section below was built on it.


`subscribeAggs()` attaches an `onSnapshot` to each of the 7 deck days'
`v2_question_aggs` documents. The daily question is *globally shared*
(`computeDeckIds` takes no uid), which is exactly why a cohort fills
at ten users — but it also means every publish on today's aggregate fans
out to every client currently listening, and each delivery is a billed
read.

Publishes scale with DAU — since D98, one per *answer*, not one per five:
removing the cadence quintupled this term's slope, which is the single
biggest thing that happened to this document between D67 and D102. So the
fan-out is **DAU² / 80** reads per day: 625 reads per user at 50 k DAU,
6,250 at 500 k — 94% of all reads at the top row.

This is not urgent — see the wall ordering below — but it is the reason
the 500 k row is five figures rather than four. The fix when it matters is
to stop streaming and start polling: today's card needs a fresh count at
vote time and on a slow timer, not on every stranger's answer. That is a
display cadence choice, not an architectural one.

**The one input nobody has measured.** `onlineMin` (3 minutes of open app
per user per day, `scripts/cost-arith.mjs`) is what sets the concurrency,
and nothing in the code bounds it — no listener is torn down when the app
is backgrounded. The crossover below is linear in it, so a 5× error in that
guess moves the wall 5× closer. It is the most leveraged soft number in the
model and the cheapest one to find out: it is a question about behaviour,
answerable from a week of real usage.

### Finding 2b — the fan-out's input was bounded by nothing · **BOUNDED (2026-08-13)**

> The finding above prices the fan-out and defers the fix, which is right.
> This is the part that was not a scaling question at all: the term is
> linear in `onlineMin`, and until now **no code bounded that number**.

`B.onlineMin` is 3, and its comment used to read "minutes with the app
actually open". That is a fair estimate of human attention and it is not
what Firestore bills. What the fan-out charges for is minutes with a
**listener attached**, and the only two teardown sites in `live.ts` were a
uid change and account deletion — so a Capacitor WebView the OS kept
resident went on receiving, and being billed for, every publish to today's
aggregate for as long as it lived. The two quantities were equal by luck,
and on native they are exactly the ones that come apart.

Taken literally, with everything else in the model held still:

| listener-minutes/user/day | 5 k DAU | 50 k DAU | crossover |
| ---: | ---: | ---: | ---: |
| 3 (assumed) | $46 | $1,224 | ~30,800 DAU |
| 15 | $78 | $4,479 | ~6,150 DAU |
| 60 | $200 | $16,689 | ~1,540 DAU |
| 240 (a whole peak window) | $689 | $65,526 | ~385 DAU |

The right-hand column is the one that matters more than the dollars. At 60
the crossover falls **under D7's write-contention wall at 14,400**, which
inverts the ordering the walls section calls the property worth keeping —
the app is supposed to break technically at a size where the bill is still
small, so that no surprise invoice can arrive before a surprise outage.
This is the third time that ordering has been quietly inverted (D98 did it,
D102 restored it), and the first time the cause was not arithmetic but an
assumption about behaviour with nothing holding it up.

**What was done.** `IDLE_DETACH_MS` (60 s) in `src/v2/data/live.ts`: hiding
the app arms a timer, and the timer detaches exactly the set
`resubscribeForToday()` restores. Armed rather than run, because
re-attaching is not free — an `onSnapshot` attach delivers the document, so
coming back costs a read per listener, and `wake()` is written around the
ten-second app swap. Break-even is ~7 reads against the publish rate on the
shared daily (~21 reads/min at 5 k DAU, ~2 at 500), so a minute is the
right order at every size: the common swap stays free and the tail becomes
one minute per backgrounding instead of one OS eviction.

The number is read from source by `cost-arith.mjs` like `DECK_DAYS` and the
four social caps, and `pulse.test.mjs` pins the `setTimeout` call site as
well as the constant — a declaration nothing reads is a comment.
`src/v2/data/idle-detach.test.ts` is the first thing in this tree that can
tell an attached listener from a detached one; three of its six cases go
red if the arming is removed, which is how the claim above is measured
rather than asserted.

**This does not close Finding 2.** The fan-out is still quadratic in DAU
and polling is still the fix when it matters. What changed is that the
coefficient is now a number the code enforces rather than one the model
hoped for.

### Finding 3 — anonymous-first auth may be a per-install bill

D3 makes the app anonymous-first: `signInAnonymously` runs on first open,
before any consent, tap, or interest. Every install that reaches first
paint becomes an authenticated identity.

Whether that costs anything depends entirely on a console setting nobody
in this repo has recorded:

- **Firebase Authentication (no-cost tier):** unlimited anonymous and
  Google sign-in. $0 forever.
- **Identity Platform billing:** 50 k MAU free, then $0.0055/MAU tapering
  to $0.0032.

| MAU | Identity Platform |
| ---: | ---: |
| 15,000 | $0 |
| 150,000 | $505/mo |
| 1,500,000 | $6,015/mo |

**Go look at which one `prvfire33` is on before launch** — it is a
console-only fact, exposed on no unauthenticated endpoint, and it is now a
line item in SHIP-CHECKLIST §5 with the exact place to look. Same code,
same users, and a difference of $6 k/month at the top row.

Two pieces of evidence point at the free tier without settling it. The
upgrade is an explicit console action and **nothing in this repo's history
has ever taken it** — Identity Platform appears in no commit, and the
deploy workflow touches only rules, indexes, functions, storage and
hosting, never auth config. And the app uses **no Identity Platform
feature**: `signInAnonymously` and `GoogleAuthProvider` are the whole
surface — no phone/SMS, no SAML/OIDC, no MFA, no tenants. Neither fact is
proof, because the edition is a property of the project rather than of the
code, which is exactly why it has to be looked at rather than reasoned
about.

The counterintuitive part, if it *is* Identity Platform: bad retention
makes this line worse, not better. MAU counts everyone who opened the app
that month, so a 10% D1 retention curve means MAU ≈ 10 × DAU rather than
3 ×, and the auth bill triples while the product fails.

### Finding 4 — the D98 surfaces were unbounded and unmodelled · **BOUNDED (D102)**

> Closed 2026-08-12, the day after they shipped, which is the closest this
> document has come to catching the D67 failure before an invoice could.

D98's read path (`fetchVoters`) carried no `limit()`. The daily question
is globally shared, so a who-voted sheet on it reads the whole crowd: at
5,000 DAU that is ~5,000 answer documents plus up to 5,000 profile reads
for names — **~10,000 billed reads and a multi-second render for one
tap**, growing linearly with DAU forever. Kindred multiplied the same
fetch by twelve. Every sibling fan-out already had its bound
(`CIRCLE_ANSWER_CAP`, `FOLLOW_CAP`, `KINDRED_QUESTIONS`, `AGG_ID_CAP`);
this was the one that shipped without.

**What was done.** `VOTER_FETCH_CAP = 200`, inside the query, newest
first — and the sheet says "the latest 200 of N" when the cap binds
rather than presenting the slice as the room (the honesty rule, pointed
at truncation). Kindred inherits the bound per list: 12 × 200 is its
worst case, recency-biased, which is the right bias for a ranking drawn
from live lists. The model gained the `social` term the same day, with
the caps read from source and the open rates named as the guesses they
are.

**Also found under this stone.** D101's Circle query
(`where("surface", "in", …)` on one user's answers) needs the single-field
index D64's exemptions had deleted — `FAILED_PRECONDITION` in production,
invisible in every suite because the emulator does not enforce index
config, and swallowed per-member into an empty stop.
`firestore.indexes.json` re-enables `answers.surface` at COLLECTION scope
(ascending only), which costs one more index entry per answer write on
the hottest write path — accepted, it is what makes Circle exist — and
`src/v2/data/indexes.test.ts` now pins every data-layer query shape to
the index file so the next such gap fails in CI instead of in production.

**Still open, recorded not built:** `setFollowing` reloads the whole
circle (members × answer queries) to add one row — fine at 5 follows,
worth an incremental insert if circles grow; and a capped voters page has
a natural cursor (`answeredAt`) if anyone ever needs page two. Neither is
worth building before a user exists who would notice (D7's discipline).

### Finding 5 — the room's mix would have been quadratic in density · **CACHED AT BIRTH (D176)**

> Priced before it shipped rather than after, which is the whole point of
> this document existing. The number below is small; the shape it would
> have had is not.

D176 gives Near a reading — "mostly Hosts and Explorers" — folded from the
archetype names phones write into their own presence docs. A **count** is
an aggregation and costs ~1 read however crowded the cell is (Finding 2's
lesson, applied at D129). A **mix** needs the documents themselves, which
puts back exactly the linearity the count was rewritten to remove.

Every phone with Near on beats every 4 minutes, so an uncached fold would
charge `(phones nearby) × (beats)` — **quadratic in local density**, at a
festival, which is the one situation the feature exists for. At 1,000
opted-in phones open for an hour that is 15,000 beats × 60 sampled docs =
**900,000 reads, ~$0.54 for the hour**, and it grows as the square.

**What was done, in the same commit as the feature.** `v2_presence_mix/{cell}`
holds the folded reading for one beat window (4 minutes, matched to the
beat). Everyone standing in a cell wants the same answer, so it is computed
once per cell per window and read by everyone else in it. `ROOM_SAMPLE_CAP`
(60) bounds one fold besides. The same festival hour:

| | reads | writes | cost |
| --- | ---: | ---: | ---: |
| uncached fold | 900,000 | 15,000 | ~$0.54 |
| cached (shipped) | ~24,000 | ~15,150 | ~$0.04 |

The ratio is not the interesting part — **the exponent is**. Cached, the
fold term is `(cells) × (windows) × 60`: bounded by geography and clock,
flat in how many people are standing there. A stadium costs what a quiet
street costs, per cell.

**Two things named rather than fixed.** (1) A lone phone in its own cell
misses the cache on every beat, because the window and the beat are the
same four minutes — so it pays a cache write to store a refusal nobody
reads. At `onlineMin` = 3 that is well under one beat per user per day;
5,000 opted-in users would add ~5,000 writes/day, about **$0.01**. A
size threshold would fix it and would be an optimisation for a cost
nothing could notice (D7's discipline). (2) `n` saturates at the cap, so
past 60 it is a floor on the typed crowd rather than its size — the card
prints "60+" rather than presenting the slice as the room, which is
D102's repair to the who-voted sheet applied here in advance.

**Not in `scripts/cost-arith.mjs`, deliberately.** Near is off by default
and per-person opt-in, so there is no honest DAU multiplier to put in the
model — a guess at the opt-in rate would be the model's least-supported
input and its most leveraged. The bound above is the whole answer: this
term cannot grow faster than cells × time, whatever fraction opts in.

### Finding 6 — the room's tabs read a document per person per question · **CAPPED AND CACHED AT BIRTH (D177)**

> The same shape as Finding 5 one notch worse, priced the same way and for
> the same reason: the fold is new, so this is the cheapest moment to bound
> it.

D177 gives Near the tabs every other Mirror stop has — Answers, People,
Compare — over the people actually present. City and World fold those on
the device out of published aggregates; Near cannot, because its cohort is
a set of phones and `v2_presence` is unreadable. So `nearbyRoomV2` folds
them, and the fold reads **one answer document per person per question**.

Two caps bound one call: `ROOM_PEOPLE_CAP` (24) and `ROOM_QUESTION_CAP`
(8), so a cold fold is at most **24 × 8 = 192 reads plus one sample query**
— and 24 is one sample serving both the roster and the answers, because
People and Compare describing different crowds would be a worse bug than
either being small.

`v2_presence_room/{cell}` caches it for one beat window (4 minutes), **per
question**: a caller asking about a qid the cell has already folded pays
nothing for it. The day's deck is identical on every device
(`computeDeckIds` is a pure function of the day), so in practice the first
caller in a window pays for the whole thing and everyone else pays one
read.

| 1,000 phones, one hour, ~10 cells, tabs opened | reads | cost |
| --- | ---: | ---: |
| uncached (per viewer per beat) | 15,000 × 192 = 2,880,000 | ~$1.73 |
| cached (shipped) | 10 cells × 15 windows × 193 ≈ 29,000 | ~$0.02 |

**On a tap, never on the beat**, which is the other half. `LIVE.near.loadRoom`
runs from the tab body's mount, so a stop someone scrolled past costs
nothing at all — the same gate D119 put on the cohort stops' lenses. The
count and the mix keep riding the beat; only this waits to be asked for.

**What is NOT bounded, named rather than fixed:** the room fold is charged
per cell per window whether or not anyone opens a tab a second time, and a
venue spanning many cells pays per cell. That is linear in area, not in
crowd, which is the property worth having — but it means a festival
sprawling over fifty cells costs five times the ten-cell row above. Still
under a dime an hour, and the fix if it ever mattered is a coarser cache
key, which trades the reading's precision for cells it does not need.

### Finding 7 — the bucket stops being free · **BOUNDED BEFORE IT SHIPPED (D178)**

> This document has billed Storage at **$0 (bucket unused)** since it was
> written, and that line was true of the app's behaviour rather than of the
> rules — the note in `storage.rules` records the 2026-08-13 fix that
> closed an unbounded write grant nothing was using. D178 is the first
> feature that actually puts bytes in the bucket.

A profile photo is **the app's only egress path**. Everything else it
serves is Firestore documents; this is the one thing measured in
kilobytes, and Storage bills egress at ~$0.12/GB against Firestore's
~$0.06 per 100k reads — different units, and the reason it gets its own
finding rather than a line in the table.

Three bounds, all structural rather than advisory:

| | bound | where |
| --- | --- | --- |
| objects | **one per account**, fixed id | `avatars/{uid}` — a second upload overwrites |
| bytes each | **256 KB** hard, ~20 KB real | `storage.rules`; the uploader shrinks to a 256px JPEG first |
| reads | one per face drawn | `<img>`, browser-cached |

So stored bytes are `DAU × 20 KB` at full adoption — **1 GB at 50,000
accounts with a photo, ~$0.03/month**. Egress is the term that moves:
Near's People tab draws up to `ROOM_PEOPLE_CAP` (24) faces, so an opened
room is ~480 KB cold and ~0 warm. At 5,000 daily room-opens that is 2.4
GB/day ≈ **$0.29/day, ~$9/month** — the largest single non-Firestore line
in this document, and still an order of magnitude under the Firestore bill
at the same size.

**What is NOT bounded, named rather than fixed.** Nothing caps how often
one account replaces its photo, so a client in a loop could overwrite
`avatars/{uid}` continuously — bounded in STORED bytes (it is one object)
but not in write operations. It is a rate limit's job and there is no rate
limit; the ledgers in `v2_ratelimits` exist for exactly this shape and
adding one is a small change if it is ever needed. Recorded rather than
built, on D7's discipline: no user exists yet who would notice, and the
worst case is a bill line, not a leak.

**The CDN question, deliberately unanswered.** Firebase Storage serves
these directly, with no CDN in front. That is the right default at this
size — a CDN is a fixed cost and a cache-invalidation story, and a removed
face still cached at an edge is exactly the failure the moderation freeze
exists to prevent. It becomes worth revisiting when the egress line above
passes the Firestore one, which the arithmetic here says is a long way off.

## The controls that are not in this repository

Everything above this line predicts the bill. None of it **caps** the bill,
and the distinction is the whole difference between "expensive" and "out of
control". A prediction is only as good as the behaviour it assumed; a cap
holds when the assumption is wrong, which is exactly when you need it.

This document has been corrected four times (D47, D67, D102 twice), every
time because a term was missing rather than mis-estimated. The honest
reading of that record is not that the fifth correction has been found — it
is that a fifth one exists and the model is not the thing that will catch
it. What catches it is a control that fires on the *outcome* rather than on
the forecast.

There are four such controls, and when this section was written **not one
of them was observable from this repository** — no check, test or workflow
could see any of them, D117's checkbox problem pointed at money rather
than at deploys. Two have since come into reach: the budget (1) answers to
`budget:apply`'s dry run and the policies (4) to `npm run observe` (D303);
enforcement (2) and the auth billing mode (3) remain console-only. All
four stay written down here, with the arithmetic that says why each one
matters.

**1 · A Cloud Billing budget — EXISTS, since 2026-08-27.** "InSight",
**500 NOK/month** (the billing account bills in kroner; 500 NOK is this
page's $50 at ~10 NOK/USD, the same threshold in the account's own
money), thresholds at 50/90/100/150%, filtered to the resolved project
number. Without it the first notice of any of the failures this document
imagines was an invoice up to thirty days later. It sat undone for four
weeks for the D303 reason: the documented path was the gcloud one-liner
below, behind a login nobody had. `npm run budget:apply` (or the **Arm
budget** workflow, dispatched from the Actions tab) creates or retunes it
over the same REST credential every other operator script uses — dry-run
by default, idempotent by name, reading its figure from
`monitoring/rates.json`'s guard (`guard.budget` for the account-currency
figure the budget holds, beside the USD tolerance the pulse reds on) so
the budget and the pulse guard cannot drift apart. The one permission the
script could not grant itself — `roles/billing.costsManager` on the
**billing account** (a project role cannot satisfy it — budgets are a
billing-account resource), granted to the deploy service account, whose
email the refusal prints — was the five human minutes, spent 2026-08-27.
The first live run also found and closed a precondition this page did not
know: the Billing Budgets **API** was disabled on the project, a refusal
the script's own credential can fix (its `Editor` covers the enable —
done) and which the 403 branch now tells apart from the grant (D332 §3).
The dry run is the standing check, and against production it says
"exists and matches".

The by-hand alternative, unchanged except for one correction: the filter
takes the project **number**, not the id — `projects/prvfire33` matches
nothing, and a budget filtered to nothing tracks $0 forever and never
fires, which is this page's silent-checkbox failure on the control meant
to be the backstop. (The script resolves the number itself; that latent
miss is why it exists rather than a copy of this command.)

```
gcloud billing budgets create \
  --billing-account=<ACCOUNT_ID> \
  --display-name="InSight" \
  --budget-amount=50USD \
  --filter-projects=projects/<PROJECT_NUMBER> \
  --threshold-rule=percent=0.5 \
  --threshold-rule=percent=0.9 \
  --threshold-rule=percent=1.0 \
  --threshold-rule=percent=1.5
```

$50 is chosen against the table above, not by feel: the launch sizes model
at $0–$2/month and 5,000 DAU at $46, so $50 is "traction arrived, or
something is wrong", and the 150% rule still fires while the number is two
figures. Raise it when a row of the table becomes real, not before. (What
the budget actually holds is the 500 NOK `guard.budget` records — the same
threshold in the money the account bills, not a raise.)

**A budget notifies; it does not cap.** There is no spend limit for
Firestore — the only hard stop is a budget → Pub/Sub → function that
detaches the billing account, which takes the app down with it. That is a
real option and a deliberate one, not a default: for an app whose worst
modelled month at launch size is $2, an outage is the more expensive
failure. Recorded as available, not built (D7). Since D332 the same wire
has a softer target worth building first: the budget's Pub/Sub
notification flipping `budgetMode` (the read breaker below) instead of
detaching billing — recorded there, an evening's work once the budget
itself exists. And the repo side no longer waits for the invoice to ask
the question: the pulse's usage-vs-revenue guard
(`monitoring/rates.json`, the same $50) reds the daily run when the
modelled bill at the *measured* actives outruns recorded revenue.

**2 · App Check enforcement on the Firestore API.** SHIP-CHECKLIST's App
Check step 4, not yet flipped. The callables enforce attestation in
production and a gate proves it (`check:appcheck`) — but that gate covers
`onCall` functions, and **the client does not read through them**. It reads
Firestore directly, where enforcement is a console toggle nothing in this
tree can see.

What that leaves open is not a bug in the rules; it is what the rules say.
Since D98 answers are public, and `firestore.rules` grants any signed-in
account — including an anonymous one, minted for free on first open (D3) —
a collection-group read of every `daily`/`feed`/`test`/`learn` answer.
A security rule cannot rate-limit without a read, so there is no
rules-shaped fix and none should be attempted. `ledgerVelocityScan` (D54)
is detection and says so in its own header: "nothing here denies, delays or
down-weights a vote." Detection does not stop a bill.

The arithmetic, at the `europe-west1` read price of $0.03/100 k (D200 —
this table read $0.06 and double every figure until the model was pointed
at the region production is actually on):

| sustained read rate | reads/day | $/day | $/month |
| ---: | ---: | ---: | ---: |
| 500/sec | 43 M | $13 | $389 |
| 2,000/sec | 173 M | $52 | $1,555 |
| 10,000/sec | 864 M | $259 | $7,776 |

Halving the abuse ceiling is the one place this correction is worth
reading twice and then ignoring: $7,776/month of stolen reads is not a
better outcome than $15,552/month, and nothing about the defence changes.

The corpus does not have to be large for this: the same documents can be
re-read forever, and each read bills again. For scale, the modelled *peak*
rate is 14/sec at 500 DAU and 155/sec at 5,000. App Check does not make
this impossible — a determined attacker can drive a real device — but it
removes the version that is a script and a laptop, which is the one that
happens.

**3 · Which auth billing mode the project is on.** Finding 3, unchanged and
still the largest single line that could be wrong without any code being
wrong. Also console-only.

**4 · A notification channel on the alert policies.** `monitoring/` holds
nine policies and `check:monitoring` proves the chain from log line to
condition — but `notificationChannels` is `[]` in every file, filled in at
POST time by the **Arm monitoring** workflow (`npm run monitoring:apply --
--email` locally). A policy with no channel evaluates correctly and pages
nobody, which is the same false comfort every other gate in this repo
exists to prevent, and the same shape as the known limit already recorded
against the absence alert. Not console-only any more, and not done either:
on 2026-08-26 the project held none of them (D300, D303).

**What was built here instead of a cap.**
`monitoring/firestore-read-runaway.json` is the detection-latency half:
billed reads above 500/sec sustained for five minutes. It is not a spend
cap — it fires after the reads are billed — but it converts "find out in up
to thirty days" into "find out in five minutes", and at that threshold the
month is still worth about $780 rather than five figures. Its threshold is
a launch-size threshold with the retune arithmetic in its own runbook; it
must be raised before ~13,100 DAU, where the modelled peak crosses it.

### What to actually do at 3am

The alerts above tell you something is wrong. This is the part that stops
it, and the useful discovery is that **the fastest lever already exists and
is not armed**.

**App Check enforcement on the Firestore API is the kill switch.** It is a
console toggle, takes effect in minutes, needs no deploy, and it rejects
unattested traffic *before* rule evaluation — which matters, because a
security rule cannot shed cost: its `get()`s are billed on denied writes
too, so "deny in the rules" is a way to keep paying. Enforcement is the
only control in the project that makes a request cost nothing.

The catch is the one that makes this a launch item rather than an incident
item: **you cannot flip it during an incident if you never set it up.** The
console sequence in SHIP-CHECKLIST — register the providers, ship builds
carrying attestation, soak App Check → Metrics for 24–48 h until verified
requests approach 100%, *then* enforce — takes days, and skipping the soak
turns a cost incident into an outage for every real user at once. So the
work has to be done in advance for the lever to exist at all.

That reframes App Check step 4. It is filed as hardening, and it is really
the incident-response plan: it is simultaneously the thing that prevents
the cheap version of the attack and the thing you reach for when something
else goes wrong. One other lever on this page can now be pulled at 3am —
the read breaker below, one command and no deploy, though it shears over
hours rather than minutes because it propagates per boot. Nothing else can:
a rules deploy takes minutes and still bills its own reads,
`APPCHECK_ENFORCE` only governs callables (and only in the loosening
direction), and detaching the billing account takes the app down.

**The graded breaker — BUILT at level 1 (D332, 2026-08-27).** The owner's
ask arrived ("a lever so usage does not outrun revenue"), which was the
decision this paragraph was waiting on. `budgetMode` on `v2_meta/app` — the
document `hydrate()` already reads once per boot, so the lever costs no
read of its own — set by `npm run budget:mode -- --level 1` and released
with `--level 0`. Level 1 pauses the D98 social fetches (named who-voted,
Kindred, Circle, takes): the `social` column, ~354 of ~440 reads/user/day
at 5,000 DAU, with the answering loop, the aggregates and the Mirror's
folds untouched. Every gated surface says it is paused
(`src/v2/data/budgetMode.ts` holds the one sentence), because the honest
version needed a decision about what a degraded app *says* — that was the
owner's call this build waited for, and the paused copy is now pinned by
the panel suites. Two deviations from the sketch this paragraph used to
carry, with the arithmetic in D332: the similarity agg sweep stays on
(~110 reads once per session against social's ~354 per day — gating it
would blank three more lenses for a rounding error), and the second level
is reserved rather than built (the sketch's "deck listeners" predate D129;
what that level would govern today is 3 + 28 flat reads/user/day).

**Where the free tiers end**, since "still free" is the cheapest possible
guardrail and worth knowing precisely: reads leave the 50 k/day free tier
at **~177 DAU**, writes leave the 20 k/day tier at **~1,687 DAU**
(was ~1,408 before the private mirror collapsed — the crossing moves by
exactly the write rate's ratio, 24.2 → 20.2 per user-day). (Read off
the model's *immature* branch, which is how `SCENARIOS` classifies every
size in that range; the mature branch would say ~149 and would be quoting
a community that does not exist yet.) Below
the first of those the infrastructure is genuinely $0 and no control
matters. That is also why every alert here is sized for the second
threshold rather than the first.

## The walls, in the order they are hit

> **D129 reordered this list, and in the good direction.** Wall 2 is gone —
> there is no fan-out left for anything to overtake — so D7's
> write-contention ceiling is now the first wall by a wide margin, and the
> property this section calls "worth keeping" holds again with room to
> spare: the app breaks technically at ~14,400 DAU, where the bill is about
> $130/month. The paragraph below the list, which says that ordering is gone
> and that pretending otherwise would be the most expensive sentence on the
> page, described the pre-D129 tree; it is kept because the reasoning is
> still the reasoning, and because this is the third time the ordering has
> moved.

1. **~14,400 DAU — D7's write-contention ceiling.** All of a day's daily
   answers land on one `v2_question_aggs/{qid}` document inside a 4-hour
   window; Firestore sustains ~1 write/sec/document. `0.35 writes/sec` at
   5 k DAU, `1.00` at 14.4 k, `3.47` at 50 k. Past this, transactions
   retry and aggregation degrades. Already recorded, already costed, fix
   already named (shard the counter). **This binds first.**

   The document named here was `v2_aggs_private/{qid}` until that copy
   collapsed into the published one, and the DAU figure did **not** move
   with it: the two were keyed by the same qid, written in the same
   transaction, so the transaction was already bounded by one of them and
   is now bounded by the survivor. The collapse removes a write from the
   bill; sharding is still the only thing that removes this wall.
2. **~14,145 DAU — the read fan-out overtakes every flat source
   combined.** Finding 2. Not a failure, just the point where the bill
   stops being about anything else. This row has now moved three times
   without the fan-out changing shape, and every move is worth keeping:
   D98's cadence removal made it five times steeper, pulling the crossover
   from ~18,200 to ~3,700 with nobody rerunning the model to see it; D102's
   `social` term raised the flat baseline from 46 to 385 reads/user/day and
   pushed it back to ~30,800; and D124 stopped charging listener time at a
   guess it had no right to, which brought it to **~14,145 — 255 DAU inside
   wall 1, which is not a margin.**
3. **~50,000 MAU — the Identity Platform cliff**, if that is the billing
   mode. Finding 3.
4. **~10,000 activations/day — Play Integrity's standard quota**, which
   D29's `activateDeviceV2` calls once per device per month. Bound by
   install rate, not DAU, so it only bites during a viral spike — which
   is precisely when it would hurt.

A fifth wall was here in draft and is deliberately not in this list: the
velocity scan used to buffer its whole window into a 256 MiB instance and
OOM somewhere around 44 k DAU, *below* the Scale row, re-reading the same
window and dying identically every night thereafter. D64 made it fold per
page, so its memory is bounded by one page rather than by the window. The
new ceiling has not been measured and no number is quoted for it here.

**The ordering this section was built on is gone, and pretending otherwise
would be the most expensive sentence on the page.** Wall 1 before wall 2
was the good arrangement: the app breaks technically at a size where the
bill is still ~$183/month, so no surprise invoice can arrive before a
surprise outage. Three versions of this paragraph have now asserted that
property, and it has been false for part of the time each of them was
committed. 14,145 against 14,400 is not "holds by arithmetic" — it is a
tie, decided by `bgCycles`, a number nobody has measured.

What that means in practice is narrower than it sounds and worth stating
rather than dramatising. Both walls sit near 14 k DAU, both are a long way
past launch, and the bill at that size is low four figures a month — so
the actionable content is not "fix the fan-out now" (D7 still says no) but
"stop relying on which one comes first." The two mitigations that were
filed against wall 2 alone — polling instead of streaming, and the static
bank — are now the mitigations for the pair, and the recorded fix for wall
1 (shard the counter) no longer buys the head start it was chosen for.

Three of the inputs deciding this are guesses: `bgCycles` (4), `onlineMin`
(3) and the three D98 open rates. Every one is answerable from a week of
real usage, and until one of them is measured this section is describing a
coin toss with a precise-looking number on it. Re-run the crossover line
the day any of them is.

## Everything that is not Firestore

| Item | Cost |
| --- | --- |
| Apple Developer Program | $99/yr |
| Google Play registration | $25 once |
| Cloud Functions compute | $0 → $43/mo at 500 k DAU |
| Cloud Scheduler | $0 (2 jobs; 3 free) |
| FCM push | $0 |
| App Check — reCAPTCHA v3 / DeviceCheck / Play Integrity | $0 |
| Firebase Hosting (`web/`, static pages) | $0 |
| Cloud Storage | **~$9/mo at 5 k daily room-opens, and $0 before D178** — the profile photo is the first thing this app has ever stored, and the only egress path it has. Bounded three ways by construction: one object per account at a fixed id, 256 KB a piece (~20 KB real), one read per face drawn. Finding 7 has the arithmetic and the two things it does not bound. The 2026-08-13 note this row used to carry still applies to the RETIRED path beside it: `storage.rules` had granted any signed-in account write on `users/{uid}/dailyPhotos/{filename}` — 8 MB an object, `{filename}` unbounded, so unbounded objects and unbounded egress, by a free anonymous account (D3), against a feature D4 removed. Uploads there are closed; read and delete stay open for erasure. **`deleteAccount` reaches Storage since D178**, which that note said it did not |
| Cloud Logging | $0 until ~500 k DAU, then ~$17/mo |
| Firestore storage | 5.6 GiB after a year at 5 k DAU → $0.83/mo (4.0 GiB of documents, ×1.4 for index entries — a multiplier that was 1.0 in the model until D67, and would be ~5 without D64's `answers` exemptions; the indexed set has since grown by D86's `editedAt`, D98's who-voted composite and D102's `surface` re-enable, and 1.4 stays as the blended estimate) |
| Network egress | in the Firestore column above, not free: $0–0.5/mo at 5 k DAU, **$7–147 at 50 k**, $647–14,686 at 500 k — see the band below |
| Sentry | $0 (developer tier; crash-only, but on by default since D76 — volume now scales with installs, so this is the first third-party quota to watch as they grow) |
| GitHub Actions | $0 within the private-repo allowance; iOS is a separate workflow *because* macOS bills at 10× |
| **The question farm** | a claude.ai subscription — the content pipeline's real recurring cost |
| **Total fixed** | **≈ $30/month** |

The farm deserves its line. QUESTION-FARM.md runs on scheduled Routines on
the maintainer's subscription, and the never-repeat arithmetic in D30
depends on ≥7 promoted questions/week *indefinitely*. That is not a
one-time content cost; it is the only recurring operational expense that
does not scale down when usage does.

## The honest summary

**Below ~1,000 DAU this app costs about $35/month, and $28 of that is the
Apple developer program and a Claude subscription.** The infrastructure is
effectively free at launch sizes — $0 at 50 DAU, ~$2 at 500 — and
$41/month at 5,000 DAU, where this document has previously said $7.26,
then $46, then $59. The first three described the same app modelled with
progressively fewer missing terms, and the direction was up every time.
**$41 is the first one that is lower because the app changed** (D129), and
the distinction matters: this page's own reliability record is about
missing terms, not about optimism.

What changed in the D129 pass is entirely about shape. There is one big
line left — the D98 surfaces, at 339 of 416 reads per user per day — and
it is a product behaviour, moved by an open rate or a cap rather than by
architecture. Nothing in the decomposition scales with DAU any more. So a
week of real usage measuring the three open rates now moves this
prediction more than *any* code change would, which was not true on any
previous version of this page.

That is still the correct answer to "can I afford to launch this": yes, by
a wide margin, and the cost of being wrong about demand is not measured in
infrastructure at all.

Three caveats worth carrying:

- **The bill is almost entirely reads, and the biggest read line is now
  the product working as designed.** The boot-era sources are dealt with:
  the cache-bust is closed (D34) and the listener fan-out is closed (D129,
  polled rather than streamed), and rule/server traffic is flat and small. What remains is
  the `social` column — the D98 surfaces reading each other's answers —
  which is bounded by four pinned caps (Finding 4) and priced by three
  open-rate guesses. It is the one line a cap retune or a UI change moves
  directly, which cuts both ways.
- **Check the auth billing mode.** It is the only line in this document
  that could be four figures a month without any code being wrong, and it
  is the one remaining pre-launch cost action.
- **Pick the region before the seed.** Single-region halves every Firestore
  line — $3.71 / $151 / $11,133 against $7.26 / $247 / $17,166 — and a
  Firestore location cannot be changed after the database holds data. It is
  the only decision in this document with a deadline, and it is filed under
  "what would change these numbers" below as though it were a knob.

## What would change these numbers

- **Engagement per user.** The model assumes 5 answers/day (4 world + 1 duel). Doubling that
  roughly doubles writes and compute, and re-running with `B.worldAnswers`
  at 6 moves reads/user/day by +18% / +11% / **+20% / +65% / +97%** at
  50 / 500 / 5 k / 50 k / 500 k DAU — roughly doubling the bill at the two
  top rows ($46 → $61, $1,224 → $2,106, $85,541 → $167,632). The mid-size
  percentages *fell* at D102, which looks wrong and is not: the `social`
  term is charged per open rather than per answer, so a bigger social
  column dilutes the answer-driven share until the fan-out takes over.
- **The D98 open rates.** `B.sheetOpens` (0.15), `B.kindredViews` (0.03)
  and `B.circleOpens` (0.1) price the model's largest sub-30k-DAU line off
  three guesses about curiosity, and the `social` column is linear in each
  of them. They replace `onlineMin` as the most leveraged soft numbers in
  the file, and they are the same kind of cheap to find out: a week of
  real usage answers all three. The caps beside them are hard bounds, so a
  wrong guess moves the bill, never the ceiling.
- **Reseed frequency.** *Was* the single most sensitive input below 50 k
  DAU; D34 took most of the sensitivity out with it. What matters now is
  `changedPerReseed` (how many questions a promotion actually moves), not
  how often a reseed runs — the same 7 questions cost the same 7 reads
  whether they ship weekly or monthly.
- **MAU/DAU ratio.** Assumed 3. A worse retention curve raises the reseed
  delta and the auth bill together, because both are charged per *monthly*
  user — but post-D34 only the auth half of that is material.
- **Region — and this one was never a knob. It has been PULLED (D165).**
  A single-region database roughly halves every Firestore line, and the
  project has been on `europe-west1` since 2026-08-15, so this is a lever
  in the list's history rather than in its inventory. It stayed written as
  an open choice for three days after it was taken, which is the whole
  subject of D200's note above the scenario table. The figures it used to
  quote — $2.12 / $41 / $440 / $4,448 at 500 / 5 k / 50 k / 500 k DAU —
  are now the COUNTERFACTUAL (`node scripts/cost-model.mjs
  --multi-region`), and the halved column is what the tables print.
  It belonged in this list least of all the entries here, because a
  Firestore database's location is **fixed at creation** — every other line
  can be revisited after launch and this one could not, so it was a
  decision with a deadline rather than an input to tune. Since D129 took
  the fan-out out of the bill it was also the largest single lever left,
  which makes the **largest remaining** one somebody else's row now.
  [`docs/FIRESTORE-REGION.md`](FIRESTORE-REGION.md) has the procedure, the
  two ways it fails silently, and what happens to the data already in
  `(default)`. (The figures here were three model runs stale until
  2026-08-13 — they quoted the pre-D124 arithmetic while the tables above
  had moved twice, which is this document's own recurring defect committed
  in the entry that warns about deadlines.)
- **Catalog go-live (D14/W1.4).** Catalog answers fold an `ent` map and an
  `entBy` breakdown into the same private document. Same write count, but
  a materially larger document, and Firestore bills writes by operation
  rather than by size — so the effect lands on storage and contention,
  not on the write line. It also adds a third server read per catalog
  answer (the trigger reads the question's `domain`), which the model does
  not charge, because catalog is not live.
- **How many people fill the Basics card.** The swing variable behind the
  egress band, and unknowable before launch. An anchors-less population
  publishes bare `{counts, total}` aggregates of a few hundred bytes; a
  fully-filled one publishes a `by` breakdown of 6 dimensions × up to 24
  buckets. The model charges the middle (2.4 KB) and
  `node scripts/cost-model.mjs` prints all three columns.

## What is still not in the model

Named, so the next correction starts from a list rather than from a
surprise:

- **The paid loop's off-Firebase bills (D313; ads D315).** The automated
  review is one `claude-opus-5` call per booking — cents each, billed to
  the Anthropic account, bounded by the 5/day/account booking budget —
  and Stripe takes its processing fee out of each checkout and returns
  nothing on the refunded remainder. Both ride other ledgers than the
  Firebase bill this file models; the Firestore side of the loop (a
  booking doc, a handful of status writes, one purchase, one question
  or ad doc, the closer's daily bounded scan) is noise against the
  read-dominated bill.
- **Cloud Logging volume**, estimated in the fixed-cost table above but not
  derived from the actual log statements per invocation.
- **The catalog trigger's third read**, above — deliberate, it is not live.
- **Retries.** ~~Every function invocation is priced once. `retry: true` on
  the answer trigger means an at-least-once delivery can bill twice, and
  nothing here models the rate.~~ **Bounded 2026-08-13, and the answer is
  reassuring enough to be worth stating rather than leaving open.** The
  rate is still not modelled and does not need to be, because the *ceiling*
  is: `setGlobalOptions` sets `maxInstances: 10` (functions/src/ops.ts) and
  no per-function override raises it. Ten instances of the hot trigger's
  shape (1 vCPU, 512 MiB) pegged for an entire month is 25.9 M vCPU-seconds
  and 13.0 M GiB-seconds — **$649/month net of the free tier, and that is
  the worst case for a runaway in any one function**: a retry storm, a
  poison-pill redelivery loop, an accidental self-trigger, or a deliberate
  flood. Compute cannot run away here. What it can do instead is throttle:
  ten instances at concurrency 20 is 200 simultaneous folds, so past that
  answers queue rather than cost more, which is the correct trade for this
  app and worth knowing is the one being made.

  **`maxInstances` is per function, not per deploy** — checked rather than
  assumed, and the first draft of this paragraph had it wrong. Every one of
  the 19 exported functions is stamped with its own 10, so the theoretical
  ceiling if all of them pegged at once is $12,219/month rather than $649.
  That case needs 19 simultaneous independent runaways and is not the one
  to plan against; the $649 is. The verification is a two-line probe against
  the built output (`__endpoint.maxInstances` on each export), which is also
  how the count of 19 above is known — the same shape `check:fn-runtime`
  already uses for memory and timeout.

  Two things the cap does *not* cover, so the bound is not oversold. Each
  retry re-issues the trigger's reads (`TRIGGER_READS.world` = 2), which
  are billed on the Firestore side, not this one — a week-long backlog is
  tens of millions of reads, tens of dollars, still small beside the
  fan-out. And the correctness cost is the real one: while the trigger is
  failing, the Mirror silently stops moving. That is what
  `monitoring/onV2AnswerCreated-errors.json` watches, and it is the reason
  that policy's runbook says to deploy a no-op body before fixing forward.
- **The moderation and mod-queue jobs.** Daily, bounded by flag volume
  rather than DAU, and currently zero because no client can create a flag.
- **`egress` on the functions side** — callable responses, which are
  small and infrequent next to Firestore's document traffic.

None of these is believed material at any modelled size. That belief is
exactly what was believed about rule and server reads before D67, so the
list is here to be checked rather than trusted.
