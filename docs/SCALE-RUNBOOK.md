# Scale runbook — the ordered build list

> **Reasoning lives in [`SCALE-PLAN.md`](SCALE-PLAN.md)**, which is
> canonical, and the decisions are D161–D164. This file is the same work
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

      **DONE 2026-08-15 (D165).** `insight` in `europe-west1` is live:
      created, rules deployed via the array form, functions deployed,
      bank seeded (513), verified in the console. `(default)` is kept a
      week as the rollback. Original note below.

      **DECIDED 2026-08-15 (D165): option A, `europe-west1`.** The
      decision half of this step is done; the console half is not. What
      still gates the phases below is the *migration*, not the choice.

      **Done when:** the new database serves the bank and the app talks to
      it. · **Size:** S to decide (done), ~2 hours to execute.

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

      **The move happened 2026-08-26 (D312)**, ahead of that schedule and
      from the other side: [`ANSWER-SCALE.md`](ANSWER-SCALE.md) found the
      ANSWER-state caches racing the bank for the same origin quota, and
      the bank cache rode their move into `data/cacheStore.ts`. The gate
      was re-pointed a third time — at the whole-bank-in-memory design
      ([`BANK-DELIVERY.md`](BANK-DELIVERY.md) §4), the ceiling that
      remains.

## Phase 2 — Finish D161 (the Mirror side)

Sequenced with the first tail content, not before: while the tail is
empty this changes nothing, and it touches the app's highest-risk read
path ([`MIRROR.md`](MIRROR.md)).

- [x] **2.1 Decide where the filter goes. DONE 2026-08-19.** The list is
      [`SCALE-PLAN.md`](SCALE-PLAN.md) §1 § *Where the filter goes* — every
      reader, the line it was read off, and its verdict. Three readers walk
      the archive: the City/Country/World stop folds **core only** (and its
      five lenses inherit it from the same filtered list), Circle and the
      reading game fold **all**, each for a reason that is about what the
      reading claims rather than about cost. Everything else is bounded by
      construction, because `isCore` makes the tail **feed-only** — the
      instruments, the deck, the reveals and the single-question sheets
      cannot be diluted, and the plan says why rather than leaving a no-op
      filter to be added later.

      **The premise this step was written on was false, which is the part
      worth carrying forward.** It warned that `aggregated()` also feeds
      your own answer list; it does not. Measured by grep: every personal
      archive (the daily record, the Map) reads `DAILYQ`, the daily bank,
      core by construction. The real accepted consequence is one line
      narrower and is now written down — a tail question you answered gets
      no row in the Mirror's **Answers** tab, which is a population reading
      with your answer marked, not your archive.

      **Gate:** review — this step is a decision, not code. The code half
      it feeds is 2.2 (shipped) and 2.3's mutation-checked test (shipped).

- [x] **2.2 Applied at the City/Country/World stop. DONE 2026-08-15.**
      `LiveCohortBody` folds `LIVE.aggregated().filter((q) => q.coreCorpus)`.

      `LiveQuestion` had no `surface`, so the predicate could not run at
      the call site — `coreCorpus` is now **resolved by `buildS`** and
      carried on the view model. That is better than carrying the raw flag:
      `q.core` reads false for the daily (feed-only field), so every
      consumer would have had the same trap, and resolving it once means
      the boolean means what it says everywhere.

      **⚠ DEPLOY ORDER — DISCHARGED 2026-08-15.** The reseed happened
      (D165), so every feed document in `insight` carries `core` and this
      filter is the no-op it was designed to be. The warning stays below
      because it applies again to any future database, and because it is
      the reasoning for the polarity.

      **The original hazard:** This is a no-op
      only against a bank reseeded since D161. Production was seeded
      *before* `core` existed, so those feed documents carry no flag,
      `isCore` reads them as tail, and all 82 drop out of this panel.
      **Ship after a reseed, never before.** The failure is loud (the
      place panels go visibly thin rather than quietly wrong) — which is
      why D161 chose the polarity — but loud is not harmless.

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

## Phase 3 — Review at volume (D162)

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
      which is true — they went through the pre-D162 read.

      **Not verified end to end:** every archive id is already promoted,
      so `promote`'s happy path could not be run without inventing
      content. Both refusal paths were exercised and the emitted row
      shape was checked against the gate; the write itself rides on
      `check:quality` catching a malformed row in CI.

- [x] ~~**3.2 Batch approval, human on the merge.**~~ **STRUCK — REVERSED
      BY [D212](DECISIONS.md), 2026-08-19, and this row stood unticked for
      a fortnight after (D367).** Struck rather than deleted, per D106's
      rule that a reversal must stay visible.

      The original read: *"The human's unit of work becomes approving a
      batch, never reading one. **The two-gate property must survive**: a
      scheduled job still never holds write access to production content.
      If a change here would let the farm merge itself, it is the wrong
      change."*

      **Both halves are gone, and D212 names each.** It reverses "the
      merge half of D162" — this step's own title — on the owner's ask,
      *"remove the need for a human to approve the questions."* Its §2 is
      this step's content shipped: `PROMOTE_PACE = 2` in
      `farm-budget.mjs`, each run promoting the two oldest pen entries
      through `promote -- --source farm --review ai` and shipping
      promotion and batch in one PR — 14/week at the daily cadence, which
      is D97's target as arithmetic.

      And the constraint this step made load-bearing is the one D212
      records giving up **in those words**: *"The two-gate design existed
      so a scheduled job never decides what production serves. That
      property is gone for question content."* What bounds the blast
      radius instead is the gate set in front of the merge, the
      `active: false` kill switch behind it, the retrospective audit, and
      scope — **D212 covers question content only**; code, rules, schema,
      functions and policy keep ordinary human review, and core membership
      stays the one per-question human act.

      **The reason this is struck rather than quietly ticked**: a routine
      read this row on 2026-09-04 as the buildable next step and was one
      step from implementing it — which would have re-imposed, as new
      work, a human hold the owner had explicitly asked to remove. A stale
      row that merely lags is a nuisance; one that points a builder in the
      reverse of a stated instruction is a defect.

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

      **Amended by D212 and not recorded here until D367:** that
      cumulative check is a **warning, not an error**
      (`checkProvenance` returns `{errs, warn}`). The sample keeps its
      D162 job, but a person falling behind on audits can no longer turn
      CI red and stop the lanes — which was a human approval gate wearing
      a sampling rate. The per-row review verdict and the explicit
      `audited` boolean stay hard errors, because those are facts a run
      must state rather than work a person must keep up with.

- [ ] **3.4 Measure-and-retire. BLOCKED ON TRAFFIC.** The scorecard
      already computes evenness and already emits retirement proposals;
      wiring them to `active: false` closes the loop. Needs published
      aggregates, so it cannot be validated pre-launch. **Feed surface
      only** — daily questions cannot retire (positional deck; D97's gap
      is open). · **Size:** M.

## Phase 4 — Turn up production (D161)

- [ ] **4.1 Raise the budget regulator** in `scripts/farm-budget.mjs`. Its
      pinned property is that sustained generation equals measured
      promotion throughput, so **this step is a consequence of phase 3,
      not an alternative to it** — raising the cap without raising
      throughput produces PRs, not questions. Since D212 that throughput
      is `PROMOTE_PACE`, not a person's reading, which is what makes this
      step reachable at all: the constraint it waits on is now a constant
      in `farm-budget.mjs` rather than someone's queue. · **Gate:**
      `farm-budget.test.mjs`, `check:figures`. · **Size:** S.

- [ ] **4.2 Point the volume at the feed surface.** It can retire; daily
      cannot. New questions declare `core: false` by default at this
      point — the tail is the thing being grown. · **Size:** S.

- [ ] **4.3 Re-run the cost model, do not reason about it.** `npm run
      costs:scale` at the new rate. The table is cheap and this repo's
      cost prose has been wrong in the same direction four times. ·
      **Size:** S.

## Phase 5 — The interest model (D163 → D317, D322)

**REWRITTEN 2026-09-04 (D367). Three of these four rows described a model
the owner had already moved to the server**, and a routine reading them
was one step from building an on-device reader under a constraint that had
been deliberately crossed. The header said "(D163)" for nine days after
D317 reversed the row D163 narrowed.

D317, 2026-08-26, on the owner's words — *"this app should absolutely
track what you personally like — if not, it does not work"* — and its own
framing: *"D163 named its own crossing 'a considered position being
crossed, not an oversight'; so is this one, and it is the owner crossing
it."* The architectural reason is in that record: under a global published
order everyone is handed the same head, so a device model can only sort
the window it was given — **a taste model that never leaves the phone
cannot reach into the fetch.**

- [x] ~~**5.1 Read the state the device already writes.**~~ **STRUCK —
      the shape it protects was reversed by D317** (D106: a reversal stays
      visible). It read *"No new collection; this step is a reader. If it
      adds a signal that needs storing, stop and re-read D163 — the whole
      shape depends on nothing new leaving the device."*

      That sentence is now D317's **phase 2**, not its phase 1, and it is
      explicitly not licensed: behaviour — shown, passed, deferred — still
      never leaves the device, and *"what you merely scrolled past or
      skipped stays on your device and is not collected"* is a **pinned
      claim** in `web/privacy.html` held by `check:policy-claims`. Building
      that upload must retire the pinned row in the same commit as the
      record licensing it. The four keys are untouched and stay local.

- [x] ~~**5.2 Per-topic weights, on-device, feeding tail order only.**~~
      **BUILT SERVER-SIDE at D322**, 2026-08-26: `functions/src/taste.ts`
      (`fitTasteV2`, nightly 03:27 UTC, until D398 folded it into the 02:23
      pass) counts this person's FEED answers
      by topic off the agg-events ledger — no new signal, because answers
      are already server-side and public (D98). The document is
      `v2_users/{uid}/taste/profile` `{t, n, at}`: owner-readable,
      client-unwritable, never listable. The one reader is
      `bankPager.pageSizesByInterest`, and its floors are the D96 posture
      kept: a topic under `TASTE_TOPIC_MIN` still pages at max(4, a third),
      never zero, **because a cold topic must stay discoverable or the
      profile could never change**; under `TASTE_MIN_TOTAL` the feed is
      byte-identical to the pre-profile feed.

      **What this row got right and D317 kept:** the daily stays global —
      cohort comparison is meaningless if different people got different
      questions — and the Mirror folds core only (D161). Personal
      selection is the tail's and learn's. Ad targeting stays refused: the
      profile picks questions and does nothing else.

- [ ] **5.3 Show it and let them edit it. THE ONE ROW STILL LIVE, and it
      binds harder than when it was written.** D317 kept it across the
      reversal in those terms: *"'A Mirror that secretly models you is a
      contradiction in terms' does not move to the server with the model —
      it binds harder there."*

      **The gap, measured 2026-09-04 rather than assumed.** The profile is
      folded nightly and `bank-pager.ts` already shapes what you are handed
      with it — and **no surface anywhere shows it to you, lets you edit it
      or resets it.** `web/privacy.html` says *"Your interest profile: only
      you"*, and the rules make that true; what is missing is any way for
      "only you" to actually look. D322 shipped owner-*readability* as
      D163's "shown" carried over — a rules fact, not a screen.

      **It needs a design first** (CLAUDE.md, D352): a panel is a module,
      so it is a `VISUAL-REQUESTS.md` request → plan → draft → the owner →
      built. Filed there 2026-09-04. · **Size:** M.

- [x] ~~**5.4 Confirm no store form moved.**~~ **ANSWERED, and the answer
      is that one DID.** D322 moved it in the same commit as the feature,
      which is the order D183 asks for: User Content gained **Product
      Personalisation** in both `STORE-FORMS.md` and
      `design/store/app-privacy.json`, held equal by `check:store-forms`.
      `docs/data-inventory.md` gained the collection's row,
      `web/privacy.html` states the arithmetic with three sentences pinned
      by `check:policy-claims`, and the erasure e2e seeds and asserts the
      profile's sweep against the real emulated `deleteAccount` — so *"deleting
      your account deletes it"* is a tested sentence rather than a claim.

      The row's instinct was right and its expected answer was wrong: it
      guarded against an innocuous "just log it to see if it works" making
      the filing false. What actually happened is the filing moving with
      the feature, on purpose.

## Phase 6 — Needs a population

None of these can be validated pre-launch. Listed so they are deferred
rather than forgotten.

- [ ] **6.1 The core-size ratio gate** — D161's named open item. Core
      questions may grow only as fast as the population that fills their
      cohort cells. Cannot be gated until there is a population to
      measure. Until it exists **the Mirror can thin without anyone
      noticing**, which is the residual D161 accepts.
- [ ] **6.2 Monetization** — D164 fixes the constraints; nothing is built.
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
  sample-bias failure D161 exists to prevent, arriving in the gap
  between two phases.
