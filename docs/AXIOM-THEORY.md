# Axiom Theory — the theory layer, and its bridge into the product

**Status: operating since 2026-08-25; re-paced to one run a lane a
week on 2026-09-04 (D363).** This page is the product-side
record of a system that lives OUTSIDE the product: twelve recurring
Claude lanes on the orphan branch `axiom-theory` of this repo — eleven
writing theory (two of them, ties and interests, chartered 2026-09-01
at D347), and since D346 one scoring their work, now weekly. **`CHARTER.md` at that branch's root is canonical** for
everything about how the lanes behave; this page records what the
product needs to know — where the system is, what may cross from it
into the tree, and the account-side inventory. If the two disagree,
the charter is right about the lanes and this page is right about the
bridge.

## What it is

An **axiom** is the theory of an axis's perfect form
([`AXES-PLAN.md`](AXES-PLAN.md) §1 defines the axes; the owner's
framing, 2026-08-25). **The axes exist to be connected** — one of the
app's core functions is to use and connect the different axes to
better understand, and get deeper data about, each other (the owner,
2026-08-25) — so cross-axis connection is first-class subject matter
in every lane (charter §1), with genetic and body explicitly charged
with theorizing how the other axes' traits map onto genes and onto the
body's parts and systems. The genetic lane also carries a biology
ambition, widened by the owner 2026-08-27 (D326): not only what the
data could contribute to advancing aging research, but equally to
genetic engineering and to the general understanding of genetics —
charter §9 bounds how and widened with it: literature-grounded
research directions over consented, aggregated data, never
procedures. Sharper still (the owner, 2026-08-26): each
axiom's purpose, or at least its main one, is to create data and
data-connections as powerful and useful as possible — or to make
another axiom's data stronger and more useful. Each lane improves one theory once a week
(the owner's re-pace of 2026-08-25 took the initial three-hourly trial
to every other day; D359 took that to every fourth day and D363 to
weekly — § The corrections) — as a claims graph with an evidence ladder (conjecture →
argued → cited → measured), advanced by bounded runs that must move a
claim's status or prune, never merely grow. The lanes deliberately **disregard the
project's practical limitations** — they seek the perfect system, not
the buildable one — and just as deliberately may not disregard law,
ethics or honesty (charter §9: no medical advice, no invented sources,
consent and privacy as design axioms).

Eleven theory lanes: six subject axioms — genetic, body, questions,
tests, and since D347 **ties** (the relational axis: the 1v1 and group
profile) and **interests** — plus **map theory** (how everything should be displayed), **pattern
theory** (how patterns should be found), and **database theory** (the
perfect, most efficient and most useful database for the axes and
their connections — deliberately *not* an axiom, the owner's note
2026-08-26: it stores and serves the measured sources; it is not one).
**Central** synthesizes: the combination theory, the axiom portfolio,
new-axiom proposals, focus questions into the other lanes, and the
weekly `DIGEST.md`. The **graph optimizer** keeps the graphs
themselves healthy, including its own methods. And a tenth lane since
2026-09-01, **review** (D346), scores every other lane's latest work
against the charter's own clauses and leaves each lane feedback —
weekly since D363, on the Sunday after every lane it scores has run.
*The review lane*, below.

## Why the branch shape

`axiom-theory` is an orphan branch: it carries no product code, so a
lane physically cannot touch the app, and `ci.yml` (pull requests and
`main` pushes only) never fires on its theory commits. The
product's history, gates and PR list stay clean by construction rather
than by discipline.

## The bridge — the only path from theory to tree

Nothing on that branch is product truth, and nothing in the app may
ever cite it. The one legitimate crossing:

1. A lane writes a wish in its `REQUESTS.md` — data to track, gather
   or compute; a new feed-borne source; an outside-axiom entry.
2. Central rules on it in `bridge/VERDICTS.md`: **worth-building**
   (with the cost/benefit argument), **not-yet**, or **needs-owner** —
   and worth-building verdicts surface in the weekly `DIGEST.md`.
3. **A person carries it here**, into the governed process:
   [`AXES-RUNBOOK.md`](AXES-RUNBOOK.md)'s lanes and a
   [`DECISIONS.md`](DECISIONS.md) record. Everything this repo already
   holds — custody classes, consent, store forms, gates, the owner's
   adoption — governs from that point exactly as if the idea had been
   born here.

No theory lane implements its own request; no Routine from that branch
opens PRs or touches `main`. The theory layer proposes; this repo
disposes.

**Crossings so far:** the two 2026-08-26 worth-building verdicts — the
pattern lane's standing prequential benchmark and the map lane's
inter-fit displacement summary — crossed at
[D325](DECISIONS.md#d325--the-bridges-first-crossing-the-fit-publishes-its-own-scorecard)
(2026-08-27): the nightly fit publishes both on `v2_patterns/loadings`,
with the verdicts' conditions (the per-question floor; no rotation
alignment; the fit-not-Oracle note) carried into the record.

## The account-side inventory (product-side copy)

All twelve fire a **fresh session per run** on model `claude-fable-5`
(the owner's 2026-08-25 direction: Fable orchestrates, subagents are
Opus at matched effort, never lower), completion notifications off —
the digest is the legibility channel.

The lanes were rebound on the evening of 2026-08-25 (the first day's
measurement: cron-spawned sessions stall on the provisioning step's
permission prompt, so the crons now wake a persistent dispatcher
session that spawns each run with its tools pre-approved). The cadence
has been re-paced three times since, each time by the owner: every
other day on 2026-08-25, **every fourth day at D359** (2026-09-03) and
**one run a lane a week at D363** (2026-09-04). The live week —
subject lanes Monday to Wednesday, reader lanes Thursday to Saturday,
the review lane Sunday 02:02 UTC — is the table in
[`ROUTINES.md`](ROUTINES.md) § The theory lanes, with the twelve cron
values and the trigger ids.

**The charter's §10 table is the canonical inventory, and it has been
stale since D359** — it still carries the every-other-day crons. That
is the first of the corrections below: this page promised the charter
was "updated first on any change" and then repeated the charter's own
out-of-date cadence for a day, which is the documentation error this
repo keeps re-committing, committed about the document that is
supposed to be the source.

## The review lane (D346)

Chartered 2026-09-01 on the owner's direction — *"a system that scores
the different axiom work each 2 night and leaves feedback on how it
could be even more useful, innovative, effective or other relevant
score"* — as charter §12 on the branch, in the lanes' own grammar
rather than as a report bolted on: a workspace, a graph whose claims
are about what a score IS, a versioned instrument
(`theory/review/RUBRIC.md`), a ledger (`scores.json`, rendered as
`SCORES.md` beside `DIGEST.md`), and one Routine.

**What it scores.** Six dimensions, each 0–10, each a clause of the
charter turned into a count: **useful** (§1's purpose), **innovative**
(§1's perfection licence, used), **effective** (§3's ratchet and the
direction of the motion — falsifiers named and contradictions resolved
score above node count), **rigorous** (§4 and §9), **connected** (§1's
cross-axis rule) and **legible** (§6's five-minute reader). Scores are
against the contract, never a ranking of lanes against each other, and
a score without its evidence line — what was counted — is not a score.
The one check a lane cannot run on itself is the lane's highest-value
act: at least two risen `cited` sources per lane fetched and read each
review, a failure named by node id and lowering Rigorous (D162's
correlated-blind-spot rule, transposed to the theory layer).

**How feedback reaches a lane.** Each review rewrites
`theory/<lane>/FEEDBACK.md` — the scores, their evidence, whether the
last feedback was acted on, and at most three items, each actionable
within one run and naming the dimension it would move. The lane reads
it in its Orient step and answers each item in its next LOG row, took
or declined-with-a-reason, and the next review scores the response. A
reasoned decline is never marked down; three reviews of reasoned
declines are evidence against the rubric, not the lane (charter §11's
review-drift rule) — the reviewer's own falsifier.

**Cadence and cost.** **Sunday 02:02 UTC since D363**, after every lane
it scores has run exactly once that week and before Monday's subject
lanes read their feedback — which is the alignment §12 was chartered to
have and did not get from the every-second-night slot. Roughly half to
one theory run per review (~$10–20), **4–5 a month** (it was chartered
at ≈ 15).

**Delivery state — it has run.** Both halves went live on 2026-09-01:
the Routine (id in D346) and the charter amendment — §12, the
workspace, the checker's path set, nine seeded `FEEDBACK.md` files —
landed on `axiom-theory` as `fa2de8e` on the owner's word the same
evening, staged on a branch first because a change to a lane's
contract passes the owner (D289 §4).

**The first review landed 2026-09-03** (`e0ecf2e`): eleven lanes
scored under RUBRIC v1, which the run itself took to v1.1; 26 sources
spot-checked across seven lanes; eleven `FEEDBACK.md` files rewritten
with 33 items. What it found is § The corrections' fourth entry — one
citation failure, and a program-wide pattern about legibility and
falsifiers that is the argument D363 reduced production on.

## The corrections — this page against the branch and the account, 2026-09-04

The owner, 2026-09-04: *"look at the corrections to axiom theory and
also reduce the theory production and remove the merge shifts."* The
reduction is D363 and it is written into every cadence sentence above.
These are the corrections found while making it — five of them, each
one a place where this page or the charter said something the branch
or the account no longer did. They are listed rather than quietly
fixed because four of the five have the same cause: **a cadence or a
price changed on the account, and the documents that quote it were not
in the same change.**

**1 · The cadence, in five places on this page.** D359 re-paced the
lanes to a four-day cycle on 2026-09-03. This page went on saying
"every other day", "odd dates"/"even dates" and "every second night"
for a day — the status line, the ratchet paragraph, the review lane's
one-line description in § What it is, the account-side inventory, and
§ The review lane's own cadence block. All five now say weekly, and
only one of them still states the schedule: the rest point at
`ROUTINES.md` § The theory lanes, because a figure written down five
times is a figure that goes stale in four of them.

**2 · `CHARTER.md` §10 is the canonical inventory and it is stale.**
It still carries `2 9 1-31/2 * *` and its eleven siblings, the crons
D359 replaced. This page's own sentence — *"the charter's §10 table
carries the live trigger ids and is updated first on any change"* —
was the promise that broke. **No routine may amend the charter**
(`AXES-PLAN.md` §10: no lane edits its own contract, and this page is
not on that branch at all), so the amendment is the owner's, and the
wording is:

> **Cadence: one run a lane a week (the owner's re-pace, 2026-09-04,
> D363 in the product tree)** — subject lanes Monday to Wednesday,
> reader lanes Thursday to Saturday, so a reader always works on
> subject output from the same week, and the review lane on Sunday at
> 02:02 UTC, after every lane it scores has run and before the next
> Monday's subject lanes read their feedback. The §10 table's Schedule
> column is `2 9 * * 1` (genetic), `2 10 * * 1` (body), `2 11 * * 2`
> (questions), `2 12 * * 2` (tests), `2 13 * * 3` (ties), `2 14 * * 3`
> (interests), `2 8 * * 4` (database), `2 9 * * 4` (map),
> `2 10 * * 5` (pattern), `2 11 * * 5` (graph optimizer),
> `2 12 * * 6` (central), `2 2 * * 0` (review).

The account half is the same twelve values through `update_trigger`,
and it is a row on `OWNER-LIST.md` § Clicks for the same reason: those
Routines are on the axiom dispatcher's subscription, and
`list_triggers` returns only the calling account's.

**3 · The price of a run.** Two places on this page quote "~$20 of
metered value", the first-day measurement from 2026-08-25. The
measured figure is **$24.44**, over the thirty runs of 2026-08-27 →
09-03 (`USAGE-REDUCTION.md` §1, read from each session's own `usage`
block). The estimate was good; what was wrong was everything computed
from it — "≈ 15 runs a month ≈ $300 a month per lane" was the
every-other-day rate, and at one run a week a lane is 4.35 runs a
month, **≈ $106**. The twelve together are ~$42 a day rather than ~$73.

**4 · The review lane has run, and this page said it had not.** § The
review lane ended *"the first review is the Routine's first firing"*;
it fired on 2026-09-03 and landed `e0ecf2e`. Two findings belong here
rather than only on the branch:

- **A citation correction of the kind the lane exists to catch.** The
  genetic lane's `gen-15` attributes an SNP-heritability of ~11% to
  Cai 2020 *"per the published abstract"*; the abstract says 14% (SE
  0.8%) against 26% (SE 2.2%), and ~11% is that paper's body-level
  estimate for one phenotype definition. The argument does not turn on
  the figure; the provenance sentence does, and it was introduced by
  the lane's own adversarial pass replacing a correct number. 25 of
  the other 26 sources checked say what their nodes claim, and no
  fabricated source was found — which is the result the ladder was
  built to produce.
- **The program-wide pattern, which is the argument for reducing
  production rather than raising it.** Legible sits at 4 for eight of
  eleven lanes: 48 of 120 nodes are over the 400-word budget and every
  LOG row runs 200–780 words. Falsifiers are named in few nodes
  outside map, tests and central. Every lane that filed a request got
  a verdict within a day, so the queue is at zero — and the bridge has
  ten *worth-building* verdicts against **one** crossing (D325), with
  the console trail reading `measured: 1` against `argued: 57` and
  `cited: 65`. Nothing in that is short of supply.

**5 · The dispatcher-backlog note in §2 is now historical.** It prices
an eleventh and twelfth lane against "nine theory lanes at four to
five runs a day". The live figure is **1.71 a day**, and at most two
lanes share a date, so the backlog that cost roughly two days of
cadence in the 2026-09-01 digest is not the constraint the next
chartering decision should be argued against. The cost is.

**What was NOT corrected, deliberately.** The read budget below is
still unapplied — a cadence cut does not make a run read less, and
that amendment is the owner's for exactly the reason correction 2 is.
And nothing on the `axiom-theory` branch was touched by this change:
the corrections above are recorded on the product side, where a
session may write, and reach the branch only through the owner.

## The read budget — a charter amendment to approve, not a rule this page sets

**Proposed 2026-09-03, unapplied.** The charter is canonical for how the
lanes behave and no routine may amend it (`AXES-PLAN.md` §10: no lane edits
its own contract), so this section is the arithmetic and the wording, and
the row on `OWNER-LIST.md` is the decision.

**What was measured.** A theory run costs **$24.44** against the charter's
own $20 estimate, and 77% of every dollar this account meters goes on
cache reads and cache writes rather than output (`USAGE-REDUCTION.md`
§§ 1–2). The lanes' inputs are what get read, and they grow every run: the
branch is 1.27MB, `theory/genetic/graph.json` alone is 132KB and its
`THEORY.md` 36KB, and `theory/central/` is chartered to read **every**
lane's `graph.json` and `THEORY.md` — which is why central is the most
expensive lane on the account at $39.47 a run. Nothing about that trend
stops on its own: the ratchet adds nodes, the graphs get bigger, and every
byte is billed once to write the cache and again on every later turn.

**The wording proposed for §3's orient step**, as a refinement of what it
already says rather than a new rule:

> Orient from a **bounded** slice: the last twenty `LOG.md` rows rather
> than the file; `node graph/health.mjs --json` for structure rather than a
> sibling's whole `graph.json`; a sibling's `THEORY.md` by the headings the
> step needs. Your own `graph.json` is read whole — it is what you write.
> A run that needs more names what it needed in its log row.

**What it would not change.** The ratchet, the citation ladder, the
adversarial pass, the subagent floor (*never any model below opus*), and
central's licence to read across lanes — only how much of each sibling it
reads to do it. And it is not a cost rule dressed as a quality rule: a lane
that genuinely needs a whole graph says so in its log, which is also how
the review lane would notice the budget hurting the work.

## The owner's controls

Pause any lane in the claude.ai Routines UI; re-pace with one
`update_trigger` (cadence is the dial for a circling lane — charter
§11); read `DIGEST.md` on the branch weekly. The economics were
re-measured on day one and again a week later: a full theory run is
real money — ~$20 on the first measured runs (the chartering plan's "a
no-advance run costs little" did not survive contact), **$24.44
measured over thirty runs** — which is half of why the owner has
re-paced it three times, from the 64-run/day trial to every other day,
then every fourth day (D359) and now weekly (D363), 12 runs a week at
~$42 a day. A run that finds nothing to advance
still logs that honestly; the weekly digest plus a next-morning
quality peek (2026-08-26) are what say whether the cadence earns
itself.

## New axioms — the 2026-09-01 reflection

**Adopted the same day (D347): Ties and Interests are chartered.** The
rest of this section stays plan notes, not decisions — time-use, the
anchors, Learn and the crowd-reading placement are recommendations
until their day.

The owner opened the question — *"lets reflect on new axioms to add,
my first suggestion would be the 1v1 and group profile"* — and this
section is the reflection, in the AXES-PLAN convention: a *charter*
verdict here is this page's recommendation, not adoption. A candidate
has two tests to pass, and both already exist. The frame's (D289 §1):
an axiom is the theory of an **axis's** perfect form, and an axis is a
shipped source with one collection path and one custody class. And
central's own, written the same day this was asked (`cen-3`, argued
2026-09-01): a new-axiom candidate names the residual variance it would
explain, the budget dimension that funds it, its custody tier, its entry
mode, and its direct-output anchors. Everything below was measured
against the tree and the branch, with paths cited.

### 1 · The owner's candidate — the 1v1 and group profile

**What the record is in the tree.** `v2_groups/{gid}` holds groups and
duos alike (`mode: group|duo`, membership by a server-minted invite
code — a capability, which is why the doc stays member-gated after
D98). Each day's duel answer is sealed at `g_{gid}_{day}`, readable by
its author only — the one answer shape D98 did not publish, for game
timing rather than privacy. The next day's reveal,
`v2_groups/{gid}/reveals/{day}`, is readable by any signed-in user and
carries every member's `optionIdx` and, for a 1v1, both members'
`guessIdx` (`data/duelRuns.ts` folds the read-runs from exactly that).
At reveal time `foldDuelSignal` (`functions/src/v2social.ts`) sums the
day into `v2_question_aggs/duel-{qid}` across every circle — plays,
per-option counts, guess totals (D40). Beside it sits the follow graph,
`v2_users/{uid}/following` (D101: a bookmark, no handshake,
`FOLLOW_CAP` 50). The banks: 25 group questions (12 `us`, 7 `pick`, 6
plain), 31 1v1 questions live, 22 romantic-mode questions authored and
dark (`active: false`, every one). Two instruments already read this
record and nothing else — D204's roles (Insight · Legibility ·
Likeness · Steadiness for a 1v1; Independence · Centrality · Steadiness
for a group; `data/roles.ts`, floors `MIN_DUO` 3 and `MIN_GROUP` 2) and
the person overlay's shared-record types (`poPersonTypes`, D310) — and
one dimension is deliberately unbuilt: `cast`, the group's crowns, which
D204 refused as a dead axis and D224's `pickUid` snapshot unblocked
forward from its own date.

**It passes the frame's test, and the frame says so itself.** AXES-PLAN
§1 records that custody is a property of the axis and that the app
already runs four classes — public-and-exact, denied-at-a-path,
**sealed-until (duel timing)**, and device-only. Its table then files
duels under Questions ("the one write — daily, feed, learn, duels,
pulses"). So one of the four custody classes the frame names belongs to
no row of its own table. The axis is there; the row is missing. And its
unit differs from every other axis the program has: a genome, a body, an
answer and a test score are all measurements of a **person**; a duel is
a measurement of a **tie** — a pair, or a group — keyed by two or more
people and a day. It also holds the app's only **second-person**
measurement: a guess is a claim about someone *else*, scored the next
day against their sealed answer. After the logic test, that is the
second thing in the app graded against a key rather than reported.

**Against `cen-3`'s five parts.**

- *Residual variance.* Central already lists "social-graph texture"
  second on its own candidate list (`cen-9`), in these words: the
  relational data "carries relational variance (who is chosen, how
  contests resolve) no self-report item reaches". The duel record adds
  what that phrasing leaves out — interpersonal **accuracy**, and its
  decomposition: a right guess can be knowledge of *them* or projection
  of *yourself* (guess = their answer versus guess = your own; Likeness
  and Insight are the two halves the roles already draw); **legibility**
  is a property of the target that no self-report reaches at all; and
  a `pick` day is a nomination, the crowd's reputation of a member.
- *Funding.* `pat-8` (cited) says persons fund crowd value and a
  person's own occasions fund personal value. Ties are a third
  resource neither names: a person in several 1v1s is a perceiver
  measured across targets, a person guessed by several is a target
  measured across perceivers, and a pair's days are its occasions. The
  data shape exists — every friend pair can hold a 1v1 — so the claim
  is funded in principle, which is what the test asks.
- *Custody.* Already run, not designed: sealed-until, then published
  (D98) — and central's own note on this candidate, that its consent
  structure is **dyadic** because an edge names two people, is the
  charter's §9 consent axiom applied, not a blocker. Nothing here is a
  D334 ask today: legibility and reputation are folded from reveals
  that already publish, and D204 priced `cast` as a fold hazard, never
  as a privacy one.
- *Entry mode.* A collected stream — the daily duel — with no import
  door and no artifact; the cheapest entry mode on the list.
- *Anchors.* Every 1v1 day is keyed against reality; the 7 pick
  questions are nominations with the picked uid snapshotted (D224); the
  cross-group guess-match rate publishes per question (D40's "guessable
  if you truly know them" number).

**No lane owns it.** The tests lane's scope is logic, the four
instruments and the nine lenses; its 2026-09-01 joint-density verdict
says in terms that "the two duel systems (duo, group) have no
`testResults` entry and sit outside this ruling". Central carries the
social graph as a *candidate*, not a theory. The body lane's open
question of the same day asks whether "duel participation and outcomes"
could serve as a third method for its common-method-variance rival — a
consumer of a theory nobody is writing.

**What the lane would write, and why it can climb fast.** The
literatures are old and deep, so `cited` is a matter of reading rather
than invention: the Social Relations Model (Kenny — perceiver, target
and relationship variance, which is exactly what a person holding
several 1v1s lets you separate); accuracy and assumed similarity
(Cronbach's 1955 decomposition, Ickes's empathic accuracy, Funder's
Realistic Accuracy Model); sociometry and peer nomination (Moreno; the
Coie–Dodge status classes) for pick days and the unbuilt `cast`;
homophily and assortativity (McPherson, Smith-Lovin and Cook) for the
follow graph against the answer vectors; consensus, independence and
centrality in small groups for the group instrument; and tie *type* as
a variable — the dark romantic pool is a second kind of tie waiting for
a theory of why it should differ. The cross-connection half (charter
§1) is where the value concentrates: what the person-level axioms
predict about how a tie goes (do alike trait profiles read each other
better? does the logic score predict Insight? do the anchors predict
who is chosen?) and what a tie reveals about a person that no
self-report can (legibility is a target effect; reputation is what your
groups pick you for). `measured` is reachable early: reveals and
`duel-` aggregates are public, and `scorecard --fetch` already downloads
the latter (D40).

**One lane, not two.** A pair is the two-member group with a guess —
one store, one custody class, one family of literature. Two lanes would
double the price of one theory. **The name** is the owner's word
decision (D182): the charter's lanes are one word each and "Social" is
taken by the fourth core instrument; this page's suggestion is
**Ties** (id prefix `tie`), because a pair and a group are both ties
and the follow graph is one too.

### 2 · The other candidates, held to the same test

| Candidate | What it is in the tree | Verdict here | Why |
| --- | --- | --- | --- |
| **Interests** | AXES-PLAN §1's row 6 — the one axis in the table with no lane. Three implementations: follows/mutes (device-local), catalogue favourites (public, D14–D17), D163's interest model (binding, not built, never leaves the phone) | **Charter, second** | The genetic lane already asked for factor-level interest scoring (2026-08-28) and got *not-yet* because no inventory-grade items exist on the answer stream — which is a theory question nobody owns: what the perfect interests axis IS, how it is held under D163's surviving property (the server never learns what anyone is into), and what it deepens. The genetic lane's own finding: interests are twin-heritable and no GWAS of an administered interest inventory exists — a first-of-its-kind asset behind a gate nobody is theorizing |
| **Time-use / chronotype** | Answer timestamps; cadence, streaks, edit rates. Central's own first candidate (`cen-9`) | **Not a lane yet** | Central already carries it, the body lane holds the behavioural-traces question, and the binding confound is named (answering phase is convolved with the product's delivery schedule). Charter it when that cheap test survives. D269's ceiling bounds it either way: no hesitation timing, no dossier |
| **General info (the anchors)** | The nine profile anchors, seven of them breakdown dims; D328's `jobField` | **A focus question, not a lane** | Its theory is the questions lane's invariance and spine work (`que-4`, `que-6`) — which anchors carry conditioning value, and how a band is chosen. Central can ask that in one appended question |
| **Learn (knowledge)** | A question with a right answer, a trap and a crowd difficulty `p` (`learn-data.js`); misconception maps | **A focus question, not a lane** | Knowledge items are instruments with estimable parameters (`que-2`) and distractor analysis is item theory; the ability half is tests' logic work. A lane only if the owner wants knowledge as an axis in its own right |
| **Reading the crowd** | Foresight READ (D126, live), calls retired in service (D196), the Oracle's surprisal grade | **Inside Ties, not beside it** | The same family as the 1v1 guess one level up — person → crowd, and model → person. Name it in the Ties row so the cross-connection has an owner |
| Microbiome · voice · place history | Central's last three | **Nothing to charter** | Each is behind a gate by central's own argument: an import door, an instrument-validity gate, and the physical-safety deny |

### 3 · What a lane costs, and what chartering one takes

- **Money.** **$24.44 a run measured** (thirty runs, 2026-08-27 →
  09-03; the charter's first-day estimate was ~$20), once a week ≈
  4.35 runs a month ≈ **$106 a month per lane** since D363 — it was
  ~$300 at the every-other-day cadence these two lanes were priced
  against, and the figures below are the old ones kept as the record
  of what was argued. Two lanes ≈ $600 a month on top of the ten (the review lane
  included, D346). The owner's standing call was
  that budget is not the constraint and quality is; D363 is the
  amendment to that — *"reduce the theory production"* — taken on the
  cadence dial rather than the roster, which is the order charter §10
  itself prescribes.
- **The dispatcher.** The 2026-09-01 digest reports roughly two days
  of cadence lost to a dispatcher backlog with nine theory lanes at
  four to five runs a day, and the review lane (D346) fires at night.
  **That pressure is gone as an argument** — at one run a lane a week
  the account sees 1.71 theory runs a day and at most two on any date
  (§ The corrections, 5) — so a thirteenth lane is priced against the
  bill, not against the queue. The slots the ties and interests lanes
  took are Wednesday 13:02 and 14:02 UTC, with central last on
  Saturday. If a backlog recurs, the fix is §11's cadence dial.
- **On the branch.** A charter §2 row and §10 inventory row;
  `graph/SCHEMA.md`'s prefix list and the `LANES` map in
  `graph/check.mjs` — a checker change lands with its schema note in
  one commit or not at all (§5); `theory/ties/` seeded with the five
  files (`graph.json` with conjecture nodes, `THEORY.md`, `LOG.md`'s
  seed row, `QUESTIONS.md`, `REQUESTS.md`); the README's workspace
  count.
- **Account side.** One Routine per lane bound to the dispatcher,
  fresh session per run, prompt forwarded verbatim, `claude-fable-5`,
  notifications off — the D326 shape, create before delete.
- **In this repo.** This page's roster and count; AXES-PLAN §1 gains
  its seventh row (the relational axis, custody sealed-until →
  published); the ORIENTATION line; a DECISIONS record in the
  D289/D326 shape. Nothing in the app moves — the bridge stays the
  only crossing.
- **What a Ties lane would ask for first**, so the owner sees it
  coming: the `cast` fold (D204 priced it, D224 unblocked it); a
  per-person perceiver/target summary over public reveals; the
  romantic pool's activation as a tie-type variable; homophily over the
  follow graph against answer likeness. Every one is public data
  today, and every one is the governed process's to price.

### 4 · The recommendation

Charter **Ties** now, on the owner's own suggestion and central's
second-ranked candidate, which it subsumes. Charter **Interests** with
it — the axis the frame already lists and no lane theorizes. Leave
time-use inside central until its cheap test runs, and route the
anchors and Learn to the questions lane as appended focus questions.
Twelve lanes with the review lane (D346), ≈ $600 a month more, two
new odd-date slots. **Adopted 2026-09-01 — D347.** The remaining
verdicts in §2 bind nothing until theirs.
