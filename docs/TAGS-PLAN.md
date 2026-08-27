# Tags — several doors to one question, and demand that cannot be bought

**Status: BUILT — §1–§3 and §5–§6 recorded as
[D206](DECISIONS.md#d206--a-question-carries-several-doors-and-demand-credit-is-conserved)
(2026-08-19); §4's door-read at D325 (2026-08-27), landed in the server
taste model D317/D322 built rather than D163's device model the section
was written against — the arithmetic was never device-specific, and the
privacy page's sentence moved in the same commit (§4's note).** Requested 2026-08-19: *multiple tags on questions, and
question production based on what tags are most popular*; built the same
day on the owner's "build it", in §6's order. The reasoning below is kept
as written — it is why the code has the shape it has — and every figure
stays cited to the script that computes it rather than restated: the
constants this design touches (`feed-budget.mjs`'s caps,
`farm-budget.mjs`'s audit rate, `COSTS.md`'s wire sizes) are held by
`check:figures`, and quoting them here would add copies for that gate to
chase.

The request is two asks that look like one feature and are not:

- **A · A question may belong to several topics.** New. Everything today
  assumes exactly one — the schema, the gate, the filter, the scorecard,
  the breadth budget.
- **B · Production follows topic demand.** **Already built.** The farm's
  allocation lanes (`QUESTION-FARM.md` § Picking topics, D97) rank topics
  by *popularity × depth* from the committed scorecard, with
  replenishment ahead of demand and a coverage floor beneath both.

So this plan is A, plus the arithmetic that lets B read A without being
gameable, plus B's inputs getting truer. It is deliberately the complete
version: every mechanism is designed and built together, and the only
thing that arrives later is data, because no arithmetic can read
aggregates that do not exist yet.

## 0 · What this retires, and what it deliberately keeps

**The premise being retired: a question has exactly one topic.** It is
load-bearing in five places, each of which this plan changes:

| Where it lives | The single-topic assumption |
| --- | --- |
| `scripts/gen-v2content.mjs` | a feed entry emits one `topic`, from `cat` |
| `scripts/question-quality.mjs` | `cat` required, validated against `feed.topics`, and that is the whole topic story |
| `scripts/question-scorecard.mjs` | one row, one `topic`; the rollup credits the row's full `total` to it |
| `src/v2/spec/world-feed.jsx` | the chip/follow filter matches `q.cat` (or `q.sub`) and nothing else |
| `scripts/feed-budget.mjs` | the breadth deficit counts questions per single topic |

**What survives, each deliberately, because the ask ("most popular
tags") could be read as reversing any of them:**

| Kept | Why |
| --- | --- |
| Popularity means **published answer counts**, nothing else | Passes, skips and dwell are local-only by standing decision (`MONITORING.md` § Off the table, re-affirmed post-D98; the taste model moved server-side at D317 but still reads only answers — behaviour uploads are its unadopted phase 2). A tag's popularity is the answers its questions collected — the same public number everyone reads. |
| **Popularity × depth**, never raw popularity | Total answers per day is conserved regardless of bank size (`SCALE-PLAN.md` §1). Raw popularity compounds: a popular topic gets more content, collects more of the fixed budget, looks more popular. Depth (least-answered ÷ most-answered) is what lets a small devoted topic earn content; the coverage floor is what lets a new topic exist at all. B's formula stays; A makes its inputs truer. |
| The Map files an answer at **one path, forever** | "Miscategorisation lands on a branch forever" is already in `SCALE-PLAN.md`'s failure table. Placement stays singular; only *matching* becomes plural. |
| The vocabulary is **closed** | Farm hard rule 3; growth stays the deliberate human act in `QUESTION-FARM.md` § When no category fits. Free-form tags at farm volume are a vocabulary explosion and a semantic-dupe generator. |
| Demand steers the **feed**; the core stays curated | `SCALE-PLAN.md` §1: the Mirror folds over the core, which must stay a population sample. A popular tag earns tail volume, never a seat in the Mirror's corpus. |
| The **daily lane is untouched** | Its `cat`/`alts` pair is a Map-placement mechanic (`alts` are candidate paths, `daily-questions.js`), nothing may personalize the daily (`ATTENTION.md` §3), and its topic namespace never mixes with the feed's (the scorecard already scores them per-surface). |

## 1 · The field: `also`

Feed questions — pick cards included, since every card carries a `cat` —
gain one optional field:

```
cat:  "sport"            ← unchanged: required, the HOME
also: ["tech"]           ← new: up to two more committed ids, the DOORS
```

- **Name.** Not `tags`: the daily card already carries `tag`, a display
  kicker ("The GOAT") that rides the shared `LiveQuestion` shape through
  `deck.ts`, and the quality gate's vocabulary already uses the word for
  it — two meanings of one name across surfaces is the kind of foot-gun
  this repo greps for. Not `topics`: the wire already carries `topic`
  (the primary, mapped back to `cat` in `deck.ts`). `also` is the
  sentence it means: the topics this question *also* belongs to.
- **Values.** `WORLD_TOPICS` ids and `WORLD_SUBTOPICS` leaf ids, the
  committed taxonomy and nothing else. Disjoint from the question's own
  `cat`, its `sub`, and that sub's parent — a door that duplicates the
  home is noise the gate refuses rather than prose asking politely.
- **Cap: two.** A ceiling, not a target. Most questions carry none —
  `also` is for genuine straddlers ("E-sports are real sports" lives in
  sport and is invisible to someone following tech). A question that
  needs three doors is usually a vague question, the same nose the
  prompt-length bounds already encode.
- **Emit-when-set**, the `active`/`until`/`core` pattern in
  `gen-v2content.mjs`: the common case adds no bytes.
- **Mutable.** `also` is content metadata on a retirable surface —
  editable by ordinary content PR, delta-served (D34). A wrong door is
  recoverable, unlike a wrong Map home, which is exactly why placement
  keeps living in `cat`. Content, not user data, so no
  `docs/data-inventory.md` row — the `core` flag's precedent, and
  `check:data-inventory` confirms it.

**The invariant the whole plan hangs on:**

> **A card appears once; `also` multiplies the ways to reach it, never
> the copies of it.**

Everything that *places* keeps reading `cat` alone — the Map branch and
ripple (`WF_BRANCH`), the kicker, the round-robin stream grouping, the
"On your map" row. Everything that *matches* reads `cat` ∪ `also` — the
filter, search, stock, the demand rollup, the interest model. Every
section below is one side or the other of that line.

**Retro-tag the existing bank now, editorially, in one human PR.** The
dearer-with-time argument, same as the `core` flag: per-question
judgement at today's bank size is one sitting; at farm scale it is the
review bottleneck arriving through the back door. The expectation is
that most rows gain nothing and a minority gain one door — an outcome
where half the bank is cross-tagged means the taxonomy is wrong, not the
bank.

## 2 · Reach — how the feed reads the doors

The filter in `world-feed.jsx` currently shows a topic-matched card when
its `sub` is a followed leaf, or its `cat` is an unmuted channel, or its
`cat` is a pulled topic. It becomes:

- **Evaluate the same per-kind rule over `cat` ∪ `also`; show the card
  if any passes — and hide it if any is explicitly muted.**
- **A mute is a veto; a follow is a vote.** `ATTENTION.md`'s signal
  table already ranks explicit dismissal above everything; a card the
  user said "less of this" to must not ride back in through its second
  topic. This is the one place doors make the feed *smaller*, and it is
  the correct place.
- Scene cards keep scene-only matching — a scene is a room, not a
  topic, and its cards belong to the room.

Verified rather than assumed about today's builds
(`src/v2/test/world-channels.test.js`, D96): a live build currently runs
every subject topic always-on because no communities exist to pull them.
So the immediate live effect of doors is the veto, stock, and search;
the follow-side reach compounds when subtopics and scenes stock live
builds. The demo paths get the full OR now — and the demand arithmetic
(§3) needs the doors regardless of which build's filter is reading them.

The rest of the reach surface:

- **Grouping stays `cat`.** The interleaved streams key on one value; a
  card in two streams would break the invariant in the most visible way
  possible (the same card twice in one scroll).
- **Stock counts membership.** A subtopic's shelf shows everything that
  reaches it. Membership is not a partition, so per-topic stock summing
  to more than the bank is correct — said in a comment where the tally
  is computed, because the first person to sum the column will file a
  bug otherwise.
- **Search** matches door labels as well as the home's.
- **Wire and types.** `gen-v2content.mjs` emits it; `live.ts`'s
  `QuestionDoc` gains optional `also` and `deck.ts` passes it through to
  the feed mapper. `vote.test.ts` pins `window.LIVE`'s member surface —
  the pin moves in the same commit, deliberately, because that test
  exists precisely so this class of change cannot be silent.
- **`check:globals` rule 4 does not move.** No new cross-module
  globals: the work lives inside `world-feed.jsx` and the typed `data/`
  layer. The ratchet count stays where it is.
- **No new chrome.** No tag pill row on cards — the kicker already
  names the home, and doors are matching machinery, not copy
  (visual > word, D182). The card renders exactly as today; the only
  visible effect of a door is *where the card can be met*.

## 3 · Demand — the popularity a tag can and cannot earn

The scorecard is the farm's only view of performance and reads nothing
but public aggregates. Two changes, one new rule:

**Credit is conserved.** A scorecard row carries all its topics; its
answers split **home two shares, each door one share**, normalized per
question. The property that matters, pinned as a test rather than
prose: *summing credited answers across all topics equals summing
answers across all questions.* Nothing about tagging can mint demand.

Why conservation is the anti-gaming design and not an accounting taste:
the generator that assigns doors is the same species as the run that
reviews them (`QUESTION-FARM.md`'s correlated-blind-spots rule), and the
demand lanes steer that same generator's future budget. Full credit per
door would pay it to tag broadly — a closed loop in which liberal
tagging manufactures the demand that justifies more of the same. Under
conservation a door never adds credit, only redistributes it, so broad
tagging costs the home topic's own signal and buys nothing. The residue
— a tilt hiding inside individually defensible tags — is exactly what
the human audit exists for, so **tag honesty joins the audit**: the
1-in-`AUDIT_ONE_IN` reader judges each door with one question, *would a
follower of that topic nod, or is this reach?*

**Membership follows visibility.** For depth and replenishment, a
question sits in the pool of every topic it carries — because that is
the pool whose audience actually meets it. Exhaustion still reads raw
per-question counts (a question is consumed or not; credit shares are a
demand concept). One conservative bias, named so a future reader does
not rediscover it as a bug: a cross-tagged newcomer keeps a big topic's
least-answered count low and *delays* its replenishment trigger. That
errs toward under-producing, which is the survivable direction, and the
no-op run's tallies on the run log make it visible.

**Sponsored questions never steer the farm.** New, and it falls out of
D195 the way tail-only placement fell out of the core/tail split: a paid
question keeps its public per-question aggregate — the honest split is
what the buyer bought — but its rows are **excluded from the topic
rollups lanes 1–2 read**, because production allocation must not be
buyable any more than the Mirror's corpus is. And `also` is **refused on
sponsored questions outright** (`check-content.mjs`, beside the
audience-tag rule — one dim at D195, one to three since D228): a paid
card reaches the audience it declared, and a buyer who wants two
audiences buys two windows.

Downstream of the same arithmetic:

- **`feed-budget.mjs`'s breadth deficit counts membership.** A thin
  topic's cheapest first fix becomes a door on an existing question —
  which respects the lane's dilution bound better than production does,
  because a new question splits the conserved answer budget and a door
  on an existing one does not.
- **The farm contract gains three sentences** (`QUESTION-FARM.md`, same
  PR that builds this): the generator may emit up to two doors and
  justifies each in one line in the PR body; the reviewing run judges
  each door by the audit's question; per-surface scoring stays — daily
  topics never mix in.
- The lanes themselves do not change shape. Replenishment, demand,
  coverage, in that order, with signals taking the whole budget — the
  inputs just stop lying about straddlers.

## 4 · The interest model reads doors — D163's contract, written before tier 2 exists

> **2026-08-27: built (D325).** The model arrived server-side — D317
> moved it (the invariants below survive the address change; D317 says
> they "bind harder" there), D322 built its phase 1, and D325 landed
> this contract in that fold: `creditShares` in `functions/src/taste.ts`
> mirrors the demand rollup's copy in `scorecard-metrics.mjs`, both
> suites pin the same share values (the "one ratio used everywhere"
> sentence, held across two packages that cannot import each other), and
> `web/privacy.html`'s profile sentence moved in the same commit, per
> the D183 discipline. The veto clause needed no server half — the
> client filter already vetoes across `cat` ∪ `also` (§3).

Specified then so the field is not re-litigated when the model
lands:

- Weights stay per-topic. A card's affinity is the share-weighted mean
  over `cat` ∪ `also` — the same two-to-one shares as §3, one ratio
  used everywhere so nobody tunes them apart by accident.
- "Less of this" on any carried topic is the veto again, same rule as
  the filter's.
- The standing invariants inherit unchanged and now explicitly cover
  doors: the model shapes the **feed only** — never the daily, never
  the Mirror — and tag demand allocates **tail production only**. New
  farm production already lands in the tail (`SCALE-PLAN.md` §1: the
  existing bank is the core, the tail is what production fills), so the
  sentence to keep true is: *the lanes allocate the tail; a human
  allocates the core.* The read-side half is `SCALE-PLAN.md`'s pending
  test (the Mirror never folds a tail question); this plan adds the
  write-side sentence to the farm contract.

Doors make tier 2 *better* at its stated job, which is worth saying
because it is the half of the original ask that needed no new
collection: a model with a few dozen topic weights learns faster when
questions overlap topics, and an unbounded tail is reachable through
more follow-paths without a single extra question being produced.

## 5 · What makes each sentence enforceable

Every claim above, with the gate or test that keeps it true:

| Claim | Held by |
| --- | --- |
| `also` well-formed: committed ids, ≤ 2, disjoint from home/sub/parent | `question-quality.mjs` + `question-quality.test.mjs` |
| No `also` on sponsored; sponsored excluded from rollups | `check-content.mjs`; `scorecard-metrics.test.mjs` |
| Credit conservation (credited = answered, exactly) | `scorecard-metrics.test.mjs` property test |
| OR-match, mute-veto, one appearance per card | feed filter test in `world-channels.test.js`'s pattern (import the bank, stub the env) |
| `window.LIVE` surface | `vote.test.ts` pin, moved in the same commit |
| Wire size | re-measured, `COSTS.md` corrected from the measurement, `check:figures` holds it — the `core` flag's precedent, whose keys measurably moved the figure and whose gate caught it |
| The map stays current | this document registered in `ORIENTATION.md`, `check:docs` |
| Nothing renders broken | the five smoke suites, asserting on the `ErrorBoundary` |
| The bridge does not grow | `check:globals` rule 4, count unmoved |

## 6 · Order of work — complete machinery now; only the data arrives later

> All six landed 2026-08-19 in this order (D206). Kept as written — the
> order is the argument, and the argument is why a future lane change
> starts from the gate rather than from the generator.

1. **Gate before content.** `also` validation in `question-quality.mjs`
   and the sponsored rules in `check-content.mjs` — the farm's own
   two-gate shape, so the retro-tag PR is validated by the same gate
   that will hold the farm to it.
2. **Retro-tag the bank** (human, editorial, one PR). The
   dearer-with-time half.
3. **Wire and reach.** Generator, `QuestionDoc`/`deck.ts`, filter with
   veto, stock, search, and their tests.
4. **Demand arithmetic.** Scorecard doors, conservation, sponsored
   exclusion, `feed-budget.mjs` membership counting, and the metrics
   tests.
5. **Contract prose.** `QUESTION-FARM.md`'s generator/review/audit
   sentences and the tail-only allocation sentence, in the same PR as
   the code they describe.
6. **Adoption record.** One `DECISIONS.md` record when built — the
   field and its invariant, the conservation shares, the mute-veto, and
   the sponsored exclusion — the "graduates to a record" pattern
   `SCALE-PLAN.md` §3 used.

Two things wait, and neither is this plan being cheap about itself: the
lanes have nothing to read until aggregates exist (the committed
scorecard is the honest zero of an unlaunched app — `SCALE-PLAN.md` §3
names the same sequencing caveat for review), and any increase in
production *rate* stays behind bank pagination (`SCALE-PLAN.md` §6 item
1 — the fetch ceiling's headroom is weeks at scaled rates, and tags do
not jump that queue). The machinery is whole on day one; what arrives
with users is only the numbers flowing through it.

## 7 · Failure modes

| Failure | Mitigation | Residual |
| --- | --- | --- |
| The generator inflates demand for what it likes to produce | Conserved credit (a door redistributes, never adds), the cap, and tag honesty in the human audit | A tilt inside individually defensible tags, subtle enough to survive the audit sample |
| Broad-tag drift — everything grows a door to the big topics | Cap of two, disjointness rules, the reviewer's one question | Reviewer shares the generator's species; the audit is the check |
| A muted topic leaks back through a second door | The veto rule, pinned by a filter test | None if the test exists; the constraint rots exactly like any untested prose |
| A sponsor buys production allocation | Rollup exclusion + no `also` on sponsored, both gated | An operator who edits the exclusion; the same trust the core flag already rests on |
| Vocabulary sprawls through the back door | `also` takes committed ids only; new topics stay § When no category fits | None — the gate refuses unknown ids |
| Replenishment mis-times on cross-tagged pools | Raw-count exhaustion, bias named conservative, tallies on the run log | Big topics refill later than a purist model would |
| Per-topic numbers get summed as if a partition | Conservation for credit; a comment at the stock tally for counts | A reader who sums the stock column anyway |
| Wire growth | Emit-when-set; measured, not assumed; `check:figures` | None at plausible door counts — bank size is a one-time install cost (`SCALE-PLAN.md` §2, verified across bank sizes) |

## 8 · What I would build first

The order in §6, and the two pieces that repay the most are the ones at
its head: the retro-tag while the bank is one sitting, and the
conservation property while the scorecard is still the rollup's only
reader. Both are the "cheap now, judgement-at-scale later" halves — the
trade this repo already made once with `core`, and did not regret.
