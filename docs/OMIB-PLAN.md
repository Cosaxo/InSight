# OMIB plan — the logic test on a calibrated bank, scored for accuracy

**Status: plan notes — sequenced, priced, not built.** The owner chose the Open
Matrices Item Bank for the logic test on 2026-09-11 (D451) on one
requirement, *"they have to be correct from the start"*, and asked on
2026-09-12 for *"the best way to implement this to get the most accurate
scores"*. This is that plan. The bank is in the tree and gated
(`content/omib.json`, `check:omib`); the screen is designed
(`design/logic-build-cell-2026-09-12/`, visual request 13); the twenty
shapes are derived from the bank's own geometry (`src/v2/data/omib-shapes.ts`).
What follows is what turns a calibrated bank into a calibrated SCORE, in
the order that gets there safely.

The instrument this replaces is D31's generator, scored by D57/D60/D402:
server-minted forms, raw count → a modelled logistic until an empirical
histogram clears n = 100, then a measured rank. Everything in that
pipeline that is about TRUST — the server holds the key, first attempts
feed norms, an effort floor, an era stamp — survives unchanged. What
changes is what the number IS.

## 0 · What "accurate" means here, and the order it comes in

A score is accurate to the degree that three things hold, and they nest:

1. **The stimulus is what was calibrated.** Show a different picture, a
   different clock or a different answer format from the 2,572 people the
   parameters came from, and the parameters describe a test nobody is
   taking.
2. **The score uses the calibration.** Two people who each solve 18 of 25
   did not do the same thing if one's 18 were harder. The parameters exist
   to say how much harder; a raw count throws them away.
3. **The number a person reads ranks them against a population that
   exists.** A percentile is a claim about other people; which people has
   to be true and said.

§1 is decided and mostly built. §2 is the core of this plan. §3 is the
existing norms machinery, re-pointed. Nothing in §2 or §3 is visible to
a user until the screen (§5) exists, so the server half can be built,
tested and deployed first, dark.

## 1 · Stimulus fidelity — decided

| Dimension | The bank | The app | Status |
| --- | --- | --- | --- |
| Geometry of the twenty elements | `drawing.js`, 100-unit cell | `omib-shapes.ts`, derived by scaling, arrows out, counter-clockwise ids | **built**, held by `omib-shapes.test.ts` |
| Items | 9 × 20-bit codes | `content/omib.json`, cross-checked against the artwork | **built**, `check:omib` |
| Per-item clock | 90 s (the reference implementation's default) | `LOGIC_ITEM_CAP_MS = 90_000`, already | **decided** 2026-09-12 |
| Form length | 20 in the reference; any | `LOGIC_ITEMS = 25`, already | **decided** 2026-09-12 |
| Response format | construct the cell from twenty elements | the designed screen | **designed**, not built |
| Scoring an item | exact match of the 20-bit vector, dichotomous | the same — see §2.1 | to build |

**One honesty note that stays attached to §1.** The 90 s is the default in
the bank's own demo code. Whether the calibration study administered
exactly that is stated in the paper (Koch, Spinath, Greiff & Becker
2022, *J. Intelligence* 10(3):41), which no session here has been able
to reach — `www.mdpi.com` and `pmc.ncbi.nlm.nih.gov` are both blocked by
this environment's egress. Matching the number the authors ship is the
best available answer, not a confirmed one; the row on `OWNER-LIST.md`
that asks for those two hosts is the way to close it.

## 2 · The scoring model — θ, not a count

### 2.1 An item is right or wrong, exactly

The taker's answer is a 20-bit vector. It is correct iff it equals the
published solution bit for bit. No partial credit, no "most of the
elements": the parameters were estimated on dichotomous responses and
would not mean anything under a different rule. An empty vector (nothing
placed, the clock ran out) is wrong — and is also recorded as
*unattempted*, a distinction the count never had and §6 uses.

### 2.2 Why not `k / 25`

The bank's items span difficulty **b** from −8.98 to +2.41 and
discrimination **a** from 0.11 to 5.16. Under a raw count a person who
solves the twelve easiest items and a person who solves twelve spread
across the range get the same score, and the second has demonstrated
more. Worse, two DIFFERENT forms (§3) have different totals of
difficulty, so a count is not even comparable between two takers — the
generator's forms had that problem too (D62 recorded it), and a fixed
weight per family was its best answer. A calibrated bank has the real
answer.

### 2.3 The model

Two-parameter logistic. For item *i* with discrimination *a<sub>i</sub>*
and difficulty *b<sub>i</sub>*, a person at ability θ answers correctly
with probability

    P_i(θ) = 1 / (1 + exp(−a_i (θ − b_i)))

Given a form's responses *u<sub>i</sub>* ∈ {0, 1}, the likelihood of θ is

    L(θ) = Π_i  P_i(θ)^u_i · (1 − P_i(θ))^(1 − u_i)

**Estimate θ by EAP** — the posterior mean under a standard-normal prior,
computed on a fixed grid (−5 … +5 at 0.05, 201 points; the bank's most
negative *b* is −8.98 but a prior of N(0, 1) keeps the posterior where a
person can be):

    θ̂  = Σ_g θ_g · L(θ_g) · φ(θ_g)  /  Σ_g L(θ_g) · φ(θ_g)
    SE = sqrt( Σ_g (θ_g − θ̂)² · L(θ_g) · φ(θ_g)  /  Σ_g L(θ_g) · φ(θ_g) )

Not maximum likelihood: MLE is infinite for a perfect or a zero score,
which is exactly the case a 25-item form on a phone will meet daily. EAP
is finite everywhere, is the standard for short and adaptive forms, and
gives the **standard error per person, per form** for free — which is
what the result screen's *band* (D402's ±2 items, a modelled constant)
becomes: a real interval, wider for a taker whose items were badly
matched to them, narrower for one whose were not.

**Where it runs.** `functions/src/logic.ts`, inside `logicSubmitV2`'s
existing transaction, from the same regenerate-and-compare step that
today produces marks. Pure, dependency-free arithmetic — 25 × 201
evaluations of a logistic — so it lives in its own module
(`functions/src/irt.ts`) with the functions suite pinning θ̂ and SE for
hand-computed cases and for the edge forms (all right, all wrong, one
item). Nothing about it needs the client.

**What the client receives**, on the wire `VerifiedScore` already has:
`score` (the count, kept — it is what a person can check against their
memory), **`theta`** and **`se`** (new, the measurement), `pctile` and
`band` (as now, but derived from θ — §4), `source` and `n` (as now).
Marks per item stay in the response so the Answers lens keeps working.

### 2.4 What precision to expect, so the copy can be honest

Test information at θ is Σ *a<sub>i</sub>*² *P<sub>i</sub>*(1 − *P<sub>i</sub>*).
With 25 items of mean *a* ≈ 2.1 spread across the range, a taker near the
middle of the bank's scale gets SE ≈ 0.30–0.40; at the extremes, where
few items are informative, nearer 0.5. In percentile terms that is a band
of roughly ±10 points in the middle — comparable to what D402 modelled
with its ±2 items, now measured rather than assumed. An adaptive form
(§3.3) reaches ≈ 0.25 with the same 25, or matches 0.35 with about 15.

### 2.5 The bank's quality floor

Of 220 items, one was published without parameters and one has
*a* < 0.5 (it does not discriminate; a person's answer to it says almost
nothing about θ). **Both are excluded from forms**, leaving **218**. The
floor is a named constant beside the loader (`OMIB_MIN_A = 0.5`), with the
count pinned in a test so a future retune of the floor is a visible
change to what the test draws from. Ten items sit below *a* = 1.0; they
stay — they carry information, only less of it — and the exposure
accounting in §3.2 will show whether they earn their place.

## 3 · Which 25 of 218 — and why not adaptive yet

### 3.1 Stratified random, seeded per attempt

The bank's rules-per-item form a pyramid — 20 · 50 · 80 · 50 · 20 for
one through five rules — and a form should keep that shape so every
taker meets the same *kind* of test: **2 · 6 · 9 · 6 · 2** by rule count,
drawn without replacement inside each stratum from a seed the server
mints at `logicStartV2` (the D57 mechanism, unchanged), ordered easy → hard
by published *b* within the form so the ramp the overlay's design assumes
is real. Two people therefore take two different forms of the same
shape; §2 is what makes their θ comparable anyway.

This retires the generator's `planV4` for verified attempts. The
generator itself stays in the tree, byte-synced and gated
(`check:logic-sync`), for two reasons: a saved result's `seed + gv` must
reconstruct its form forever (D31), and it remains the only source that
can mint a fresh item at a target difficulty for as long as the app runs
— the answer to D451's recorded limit that the OMIB key is public.

### 3.2 Exposure

With 218 items and 25 per form, an item appears in about one form in
nine. The D62 ledger — per-family seen/solved counts, first verified
attempts only — becomes **per-item**: `i_<n>_seen`, `i_<n>_solved`, same
document, same gate, same era stamp. Two things fall out of it: which
items are over-drawn (a stratum with few items, the 1- and 5-rule ones,
exposes each of its members more), and §6's validity check.

### 3.3 Adaptive selection — the accuracy ceiling, and why it is phase 4

Choosing each next item to maximise information at the current θ̂ is
what "most accurate" means in this field, and 218 calibrated items make
it entirely feasible. It is deliberately NOT the first build, for one
structural reason: today's protocol mints the whole form at start and
scores it at submit, two callables. Adaptivity needs a callable per
item — `logicNextV2(pick) → next item` — which is 25 transactions
per attempt instead of 2, a round trip on a phone's network before every
puzzle, and an attempt document that carries state across all of them.
That is a different cost and a different failure surface, and it should
be built on a working stratified path, not instead of one. Stratified
random with θ scoring gets most of the gain; adaptive is the increment
that comes after §6 has shown the calibration transferred.

## 4 · The norms — a θ histogram, and what the fallback claims

The D60 machinery is right and stays; it counts the wrong thing.
`b0 … b25` (a histogram of counts) becomes a histogram of **θ̂ in 0.25
bins from −5 to +5** — forty buckets on the same private document, the
same public mirror, the same first-attempts-only gate, the same effort
floor (D402), the same **n ≥ 100** before a rank is measured. The era
stamp gains a member: `{ bank: "omib", items: 25, gv: 1 }`, so a
generator-era histogram and an OMIB one can never fold into each other
(D61's rule, one axis over, exactly as D402 extended it).

**The fallback below the floor is the part to get the copy right on.**
Today the model is a logistic with a chosen midpoint. Under IRT there is
a natural one: θ is on the calibration sample's scale, standardised to
mean 0 and SD 1, so **Φ(θ̂)** — the standard normal CDF — is the share of
*that* population below the taker. It is a real population, which the
old curve was not. It is also **2,572 applicants to medical school**,
which means a typical general-population taker will read as below its
median. The result must say whom it is against — *"sharper than 31% of
the people this test was calibrated on"* until n = 100, then *"… of N
InSight players"* as now. That sentence is a claim, not a caption, and
`docs/COPY.md` §3 does not license shortening it. `source: "model"` stays
the wire's word for the first case.

Once the InSight histogram clears the floor, `measuredPctile` ranks θ̂
against it exactly as it ranks counts today, and the `band` becomes
[Φ or rank](θ̂ − SE) … (θ̂ + SE) — the same interval read through the same
curve, the D402 shape with a real SE in it.

## 5 · The client — what changes on the wire and what does not

`startVerified()` returns `items[]` where each is `{ code }` — the eight
visible cells as a 9-group string with the ninth all zeros (what
`content/omib.json` already stores) — plus `capMs` and `deadlineMs` as
now. `submitVerified(picks)` sends **25 twenty-character strings** instead
of 25 indexes; `validLogicPicks` grows a sibling that checks length,
alphabet and count. The overlay renders a code with `omib-shapes.ts`
(`bitsOf` → `SHAPES[i]`), the palette with `PALETTE_ORDER`, and builds
the answer with `cellOf`. Everything the design decided — tap to toggle,
Clear, Done, the draining segment, the two clocks, a time-out that
commits as it stands — is the screen's; this plan does not re-decide it.

**Practice mode.** Today a practice attempt runs the generator on the
device and scores locally, because the device has the rule machinery. It
cannot score an OMIB item locally without the key, and the key is not
allowed on a device (`build-omib.test.mjs` holds `src/` to never naming
it). Recommendation: **practice attempts use the same bank and the same
screen, scored by a lightweight callable that returns marks and θ and
folds nothing** — no attempt document, no cooldown, no norms. One screen,
one format, and the two modes differ only in what counts. The cost is a
network round trip at submit that practice never had; the alternative —
practice on the generator's six-tile screen, verified on the build-a-cell
screen — teaches two formats for one test and is worse. This is a
product call as much as a build one and is listed for the owner.

**Tests the repo's rules demand**, named so they are not skipped: the
functions suite for `irt.ts` and the new scorer; a `smoke-*` mount of the
overlay on a served code (the `logic-overlay.test.jsx` pattern); the e2e
leg extended to an OMIB start → submit → θ round trip on the emulator;
`vote.test.ts`'s `window.LIVE` surface untouched (nothing here adds a
member).

## 6 · Knowing it worked — the check the owner can see

The parameters are a promise that the items behave the same way for our
takers as for the calibration sample. That promise is testable from the
ledger in §3.2 once first attempts number in the hundreds: for each item,
the observed solve rate against its published *b*. If the calibration
transferred, the two correlate strongly and negatively (harder items
solved less) — **r beyond −0.8** is the bar; if it did not, something
about our administration differs from theirs (the clock, the screen, the
population) and the number says by how much. The same pass prints the
InSight mean θ̂, which is expected below 0 (the calibration sample is
selected) and is the first honest sentence about where this app's
population sits. Both are one report (`scripts/omib-report.mjs`, the
`scorecard` shape), run by hand at first and by the console once the
count justifies it. This is the accuracy claim, measured; without it the
plan is an argument.

## 7 · What does not change

Written out so the scope is visible: the two callables and their names;
the attempt document and its rules (`v2_logic_attempts`, never readable);
`LOGIC_MAX_STARTS_PER_DAY`, the cooldown, `LOGIC_DEADLINE_MS`; the effort
floor and the phantom-scorer fix (D402); the private/public norms
documents and their mirror cadence; the `testResults.logic` write and
`saveTestResultV2`'s bounds (D431); the D227 logic bands, which read a
percentile and do not care where it came from; the privacy page and the
store forms — nothing new leaves a device, and per-item timings stay on
it (D57's promise). `check:logic-sync` keeps the generator's two copies
byte-identical. `check:omib` keeps the bank the authors' bank.

## 8 · Sequence

| Phase | What | Needs | Proves |
| --- | --- | --- | --- |
| **0** — done | Bank in and gated; shapes derived; 25 × 90 s; design filed | — | `check:omib`, `omib-shapes.test.ts` |
| **1** — server, dark | `irt.ts` (EAP + SE); bank loader with the quality floor; stratified seeded selection; exact-match scoring; the OMIB era stamp; `logicStartV2`/`logicSubmitV2` switched behind a constant; per-item ledger | the `omib-key.json` reaching `functions/` at build (the `v2content.ts` pattern, generated, gated) | functions suite: θ̂ pinned; e2e: a full OMIB attempt on the emulator |
| **2** — client | The screen (VR 13 → built), the wire, the worked example | phase 1 deployed; the practice-mode call | smoke mount; the mount-app suites green; `check:tap-targets` on twenty tiles |
| **3** — norms | θ histogram, Φ fallback with its sentence, measured rank, the band from SE | phase 1's era stamp | rules suite on the new document paths; `check:policy-claims` unchanged |
| **4** — later | Adaptive selection; the §6 report on real counts | hundreds of first attempts | the r figure |

Phases 1 and 3 are one deploy if built together, and nothing a user sees
moves until phase 2 ships. That is the order that keeps every commit
green and lets the arithmetic be wrong in a test before it is wrong on a
phone.

## 9 · For the owner

Two calls, neither blocking phase 1:

- **Practice mode** — the same screen scored by a light callable (the
  recommendation, §5), or the generator's screen kept for practice.
- **The two hosts** — `www.mdpi.com` and `pmc.ncbi.nlm.nih.gov` on the
  environment's allowlist, so the calibration study's own administration
  can be read rather than inferred from its demo code (§1). Already on
  `OWNER-LIST.md`.
