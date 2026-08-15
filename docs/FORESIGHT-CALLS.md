# CALL — the half of Foresight that asserts a fact

**Status: design only. No code exists.** D126 shipped Foresight's READ
half; this is the write-up of the other half, requested before any of it
is built. Read it as a proposal with the failure modes named, not as a
description of the tree.

A **CALL** is v19's second Foresight card: a real-world event sealed now
and scored when it resolves. "Arsenal to win the league", answered in
August, graded in May.

## 1 · The thing that makes this different from everything else here

Every number InSight currently displays is **arithmetic on its own data**.
A cohort split, a likeness percentage, a Scores mean, a READ verdict —
all of them are folds over documents the reader can open and recompute.
When the app says "48% of people your age agreed", anyone can check it.

A resolved CALL is not that. It is the app **asserting a fact about the
world**, and no amount of reading its own documents can verify the claim.
If the app says Arsenal won and Arsenal did not, there is nothing to
recompute — there is only a wrong answer, marking real users wrong, with
no arithmetic to appeal to.

That is the actual decision in this document. The plumbing is small; the
question of whether this app is willing to assert unverifiable facts is
not.

**The governing constraint (revised 2026-08-12): the app never asserts a
fact it cannot check.** Not "checks carefully" — *cannot check* is
disqualifying at authoring time, which is what §3 enforces. The effect is
that a resolved call keeps the property every other number here has: the
reader can recompute it, from the aggregate for tier A or from the
published fetch inputs for tier B.

## 2 · Why "Claude writes and grades them" is right about half of it

The proposal that prompted this was to have Claude author the questions
and grade the outcomes. The first half is already how this repo works;
the second half is the part needing care.

**Authoring is content, and the lane exists.** `docs/QUESTION-FARM.md`
describes a scheduled Routine that fires into a dev session, writes
questions in the product's voice, runs the repo's own gates and **opens a
pull request — never pushes**. Its own summary of the design: *"AI joins
the existing review pipeline as a proposer; humans stay the gate."* D97
built `check:quality` and provenance tracking around it. D1 permits
machine-authored questions; what it forbids is fabricated *activity* —
answers, votes, takes, people.

**Grading is not content.** It is the assertion in §1. The farm's rule 4
("never generate answers, votes, takes, or people") does not literally
cover it, and that is precisely why it needs its own rule:

> **A machine may propose an outcome. It may never be the reason an
> outcome is believed.** The reason is the executed rubric — arithmetic
> or a fetch — and its inputs are published with the result.

The first draft satisfied that rule with a human confirming each
citation. §3 satisfies it better, by admitting only questions whose
rubric a machine can *run*: the model authors the question and the
rubric, and the grader executes it. The model is never the thing being
trusted, in either half.

### One constraint the farm's cadence imposes

CALL questions are **perishable** in a way daily questions are not. The
farm's cycle is PR → human review → merge → deploy → seed. A card about
tonight's match cannot survive that; a card about the league in May can.
**`resolvesAt` must clear the pipeline with room to spare**, which in
practice means calls are authored weeks or months out, not days.

## 3 · Only admit questions a machine can check

**Revised 2026-08-12 on the owner's constraint: a call has to be
verifiable and gradable by the machine that grades it.** The first draft
of this section put the safety in a human confirming every resolution.
That is the weaker design, and this is the stronger one: put the
constraint on the QUESTION, at authoring time, so grading is safe by
construction rather than by someone catching mistakes at the end.

The filter is not "is this interesting" but **"can this be executed"**.

### The rule, as the owner set it (2026-08-13)

> *"Take things that are very easy to verify — sport, TV show winners,
> world events like elections. Then a routine goes through and verifies
> them, and if it comes down to unverifiable, the question gets that
> status."*

Three parts, and the first does most of the work.

**1 · Admit only unambiguous-outcome questions.** Not "interesting", not
"topical" — **settled by a fact that everyone reporting it agrees on**.
Who won. Who was elected. Which show took the award. These share a
property that is worth naming because it is the property being selected
for: the outcome is a matter of public record within hours, reported
identically by every source, and nobody argues about what happened.

That excludes, by construction, the whole class this design was worried
about — "will the economy improve", "will AI change everything", anything
needing a threshold nobody agreed in advance. **Question selection is the
safety mechanism**, and it is far stronger than any amount of care at
grading time.

| Admitted | Refused |
| --- | --- |
| Who won the league / the election / the award | Whether it was deserved |
| Which of these two took more box office | Whether the film was good |
| Whether a named person held office on a date | Whether they did well |
| The app's own aggregate crossing a stated threshold | Anything needing a judgement call |

**2 · A routine verifies, on a schedule.** Not a one-shot at
`resolvesAt`: it wakes, works through the open calls, and resolves the
ones it can. That matters because "the result is knowable" and "the
result is published where the routine looks" are different days for a
surprising number of events.

**3 · UNVERIFIABLE is a status the question carries**, not a failure of
the run. This is the owner's refinement of the void-only design below and
it is better: a question that cannot be settled today is *marked*, stays
marked, and is retried — rather than being destroyed on first difficulty
or, worse, guessed at to avoid the awkward state.

### The one place I would push back

"Easy for a human to verify" and "safe for a machine to auto-resolve" are
not the same property, and the gap is not ambiguity — it is **confident
error**. A model asked who won a 2027 election will produce a plausible
name whether or not it knows, and the answer will not look uncertain.
Selecting unambiguous questions removes the *ambiguity* risk entirely and
does nothing about that one.

So the category rule needs one mechanical companion, and only one:

> **Two independent sources must agree, and both are stored with the
> outcome.**

Not a confidence score (a model's confidence in a fabrication is high),
not a human reading every one (that was the first draft, and it does not
scale past a handful). Agreement between sources fetched separately is
the cheapest check that a *fabrication* cannot pass, because a made-up
winner will not be corroborated. Disagreement is not a tie-break to
resolve — it is exactly what `unverifiable` is for.

### The rubric is executable data, not prose

This is the change that makes "gradable by Claude" testable instead of
hoped for. A rubric is not a sentence for a human to interpret — it is a
small expression the grader runs:

```jsonc
// Tier A — no network at all
{ "kind": "agg", "qid": "daily-231",
  "test": "topShareAtLeast", "threshold": 60,
  "options": ["Yes", "No"] }        // true → idx 0, false → idx 1

// Tier B — one fetch, one comparison
{ "kind": "fetch",
  "url": "https://api.example.com/pl/2026-27/table",
  "path": "standings[0].team",
  "map": { "Arsenal": 0, "*": 1 } }
```

### The gate: dry-run the rubric before the question ships

A rubric that cannot be executed **today** will not work in May either.
So a call is admitted only if the grader can already run it and return a
well-formed provisional result — which proves the source exists, the path
resolves, and the mapping covers what comes back. The answer being
non-final is fine; the answer being *unobtainable* is disqualifying.

That is a CI gate (`check:calls`), not a review step, and it is the
single highest-value piece of this design:

- Tier A rubrics are checked against the live aggregate.
- Tier B rubrics are fetched once and the path asserted to resolve.
- A rubric whose `map` has no `*` fallback is rejected — an unmapped
  value at resolution time is a void nobody planned.

**If the dry run cannot produce a parseable answer, the question is not a
call.** That sentence replaces "if a crisp rubric cannot be written",
and the difference is that a machine enforces this one.

## 4 · Schema

### The question — `v2_questions/{id}`, `surface: "call"`

Rides the existing seed path (`scripts/gen-v2content.mjs` →
`functions/src/v2content.ts` → `seedContentV2`) with two new fields:

```
resolvesAt : Timestamp   the earliest moment grading may run
rubric     : the executable expression from §3 — `{kind:"agg",…}` or
             `{kind:"fetch",…}`. Data the grader runs, not prose a
             reviewer interprets.
tier       : "A" | "B"   which grading path applies
```

### The outcome — `v2_call_outcomes/{qid}`, a NEW collection

Deliberately **not** a field on the question doc, and the reason is
mechanical: `runSeedV2` diffs each question against its stored payload
and skips unchanged docs (`seedDocMatches`), which is what keeps
`updatedAt` meaningful as an incremental cursor and stops a reseed
rewriting the whole bank. Writing outcomes onto question docs would put
operational state inside content the seed believes it owns, and the two
would fight on every reseed.

```
status     : "resolved" | "unverifiable" | "void"   §7
outcomeIdx : number      the winning option; absent unless resolved
sources    : array       the TWO agreeing sources, stored (§3)
attempts   : number      verification passes so far, for RETRY_LIMIT
resolvedAt : Timestamp
resolvedBy : "auto" | <uid of the human who resolved an exception>
inputs     : map         WHAT THE GRADER SAW — the aggregate snapshot
                         (tier A) or the url, raw value and fetch time
                         (tier B). This is the field that keeps the
                         claim checkable; without it the outcome is an
                         assertion again.
note       : string      optional, required on a void
```

### The answer — `v2_users/{uid}/answers/{qid}`, unchanged shape

No new collection. A call is answered exactly like a world question:
create-only, `optionIdx`, the D8 anchors snapshot. Two rules changes are
needed and both are one-word:

- `isWorldAnswer()`'s surface list (`firestore.rules:332`) gains
  `"call"`, as does the matching question-surface check below it.
- The collection-group read grant gains `"call"` so a call's who-voted
  sheet works like every other card's.

Adding `"call"` to `isWorldAnswer` also brings D29 device binding along,
which is wanted: a call is exactly the kind of thing a sybil would want
to spam.

### No verdict document

Unlike a READ verdict (D126), **a call needs no new write to be scored**.
The player's answer and the outcome are both readable, so the client
joins them. This falls out of the design rather than being engineered,
and it is worth stating because the obvious implementation invents a
verdict collection nobody needs.

## 5 · The two lanes

### Authoring — the existing farm, one new rule

A Routine fires into a dev session, which writes N call candidates with
rubrics into the content bank and opens a PR. The human reviewing checks
the rubric, not just the prose. Everything else — `check:quality`,
provenance, the append-only discipline, the no-place-scoped-civic rule —
applies unchanged.

### Resolution — a routine, on a schedule

Because §3 admits only executable rubrics, resolution is not a judgement
call:

1. A scheduled run finds calls past `resolvesAt` with no outcome.
2. It **executes the rubric** — arithmetic for tier A, one fetch and a
   comparison for tier B. Never a recollection.
3. Clean result → it writes the outcome with the inputs it used.
4. Anything else — sources disagree, the result is not published where
   it looks, the aggregate is still empty — is **not** guessed. The call
   is marked `unverifiable` (§7), the card says so, and the next run
   tries again. After `RETRY_LIMIT` passes it voids.

No human is in the resolve path. That is only defensible because of the
category rule in §3 — the questions admitted have outcomes nobody
disputes — plus the two-source check that a fabrication cannot pass. A
human is needed only to review the QUESTION at authoring, and to void a
call that has sat unverifiable long enough to be hopeless.

**What still gets published either way:** the inputs the grader used —
the aggregate snapshot for tier A, the URL, the raw fetched value and the
timestamp for tier B. The basis sits beside the claim, which is the same
posture as D98's model and D126's frozen `answerIdx`, and it is what lets
a player check the grade rather than trust it.

## 6 · Rules and who may write what

| Path | Read | Write |
| --- | --- | --- |
| `v2_questions/{id}` (call) | signed in | nobody (seed, admin SDK) |
| `v2_call_outcomes/{qid}` | signed in | **nobody** — admin SDK only |
| `v2_users/{uid}/answers/{qid}` | signed in (D98) | owner, create-only |

`outcomeIdx` must never be client-writable. If it were, every score in
the feature would be forgeable in one request — a strictly worse version
of the limitation D126 already records about its own client-written
`answerIdx`, because there the basis is published and checkable and here
it would be the basis.

Publishing `inputs` is what keeps the claim honest: the basis sits beside
the assertion, the same posture as D98's whole model and D126's frozen
`answerIdx`. For tier A it is stronger than that — the input IS a
published aggregate, so a player can recompute the grade rather than
merely inspect it.

## 7 · The status lifecycle — unverifiable, then void

A call is in exactly one of four states, and the middle two are the
owner's contribution to this design:

```
open ──► resolved            outcome known, two sources agreed
  │
  └────► unverifiable ──┬──► resolved   a later run settled it
                        └──► void       after RETRY_LIMIT, or on request
```

**`unverifiable` is a status, not an error.** The routine sets it when it
cannot settle a call — the event slipped, the sources disagree, the
result is not published where it looks — and the card SAYS SO: *"we
couldn't verify this one yet."* Nobody is scored while it holds.

Why this is better than the void-only design it replaces: a single
verification run failing is not evidence that a question is bad, and a
design whose only options are *resolve* and *destroy* pressures the run
toward resolving — which is the exact failure mode §3's second paragraph
is guarding against. Giving the awkward case a name it can rest in
removes the pressure.

**`void` remains, as the end of that road, not the first response.** It
is correct for: the event was cancelled outright; the question turned out
to be badly written; `RETRY_LIMIT` verification passes have all come back
unverifiable. A void scores nobody and says why.

The one rule that makes the whole lifecycle honest: **an unresolved call
must never quietly disappear.** It takes the player's guess, so it owes
them an answer or an explanation. A card stuck on `unverifiable` is
showing an explanation; a card that vanished is not.

## 8 · No new seal

A call answer does not need the duel seal. The daily's existing
blind-then-reveal already stops you reading the room before you play, and
*after* you have answered, seeing that 60% of the city disagrees with you
is the interesting part rather than a leak. Sealing until `resolvesAt`
would hide the one reading a call generates for months.

## 9 · Failure modes

| Failure | Mitigation | Residual |
| --- | --- | --- |
| Model asserts a wrong outcome from memory | Structurally impossible: the grader executes a rubric, and tiers C/D never enter the bank | The model can still author a *bad rubric* — which is what the §3 dry run catches, and what tier A avoids entirely |
| A tier-B endpoint changes shape between authoring and resolution | Path miss is an exception, not a guess: retry, then hand to a human | Real, and the reason tier A ships first |
| Question is ambiguous | Rubric required at authoring, reviewed in the PR | Ambiguity only visible once reality arrives → void |
| Event resolves earlier or later than `resolvesAt` | Resolver re-checks on a schedule rather than once | A call that resolves *early* stays open; harmless |
| Source disappears | Void | Player loses the guess, told why |
| Nobody resolves it | The resolver run reports open-past-due calls loudly | Requires the Routine to actually be watched |
| Client forges an outcome | Admin-only write | none |
| Sybil spam | D29 device binding, via `isWorldAnswer` | Same as every world answer |
| Timezone edge on `resolvesAt` | Store UTC; rubric's `at` is the human-readable version | Off-by-a-day on a close call → void |

The one with no clean mitigation is the first row's residual, and it is
worth stating plainly: **this design reduces the chance of the app
asserting a falsehood; it does not eliminate it.** Everything else the
app says can be recomputed by the person reading it. This cannot.

## 10 · Cost

Negligible, and worth stating so it is not a reason to defer: roughly ten
questions authored and ten resolutions confirmed per week, each a single
Routine turn. No per-answer server work — scoring is a client-side join
(§4). No new triggers, no new aggregates, no new indexes.

## 11 · What is deliberately left open

- **Whether the app should assert facts at all.** §1. Narrowed rather
  than settled: with tier A the app asserts nothing it cannot recompute,
  so the question only really bites for tier B.
- **Tier B at all.** It could be dropped and the feature would still be
  real — tier A is self-contained. Every remaining risk in §9 belongs to
  B, so shipping A alone and never adding B is a legitimate end state,
  not a half-built one.
- **Which tier-A tests to offer.** `topShareAtLeast` is the obvious one;
  "will these two slices disagree", "will turnout beat yesterday" and
  "will the leading option change" are all arithmetic on the same
  aggregate and each is a different kind of thinking. This is the
  interesting design work and it is entirely unblocked.
- **Crowd-relative scoring.** "You called it and 82% didn't" is a strong
  reading and needs the same collection-group query D126 defers.
- **The Map's Foresight branch.** Still unbuilt for both halves; D126 §
  "Also not built" has the reason.
