# Bank delivery — three ceilings, in the order they bite

**Status: built — §2 (D284, 2026-08-24); §3 (D312, 2026-08-26, via
[`ANSWER-SCALE.md`](ANSWER-SCALE.md) §2.2 — the bank rode the answer
caches' move; the parallel D315 build converged on it in the merge); §4
(learn at D317, the feed tail at D318, both 2026-08-26; core ships
whole by design — D161, not a remainder).** Written 2026-08-24 on the
owner's direction after D283: the question banks should grow by an order
of magnitude, and *"it's a good thing they don't run out"* is the product
argument that outranks any figure on this page. Nothing here refuses
that. What follows is what stands between the tree and it, measured
rather than estimated, and in the order the app actually meets them.

Building any phase graduates to a `DECISIONS.md` record; this is the plan
that record would cite.

## 0 · What this supersedes, and what it does not

[`SCALE-PLAN.md`](SCALE-PLAN.md) §2 asked "what trips first" and answered
*pagination*. That shipped at D161 and the page was corrected on
2026-08-24. This document is the layer under it, and the finding is that
there is not one ceiling left but **three**, that they are hit in a
different order than the cost model suggests, and that **the first one is
weeks away, not years**.

It does **not** supersede §1's core/tail split. That decision is about
whether a cohort reading may honestly fold a question; this page is about
how many questions a device can be handed. The two are unrelated and both
are true.

It does not revisit cost either. `npm run costs:scale` reports an
identical bill from 513 to 100,000 documents and that survives every
phase below — the bank is a one-time install cost absorbed by an offline
cache, and none of this changes that. **Cost is not why any of this is
here.**

## 1 · The three ceilings, measured

Every figure below is from the tree on 2026-08-24, reproducible by the
command beside it.

| # | Ceiling | Headroom when found | Reached at 3/day | at 24/day | at 200/day |
| --- | --- | ---: | ---: | ---: | ---: |
| 1 | **The JS bundle** (`check:bundle`) | **~39 cards** | **~2 weeks** | 2 days | hours |
| 2 | The localStorage bank cache (`BANK_WARN`) | ~5,300 cards | 5 years | 7 months | 27 days |
| 3 | The whole-bank fetch itself | ~9,300 cards (`BANK_FAIL`) | 9 years | 13 months | 47 days |

The ordering is the finding. The two ceilings this repo has written about
are #2 and #3; the one that actually stopped the next batch was **#1**,
and nothing had measured it because no gate connects question count to
bundle size.

**Row 1's headroom column is dated on purpose, and the correction is worth
keeping.** Those 39 cards were measured against 2427 kB of a 2440 kB
budget. D275's optimization audit landed on `main` the same afternoon and
took the shipping build to **2062 kB** — 378 kB of headroom, or roughly
**1,150 cards** rather than 39. So the deadline that made this the first
thing built was real when measured and was three weeks of slack by the
time it shipped, for a reason nothing on this page predicted.

That does not change what was built or why. The defect was never the 39
cards — it was that **the bundle tracked the bank at all**, so any
headroom was a number the lane would eventually eat, and no gate would
have said which lane ate it. D284 severed the tracking; `BUNDLED_CONTENT`
is what now notices. What the correction changes is the urgency of §3 and
§4, and the answer there is: still years, and now with more room.

## 2 · Ceiling 1 — the learn bank is compiled into the app · **BUILT (D284)**

> Shipped the day this was written, because it was the one with a
> deadline. Option A below is what was built, with C as its second half.
> The chunk went 34.5 → 16.2 kB, the total 2427 → 2409, and the headroom
> 13 → 31 kB — and stopped being spent by content at all. What follows is
> the reasoning as it stood; D284 records the as-built, including one bug
> the tests caught (the publication first sat inside `buildFeedGlobals`,
> which returns early on an empty feed bank) and one mutation that passed
> for the wrong reason.

`src/v2/spec/learn-data.js:18`:

```js
import LEARN_CONTENT from '../../../content/learn-questions.json';
```

Every learn card ships inside the JavaScript. 146 cards is 33 KiB of
`cards` inside a 34.5 kB `learn-progress` chunk, and `check:bundle`'s
`MAX_TOTAL_JS_KB` is **2440** against a shipping build measuring **2427**
— **13 kB of headroom, about 39 cards.**

The lane's own target is 24 cards per field, or 288 total. **Reaching the
target the budget already grants would blow the bundle gate by 34 kB**,
and the lane writes 20 a week, so this is roughly a fortnight out. It
fails CI rather than a device, which is the good version of this
problem — but it stops the lane dead, and it will read as an unrelated
build failure to whoever meets it.

`content/duel-questions.json` (14.6 KiB) is compiled in the same way via
`duels-data.js`. That lane is weekly and much smaller, so it is the same
mechanism with years of slack — worth fixing in the same pass, not worth
a pass of its own.

**Every other bank is already clean.** Daily, feed and test questions
reach the client only through Firestore. Learn and duel are the two
exceptions, and they are exceptions because Learn and the duel pools have
to work in the DEMO build, which has no backend at all.

### Why the live path cannot simply read the bank instead

Because the seeded document does not carry the card. A learn doc is:

```json
{ "id": "learn-cell1", "surface": "learn", "type": "choice",
  "prompt": "What do ribosomes build?",
  "options": ["Proteins", "Lipids", "DNA", "Sugars"], "topic": "cell" }
```

Missing: `c` (which option is right), `t` (the trap), `p` (difficulty),
`k` (the map label) and `w` (the explanation). The client knows all five
today **only because they are in the bundle**. So "read it from
Firestore" is not a one-line swap; it is a decision about where the
answer key lives.

### Three ways out, with what each costs

**A · Seed the whole card, read from the bank.** Add `c`/`t`/`p`/`k`/`w`
to the learn arm of `gen-v2content.mjs` and have the live path build its
cards from `state.learnBank` — which `hydrate()` already fetches, so it
costs no extra read. The bundle keeps a small demo sample.

The objection is that this publishes the answer key in a
world-readable collection. The answer to the objection is that **it is
already published**: anyone can read it out of the JavaScript today, and
has been able to since D32. This changes the channel, not the exposure.
Worth recording as a decision rather than doing quietly, and worth
saying plainly if the product ever wants learn to be gradeable.

*Size: the seed arm, one store fold, the demo sample, and the migration
of `learn-progress.js` off a module-scope constant onto an injectable
bank — the shape `data/testFeed.ts` already has (D280).*

**B · Grade on the server, D57's shape.** The logic test already does
this: the server mints, withholds the answer, marks submitted picks. It
is the honest anti-cheat design and it is the wrong fit here — a learn
card reveals the moment you tap, so this buys a round trip per card for a
property nothing currently has.

**C · Trim the bundled bank to a demo sample and leave the live path
alone.** The cheapest thing that unblocks the lane, and it does not
survive: the live path still reads `LEARN_CARDS`, so a live build would
be serving the demo sample. This is only viable *with* A, as its second
half.

**Recommended: A, with C as the part of A that frees the bytes.**

### What proves it

A gate, and it is built: `BUNDLED_CONTENT` in `check-content.mjs`. The
lesson of this finding is that nothing connected question count to bundle
weight — the count lives in /content, the weight in dist/, and no gate
joined them — so the fix could not only be to move the bytes.

The rule: a `content/*.json` may be imported from `src/` only if it is
named there with a **byte cap and a reason**, and the cap is not a budget
to spend but the size at which somebody has to think again. Tests are
excluded, and they are most of the readers — a suite comparing the
shipped bank against its source has to import the source, and none of it
reaches a device. Both directions fail, the check-purge shape: an
unlisted import, and a listing nothing imports any more.

Two entries today. `learn-sample.json` at 32 KiB — it grows with the
number of FIELDS and never with the bank, so crossing it means the
taxonomy roughly doubled and `PER_FIELD` wants re-deriving rather than
the cap raising. `duel-questions.json` at 24 KiB — the last bank still
compiled in whole, on a weekly lane at 14.6 KiB, and crossing it is the
signal to give it learn's treatment.

## 3 · Ceiling 2 — the bank cache is in the small box · **BUILT (D312)**

> Landed 2026-08-26 inside ANSWER-SCALE §2.2's pass — that page found
> the ANSWER-side caches racing the bank for the same quota, so the box
> was opened once for all of them. As built: rows per question plus a
> {rev, cursor} meta row in `data/cacheStore.ts`, the cursor and delta
> shape untouched, the legacy key retired after its rows commit, and
> `BANK_WARN`/`BANK_FAIL` re-pointed a third time at §4's
> whole-bank-in-memory ceiling. What follows is the reasoning as it
> stood, and it held. (The same day's paged-read-path branch built the
> same move independently as `bankStore.ts` — D315 — and the merge
> converged on this store; the D315 amendment records the collision.)

`live.ts` caches the whole bank in `localStorage` under
`insight.bankCache.v2`. The quota is ~5 MB per origin, shared with ~29
other `insight.*` keys, so `check:quality` budgets the bank about half:
`BANK_WARN` 6,000 docs ≈ 1.6 MB, `BANK_FAIL` 10,000 ≈ 2.7 MB. The tree
is at 671 docs / 185 KiB.

**The failure mode is why this matters at all.** From `checkHeadroom`'s
own words: `live.ts` *"caches the whole bank and SWALLOWS a quota
failure, so crossing this does not break anything: it silently stops
caching and every boot pays a full bank fetch forever."* That is also the
line at which §2's identical cost rows stop being true — lose the cache
and bank size starts billing per boot per user.

### The fix is smaller than the ceiling suggests

**The app already uses IndexedDB.** `lib/firebaseImpl.ts:153` initialises
Firestore with `persistentLocalCache()`, whose store is IndexedDB and
which is already holding every document the app has fetched. The bank is
therefore cached **twice**: once by Firestore in the large store, and
once by hand in the small one.

The hand-rolled copy is not redundant — it is what carries the
`updatedAt` cursor that makes a returning device pay for the delta rather
than the bank, and it is what hands `hydrate()` an array it can split
without awaiting a query. But nothing about that requires localStorage.

`BANK_LS` is touched at exactly **three sites** in one file (`live.ts`
990, 993, 1116). Swapping those for an IndexedDB store leaves the cursor,
the delta query, `splitBanks` and every consumer untouched.

Honest caveats: IndexedDB is async (`hydrate()` already is, so this is
ordering rather than redesign); it can be evicted under storage pressure
(the code already treats a missing cache as "refetch", so eviction is
correct-but-slow rather than wrong); and a device holding the old
localStorage copy needs one migration read, or simply one full refetch,
which is the upgrade cost the `v1 → v2` key rename already precedents.

*After this, ceiling #2 stops existing in any practical sense.*
`BANK_WARN`/`BANK_FAIL` should then be re-pointed a third time — at
whatever the new store's real budget is — rather than deleted, because a
gate that once caught something and is then removed is how the next
version of this arrives unannounced.

## 4 · Ceiling 3 — every device is handed every question

Even with the storage fixed, the design sends the whole bank to every
device. That is what makes bank size a client concern at all, and it is
the last thing to change because it is the only genuinely architectural
one.

What currently assumes the whole bank is in hand:

- **The daily deck is positional.** `computeDeckIds` indexes
  `questionIds[(today − epoch − back) % n]`, so it needs every daily id
  to know what today's question is. 130 documents, growing slowly — this
  one is fine and should stay.
- **The feed's pool.** `buildFeedGlobals` maps every feed question into
  `WORLD_FEED_QS`, and the feed then filters by topic, weaves its
  cadences, and partitions answered from fresh over the whole list.
- **The topic sheet's counts.** "15 questions · 7 answered" per topic is
  computed by walking the pool. It is one of the few honest numbers on
  that sheet (D96), so it cannot be dropped — it would have to be
  published instead.
- **Search.** `search-overlay.jsx` searches the whole pool.
- **The test stream and the Mirror's test joins** (`testFeedItems`).

None of these is hard on its own; together they are the reason the
current design exists, and each one converts a local fold into either a
server query or a published aggregate. That is real design work with
real cost changes, and **it is not needed for volume** — phases 1 and 2
take the practical ceiling past anything the lanes can write for years.

**Learn converted 2026-08-26 (D317), the feed tail the same day
(D318)**: both out of the boot fetch, paged against D316's published
orders, history healed by id (learn's mastery map; the feed's answers).
Core ships whole by design — the corpus's value is that every device
holds it (D161). Of the census above, the topic counts and search still
read the device's pool; their conversions are recorded in D318 with the
fixes named.

The one thing worth doing early is **not making it worse**: a new surface
that folds over the whole bank at render time is another consumer to
convert later, and a published count is usually as good.

## 5 · Order of work

1. ~~**Ceiling 1, now.**~~ **Done — D284**, gate included. Option A plus
   the demo trim; `check:learn-sample` holds the generated sample to its
   source, and `check:content`'s `BUNDLED_CONTENT` is the join that did
   not exist — a /content file may be imported by `src/` only if it is
   named there with a byte cap and a reason, and both directions fail
   (unlisted import, and a listing nothing imports). Verified against the
   defect itself: point `learn-data.js` back at the full bank and the
   gate reports it.
2. ~~**Ceiling 2, when the bank passes ~2,000 documents**~~ — **Done,
   D312**, ahead of the trigger: ANSWER-SCALE §2 found the answer-side
   caches racing the bank for the same quota, and the owner's direction
   to build that plan opened the box once for all of them. (D315 built
   the same move in parallel on the paged-read-path branch; the merge
   converged on D312's store.)
3. ~~**Ceiling 3, when a real product need asks for it**~~ **Done —
   D316 (the published order), D317 (learn) and D318 (the feed tail),
   all 2026-08-26.** The install stops scaling with the bank: boot
   surfaces + core + a page per topic, O(core + pages) per device. The
   need was named 2026-08-26: the owner directed serving-by-selection —
   lazy pages, a published order, quality filtered by signal rather
   than prevented by cap — recorded as D313, adopted the same day
   ("build the real fixes now"). What §4 still holds is the in-memory
   walk: a device reads every cached row into memory each boot, and
   that design is what `BANK_WARN`/`BANK_FAIL` now watch.

Steps 1 and 2 are independent and can land in either order. Step 3
depends on neither.

## 6 · What this changes about the lanes

Nothing yet, and that is deliberate. `FIELD_TARGET`, `RUN_CAP` and the
lanes' cadences are untouched by this plan; they are the pace question
and this is the capacity question. What the plan buys is the right to
answer the pace question on its merits — today the honest answer is
constrained by a bundle budget nobody had connected to it.

Two things follow for whoever raises the pace afterwards:

- **The learn bank's depth is runway, and runway is the point.** Cards
  are consumed `fresh` exactly once each, so at D283's every-field
  default the bank is about seven weeks of reading at the default serve
  rate and three at `lots`. Running dry is the failure to avoid, and it
  is a stronger argument for depth than any ceiling on this page is
  against it.
- **The bar does not move with the volume.** `check:quality`'s learn
  rules — the difficulty spread, the trap argued individually, the fact
  cited — are what make a card an InSight card, and none of them scales
  by being applied faster. If a pace ever outruns them, the pace is
  wrong, not the rules.

## 7 · Failure modes

- **Fixing ceiling 2 first and calling it done.** It is the one the repo
  has written about, and it is not the one that bites. A phase-2-only
  pass leaves the lane failing CI in a fortnight with a green
  localStorage budget.
- **Seeding the answer key without recording it.** Option A moves where
  the learn answers are readable. The exposure does not change, but a
  silent move is exactly the kind of thing D98's discipline exists to
  refuse: if the UI ever says a learn score is unguessable, something
  has to make that true.
- **Trimming the demo sample too far.** The demo build is what App Store
  review and every screenshot run see. A sample thin enough to repeat
  within one sitting reads as a broken app.
- **Treating the bundle budget as the thing to raise.** Every previous
  raise in `check-bundle.mjs` carries a measured justification for code
  that had to exist. Content is not that: it can leave the bundle
  entirely, and raising the ceiling to admit more of it spends a budget
  the app's own features will need.
