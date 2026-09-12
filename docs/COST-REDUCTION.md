# Getting the bill down

> **Read [`DATA-EFFICIENCY.md`](DATA-EFFICIENCY.md) beside this (2026-09-08).**
> This page's levers are caps and cadences on the shapes as built, and its
> §5 refuses to trim the three D98 surfaces because a thinner picture is
> not a saving. That page keeps the picture and changes the DOCUMENTS the
> surfaces read — one precomputed document where three hundred answer
> documents are read today — and prices it with `npm run costs:structure`:
> the same reads per user per day this page's tables carry, about 380,
> become about 60.

> **Partly executed, 2026-08-13 (D129).** The owner read the analysis below
> and chose to build the big one rather than defer it. The deck is polled
> instead of streamed, and the voter name cache is persisted. What that did:
>
> | DAU | before | after | |
> | ---: | ---: | ---: | --- |
> | 500 | $2.23 | **$2.12** | −4.7% |
> | 5,000 | $59 | **$41** | −31.4% |
> | 50,000 | $2,335 | **$440** | −81.2% |
> | 500,000 | $194,332 | **$4,448** | **−97.7%** |
>
> The totals matter less than the shape: **reads per user per day are now
> flat at 416 at every size**, cost per user rises 2.1× between 500 and
> 500 k DAU rather than 87×, and every scenario grades B. Snap and Signal
> are now never overtaken at any size.
>
> **It saved less than this page promised, and the reason is instructive.**
> The lever arithmetic priced polling at *zero* — `pollAggs` set both
> `fanOut` and `reattach` to 0 — so the $1,524 figure below for path B was
> a fix modelled as free. Charged honestly a poll costs
> `(visible minutes / interval)` reads a day, and the 500 k row lands at
> $4,448. That is D67's "not modelled reads as free" pointed at our own
> remedy, which is the worst place for it: the entire case for the change
> rested on that one term. `AGG_POLL_MS` is now read from source and
> `pulse.test.mjs` pins the term non-zero.
>
> **THE REGION LEVER IS TAKEN (D165, 2026-08-15).** Every table below
> measures its levers against the `nam5` baseline this page was written on,
> and row **[C]** — the single-region database, 47–50% of every Firestore
> line and the largest saving in the file — is **already done**: production
> is `insight` / `europe-west1`. Read `[C]` as history and every other
> row's percentage as a share of a bill that is already half what these
> tables print. The model itself was still pricing `nam5` until D200, three
> days after the migration, because the region was a default parameter
> rather than a fact read from the tree.
>
> **The rest of this page still stands and is now the remaining work.** The cap
> trims are still the worst ratio of product cost to money and are still
> not recommended. Batching the mirror publish has gone from −78% to −0.0%,
> because it divided a fan-out that no longer exists. Numbers below the
> fold are pre-D129; `npm run costs:levers` prints today's.

[`docs/COSTS.md`](COSTS.md) says what this costs.
[`docs/COST-COMPARISON.md`](COST-COMPARISON.md) says whether that is a lot
(cheap in absolute terms; the 87× rise in cost per user between 500 and
500,000 DAU that both pages were organised around is gone, and today's
multiple is 0.7× — it falls). This says what to do about it.

Written 2026-08-13 against `f07cbf8`. Reproduce with
`npm run costs:levers`. Every dollar comes from `scripts/cost-arith.mjs`
and every grade from `scripts/cost-peers.mjs`; the only thing
`scripts/cost-levers.mjs` adds is the list of changes, each expressed in
the units of the thing it would change rather than as a saving — so no
figure below is typed, and none can go stale while the constant beside it
moves.

## Does any of this remove functionality?

Asked after the plan below was first written, and the answer changed it —
so it goes first. **Almost none of it does, and the part that saves the
most money costs the product the least.**

Each lever was checked against its *consumers*, not just against the model:

| Lever | Removes functionality? |
| --- | --- |
| Single-region database | **No.** Nothing in the app changes. The trade is resilience to a whole-region outage. |
| Serve the bank off Hosting | **No.** Cold boot gets faster. |
| Persist the name cache | **No** — but it needs a TTL. `resolveNames` takes a caller-owned record, so persisting it means a renamed account shows its old name until the cache expires. |
| Stream today only | **Almost none.** `computeDeckIds` returns today plus 6 back days and all are answerable, so past aggregates *do* move — just rarely. You would stop seeing a 4-day-old card tick while looking at it. |
| **Poll instead of stream** | **Less than it sounds.** Other people's votes stop landing live. Your own vote still confirms — `scheduleAggRefresh` (live.ts:390) re-reads the aggregate 2.5 s after the write acks and clears the pending flag, on both the vote and D86 edit paths, with no listener involved. |
| Who-voted 200 → 50 | **Yes, mildly.** Fewer faces per sheet. Honesty is automatic: the Friends cut interpolates the cap (`the newest ${VOTER_FETCH_CAP}`), so copy and tests follow the constant. Wants the "load more" cursor to not be a pure loss. |
| Circle 300 → 100 | **Yes, mildly.** Circle compares over ~5 weeks of a member's answers instead of ~13. |
| Batch publish ×5 | **Yes, mildly.** The live count steps in fives. |
| Kindred 12 → 4 | **Yes, genuinely.** The People lens ranks likeness over 4 shared questions instead of 12. It stays honest by itself — `LiveMirrorLenses` renders "across your last {kindredDepth()}" — but a likeness claim over 4 questions is a materially weaker claim. |

That splits the plan cleanly, and the split is the useful part:

**Re-printed from the model 2026-09-12, and every figure moved.** The lever
table further down was re-printed on the 11th, the day `npm run
costs:levers` was revived — and the PATH tables, which the same script
prints from the same model, were left carrying the pre-D129 baseline. One
document, two tables, a day apart, and only one of them true. The old
figures are what this page was written on: as built $194,332 at 500 k DAU
against $2,365 today, because polling shipped (D129), the sample read
shipped (D397) and the runbook's three read paths shipped after it.

| Path | 500 | 5 k | 50 k | 500 k | 500→500 k | what it costs the product |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| As built | $3.21 | $25 | $238 | $2,365 | 0.7× | — |
| **R · Region only** | $1.96 | $14 | $128 | $1,280 | 0.7× | **nothing** |
| **R + client trim** | $1.95 | $14 | $126 | $1,266 | 0.6× | nothing a user can see |
| A · Keep it live | $2.88 | $22 | $205 | $2,037 | 0.7× | thinner Kindred, who-voted |
| B · Go polled | $2.88 | $22 | $205 | $2,037 | 0.7× | identical to A — see below |
| C · B + single region | $1.79 | $12 | $111 | $1,108 | 0.6× | same as B, single region |

**The region lever is now the whole plan: −46% at 500 k, and it costs the
product nothing.** Everything else on offer is a rounding error beside it.

**A and B are the same path now.** What separated them was polling, and
polling shipped at D129 — so "go polled" is the baseline, not a lever, and
the two rows differ only in a publish batch that divides a term nothing
computes any more (the † note below says why it stays listed).

**The slope question has stopped being a question.** The last column is the
multiple between $/DAU/month at 500 and at 500 k, and it is now BELOW ONE
on every path including the app as built: cost per user FALLS as the app
grows. The quadratic term this page was organised around is gone, removed
by the changes the banners at the top record. Sections below that reason
about a steepening curve are answering a question the model no longer
poses; they are kept because the failure mode they describe is real and
will return the moment anything re-attaches a listener to an aggregate.

Everything that genuinely thins a Mirror surface — Kindred, Circle,
who-voted — is the difference between **$1,280 and $1,108 at 500 k DAU**:
the region lever alone against the region lever plus every trim. About
$170/month at a size the app may never reach, and nothing worth naming
below 5 k.

**So: don't trim the caps.** They are not where the money is — and since
the sample read shipped (D397) they are not where the GROWTH is either,
which is the half of this sentence that used to do the work.

## The short answer

**Nothing, yet — and then one specific thing.**

At today's size the bill is $0. At the size the launch plan aims for it is
about $2/month. There is no version of this analysis where acting now is
correct, and D7 already says so.

But the question "how do we get this manageable" has a precise answer worth
knowing in advance, because it is **not** the obvious one:

| Path | 5 k DAU | 50 k DAU | 500 k DAU | 500 → 500 k |
| --- | ---: | ---: | ---: | ---: |
| **As built** | $25 | $238 | $2,365 | 0.7× |
| **R · Region only** | $14 | $128 | **$1,280** | 0.7× |
| **A · Keep it live** | $22 | $205 | $2,037 | 0.7× |
| **B · Go polled** | $22 | $205 | $2,037 | 0.7× |
| **C · B + single region** | $12 | $111 | **$1,108** | 0.6× |

**The single-region database cuts the 500 k bill by 46%, and nothing else
here cuts more than 14%.** One change does nearly all of it — and it is
the one change with no product cost at all. (Re-printed 2026-09-12 with
the table above; what these rows said before is in that note.)

## Why there is no single answer

The bill is two different problems at two different sizes:

| DAU | boot | topUp | reseed | fanOut | reattach | rules | server | social | dominant |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 500 | 21 | 42 | 3 | 15 | 28 | 6 | 14 | **219** | social |
| 5,000 | 21 | 2 | 3 | 146 | 28 | 6 | 14 | **339** | social |
| 50,000 | 21 | 2 | 3 | **1,458** | 28 | 6 | 14 | 339 | fanOut |
| 500,000 | 21 | 2 | 3 | **14,583** | 28 | 6 | 14 | 339 | fanOut |

Below ~10 k DAU the bill is `social` — the D98 surfaces reading other
users' answers. It is **flat per user** and moves with a cap or an open
rate, so it is cut by product decisions costing an afternoon.

Above ~14 k DAU the bill is `fanOut` — every answer to the globally shared
daily question, delivered to every attached listener. It is **quadratic in
DAU** and no cap touches it. It is cut by publishing less or listening
less, and by nothing else.

A plan that fixes only one of those fixes the app at only one size.

## Every lever, priced

`[C]` client · `[P]` product · `[A]` architecture. Percentage off the
total bill at that size:

**Re-printed from the model 2026-09-11 — every figure below moved, and
three rows stopped being levers at all.** The numbers this table carried
until then were computed before D129, D397 and DATA-EFFICIENCY-RUNBOOK
2.2/2.3/3.5 shipped, and `npm run costs:levers` — the script whose whole
job is re-printing them — had been **dead on `main` since 580f388**
(2026-09-09): a `TypeError` two sections in, so the run that would have
caught the drift could not finish. Fixed and given the suite it never had
(`scripts/cost-levers.test.mjs`, in `npm run test:scripts`). This is the
folklore the script's own header says it exists to prevent, and it got in
through the one door nothing was watching.

| Lever | 500 | 5 k | 50 k | 500 k |
| --- | ---: | ---: | ---: | ---: |
| `[C]` Single-region database [TAKEN — D165] | −39% | −46% | −46% | −46% |
| `[P]` Kindred walks 4 lists, not 12 | −0.1% | −0.2% | −0.2% | −0.2% |
| `[P]` Who-voted pages at 50 | −9% | −12% | −12% | −13% |
| `[A]` Batch the mirror publish (×5) † | −0.0% | −0.0% | −0.0% | −0.0% |
| `[A]` Serve the bank off Hosting | −0.8% | −1% | −1% | −1% |
| `[A]` **[SHIPPED D129] Poll instead of stream** | −14% | −52% | −91% | −99.1% |

† Worth nothing against the app **as built**, and that is a fact about the
app rather than about the lever: `publishEvery` divides the fan-out term
only on the streaming branch (`cost-arith.mjs:937`), and since D129 nothing
streams, so there is nothing to batch. It stays listed because it becomes
the largest architectural saving again the moment anything re-attaches a
listener to an aggregate. The suite now fails on any UNMARKED lever that
saves ~nothing at every size — a lever whose `opts` the model has stopped
reading prints `−0.0%` exactly like a measured nothing, which is how a
plan quietly acquires a dead entry.

**Three rows left this table**, because the changes they proposed shipped
and the levers were removed from the script: *Stream today only* and
*Persist the name cache* (D129), and *Circle reads 100 answers/member*
(runbook 3.5 — `cost-arith.mjs:818`, the Circle term is now one document
per member, so `CIRCLE_ANSWER_CAP` no longer prices a stop open). The
third is the one that broke the run: it left `LEVERS` and stayed in three
`PATHS` entries.

The shape of that table is still the finding, and **the shape has moved
with it**: the social levers are no longer nearly worthless on the right —
capping who-voted pages is −9% at 500 DAU and −13% at 500 k, a nearly flat
line where it used to fall from −62% to −0.7%. That is what shipping the
sample read did (D397): the social term stopped scaling with the crowd, so
what is left of it is flat, and the remaining spread across sizes belongs
almost entirely to fan-out. Polling removes 99.1% at 500 k and 14% at 500.
**Whether that changes the plan is the owner's read, not this page's** —
the two-regime argument above is unchanged in direction and weaker in
degree, and nothing here re-decides it.

Two notes on individual rows:

- **Single-region is the only lever with a deadline.** A Firestore
  database's location is fixed at creation, so this one stops being
  available the moment the content seed runs. It is also the only lever
  that costs nothing and changes nothing a user sees — the trade is
  resilience to a region outage.
- **Circle at 500 DAU shows −0.0%, which is not a rounding error.** The
  cap only binds once accounts are old enough to have >100 answers; in a
  fresh community it is not reached, so lowering it does nothing. It is a
  lever that arms itself as the community ages.

## What each path costs to build, and what a user notices

The dollars above are computed. **These three columns are not**, and they
are what actually decides the order:

| Lever | Effort | Risk | What a user notices |
| --- | --- | --- | --- |
| Single-region database | one setting | **irreversible, has a deadline** | nothing, until a region outage |
| Stream today only | hours | low | nothing — past days barely move |
| Persist the name cache | hours | low — names are public (D98) | nothing; sheets get faster |
| Kindred 12 → 4 | one constant | low | a thinner People lens |
| Who-voted 200 → 50 | one constant + "load more" | low | "the latest 50 of N" |
| Circle 300 → 100 | one constant | low | Circle compares over ~5 weeks, not ~13 |
| Batch publish ×5 | days | medium | the live count steps in fives |
| Bank off Hosting | days | low | nothing; cold boot faster |
| **Poll instead of stream** | days | medium | **counts update on a timer, not instantly** |

That last cell is the whole decision. Everything else on this page is
arithmetic; whether today's count may lag a few seconds is a product
question, and it is the one that unlocks 98% of the saving at scale.

COSTS.md already calls it "a display cadence choice, not an architectural
one", which is right — and worth restating as the trade it is: the daily
question is answered once, by each person, in a four-hour morning window.
The live count exists so a voter sees the room move. A poll on vote plus a
slow timer shows the same room, a few seconds later.

## The trap: cutting the bill without fixing the shape

Path A is every lever **except** polling — the social trims plus ×5
batching. **Re-printed 2026-09-12 with the tables above**, and this section
is the one the re-print changed most: it was written against a model whose
cost per user rose 87× between 500 and 500 k DAU, and that term is gone.

| Path | $/DAU/mo at 500 | at 500 k | 500 → 500 k |
| --- | ---: | ---: | ---: |
| As built | $0.00642 | $0.00473 | 0.7× |
| **A · Keep it live** | $0.00577 | $0.00407 | 0.7× |
| B · Go polled | $0.00577 | $0.00407 | 0.7× |
| **R · Region only** | $0.00392 | $0.00256 | 0.7× |
| C · B + single region | $0.00358 | $0.00222 | 0.6× |

Every multiple is below one: cost per user now FALLS as the app grows, on
every path and on the app as built. Path A no longer steepens anything —
it moves the height of the curve by 10–14% and leaves its shape alone,
which the printer now says in its own words rather than asserting a
direction (`scripts/cost-levers.mjs` §4, which read the wrong path's
figures for this paragraph until 2026-09-12).

**The failure mode is still the one to watch for, and it is no longer
today's.** A plan made of only cheap levers reports large percentage
savings while leaving the app's cost quadratic in its own success — that
was exactly true of this page's own first answer, and it stopped being
true when the quadratic term was removed rather than when the levers got
better. It returns the day anything re-attaches a listener to an
aggregate, which is the same day the ×5 publish batch stops being worth
−0.0%. Until then the money is in the region lever, and the region lever
costs the product nothing.

## What no lever here touches

- **41 reads/user/day are irreducible** after path B — boot, rule
  evaluation and server-side reads. Flat at every size, answer-driven, and
  not worth attention: 41 against the 558 the app charges today.
- **The auth billing mode.** COSTS.md finding 3, still open, still
  console-only, and still the largest single line that could be wrong
  without any code being wrong — four figures a month at 150 k MAU. It
  outweighs every lever on this page below 50 k DAU and costs five minutes
  to check.
- **App Check enforcement on the Firestore API.** An unmetered read path is
  not a lever, it is a hole: the arithmetic in COSTS.md puts a sustained
  2,000 reads/sec at $3,110/month, which is larger than any saving here at
  any size below 100 k DAU. It also cannot be armed during an incident —
  the soak takes days — so it is a launch item that happens to be the
  cheapest cost control available.

## Recommendation

1. **Now, before the seed: decide the region.** It is the only lever with a
   deadline, it is worth 35–50% of every Firestore line forever, and it
   costs one setting. If a single-region outage is an acceptable risk for
   this app — and for a daily-question app it plausibly is — take it.
2. **Now, and not for cost reasons: check the auth billing mode, and set up
   App Check enforcement.** Both are larger than anything else here, both
   are already on SHIP-CHECKLIST, and neither is a code change.
3. **Not yet: everything else.** At launch sizes the entire lever list is
   worth about $2/month. D7 is right.
4. **The trigger is already written down.** COSTS.md's two walls sit at
   ~14,145 and ~14,400 DAU, and they are the same trigger as this page's:
   at that size the fan-out overtakes every flat source combined and the
   shared aggregate starts losing writes to contention. **Build path
   Z + poll when the app passes ~10 k DAU** — early enough to ship before
   either wall, late enough that D7 still holds.
5. **Do not trim the caps.** Kindred, Circle and the who-voted page size
   are the only levers that thin a Mirror surface, and together they are
   worth ~$850/month at 500 k DAU and nothing below 5 k. They are the
   worst ratio of product cost to money on this page. If the bill ever
   makes them necessary, the fan-out is not fixed yet.

The reassuring version: this app has a cost problem that is one change
deep, the change is already described in COSTS.md, it is reversible, and
the arithmetic says it is worth $190 k/month at the top row and nothing at
all today. That is a good position — a known, priced, deferred fix with a
numeric trigger, rather than a surprise.
