# Measurement Notes — what the lanes actually produced

**Status: tree — findings, not theory.** Extracted 2026-09-03 on the
owner's ruling: *"nothing that has been created so far is axiom
theory."* That ruling stands, and this page is the salvage. The twelve
lanes produced 129 claims between 2026-08-25 and 2026-09-03; the useful
part of it is **measurement method, negative results, engineering
proposals and program findings** — worth keeping, worth acting on, and
**none of it an axiom theory**.

**What separates the two.** An axiom theory says what an axis could
*become* and what it makes the other axes worth, assuming it fully
populated ([`AXIOM-POTENTIAL.md`](AXIOM-POTENTIAL.md) is the first of
that kind). Everything below instead says how to measure honestly, what
not to build, and what to fix in the app that exists. Useful; different
subject. Filed here so the axiom work is not judged by it and does not
inherit it.

Nothing on this page is cited as authority by the app. Node ids
(`pat-4`, `gen-12`) point into `theory/` on the `axiom-theory` branch,
which is where the reasoning and the sources live.

## 1 · Measurement method — the rules that should govern the app

These are the findings with teeth. Each constrains what the product may
honestly say, and several describe surfaces that ship today.

- **Between-person structure does not carry to within-person, and an
  estimator blind to the difference returns an amalgam.** Reached
  separately by five lanes (`pat-9`/`pat-10`/`pat-11`, `tst-6`/`tst-7`,
  `map-7`/`map-12`, `bod-5`, `cen-1`), with documented sign reversal in
  the literature. *"You are more X than most people"* is a crowd
  statement and licenses nothing about how you change. The Mirror, the
  Oracle and the archetypes currently blend the two voices.
- **A coupling between two axes is identified only by the people who
  supplied both** (`pat-4`). Two axes never observed jointly pin their
  relationship to an interval, not a number — no sample size fixes it.
  `pat-12` adds the design answer: allocate deliberately for overlap
  rather than collecting evenly and joining afterwards.
- **The information budget has two dimensions — people, and occasions
  per person** — and they substitute only for crowd-level questions
  (`pat-8`). Anything the app says about *you* is bounded by your own
  occasions.
- **Where an instrument's validity collapses, declare the channel
  unmeasured rather than small** (`bod-7`).
- **A published number carries its level, population, basis,
  decomposition, validity status, design and as-of pin** — part of the
  object, not a caption (`cen-7`, with `map-6`, `gen-11`, `bod-8`).
- **A bare heritability figure is not a fact** (`gen-20`): estimator,
  phenotype definition and ascertainment each move it about twofold.
- **Joint scoring of correlated instruments is substantially more
  precise than scoring them one at a time** (`tst-9`).
- **Personality types are dimensional, not taxonic** (`tst-5`): an
  archetype is a region of continuous space with a drawn boundary, so
  the honest output is similarity-to-region, never a forced label.
- **Passive administration is measurement-theoretically distinct, not a
  budget compromise** (`tst-2`): in-the-moment items dodge the recall
  bias that global self-report carries.
- **Portability across culture and language is established per question
  and cohort, never assumed** (`que-4`), and comparison is graded to the
  invariance actually established.
- **Generated items inherit family-level parameter distributions, never
  known parameters** (`que-3`) — an AI-written question still has to be
  calibrated on live answers before it can be trusted.

## 2 · Negative results — what not to build

The easiest value to lose, because nothing visible comes of it.

- **No independently replicated demonstration exists of a genomic
  sequence model beating a tuned polygenic score** at individual-level
  prediction (`gen-12`); the leading claim shows near-zero uptake and is
  absent from all three 2026 benchmarks. `gen-13` bounds the headroom
  anyway — common-variant variance is predominantly additive.
- **Below a data-volume crossover the tuned classical baseline beats the
  learned sequence model** (`pat-6`), so engine choice is a measurement
  run continuously and out of sample, not a bet taken once.
- **Distillation from a learned representation to auditable factors is
  demonstrated technology whose faithfulness is unsolved** (`pat-7`).
  An audit layer must be an instrument with measured faithfulness, not
  an explanation extracted after the fact.
- **Nobody has studied whether readers map an aggregate display onto
  themselves**, nor whether they distinguish within- from
  between-person structure in a display (`map-10`). The Mirror's
  central reading act is unstudied — which is an opportunity as much as
  a caution.
- **On the body side**: trait–cortisol couplings are near-null between
  persons and the cortisol awakening response fails the reliability
  gate; per-meal glucose responses fail test–retest *even under
  controlled feeding*; HbA1c is an excellent person parameter
  (`bod-9`, `bod-10`). The useful body signals are slow aggregates, not
  per-event streams. `bod-13` is the honest positive: randomized
  inflammatory and hormonal manipulation does move mood and social
  cognition, acutely and at pharmacological dose.
- **The efficacy of argumentation substrates is unproven, not proven**
  (`go-9`) — the lane wrote this about its own method.

## 3 · A live product finding, verified against shipped code

`tst-1` ran its test against `src/v2/data/similarity.ts` rather than a
hypothetical, and the file matches its description: `flattenAxes`
flattens 22 axes over four instruments, `rankKindred` prints `100 −` the
mean absolute gap, and `AXIS_PRIOR = 6` / `TYPICAL_AXIS_GAP = 17` are
the shipped constants.

**The finding**, held at *argued* after its own adversarial pass cut the
seed draft's overclaim: the equal-weight shelf metric weights each
latent dimension in proportion to how many observed axes load on it, so
Kindred rankings shift where factors are unevenly represented — a
relative re-weighting, not the k-fold amplification first drafted. One
load-bearing independence assumption survives, in the λ=6 calibration
that chose `AXIS_PRIOR`. Worth a look at Kindred whatever else happens.

## 4 · Engineering proposals for the app that exists

The database lane's claims and the bridge queue belong here rather than
in any axiom: they are improvements to the current system, which is
exactly the owner's 2026-09-03 objection when they arrive labelled as
theory. As engineering they are sound.

- **Custody is a layout property before it is a policy** (`db-2`):
  separate custody classes physically, so a policy error cannot read
  what the layout never co-located.
- **Two databases and a bridge** (`db-3`): an append-only private ledger
  folding deterministically into public read models, with one place
  where custody transitions.
- **Per-person erasure is a transaction across ledger, bridge and read
  models** (`db-7`), and key destruction counts as erasure only
  conditionally.
- **Every ledger fact is bitemporal by contract** (`db-9`).

The sixteen `worth-building` bridge requests are in the same category —
fit self-measurement, item calibration, cross-axis structure artifacts,
database honesty, and two new collection items. They are listed with
their groupings in
[`AXIOM-EVALUATION.md`](AXIOM-EVALUATION.md) § What the theory is asking
the product to build. **Fourteen of the sixteen need no new data**,
which is why the closed bridge costs money rather than merely time.

## 5 · Program findings — how to run machine-written work at all

These generalize past this project and are the graph-optimizer and
review lanes' best output.

- **Unschematized conventions do not converge across fresh-session
  lanes** — they proliferate and drift into homonymy; convergence needs
  an enforced artifact (`go-10`). Confirmed twice over: source-grading
  reached two lanes of twelve, and §1's cross-axis rule produced no
  scenario in 129 claims. It is the reason the anti-drift fix is a gate
  and not a paragraph.
- **A zero in a contradiction metric measures recording, not harmony**
  (`go-6`).
- **Run cadence is a health dimension no content metric can see**
  (`go-11`): every other signal is a function of what the graphs say, so
  a program that has stopped delivering reads as maximally healthy.
  This is why the bridge stalled for seven days unnoticed.
- **Edge resolution is necessary, not sufficient** (`go-12`): an edge
  warrants against its target's claim *as it read when the edge was
  made*, so a rewrite silently strands it.
- **The weakest rung is the citation only its writer has read**
  (`rev-2`) — an independent spot-check is the highest-value act a
  reviewer performs. The first review found a real defect this way.
- **The reviewer is reviewed by its decline rate** (`rev-6`): feedback
  declined with reasons three reviews running is evidence against the
  rubric, not the lane.

## 6 · What this page is not

It is not a roster, not a contract and not authority. It does not
supersede `DECISIONS.md`, and no gate reads it. Where a finding here
should bind the app, it becomes a decision record through the ordinary
governed process — the same route anything else takes.

And it is not axiom theory. That work starts at
[`AXIOM-POTENTIAL.md`](AXIOM-POTENTIAL.md), under a charter that now
forbids the two habits which produced this page instead: theorizing the
current product, and letting today's scale bound tomorrow's ambition.
