# Axiom Potential — what becomes knowable when the axes cross

**Status: plan only.** Nothing on this page is built, and that is the
point: this is the *potential* half of Axiom Theory, written 2026-09-03
because ten days of theory lanes produced constraints, citations and
maintenance requests and never once said what the app could **know**.
[`AXIOM-THEORY.md`](AXIOM-THEORY.md) § The drift has the diagnosis and
the charter amendment that stops it recurring. This page is the thing
that was missing.

## The rule this page exists to serve

**An axiom's purpose is to make other data stronger** (the owner,
2026-08-26, in the charter's §1) — and under D352, axiom power comes
first: a limit is a design problem to be solved *around* that power,
never a reason to shrink it.

So the question this page asks of every axis is never *"is this
defensible?"* but **"what does this let us learn that nobody can learn
today, and what does it make the other axes worth?"**

The feed is **one** axis and one way in. Its answers are raw material.
The product is what one axis says about another.

## The multiplier is already running — and nobody named it

Before any new axis, note what the app already does, because it is the
proof of concept and it shipped without being recognised as the thesis.

**Four instruments and nine lenses are *derived*, not administered.**
Big Five, Politics, Values and Social (D121), plus the nine minor
lenses, fill passively from ordinary feed answers. The user answers one
question a day. Thirteen psychometric instruments assemble themselves
from that single write.

That is axiom theory working, once, by accident of good design: **one
collection surface, thirteen measurements.** Every argument on this
page is that same move, repeated deliberately across seven axes instead
of one.

## The compounding map

The seven axes (`AXES-PLAN.md` §1), plus the two not built. Each cell
is what the pair makes possible that neither makes alone.

| Cross | What it unlocks | Status |
| --- | --- | --- |
| **Genome × Logic test** | Directly measured cognitive ability at scale. Almost all existing cognitive genetics proxies ability through *educational attainment*, which confounds with wealth, country and schooling. InSight has a server-scored, repeatable, language-light instrument (D57) with published norms. Genotype against a real ability measurement, repeated over years, is a phenotype the field does not cheaply have | needs the import door |
| **Genome × the question bank** | The genetics of things nobody has ever phenotyped. Biobanks have huge N and shallow phenotyping — a few items per person. InSight can be the inverse: 111+ core items, deep. `gen-17` says many items admit latent decomposition — the genetics of a factor nobody measured directly — and `gen-19` says correlated items multiply *effective* sample size, so depth partly substitutes for N | needs the import door |
| **Genome × Interests** | Genuinely first-of-its-kind. Vocational interests are twin-heritable, aggregating to factors raises the heritable signal, and — the genetic lane's own finding (`int-3`) — **no GWAS of an administered interest inventory exists**. This is not a smaller copy of existing science; it is a gap | needs the import door **and** the interest inventory |
| **Tests × behavioural traces** | Trait signatures without a clinic. Answer latency, session shape, edit rate, streak pattern and consistency are passive and continuous. Against 22 test axes and nine lenses they compose a *profile*, not a correlation — see § The neurotype signature | traces exist; retention and a self-declared neurotype item do not |
| **Ties × every self-report axis** | **Bias correction.** Every self-report carries a bias invisible from inside it. A friend's guess about you is an *external* measurement of the same trait, graded against your sealed answer. This converts self-report from *what you say* into *what you say, corrected by what people who know you predict* — and it is the most underrated asset in the app, because it improves every other axis at once | the record already publishes |
| **Logic test × the question bank** | Difficulty anchoring. A verified-ability instrument calibrates every other question's difficulty and discrimination against a real scale, so the whole bank sharpens for free | both ship; the join does not |
| **Genome × the feed** | Fewer questions for the same depth. A genetic prior on a trait means fewer items are needed to place someone — so the feed becomes **cheaper and deeper at once**. This is the compounding, stated at its sharpest | needs the import door |
| **Body × everything within-person** | The occasion covariate. Sleep, illness and energy are what make *change* interpretable: without them "you answered differently today" is noise; with them it is signal. `bod-13` needs the sick day specifically | sleep and energy pulses ship (D139/D203); illness does not |
| **Anchors × everything** | The conditioning structure — which comparisons are fair, and which cohort a reading belongs to | ships |
| **Interests × the feed** | Engagement prediction: more answers per person, which raises every axis that feeds on answers | partly ships |

## Worked scenario 1 — Intelligence

**What the app has that others don't.** A server-scored logic
instrument on every user, with published norms, that can be re-served.
Not a proxy. Not self-reported. Not educational attainment.

**What crossing it with genomes buys.** The standard cognitive GWAS
substitutes years-of-education because measuring ability at scale is
expensive; that substitution imports every confound that shapes who
stays in school. A directly measured, repeatable, low-language
instrument on a global population removes it.

**What crossing it back buys — the part that matters more.** A verified
ability score makes the *rest* of the app interpretable:

- it anchors item difficulty across the whole bank
- it separates *ability* from *disposition* in the four instruments,
  which currently blend them
- it lets the app ask whether the Oracle's misses concentrate in people
  whose ability the model never modelled
- it gives the Ties axis a decomposition it cannot get alone: is a good
  guesser reading the person, or just clever?

**What it would take.** The import door (`AXES-RUNBOOK` 3.0, waiting on
the D168 carve-out and the legal review) and era-scoped re-serving so
the test can be taken more than once — which is currently a
`NEEDS-OWNER` on the bridge, and blocks *every* trajectory in the app.

## Worked scenario 2 — The neurotype signature (ADHD, autism)

**Wrong framing:** *"which gene causes ADHD."* The genetic lane is
right that complex traits do not resolve to named genes (`gen-9`), and
chasing that would produce nothing defensible.

**Right framing, and it is more valuable:** *what does the whole
profile of a person who declares this neurotype look like, across every
axis at once?*

The app can compose something no clinic and no biobank holds together:

- **22 test axes** — Big Five, Politics, Values, Attachment
- **nine lenses** — the minor instruments
- **behavioural traces** — latency, edit rate, streak shape, session
  time-of-day, consistency across repeats
- **Ties readings** — is this person *legible* to others? Their
  Insight/Likeness split says whether they read others by knowledge or
  by projection, which is a substantive claim in the autism literature
  rather than a stray number
- **interests** — structure and breadth
- **and, with the import door, the shared genetic architecture** between
  that signature and each trait axis

**Why that is the powerful version.** A correlation between a diagnosis
and one trait is a paper nobody needs. A *signature* — a shape across
thirty-plus measurements, including how the person is perceived by
people who know them, and how much of that shape is genetically shared
with each axis — is a thing that does not exist anywhere, and it falls
out of data the app already collects plus one self-declared field.

**What it would take.** One optional self-declared neurotype item, the
retention of behavioural traces the app already produces, and the
consent surface that D8/D330's precedent says is *built*, not decided
away.

## Worked scenario 3 — The loop that closes

The compounding map reads as a list of pairs. It is really a **cycle**,
and the cycle is the actual product:

```
   genome  ──▶ prior on traits ──▶ fewer questions needed to place you
      ▲                                          │
      │                                          ▼
better genetic signal ◀── deeper phenotype ◀── more answered per unit
      ▲                                          │   of attention
      │                                          ▼
  cleaner self-report ◀── bias correction ◀── ties: friends' guesses
```

Each axis lowers the cost of the next. A genetic prior means fewer
questions per trait; fewer questions per trait means more traits
covered at the same one-a-day budget; more traits means a deeper
phenotype; a deeper phenotype means better genetic signal. Ties
correct the self-report bias at every turn, and the body axis says
which occasions to trust.

**That is what an axiom is for**, and it is why "improve the current
database" is not axiom work. Nothing in that loop is a schema change.

## What to collect first, ranked by what it unlocks

1. **The genome import door.** Unlocks three of the highest-value
   crosses at once — intelligence, interests-genetics, the trait
   prior. Blocked on two owner decisions that have been open since
   before the theory lanes started (`AXES-RUNBOOK` 3.0 and 4.0).
2. **Era-scoped re-serving.** One sentence, already on the bridge as
   `NEEDS-OWNER`. Without it *no* trajectory, *no* within-person
   change and *no* ergodicity test is ever measurable — it silently
   caps the entire within-person half of the app.
3. **A self-declared neurotype item + trace retention.** Cheap, and it
   is the whole of scenario 2.
4. **The interests inventory** (`int-2`). The axis the frame lists and
   nobody collects properly; it is also half of a first-of-its-kind
   genetic asset.
5. **The illness pulse.** One row, and it is the occasion covariate the
   body axis cannot work without.

Items 2, 3 and 5 need no new technology at all.

## The limits, each as a design problem

Per D352 a limit is something to build around, never a reason to
shrink. The real ones, with the shape of the way through:

- **Genes rarely name a cause for complex traits.** Solve it by asking
  for *shared architecture* — how much of a signature's genetics
  overlaps each axis — instead of gene names. Same value, actually
  answerable.
- **Self-declared is not clinically diagnosed.** Solve it by treating
  the declaration as one more measurement with a bias model
  (`bod-3`'s own rule), not as ground truth, and saying so on the
  number.
- **Between-person structure does not carry to within-person.** Solve
  it by collecting occasions — items 2 and 5 above — rather than by
  declining to say anything.
- **Consent for genetic and health data.** Not a preference and not
  negotiable: it is satisfied by **building** the consent (D8, D330,
  D331), which is a design task with a known shape, not a blocker.
- **Pairing bounds every cross** (`pat-4`): two axes never measured on
  the same people cannot be connected. Solve it by *allocating* for
  overlap — `pat-12`'s planned-missing design — rather than collecting
  evenly and hoping.
