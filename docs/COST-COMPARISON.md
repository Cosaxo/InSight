# Is that a lot? InSight's bill against other apps'

> **Superseded in its conclusion twice over, and kept for its method.**
> This page's finding was that the app was cheap in absolute terms and
> badly shaped — cost per user rising 87× between 500 and 500,000 DAU, and
> passing Snapchat's per-user infrastructure cost at ~361 k DAU. That
> analysis is what prompted the fix, and the fix came in two stages:
>
> - **D129** replaced the streamed deck with a poll, which removed the
>   quadratic fan-out.
> - **`docs/COST-PLAN.md`** then found that the three cross-user surfaces
>   were reading *answers* to answer questions about *people* — the
>   Friends cut sampling 200 recent answers hoping your follows were among
>   them, Kindred reading ~2,400 to build a pool it ranked on profile
>   scores. Asking directly took the bill from $4,774 to **$2,158** at
>   500 k DAU and made all three surfaces more correct.
>
> Today the script prints **a B at every size from 3 k up, an A at 500,
> and reads/user/day that are IDENTICAL at 5 k, 50 k and 500 k** — flat,
> where this page's whole argument was about a slope. Snap and Signal are
> never overtaken at any size.
>
> One number below still reads alarmingly and should not: the unit-cost
> rise is now 3.7×, *worse* than the 2.1× D129 left, because the fixes
> divided the small end by more than the big end while every absolute
> figure fell. Measured above the free tier — 5 k to 500 k — it is 1.19×.
> That is the trap `COST-REDUCTION.md` names as path A, seen from the
> other side: a ratio between two shrinking numbers is not a shape.
>
> The peer table, the denominators and the skews below are unchanged and
> still the way to re-run this; the grades and multiples in the prose are
> the pre-D129 ones. `npm run costs:compare` prints today's.
>
> **The largest unpriced item is no longer on this page at all.** If the
> project is on Identity Platform billing, auth alone exceeds the entire
> infrastructure bill from 50 k DAU up (COSTS.md finding 3) — a console
> setting, still unrecorded, and worth more than everything this page
> measures.

[`docs/COSTS.md`](COSTS.md) answers *what will this cost*. This answers *is
that a lot*, which is a different question and needs something the model
cannot supply: somebody else's invoice.

Written 2026-08-13 against `c388d7a`. Reproduce with
`node scripts/cost-compare.mjs` (add `--regional` for the single-region
price sheet). Every InSight figure comes from `scripts/cost-arith.mjs` —
the same module `cost-model.mjs` and `pulse.mjs` read, so there is no
second copy of the arithmetic to drift. The peer figures are new, they are
the only numbers here nothing in this repository can check, and they are
labelled accordingly.

## The answer in one table

| DAU | total/mo | $/DAU/mo | grade | verdict |
| ---: | ---: | ---: | :---: | --- |
| 50 | $0 | $0 | **A+** | free — inside the free tier |
| 500 | $2.23 | $0.00445 | **B** | normal for the stack |
| 3,000 | $30 | $0.00990 | **C** | expensive for what it does |
| 5,000 | $59 | $0.01187 | **C** | expensive for what it does |
| 50,000 | $2,335 | $0.04670 | **D** | approaching a video app's per-user cost |
| 100,000 | $8,473 | $0.08473 | **D** | approaching a video app's per-user cost |
| 500,000 | $194,332 | $0.3887 | **F** | costs more per user than Snapchat, doing far less |

Grades are relative to the same-stack benchmark ($0.00298/DAU/month, below),
not absolute: A under 1×, B under 3×, C under 10×, D under Snap's $0.2831,
F above it.

**Read the two numeric columns together, because they disagree and the
disagreement is the answer.** A "C" beside $59/month is not a call to
action; it is a warning about a *slope*, priced at a size where the absolute
number is lunch money. Report only the grade and you panic a reader out of
launching. Report only the total and you hide the thing that matters.

So: **this app is cheap to run and badly shaped.** At every size anyone
should be planning for it is affordable — under $60/month at real traction,
the same order as the fixed costs it sits beside (COSTS.md's fixed-cost
table: ≈$30/month, mostly the Apple developer program and the question
farm's Claude subscription). What is wrong is not the level. It is the
direction.

## The finding: unit cost goes the wrong way

Cost per user is supposed to *fall* as an app grows. Fixed costs amortise,
caches warm, negotiated rates kick in. Here it does the opposite:

| DAU | $/DAU/mo | $/MAU/mo | $/MAU/yr | vs the 500-DAU row |
| ---: | ---: | ---: | ---: | ---: |
| 500 | $0.00445 | $0.00148 | $0.0178 | — |
| 3,000 | $0.00990 | $0.00330 | $0.0396 | 2.2× |
| 5,000 | $0.01187 | $0.00396 | $0.0475 | 2.7× |
| 50,000 | $0.04670 | $0.01557 | $0.1868 | 10.5× |
| 100,000 | $0.08473 | $0.02824 | $0.3389 | 19.0× |
| 500,000 | $0.3887 | $0.1296 | $1.5547 | **87.3×** |

A user at 500,000 DAU costs 87 times what a user at 500 DAU costs. Nothing
about that user changed — same question, same four answers, same seven
listeners. What changed is how many *other* people are answering the same
globally shared daily question while they watch it, and every one of those
answers is a billed delivery to their device. That is COSTS.md's Finding 2,
the listener fan-out, seen from the unit-economics side instead of the
total-bill side.

MAU is carried alongside DAU because the peers below do not all publish the
same denominator, and picking whichever one flatters us would be the easiest
lie in this document.

## The peers

Four, chosen to bracket the question rather than to flatter it. One shares
the **stack**, one shares the **category**, one shares the **privacy
posture**, and one is the read-heavy **floor** — the cheapest well-known
thing that serves a planet, which is the right lower bound for an app whose
bill is 70% reads.

| Peer | What it is | $/user/mo | Denominator |
| --- | --- | ---: | --- |
| **Snap (Snapchat)** | consumer social, video + AI/ML, 493 M DAU | $0.2831 | DAU |
| **Typical Firestore app** | same stack, well-optimised, social features | $0.00298 | DAU |
| **Signal** | E2EE messenger, ~85 M users | $0.01373 | registered users |
| **Wikimedia / Wikipedia** | read-heavy public content, on-prem | $0.00030 | monthly unique devices |

Where each comes from, and — more important — **which way each comparison
is unfair**:

- **Snap: $1.65–1.70 bn FY2026 infrastructure guidance ÷ 12 ÷ 493 M Q2'26
  DAU = $0.2831.** The anchor peer, because it is the only one that
  publishes the ratio directly and so can be checked rather than trusted:
  Snap stated **$0.86 per DAU per quarter** in Q4'25, and ÷3 gives $0.2867
  — 1% from the guidance-derived figure. Two independent routes agreeing is
  what makes this the row to argue with. *Skew: like-for-like. Same
  denominator, same category. This one is honest.*
- **Typical Firestore app: $298/month at 100 k DAU = $0.00298.** Same stack,
  so it isolates "expensive *for a Firebase app*" from "Firebase is
  expensive". The same source's 3 k DAU row implies $0.00180, 40% lower —
  not an error, just a smaller app sitting further inside the free tier.
  *Skew: like-for-like on stack and denominator, but it is a vendor
  estimator, not an invoice.*
- **Signal: $14 M/yr total infrastructure ÷ 12 ÷ ~85 M users = $0.01373.**
  Ex-SMS (removing $6 M/yr of registration fees, which InSight has no
  equivalent of) it is $0.00784. *Skew: **unfair to InSight**. Registered
  users vastly outnumber daily ones, so Signal's true per-DAU figure is
  higher than this and the real gap is smaller.*
- **Wikimedia: $3.4 M/yr internet hosting ÷ 12 ÷ ~950 M monthly unique
  devices = $0.00030.** *Skew: **unfair to InSight**. Monthly uniques, and
  owned hardware rather than rented cloud — this is a floor, not a target.*

Two of the four skews run against InSight, which is deliberate. A
comparison table whose every caveat happens to excuse the subject is not a
comparison table.

### The multiples

| DAU | vs Snap | vs Firestore app | vs Signal | vs Wikimedia |
| ---: | ---: | ---: | ---: | ---: |
| 500 | 0.02× | 1.5× | 0.3× | 14.9× |
| 3,000 | 0.03× | 3.3× | 0.7× | 33.2× |
| 5,000 | 0.04× | 4.0× | 0.9× | 39.8× |
| 50,000 | 0.2× | 15.7× | 3.4× | 157× |
| 100,000 | 0.3× | 28.4× | 6.2× | 284× |
| 500,000 | **1.4×** | **130×** | **28.3×** | **1,303×** |

And the sizes where InSight overtakes each:

| Peer | InSight passes it at |
| --- | ---: |
| Wikimedia | ~200 DAU |
| Typical Firestore app | ~285 DAU |
| Signal | ~7,177 DAU |
| **Snap** | **~361,093 DAU** |

The first two crossovers are artefacts and should be read as such: the bill
is $0 below ~177 DAU (free tier), so "passes Wikimedia at 200 DAU" really
means "starts paying at all at 200 DAU". The Signal and Snap rows are real.

**The Snap row is the one to sit with.** At 500,000 DAU this app — one
question a day, a finite feed, some sealed duels, and a Mirror built from
aggregates — would cost **1.4× per user what Snapchat pays** to serve
video, camera filters, maps, messaging and an AI/ML platform to 493 million
people. That is not a rounding difference or a small-scale disadvantage.
It is a structural statement about the read pattern.

## Data levels: this app is not data-expensive

The other half of the question, and the answer is counterintuitive enough
to be worth stating flatly. **Data volume is almost irrelevant to this
bill.**

| DAU | stored | $/GiB/mo | vs object storage | egress ÷ stored | reads/day per GiB |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 500 | 0.56 GiB | $3.98 | 173× | 3.0× | 310,482 |
| 3,000 | 3.36 GiB | $8.85 | 385× | 7.8× | 446,932 |
| 5,000 | 5.59 GiB | $11 | 461× | 11.3× | 499,069 |
| 50,000 | 55.9 GiB | $42 | 1,815× | 90.0× | 1,672,147 |
| 100,000 | 111.9 GiB | $76 | 3,293× | 177× | 2,975,568 |
| 500,000 | 559.4 GiB | **$347** | **15,103×** | **877×** | **13,402,935** |

Storage is **1.4% of the bill at 5,000 DAU and 0.05% at 500,000**. The
model's storage line already assumes a full year of accumulation; ten years
of it would still not reach 1% at any size. The entire corpus at the Hit
scenario is 559 GiB — it fits on a retail hard drive costing under $20.
The bill is $194,332 a month.

So the useful way to describe this app's data profile is not "how much" but
"how many times". At 500,000 DAU the whole stored corpus is served **877
times over per month**, and each GiB of it is read 13.4 million times a
day. The $347/GiB/month figure — four orders of magnitude above the
$0.023/GiB/month that raw object storage costs — is not a storage price at
all. It is read amplification wearing a storage unit.

That is why every cost lever in COSTS.md is about reads, and why none of
them is about deleting anything.

### The second reading of "data levels": how much users generate

| answers/user/day | 500 | 5,000 | 50,000 | 500,000 |
| ---: | ---: | ---: | ---: | ---: |
| 1 | $1.98 | $35 | $948 | $66,500 |
| **3 (modelled)** | **$2.23** | **$59** | **$2,335** | **$194,332** |
| 6 | $2.60 | $85 | $4,303 | $384,951 |
| 12 | $3.78 | $133 | $8,210 | $765,906 |

Compare the two exponents, because the gap between them is the whole story:

- **4× the answers per user** → 2.2× the bill at 5 k DAU, 3.9× at 500 k.
  Sub-linear to linear.
- **10× the users** → 39.4× the bill from 5 k, 83.2× from 50 k.
  Super-linear.

*(An earlier draft of this section claimed engagement "barely moves" the
bill. The table above plainly contradicts that at the top row, so both
exponents are now computed and printed by the script rather than asserted
in prose.)*

The product consequence is unusually clean: **engagement is a cost this app
can afford to encourage; population is one it currently cannot.** Asking
users to answer four times as much is nearly free by comparison with
finding ten times as many of them. Most consumer apps face the opposite
trade.

## What the recorded fixes would buy

COSTS.md files two read fixes as recorded-and-deliberately-not-built (D7):
serve the question bank off Hosting as a static asset, and poll the deck
aggregates instead of streaming them. Both are already inputs to the model,
so grading the fixed version costs nothing:

| DAU | as built | with fixes | saved/mo | grade |
| ---: | ---: | ---: | ---: | :---: |
| 500 | $2.23 | $1.82 | $0.41 | B → B |
| 3,000 | $30 | $21 | $8 | C → **B** |
| 5,000 | $59 | $37 | $22 | C → **B** |
| 50,000 | $2,335 | $407 | $1,928 | D → **B** |
| 100,000 | $8,473 | $818 | $7,655 | D → **B** |
| 500,000 | $194,332 | $4,119 | **$190,213** | F → **B** |

Polling instead of streaming removes the only term that grows with the
square of the population, and with it the entire slope this document is
about. The fixed column is nearly flat in unit terms — an ordinary app's
shape.

[`docs/COST-REDUCTION.md`](COST-REDUCTION.md) takes this further — every
lever priced individually, two stacked paths, and the trap that a plan made
only of the cheap ones cuts the bill 80% while making the *slope* worse.

**This is not an argument to build them now.** D7 is right: at launch sizes
the saving is 41 cents a month, and the write-contention wall at ~14,400
DAU (COSTS.md's wall 1) arrives at roughly the same size as the point where
any of this starts mattering. What the table provides is the **price tag on
the deferral**, which is what D7's discipline actually asks for. The
deferral currently costs nothing and would cost $190 k/month at the top row.
That is a wide enough range that "when do we build it" deserves a trigger
rather than a feeling — and the trigger is already written down: wall 1 and
wall 2 both sit near 14 k DAU.

## The honest summary

**Rated against other apps, InSight is an outlier in shape, not in level.**

- At the sizes it will actually see for the foreseeable future — up to a
  few thousand DAU — it is **cheap in absolute terms and unremarkable in
  relative terms**: a couple of dollars to $60 a month, roughly 1.5–4× a
  typical well-optimised app on the same stack, and *below* Signal's
  per-user cost. Nothing here should delay a launch.
- The gap opens with scale, and it opens fast. By 50,000 DAU it is 16× the
  same-stack benchmark; by 500,000 it is 130×, and past Snapchat.
- **The cause is one term.** Not storage (0.05% of the bill), not compute
  (free at every modelled size), not writes (never above 3%). A globally
  shared daily question, streamed to every attached listener, whose
  deliveries scale with the product of publishers and watchers.
- **The cure is recorded and cheap**, and it converts an F into a B.

The one comparison that should not be softened: an app that shows one
question a day should not have a worse per-user cost curve than an app that
streams video to half a billion people. That it does is a property of the
read pattern, it is fixable, and it is fixable with a change COSTS.md
describes as "a display cadence choice, not an architectural one".

### What would change this rating

- **A week of real usage.** The three D98 open rates and `bgCycles` are
  guesses (COSTS.md), and they set the flat baseline every grade below
  50 k DAU is computed against. They move this document more than any code
  change would.
- **The region.** A single-region database halves every Firestore line and
  would take roughly a grade off the middle rows — and it is fixed at
  database creation, so it is the one input here with a deadline.
- **The peer figures.** Four externally sourced numbers, checkable by
  nothing in this repository. Snap's is cross-checked two ways and 1%
  apart; the other three have one route each. If a peer's disclosure moves,
  `PEERS` in `scripts/cost-compare.mjs` is the one place to change it.
