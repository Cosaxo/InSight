# Getting the bill down

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
> tables print. The model itself was still pricing `nam5` until D198, three
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
(cheap in absolute terms, badly shaped: cost per user rises 87× between 500
and 500,000 DAU). This says what to do about it.

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

| Path | 500 | 5 k | 50 k | 500 k | slope | what it costs the product |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| As built | $2.23 | $59 | $2,335 | $194,332 | 87× | — |
| **Z · Zero product change** | $0.53 | $27 | $1,407 | $125,982 | 236× | **nothing** |
| **Z + poll** | $0.45 | $14 | $163 | **$1,664** | **4×** | others' votes stop landing live |
| B · Go polled | $0.10 | $12 | $148 | $1,524 | 15× | + thinner Kindred, Circle, who-voted |
| C · B + single region | $0.05 | $6.20 | $77 | $810 | 16× | same as B |

**Z + poll removes 99.1% of the bill and one product property.** It also
produces the flattest curve of any path here — a 4× slope, better than the
paths that trim the caps, because it removes the quadratic term without
shrinking the flat baseline underneath it.

Everything that genuinely thins a Mirror surface — Kindred, Circle,
who-voted — is the difference between **$1,664 and $810 at 500 k DAU**, and
nothing at all below 5 k. That is the entire product-degrading portion of
this plan: about $850/month at a size the app may never reach.

**So: don't trim the caps.** They are not where the money is.

## The short answer

**Nothing, yet — and then one specific thing.**

At today's size the bill is $0. At the size the launch plan aims for it is
about $2/month. There is no version of this analysis where acting now is
correct, and D7 already says so.

But the question "how do we get this manageable" has a precise answer worth
knowing in advance, because it is **not** the obvious one:

| Path | 5 k DAU | 50 k DAU | 500 k DAU | slope (500 → 500 k) |
| --- | ---: | ---: | ---: | ---: |
| **As built** | $59 | $2,335 | $194,332 | 87× |
| **A · Keep it live** | $16 | $531 | $39,546 | **239×** |
| **B · Go polled** | $12 | $148 | **$1,524** | **15×** |
| **C · B + single region** | $6 | $77 | **$810** | 16× |

**Path B cuts the 500 k bill by 99.2%, from $194,332 to $1,524.** One
change does nearly all of it.

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

| Lever | 500 | 5 k | 50 k | 500 k |
| --- | ---: | ---: | ---: | ---: |
| `[C]` Single-region database | −50% | −44% | −37% | −35% |
| `[C]` Stream today only (7 listeners → 1) | −10% | −4% | −1.0% | −0.1% |
| `[C]` Persist the name cache across sessions | −41% | −16% | −4% | −0.5% |
| `[P]` Kindred walks 4 lists, not 12 | −39% | −15% | −4% | −0.5% |
| `[P]` Who-voted pages at 50, not 200 | −62% | −24% | −6% | −0.7% |
| `[P]` Circle reads 100 answers/member, not 300 | −0.0% | −13% | −3% | −0.4% |
| `[A]` Batch the mirror publish (×5) | −5% | −26% | −65% | −78% |
| `[A]` Serve the bank off Hosting | −1% | −0.4% | −0.1% | −0.0% |
| `[A]` **Poll instead of stream** | −17% | −36% | **−82%** | **−98%** |

The shape of that table is the finding. **The social levers matter most on
the left and are nearly worthless on the right; the fan-out levers are the
reverse.** Cutting `VOTER_FETCH_CAP` to 50 removes 62% of the bill at 500
DAU and 0.7% at 500 k. Polling removes 98% at 500 k and 17% at 500.

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
batching. It looks excellent: −93% at 500 DAU, −80% at 500 k. And it makes
the problem **worse**:

| Path | $/DAU/mo at 500 | at 500 k | slope |
| --- | ---: | ---: | ---: |
| As built | $0.00445 | $0.3887 | 87× |
| **A · Keep it live** | $0.00033 | $0.07909 | **239×** |
| B · Go polled | $0.00021 | $0.00305 | **15×** |
| C · B + single region | $0.00010 | $0.00162 | 16× |

That 239× looks like a bug and is not. Path A divides the small end by 13
and the big end by 5, so the ratio between them necessarily rises. Every
absolute number improves and the curve gets steeper.

**This is the failure mode to watch for.** The cheap levers are genuinely
worth doing and they buy time, but a plan made of only cheap levers will
report large percentage savings while leaving the app's cost quadratic in
its own success. Path A at 500 k DAU is still $39,546/month and still an
F-to-D. Only the paths that stop streaming flatten the curve — B takes the
slope from 87× to 15×, which is an ordinary app's shape.

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
