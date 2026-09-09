# The rules expression budget — buying it back, and holding it

**Status: plan notes — Phases 0 to 3 are BUILT and measured (D432, D433, D438); Phase 4 remains a proposal, priced and untaken.** Every number in §§0–6 is marked as either
*measured* (D429's filler runs, the e2e log, the tree) or *estimate*, as
it was written before Phase 0 ran; **§9 is the measured table** and where
the two disagree §9 is the correction — starting with the unit itself,
which D429 and §0 took as ~3 expressions a filler and D432 measured at
~8.
The owner asked for this on 2026-09-09 after the ceiling was explained,
with *"you can make pretty big changes"* — so §6 prices the big change
too, and says why it comes last rather than first.

## 0 · The problem, in numbers

Firestore evaluates `firestore.rules` for every write and stops at
**1,000 evaluated expressions**, reporting the stop as
`PERMISSION_DENIED` — the same answer as a rule that said no. There is a
second ceiling at deploy time: past a certain complexity the ruleset
refuses to compile at all (*"Expression is too complex to evaluate
safely"*). The runtime one is silent and the compile one is loud, which
makes the runtime one the dangerous one.

What is *measured* on the answer create path today:

| fact | value | source |
| --- | --- | --- |
| headroom on the thinnest LEGAL creates (D426's world-question duel arm, the pick round) | **~130 expressions** of 1,000 | D429, filler runs |
| headroom on the profile arm | 80–140 | D429 |
| fillers before the ruleset stops compiling | ~85 (≈ 170 expressions past the runtime line) | D429 |
| e2e writes that exhaust the budget, on `main` | **13** — 21 evaluations on the create arm, 31 on update | D431, before/after control |
| what those 13 are | every one an *expected* refusal — "member cannot answer a round already revealed", "entity refused on a non-catalog question", "duplicate ranking refused", "optionIdx refused on a rank question" | the e2e log |

The last row is the shape of the whole problem, and
`firestore-tests/rules.test.ts` already says it in its own words: *"EVERY
refusal already exceeds the budget today, because a deny walks every arm
to the end."* A denial that runs out of budget is still a denial, so the
suite is green. The day a **legal** write crosses the same line, it is
refused identically, and nothing in a log, a test or a screen says why.

### Where the expressions go

The create rule is one `allow` for every answer surface, as a chain of
alternatives:

```
allow create: if auth && uid matches && answeredAt == now
  && (  (optionIdx is int && >= 0 && < 64
          && (  (isWorldAnswer()  && deviceBound())
             ||  isDuelAnswer()
             || (isPulseAnswer()  && deviceBound())
             || (isCallAnswer()   && deviceBound())))
     || (isCatalogAnswer() && deviceBound())
     || (isRankAnswer()    && deviceBound()))
  && isValidV2Anchors(anchors);
```

Reading the arms (code only, comments stripped) shows three things that
cost, in descending order:

1. **The same document is fetched as separate expressions, many
   times.** `isDuelAnswer` calls `get(v2_questions/$(qid))` **ten** times
   and `get(v2_groups/$(gid))` **four** times — each call site with its
   two `$()` path interpolations, `.data`, and a field read.
   `isWorldAnswer` fetches its question four times; the update arm
   fetches its question twice. Billing already counts one read per unique
   document per request; the *expression* budget counts every call site.
   *(estimate, and the first thing Phase 0 pins: 6–8 expressions per
   `get(...).data.x` site → the duel arm spends ~100 on re-fetching what it
   already has.)*
2. **`let` runs before the guard.** `isDuelAnswer` opens with
   `let open = get(v2_groups/$(gid))…` and `let late = …`, and a rules
   function evaluates its `let` bindings before its `return`. So every
   `optionIdx`-shaped write that is not a world answer — pulse, call, and
   every *refused* world write — pays a group fetch on the way past an
   arm whose first real conjunct (`surface in ["group","duo"]`) would have
   rejected it for ~3. *(estimate; Phase 0 measures the phantom cost by
   ablation.)*
3. **Anchors are ten keys at ~6 expressions each.** `isValidV2Anchors`
   walks `city … heightBand` through `isShortAnchor`, which does
   `anchors.get(k,"") is string && anchors.get(k,"").size() <= max` —
   two map reads, a type test, a size, a compare, an `&&` — plus a
   ten-name `hasOnly` and `is map`. Roughly 70–80 on every successful
   write. *(estimate.)* It sits last, so refusals do not pay it — D429
   moved it there for that reason.

Nothing here is a bug in the rules' *meaning*. Every conjunct is a real
check with a recorded reason. The cost is in how the checks are written,
and that is what makes this a refactor with a behaviour invariant rather
than a design change.

## 1 · What this plan does NOT do, and why

Each of these was considered and has a specific reason it is not the
fix — written down so the next reader does not re-derive them.

- **Compare the answer's anchors to the profile's** (one `get` + one
  `==` instead of ~75 expressions). D410 built and measured exactly this
  and it refuses two correct writes: the deliberately blanked city on a
  place-rating question, and a second device's stale profile mirror for a
  whole session. *"A rules-side equality check cannot be made correct
  here in any form."* Stands.
- **Write answers through a callable** so a server validates them. That
  kills the offline write queue answers depend on (D312, D357) — a
  Firestore write queues offline, a callable fails. Answering blind on a
  train is the product. Not on the table.
- **Have the client carry the question's `type`/`surface`/option count
  on the answer** so the rules need not fetch the question. That is
  client-supplied truth about a document the client does not own — the
  forgery D57 refused for the logic score, one field over. Rejected.
- **Move the `active` kill-switch check from rules to the trigger.**
  `SHIP-CHECKLIST.md` §1 relies on rules re-checking `active` on every
  write so a killed question still on a screen is refused server-side.
  The trigger declining to fold a written document is weaker: the
  document exists, and answers are public. Stays in rules.
- **Split answers into per-surface subcollections.** This works and is
  the cleanest long-term shape — it is §6 — but it is a data migration
  with a blast radius of eighteen client write sites, two triggers,
  twenty-two composite indexes and every collection-group reader, and
  §3 buys the same evaluation property (one arm per write) without
  touching a single document. It is the fallback, taken only if §3 and
  §4 measure short.

## 2 · Phase 0 — the instrument

**Nothing is restructured until each clause has a number.** D429
measured *headroom* by appending filler conjuncts until a write flipped,
which is the right way to find the ceiling and the wrong way to find out
what a clause costs. There is a better source in the tree already: the
emulator's rule-coverage report, which `scripts/rules-coverage.mjs`
already fetches and parses, records **how many times every expression in
the file evaluated**. Snapshot it before one write, snapshot after, and
the difference is that write's evaluation count — attributable to the
line.

### `scripts/rules-budget.mjs`

Runs inside the same `emulators:exec` as the rules suite (the way
`rules-coverage.mjs` does), boots one test environment per rules
*variant* through `@firebase/rules-unit-testing`, and for each of a fixed
set of **probe writes** reports:

- **cost** — the coverage-report delta for that single write, total and
  per rule line;
- **headroom** — the filler count at which the write flips, found by
  bisection over N (D429's method, automated), so the two measures can be
  checked against each other;
- **verdict** — allowed, refused, or *refused by budget* (the emulator's
  reason text, *"maximum of 1000 expressions to evaluate has been
  reached"*, does reach the client — `rules.test.ts` line ~3803 records
  it arriving on a positive control).

Probes are the seven the budget test already pins (all ten anchors at
their bounds; own-bank duel; world-content duel; pick round; late answer;
rank; the 32-member room) plus the thirteen refusal shapes the e2e hits,
plus one update. **Ablation** measures a clause: the script rewrites a
named helper's body to `true` (for a probe that arm accepts) and
re-measures; the delta is the helper's cost.

### What Phase 0 must answer before Phase 1 starts

| question | why it decides the design |
| --- | --- |
| Does the coverage count agree with the filler headroom (≈ 870 on the world-content probe)? | If yes, cost attribution is exact and the gate in §5 can be a plain number. If no, the filler method stays the oracle and coverage is only a guide. |
| What does one `get(…).data.x` site cost, and does the tenth cost the same as the first? | Decides how much §3(a) buys. If the emulator memoises the expression as well as the read, hoisting buys less than estimated. |
| Is a function's `let` evaluated before its `return`? | Decides whether §3(b) is real. Measure: ablate `let open` and see whether a pulse write gets cheaper. |
| Is the 1,000 budget per `allow` statement or per request? | The e2e log shows create *and* update evaluated for one write. If the budget is shared, the update arm's two fetches are charged to every create attempt on an existing doc. |
| What does `hasOnly([ten names])` cost? | Ten-name lists appear in every arm; if per-element, moving them behind cheaper discriminators is worth doing. |

**Done when:** a table of probe × (cost, headroom, verdict) is checked
in as `scripts/rules-budget-baseline.json`, the calibration question has
an answer, and D432 records the numbers. No rule changes in this phase.

## 3 · Phase 1 — restructure the answer rule, verdicts unchanged

Four moves, in the order of expected yield. Each is one commit, each
re-measured by the Phase 0 tool, and the invariant across all four is:
**every allow/deny verdict in `firestore-tests/rules.test.ts` is
identical, and `rules-coverage`'s never-false count does not move.** The
suite is the oracle for meaning; the profiler is the oracle for cost.

### (a) Fetch each document once — `let` + arguments

```
function isDuelAnswer() {
  return request.resource.data.surface in ["group", "duo"]
    && exists(/…/v2_questions/$(request.resource.data.qid))
    && duelBody(request.resource.data,
                get(/…/v2_questions/$(request.resource.data.qid)).data,
                get(/…/v2_groups/$(request.resource.data.gid)).data);
}
function duelBody(d, q, g) {
  let open = g.get("round", 1);
  let late = d.get("late", false);
  return d.keys().hasOnly([…])
    && … && request.auth.uid in g.memberUids
    && … && q.get("active", true) == true
    && (q.get("surface","daily") == d.surface
        || (q.get("surface","daily") in ["daily","feed"]
            && q.get("type","") in ["vote","binary","choice"]
            && q.options.size() > 0))
    && … < duelIndexSpace(q, g)
    && …;
}
```

Fourteen fetch sites become two; `duelIndexSpace` takes `q` and `g`
instead of fetching three more. Same treatment for `isWorldAnswer` (four
→ one), `isRankAnswer`, `isCatalogAnswer`, `isCallAnswer` and the update
arm (two → one). The `exists` guard is kept in front of the `get` so a
missing question is a clean *false* and not an evaluation *error* —
`rules-coverage` files an erroring negative as never-false (D429's own
finding, the 44 → 8 correction), and this refactor must not add one.
Billing does not change: one read per unique document per request,
before and after. *(estimate: the largest single saving in the plan,
100–150 on the duel arms.)*

### (b) Guard before `let`, so a rejected arm costs its guard

The `let`s move into the body function that is only *called* once the
surface matched (above). A pulse or call write, or a refused world write,
then passes `isDuelAnswer` for the cost of one `in` — not a group fetch
it had no business paying. This is the move that makes refusals cheap,
which is what turns "every refusal exceeds the budget" into "no refusal
does" — and that is what lets §5 assert it.

### (c) One discriminator, one arm

With (b) done, the `||` chain is already close to routing: every arm
opens on `surface`, and a non-matching arm costs ~3. What remains is
that `catalog` and `rank` share `surface == "feed"` with world answers
and are told apart by which value key the payload carries. Make the
routing explicit and total:

```
&& (  ("optionIdx" in d) ? optionArm()
    : ("entity"    in d) ? (isCatalogAnswer() && deviceBound())
    : ("order"     in d) ? (isRankAnswer()    && deviceBound())
    : false )
```

where `optionArm()` holds today's inner `||` over world/duel/pulse/call
behind the `optionIdx` bounds. Every write, allowed or refused, now
evaluates exactly one arm's body. Not strictly needed for cost after
(b); done because a rule that *reads* as a router is one the next
person cannot accidentally un-route. *(estimate: small; the value is
structural.)*

### (d) The update arm

`let q = get(v2_questions/$(resource.data.qid)).data` once; two fetches
→ one. Also the arm that the e2e shows erroring at `L1295:26` on every
create attempt (`resource` is null on a create) — if Phase 0 finds the
budget is shared per request, an `resource != null &&` guard at the top
of the update arm stops a create paying for an update evaluation that
can only error.

**Done when:** the profiler shows every one of the seven pinned legal
creates with headroom ≥ 400 *(target, provisional until Phase 0)*, every
one of the thirteen e2e refusals reports *refused* and not *refused by
budget*, the rules suite is 213/213 with identical verdicts, and
`rules-coverage` is at its baseline. D433 records the before/after
table.

## 4 · Phase 2 — the anchors, trimmed not moved

`isValidV2Anchors` stays: it is the only bound on ten client-written
strings that land on a public document, and §1 says why it cannot
become a profile comparison. What can change is its arithmetic. Each
key currently reads the map twice:

```
function isShortAnchor(anchors, key, max) {
  return anchors.get(key, "") is string && anchors.get(key, "").size() <= max;
}
```

becomes one read passed by value:

```
function shortStr(v, max) { return v is string && v.size() <= max; }
… && shortStr(anchors.get("city", ""), 80)
```

*(estimate: ~15 expressions across the ten keys — small, free, and it
is the arm D429's compile error named by line, so it is also where the
compile ceiling is bought back.)* Kept last in the rule, as D429 placed
it: after Phase 1 refusals are cheap on either side of it, and last
means a refused write still never pays it.

Not in scope: bounding anchors by fewer keys, changing any bound, or
touching D8's snapshot semantics.

## 5 · Phase 3 — the gate that holds it

**BUILT 2026-09-09 (D438), with two of its numbers re-derived.** The
plan below wrote *FLOOR ≈ 130 fillers ≈ 400 expressions* and *FLOOR +
60 must load* in D429's unit; D432 measured the unit at 8.1, the
thinnest legal create at 58 fillers and the compile ceiling at 94, so
130 fillers is above the ceiling and 130 + 60 could never load. What
shipped: **a floor of 50 fillers (~405 units — the plan's ≥ 400 in the
measured currency), a compile floor of 80, and every probe pinned at
exactly its measured headroom on both sides** (unchanged at N, budget at
N+1 — `check:globals` rule 4's two-sided shape, so the baseline stays a
measurement rather than a memory), with the compile-bounded refusals
held at the floor. `node scripts/rules-budget.mjs --gate`, chained into
`test:rules` after `rules-coverage.mjs`; `--pin` re-measures the pins
(`npm run test:rules:baseline`). Assertion 2 landed as written, in the
suite AND in the e2e's one denial helper, which is where the thirteen
had hidden.

Three assertions, all inside `test:rules`' existing emulator boot,
chained after `rules-coverage.mjs` in `package.json` the way it is
chained today. All three fail closed: no report is a failure, not a pass.

1. **Runtime headroom, live.** `check:rules-budget` loads one rules
   variant with **FLOOR** filler conjuncts appended (FLOOR ≈ 130 fillers
   ≈ 400 expressions *(provisional)*) and runs the seven pinned legal
   creates. All seven must be *allowed*. A change that eats headroom
   reds this before it ships instead of after a user is refused. The
   number lives in `scripts/rules-budget-baseline.json` and is a
   **shrink-only ratchet in `check:globals` rule 4's shape**: it may go
   up freely, and a change that needs it lower must move it deliberately
   in the same PR, with the reason.
2. **No refusal by budget.** `rules.test.ts` gains a local `refused()`
   used in place of `assertFails`, which additionally asserts the
   emulator's reason text does not contain *"maximum of 1000
   expressions"*. A sweep of every `assertFails` call site, mechanical.
   From then on a denial that is really an exhausted budget is a red
   test with the true reason in it — the exact thing the file's own
   comment says a case cannot currently tell.
3. **Compile headroom.** A variant with FLOOR + 60 fillers must still
   *load* — a deploy that would fail at the compile ceiling is caught
   here rather than on the deploy path.

`check:docs` will require the new gate in `ORIENTATION.md`'s gate table
and `CLAUDE.md`'s gate list; `check:figures` holds the count. The gate
is on the **PR path and the deploy path both**, because it runs inside
`backend-checks.yml`'s rules job — the property CLAUDE.md names (what
guards a PR is what guards production) is kept by construction.

**Done when:** the three assertions run in CI, the baseline is checked
in, and D438 records the floor and why it is that number.

## 6 · Phase 4 — the fallback, priced

If Phases 1–2 measure short of the target — the duel arms cannot be
brought under ~600 by rewriting alone — the structural answer is
**per-surface subcollections**: `v2_users/{uid}/answers/{aid}` keeps
world answers (daily, feed, test, learn — and catalog and rank, which
are feed), and duel, pulse and call answers move to their own
subcollections, each with a rule that is only its own arm. Every write
then evaluates a rule a third the size, with no routing at all.

The arithmetic, from the tree:

| touched | count | note |
| --- | ---: | --- |
| client write sites naming `"answers"` in `live.ts` | 18 | four are the answer creates; the rest are reads, mirrors and the pending queue (D312/D357) |
| Firestore triggers on `v2_users/{uid}/answers/{qid}` | 2 | `onV2AnswerCreated`, `onV2AnswerUpdated` — each becomes one per moved surface, or one with a document-path wildcard and a surface branch |
| composite indexes on the `answers` collection group | 22 | `firestore.indexes.json`, pinned by `src/v2/data/indexes.test.ts` |
| collection-group readers | `replay.ts`, `patternsFit.ts`, the ledger, `deleteAccount`'s erasure phases, `voters.ts` | every one that reads "all answers by anyone" must read N collections or one wildcard |
| e2e suites | all three | erasure and moderation walk the answer graph |
| production data | every existing duel answer | a one-off migration, with the reveal pipeline paused for it |

That is weeks, and it re-opens D426 §6.2's decision that a world
question is duel content (the same `qid` would live in two collections).
**Taken only if the profiler says §3 cannot reach the target**, and then
as its own plan with its own decision — this section exists so the cost
is on the table now, not discovered after §3 disappoints.

## 7 · What does not change

- **No verdict changes.** Every write that is allowed today is allowed
  after; every write refused today is refused after, for the same reason
  and now at a cost the rule can afford. The rules suite is the proof,
  case for case.
- **No billing change.** Firestore charges one read per unique document
  per request; `let`-hoisting changes how many *expressions* name the
  document, not how many times it is read.
- **No schema change** in Phases 0–3. No client change. No trigger
  change. No index change.
- **No new deny**, and the three that stand (CLAUDE.md) stand at their
  paths.

## 8 · Order, shape, records

| phase | PR | record | needs the owner |
| --- | --- | --- | --- |
| 0 — instrument | one, `scripts/rules-budget.mjs` + baseline, no rule change | D432: the calibration and the cost table | no |
| 1 — restructure | one PR, four commits (a)–(d), each measured | D433: before/after per probe | **go/no-go on this plan** |
| 2 — anchors | folded into Phase 1's PR as commit (e), or its own | in D433 | no |
| 3 — gate | one, the three assertions + docs | D438: the floor | no |
| 4 — fallback | its own plan, only if triggered | its own decision | yes — a migration |

Phase 0 is safe to start without a decision: it changes no rule and
answers questions this file currently estimates. Phase 1 is the one to
say go on. Phases 1–3 together are about a day of work if Phase 0's
numbers land where the estimates put them.

## 9 · Numbers, filled

Measured 2026-09-09 by `scripts/rules-budget.mjs` (D432 for the method,
D433 for the moves); `scripts/rules-budget-baseline.json` is the
checked-in copy of the last column. **Headroom is in filler conjuncts,
with budget units in brackets at the calibrated 8.1 units a filler** —
the number this file's §0 and D429 called "~3" and "~130" is the one
Phase 0 corrected, so the "today" column reads higher than the plan
expected and every later column is measured in the same currency. Cost
is the coverage report's count for the one write, which D432 found is
NOT budget units (a base-tree duel write counts 1,410 and is allowed);
it is kept because it attributes to a line.

| probe | cost today | headroom today | after (a)(b)(d) | after (c) | after Phase 2 (e) |
| --- | ---: | ---: | ---: | ---: | ---: |
| all ten anchors at their bounds (world) | 1124 | 75 (608) | 78 | 73 | **74 (599)** |
| own-bank duel | 1410 | 53 (429) | 60 | 59 | **62 (502)** |
| world-content duel *(thinnest, D429)* | 1410 | 46 (373) | 56 | 56 | **58 (470)** |
| pick round *(thinnest, D429)* | 1410 | 47 (381) | 56 | 56 | **58 (470)** |
| late answer | 1410 | 50 (405) | 58 | 57 | **60 (486)** |
| rank | 1710 | 56 (454) | 63 | 79 | **80 (648)** |
| 32-member room | 1410 | 53 (429) | 60 | 59 | **62 (502)** |
| six refusal shapes, the e2e's thirteen | 934–1554, *by budget* | over | over | ≥94, *refused* | **≥94 (≥761), refused** |
| one legal update | 200 | — | — | — | 192, allowed |
| compile ceiling on the create arm | | 85 | 85 | 94 | **94** |
| `test:e2e:all`, "maximum of 1000 expressions" | | 13 | | 0 | **0** |

The provisional target — ≥ 400 on every legal create — is met on all
seven in calibrated units (470–648) and would read as unmet in the
currency that was wrong; §3's "done when" was written before Phase 0
could say which. What did not move is the duel arm's own body: after
(a) it fetches nothing twice, and the ~609 counts it still costs are its
ten-name `hasOnly`, the aid composition, the member test and the
question checks — a design change to trim, not a refactor, and the
reason Phase 4 stays priced.
