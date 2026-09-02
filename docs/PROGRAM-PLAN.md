# The program plan — six lists, three subscriptions, and the routines between them

**Status: mixed — adopted 2026-09-02 (D352); the rule, the six lists
and the contract amendments are built (`PROGRAM-RUNBOOK.md` phase 1),
the lanes and the console are not yet.** Written 2026-09-02 from the
owner's ask of that day, on the third subscription (the one the routine
register's §4 found running nothing).
This page does three things: it restates the ask against what the
tree and the three accounts actually run today, it proposes one
mechanism for every piece, and it ends with the questions the owner
answers before any of it is built. Adoption was the owner's word, in
D352; where a mechanism is not built yet, "the X does Y" below reads
as "the X will do Y" — the runbook's boxes say which.

> **Reasoning that already exists is cited, not repeated.**
> `AXES-PLAN.md` §10 is the argument for lanes that report to a log,
> learn only through the owner and never merge their own contract;
> `OPS-RUNBOOK.md` §0 is the ground rules every ops lane obeys;
> `AXIOM-THEORY.md` is the theory layer and its bridge; the routine
> register (`docs/ROUTINES.md`, on PRs #362 and #365 as this is
> written) is the cross-account inventory. This plan adds lists and
> lanes on top of all four and changes none of their reasoning —
> except at one named point, §2.1's label, which it asks the owner to
> amend explicitly.

## 0 · The ask, in the owner's words

*"i want to create a more automated system based on routines between
the 3 different claude subscriptions. the goal is that i should almost
only work on lists and monitoring data i can see."*

Six lists — **what can be merged**, **the to-do list**, **the
permission list**, **the user has-to-do list**, **the axiom list** and
**the visual request list** — plus a **visual vision file**; a
**to-do doer on every subscription** (today only Claude 2 has one),
divided so no one doer does everything; a routine like the night shift
that works only on **approved** pull requests and hands them to the
shepherd; the same **axiom-theory routines as Claude 2** on this
subscription, plus an **axiom maker** (better name wanted) that opens
pull requests moving the project toward what the theory envisions,
two or three times a day, Fable planning, Opus 5 with ultracode
building, and that files its tasks into the to-do list divided between
the sessions; a **rule every session can see** that the power of the
axioms comes first and limitations like privacy or the database are
made to work around it; **monitoring** as comprehensive as possible,
with a routine for improving it — *"there can never be too much info i
get but in a visual and easy to understand way."* And: *"just ask if
something is unclear or missed something."* §9 is that.

## 1 · What runs today, measured 2026-09-02

Everything below was read from `list_triggers` on this account, from
the register's verified blocks for the other two, from the open pull
requests, and from the `axiom-theory` branch — never from memory. One
fact shapes the whole design: **no account can see another account's
Routines**, and rate limits are one bucket per account. The
repository — its files and its issues — is the only surface all three
can read and write, so every list has to live there, and anything an
account learns about its own Routines reaches the others only as a
row it writes.

| | Claude 1 | Claude 2 | Claude 3 (this one) |
| --- | --- | --- | --- |
| **Runs** | the six content lanes (self-merge, D212); the nightly algorithm improver and the DB scalability improver (push a branch, the owner opens the PR); night shift B (`nightb-*`) | the axes program (build · skeptic · retro); the twelve theory lanes on `axiom-theory`; the doc sweep; night shift A (`night-*`); since today the ops dispatcher with the roll call, the production reader, the release recorder and **the list worker** — the to-do doer the owner means | **nothing.** Zero Routines, an unspent bucket |
| **Sees** | its own nine (register §2) | its own seventeen plus the four ops lanes | its own zero |
| **Bucket** | the content lanes' — cheap runs | the heaviest: the night worker alone carries thousands of dollars of metered work against the same limit the theory lanes dispatch through | untouched |

*The ops lanes' account is inferred, not read*: the register's session
1 block says they are on an account it cannot see, this account holds
none, and the owner's sentence — only Claude 2 has a to-do doer — puts
the list worker on Claude 2. §9 asks the owner to confirm.

Four more facts the design leans on:

- **The merge door exists on paper and not in the world.** A PR
  labelled `merge-when-green` is one the owner has decided to merge,
  and the PR shepherd squash-merges it on green under five steps
  (`OPS-RUNBOOK.md` § The PR shepherd). The label exists in the
  repository and five open PRs carry it as this is written; the
  shepherd Routine does not — the session's permission classifier
  refused to create it, along with the pulse responder, the dependency
  shepherd and the probe, and their rows say *create from the web UI*
  (PR #364). Until a person does that, every approved PR waits exactly
  as an unapproved one.
- **The to-do doer's contract already exists** — `OPS-RUNBOOK.md`
  § The list worker, working `WORKLIST.md`: topmost open item, one
  item per PR, Fable orchestrating `sonnet`/`opus`/`fable` subagents,
  never merges. The owner's "each session should have one, divided"
  is that contract with a partition rule added (§2.2), not a new lane
  design.
- **The bridge has a queue and nobody carrying it.** Central has ruled
  ten requests *worth-building* and one *needs-owner*; one crossing
  has happened (D325), and the charter says *"a person carries it
  here"*. The axiom maker is the thing that carries — and more than
  that, the thing that reads each lane's `THEORY.md` and builds toward
  it without waiting to be asked (§4.1).
- **Two night shifts have no product document.** Their briefs live in
  their Routines (D326 §2 records only the closing flow's shape). The
  PR-scoped shift the owner wants is best written as a contract in the
  tree from day one, the way `OPS-RUNBOOK.md` was — the doc sweep and
  the now lane both fired ahead of their contracts and no-opped for
  days, correctly and uselessly.

## 2 · The six lists

One file per list under `docs/`, flat, each with an `ORIENTATION.md`
row so `check:docs` cannot lose one. Separate files rather than one
page, because each list has one routine that writes it most and
separate files do not conflict on merge. Three conventions hold for
all six:

- **The owner's gesture is one tap or one line.** Where GitHub already
  has a one-tap control (a label, an issue), the list *mirrors* it and
  the tap is the act; where the act is the owner's edit, it is one
  line in the file, committed from the phone the way `WORKLIST.md`'s
  header already describes.
- **Routines write through the paths they already have** — the PR
  they are opening anyway, or a run-log comment that the console
  (§5) folds into the file. A list that a lane could only update by
  merging its own PR would be a list that is always a day behind.
- **A row says who wrote it and when**, and a row a routine writes
  cites the run (the PR number, the run-log comment) so the owner can
  read the reasoning without the routine in the room.

### 2.1 The merge list — `docs/MERGE-LIST.md`

**What it is.** Every open pull request the automation produced (and
the owner's own), one row each: the PR, the lane or session that wrote
it, **what** it does in one line, **how** in one line (the mechanism —
which files, which fold, which gate proves it), its state (green or
which check is red · behind `main` by how much · conflicts · the
skeptic's verdict where one exists), and its **stage**:

    new → approved → in the shift → ready → merged

**The owner's gesture: a tick in the file** (the owner's answer,
§10). Change `- [ ]` to `- [x]` on the row and commit to `main` from
the GitHub app; the console workflow runs on that push and mirrors the
tick to the label `approved` on the PR, which is what the merge shift
reads. The same rows stand in the pinned Console issue with clickable
boxes, and a tick there is the same act mirrored back into the file.
Branches that never became a PR — the night shifts', the improvers' —
are rows too, in a `no PR yet` stage; ticking one makes the workflow
open the PR and label it (§10, answer 12).

**What approval starts: the merge shift** (§4.2). The night shift's
shape pointed at one PR instead of the tree: bring the branch current
with `main` as a merge commit, run the full battery the closing flow
runs (both typechecks and lints, every runner the diff's scope names,
every gate that runs without production secrets), re-review the whole
diff adversarially as one unit, fix only what that proves broken, with
every commit it makes prefixed `shift:` — then, when the head is green
and the review is clean, **apply `merge-when-green`**, and the PR
shepherd merges under its five steps. A PR the shift cannot get green
stays in the shift's column with exactly what is red and why, and the
owner decides.

**The one contract amendment this needs, named rather than slipped
in.** `OPS-RUNBOOK.md` §0 says *no lane ever applies the label*. The
owner's own description of the flow — approve → the shift fixes →
*"they are set to be merged by the shepherd"* — delegates that one
application to the shift, for PRs the owner has already approved. The
decision stays the owner's (the `approved` tap); the shift executes
it; the shepherd's step 4 still holds, because the shift labels
*after* its last push, so every commit after arming is the
shepherd's own. The owner said it in words on 2026-09-02 (§10, answer 2), and the
record that adopts this plan amends §0 with the date.

**Who writes the list.** The shift rewrites it each run; between
runs, the console workflow (§5) refreshes the state columns from
GitHub. The owner never has to edit it — the label is the edit.

A seeded row, as it would read today:

| PR | From | What | How | State | Stage |
| --- | --- | --- | --- | --- | --- |
| #367 | an interactive session (which account, the row would say) | a returning device paints its real deck from disk before the network; an offline answer survives relaunch | the PR body's mechanism, one line, D352/D353 | as GitHub reports it at render time | `ready` — the owner labelled it `merge-when-green` at 11:23 UTC, and it waits on a shepherd that does not exist yet |

### 2.2 The to-do list — `docs/WORKLIST.md`, extended

**What exists** is kept whole: § Open / In flight / Parked / Done, the
`[owner]` and `[ask]` tags, issues labelled `worklist` copied in, one
item per PR, the list worker's contract. Two things are added.

**A lane tag on every item, and a doer takes only its own.**
`[claude-1]`, `[claude-2]`, `[claude-3]` — the owner's own names for
the subscriptions, so the tag says where an item runs without a
lookup. A to-do doer takes the topmost open item **carrying its tag**
and nothing else; one item in flight per account, so up to three in
flight across the program. Untagged items belong to `[claude-2]`, the
doer that exists today, so the list keeps working the day the rule
lands and nothing is orphaned.

**Who assigns the tag.** Whoever adds the item may; the owner's tag is
final. Items the axiom maker files carry the tag it chose in its plan.
Untagged items are tagged by **one** routine only — the axiom maker's
planning step, which runs two or three times a day and already reads
the whole list — because a triage step run by all three doers is
three accounts editing one file at once. The guide it tags by:

| Tag | Takes | Why there |
| --- | --- | --- |
| `[claude-1]` | content and the question pipeline, monitoring and pulse follow-ups, store and release paperwork, scripts and gates | its bucket already carries the cheap, well-shaped lanes, and its dev session holds the content tools |
| `[claude-2]` | docs, ops, the axes program's build steps, anything the night shift or the doc sweep raised | the list worker and the axes program are there, and the night worker knows the tree |
| `[claude-3]` | product code toward the axioms — client and functions work the axiom maker planned, the visual builds, the merge shift's follow-ups | the unspent bucket, and the maker that planned the item |

plus a balance rule: no account holds more than about half of the
open items, and a tag moves with a one-line note rather than
silently.

**What the doers need.** Nothing in the Routine for Claude 2: its
prompt defers to `OPS-RUNBOOK.md` § The list worker on `origin/main`
and re-reads it every run, so the tag rule lands as a contract edit.
Claude 1's doer is a new Routine the owner (or a session on that
account) creates with the same canonical prompt; Claude 3's is created
from here. §7 has the order.

### 2.3 The permission list — `docs/PERMISSIONS.md`

**What it is.** Every permission, secret, install or setting that is
limiting the program, one row each: what was refused or is missing ·
which account, session or lane hit it · when · what it blocks · the
exact fix (which UI, which setting, which secret name) · status
(`open` / `granted <date>` / `will not grant`). Simple as that.

**Who writes it.** Any routine that meets a refusal appends the row
through the PR it is already opening, or as a run-log comment the
console folds in. The owner grants and ticks.

Seeded from what the tree and today's PRs already record:

| Need | Hit by | Blocks | Fix | Status |
| --- | --- | --- | --- | --- |
| Create the PR shepherd, the pulse responder, the dependency shepherd and the probe | the ops session, 2026-09-02 — the permission classifier refused creation from a session | the whole merge door: five labelled PRs wait | create each in the web UI (claude.ai/code/routines), repository attached, prompt from `OPS-RUNBOOK.md` §4; the shepherd's GitHub `pull_request` triggers added there | open |
| The GitHub merge tool approved once in the ops dispatcher's own history | the PR shepherd's label merge (`OPS-RUNBOOK.md` §2.3) | any merge by the shepherd under the dispatcher binding | one human turn in that session approving the tool; `.claude/settings.json` deliberately omits it | open |
| `FIREBASE_API_KEY` in the environment's configuration | the farm (asked twice), the pulse responder | `npm run scorecard -- --fetch` in a routine; the scorecard stays stale | the environment's settings, not a shell file | open |
| `ROUTINE_PULSE_FIRE_URL` / `_TOKEN`, `ROUTINE_RELEASE_FIRE_URL` / `_TOKEN` | `pulse.yml`, `ios-release.yml` — the steps are committed and inert | the pulse responder and the release recorder firing from a workflow | one repository variable and one secret each, from the web UI's API trigger | open |
| The Claude GitHub App on the repository | the shepherd's event triggers | acting on a label within the hour rather than at the next slot | install from the web UI's prompt | open |
| Egress to news domains from the routine environment | the now lane (D351) | opening a story rather than only finding it | the environment's network policy; the bar tightens to "opened, and quoted" when granted | open — not needed for the lane to run |
| A prompt edit on a Routine bound to another session | every rebind so far (D148, D326, D350) | editing a live prompt in place | none — platform; the fix is delete-and-recreate, create first | will not grant (platform) |

### 2.4 The owner list — `docs/OWNER-LIST.md`

**What it is.** Everything only the owner can do, one row each, with
the source that put it there: the `[owner]` steps in
`AXES-RUNBOOK.md` (2.0 the custody decision, 3.0 the D168 carve-out,
4.0 the legal review, 5.2 adoption per axis); the bridge's
`needs-owner` verdicts (era-scoped instrument re-serving, waiting since
08-28); D334 asks parked by any lane; Routines to create in another
account's web UI; the store and legal boxes still open in
`LAUNCH-RUNBOOK.md`; visual requests waiting to be taken to Claude
Design (§2.6); merge-list rows sitting in `new`. Distinct from the
to-do list by one test: a to-do item is something a routine does; an
owner item is something only the owner can.

**Who writes it.** The console (§5) folds it daily from the sources
above — every one of them is already in the tree or on GitHub — and
any lane may append a row with its ask. The owner ticks, and a ticked
row names what it unblocked.

### 2.5 The axiom list — `docs/AXIOMS.md`

**What it is.** The roster of axioms, each in one of three statuses
the owner moves between:

- **operational** — the axis is shipped data in the product and a
  theory of it is being written: questions and tests, in the owner's
  words; also ties (the duel record, chartered D347) and the anchors.
  Interests sits here with a note: favourites and follows ship,
  the inventory-grade collection does not.
- **explored** — the theory is being written and no product code
  exists: genetic and body, the two `AXES-PLAN.md` chartered as
  future axes.
- **proposed** — raised by the routines, not yet chartered: central's
  ordered candidates (time-use/chronotype, microbiome, voice, place
  history), Learn as a knowledge axis, the anchors as an axis of their
  own (§2 of `AXIOM-THEORY.md`'s reflection filed the last two as
  focus questions, not lanes).

Not on the list, on purpose: map, pattern, database, central, the
graph optimizer and review are theory lanes about *how* — display,
calculation, storage, combination, scoring — and none is an axiom
(the owner's own note on database, 2026-08-26).

**What a status upgrade unlocks — the proposal, for the owner to
rule on (§9 Q8).** `proposed → explored` charters a theory lane in the
D347 shape (a charter §2 row, a workspace, a Routine on the theory
account) and nothing in the product. `explored → operational` is the
word the axiom maker waits for before it builds product code toward
that axiom — the doors, the tier, the folds — under the governed
process exactly as today (a record, the store forms, consent built
where law asks it). So the list is not a display: it is the switch
the maker reads.

**Who writes it.** The axiom maker's planning step copies central's
new-axiom proposals in as `proposed` rows citing the node (central
writes only the theory branch, so somebody has to carry the proposal
across). The owner moves rows between statuses by editing the status
word, and the record that adopts this plan says that edit is the
owner's act.

### 2.6 The visual request list — `docs/VISUAL-REQUESTS.md` — and the vision file — `docs/VISUAL-VISION.md`

**The rule, as a house-style bullet in `CLAUDE.md` (§3 has the
draft).** Visuals are designed in Claude Design before they are built.
A new screen, module, lens, card family, overlay or visual language is
a *visual request*; adding a control to a surface that already exists —
a button, a toggle, a row — is not, and needs no request.

**A request row is written so Claude Design understands it whole**:
the surface it lands on (tab · stop · lens) and what is around it; the
data it draws and its basis — which aggregates, which floors, what D1's
empty state shows; every state (empty · loading · live · demo); the
interaction; the vocabulary it must fit (the standalone family in
`design/`, `styles.css`, the two palettes of D302, the copy rule
D182); the constraint arithmetic (bundle ceiling, first paint, reads);
and *why* — which theory node or axiom asked for it. Status:

    requested → designed (canvas link, or the upload extracted into design/) → built (PR) → crossed out

**The vision file** names the newest Claude Design output the tree is
built toward — its extraction directory under `design/`, what it
changes over the previous, which requests it closed — and is upgraded
the moment a request is crossed out. It does not re-point
`design/README.md`'s style-diff reference (v18 stays until a full
sync; that file's own rule), it points *beside* it: the reference is
what the tree matches today, the vision is what it is moving toward.

**Who writes what.** Any routine that needs a visual files a row
(mostly the axiom maker; the map theory lane's wishes arrive through
the bridge). Taking a request into Claude Design is the owner's — so
every `requested` row is also an owner-list row — unless the owner
allows a routine to **draft** the canvas first with this environment's
design skill, which publishes a canvas the owner then refines by hand
(§9 Q6). The build PR crosses the row out and moves the vision file.

### 2.7 The list the owner may be forgetting

Candidates, held to the same test — does the owner need to read it, and
can a routine keep it true:

- **A findings list** — what the night shifts and the skeptic found
  and did NOT fix: the D276 class (green while wrong), the "owner's
  call" items the morning reviews keep ending on (`rank.ts` versus the
  scorecard's landslide; the iOS purpose string). Today they live in
  morning summaries and decision records, which is where a reader
  loses them.
- **A routine-health list** — every Routine across all three accounts,
  last fire, last landed, cost this week. The register plus the roll
  call already produce the rows; the console (§5) draws them. Probably
  a panel, not a list.
- **A decisions list** — pending owner decisions. Covered by the owner
  list if the owner agrees; listed here because it is the one that
  grows fastest.

§9 Q11 asks.

## 3 · The rule every session sees — axiom power first

The owner: *"the functionality and power of the axioms is most
important and we have to instead find out how the limitations like
privacy or database or other should be made to work around that, not
the other way around — and that is for the project in general, so
that needs to be added somewhere all claude sessions can see."*

`CLAUDE.md` is the one file every session on every account reads
first, and its privacy section already carries the nearest rule
(D334: a privacy constraint is an ask, not a stop). This is that rule
turned from a permission into a priority, and it belongs directly
above it. Draft, for the owner to adopt or edit:

> **Axiom power first (the owner, 2026-09-02).** What the axes can
> measure and connect is the project's first priority, and a
> limitation — privacy, the database, cost, a schema, a store form,
> a refusal already written down — is a design problem to be solved
> AROUND that power, never a reason to shrink it. The question to put
> to a constraint is *how is it made to work with the axiom*, not
> *how is the axiom cut to fit it*; D334's ask is how the owner is
> told what that costs, and the ask is worded as a way through, never
> as a permission slip. Three things do not bend: a consent
> requirement in law, which is met by BUILDING the consent (D8, D330,
> D331); D1's honesty; and the three denies at their own paths, none
> of which is about answers. Everything else — the privacy page, the
> store forms, the cost arithmetic — moves with the feature, and the
> page moves first (D183).

Two places it echoes, so the lanes meet it where they work: a line in
`OPS-RUNBOOK.md` §0 beside the D334 bullet, and — because the theory
charter already says its theories disregard practicality and may not
disregard law (charter §1, §9) — nothing on the theory branch changes;
the rule is the product side catching up with the theory side. §9 Q4
asks whether the three exceptions are the ones the owner means.

## 4 · The routines

All on this subscription unless the row says otherwise — it is the
bucket that can take a lane without slowing one, and nothing here can
create a Routine on another account. Every lane obeys
`OPS-RUNBOOK.md` §0 as written (contract outranks prompt; provisioning
is conditional; reporting is mandatory with the diag-branch fallback;
budgets from the first tool call; figures recomputed; a privacy-shaped
finding is an ask). Every one is registered in the register's block
for this account in the PR that creates it.

| Lane | Triggers (UTC) | Model | Reads | Writes | Merge authority |
| --- | --- | --- | --- | --- | --- |
| **The axiom maker** (§4.1 — name in §9 Q7) | `30 6,12,18 * * *` — three a day, two if the owner halves it | `claude-fable-5-1` orchestrating; the build fanned to Opus 5 subagents under ultracode; a Fable reviewer | `axiom-theory` (every `THEORY.md`, `bridge/VERDICTS.md`, `DIGEST.md`, `SCORES.md`), `AXIOMS.md`, `AXES-PLAN.md`/`AXES-RUNBOOK.md`, the tree | one PR per run on `claude/axiom-<slug>`; to-do rows tagged by account; `AXIOMS.md` proposed rows; visual-request rows | never |
| **The merge shift** (§4.2) | `15 5,7,9,11,13,15,17,19 * * *` daytime, plus one long pass `15 23 * * *`; a GitHub `pull_request` *labeled* trigger when the web UI creation allows it | `claude-opus-5` at high effort with ultracode — the night worker's shape | PRs labelled `approved` | `shift:` commits on those branches; `MERGE-LIST.md`; the label `merge-when-green` on a green, reviewed head | **applies the label only** — never merges |
| **The to-do doer, Claude 3** | `0 18 * * *` — an hour after Claude 2's | the list worker's | `WORKLIST.md` items tagged `[claude-3]` | one PR per item on `claude/worklist-<slug>` | never |
| **The to-do doer, Claude 1** — *the owner creates it on that account* | `0 16 * * *` | the list worker's | items tagged `[claude-1]` | same | never |
| **The console keeper** (§5) | `45 5 * * *` and `45 17 * * *` | `claude-sonnet-5` | run logs, the register, the lists, GitHub state, the theory branch's digest and scores, the pulse trail | the console page; `OWNER-LIST.md`'s folded rows; `MERGE-LIST.md`'s state columns | n/a |
| **The console improver** | Sundays `0 14 * * 0` | `claude-fable-5-1` | a week of console output, the run logs, what the owner asked for | one docs-and-scripts PR adding panels — never removing one | never |
| **The theory lanes, second set** (§4.3) | the charter's slots on the *opposite* parity, if Q1 says so | the charter's | the charter's | `axiom-theory` only | never (not `main` at all) |

### 4.1 The axiom maker — what a run does

**The job in one sentence:** move the tree one verified step closer
to what the theory lanes envision, as a pull request the owner can
read in five minutes, and leave the steps it did not take on the to-do
list, tagged for whoever should take them.

1. **Orient.** Read `AXIOMS.md` for which axioms are `operational`
   (product code may be built toward them) and `explored` (theory
   only — instruments and measurements may cross the bridge, product
   surfaces wait for the owner's upgrade). Read every lane's
   `THEORY.md` tail, the bridge's open worth-building verdicts, the
   latest digest and scores, and the maker's own run log.
2. **Plan, as Fable.** Rank the gaps between the tree and the theory
   by value over cost: a bridge verdict the theory has already priced
   ranks above a gap the maker infers; a gap that unlocks the
   `measured` rung for several lanes (the digest names these) ranks
   above one that serves one lane; a gap that needs an owner decision
   is not built — it becomes an owner-list row with the arithmetic.
   Write the plan in a scratch file: what done means in one sentence,
   which theory nodes it serves (by id), which files move, which gate
   proves it, which subagent does each part.
3. **File the rest.** Every gap the plan ranked and did not take goes
   to `WORKLIST.md` § Open as one line each, tagged by §2.2's guide,
   citing the node — divided between the sessions, which is what the
   owner asked for. New-axiom proposals from central go to
   `AXIOMS.md` as `proposed`. A visual the plan needs goes to
   `VISUAL-REQUESTS.md`, and the build waits for its design.
4. **Build, as Opus under ultracode.** One PR, one gap. The
   orchestrator verifies each part against the plan rather than
   trusting the report; the Fable reviewer hunts what stays green
   while wrong (D276's checklist). Paperwork rides in the same PR — a
   `Status: Proposed` record where a decision is needed (binds
   nothing), the data-inventory row, the COSTS line, the erasure arm
   — the axes build lane's rule 3, inherited whole.
5. **Prove.** The gates the plan named plus `check:globals`, `lint`,
   `test:unit`, `build`, `check:docs`, `check:figures`; the functions
   suite when `functions/` moved; rules and e2e suites when the rules
   moved.
6. **Ship.** Open the PR with the theory nodes it serves in the body,
   request the owner, stop. The PR appears on the merge list as
   `new`; the owner's `approved` tap starts §4.2.

**Scope guards, so three runs a day do not become a firehose:** at
most three open maker PRs at once, each independent, never stacked —
a fourth run with three open works the oldest one instead (merge
`main`, answer review, fix CI). Nothing in the content banks (the
farm's, and question content is Fable's by the owner's rule). Nothing
that loosens `firestore.rules` without the record that licenses it.
Never a lane contract, a store form, the privacy page, another lane's
open branch. **Under §3, a privacy-shaped gap is not a stop and not a
silent narrowing: the plan names the smallest shape that keeps the
axiom's power and asks the owner how the constraint is made to fit,
with the cost of each option** — that is the sentence that turns
D334's ask into the maker's habit. Budget 150 minutes from the first
tool call, nothing new begun past minute 120.

**The build model is the owner's call, recorded here:** Fable plans
and reviews, Opus 5 builds under ultracode, *"as this is important
work"*. Ultracode is the Workflow tool's multi-agent orchestration;
the maker's prompt opts in by name so a run never has to infer it.

### 4.2 The merge shift — what a run does

**The job in one sentence:** every pull request the owner approved is
brought to green and read as one diff by a session that did not write
it, and then handed to the shepherd.

Per labelled PR, oldest approval first: read the other open PRs'
diffs for the same files first (the collision rule the register
states — two branches carrying two fixes for one bug); merge
`origin/main` as a merge commit (never rebase, amend or force-push a
branch it did not create); run the closing flow's battery; review the
whole diff adversarially as one unit; fix only what that proves
broken, every commit `shift:`-prefixed; a conflict where both sides
changed the same logic is reported with both sides and left; then, on
a green current head with the review clean, apply `merge-when-green`
and post one comment saying what it changed. A PR it cannot get green
is left labelled `approved`, its row says why, and the owner decides
— it never spends the owner's approval by removing it. Never merges,
never approves in the review sense, never touches an unapproved PR,
never skips or quarantines a test, never pushes an empty commit. Sixty
minutes per PR in the daytime passes, the night pass three hours,
nothing begun past the last thirty minutes of either.

### 4.3 The theory lanes on this account

The owner: *"you will get the same routines as claude session 2 for
improving axiom theory."* Three readings, priced:

- **A second set on the opposite parity** — this account runs the
  subject lanes on even dates and the reader lanes on odd, so every
  theory lane fires **daily** and the review lane every night. Doubles
  the theory program's cadence and cost (about the same again per
  month as the twelve cost today, on a bucket that pays nothing else
  yet); no collision, because the charter's §7 has each lane writing
  only its own directory and §3's land step rebases; the charter's
  §10 table gains a second column. This is the reading this plan
  recommends, because it is the only one that adds capacity.
- **The same set moved here** — frees Claude 2's bucket for its night
  worker and ops lanes; adds nothing to the theory. A rebind, not a
  gain.
- **The same set duplicated on the same dates** — two runs of one
  lane on one day, racing on one branch. Not proposed.

Whichever the owner picks is a charter §10 change, which passes the
owner by D289 §4 and lands on `axiom-theory` on their word, then the
Routines are created here and registered. §9 Q1.

## 5 · The console — monitoring the owner can see

The owner already has a monitoring session on Claude 1; nothing on
this account can see it, and this plan does not replace it — it feeds
it. What the owner asked for is *comprehensive* and *visual*, and
*there can never be too much*; what the three accounts impose is that
every fact reaches the page through the repository.

**Three layers, cheapest first.**

1. **A GitHub workflow renders the page, not a Routine.** Everything
   computable from the tree and the GitHub API — the six lists, every
   open PR by stage and age, CI on `main`, the run logs' last line per
   lane, the register's rows, the theory branch's digest headline and
   scores table, the pulse trail's runway and guard, the night
   shifts' morning verdict lines — is a script in `scripts/`
   (stdlib-only, the `pulse.mjs` discipline) run by `console.yml`
   every two hours. It writes the page into the body of one pinned
   issue titled **Console** (an edit, not a commit — no noise in the
   history, readable on the phone in the GitHub app) and appends one
   trail row a day to `monitoring/console-trail.jsonl` (the pulse
   pattern: the trail is the only output holding what the tree does
   not already know).
2. **Each account contributes what only it can see.** A Routine's fire
   state and a session's cost are readable only from the account that
   owns them, so the roll call on Claude 2 and its twin on each other
   account post their daily rows to the run log, and the workflow
   folds them. A row missing for a day is itself drawn — the stall the
   first retro found was invisible precisely because a lane that
   never fires writes nothing.
3. **The visual layer.** The console keeper (§4) republishes the same
   data as a page with charts — the stage funnel, cost per account per
   week, claims by status over time, runway — as a private artifact,
   and links it from the pinned issue. Charts are what the owner asked
   for; the issue is what survives every platform surprise.

**What the page shows, top to bottom:** what the owner has to do
today (the owner list's open rows) · the merge list with stages · the
to-do list by account with in-flight items · every Routine across all
three accounts with last fire, last landed and this week's cost (or
"no row today", in red) · the theory program (claims by rung, the
latest scores table, the bridge queue, the digest headline) · the axiom
board · visual requests by status · production (runway, guard, alerts
armed, functions deployed) · the permission list's open rows · `main`'s
CI state and the last ten merges. Every panel names the command or
source it was computed from, so a wrong number can be traced.

**The improver.** Sundays, the console improver reads the week's
pages and the run logs, asks what a reader wanted and could not see,
and opens one docs-and-scripts PR that adds panels — never removes
one, per the owner's rule — with the same gate every script here
carries (`test:scripts`).

## 6 · Capacity, cost and the clock

**Buckets.** Claude 2 carries the heaviest load in the program; Claude
1 the cheapest lanes; Claude 3 nothing. Every lane in §4 lands on
Claude 3 except the Claude 1 doer, so nothing here slows an existing
lane. What the third bucket cannot do is absorb an unbounded rate:
this session reports a five-hour rate-limit window, and three lanes
firing into one hour will meet it. The slots in §4 are spread for
that reason, and the maker's three runs sit six hours apart.

**Cost, from measured neighbours rather than guessed.** A theory run is
about $20 (charter §10). The night worker's cumulative metered work,
read off its session record by the register, prices a five-flow night
in the low hundreds of dollars — so an ultracode build run is tens of
dollars, and a maker at three runs a day is on the order of a few
thousand dollars a month before the second theory set. The owner's
standing call is that quality, not budget, is the constraint; the
figure is here so the cadence dial (two runs or three) is turned on a
number. Every lane's real spend reaches the console weekly through
the roll-call rows, so the arithmetic corrects itself.

**The clock.** Account buckets do not cross, so the only shared
resource is `main`: 20:00 UTC is its busiest merge hour and
01:00–05:00 is dead (the register's measurement). The maker's PRs
never touch `main`; the merge shift's daytime passes are what put
merges on the clock, and they sit on the quarter-hour so they never
share a minute with a content lane's self-merge.

## 7 · Order of work, with the gate for each

0. **This page and its questions.** — *Gate:* `check:docs`,
   `check:figures` green; the owner's answers to §9.
1. **The rule and the lists.** `CLAUDE.md` gains §3's paragraph and
   the visual rule; the six list files land seeded as above with
   their `ORIENTATION.md` rows; `WORKLIST.md` gains the tag rule and
   `OPS-RUNBOOK.md` § The list worker the one sentence that reads it;
   the register gains this account's block; the adopting record in
   `DECISIONS.md` amends `OPS-RUNBOOK.md` §0 for the shift's label.
   — *Gate:* `check:docs`, `check:figures`, `test:scripts`.
2. **The two contracts.** The axiom maker's and the merge shift's
   sections, in a runbook of their own beside `OPS-RUNBOOK.md`, with
   canonical prompts, before either Routine exists. — *Gate:*
   `check:docs`; the prompts diff clean against their blocks.
3. **The Routines on this account** — the maker, the shift, the doer,
   the console keeper — created from here, fresh session per run
   unless the platform refuses and a dispatcher is needed (the
   register's measurements decide), each registered in the same PR.
   — *Gate:* the first fire of each lands a run-log line.
4. **The console.** `scripts/console.mjs` and `console.yml`, the pinned
   issue, the trail; then the keeper's artifact; then the improver.
   — *Gate:* `test:scripts` on the renderer; the issue body refreshes.
5. **The other accounts' halves** — the Claude 1 doer, the four
   uncreated ops lanes in whichever web UI the owner chooses (the PR
   shepherd first: it is the door), the theory lanes' second set if Q1
   says so. — *Gate:* the register's rows, verified from
   `list_triggers` on the owning account.

## 8 · What this plan deliberately does not do

- **No lane merges on its own judgement.** The owner's `approved` tap
  is the decision; the shift executes and the shepherd merges under
  the five steps that keep it the owner's. D289's tier stands.
- **No lane edits its own contract.** The improver and the maker
  open docs PRs; the owner merges every one (`AXES-PLAN.md` §10).
- **No fake anything on the console** (D1). A panel whose source did
  not report draws the absence, never a stale number.
- **Nothing outside the ask moves by a routine:** a consent
  requirement in law, D1, the three denies — §3's exceptions — and
  the store forms and privacy page move only in the PR that carries
  the feature they describe, page first.
- **No second night shift over the tree.** The merge shift's subject
  is approved PRs, and its contract keeps it there.

## 9 · The questions — each with the recommendation

*Answered 2026-09-02 — §10 holds the answers. The questions stay as
the record of what was asked.*

1. **The theory lanes on this account** — a second set on the opposite
   parity (every lane daily; recommended), the existing set moved
   here, or something else?
2. **Approval** — the label `approved` on the PR (one tap;
   recommended) or a tick in `MERGE-LIST.md`? And the sentence that
   amends `OPS-RUNBOOK.md` §0: *the merge shift may apply
   `merge-when-green` to a PR the owner labelled `approved`, after
   its pass, on a green head.* Yes?
3. **The to-do partition** — lane tags by account, assigned by whoever
   files the item and otherwise by the axiom maker's planning step,
   untagged defaulting to Claude 2 (recommended); or by area names; or
   round-robin? And does Claude 1 get its doer now (the owner creates
   it on that account) or later?
4. **The rule's boundary** — §3's three exceptions (consent in law,
   built; D1; the three denies). Are those the ones the owner means,
   or should any of them bend too?
5. **The console** — how is the Claude 1 monitoring session's output
   viewed today (an artifact? the chat?), and is the pinned **Console**
   issue plus a private artifact with charts the right pair, or one of
   them?
6. **Visuals** — may a routine *draft* the Claude Design canvas from a
   request (the owner refines it), or does every request wait for the
   owner to open Claude Design? The first keeps the visual lane moving
   unattended; the second keeps every design the owner's first stroke.
7. **The name** — *the axiom builder* (recommended: it builds toward
   the axioms), *the bridge builder* (it carries what crosses the
   bridge, but it does more than that), *the realizer*, or the owner's
   own word.
8. **The axiom list's switch** — does `explored → operational` license
   product code toward that axiom, and `proposed → explored` charter a
   lane? If yes, the list is the maker's permission and the owner's one
   edit moves both.
9. **The maker's cadence and scope** — three runs a day or two; at most
   three open maker PRs at once; and should the maker also carry the
   bridge's open worth-building verdicts first, ahead of gaps it infers
   (recommended)?
10. **The ops lanes' account** — are the list worker and the ops
    dispatcher on Claude 2 (inferred)? And should the four uncreated
    ops lanes — the PR shepherd above all, since the whole merge flow
    ends at it — be created in *this* account's web UI, the unspent
    bucket, rather than Claude 2's?
11. **The forgotten list** — a findings list, a routine-health panel, a
    decisions list (§2.7), or something else the owner had in mind?
12. **Claude 1's improvers and the night shifts** — they push branches
    and stop, and the owner opens the PR. Should the console list those
    branches as merge-list rows in a `no PR yet` stage, so they stop
    depending on the owner remembering them?

## 10 · The owner's answers, 2026-09-02 — what each one sets

Quoted where the words carry the decision; the reading beside each is
what the runbook builds from. Every one is binding on adoption
(`PROGRAM-RUNBOOK.md` phase 1.4's record).

1. **The theory lanes:** *"second set opposite days."* — Claude 3 runs
   the subject lanes on even dates and the reader lanes on odd, the
   review lane on even nights; every lane fires daily. Runbook phase 4.
2. **Approval:** *"the ops runbook says … only you may put it on a PR,
   never a routine — this is wrong, the shepherd can. a second label
   called approved sounds like the way and it should be done by
   ticking a box in the list file."* — The owner's act is the tick in
   `MERGE-LIST.md`; the console workflow mirrors it to the label
   `approved`; the merge shift applies `merge-when-green` when the PR
   is green and reviewed; the shepherd merges. `OPS-RUNBOOK.md` §0's
   "no lane ever applies it" is amended to *the owner's act, executed
   by the owner or by the merge shift on a PR the owner approved*.
3. **The doers:** *"i will add a to-do doer to claude 1 and 3 (or you
   can add it to 3) and they have to work together the best they
   can."* — One per subscription; the Claude 3 one is created from
   here; they work together through the tag rule (§2.2): never one
   another's items, one in flight per account, a tag moved with its
   reason.
4. **The rule's boundary:** *"as long as they dont limit functionality
   then it has to be approved that it can be blocked because of a
   limit."* — Nothing blocks axiom functionality on its own. The
   exceptions in §3 stand only where they do not limit it; where a
   limit would block something, the block is put to the owner first
   and needs their approval. The `CLAUDE.md` paragraph says so.
5. **The console:** *"its an artifact but we need a system that works
   across all sessions."* — The data lives in the repository (the
   pinned Console issue, the trail, the lists), every account writes
   to it through the repository, and one account republishes the
   charted artifact from it (§5, the keeper).
6. **Visuals:** *"a routine can draft it for me as long as it first
   makes the plan then uses claude design."* — A request goes
   `requested → planned → drafted`: the routine writes the plan whole,
   then drafts the canvas with the design skill, then the owner
   refines it.
7. **The name:** *"the axiom builder is fine."*
8. **The axiom list:** *"yeah when status shifts it can start
   building."* — The status word is the builder's licence (§2.5's
   table). Moving a row is the owner's edit.
9. **The builder's cadence:** *"yeah sounds correct."* — Three runs a
   day, at most three open builder PRs, bridge verdicts first.
10. **The register:** *"there should be a common file where all the
    routines are listed and described; they are on claude 2 and the
    ones that were not created are about to be."* — `ROUTINES.md` is
    that file, and it gains a plain one-line description per routine
    (runbook phase 5.3). The ops dispatcher and its four lanes are on
    Claude 2, confirmed; the PR shepherd and the other three are being
    created there.
11. **The forgotten list:** *"a routine health panel and routine
    overview list."* — The console's routine-health panel (§5) and the
    register's overview section.
12. **Branches without PRs:** *"agree with your suggestion."* — The
    merge list carries them as `no PR yet` rows; a tick opens the PR.

