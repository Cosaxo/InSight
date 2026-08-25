# Axes — the sources the app crosses, and the two it does not have yet

> **Building rather than deciding?**
> [`AXES-RUNBOOK.md`](AXES-RUNBOOK.md) is the same work as an ordered
> build list — open steps only, dependency order, what "done" means and
> which gate proves it — plus the routine program that executes it (§10
> here is the reasoning behind that program). It holds order and status;
> this file holds the reasoning and stays canonical. If they disagree,
> this file is right and the runbook is stale.

**Status: plan notes, not decisions.** Requested 2026-08-24 (the owner's
framing: *axis* as a new term for the tests and the other places data is
gathered from — general info is one, the logic test is one, the
questions are one, interests are one and the lenses as well — with the
app's point, or one of its main ones, being how the axes overlap and
connect; the two future axes are **genetic** and **body info**, up to a
meal tracker, smart-watch integration and uploaded brain or body scans,
toward "the most comprehensive database of how genes connect to
different traits"; and the proposed doors are the two bottom corners,
for the feel of connection in every direction and one big connection
map). Same convention as
[`NEXT-FUNCTIONALITY.md`](NEXT-FUNCTIONALITY.md): an item picked up
graduates to a record in [`DECISIONS.md`](DECISIONS.md), and until then
a *build* verdict here is this document's recommendation, not approval.
Nothing below is built, and nothing in today's schema is bent in
anticipation — the rule NEXT-FUNCTIONALITY §5 recorded for genetics,
applied to this whole file.

**The core function this frame serves (the owner, 2026-08-25): the
axes exist to be connected.** One of the app's core functions is to
use and connect the different axes to better understand — and get
deeper data about — each other. A trait read by one axis is shallow
alone; crossed against the rest it becomes the thing the app is for.
Every coupling below answers to that sentence, and so does the theory
layer: [`AXIOM-THEORY.md`](AXIOM-THEORY.md)'s lanes carry it as
first-class subject matter (charter §1), with genetic and body
explicitly charged with theorizing how the other axes' traits map onto
genes and onto the body's parts and systems — at the perfect
capability, not bounded by what ships next.

Everything here was measured against the tree rather than assumed, with
paths cited so the next reader can re-check. Three discoveries shape the
plan more than any opinion could:

- **The app is already an axis-crossing machine.** Anchors cross every
  answer at write time (`functions/src/pure.ts`, `BREAKDOWN_DIMS`) —
  which, because test items are ordinary answers, means trait-by-city is
  *already a published census* (`src/v2/data/similarity.ts` folds place
  profiles from `by.city` cells). The device crosses further: archetype ×
  vote (`data/typeSplit.ts`, D146), logic quartile × vote
  (`data/logicSplit.ts`, D227), type × population (`data/typeMix.ts`,
  D202), trait axis × trait axis (`data/traitLinks.ts`). And questions
  cross questions through the nightly fit (`functions/src/patterns.ts` →
  `v2_patterns/loadings`). What the frame adds is a name, a registry and
  the couplings nobody has pointed the machinery at yet — not a new
  architecture.
- **The two words are taken, both of them.** "Axis" has four live
  meanings in the tree — an instrument's trait dimension (shipped copy:
  "Politics · Six axes", the D254 axis bands), a field on every bank
  question (`axis` in `functions/src/v2content.ts`'s `V2SeedQuestion`),
  chart geometry, and the ruler metaphor. "Lenses" has five — the nine
  minor instruments (`src/v2/spec/lens-defs.js`), the Mirror's per-stop
  tabs, the patterns tab's sub-views, the logic result's tabs and the
  Circle map's overlays. §1 prices this; the pick is a word decision,
  which is to say the owner's (D182).
- **The body axis has already begun, through the front door.** Height is
  an anchor band (D140), sleep and energy are pulse questions (D203),
  and the App Store Health row is already YES on the roster
  (`docs/STORE-FORMS.md`). The cheap half of "body info" is the
  questions axis carrying body content — no new machinery at all.

## 0 · The short version

| Item | Verdict | The constraint that shapes it |
| --- | --- | --- |
| The frame (axes · stops · lenses) | **Adopt as vocabulary — it names what exists** | Stops answer *who*, lenses *how*, axes *what*. Nothing moves in the schema. |
| The word "axis" | **Owner's call; this file recommends keeping it and qualifying the old sense** | Four live meanings already, one of them a per-question field name. On screen, show rather than say (§1). |
| Axes projected into the fit's space | **Build — the frame's first visible product** | Everything it reads is public (D98) and the Map already draws the plane. "Project, don't refit" (§2); the one sentence it touches is D8's, and that check is owed before ship. |
| Body: banded facts and pulses | **Already arriving; keep going** | Height (D140), sleep/energy (D203), the NEXT-FUNCTIONALITY §4 checklist for the next fact. Content work, not machinery. |
| Body: watch rollups | **Build behind the consented tier** | One banded rollup a day, folded on the device. An involuntary measurement is not a chosen answer, so D98-public is not the default here (§3). |
| Body: meal tracker | **Defer as a tracker; the question-shaped version is free** | A food log is a product of its own. "How do you usually eat" pulses get most of the reading at none of the cost. |
| Body: brain/body scans | **Refuse for now** | No coarse version of a scan exists (the faces argument, NEXT-FUNCTIONALITY §4); the pipeline is a lab's; the plausible n is a handful; the posture is medical. The door back is derived *values*, arriving banded. |
| Genetic, stage 1: device-only | **Design now; build after the D168 carve-out is decided** | Import a consumer raw file, score on the device against shipped public weights, show you-beside-your-scores. Nothing leaves. The blocker is not privacy — it is that imported weights are science the app cannot recompute (D168). |
| Genetic, stage 2: the consented tier | **Design now; adopt separately; legal work first** | Art. 9 data has no home in the world-readable model (NEXT-FUNCTIONALITY §5). Banded scores only, membership denied, floors return for this tier's publications — the one place post-D98 where suppression is the product, not a curtain. |
| The corners | **Not as teasers — as earned doors, later; the map is the hub now** | D265: below a gate there is no button, no teaser, no "coming soon". A corner per future axis can open the way patterns did — when the data can carry it (§5). |
| The per-axis gate | **Adopt the patternsReady shape for every future axis** | Numbers with their reasoning, a remembered crossing, a purge arm, nothing on screen below the gate. `src/v2/data/patternsReady.ts` is the template (§6). |
| The program (routines that build this) | **Extend the farm's architecture to engineering, with the merge kept human** | The lanes, prompts and learning loop already exist for content (`docs/QUESTION-FARM.md`); what does not transfer is self-merge — D276 measured what stays green while being wrong (§10). |

## 1 · What an axis is, and what exists today

An **axis** is a family of measurements about a person with one
collection path and one custody class. The word completes a trichotomy
the app already lives by without naming it:

- **Stops** answer *who* — you · circle · groups · near · city ·
  country · world (`docs/MIRROR.md` §2).
- **Lenses** answer *how* — Answers · People · Scores · Compare ·
  Explore on a Mirror stop; Map · Oracle · People on patterns.
- **Axes** answer *what* — which kind of measurement is being cut.

The owner's five, mapped to the tree. Two of the five turn out to be
*derived* rather than collected — a distinction the connection map needs
(§2) — so the table carries six rows:

| Axis (owner's name) | What it is in the tree | Where it lives | Custody |
| --- | --- | --- | --- |
| General info | The nine profile anchors (`ANCHOR_FIELDS`, `src/v2/data/live.ts`): age band, exact age, gender, city, country, education, relationship, height band, profession — snapshotted onto every answer, seven of them breakdown dims (`BREAKDOWN_DIMS`, `functions/src/pure.ts`) | `v2_users/{uid}` + the `anchors` copy on each answer | Public (D98). Exact age is for screens that name a person, never a dim (D155); profession is never a dim (D8) |
| Questions | The one write — daily, feed, learn, duels, pulses (`docs/MIRROR.md` §1). Core folds into the Mirror, tail does not, and absent means tail (D161) | `v2_users/{uid}/answers/{qid}` | Public; duels sealed until reveal |
| Logic test | The one sit-down instrument, server-scored (D57), with published norms | `testResults.logic` (server-written only) + `v2_logic_norms` | Score public; the attempt doc and the unscored key are denies |
| The four instruments | Big Five · Politics · Values · Social (`IS_TESTS`, `src/v2/spec/test-definitions.js`) — **derived**: their items fill passively from the feed (D121) as ordinary public answers; results are a fold (`data/passiveProfile.ts`) written to the profile | items in `answers`; results in `testResults` | Public (D98) |
| The lenses | The nine minor instruments (`src/v2/spec/lens-defs.js`) — "smaller than the four core tests… the footnotes that explain it" — also **derived** from feed answers | items in `answers`; results local-only (`insight.lenses.v1`) | Items public; the folded result never uploads today |
| Interests | The least consolidated axis, three implementations: topic follows/mutes (`scenes.js`, device-local), catalogue favourites (D14–D17, D232/D266 — public answers keyed into committed catalogues), and the real follow graph (D101) — plus D163's interest model | answers + `following` + local `insight.*` state | Mixed on purpose: favourites and follows public; the topic list and the interest model never leave the device (D163) |

Three things fall out of writing the table down:

**Custody is a property of the axis, and the app already runs four
classes.** Public-and-exact (D98), denied at a named path (the three
denies, the logic attempt, the per-person `patterns/state` vector),
sealed-until (duel timing), and device-only (D163's model, the lens
results, the pulse cadence, the pass/defer signals). The future axes do
not bend this — they add a fifth class, §3's consented tier — and the
discipline stays `CLAUDE.md`'s: if the UI claims a visibility, rules or
a function make it true and a test proves it.

**Derived axes are free to cross, because their inputs are public.**
A lens result living in localStorage does not stop the server folding
the same reading from the public answers it was folded from — the
custody of a *derived* number is a convenience, not a constraint, as
long as its inputs are the questions axis. This is why §2 can put trait
directions on the map without touching any store.

**The words need one decision before the term spreads.** "Axis" is an
instrument dimension in shipped copy ("mean gap across N axes",
"Politics · Six axes", the D254 bands), a per-question field
(`V2SeedQuestion.axis` — the dim id on test items, the positive-pole
label on ordinal dailies), chart geometry, and the ruler metaphor.
Three ways out, priced:

1. **Keep "axis" for sources and qualify the old sense** — say *trait
   axis* (or "dim", which the code already says) where an instrument's
   dimension is meant; never name a code identifier bare `axis`/`axes`
   for the new concept (the per-question field keeps its name; a
   registry would live under its own noun, e.g. `sourceAxes`). Cheapest,
   and mostly a documentation cost, because on screen the frame should
   **show rather than say**: the map draws sources as regions and
   directions, and needs the word far less than this file does (D182:
   visual > word).
2. **Pick a different word for sources** — strand, layer, source.
   Cleaner in grep, weaker in meaning: the owner's metaphor is
   geometric and *correct* — these are dimensions that cross — and §2
   makes the geometry literal.
3. **Rename trait axes in user-facing copy.** Touches a shipped report
   surface (D254) for a vocabulary problem. Not worth it.

This file recommends 1, writes "axis" for sources throughout, and says
*trait axis* where the old sense is meant.

## 2 · Connection is already a machine with three shapes

Every cross-axis reading the app has ever shipped is one of three
moves, and the custody of the most private column picks the move:

| Shape | Where it runs | What it yields | Shipped examples |
| --- | --- | --- | --- |
| **Write-time fold** | The aggregate trigger, on every answer | A census — exact cells from the first answer | anchors × every question (`by{dim}{bucket}`); therefore anchors × trait items too — place score profiles are folded from cells that were publishing anyway (`data/similarity.ts`) |
| **Nightly fit** | `functions/src/patterns.ts`, over what the server may read | Published structure — per-question loading vectors with their `n` | questions × questions (`v2_patterns/loadings`, `PATTERNS_K` dimensions, eligibility = `PATTERNS_QIDS`) |
| **Device-side fold** | The phone, over published data plus what only the phone holds | A sample with its basis stated | type × vote (`typeSplit.ts`), logic quartile × vote (`logicSplit.ts`), type × crowd (`typeMix.ts`), kindred by trait score (`similarity.ts`), θ from loadings (the People lens) |

The rule the three shapes share, stated because the future axes live or
die by it: **the join runs where its most private column lives, and
only what survives that custody publishes.** Public × public joins on
the server and publishes exactly. Public × device-only joins on the
device and publishes nothing — D163's model orders the tail and never
uploads. Consented × public joins on the server *inside the tier* and
publishes floored aggregates (§3). The tree already honours this rule
everywhere without stating it; the server has never once joined a test
result to an answer (D8's posture), while the device does it four ways,
each with a stated basis.

And one piece of arithmetic that governs every coupling before any code
does: **a cross-axis n is an intersection.** `SCALE-PLAN.md` §1's
density argument — answers per day are conserved, so the dense subset
is bounded by population, not by bank size — lands twice as hard on
pairs: the people with both a fitted answer vector *and* a watch
rollup, or both a scored genome and eight answers, are fewer than
either group alone. The core corpus (D161) keeps the question side of
every intersection dense; the consented tier's own gate (§6) keeps the
other side honest.

### The first build: the axes become directions on the map that exists

The nightly fit folds two-option daily and core-feed votes only —
`PATTERNS_QIDS` excludes tests, learn, pulse, calls and catalogue picks
by construction, so the latent space is fitted on *none* of the
instruments' own items. That exclusion, made for eligibility reasons,
buys something this plan needs: projecting an instrument into that
space is a genuine cross-source reading, not the fit rediscovering its
own inputs.

**Project, don't refit.** The fit already writes a per-person θ
(`v2_users/{uid}/patterns/state`, readable by nobody) beside the public
loadings. The step: in the same nightly run, fold each person's trait
scores from their public answers (the `passiveProfile`/`similarity`
arithmetic, run server-side), regress each trait axis on θ across the
fitted population, and publish — beside the `q:` rows of
`v2_patterns/loadings` — an `axes:` block: per trait axis, a direction
vector in the same K-space, its `n`, and its fit quality. Logic
percentile and the lens dims are the same move. The core fit does not
change; the doc gains rows; every reader inherits them:

- **The Map draws the axes.** A trait axis with a direction vector is
  literally a direction in the plane the questions live in — "Openness
  points this way; these questions lean with it." That is the owner's
  sentence, drawn, on data that publishes today.
- **The Oracle and the People lens read the same doc** and can state
  alignment ("your cluster leans curious") with the basis the block
  carries.
- **A derived axis with no crowd yet simply has no row** — absent, not
  faked (D1).

What it costs and touches, named: a nightly read sweep over fitted
users' answers (price into `docs/COSTS.md` before ship, D124's
discipline); and one sentence of the standing D8 posture. "A test
result is never a breakdown dim, so nothing is ever cross-tabbed by it"
stays literally true — no dim is added, no per-question cell keyed by
type appears — but a *server-computed* trait-direction is new (D146's
fold was the device's), so the data-inventory and privacy-panel wording
get re-read against it and the owner confirms, in the record that
adopts this, that the sentence still says what it means. Small, and
exactly the kind of check that is cheap now and expensive as an
afterthought.

## 3 · The body axis — mostly already arriving, one real new door

**What exists is more than the ask assumed.** Height is an anchor band
whose centimetres never leave the device (D140). Sleep and energy are
pulse questions (D166 §3, D203) — one five-step answer a day — and the
App Store Health row is **already YES** on exactly that
(`docs/STORE-FORMS.md`: "Yes on the roster rather than on the band").
Handedness, birth order, first language and their kin are priced in
NEXT-FUNCTIONALITY §4 as the height checklist minus the banding
question. So the body axis's cheap frontier is not machinery: **more
banded one-time facts, more pulse questions** — body content through
the one write, folding into the same cells, readable by every lens that
exists. Weight/BMI stays deferred and faces stay refused, per §4 there;
nothing here reopens either.

**The one real new door is the watch.** A sensor stream differs from an
answer in both directions at once: richer (continuous, involuntary,
medical-adjacent) and weaker (an answer is a fact about your judgement;
a heart rate is a fact about your body you never chose to assert). The
design:

- **The device folds; a band uploads; the stream never leaves.** Read
  HealthKit / Health Connect day summaries on the phone, fold to a
  small closed vocabulary — sleep-duration band, resting-heart-rate
  band, steps band — and write **at most one rollup document per day**
  (`ATTENTION.md`'s cost rule, which D269 hardened: never an event per
  observation). The raw series stays in the OS health store, which
  already holds it under its own permissions.
- **Custody: the consented tier, not D98-public.** The shape that made
  a public mood series thinkable (NEXT-FUNCTIONALITY §2) leaned on mood
  being an answer you chose to give. A resting heart rate is not;
  publishing it per person is a health disclosure most users will not
  model, and the harassment argument that deferred public weight
  applies in full. So watch bands land in a tier that is: **separately
  and explicitly consented** (a real switch with real copy, not the
  anonymous-first tap-through), **never world-readable — values and
  membership both** (no list of who connected a watch; the per-person
  `patterns/state` deny is the structural precedent), server-folded
  into cross-axis readings that publish **only above a floor**. This is
  NEXT-FUNCTIONALITY §4's shape 3 adopted with open eyes: the floor
  machinery D98 deleted returns *for this tier only*, and it is not a
  reversal — D98's argument was "the underlying answers are public
  anyway", and here they are not.
- **The store forms move again, in the same PR.** The Health row is
  YES, but its note says "No HealthKit API is touched and nothing
  medical is inferred" — both sentences die the day the watch
  connects, and Apple attaches conditions to HealthKit (no advertising
  or data-mining use, a privacy policy that covers it).
  `docs/data-inventory.md` rows, `web/privacy.html`,
  `check:policy-claims`, `deleteAccount` and the purge all arrive in
  the shipping commit or it does not ship (D130/D116).
- **What it is for: the couplings, not a dashboard.** "Do short
  sleepers answer risk questions differently" is a §2 coupling,
  published floored, with its intersection-n stated. The OS already
  ships a vitals dashboard; this app should refuse to become one, and
  D269's ceiling — no behavioural dossier, nothing the daily adapts
  to — extends to sensor data verbatim.

**Meals and scans, recorded so they stay decisions.** A meal tracker is
a standing daily-labour product with a licensed food database under it
— defer *as a tracker*, and let diet arrive as pulse and banded
questions the way sleep did. Scans (MRI, DEXA, anything DICOM-shaped)
are refused for now on the faces argument one size up: there is no
coarse version of the artifact itself, the analysis pipeline is a
lab's, the plausible n is a handful, and holding medical imagery moves
the app's entire posture. The honest door back, someday, is **derived
values** — "resting heart rate from your last physical", banded,
self-reported — which is the questions axis again.

## 4 · The genetic axis — import, don't assay; derive on device; the crowd half is a tier

NEXT-FUNCTIONALITY §5 refused genetics under the current posture and
named the acceptable version: "a separately consented, never-public
data tier with its own erasure story — a different product posture."
This section designs that posture so the owner can see its price.
Nothing here weakens §5 — adoption is a decision record answering *why
the everything-public model does not apply*, and until it exists the
tree does not move.

**The scope that makes it possible at all: import, never assay.** Users
bring the raw file a consumer service already gave them (23andMe,
AncestryDNA — hundreds of thousands of genotyped positions as text).
The app never touches a sample, a lab or a diagnosis. And the lane is
**traits the app itself measures — never disease risk, carrier status
or pharmacogenomics.** That line is load-bearing three ways: it keeps
the app outside the clinical regimes that medical genetic claims
trigger, it keeps the store forms answerable, and it is the only lane
where the app holds up its own end of the correlation — it has the
phenotypes.

**Stage G1 — device-only, nothing leaves.** Parse the file on the
device; keep only the calls at positions the shipped weight sets name
(a union of thousands, not the whole file — the band-on-device move,
`data/locate.ts`'s pattern, at genome scale); discard the file; score
against **shipped, versioned public weight catalogues** (polygenic
scores from the public literature, the PGS Catalog shape), arriving
exactly as the city and Pokémon catalogues arrive today: committed,
built by a script, held by a gate in both directions (the D14–D17
discipline pointed at science). Show the one reading G1 can honestly
show: **your measured trait axes beside your published-score lean, with
the score's provenance and its smallness stated** — behavioural
polygenic scores explain single-digit percentages of variance at best,
and the copy must say so or the feature lies by typography. Local state
lives under `insight.*` and hears the purge (`check:purge`); nothing
uploads; whether "not collected" store rows survive a genetics feature
*at all* is a review that is owed, not assumed — and so is the
Norwegian Biotechnology Act, which regulates genetic information beyond
the GDPR and is deliberately not summarized here from memory.

G1's real blocker is not privacy — it is **D168**. The weights are
population science the app cannot recompute; a score computed from them
is the app asserting an external claim about *you*, which is the shape
"Born or built" was refused over. The distinction that might earn a
carve-out: the refused heritability rows were population facts pasted
beside personal data, while a G1 reading applies published arithmetic
to *your own file, on your device*, with the source named and the
measured trait beside it — closer to the logic test grading you against
a key than to the app asserting biology. Whether that distinction
convinces is an owner decision to record, not a default; G1 does not
build until it is taken.

**Stage G2 — the consented tier, shared with the body axis.** The crowd
half: **banded scores only — the genome never uploads in any stage** —
joining the same tier §3 builds, under the same properties: explicit
consent, values and membership denied, erasure through `deleteAccount`,
publications that are only aggregate couplings above a floor with their
n — "in this crowd, the openness score and the openness *answers* agree
this much". The kinship fact goes in the consent copy plainly: a genome
is never about one person only, which is one more reason the tier
publishes couplings and never anyone's value.

**The ambition, priced honestly.** "The most comprehensive database of
how genes connect to traits" decomposes into a half the app cannot have
and a half nobody else has:

- **Discovery** — finding new gene→trait associations — needs cohorts
  in the hundreds of thousands with genotypes on file. Biobanks and the
  consumer-genetics giants own that game; an app at launch scale does
  not play it, and claiming otherwise would be D1 pointed at science.
- **Phenotype depth is the half that is genuinely this app's.**
  Elsewhere, phenotyping is the expensive side — recruitment money per
  questionnaire item. Here it is the product: hundreds of measured,
  longitudinal, freely-given trait measurements per person, growing
  daily, on questions no biobank asks. The realistic and still-large
  claim: **the richest correlation surface between published genetic
  scores and a live, deep, novel phenotype battery** — replication and
  annotation at small n (a real correlation of r ≈ 0.1 becomes
  detectable in the high hundreds of paired users; the power arithmetic
  goes in the adopting record), discovery only if the tier someday
  holds biobank-scale numbers. The efficiency the owner asked for is
  the pipeline being five existing patterns in a row: **catalogue →
  device solve → banded one-write → nightly fit → floored
  publication.** Nothing in it is an invention; that is the argument it
  can be believed.

**Ancestry portability is an honesty constraint, not a footnote.**
Published weights travel badly across ancestries; every G-reading's
basis line carries the caveat, the way every People reading carries its
sample bounds today (D102's discipline).

## 5 · The doors — corners, and the map the corners are for

The instinct, read precisely: the owner wants the shell itself to say
*connections radiate in every direction*, with one big connection map,
and proposes the two bottom corners for the future axes. The corners
are genuinely free — the tab bar is one centred pill in a flex row
(`.tabbar`/`.tab-group`, `src/v2/styles.css`) with real empty space
either side — and the app already speaks corner-chrome *inside* the Map
canvas (`.mmt-zoomctl` and kin). The geometry is available. What the
tree forbids is not the placement; it is the timing:

- **D265, verbatim shape:** below the gate there is nothing — no third
  button, no teaser, no "coming soon", no door that opens onto an
  apology. A corner button for an axis nobody has consented to is that
  refused teaser, in the most premium chrome the app has.
- **A door most users never earn is worse than one that arrives
  late.** The patterns gate crosses for anyone who answers for a
  sitting. A genetic-axis gate crosses only for those who bring a file
  and consent; a permanent corner would be dead chrome for nearly
  everyone forever — and D265's other half applies too: a door that
  comes and goes is worse than one that arrives late.
- The mechanical costs are real but small: `check:tap-targets` (44px),
  the native safe-area inset the bar already pads, and the demo rule —
  a gated door reads its signal through `LIVE`, so a demo build never
  shows it (the D265 property, kept).

**The recommendation, in order:**

1. **The map is the hub, now.** §2's projection makes the shipped
   patterns Map draw axes as directions — the "one big connection map"
   is not a new screen, it is the Map with more rows in the doc it
   already fetches. And the Map already files the world under branches
   — Body & Health, Skills, Interests, Home & City, Story, Goals,
   Values (`src/v2/spec/map-branches.js`) — so *sources as regions* has
   a shipped visual precedent. Inside that canvas, "connection in every
   direction" is true and therefore drawable. Zero shell chrome moves.
2. **Corners as earned doors, later, one per future axis.** When a
   future axis ships and earns daily re-entry, it may claim a corner
   the way patterns claimed the bar: behind a patternsReady-shaped gate
   (§6), appearing only for the account that crossed it, remembered,
   purge-closed, absent from demo builds. The corner then *means*
   something — "this account carries a sixth axis" — which is the feel
   the owner is after, made honest. Wire it through the grammar that
   exists: a `NAV_ONE` key, `goNav` as a request with spring-back, the
   two-lists-never-a-filter shape `tabsFor` set (`app-shell.jsx`).
3. **Prototype the grammar in the standalone first.** New visual
   grammar lands in the design lane and is ported deliberately
   (NEXT-FUNCTIONALITY §8's convention); a corner-door shell is exactly
   that class of change.

What a corner may never be, so it is written down: a teaser for an
unbuilt axis, an ad for an unconsented one, or visible in a demo build.

## 6 · The gate, per axis — patternsReady is the template

Every future axis ships with a `*Ready` module in the D196/D265 shape:
numbers with their reasoning beside them, not a flag anybody flips.
Sketched so the shape is agreed before any code:

- **Consent and source present** — the watch is connected / a file was
  scored, and the tier consent is live. Patterns has no analogue; this
  is the new half, and it is per-account by construction.
- **Enough of you** — a minimum of own rollups or scored axes before
  the axis draws *you* at all, for the same reason `PATTERNS_MIN_MINE`
  holds the ridge solve back below K observations.
- **Enough of the crowd** — a minimum intersection-n before any crowd
  coupling draws, published by the nightly fit onto `v2_meta/app` the
  way `patternsPool` is, so the client reads the signal on a document
  it already pays for (D265's zero-read move).
- **Crossing is remembered; the purge closes it** — one `insight.*`
  key, the D265 arms, `check:purge` on the list.

## 7 · Order of work

1. **The word** (owner): keep "axis" with the trait-axis qualification,
   or pick another — one decision, recorded, before the term spreads
   through docs and copy.
2. **The projection** (§2) — M. Public data only; the Map starts
   drawing axes as directions; the D8-sentence check and a COSTS line
   ride the same PR.
3. **Body B0 continues** (§3) — ongoing content work through existing
   checklists; no new machinery.
4. **The consented tier, built once, watch first** (§3) — L. Health
   legal is the shallow end of the pool the genetic axis swims in;
   every tier property — consent flow, the double deny, floors,
   erasure, forms — gets built and tested here.
5. **G1** (§4) — M, after the D168 carve-out decision; independent of
   the tier.
6. **G2** (§4) — the tier's second tenant; the legal review (GDPR
   Art. 9, the Biotechnology Act, both stores) *precedes* the build.
7. **The corner doors** (§5) — design-lane prototype whenever;
   adoption only when a future axis has earned one.

**Not doing, restated:** assays; disease, carrier or pharmacogenetic
claims; scans; a meal tracker as a tracker; any public per-person body
or genetic value; corner teasers; and any of it before its record.

## 8 · Failure modes, named

- **The teaser** — chrome before data; D265's exact refusal, and the
  first thing corner enthusiasm will reach for.
- **The join leak** — a small-n coupling over a non-public column
  identifies people by subtraction; the tier's floors are load-bearing,
  and unlike the pre-D98 floors they cannot be argued away, because the
  underlying column is not public.
- **The membership leak** — *who is in the tier* is itself the
  disclosure; no voter-list analogue may ever exist for it.
- **The tautology** — a derived axis correlated with its own input
  items reads as discovery and is arithmetic; the projection stays
  honest only while the fitted space excludes instrument items
  (`PATTERNS_QIDS` does today — pin it the day an axis row publishes).
- **The imported-science failure** — a weights catalogue quietly makes
  the app assert biology (D168); provenance labels and the
  own-data-only publication rule are the fence.
- **The dossier** — daily rollups drifting from a band a day toward a
  behavioural log; D269's ceiling extends to sensors verbatim.
- **The forms lag** — body or genetic data outrunning the store
  declarations; the D116/D130 same-PR rule is the fence.
- **The moat mirage** — claiming discovery-scale genetics at app-scale
  n; the honest claim is the phenotype side (§4).
- **The word** — "axis" meaning two things in one sentence of copy;
  §1's qualification holds only if applied from the first commit.

## 9 · Rules that apply to all of it

Unchanged from NEXT-FUNCTIONALITY §9, restated because every section
above leans on them: new code is typed ESM off the bridge
(`check:globals` rule 4 only goes down); every callable takes App Check
or argues its exemption (D36); every collection lands in
`docs/data-inventory.md` in the same PR (D130) with its erasure path;
anything that changes read or write volume gets a `docs/COSTS.md` line
(D124); store forms move with the data or the data does not ship; no
invented anything (D1); figures by name and script, never by hand
(D39).

## 10 · The program — routines that build this, and how the work learns

Requested the same day, second ask: run the axes work as scheduled
Claude routines, as "a continuous improvement and a self-learning and
evaluation system". Measured against the tree, most of that system
already exists and has run for weeks — the design below is the farm's
architecture (`docs/QUESTION-FARM.md`) extended to engineering, not a
new invention. What exists: five scheduled content lanes whose canonical
prompts defer to a versioned brief ("this file is the job… it outranks
this prompt's summary; re-read it every run"), computed per-run budgets,
a committed scorecard that runs read before writing and refresh
themselves ("how runs measure, and how they learn", D33), an AI review
contract with a retrospective human audit (D162), self-merge on green
gates for content (D212), a run log where "correctly idle" and "silently
broken" are distinguishable (hard rule 7), and a governance section
whose delivery mechanics were measured rather than assumed. The runbook
holds the roster, the phases and the canonical prompts; this section
holds the three arguments that shape them.

**Autonomy is tiered, and the tier boundary is measured, not felt.**
The farm's self-merge (D212) was priced for append-only, single-file
content where the gate set covers the whole blast radius. Engineering
has no such gate set, and the repo has the receipt: D276 audited the
suite and found what "stayed green while being wrong". So three tiers:

- **Content lanes** (exist): self-merge on green, unchanged.
- **Build lanes** (new): implement one runbook step per run, run every
  gate, open the PR — and **never merge**. A separate skeptic run
  reviews the diff adversarially first (the D264 pattern — a different
  session, because a reviewing run shares its generator's tilt, D162's
  correlated-blind-spot rule); the owner merges. The human moves from
  writing code to reading verdicts, which is D162's reshaping applied
  one layer up.
- **Decisions** (never a run's): anything D-shaped — custody, schema,
  privacy surface, adoption — a run may *draft* as a Proposed record,
  and Proposed binds nothing (the D28 lesson, kept). The owner's
  explicit word is the only adoption there is.

**"Self-learning" means the repo is the memory and a diff is the
update.** No hidden state anywhere: what a run knows arrives from the
briefs, the decisions, the scorecards and the run log — all versioned —
and what a run learns leaves only as a recorded change. The loop:
build runs report what they hit; a weekly retro run turns those reports
into brief and runbook amendments as a docs-only PR, drafts Proposed
records where a lane keeps hitting the same wall, and writes the owner
a digest of what advanced, what is blocked, and which decisions are
waiting. One rule is load-bearing and absolute: **no run ever merges a
change to any lane's contract, its own least of all** — self-modification
always passes the owner, because the briefs are the system's weights and
the owner is the gradient step. This is also why the learning is
honest: the loss function is the gate suite, the scorecard's public
aggregates and the owner's adoption — all of them outside the run.

**Evaluation is a stack, and every layer already has a precedent.**
Per commit: the gates (mechanical). Per PR: the skeptic run
(adversarial, D264/D276 grammar). Retrospective: the owner's sampled
audit, non-blocking, shortfall reported as a standing warning (the
D162→D212 shape). Per feature: trial criteria recorded at ship time and
verdicted by the owner (the D166/D265 pattern — every phase in the
runbook names what would take it back out). Per product: the committed
scorecards and the engagement digest (D268), which are what "is this
actually better" is measured by — never a run's own opinion of its
work.

Cost and cadence stay the farm's economics: a no-op run that says why
it idled costs nearly nothing, the lever for a struggling lane is its
cadence rather than its caps, and a build lane whose no-ops all say
"waiting on the owner" is *paused*, not left to nag — the runbook's
stop-and-re-plan list carries that one, because an autonomous program
that manufactures pressure on its one human gate has inverted its own
purpose.

*Since 2026-08-25 a theory layer runs above this program:
[`AXIOM-THEORY.md`](AXIOM-THEORY.md) — eight lanes on an orphan branch
writing each axis's perfect form and their combination, whose requests
arrive through a reviewed bridge as candidates for exactly the decision
and build lanes this section describes.*
