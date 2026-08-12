# CALL — the half of Foresight that asserts a fact

**Status: design only. No code exists.** D102 shipped Foresight's READ
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
not, and everything below is shaped by answering it **cautiously**.

**The governing constraint: a resolution is a citation, never a belief.**

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
> outcome is believed.** The reason is the citation, and a human confirms
> the citation supports the outcome before anyone is scored.

### One constraint the farm's cadence imposes

CALL questions are **perishable** in a way daily questions are not. The
farm's cycle is PR → human review → merge → deploy → seed. A card about
tonight's match cannot survive that; a card about the league in May can.
**`resolvesAt` must clear the pipeline with room to spare**, which in
practice means calls are authored weeks or months out, not days.

## 3 · The rubric is the highest-leverage piece

Every CALL carries a **resolution rubric**, written by the same run that
writes the question and reviewed by the human in the same PR. It is the
single change that moves the hard judgement to a moment when a human is
already reading.

A rubric names three things:

| Field | What it pins |
| --- | --- |
| `settles` | The exact fact that decides it, in one sentence, with no adjectives that need interpreting |
| `source` | Where that fact is published — a named authority, not "the news" |
| `at` | When the fact becomes knowable, which is what `resolvesAt` is derived from |

**If a crisp rubric cannot be written, the question is not a call.** That
is the filter, and it kills most of the bad ideas at authoring time:

- ❌ "Will AI change everything?" — `settles` cannot be written.
- ❌ "Will the economy improve?" — needs an adjective interpreted.
- ✅ "Will Arsenal finish top of the Premier League 2026/27?" —
  `settles`: the final league table's first row. `source`: the Premier
  League's published table. `at`: the day after the final matchday.

A rubric a reviewer cannot check in thirty seconds is a rubric that will
not survive contact with the resolver.

## 4 · Schema

### The question — `v2_questions/{id}`, `surface: "call"`

Rides the existing seed path (`scripts/gen-v2content.mjs` →
`functions/src/v2content.ts` → `seedContentV2`) with two new fields:

```
resolvesAt : Timestamp   the earliest moment grading may run
rubric     : { settles, source, at }
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
citation   : string      the URL or reference the human confirmed
resolvedAt : Timestamp
resolvedBy : string      the uid that confirmed it
note       : string      optional, for a void or a close call
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

Unlike a READ verdict (D102), **a call needs no new write to be scored**.
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

### Resolution — a new Routine, human-confirmed

1. A scheduled run wakes and finds calls past `resolvesAt` with no
   outcome document.
2. For each, it **fetches the rubric's named source** — it does not
   answer from memory — and proposes
   `{ outcomeIdx, citation }` or `unresolvable`.
3. It writes those proposals **into a PR or an issue, not into
   Firestore**. Same shape as the farm: propose, never apply.
4. A human reads the citation, confirms it supports the outcome, and
   runs the write.

The write itself is admin-SDK only (§6). D87 already requires an approval
for production writes; a resolution is one.

**Confirming is not rubber-stamping.** The human is checking one thing:
*does the cited source say what the proposal claims it says.* That is a
thirty-second job when the rubric is good, which is the whole reason §3
exists.

## 6 · Rules and who may write what

| Path | Read | Write |
| --- | --- | --- |
| `v2_questions/{id}` (call) | signed in | nobody (seed, admin SDK) |
| `v2_call_outcomes/{qid}` | signed in | **nobody** — admin SDK only |
| `v2_users/{uid}/answers/{qid}` | signed in (D98) | owner, create-only |

`outcomeIdx` must never be client-writable. If it were, every score in
the feature would be forgeable in one request — a strictly worse version
of the limitation D102 already records about its own client-written
`answerIdx`, because there the basis is published and checkable and here
it would be the basis.

Publishing the citation is what keeps the claim honest: the basis sits
beside the assertion, the same posture as D98's whole model and D102's
frozen `answerIdx`. A wrong resolution becomes **visible and
contestable** instead of silent.

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
| Model asserts a wrong outcome from memory | Resolver must fetch and cite; human confirms the citation | A human confirming carelessly. The rubric is what keeps confirmation cheap enough to be done properly |
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

- **Whether the app should assert facts at all.** §1. Answered
  cautiously here, not settled.
- **Auto-resolve with spot-checking.** Rejected for the first version in
  favour of human-confirms-every-one, matching D87's posture. Worth
  revisiting once there is a track record of proposals to measure — the
  measurement is the precondition, not the calendar.
- **Crowd-relative scoring.** "You called it and 82% didn't" is a strong
  reading and needs the same collection-group query D102 defers.
- **The Map's Foresight branch.** Still unbuilt for both halves; D102 §
  "Also not built" has the reason.
