# Scale runbook — the ordered build list

> **Reasoning lives in [`SCALE-PLAN.md`](SCALE-PLAN.md)**, which is
> canonical, and the decisions are D153–D156. This file is the same work
> as an ordered to-do list: open steps only, dependency order, what
> "done" means, and which gate proves it. If the two disagree,
> SCALE-PLAN is right and this is stale.
>
> Same split as [`LAUNCH-PLAN.md`](LAUNCH-PLAN.md) /
> [`LAUNCH-RUNBOOK.md`](LAUNCH-RUNBOOK.md), and for the same reason: a
> person building does not want the argument, and a person deciding does
> not want the checklist.

**Sizes** are S (an afternoon), M (a few days), L (a week or more), and
they are estimates rather than measurements. **Every step names the gate
that proves it**, because "I tested it" is not a thing this repo accepts
from anyone, including itself.

---

## Phase 0 — the one that expires

- [ ] **0.1 Take the Firestore region decision. Not part of this plan,
      and it blocks all of it.** `LAUNCH-RUNBOOK.md` step 0.0 has the
      procedure and [`FIRESTORE-REGION.md`](FIRESTORE-REGION.md) the
      arithmetic. It is here because **the deadline is real and this plan
      makes it closer**: a database's location is fixed at creation, so
      it stops being a setting and becomes a migration the moment real
      answers accumulate — and everything below exists to produce more
      answers, sooner.

      Worth ~50% of every Firestore line forever, with no user-visible
      change (`npm run costs:levers`, row R). Staying on `nam5` is a
      legitimate answer; the point is that it be an answer rather than a
      default that expired.

      **Done when:** the decision is recorded, either way. · **Size:** S
      (a console, or a migration if left too long).

## Phase 1 — Pagination, which blocks the whole idea

Nothing else in this file may ship before this. At an order-of-magnitude
increase the current headroom is weeks.

- [x] **1.1 Page the cold-start bank fetch. DONE 2026-08-15.** The loop
      lives in `live.ts`'s bank section, ordered by `documentId()` because
      the cursor must sit on the ordering key and `__name__` is the only
      field every document has (`seq` repeats across surfaces, and a
      cursor on a non-unique key skips rows at a page boundary).
      `BANK_LIMIT = 1500` became `BANK_PAGE = 1000` — a page size, not a
      ceiling — and `BANK_MAX_PAGES` bounds the loop so a cursor bug
      cannot hang the boot path; tripping it **reports** rather than
      truncating quietly.

      `startAfter` had to be added to `lib/firebaseImpl.ts`'s explicit
      `fsApi` object (D110 — the surface is named member by member so
      rolldown can shake the rest).

      Three tests in `bank-cache.test.ts`, and the mock was taught to page
      first — order by id, honour `startAfter`, honour `limit` — because
      against the old mock the test would have passed without the fix.
      **Verified by mutation:** reverting to a single fetch fails all
      three, and so does the `<` → `<=` off-by-one; the eight pre-existing
      tests pass in both directions, which is what says small banks still
      behave.

      **Termination is on a short page, never on a count this code
      believes in advance** — that is the whole correctness argument, and
      the reason both mutations above are caught. The delta path beside it
      already worked this way ("a delta that fills the page is not a
      delta"), so this extended a pattern the file already had.

- [x] **1.2 Keep the alarm true after 1.1. DONE 2026-08-15, and the next
      ceiling turned out to be a real one.** `BANK_WARN`/`BANK_FAIL` were
      re-pointed rather than deleted, at **the localStorage bank cache**.

      `live.ts` writes the whole bank to `insight.bankCache.v2` inside a
      `try/catch` that ignores failure — so crossing the browser quota
      breaks nothing and costs everything: caching silently stops and
      every boot pays a full bank fetch, forever, with no symptom. Same
      shape as the ceiling that was just removed, which is why the gate
      moved instead of retiring.

      Thresholds are doc counts (6,000 / 10,000) because the budget lanes
      reason in documents, but the *message* derives MB from the seed's
      own wire size, so it moves when the documents do. Checked by forcing
      the warn: "513 docs ≈ 0.1 MB".

      **The real fix is IndexedDB**, and the gate now says so rather than
      naming a number to stay under. Not scheduled — it is not due until
      roughly 6,000 questions.

## Phase 2 — Finish D153 (the Mirror side)

Sequenced with the first tail content, not before: while the tail is
empty this changes nothing, and it touches the app's highest-risk read
path ([`MIRROR.md`](MIRROR.md)).

- [ ] **2.1 Decide where the filter goes, and it is not one line.**
      The obvious candidate is wrong. `live.ts`'s `aggregated()` feeds the
      Mirror's Answers and Scores lenses — **and it also feeds your own
      answer list**, which must keep showing everything you answered,
      tail included. Hiding a person's own answer from them would be a
      worse bug than the one being fixed.

      The rule to implement: **cohort readings fold core only; your own
      answers are always all of them.** So the filter belongs on the
      cohort folds (`data/cohort.ts`'s callers, the similarity fields,
      Kindred), not on the archive walk.

      **Done when:** the split is written down per call site. · **Gate:**
      review — this step is a decision, not code. · **Size:** S.

- [x] **2.2 Applied at the City/Country/World stop. DONE 2026-08-15.**
      `LiveCohortBody` folds `LIVE.aggregated().filter((q) => q.coreCorpus)`.

      `LiveQuestion` had no `surface`, so the predicate could not run at
      the call site — `coreCorpus` is now **resolved by `buildS`** and
      carried on the view model. That is better than carrying the raw flag:
      `q.core` reads false for the daily (feed-only field), so every
      consumer would have had the same trap, and resolving it once means
      the boolean means what it says everywhere.

      **⚠ DEPLOY ORDER — the one thing to get right.** This is a no-op
      only against a bank reseeded since D153. Production was seeded
      *before* `core` existed, so those feed documents carry no flag,
      `isCore` reads them as tail, and all 82 drop out of this panel.
      **Ship after a reseed, never before.** The failure is loud (the
      place panels go visibly thin rather than quietly wrong) — which is
      why D153 chose the polarity — but loud is not harmless.

      **Still open:** `LiveCircleBody` also reads `aggregated()` and is
      deliberately NOT filtered. Circle folds the answers of people you
      chose to follow, which is a fact about them rather than a claim
      about a population, so interest-selected serving does not make it
      false. Recorded so the asymmetry is a decision, not an oversight.

- [x] **2.3 The test that makes it real. DONE 2026-08-15.** Two core
      questions with identical full Oslo cells, one flagged tail: the core
      one renders, the tail one does not, so nothing but the filter can
      explain the difference. **Verified by mutation** — removing the
      filter fails it. Plus four unit tests on `isCore` itself, including
      that a stray `core: false` cannot demote a surface which has no tail.

      Asserted on rendered output rather than on the fold in isolation,
      because `app-shell` wraps every tab in an `ErrorBoundary` and a
      crashed stop returns cleanly from `render()` — so a test on the fold
      alone would pass while the screen was broken. Without this test the
      constraint is prose, which is what `ATTENTION.md`'s feed-only rule
      was, and it rotted.

## Phase 3 — Review at volume (D154)

Unblocks phase 4. Buildable now; only its last step needs traffic.

- [x] **3.1 The verdict is a required field. DONE 2026-08-15.** The
      shape this took is not the one this step imagined, and the reason
      is worth keeping: **the farm is a Claude session following
      `QUESTION-FARM.md`, not a script that could call an API.** So "AI
      review" cannot be a program; what CAN be a program is the proof
      that it happened.

      `content/provenance.json` rows gain
      `review: { by: "ai"|"human", at, audited? }` on farm and community
      entries; `check:quality` refuses a bank entry without one, and
      `promote` refuses to write one without `--review`. Editorial rows
      carry none, because editorial IS the human. What the reviewer
      judges is written down in QUESTION-FARM's review contract.

      Three gate arms, each checked by breaking it: a missing review, an
      `ai` verdict with no explicit `audited` boolean, and the audit
      rate. The twelve existing farm rows were backfilled `by: "human"`,
      which is true — they went through the pre-D154 read.

      **Not verified end to end:** every archive id is already promoted,
      so `promote`'s happy path could not be run without inventing
      content. Both refusal paths were exercised and the emitted row
      shape was checked against the gate; the write itself rides on
      `check:quality` catching a malformed row in CI.

- [ ] **3.2 Batch approval, human on the merge.** The human's unit of work
      becomes approving a batch, never reading one. **The two-gate
      property must survive**: a scheduled job still never holds write
      access to production content. If a change here would let the farm
      merge itself, it is the wrong change. · **Size:** S.

- [x] **3.3 Sampled audit — one in twenty. DONE 2026-08-15**, landed with
      3.1 because the audit is the only real check on a reviewer that
      shares the generator's blind spots, and shipping the review without
      it would have been the weaker half alone.

      `promote --audited id,id` names the sampled ids rather than
      counting them — a count cannot be checked afterwards, which defeats
      the point. The gate holds the **cumulative** rate against
      `AUDIT_ONE_IN`, not a per-batch one: at 1-in-20 a weekly batch of
      seven rounds to zero, so a per-batch gate would pass while nothing
      was ever audited.

- [ ] **3.4 Measure-and-retire. BLOCKED ON TRAFFIC.** The scorecard
      already computes evenness and already emits retirement proposals;
      wiring them to `active: false` closes the loop. Needs published
      aggregates, so it cannot be validated pre-launch. **Feed surface
      only** — daily questions cannot retire (positional deck; D97's gap
      is open). · **Size:** M.

## Phase 4 — Turn up production (D153)

- [ ] **4.1 Raise the budget regulator** in `scripts/farm-budget.mjs`. Its
      pinned property is that sustained generation equals measured
      promotion throughput, so **this step is a consequence of phase 3,
      not an alternative to it** — raising the cap without raising review
      throughput produces PRs, not questions. · **Gate:**
      `farm-budget.test.mjs`, `check:figures`. · **Size:** S.

- [ ] **4.2 Point the volume at the feed surface.** It can retire; daily
      cannot. New questions declare `core: false` by default at this
      point — the tail is the thing being grown. · **Size:** S.

- [ ] **4.3 Re-run the cost model, do not reason about it.** `npm run
      costs:scale` at the new rate. The table is cheap and this repo's
      cost prose has been wrong in the same direction four times. ·
      **Size:** S.

## Phase 5 — The interest model (D155)

Ordering the tail. Only meaningful once the tail has content, so it
follows phase 4.

- [ ] **5.1 Read the state the device already writes.** `insight.feedPass.v1`
      (pass — holds forever), `insight.feedDefer.v1` (D121 — expires),
      `insight.readRoom.v1`, `insight.feedVotes.v1`. **No new collection**;
      this step is a reader. If it adds a signal that needs storing,
      stop and re-read D155 — the whole shape depends on nothing new
      leaving the device. · **Size:** S.

- [ ] **5.2 Per-topic weights, on-device, feeding tail order only.** The
      signal table in [`ATTENTION.md`](ATTENTION.md) §3 stands: a
      scroll-past is weak and counts only against a *seen* denominator, an
      explicit pass is strong. **The daily is untouched and the Mirror is
      untouched** (phase 2 enforces the second). · **Gate:** a test that
      the daily's selection does not read the model. · **Size:** M.

- [ ] **5.3 Show it and let them edit it.** A profile panel listing the
      learned weights, each adjustable, with a reset. **Not optional
      polish** — D155 turns on it, and `ATTENTION.md`'s line is the
      reason: a Mirror that secretly models you is a contradiction in
      terms. · **Size:** M.

- [ ] **5.4 Confirm no store form moved.** Nothing uploaded means
      `data-inventory.md`'s "not collected" stays literally true. Check
      it rather than assume it — this is the step where an innocuous
      "just log it to see if it works" would quietly make the filing
      false. · **Gate:** `check:data-inventory`, and re-read
      `STORE-FORMS.md`. · **Size:** S.

## Phase 6 — Needs a population

None of these can be validated pre-launch. Listed so they are deferred
rather than forgotten.

- [ ] **6.1 The core-size ratio gate** — D153's named open item. Core
      questions may grow only as fast as the population that fills their
      cohort cells. Cannot be gated until there is a population to
      measure. Until it exists **the Mirror can thin without anyone
      noticing**, which is the residual D153 accepts.
- [ ] **6.2 Monetization** — D156 fixes the constraints; nothing is built.
      The contract path needs no code. The trigger for a clearing engine
      is a buyer turned away because a window was full, and not before.

## The dependency order, in one line

**0.1 → 1.x → (3.x ∥ 2.x) → 4.x → 5.x → 6.x.** Phase 2 and phase 3 are
independent of each other; everything else is a chain. Phase 1 gates all
of it, and phase 0.1 gates phase 1 only in the sense that it gets more
expensive every day it is not taken.

## What would make me stop and re-plan

- **Pagination turns out to touch the offline cache's shape.** The bank
  is mirrored into IndexedDB; if paging changes what a returning device
  holds, the cost model's "bank size bills nothing" finding is the thing
  to re-check first (`npm run costs:scale`, table 2 — identical rows are
  the finding, and they would separate).
- **Phase 3.1's AI review disagrees with the committed bank at volume.**
  If it flags a large fraction of already-promoted questions, either the
  reviewer is miscalibrated or the bar moved silently. Both are worth
  knowing before turning up production, and neither is a reason to lower
  the bar.
- **Anyone proposes shipping phase 5 before phase 2.** That is an
  interest-selected feed feeding an unfiltered Mirror — the exact
  sample-bias failure D153 exists to prevent, arriving in the gap
  between two phases.
