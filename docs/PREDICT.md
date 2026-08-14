# PREDICT — the channel where you guess and the world settles it

**Status: design. No code exists for the CALL half; the READ half is built
and has no surface.** Supersedes [`FORESIGHT-CALLS.md`](FORESIGHT-CALLS.md),
which covered CALL alone and is kept as history — this document is the live
one. Recorded as D137.

Two card families under one feed channel:

- **READ** — which option did one slice of the population pick? Ten
  seconds, scored instantly against the published cell. **Built** (D126):
  `src/v2/data/foresight.ts`, `src/v2/ui/LiveForesightLens.tsx`, verdict
  rules at `firestore.rules:252`, both suites. **Dark since D136**, which
  took it off the Mirror's lens row and deliberately kept the machinery.
- **CALL** — a future event, answered now and graded when it resolves.
  Designed, never built.

They are one channel because they are one sentence with the tense changed:
*you guessed, the world settled it*. A READ guesses a crowd that already
exists; a CALL guesses one that does not exist yet — or an event outside
the app entirely.

## 1 · Why this app should do prediction at all

Prediction games are everywhere and most of them are a score. This one has
something no other app can assemble, and it falls out of machinery that is
already running:

**A call's answers are ordinary feed answers, so `agg.by` fills itself.**
Before anything resolves, the card can say *71% of the world thinks Yes —
38% of over-55s do*. That is a crowd forecast cut by who made it, which
exists nowhere else.

**After it resolves, `byDim` runs unchanged.** The function that today
says "you read age well and education badly" (`data/foresight.ts:230`)
answers a bigger question the moment its input is a call log: **which
slices of humanity read the future better**. Age, education, country.

That is the Mirror's thesis pointed at the future, and it is the reason to
build this rather than a score. **The score is the least interesting
output** and should never be the headline of the surface.

One product boundary, stated once so it does not need re-deciding: **no
stakes, no payouts, no positions.** This is a game about being right, not
a market. Keeping it that way keeps the app out of a regulatory surface
the store forms would have to answer for.

## 2 · READ needs a placement, not a build

D136 removed the lens and wrote down that the engine stands. Moving it to
the feed is the follow-on D126 itself named, and it is where the prototype
puts these cards.

**D126's objection to the feed does not survive the code.** It said a read
in the feed would have to restate its population scope on every card,
because the Mirror's ruler supplied it. It did not: `COHORT_DIMS` is
global (`ageBand, gender, city, country, education, relationship`) and the
card already prints its own scope — `Age · 25–34 · 41 answers`,
`LiveForesightLens.tsx:106`. The ruler was never doing that work.

So the move is: pin the existing body as a feed card (the Crossroads
placement, `world-feed.jsx:3582`), import it rather than publishing a
global — `check:globals` rule 4 only goes down — and restore the mount
case D136 deleted. No rules, no functions, no content, no seed.

`READ_MIN_N` (8) and `READ_MIN_LEAD` (12 points) are unchanged and stay
what they are: fairness thresholds, not disclosure floors. Nothing is
withheld at any size; the question is whether guessing a three-answer
slice is a game or a coin toss.

## 3 · CALL — both tiers, and which one is the point

| Tier | Truth comes from | Grading is | Admitted |
| --- | --- | --- | --- |
| **A · self-resolving** | the app's own published aggregate | arithmetic | yes |
| **B · machine-readable source** | named endpoints with stable schemas | fetch + compare | **yes — this is the feature** |
| **C · prose source** | a page whose text must be interpreted | judgement | no |
| **D · general knowledge** | a model's memory | nothing | never |

**This reverses `FORESIGHT-CALLS.md` §11's "shipping A alone and never
adding B is a legitimate end state".** That sentence was written when the
open question was whether the app should assert facts it cannot recompute.
The owner's answer, 2026-08-14: predicting real events is the feature, and
a channel that can only ask about its own aggregate is not the product
anyone wanted. Tier A stays — it is free once the pipe exists and it is
the only kind that is recomputable end to end — but it is the warm-up, not
the destination.

C and D stay refused, unchanged. They are where every failure mode lives,
and excluding them at authoring time is what keeps the rest of this
document short.

**A machine may propose an outcome. It may never be the reason an outcome
is believed** (D127). That rule is untouched and is the spine of §5: the
reason is the executed rubric, and its inputs publish with the result.

## 4 · The four rules that make an unverifiable claim safe enough

Tier B is the one thing this app does that its reader cannot recompute.
Four rules carry that weight. The first is new and is the one that changes
the risk class.

**1 · Two independent sources; disagreement is a void.** Every tier-B
rubric names two machine-readable sources. They agree → resolve. They
disagree → exception, then a human or a void. One extra fetch converts
*the app asserted a falsehood* into *the app declined to assert*, which
for this codebase is the right trade every time. Sources must be
independent in fact, not just in URL — two mirrors of one feed are one
source, and the reviewer's job is to say so.

**2 · Stable across two runs, twenty-four hours apart.** The resolver
reads, waits a day, reads again, and resolves only if both agree. This
kills three failure modes with one rule: provisional results that firm up
overnight, a source mid-correction, and the vandalism window on anything
community-edited. Cost: one day of latency on a question authored months
in advance.

**3 · A committed host allowlist.** `rubric.url` must match a pinned list
of hosts and path prefixes. Without it, a merged rubric is an arbitrary
outbound fetch executed by a privileged server, and a reviewer approving
prose would be approving a request they never read. `check:calls` enforces
this offline, so it cannot be waived by a rubric that looks fine.

**4 · The basis ships with the claim.** `inputs` carries both URLs, both
raw values and both fetch times, and the card prints them. You cannot
recompute a world fact; you can see exactly what the app looked at. Same
posture as D98's whole model and D126's frozen `answerIdx`.

**Nothing in `functions/` currently reaches the public internet.** Tier B
is the first outbound egress in this backend. That deserves one deliberate
look — timeouts, retry bounds, what a hung fetch does to a scheduled run,
and whether the allowlist belongs in code or in config — before it is ten
sources instead of two.

### Sources — candidates, not commitments

**Unverified.** None of these has been probed from this tree, and probing
is precisely what the §9 dry run is for. By category: football tables and
fixtures, launch manifests, weather thresholds (the most reliably
machine-readable of the lot), market and crypto closes, and **Wikidata**
as the general-purpose one — "winner of X" is a property lookup returning
an entity id rather than prose. Wikidata plus one domain-specific source
is a natural pairing for rule 1: independent, and rarely wrong in the same
direction.

## 5 · Schema

### The question — an ordinary feed doc

**Ride the feed bank; do not mint a surface.** `FORESIGHT-CALLS.md` §4
proposed `surface: "call"` plus two rules edits. This does what D114 did
for the continuum forms and D136 did for Crossroads instead:

```
surface : "feed"
type    : "call"
```

Everything then carries unchanged — the create rule, the aggregate
trigger, the ledger, the by-cells, the D86 cooldown and the voters panel.
Zero rules edits on the create path, zero fold edits, and the crowd
forecast of §1 arrives for free because the aggregate is the aggregate.

Four new fields:

```
closesAt   "2026-09-05"    answering stops (UTC day key)
resolvesAt "2026-09-19"    grading may run (UTC day key)
tier       "A" | "B"
rubric     the executable expression below
```

**Day-key strings, not Timestamps, and the reason is mechanical.**
`seedValueMatches` (`functions/src/pure.ts:1327`) bottoms out at
`(a ?? null) === (b ?? null)`; a Firestore Timestamp compared against
whatever the payload holds never matches, so the doc would rewrite on
every seed run while reporting itself as legitimate drift. That is D136's
bug exactly, and it cost a live outage of the content cursor to find once
already. Rules also already parse this shape — `firestore.rules:421`
builds `timestamp.date(int(day[0:4]), …)` off a duel day key — and day
granularity deletes the timezone row from §12.

**`closesAt` is not the same field as `resolvesAt`, and conflating them
breaks the game.** See §12's reflexivity and lookup rows: a call whose
answers close two days after it ships is a genuine read, and the same call
left open until the day it resolves is a lookup.

### The rubric — executable data, never prose

```jsonc
// Tier A — no network at all
{ "kind": "agg", "qid": "f231",
  "test": "topShareAtLeast", "arg": 60 }

// Tier B — two sources, one comparison
{ "kind": "fetch",
  "sources": [
    { "url": "https://…/pl/2026-27/table", "path": "standings[0].team" },
    { "url": "https://…/sparql?query=…",   "path": "results.bindings[0].winner.value" }
  ],
  "map": [["Arsenal", 0], ["*", 1]] }
```

**`map` is an array of pairs, not an object.** `functions/src/seed.test.ts:96`
walks every seeded value for empty or dotted map keys, because Firestore
refuses them — so `{"A.C. Milan": 0}` fails at seed time and nothing
before it. A pair list has no key space to violate. A `map` with no `"*"`
fallback is rejected: an unmapped value at resolution is a void nobody
planned.

### The outcome — `v2_call_outcomes/{qid}`, a new collection

Deliberately not a field on the question doc: `runSeedV2` diffs each
question against its stored payload and skips unchanged docs, which is
what keeps `updatedAt` meaningful as an incremental cursor. Operational
state inside content the seed believes it owns would fight it on every
run.

```
outcomeIdx  number       the winning option, or -1 for VOID
resolvedAt  Timestamp
resolvedBy  "auto" | <uid of the operator who resolved an exception>
inputs      map          WHAT THE GRADER SAW — the aggregate snapshot
                         (tier A) or both urls, both raw values and both
                         fetch times (tier B)
note        string       optional; required on a void or a correction
rev         number       bumped when an outcome is corrected (§7)
```

### The answer — unchanged, and no verdict document

A call is answered exactly like any feed question: `optionIdx`, the D8
anchors snapshot, one doc at `v2_users/{uid}/answers/{qid}`. **A call
needs no verdict document** — the answer and the outcome are both
readable, so the client joins them. This falls out of the design rather
than being engineered, and it is worth stating because the obvious
implementation invents a collection nobody needs.

## 6 · Rules — the whole diff

**1 · The update arm must refuse calls.** This is a correction, not an
addition. `FORESIGHT-CALLS.md` §4 says a call answer is "create-only"; that
was true when D5 held and false by the time it was written. D86 admits an
`optionIdx` edit on any answer whose `surface` is daily/feed/test
(`firestore.rules:509`). With no verdict document, the sequence is:
outcome publishes → edit your answer → score a hit. **The feature is
forgeable in one request without this clause.** The fix is one term on a
`get()` the rule already performs:

```
&& get(/databases/$(database)/documents/v2_questions/$(resource.data.qid))
     .data.get("type", "") != "call"
```

A prediction you can revise after the fact is not a prediction — the same
sentence `data-inventory.md` already uses about foresight verdicts.

**2 · The create arm closes at `closesAt`.** Answering after the outcome
is knowable is the same forgery as editing. Inside `isWorldAnswer()`
(`firestore.rules:342`), defaulting an absent field far into the future so
the other ~500 bank docs are untouched:

```
&& request.time < callCloses()   // timestamp.date(int(k[0:4]), …), duel-key idiom
```

**3 · `v2_call_outcomes`** — `allow read: if request.auth != null;`
`allow write: if false;` (admin SDK only), plus its row in
`docs/data-inventory.md`, which `check:data-inventory` will demand anyway
(D130). `outcomeIdx` must never be client-writable: if it were, every
score in the feature would be forgeable in one request — strictly worse
than the limitation D126 records about its own client-written `answerIdx`,
because there the basis is published and checkable and here it *is* the
basis.

That is the entire rules surface: two clauses and one match block, each
needing a `rules.test.ts` case.

## 7 · Grading — one function, three callers

**`gradeCall(rubric, ctx)`, pure, in `functions/src/pure.ts`.** `ctx` is
either the target's aggregate (`kind: "agg"`) or the two fetch results
(`kind: "fetch"`). One implementation, three callers — the CI gate, the
operator dry run and the scheduled resolver — so the gate cannot pass
something the resolver then chokes on. Pure means the functions suite
covers it with no emulator and no Java.

### The tier-A tests

All arithmetic over the public aggregate's `{ counts, total, by }`
(`functions/src/v2.ts:641`), which is the same document `cellFor` reads,
so a call and the Explore lens can never disagree.

| test | asks | outcome |
| --- | --- | --- |
| `topShareAtLeast` | will the leading option hold ≥ N%? | Yes/No |
| `optionShareAtLeast` | will option *k* reach N%? | Yes/No |
| `bucketsAtLeast` | on a dial: will ≥ N% land above the midpoint? | Yes/No |
| `slicesDisagree` | will two slices' top picks differ? | Yes/No |
| `leaderIs` | which option ends in front? | the target's own options |

`leaderIs` is the one worth building first: its options mirror the
target's, so the card is a real choice rather than a coin flip. The gate
asserts the two option lists correspond, which is `check:calls` earning
its keep.

`slicesDisagree` inherits `READ_MIN_N` — a slice under it is an exception,
not a verdict.

### The resolver

`onSchedule("every 24 hours")` in a new `functions/src/calls.ts`, modelled
on `scheduledDuelReveals` (`v2social.ts:902`):

1. find calls past `resolvesAt` with no final outcome;
2. execute the rubric — arithmetic for A, two fetches for B. Never a
   recollection;
3. tier B holds the reading for the §4 stability window and resolves on
   the second agreeing run;
4. clean result → write the outcome **with its inputs**;
5. anything else — target aggregate empty, slice under the minimum, a tie
   on `leaderIs`, a host that timed out, a value outside `map`, two
   sources disagreeing — is **not guessed**. It retries, and after a
   bounded number of runs raises the call for a human.

Plus `resolveCallsNowV2`: the operator lever, `assertOperator` +
`SEED_ADMIN_UIDS`, no `enforceAppCheck` for the reason `revealDuelsNowV2`
already carries — a control that fails when it is most needed is not a
control — with its named exemption in `check:appcheck` so it cannot spread
by copy-paste. `dryRun: true` executes the rubric and reports what it
would grade without writing, which is what a reviewer runs against reality
before merging a batch.

**VOID is a first-class outcome, not an error path.** `outcomeIdx: -1`,
nobody scored, the card says why. An unresolved call is worse than a
missing feature: it takes the player's guess and never comes back. Void
has to be easy, or a reviewer reaches for a plausible answer instead of
admitting the question was bad.

**Outcomes are correctable, and that is a change from tier A's
assumptions.** If the app grades a world event wrong, an operator must be
able to fix it: `rev` bumps, `note` explains, the card says "corrected".
The consequence is a client one — an outcome is not immutable, so it
cannot be cached forever (§8).

## 8 · The client

**The READ card** — §2. One card, pinned, playing one read at a time.

**The CALL card is dealt into the stream**, which is the opposite of
Crossroads and for the opposite reason: everything in `renderCard`'s
apparatus has something to say about a call. Option rows, the split,
who-voted and takes all work unchanged. Two pieces of chrome are new: a
kicker before (*"Closes Friday · settles 19 Sept"*) and a verdict banner
after (*"64% of you said Yes. It was No."*).

**The join.** A new `src/v2/data/calls.ts` turns (answer, outcome) pairs
into `Verdict`-shaped rows, so `recordOf` from `foresight.ts` folds reads
and calls into **one Predict record** with no change to the fold. `byDim`
is the §1 payoff and takes the same rows.

**Read cost.** You only fetch an outcome for a call you answered, that is
past `resolvesAt`, and that you have not cached. Outcomes are stable but
not immutable (§7), so the cache carries `rev` and re-checks anything
resolved in the last seven days; after that it is permanent. Typical
session: zero to three document reads. Not a collection scan, and not a
listener.

**The channel is live-only, and that is the first of its kind here.** A
demo call needs an invented outcome, which is exactly what D1 forbids and
D126 named as CALL's third blocker. A demo read needs invented cells. So
`predict` joins `WORLD_TOPICS` (hue near 120 is unclaimed) and the **live**
`WORLD_CHANNELS` list only — the mirror image of `places`/`fav`, which are
demo-only. The asymmetry looks like a bug and needs a comment in
`world-feed-data.js` saying it is not.

## 9 · Gates

**`check:quality`** — `call` joins `FEED_TYPES`
(`scripts/question-quality.mjs:94`, a closed list since D113) with a
validator holding: 2–4 options; both day keys well-formed with
`closesAt < resolvesAt`; `resolvesAt` at least 21 days out, because the
farm's cycle is PR → review → merge → deploy → seed and a perishable card
cannot survive it; `tier` in `A|B`; `test` in the closed list with args in
range; tier B carrying exactly two sources and a `map` with a `"*"` arm;
no authored crowd texture (the dial/field rule — an authored crowd in the
live bank is a fabricated one); and a provenance row like every feed
append.

**`rubric.qid` may not be the call's own id.** A call about its own split
is self-fulfilling by construction and would otherwise pass every other
check.

**`check:calls`** — offline, on the lint path. It runs the real
`gradeCall` over a synthetic aggregate and asserts a well-formed result,
checks every tier-B host against the allowlist, and refuses a rubric whose
`map` has no fallback. **Deliberately not pointed at live Firestore or the
live internet**: `backend-checks.yml` is called by both `ci.yml` and
`firebase-deploy.yml` so that what guards a PR is what guards production,
and a gate needing credentials or a third-party endpoint to be up could
block an emergency rules fix. The against-reality check is the dry-run
lever in §7, run by a human before merge.

**The transport checklist is D136's, verbatim, because both of its gaps
were silent.** A new bank field reaches production only if every one of
these carries it: `scripts/gen-v2content.mjs` (the emitter), the
`V2SeedQuestion` interface, the seed payload **whitelist**
(`functions/src/v2.ts:331` — a field it does not name never reaches
Firestore, and the question seeds looking perfectly correct), and
`SEEDED_FIELDS` (`functions/src/pure.ts:1291` — a field the seed does not
compare is a field an edit can never move). `rubric` is an object, so it
needs the structural comparator arm D136 already built for
`nodes`/`endings`.

## 10 · Content, cadence and horizon

The lane is the feed lane (D97, `QUESTION-FARM.md`), and every hard rule
inherits: the product's voice, no place-scoped civic questions, never
generated activity, PR-only output, dedup, the quality pre-flight, the run
log. Two additions:

- **The rubric is reviewed, not just the prose.** A reviewer who reads
  only the question has not reviewed the question.
- **The dry run is part of the review.** A rubric that cannot return a
  well-formed provisional answer today will not work in May.

**Horizon: weeks to months, in batches of roughly six to ten a month.**
The farm's cycle makes anything shorter impossible, and this is not worth
fighting — a call you made in August and see graded in May is the only
thing in the app that sits in your record for a season. The daily deck is
a habit; a call is a commitment.

Shapes worth writing, one per kind of thinking:

- *"Arsenal to finish top of the Premier League."* — tier B, two sources,
  resolves in May.
- *"A crewed launch will slip past its announced date."* — tier B, the
  most InSight-ish kind: a question about institutions, not sport.
- *"Berlin will hit 35 °C before September."* — tier B, weather, the
  easiest schema to trust.
- *"More than 60% will say they'd take the money."* — tier A, on a target
  question shipping in the same batch, so its aggregate is empty at close.
- *"25–34 and 55+ will land on different sides of this."* — tier A,
  `slicesDisagree`, and the hardest to look up.

## 11 · Cost

Negligible, and stated so it is not a reason to defer. Roughly ten
questions a month and ten resolutions; one scheduled run a day reading at
most a few dozen documents and making at most a few dozen fetches. No
per-answer server work — a call answer folds through the aggregate trigger
that already exists, and scoring is a client-side join. No new triggers,
no new aggregates, no new indexes, no listeners.

## 12 · Failure modes

| Failure | Mitigation | Residual |
| --- | --- | --- |
| The app asserts a false outcome | Two independent sources; disagreement voids. The grader executes a rubric, never a recollection; C and D never enter the bank | **Real and irreducible.** Two sources can be wrong together. This design lowers the odds; nothing removes them |
| A source changes shape between authoring and resolution | Path miss is an exception, not a guess: retry, then a human | Real, and why two sources matter more than one good one |
| A source is edited maliciously near resolution | The 24-hour stability window | A patient vandal beats it; the second source is the actual defence |
| A merged rubric fetches somewhere it should not | Committed host allowlist, enforced by `check:calls` offline | Only as good as the allowlist review |
| **The crowd moves what it is predicting** | `closesAt` shuts answering before the target's counts mean anything | **Real, and new to tier A.** A call about a question in the same feed is read by the people who then answer it. Name it on the card rather than pretending otherwise |
| **A call is a lookup, not a game** | Targets ship in the same batch, so the aggregate is empty at close; slice tests are far harder to look up than totals | A determined player can watch early returns. `closesAt` bounds how much they see |
| Grades are snapshots, not recomputable | `inputs` publishes the exact counts the grade was made from | **The aggregate has no time axis.** A reader can check the grade against the snapshot but cannot re-derive it later, because shares keep moving. This is a genuine step down from every other number in the app |
| A player edits their answer after resolution | §6 rule 1 | none, once the clause lands |
| A player answers after the outcome is knowable | §6 rule 2 (`closesAt`) | none |
| A client forges an outcome | Admin-only write | none |
| Nobody resolves a call | The resolver reports open-past-due calls loudly | Requires someone to read the report |
| The question was badly written | VOID, and it is easy | The player loses the guess and is told why |
| Sybil spam | D29 device binding, inherited via `isWorldAnswer` | Same as every world answer |
| A hung fetch stalls the scheduled run | Timeouts and bounded retries — new territory for this backend (§4) | Needs a deliberate first design, not a default |

## 13 · Staging

1. **READ gets a surface.** No rules, no functions, no content, no seed.
   Ships the channel and the card family.
2. **The call pipeline, end to end**, with a first batch mixing tier A
   (proves the arithmetic with nothing that can go wrong) and tier B
   (proves the fetch, the two-source rule and the allowlist). Two rules
   clauses, `gradeCall`, the resolver, the operator lever, `check:calls`,
   the transport chain, the card chrome, the join.
3. **Who called it** — accuracy by slice, which is §1's payoff and is
   mostly `byDim` pointed at a different log.

## 14 · Deliberately left open

- **Where the Predict record lives permanently.** Inside the read card
  today. The Map's Foresight branch (D126, "also not built") is the
  obvious home and still needs a rule for what a guess means on a canvas
  that files answers.
- **Crowd-relative scoring** — "you called it and 82% didn't". One
  collection-group query away, and the same one D126 defers.
- **Whether a wrong grade needs a user-facing dispute route** or whether
  published `inputs` plus an operator lever is enough. Start with the
  lever; the answer depends on how often it is used.
- **Whether tier B's allowlist belongs in code or in remote config.** Code
  first: a reviewable diff is the point.
