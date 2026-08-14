# Attention — does anyone like this, and what is this person into

**Status: plan only. No code exists.** Requested 2026-08-13. Read it as a
proposal, with what it reverses named at the top and the failure modes
named at the bottom.

Two asks, and they look like one feature but are not:

- **A · Does anyone like Foresight?** Do people play it or scroll past?
  A question about a FEATURE, answerable with anonymous aggregate counts.
- **B · What topics is this person into?** Learn from behaviour and adapt.
  A question about a PERSON, and a behavioural model.

They differ in cost, in what they reverse, and in how much can be built
without reversing anything. Split them and most of the value arrives
early and cheap.

## 0 · What this reverses, before anything else

This is refused today, deliberately and recently. `docs/MONITORING.md`
§ "Off the table" names three rows that this plan would cross:

| Refused | Record |
| --- | --- |
| Per-user funnels, session analytics, engagement scoring | data-inventory.md |
| Skip / pass / hesitation rates | QUESTION-FARM.md, "Deliberately out of scope" |
| Per-user content selection, ad targeting profiles | MONETIZATION.md, "Ruled out by standing posture" |

And `docs/data-inventory.md` — **the audited list the App Store and Play
forms are answered from** — states "No product analytics of any kind ship
today."

That last one is the part with teeth outside this repo: shipping tier 3
below changes a store declaration, and `docs/SHIP-CHECKLIST.md` calls
under-declaration the direction that gets an app pulled.

Worth reading the MONITORING.md note in full before deciding, because it
anticipated this: the refusal used to lean on the k-floor, D98 deleted
the floor, and the row was **re-affirmed as an analytics decision
standing on its own**. So this reverses a considered position, not an
oversight — which is exactly the shape D98 itself had, and D98 was right.

## 1 · The constraint that shapes everything: cost

An answer is ~1 write per user per day. An impression is 30–100 per
session. **Writing an event per impression would multiply this app's
entire write volume by two orders of magnitude** — and D124 has just
finished putting the first ceilings on the bill.

So the rule, before any schema:

> **Never write an event per impression.** The device tallies; the device
> uploads a rollup. One write per device per day, which puts attention
> data in the same cost bracket as a single answer.

Everything below obeys that, and tier 3's whole design is a consequence
of it.

## 2 · Tier 1 — say it, don't infer it (reverses nothing)

A **"less of this"** control on a card, and a topic list in the profile
where you can turn subjects up or down by hand.

- A stated preference is not behavioural telemetry. Nothing is inferred,
  nothing is collected, and no record above is crossed.
- It is also the **highest-quality signal there is**: one deliberate tap
  outweighs a hundred ambiguous scrolls, and it needs no threshold
  tuning, no dwell heuristics and no validity argument.
- It is honest in the way this app is elsewhere: the user knows exactly
  what the app thinks, because they typed it.

**Ship this first, alone, and measure whether it is enough.** If people
use it, most of tier 2 is redundant. That is a real possible outcome and
the plan should be able to stop here.

## 3 · Tier 2 — the on-device interest model (a decision, no collection)

Implicit signals folded into per-topic weights **that never leave the
device**.

Signals, weakest to strongest, with the distinction that matters:

| Signal | Meaning | Weight |
| --- | --- | --- |
| rendered | the card existed | none — not a signal |
| **seen** | ≥50% visible for ≥1s | denominator only |
| **dwelled** | visible ≥4s, no action | weak positive |
| **skipped** | seen, then scrolled past with no action | weak negative |
| **engaged** | answered, expanded, tapped through | strong positive |
| **dismissed** | "less of this" | strong negative, tier 1 |

**Scroll-past is a weak signal and must be treated as one.** Not
answering is not dislike: the user may be scrolling to find something
else, may be out of time, may already have answered. A model that reads
every skip as a "no" will converge on whatever the user happens to open
first. Hence: skips count only against a *seen* denominator, never in
isolation, and their weight is a fraction of an explicit dismissal's.

Why on-device is the right home, not a compromise:

- `data-inventory.md`'s "not collected" stays **literally true**, and
  the store declarations do not move.
- The model is small (a few dozen topic weights) and belongs to one
  person, so there is nothing a server does better.
- It survives the app being wrong about someone, because…

**…the model is SHOWN and EDITABLE.** This is the part that makes it fit
the product rather than fight it. A Mirror that secretly models you is a
contradiction in terms; one that says *"here is what I think you are
into — fix it"* is the product working. The profile gets a panel listing
the learned weights, every one adjustable, with a reset.

It still needs a decision, because MONITORING.md's refused row is about
the *behaviour* (per-user content selection) and not only about where the
bytes live. Storing it locally narrows the reversal; it does not avoid it.

### The constraint that keeps this from eating the app

**The interest model may shape the FEED. It must not shape the daily
question, and it must not shape the Mirror.**

The whole thesis of this app is showing you how you sit against people
who are not like you. A daily question chosen because you'll probably
like it, and a Mirror weighted toward cohorts you engage with, is a
filter bubble wearing a Mirror's clothes — the feature would quietly
destroy the thing it is decorating. One blind question a day, the same
one for everyone, is load-bearing.

## 4 · Tier 3 — anonymous aggregate, for "does anyone like Foresight"

The only tier that sends anything, and the only one that touches the
store forms.

**What it is NOT:** no uid, no session id, no funnel, no per-user row,
nothing joinable back to a person. If it can answer "what did user X do",
it is the wrong design.

**Shape.** The device keeps a tally in localStorage and, once a day,
writes one document:

```
v2_attention/{yyyy-mm-dd}/devices/{randomId}
  surface   "foresight" | "feed" | "daily" | …
  seen      42
  engaged   9
  dismissed 1
  build     12
```

- `{randomId}` is per-write and per-day, not a stable device id — two
  days from the same phone must not be linkable, or it is a per-user
  funnel with extra steps.
- A trigger folds the day's documents into one public rollup and deletes
  the rows, so the raw shards do not accumulate into the thing this tier
  promised not to be.
- Bucket the numbers (0, 1-2, 3-5, 6-10, 11+) rather than sending exact
  counts. An exact 137 is a fingerprint; a bucket is not.

**The reading it is for.** "Do people like Foresight" is answered by
`engaged / seen` **relative to the other lens tabs**, not by an absolute
number, and not in its first week — novelty inflates a new tab's numbers
for as long as it is new. The honest instrument is a ratio, compared
against its neighbours, over at least a month.

**Sampling is legitimate.** 10% of devices answers a product question
about a feature just as well as 100% and costs a tenth as much. If the
number is only convincing at 100%, it was never convincing.

## 5 · Order, and where to stop

1. **Tier 1** — explicit "less of this" plus an editable topic list.
   Reverses nothing. Ship it and watch.
2. **Tier 2** — the on-device model, shown and editable, feed only.
   Needs a decision; collects nothing.
3. **Tier 3** — anonymous daily rollups. Needs a decision, a trigger, a
   cost line in COSTS.md, and a change to `data-inventory.md` and both
   store forms.

Each step is a legitimate stopping point. Tier 3 is the only one that
makes the app an app-that-collects-analytics, and it buys exactly one
thing the others do not: an answer to "is this feature worth keeping".
That is a real question — it is the question that was asked — but it is
worth being clear that it is the *only* thing tier 3 adds, and that
tiers 1 and 2 deliver the adaptive-interest half without it.

## 6 · Failure modes

| Failure | Mitigation | Residual |
| --- | --- | --- |
| Skip read as dislike | seen-denominator, low weight, explicit signal weighted far higher | People who scroll fast look uninterested in everything |
| Model narrows the app to what you already like | feed only; daily and Mirror untouched (§3) | Needs a test that asserts it, or the constraint rots |
| Novelty inflates a new feature | ratio vs neighbours, ≥1 month | A feature judged too early gets cut for the wrong reason |
| Rollups become a funnel | per-day random id, server-side fold-and-delete, bucketed counts | An operator who keeps the raw shards has a funnel; the deletion has to be real |
| Write volume | one rollup per device per day, sampled | none at these numbers |
| Store declaration goes stale | tier 3 lands with the data-inventory edit in the same PR, or not at all | none if enforced |

## 7 · What I would do

Tier 1, now. It is small, it reverses nothing, it answers the interest
half of the question honestly, and it is the only version where the user
is told what the app thinks of them. Then look at whether anyone taps it
before building a model to infer what they would have tapped.
