# Scale — an infinite feed, and the four things it forces

> **Building rather than deciding?**
> [`SCALE-RUNBOOK.md`](SCALE-RUNBOOK.md) is the same work as an ordered
> to-do list: open steps only, dependency order, what "done" means and
> which gate proves it. It holds order and status; this file holds the
> reasoning and stays canonical. If they disagree, this file is right and
> the runbook is stale.

**Status: plan, with §1's classification BUILT (2026-08-15).** Everything
else on this page is still proposal — but the decisions behind it are
recorded: **D161** (unbounded feed and the core/tail split), **D162**
(review at volume), **D163** (the on-device interest model) and **D164**
(the revenue paths re-derived). Those records are binding; the build
order in §6 is not. Requested 2026-08-15, out of a
session that started on attention budgets and targeted ads and ended
somewhere else. Read it as a proposal, in `docs/ATTENTION.md`'s shape:
what it supersedes named at the top, the failure modes named at the
bottom, and every figure either cited to the script that computes it or
marked as the estimate it is.

Three owner decisions arrived in that session and this document is
downstream of all three:

1. **The feed should be infinite.** Question production scales up by an
   order of magnitude or more.
2. **Review is an AI job**, not a per-item human one.
3. **The app should learn what you like** and what topics you interact
   with.

None of them is refused here. What follows is what each one costs, what
trips first, and the one architectural decision that all three turn out
to need.

## 0 · What this supersedes

Not reversals so much as premises that stopped holding. Named because a
plan that quietly invalidates a recorded argument is the drift this repo
gates against everywhere else.

| Was true | Why it stopped |
| --- | --- |
| The feed is finite, and that is load-bearing | Decision 1. Several arguments leaned on it, including one against ads |
| `ATTENTION.md`: "Ship tier 1 first, alone… most of tier 2 is redundant" | Written against a ~500-question bank. A hand-edited topic list cannot order 50,000 items |
| D33: review capacity is the binding constraint | Still true of *reading* every candidate. Decision 2 reshapes what review means, not whether it happens |
| `MONETIZATION.md`: "never an auction" | Already split at `NEXT-FUNCTIONALITY.md` §6 — auction-*priced* slots are not auction-*driven* delivery |

One thing that did **not** stop holding, and is the reason §1 exists:
`MONETIZATION.md`'s named asset is *honest aggregates*. Everything below
is constrained by keeping that sentence true.

## 1 · The keystone: a core and a tail

**The decision the other three need.** Split the corpus in two:

- **The core** — a bounded set of questions served to **everyone,
  unpersonalized**. The daily already is one: it is the same question for
  every user and D7's write-contention hot document. **The Mirror's
  cohort readings fold over the core and nothing else.**
- **The tail** — unbounded, personalized, ordered by whatever the
  interest model says. Aggregates still publish for every tail question
  (a card still shows its own split); the Mirror's stops simply do not
  draw from it.

Three separate problems land on this one split, which is the argument for
it. Each was reached independently:

**Density.** Total answers per day is `DAU × answers-per-user-per-day`,
and that is **conserved regardless of bank size**. Growing the bank
divides that fixed budget across more questions; it never creates more
answers. So the bank may be infinite while the *dense subset* stays
bounded by population. Varying what each person sees — new questions
mixed with ones already answered by others — decides *which* questions
get density, which is the right lever, but it cannot manufacture any.

The headline split of a question reaches a readable count quickly even at
high production. **Cohort cells do not.** A city × age band is a low
single-digit percentage of the population, so a question needs months in
rotation before that cell says anything. The core is the set kept in
rotation long enough for that to happen.

**Sample bias — the one that is not in `ATTENTION.md`.** That document
says the interest model "may shape the FEED… it must not shape the
Mirror", and treats the two as separable. They are not, quite: **the feed
is what produces the data the Mirror reads.** If interests select the
feed, then who answers a question is interest-selected, and a question
about hiking answered mostly by outdoorsy people does not report what the
population thinks about hiking. The fold would be arithmetically correct
and the claim wrong — `MONETIZATION.md`'s asset degrading silently, which
is the failure mode this repo minds most. A core served to everyone is
what keeps the Mirror's corpus a population sample.

**Reachability.** With a small bank everyone effectively sees everything
and nothing has to choose. With an unbounded one, something must pick
~50 questions per person, and the tail is where that picking is allowed
to happen — which means the core keeps working no matter how the
selection logic evolves or how wrong it gets about someone.

### Built 2026-08-15 — the classification, not yet the enforcement

The half that gets dearer with time is now done, and the half that does
not is deliberately not:

- **`core` is a declared field on feed questions.** 82 of the 267 in
  `content/feed-questions.json` carry `core: true`, and 185 declare
  `core: false` — **the tail is not hypothetical; it is already more than a
  third of the feed and growing with every feed run.** The generator emits it
  onto feed entries only (`scripts/gen-v2content.mjs`, emit-when-set beside
  `active`/`until`), and `check:quality` **refuses a feed question that
  does not declare it** — verified by deleting a flag and watching the gate
  fail, not by reading the code.
- **Absent means TAIL, and the polarity is the point.** A question joins
  the Mirror's corpus only by saying so. A forgotten flag thins a reading;
  the opposite default would quietly enlarge the corpus, which is the
  failure §1 exists to prevent.
- **Every other surface is core by construction** and carries no key —
  the daily is one globally shared question, test items are what Scores
  and the similarity fields are computed from, duels never become world
  aggregates. Feed is the only surface where the distinction is real,
  which is also where scaled production is pointed (§2).

**The classification itself was the cheap-now half.** Today's answer is
that *everything which already exists is core* — at this bank size the
Mirror needs the whole corpus, and the tail starts empty and is what new
production fills. That is a real decision rather than a coin toss per
question, and it means the retro-classification this section warned about
never accrues: from here, classification happens at creation, one
question at a time, enforced by the gate.

**Enforcement in the Mirror is deliberately deferred, and the reason is
not laziness.** The tail is empty, so filtering the Mirror's fold today
would either be a no-op or would remove questions from live readings for
no benefit — a behaviour change to the app's highest-risk read path
(`docs/MIRROR.md`) bought with nothing. It costs the same to wire
whenever it lands, unlike the classification. It lands with the first
tail content, and not before.

One cost, measured because the gate caught it: 82 extra keys grew the
bank's wire size by ~1 KiB (`check:figures` failed on `COSTS.md`'s figure
and was corrected). That is a one-time install cost, which is exactly the
category §2 says bank growth falls into.

### Where the filter goes — every reader, decided 2026-08-19

`SCALE-RUNBOOK.md` 2.1 asked for the split written down per call site,
because "the Mirror folds core only" is a sentence and not an instruction.
This is that list. **Read by grep, not by memory** — every row below names
the line it was read off, and the classification came out of the code
rather than being applied to it.

**The tail is feed-only.** `isCore` (`data/deck.ts:246`) is
`q.surface === "feed" ? q.core === true : true`, so the daily, the test
items, duels, learn and pick cards are core whatever anyone writes on
them. That single fact decides most of the table: a reader that never
touches a feed question cannot be diluted, and saying *why* it cannot is
worth more than a filter it does not need.

**Only three readers walk the archive**, which is the only corpus a tail
question can enter (`LIVE.aggregated()`, `data/live.ts:3214` — every
question this device holds a published aggregate for):

| Reader | Verdict | Why |
| --- | --- | --- |
| **City / Country / World** — `ui/LiveCohortBody.tsx:275`, and through `lensQs` (:360) all five of that stop's lenses: Answers, People, Compare, Explore, Scores | **core only** | The population portrait §1 exists to protect. Built at 2.2; the lenses inherit it because they derive from the same already-filtered `archive`, which is the reason to apply it once at the corpus rather than five times at the readings |
| **Circle** — `ui/LiveCircleBody.tsx:134` | **all** | Circle folds the answers of people you chose to follow. That is a fact about *them*, not a claim about a population, so interest-selected serving cannot make it false — the bias §1 minds does not exist here. Recorded at 2.2 as a decision rather than an oversight, and this is its reasoning |
| **The reading game** — `ui/LiveReadGame.tsx:49` (D196) | **all** | Nothing is averaged across the corpus: each read names its own question and asks you to guess one cohort's split on it, so a tail question adds a playable read rather than thinning an aggregate. The gate here wants a *bigger* pool (`READ_MIN_POOL`), which is the tail's one unambiguous gift |

**Every other reading is bounded by construction.** Listed because the
next person to read §1 will otherwise go looking for a filter to add, and
adding one to any of these would be a no-op that reads as a safeguard:

- **The similarity fields, Compare, Scores' axes, Kindred and the place
  norms** fold `LIVE.testFeedItems()` — `state.feedBank.filter(q =>
  q.surface === "test" && q.test)` (`data/live.ts:2935`) — through
  `testItemMeta` (`data/similarity.ts:87`). Call sites:
  `ui/LiveSimilarityField.tsx:666,766`, `ui/LiveCompareLens.tsx:163`,
  `data/testNorms.ts:124`, `data/passiveProfile.ts:70`. The four
  instruments are a fixed bank pinned item-for-item by content parity, and
  `isCore` cannot call a test item tail. Production grows the feed; it
  does not grow an instrument.
- **Near** reads `LIVE.deck()` and the server fold's own cell map
  (`ui/LiveRoomTabs.tsx:194,211` → `ui/roomShape.ts:33`) — a window of
  days, never the archive.
- **Groups** reads reveal documents (`ui/LiveGroupsMirrorBody.tsx:301` →
  `data/groupPortrait.ts`). Duels never become world aggregates.
- **The Map's typicality** is one (question × anchor) pair for an answer
  you tapped (`spec/map-group-stats.js`), and **the who-voted sheet** is
  one question's (`ui/LiveBreakdownPanel.tsx`). A corpus of one is not a
  corpus.
- **The type mix and the passive profile** read published test results and
  your own votes (`data/typeSplit.ts`, `data/typeMix.ts`,
  `data/passiveProfile.ts`).

### The premise 2.1 was written on turned out to be false

2.1 warned that `aggregated()` "**also feeds your own answer list**, which
must keep showing everything you answered, tail included", and called
hiding a person's own answer from them the worse bug. It would be. It is
not this one: **no personal answer archive reads `aggregated()` at all.**

Measured — `myVotes()` has exactly one consumer per surface
(`grep -rn "myVotes()" src/`), and the two that are archives of your own
answering are the daily record (`spec/mirror-answers.jsx`, over `DAILYQ`)
and the Map (`spec/map-tab.jsx`, same store). Both are the **daily bank**,
core by construction, so the filter cannot reach them however the tail
grows. What `aggregated()` feeds is the *population* readings, on which
your own answer appears as a mark on a row rather than as the row's
subject.

So the accepted consequence is narrower than 2.1 feared, and it is stated
here rather than left to be discovered: after the filter, **a tail
question you answered does not get a row in the Mirror's Answers tab.**
That tab is a population reading with your answer marked on it
(`MIRROR.md` §3), not your archive — your archive is the Map, and the
card itself still shows your answer and its split. If the Mirror ever
grows a genuine "everything you have answered" surface, it reads
`aggregated()` **unfiltered**, and this paragraph is the reason.

### What makes the rest enforceable rather than aspirational

What remains is the Mirror's fold reading only flagged questions, plus a
test that asserts a non-core question's aggregate never reaches a Mirror
stop. Without that last test the constraint is prose and will rot — the
same argument `ATTENTION.md` already makes about its own feed-only rule.
Note that `core` is content metadata rather than user data, so it needs
no `docs/data-inventory.md` row; `check:data-inventory` confirms it.

**Core size is a function of DAU, not of ambition.** The ratio worth
writing into `check:quality` eventually: core questions may grow only as
fast as the population that has to fill their cohort cells. A gate here
would fail when the core outgrows the audience, which is the moment the
Mirror starts thinning without anyone noticing.

## 2 · Feed scale — what it costs, and what trips first

**Cost is not the constraint. Measured, not assumed.** The cost model
takes promotion rate as an input (`B.changedPerReseed` in
`scripts/cost-arith.mjs`; the shipped default is D30's cadence).
`npm run costs:scale` overrides it and prints the table below, plus the
bank-size table §2 rests on:

| questions/week | DAU 500 | DAU 5,000 | DAU 50,000 |
| ---: | ---: | ---: | ---: |
| D30 floor | $2.20 | $44 | $472 |
| D97 target | $2.23 | $44 | $475 |
| 100 | $2.54 | $47 | $507 |
| 700 | $4.70 | $70 | $733 |

Roughly **100× the production rate for ~$26/month at 5,000 DAU**. The
reason is D34: `runSeedV2` writes only changed documents and clients page
`updatedAt > cursor`, so a returning device pays for the delta, never the
bank. Bank *size* moves the steady-state model not at all — checked
across 513 → 100,000 documents, every scenario identical — because the
bank is a one-time install cost absorbed by the offline cache. Those
identical rows are the finding rather than a broken table: if a future
change makes bank size bill, they separate, and that is the regression to
watch for.

Reproduce rather than trust this table — `npm run costs:scale`. It began
as a scratch override with its output pasted here, which is exactly the
figure-in-prose shape that goes stale (D39), so the override is committed
as `scripts/cost-scale.mjs` and the numbers above are its output at
2026-08-15. No figure in prose outranks the script beside it.

**What tripped first was pagination, and it is done** (D161, runbook step
1.1, 2026-08-15). `live.ts` used to fetch the bank in one unpaginated
query bounded by `BANK_LIMIT = 1500`, and the reason that was a ceiling
rather than an arbitrary limit is worth keeping: a query that hits its
limit returns a short page and **no error**, so an over-sized bank served
a truncated corpus with nothing failing anywhere. `BANK_PAGE = 1000` is a
page size now, `BANK_MAX_PAGES` bounds the loop, and tripping it reports
rather than truncating. `bank-cache.test.ts` asserts completeness.

**What trips next is the localStorage bank cache, and it is silent in the
same way.** `question-quality.mjs`'s `BANK_WARN`/`BANK_FAIL` were
re-pointed at that budget when pagination landed, and they are stated in
MB for it: **6,000 docs ≈ 1.6 MB, 10,000 ≈ 2.7 MB**, against a ~5 MB
origin quota shared with ~29 other `insight.*` keys. The failure mode is
the one this whole section is about — `live.ts` caches the whole bank in
`insight.bankCache.v2` and **swallows a quota failure**, so crossing the
budget breaks nothing visibly: it stops caching, and every boot pays a
full bank fetch forever, with no symptom anywhere.

That is also the line at which §2's own cost table stops being true. The
identical rows above hold *because* the bank is a one-time install cost
absorbed by that cache; lose it and bank size starts billing per boot per
user, which is precisely the regression the table says to watch for.

**The remedy is named at the call site: move the cache to IndexedDB
before promoting past the budget** — and it is smaller than it sounds,
because `persistentLocalCache()` already puts Firestore's own document
cache there. [`BANK-DELIVERY.md`](BANK-DELIVERY.md) is the plan, and it
carries a finding this section did not have: the cache is the SECOND
ceiling, not the first. The learn bank is compiled into the JS bundle,
`check:bundle` has about 39 cards of headroom, and that one is weeks
away rather than years.**

Both are smaller pieces of work than §1's core/tail split and unrelated
to it — those are about what a device can hold, this one about what a
cohort reading may honestly fold.

**Order: the bundle, then the cache, then accelerate.** The cache leaves
~5,300 questions of headroom, which is years at the lanes' combined
pace; the bundle leaves about a fortnight.

**Point volume at the surface that can retire.** Feed questions carry
`active: false` (D52's shape, honoured by `deck.ts`; six duplicates
already retired that way). **Daily questions cannot retire** — the
positional deck makes it unsafe and D97 records the gap as open. So
high-volume production belongs on the feed, where a mistake is
reversible, and the daily stays a slow, curated, globally shared lane.
That is also exactly what §1 wants.

## 3 · Review at volume — AI reviews, a human approves

`scripts/question-quality.mjs` has already done the hard part of this
argument. Its own header partitions the work: it gates the mechanical
half "so the human review spends itself on the judgments only a human can
make (warmth, semantic dupes, 'does this split or slide')". Take the
residue one at a time and most of it dissolves:

| Residue | Disposition |
| --- | --- |
| Warmth vs outrage | An LLM judges this well |
| Semantic near-dupes | `check:neighbors` owns the lexical half; the semantic half is squarely an LLM task |
| Hard rule 6 paraphrases ("the fjord city") | The current tripwire admits it catches only the obvious form. An LLM is strictly better |
| "Does it split or slide" | **Does not need predicting.** The scorecard already measures it from published aggregates and already emits retirement proposals |

That last row is the important one: it converts the judgement that looked
least automatable into an empirical question answered after the fact.

**Two things do not dissolve, and neither is "humans read better".**

- **Correlated blind spots.** The generator is AI. A reviewer on the same
  model shares its failure modes — if the farm develops a systematic tilt
  in tone or topic, the reviewer is the least likely thing to notice,
  because it has the same tilt. The remedy is **sampled audit**, not full
  review: read one in twenty. At 100/week that is five questions.
- **Blast radius, not quality.** The two-gate design exists so a
  *scheduled job* never holds write access to production content. Keep
  the human on the **merge**, not the reading. Approving a batch is one
  action; reading the batch is the bottleneck.

**What this does to D33.** Its sentence — "review capacity is the binding
constraint, and a queue of unreviewed AI PRs is inventory, not progress"
— stays true and stops binding at the same rate, because the human's unit
of work changes from *read one question* to *approve a batch and audit a
sample*. `scripts/farm-budget.mjs`'s regulator keeps its shape; the
measured promotion throughput it throttles to is simply a much larger
number. **Recorded as D162** (2026-08-15), which reshapes that constraint
rather than applying it.

**Sequencing caveat.** The measure-and-retire half needs traffic — the
scorecard reads published aggregates, and pre-launch there are none. So
before there are users, review is all there is, and the volume that makes
this worth building is the volume that cannot be validated yet.

**Taken further at D212 (2026-08-19), owner's direction.** The second
non-dissolving item above — the human on the merge — is gone for
question content: the lanes merge their own PRs on green gates, the farm
promotes its own batches at a fixed pace, and the 1-in-20 audit became a
standing `check:quality` warning a person spends down on their own clock
rather than a gate that can stop the lanes. The first item (correlated
blind spots → sampled audit) survives unchanged, as does everything that
is not a bank append. D213 took the matching volume step the same day
(feed daily at a 24/topic target; the duel lane's regulator and
Routine). The order-of-work items 3 and 4 below are therefore taken —
review reshaped past what this section proposed, production scaled by
cadence rather than caps — with item 1 (pagination) already built at
D161 and the split's fold enforcement still sequenced with first tail
content.

## 4 · The interest model — `ATTENTION.md` tier 2, with the gap closed

**Most of the signal already exists on the device and is thrown away.**

| Key | What it holds |
| --- | --- |
| `insight.feedPass.v1` | a pass — "not this one", holds forever |
| `insight.feedDefer.v1` | a deferral (D121) — "not now", expires |
| `insight.readRoom.v1` | one bit per answered question |
| `insight.feedVotes.v1` | what was answered, and how |

Plus topic chips, channels and scenes as explicit filters. And
`QUESTION-FARM.md` already records the posture that makes this safe: "a
pass is deliberately local-only on-device; collecting it server-side
would be a real privacy decision".

So tier 2 needs **no new collection** — it needs to read what the device
already writes. That also lets it skip the weakest signal in
`ATTENTION.md`'s table entirely: there is no need to infer dislike from a
scroll-past when the user tapped pass.

**Tier 1 becomes the editing surface, not the alternative.** At an
unbounded bank a stated-preference list cannot order the feed, so
`ATTENTION.md`'s "ship tier 1 and measure whether it is enough" no longer
resolves. What survives from it is the better half, and it should be
treated as a requirement: **the model is shown and editable.** In an app
whose entire pitch is showing you yourself, the interest model is
content, not plumbing — arguably a Mirror reading in its own right.

**Invariants, and one is new:**

- The daily stays global. Cohort comparison is meaningless if different
  people got different questions.
- **The Mirror folds over the core only** (§1). This is the new one, and
  it is what closes `ATTENTION.md`'s separability gap.
- The model never leaves the device.

**No store form moves, and the reason is precise.** Tier 2 uploads
nothing, so `docs/data-inventory.md`'s "not collected" stays literally
true, there is no advertising or analytics identifier, no consent flow
and no tracking prompt. On-device is not the compromise version here —
it is the version with the better inputs, because the phone holds the
person's actual answers across the whole bank and no third party could
have that. `ATTENTION.md` tier 3 is a different question and still
carries its store-form cost.

## 5 · Monetization, re-derived against an infinite feed

The session began here, so the conclusions are recorded even though the
build order puts them last.

**Attention budgets — sell scheduled slots, not observed impressions.**
The idea is sound and its best property is structural: naming a cohort's
attention as finite makes the cap **the unit of sale**, so inventory
cannot be quietly inflated without visibly devaluing what was already
sold. That is the `check:globals` rule-4 ratchet shape, pointed at
revenue.

It is buildable here only because of one fact: the feed is served in a
deterministic order, so **the inventory is computable without telemetry**
— a slot's existence is a property of the content schedule, not of
observed behaviour. This matters because `ATTENTION.md`'s cost rule
forbids an event per impression outright. So:

- **Bill on answers, not impressions.** Answers are what the server
  already counts and already publishes. The result is a market with no
  measurement asymmetry: buyer, seller and the people answering all read
  the same public number.
- **Buyable cohorts are exactly the published breakdown dims** — the
  cohorts a user can already see themselves counted in. Self-limiting,
  and it excludes profession (never a dim, D8) and the politics result
  (Art. 9) without needing a special rule for either.
- **Auction-priced, not auction-delivered.** `NEXT-FUNCTIONALITY.md` §6
  already draws this line; nothing here widens it.
- **Sponsored content lives in the tail, never the core.** New, and it
  falls straight out of §1: paid questions in the Mirror's corpus would
  make the honest aggregate a paid-for sample. **Built and enforced at
  [D195](DECISIONS.md#d195--the-paid-slot-is-built-and-nobody-has-bought-it-yet)** — `check:content` refuses `core: true` on a sponsored question. A sponsor still gets the
  exact public split of their own question — aggregates publish for every
  question — they simply do not get their question woven into everyone's
  Mirror.

**Targeted ads — what stays refused, and why it is not a posture
argument.** The tracking-apparatus version stays out on three grounds
that are independent of feed size: the politics result is special-category
data (GDPR Art. 9) and DSA Art. 26(3) bans profiling-based ads on
special categories outright, with EU trader status declared at D69; the
store declarations move immediately (`advertising: false`, D16's SDK
strip, `check:ios-facebook`) and `SHIP-CHECKLIST.md` calls
under-declaration the direction that gets an app pulled; and the app
would be telling two stories at once, which is the exact failure
`CLAUDE.md` names.

One argument against ads *did* fall to decision 1 and is withdrawn: "an
ads business needs an infinite feed and this one is structurally finite"
was a claim about the current bank, not about intent.

What remains available is the version already recorded — disclosed
cards, selected on-device from local anchors, no SDK, no server-side
profile — and §4 makes it strictly better, because the device now holds
an interest model no ad network could reconstruct.

**Sequencing.** The contract path needs no code: a place-scoped question
is an ordinary question, and invoicing lives outside this repo. Sell by
hand, at a price set by hand, and let the hand-negotiated prices be the
price discovery. The day a buyer is turned away because a window was
full, there is demand evidence, and *that* is the trigger to build a
clearing engine — not before.

## 6 · Order of work

1. **Bank pagination.** Blocks everything else and the headroom is weeks
   at the new rate. Half-built already.
2. **The core/tail split.** *Flag, classification and gate DONE
   2026-08-15* — the half that got dearer with time. What remains is the
   Mirror's fold reading it and the test that pins it, which costs the
   same whenever it lands and is sequenced with the first tail content.
3. **Review reshape** — AI review, batch approval, sampled audit. Needs a
   DECISIONS.md record (§3).
4. **Production scale-up**, once 1–3 hold. Onto the feed surface, which
   can retire.
5. **Interest model tier 2**, reading the device state that already
   exists, shown and editable, tail only.
6. **The core-size ratio as a gate**, once there is a population to
   measure it against.
7. **Monetization**, in step with traction: contract path whenever there
   is an audience worth buying; disclosure chrome and provenance next;
   any market mechanism last, and only on demand evidence.

## 7 · Failure modes

| Failure | Mitigation | Residual |
| --- | --- | --- |
| Bank outgrows the fetch ceiling | `check:quality` fails before the silent truncation; paginate first | None if the order in §6 holds |
| Personalized feed biases the Mirror's sample | Core/tail split, with a test asserting the Mirror never folds a tail question | Prose without the test; the constraint rots exactly as `ATTENTION.md`'s feed-only rule would |
| AI review shares the generator's blind spots | Sampled human audit, one in twenty | A tilt subtle enough to survive a 5% sample |
| Volume degrades the Map | Miscategorisation lands on a branch forever; retire-able surface only | The daily lane still cannot retire (D97) |
| Core grows faster than the population | The ratio gate (§6 item 6) | Until it exists, the Mirror can thin without anyone noticing |
| Sponsored content reaches the Mirror's corpus | Tail-only placement, same flag as §1 | An operator who flags a sponsored question core |
| Cost surprise | The model takes production rate as an input; re-run it, do not reason about it | Three behaviour inputs are still guesses (`COSTS.md` says which) |
| A capped read truncates by NAME, not by recency | `fetchAnswersOf` (`src/v2/data/circle.ts`) caps at 300 answers per followed account with no `orderBy`, and an unordered `limit` takes documents by question id — so past the cap a circle member's likeness is computed from the alphabetically-first slice of what they answered, and it still draws | **Binds today.** The row read "cannot bind at ~130 core questions" until 2026-08-31's closing review measured it against the wrong bank: the query asks for `WORLD_ANSWER_SURFACES`, six surfaces totalling 644 answerable questions today (daily 130 · feed 190 · test 160 · learn 156 · pulse 5 · call 3) against a cap of 300. No bank growth needed. Ordering it needs a composite index on (`surface` ASC, `answeredAt` DESC) over the `answers` collection, which this repo pays for on every answer ever written — so the cost goes to the owner now rather than waiting behind the pagination work |

## 8 · What I would do

Pagination, then scale. **The core flag is done** (2026-08-15) — it was
the item that got dearer with time, because retro-classifying a
5,000-question bank is a judgement call per question, which is the same
bottleneck §3 exists to remove arriving through the back door. Doing it
at 513 cost one mechanical edit and a gate. Pagination is what remains in
front of any production increase, and it is a bounded piece of work that
is already half-done.

Everything else on this page can wait for users, and most of it should:
the review reshape cannot be validated without traffic, the interest
model has nothing to learn from an empty feed, and the monetization
section is a plan for a demand signal that does not exist yet.
