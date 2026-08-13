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

### The tiers

| Tier | Truth comes from | Grading is | Admitted |
| --- | --- | --- | --- |
| **A · self-resolving** | the app's own published aggregate | arithmetic | **yes** |
| **B · machine-readable source** | a named endpoint with a stable schema | fetch + compare | **yes** |
| **C · prose source** | a page whose text must be interpreted | judgement | no |
| **D · general knowledge** | the model's memory | nothing | never |

C and D are where every failure mode in §9 lives. Excluding them at
authoring is what makes the rest of this document short.

### Tier A — the strongest, and the one to ship first

A call on the app's **own future data**:

> *"Tomorrow's question: will more than 60% pick one option?"*
> *"Will 25-34 and 55+ disagree on tomorrow's question?"*

Unknown when you answer, settled by the aggregate a day later, graded by
arithmetic over documents the player can open. **No external source, no
network, no operator, no LLM anywhere in the grading path** — and it
inherits the property that makes every other number in this app
defensible: the reader can recompute it.

It is a different card from the prototype's sport-and-tech calls, and it
is the only kind that is verifiable end to end. Ship this first, alone,
and the feature is real with nothing outstanding.

### Tier B — real events, still mechanical

Admitted only when the rubric names a **machine-readable** source: an
endpoint, a path into the response, and the mapping from value to option.
Sports tables, election results, chart positions, box office. The model
writes the rubric; it does not judge the outcome.

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
outcomeIdx : number      the winning option, or -1 for VOID
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

### Resolution — mechanical, with the human on the exceptions

Because §3 admits only executable rubrics, resolution is not a judgement
call:

1. A scheduled run finds calls past `resolvesAt` with no outcome.
2. It **executes the rubric** — arithmetic for tier A, one fetch and a
   comparison for tier B. Never a recollection.
3. Clean result → it writes the outcome with the inputs it used.
4. Anything else — endpoint down, path missing, value not in `map`,
   tier A aggregate still empty — is **not** guessed. It retries, and
   after a bounded number of attempts raises the call for a human, who
   resolves it by hand or voids it.

The human is on the **exceptions**, not on every row. That is only
defensible because C and D never entered the bank; if they had, every row
would be an exception wearing a clean-result costume.

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

## 7 · VOID is a first-class outcome

`outcomeIdx: -1` means the call is void: nobody is scored, and the card
says why.

This is not an error path, it is a requirement. **An unresolved call is
worse than a missing feature** — it takes the player's guess and never
comes back. Voiding must be available for:

- the event was cancelled or postponed past any useful window;
- the rubric turned out to be ambiguous once reality arrived;
- the named source stopped publishing, or contradicts itself;
- the question was badly written and nobody noticed until grading.

The last one matters most. A void is the honest outcome for *our* mistake,
and making it easy is what stops a reviewer reaching for a plausible
answer instead.

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
