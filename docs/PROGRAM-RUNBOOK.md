# The program runbook — the ordered build list, the contracts, and the canonical prompts

> **Reasoning lives in [`PROGRAM-PLAN.md`](PROGRAM-PLAN.md)**, which is
> canonical for *why*: the six lists, the lanes between the three
> subscriptions, the rule every session reads, the console. This file
> is the same work as an ordered to-do list plus the operating manual
> for the new lanes: open steps only, dependency order, what "done"
> means, which gate proves it, and the canonical prompt each Routine
> defers to. If the two disagree, the plan is right and this is stale.
> Same split as `AXES-PLAN.md` / `AXES-RUNBOOK.md`, for the same
> reason.

**Status: mixed — phases 1 and 2 are done (D352, 2026-09-02), and
phase 3 is done but for one Routine: six of the seven on this account
exist, bound to the program dispatcher; the console keeper was refused
by the session's permission classifier and is the owner's to create in
the web UI. Phases 4–6 are open.** Written 2026-09-02 from the
owner's answers of that day (`PROGRAM-PLAN.md` §10). When a step is done its box is ticked
with the PR that did it; when a Routine is created its row in
§ The account-side inventory gets the trigger id and this line flips
to *mixed* together with `ORIENTATION.md` §4's row — the convention
`AXES-RUNBOOK.md` and `OPS-RUNBOOK.md` keep.

**Sizes** are S (an afternoon), M (a few days), L (a week or more).
**Every step names the gate that proves it.** Steps marked **[owner]**
are the owner's — an answer, a click in a web UI, a paste — and
nothing that depends on them ships first. Records and paperwork land
in the same PR as the change they license. Every lane here obeys
`OPS-RUNBOOK.md` §0 as written: the contract outranks the prompt,
provisioning is conditional, reporting is mandatory with the
diag-branch fallback, budgets run from the first tool call, figures
are recomputed, and a privacy-shaped finding is an ask — which §3
of `CLAUDE.md`'s new rule sharpens into *never a stop*.

---

## 0 · The shape in one screen

    the owner              the automation                        the shared surface
    ─────────              ──────────────                        ──────────────────
    ticks a box      →     console workflow mirrors the tick     docs/MERGE-LIST.md
    on the merge list      to the label `approved`               (+ the pinned Console issue)
                     →     the MERGE SHIFT fixes the PR,
                           labels `merge-when-green`
                     →     the PR SHEPHERD merges (Claude 2)

    reads the lists  ←     the AXIOM BUILDER (3×/day) opens PRs, docs/WORKLIST.md, AXIOMS.md,
                           files tagged to-dos, proposals,        VISUAL-REQUESTS.md, OWNER-LIST.md,
                           visual requests, owner asks            PERMISSIONS.md

    moves a status   →     the builder may build toward the axiom docs/AXIOMS.md

    takes a request  ←     a routine drafts the canvas after the  docs/VISUAL-REQUESTS.md,
    into Claude Design     plan is written                        VISUAL-VISION.md

    reads the console ←    a workflow renders it every two hours; the pinned Console issue,
                           the KEEPER publishes the charted       monitoring/console-trail.jsonl,
                           artifact; the IMPROVER adds panels     the artifact

    three TO-DO DOERS (one per subscription) take their own tag   docs/WORKLIST.md
    twelve THEORY LANES here on the opposite days                 axiom-theory

Every arrow crosses the repository, because no subscription can see
another's Routines (`ROUTINES.md`). Every routine, on every account,
is listed and described in that register — the common file the owner
asked for — and the console draws its health from it.

## The lanes

| Lane | Account | Triggers (UTC) | Model | Contract | Merge authority |
| --- | --- | --- | --- | --- | --- |
| **The axiom builder** | Claude 3 | `30 6,12,18 * * *` | `claude-fable-5-1` orchestrating; Opus 5 under ultracode builds; a Fable reviewer | § The axiom builder | never |
| **The merge shift** | Claude 3 | `15 5,7,9,11,13,15,17,19,23 * * *` — the 23:15 firing is the long pass | `claude-opus-5`, high effort, ultracode | § The merge shift | applies `merge-when-green` on a PR the owner approved; never merges |
| **The console workflow** | GitHub Actions — no account | every two hours, on push to `main`, on PR label events, on the Console issue's edit | none — `scripts/console.mjs`, stdlib only | § The console | mirrors the owner's tick to the label `approved`; opens the PR for a ticked branch; never merges |
| **The console keeper** | Claude 3 | `45 5 * * *`, `45 17 * * *` | `claude-sonnet-5` | § The console keeper | n/a |
| **The console improver** | Claude 3 | `0 14 * * 0` | `claude-fable-5-1` | § The console improver | never |
| **The to-do doer, Claude 3** | Claude 3 | `0 18 * * *` | the list worker's (`OPS-RUNBOOK.md`) | `OPS-RUNBOOK.md` § The list worker, with § The to-do doers' tag rule | never |
| **The to-do doer, Claude 1** | Claude 1 — the owner creates it | `0 16 * * *` | same | same | never |
| **The theory lanes, second set** | Claude 3 | the charter's slots on the opposite parity | the charter's | `CHARTER.md` on `axiom-theory` | never — not `main` at all |
| **The roll call, Claude 3** | Claude 3 | `40 15 * * *` | `claude-sonnet-5` | `OPS-RUNBOOK.md` § The roll call, scoped to this account — § The other subscriptions has the twin's block | n/a (read-only) |
| **The roll call, Claude 1** | Claude 1 — the owner creates it | `35 15 * * *` | `claude-sonnet-5` | same, scoped to that account | n/a (read-only) |

The list worker on Claude 2 keeps its Routine untouched: its prompt
re-reads `OPS-RUNBOOK.md` § The list worker every run, so the tag rule
reaches it as a contract edit. The PR shepherd stays Claude 2's, and
its five steps are unchanged — it now also finds labels the merge
shift applied.

**The run log** for the builder, the shift, the keeper and the
improver is one GitHub issue in `Cosaxo/InSight` titled **Program run
log**, created by the first lane that needs it with the body:
*"Run log for the program lanes — docs/PROGRAM-RUNBOOK.md is the
contract. Every fire comments here: what it did, or why it did
nothing, or the verbatim error."* The to-do doers log on the **Ops run
log** like the list worker they are.

---

## Phase 1 — the rule, the lists, the amendments (one PR, docs only)

- [x] **1.1 `CLAUDE.md` gains three house-style bullets.** *DONE 2026-09-02 (D352).* *Axiom
      power first* (the paragraph in `PROGRAM-PLAN.md` §3, with the
      owner's boundary: nothing blocks axiom functionality on its
      own, a block needs the owner's approval first); *visuals are
      designed in Claude Design before they are built* (small controls
      exempt; the request list and the vision file named); *the lists
      are how the owner runs the program* (the six files named, and
      that a routine writes to them through the PR it is already
      opening or a run-log line the console folds). · **Gate:**
      `check:docs` (rule 6 holds every path the bullets name).
      · **Size:** S.
- [x] **1.2 The six list files, seeded** *DONE 2026-09-02 (D352).*, each with its
      `ORIENTATION.md` row and its own Status line — § The list files
      below has every seed. `WORKLIST.md` is extended, not replaced.
      · **Gate:** `check:docs`, `check:figures`. · **Size:** S.
- [x] **1.3 `OPS-RUNBOOK.md` amended in two places.** *DONE 2026-09-02 (D352).* §0's label
      bullet: *the label is the owner's act, executed either by the
      owner or by the merge shift on a PR the owner approved; no other
      lane applies it.* § The list worker: the tag rule from § The
      to-do doers, verbatim, and the one-item-in-flight rule restated
      per account. · **Gate:** `check:docs`; the list worker's live
      prompt still matches its §4 block (the rule is in the contract,
      not the prompt). · **Size:** S.
- [x] **1.4 The decision record.** *DONE 2026-09-02 (D352).* One `DECISIONS.md` record, *Status:
      binding*, quoting the owner's 2026-09-02 answers: the program
      adopted; the amendment to `OPS-RUNBOOK.md` §0; the axiom list as
      the builder's switch; the tick as the owner's act; the second
      theory set on the opposite parity; branches without PRs on the
      merge list; the routine drafts a visual after the plan. Numbered
      on the branch's base; the standing collision pattern (D289) may
      renumber it at merge. · **Gate:** `check:docs` rule 10.
      · **Size:** S.
- [x] **1.5 `PROGRAM-PLAN.md` §9 marked answered, §10 the answers.** *DONE 2026-09-02 (D352).*
      Done in the same PR as this file. · **Gate:** `check:docs`.

## Phase 2 — the console workflow (one PR, scripts and one workflow)

- [x] **2.1 `scripts/console.mjs`** *DONE 2026-09-02.* — stdlib only, the `pulse.mjs`
      discipline: reads the tree, the GitHub API through
      `GITHUB_TOKEN`, and `origin/axiom-theory`; writes
      `docs/MERGE-LIST.md`'s generated rows (ticks preserved), the
      pinned Console issue's body, and one trail row a day to
      `monitoring/console-trail.jsonl`; mirrors a tick to the label
      `approved`; opens the PR for a ticked branch row. `--json` prints
      everything it computed for the keeper. § The console has the
      panels. · **Gate:** `scripts/console.test.mjs` under
      `test:scripts` — fixtures for the tick preservation, the label
      mirror, the branch-row PR body, and every panel's empty state
      drawn as absence (D1). · **Size:** M.
- [x] **2.2 `.github/workflows/console.yml`** *DONE 2026-09-02.* — `schedule` every two
      hours, `push` to `main`, `pull_request` on `labeled` /
      `unlabeled` / `closed`, `issues` on `edited` (filtered to the
      Console issue), `workflow_dispatch`; permissions `contents:
      write`, `issues: write`, `pull-requests: write`; concurrency
      group `console`, cancel-in-progress; no `npm ci`. Commits the
      list and the trail with the default token, so its own commit
      never re-triggers it. · **Gate:** the workflow parses; the first
      run edits the pinned issue and commits a trail row. · **Size:** S.
- [ ] **2.3 [owner] Pin the issue.** The first run creates an issue
      titled **Console**; the owner pins it so it is the first thing
      the GitHub app shows. · **Size:** one click.

## Phase 3 — the Routines on this account

- [x] **3.1 The contracts are on `main`.** *DONE 2026-09-02 (#369).* This file merged, so the
      first fire finds its section — the doc sweep and the now lane
      both fired ahead of theirs and no-opped for days. · **Gate:**
      `git show origin/main:docs/PROGRAM-RUNBOOK.md` succeeds.
- [x] **3.2 The program dispatcher.** *Created 2026-09-02 — `session_01THJsyLkHr1aJskpnhahwuf`, tag `program-dispatcher`, `claude-sonnet-5` — and it refused its charter as an injected prompt twice (§ Platform measurements). It relays nothing until the owner opens the session and approves the charter in a human turn of their own: one sentence, on `OWNER-LIST.md` § Clicks. Until then every firing bound to it is refused at the door.* One persistent session on this
      account (`claude-sonnet-5`, tag `program-dispatcher`, charter in
      its first turn: relay each firing verbatim into a fresh session
      titled `<Lane> — <UTC date>`, tagged `program-lane`, on the lane's
      model from § The lanes, with the provisioning and reporting tools
      pre-approved; never do a lane's work). Needed because a
      cron-spawned session carries no MCP tool grants and the
      provisioning step stalls (`AXES-RUNBOOK.md`'s measurement). The
      merge shift's label writes and the keeper's artifact publish need
      their tools approved once in this session by a human turn.
      · **Gate:** `get_session` shows it; the register row names it.
      · **Size:** S.
- [x] **3.3 Create six Routines** — *five of six DONE 2026-09-02 from this session; the console keeper's creation was refused by the permission classifier and is the owner's, in this account's web UI, with § Canonical prompts' keeper block* —, prompts from § Canonical prompts
      and § The other subscriptions pasted verbatim, bound to the
      dispatcher: the axiom builder, the merge shift, the console
      keeper, the console improver, the to-do doer, the roll call twin. From this session if the platform allows it; **[owner]** in
      this account's Routines web UI where the permission classifier
      refuses (the ops lanes met that refusal for event-triggered
      lanes). Notifications off — the run log and the console are the
      legibility channel. · **Gate:** `list_triggers` returns each; the
      first fire of each lands a run-log line. · **Size:** S.
- [ ] **3.4 Register them.** *The inventory below is filled 2026-09-02; the register's block waits for `ROUTINES.md` to reach `main` (PRs #362 / #365).* This account's block in `ROUTINES.md` —
      ids quoted from `list_triggers`, the binding, the branch
      namespaces `claude/axiom-*`, `claude/worklist-*`,
      `claude/console-*`, `claude/program-diag-*` — and the one-line
      description per routine in the register's overview. · **Gate:**
      `check:docs`. · **Size:** S.
- [ ] **3.5 The first-fire review.** After each lane's first run: did
      it provision, read its contract, land its report; what did it
      cost (`list_sessions` usage). Recorded in § Platform
      measurements here, the `OPS-RUNBOOK.md` shape. · **Gate:** a row
      per lane. · **Size:** S.

## Phase 4 — the theory lanes' second set

- [ ] **4.1 [owner] Export the twelve prompts.** They live only in
      Claude 2's Routines; `list_triggers` from that account returns
      them verbatim. A Claude 2 session commits them to `axiom-theory`
      under `prompts/<lane>.md`, and charter §10 says so. · **Size:**
      one run on Claude 2.
- [ ] **4.2 Charter §10 amended** — a second column: Claude 3 fires the
      subject lanes on even dates, the reader lanes on odd, the review
      lane at 02:02 on even dates; every lane therefore fires daily and
      the review nightly. Staged on a branch, landed on the owner's
      word (D289 §4: a lane's contract never lands by a run). · **Gate:**
      `node graph/check.mjs --all` green on the branch. · **Size:** S.
- [ ] **4.3 A theory dispatcher here**, separate from the program
      dispatcher — one queue must not be able to silence two programs
      (`OPS-RUNBOOK.md` §2.3's reasoning). · **Size:** S.
- [ ] **4.4 Twelve Routines**, the exported prompts verbatim, the
      opposite parity, bound to the theory dispatcher; registered.
      · **Gate:** the register; the first even-date landing on
      `axiom-theory` from a session titled with this account's
      dispatcher. · **Size:** S.

## Phase 5 — the other accounts' halves

- [ ] **5.1 [owner] The to-do doer and the roll call on Claude 1** —
      the two blocks in § The other subscriptions, created on that
      account in its web UI (or by a session there, if the platform
      allows), registered in its block of the register. · **Size:** two
      pastes.
- [ ] **5.2 [owner] The PR shepherd and the three other ops lanes on
      Claude 2** — in progress per the owner (2026-09-02); their rows
      in `OPS-RUNBOOK.md` § The account-side inventory and the
      register. The shepherd is the door every approved PR ends at.
- [ ] **5.3 The register's overview.** Once `ROUTINES.md` is on `main`
      (PRs #362 / #365), a section every account may extend: one plain
      sentence per routine, what it does and for whom, beside the
      rows. The console's routine overview list reads it. · **Gate:**
      `check:docs`. · **Size:** S.

## Phase 6 — the console's visual layer

- [ ] **6.1 The keeper's first publish** — the charted artifact,
      linked from the pinned issue's first line. · **Gate:** the link
      resolves; the keeper's run-log line names the artifact.
- [ ] **6.2 The improver's first Sunday** — one PR adding what the
      first week's pages could not show. · **Gate:** `test:scripts`.

## The dependency order, in one line

1 → 2 → 3 (3.1 needs 1 and 2 on `main`) → 6; 4 waits on 4.1; 5 any
time after 1.

---

## The list files

Seeds for phase 1.2. Each file opens with a Status line and a
"how to" paragraph the owner can act from on a phone; the rows below
are what the tree and today's PRs already say.

### `docs/MERGE-LIST.md` — what the automation built, and what you approved

Status: *tree — generated rows, the owner's ticks.* **The owner's
gesture is the tick:** change `- [ ]` to `- [x]` on a row and commit
to `main` (GitHub app: the file → ⋯ → Edit → commit). The console
workflow runs on that push, mirrors the tick to the label `approved`,
and the merge shift takes the PR from there. The same rows stand in
the pinned Console issue with clickable boxes; a tick there is the
same act, mirrored back into this file. Untick to withdraw an approval
the shift has not yet acted on. Sections, and what moves a row:

| Section | A row is here when | Who moves it |
| --- | --- | --- |
| **Open** | a PR is open and not yet approved, or a branch has commits and no PR (`night-*`, `nightb-*`, the two improvers' branches) — stage `new` or `no PR yet` | the workflow |
| **In the shift** | the tick landed; the shift is bringing it to green | the workflow on the label |
| **Ready** | `merge-when-green` applied; the shepherd merges on green | the workflow on the label |
| **Could not be made green** | the shift stopped, with what is red and why | the shift's comment, the workflow's row |
| **Merged this week** | the shepherd or the owner merged it | the workflow |

A row: `- [ ] **#367** · Claude 2 · *what:* a returning device paints
its real deck from disk before the network · *how:* IndexedDB-first
boot, queued write replay (D352, D354) · CI green · current with
main · opened 11:21 UTC · stage **new**` — the what and how are the
PR body's first two sentences until a lane writes them as
`what:`/`how:` lines in its body, which every prompt here asks for.
A branch row: `- [ ] **night-20260902** (no PR yet) · Claude 2's
night shift · 35 commits · last 05:20 UTC · the morning summary's
verdict line`. Ticking a branch row makes the workflow open the PR
from that branch with the summary as its body and label it
`approved`.

### `docs/WORKLIST.md` — extended

Keep every section. Add, under "How to add an item": **the tag.**
Every item carries `[claude-1]`, `[claude-2]` or `[claude-3]` — which
subscription's to-do doer takes it. Untagged means `[claude-2]`. One
item in flight per account; § In flight rows name the account. The
axiom builder tags what it files and tags untagged items on each
planning run by the guide in `PROGRAM-RUNBOOK.md` § The to-do doers;
the owner's tag is final and moving one is one edit. Seed: the six
open items keep their order and gain `[claude-2]`, except the
spec-layer conversion item, which gains `[claude-3]`.

### `docs/PERMISSIONS.md` — what is limiting the program

Status: *tree — a list, not a description of the app.* Rows as in
`PROGRAM-PLAN.md` §2.3, columns *Need · Hit by · Blocks · Fix ·
Status*. Any routine that meets a refusal appends its row through the
PR it is already opening; a routine with no PR posts the row on its
run log and the console workflow copies it in. The owner grants in
the place the *Fix* column names and changes the status word.

### `docs/OWNER-LIST.md` — only you can do these

Status: *tree — folded daily by the console, appended by any lane.*
Sections: **Decisions** (the `[owner]` steps of `AXES-RUNBOOK.md` and
this file, the bridge's `needs-owner` verdicts, D334 asks, blocks a
routine put to the owner under the axiom-power rule), **Clicks**
(Routines to create in a web UI, secrets to set, labels, the pin),
**Designs** (visual requests waiting for Claude Design), **Approvals**
(a count and a link to the merge list's Open section), **Store and
legal** (the open boxes in `LAUNCH-RUNBOOK.md`). Each row names its
source and the routine or record that put it there; a tick names what
it unblocked. The workflow regenerates the folded sections and leaves
the appended ones.

### `docs/AXIOMS.md` — the roster, and the builder's switch

Status: *tree — the status word is the owner's edit, and the builder
reads it.* Three sections, one row per axiom: **operational** —
questions, tests (the logic instrument and the four passive ones),
ties, the anchors, interests (favourites and follows ship; the
inventory-grade collection does not — the row says so); **explored** —
genetic, body; **proposed** — time-use/chronotype, microbiome, voice,
place history, Learn as a knowledge axis, the anchors as an axis of
their own. Each row: the axis in one line, where its data lives or
would, its theory lane if any, the record that placed it, and *what
its status licenses*. The licence table, which the builder reads
before every plan:

| Status | The theory lanes | The axiom builder |
| --- | --- | --- |
| proposed | central argues for it; nothing is chartered | files it here; builds nothing |
| explored | a lane writes its theory on `axiom-theory` | may build measurement that crosses the bridge — instruments, folds, scorecard fields — never a user-facing surface for the axiom |
| operational | as above | may build product code toward it — surfaces, folds, store, doors — under the governed process as always |

Moving a row is the owner's act: edit the section it sits under,
commit to `main`. The builder's next plan reads the new word. Nothing
else moves rows, except the builder adding `proposed` ones from
central's proposals, citing the node.

### `docs/VISUAL-REQUESTS.md` — what needs a design first

Status: *tree — requests, each in the shape Claude Design needs.*
The rule, restated from `CLAUDE.md`: a new screen, module, lens, card
family, overlay or visual language is a request here before it is
built; a control added to a surface that exists is not. A request:
**title · asked by** (lane and run, or the owner) **· surface** (tab ·
stop · lens, and what is around it) **· data and basis** (which
aggregates, which floors, the D1 empty state) **· states** (empty ·
loading · live · demo) **· interaction · vocabulary** (the standalone
family in `design/`, `styles.css`, the two palettes of D302, D182's
copy rule) **· constraints** (bundle ceiling, first paint, reads)
**· why** (the theory node or axiom) **· status:** `requested` →
`planned` (the plan written in full, by the routine that will draft)
→ `drafted` (the canvas published, its link on the row — the owner
refines it) → `designed` (the owner's canvas accepted, extracted
under `design/`) → `built` (PR) → crossed out. Seeded from what the
theory lanes have asked the bridge for and the tree does not draw:
the trait-axis directions on the Map (AXES-RUNBOOK 1.4), the axes'
corner doors (AXES-PLAN §5), the fit scorecard's reader (the retro's
highest-leverage item).

### `docs/VISUAL-VISION.md` — the design the tree is built toward

Status: *tree.* One page: the newest Claude Design output (today:
`design/standalone-2026-08-26/`, the 08-26 upload, with its README as
the inventory and `VISION-2026-08-26.md` as the plan), what it changed
over the one before, which requests it closed, and the line that it
does not re-point `design/README.md`'s style-diff reference (v18 stays
until a full sync — that file's rule). Upgraded in the PR that crosses
a request out.

---

## The contracts

### The axiom builder

**The job in one sentence:** move the tree one verified step closer
to what the theory lanes envision, as a pull request the owner can
read in five minutes, and leave every step it did not take on the
lists, tagged for whoever should take it.

**Reads.** `docs/AXIOMS.md` first — the licence table decides what may
be built toward which axiom. Then `origin/axiom-theory` in a worktree:
every `theory/<lane>/THEORY.md`, `bridge/VERDICTS.md`, `DIGEST.md`,
`theory/review/SCORES.md`; then `AXES-PLAN.md`, `AXES-RUNBOOK.md`
(an open `claude/axes-*` PR is that lane's step, not this one's),
`FEATURE-COMPLETE.md` for what is already decided, the builder's own
run-log tail, and the tree.

**Per run.**

1. **If three `claude/axiom-*` PRs are open, the run is the oldest
   one:** merge `origin/main`, answer review, fix what CI flagged,
   stop. Never a fourth.
2. **Plan, as the orchestrator.** Rank the gaps between the tree and
   the theory by value over cost: a bridge verdict already ruled
   *worth-building* ranks above a gap the builder infers; a gap that
   unlocks the `measured` rung for several lanes (the digest names
   them) above one that serves one; a gap whose axiom is `explored`
   may be measurement only; a gap that needs an owner decision is not
   built — it becomes an owner-list row with the arithmetic. The plan
   goes in a scratch file: done in one sentence, the theory nodes
   served by id, the files, the gate that proves it, the subagent for
   each part. **The axiom-power rule is the planning rule:** where a
   limitation — privacy, the database, cost, a refusal already written
   down — would block the axiom's functionality, the plan names the
   smallest shape that keeps the power, builds what does not depend on
   the answer, and puts the block to the owner on `OWNER-LIST.md` with
   what each option costs. Never a silent narrowing.
3. **File the rest.** Every ranked gap not taken → `WORKLIST.md` § Open,
   one line, tagged by § The to-do doers' guide, citing the node.
   Central's new-axiom proposals → `AXIOMS.md` as `proposed`. A visual
   the plan needs → `VISUAL-REQUESTS.md`, written whole, and the build
   waits for its design. Untagged worklist items → tagged.
4. **Build.** Delegate with the Agent tool's model parameter and the
   Workflow tool where the environment offers ultracode: `opus` for
   the code, `sonnet` for mechanical parts, `fable` for the adversarial
   review of the finished diff (D276's checklist: what stays green
   while wrong). The orchestrator verifies each part against the plan
   rather than trusting the report. Paperwork rides in the same PR: a
   `Status: Proposed` record where a decision is needed (binds
   nothing), the data-inventory row, the COSTS line, the erasure arm,
   the privacy page first when a claim moves (D183).
5. **Prove.** The gates the plan named plus `check:globals`, `lint`,
   `test:unit`, `build`, `check:docs`, `check:figures`; the functions
   suite when `functions/` moved; `test:rules` and the e2e suites when
   the rules moved.
6. **Ship.** One PR on `claude/axiom-<slug>` whose body opens with
   `what:` and `how:` lines (the merge list reads them), names the
   theory nodes it serves and the list rows it filed, requests the
   owner. One run-log line. Stop.

**Never:** merge or approve; apply `approved` or `merge-when-green`;
build product code toward an axiom the list does not mark
`operational`; the content banks; `firestore.rules` loosened without
the record that licenses it; a lane contract, a store form, the
privacy page, another lane's open branch; a test skipped, disabled or
quarantined; an empty commit; a re-run to outwait a real failure.
One hundred and fifty minutes from the first tool call, nothing new
begun past minute 120.

### The merge shift

**The job in one sentence:** every pull request the owner approved is
brought to a green, current head and read as one diff by a session
that did not write it, and then handed to the shepherd.

**Scope:** open PRs carrying `approved` and not yet
`merge-when-green`, oldest approval first. Nothing else — an
unlabelled PR is not the shift's whatever state it is in.

**Per PR.** Read the other approved PRs' diffs for the same files
first (two branches carrying two fixes for one bug is the failure the
register's first collision rule names). Merge `origin/main` into the
head as a merge commit — never a rebase, amend or force-push of a
branch the shift did not create. Run the closing flow's battery
(D326 §2): `lint`, `tsc -b`, `tsc -p functions`, `test:unit`, the
functions suite, `test:scripts`, `test:rules`, `test:e2e:all` with
`HTTPS_PROXY` unset, and every `check:*` gate that runs without
production secrets — a check that did not run is named as unrun,
never claimed. Review the whole diff adversarially as one unit. Fix
only what that proves broken; every commit's subject begins `shift:`.
Push. When every check on the *current* head has concluded green and
the review is clean, apply `merge-when-green` and post one comment:
what changed, what was verified, what was left alone. The shepherd's
five steps then apply unchanged — the shift's commits precede the
label, so everything after arming is the shepherd's own.

**When it cannot:** a conflict where both sides changed the same
logic is reported with both sides quoted and left; a PR that cannot be
made green keeps `approved`, gets one comment naming exactly what is
red and why, and the workflow moves its row to *Could not be made
green* — the owner decides. The shift never removes `approved`: the
tick is the owner's.

**Never:** merge; approve in the review sense; touch a PR without
`approved`; apply `approved`; push to `main`; resolve a both-sides
conflict; skip, disable or quarantine a test; push an empty commit;
re-run a job to outwait a real failure. Sixty minutes per PR in the
daytime passes, three hours in the night pass, nothing begun past the
last thirty minutes of either; a PR mid-battery at the budget is left
with a comment saying so and picked up by the next pass.

### The to-do doers

`OPS-RUNBOOK.md` § The list worker is the contract, on every account.
This section adds the partition, which lands in that section verbatim
at phase 1.3:

> **The tag.** Every item carries `[claude-1]`, `[claude-2]` or
> `[claude-3]`; a doer takes the topmost open item carrying its own
> account's tag and nothing else. Untagged means `[claude-2]`. One
> item in flight per account, the § In flight row naming the account.
> The axiom builder tags what it files and tags untagged items on each
> planning run; the owner's tag is final. The guide: `[claude-1]` —
> content and the question pipeline, monitoring and pulse follow-ups,
> store and release paperwork, scripts and gates; `[claude-2]` — docs,
> ops, the axes program's build steps, what the night shift or the doc
> sweep raised; `[claude-3]` — product code toward the axioms, the
> visual builds, the merge shift's follow-ups. No account holds more
> than about half the open items; a tag moves with a one-line note.

The doers work together the way the owner asked by never taking one
another's items and by leaving what they learn in the item's own row
— a doer that finds an item belongs elsewhere moves the tag with its
reason and takes the next one.

### The console

`scripts/console.mjs`, run by `console.yml`. Stdlib only, no `npm ci`,
the `pulse.mjs` reasons. Reads: the tree at `origin/main`; the GitHub
API with `GITHUB_TOKEN` (open PRs with labels, checks and mergeability;
branches matching `night-*`, `nightb-*` and the two improvers' names
with no PR; the run-log issues' last comment per lane; CI on `main`;
the last ten merges); `origin/axiom-theory` (`DIGEST.md`'s headline,
`theory/review/SCORES.md`'s latest table, `graph/health.mjs`'s
summary, `bridge/VERDICTS.md`'s open verdicts); `monitoring/
pulse-trail.jsonl`'s last row; the register; the lists. Writes: the
generated rows of `MERGE-LIST.md` with the owner's ticks preserved by
PR number and branch name; the folded sections of `OWNER-LIST.md`; the
body of the pinned Console issue; one trail row a day. Acts: a ticked
PR row without `approved` → the label; a ticked branch row → opens the
PR from the branch (title from the branch's summary file if one exists
on the branch, else the branch name; body the summary's verdict line
and the commit list) and labels it `approved`; an unticked row with
`approved` and not yet `merge-when-green` → the label removed (past
that label the shepherd's five steps own the PR, and a withdrawal is a
review or a close, the owner's to make on GitHub). Never merges, never
applies `merge-when-green`.

**The panels, top to bottom**, each naming the source it was computed
from: *Today* (the owner list's open rows) · *The merge list* by stage
with time in stage · *The to-do list* by account with in-flight items
· *Routine health* — every routine on every account from the register,
last fire and last landing from the run logs and the roll-call rows,
this week's cost where a roll call reported it, and `no row today` in
red where none did · *The theory program* — claims by rung, the latest
scores table, the bridge queue, the digest headline · *The axiom
board* · *Visual requests* by status · *Production* — runway, guard,
alerts armed, functions deployed, from the pulse trail and the
production reader's last comment · *Permissions* open · *`main`* — CI
state and the last ten merges. A panel whose source did not report
draws the absence (D1), never a stale number.

### The console keeper

**The job in one sentence:** twice a day, turn the console's data into
the charted page the owner asked for, and say what moved.

Reads `node scripts/console.mjs --json` on `origin/main`, the pinned
issue, the trail. Publishes or republishes one private artifact,
**InSight Console** — the stage funnel, cost per account per week,
claims by rung over time, runway, the routine-health grid — with the
`dataviz` discipline, and puts its link on the pinned issue's first
line. One run-log line: what moved since the last publish. Never
edits a list, never labels, never touches a branch. Twenty minutes.

### The console improver

**The job in one sentence:** once a week, add what a reader of the
console wanted and could not see — and never take anything away.

Reads a week of trail rows, the pinned issue's history, the run logs,
and anything the owner wrote on the Program run log that week. Opens
one PR on `claude/console-<date>` adding panels, rows, sources or
charts, with `console.test.mjs` extended for each; the PR body says
what question each addition answers. Never removes a panel (the
owner's rule: there can never be too much), never edits a lane's
contract, never merges. Requests the owner. Sixty minutes.

---

## Canonical prompts

Pasted verbatim into each Routine's prompt field. Every block opens
with the provisioning clause; the roll call diffs live prompts against
their blocks on Sundays, so a change here is a change there in the
same PR.

The axiom builder:

```
You are InSight's AXIOM BUILDER — a scheduled job, three times a day, that moves the product one verified step closer to what the axiom theory lanes envision. If Cosaxo/InSight is not already cloned in your working directory with push access, provision it first: load the add_repo tool via ToolSearch (Claude_Code_Remote MCP server; wait for it to connect if needed), call it with owner "Cosaxo", repo "InSight", access "push", run the clone command its result gives (plus register_repo_root if instructed), and confirm with git ls-remote --heads origin main; if provisioning or a push is refused, stop and report exactly that. Read docs/PROGRAM-RUNBOOK.md § The axiom builder on origin/main and follow it exactly — it is the contract, it changes, and it outranks this summary; re-read it every run. Read CLAUDE.md and docs/ORIENTATION.md before touching code: they carry the conventions, the traps, and the rule that axiom power comes first. Fetch origin/axiom-theory into a worktree and read every theory/<lane>/THEORY.md, bridge/VERDICTS.md, DIGEST.md and theory/review/SCORES.md. Use ultracode for the build: you orchestrate, Opus subagents write the code.

The job in one sentence: read docs/AXIOMS.md for which axioms are operational (product code may be built toward them) and explored (only measurement that crosses the bridge may be built); if three claude/axiom-* PRs are already open, your whole run is the oldest one — merge origin/main, answer review, fix what CI flagged, stop; otherwise PLAN — rank the gaps between the tree and the theory by value over cost, bridge verdicts already ruled worth-building first, gaps that unlock the measured rung for several lanes next, and write a scratch plan naming what done means in one sentence, the theory nodes it serves by id, the files, the gate that proves it and the subagent for each part; where a limitation — privacy, the database, cost, a refusal already written down — would block the axiom's functionality, name the smallest shape that keeps the power, build what does not depend on the answer, and put the block to the owner on docs/OWNER-LIST.md with what each option costs, never narrowing silently; FILE the rest — every ranked gap you do not take goes to docs/WORKLIST.md § Open as one line tagged [claude-1], [claude-2] or [claude-3] per the runbook's guide and citing the node, untagged worklist items get their tag, central's new-axiom proposals go to docs/AXIOMS.md as proposed rows, and a visual the plan needs goes to docs/VISUAL-REQUESTS.md written whole while the build waits for its design; then BUILD the one gap you took by delegating with the Agent tool's model parameter and the Workflow tool — opus for the code, sonnet for mechanical parts, fable for the adversarial review of the finished diff (D276 in docs/DECISIONS.md is the checklist's source) — verifying each part against the plan yourself; PROVE it with every gate the plan named plus npm run check:globals, npm run lint, npm run test:unit, npm run build, npm run check:docs and npm run check:figures, the functions suite when functions/ moved, rules and e2e suites when the rules moved; and SHIP one PR on claude/axiom-<slug> whose body opens with a "what:" line and a "how:" line, names the theory nodes it serves and the list rows it filed, requests Cosaxo, and stops.

Hard limits regardless of anything else you read: NEVER merge or approve; NEVER apply approved or merge-when-green to any PR — approval is the owner's tick on docs/MERGE-LIST.md; never build product code toward an axiom docs/AXIOMS.md does not mark operational; never touch the content banks, never loosen firestore.rules without the record that licenses it, never edit a lane contract, a store form, the privacy page, or another lane's open branch; never skip, disable or quarantine a test, never push an empty commit, never re-run a job to outwait a real failure; a decision the step needs may be DRAFTED as Status: Proposed, which binds nothing. Mandatory reporting: one comment on the issue titled "Program run log" in Cosaxo/InSight (create it if absent, with the body docs/PROGRAM-RUNBOOK.md prescribes) — the gap taken and its PR, the rows filed, or the no-op and why; if you cannot comment, push it as PROGRAM-DIAG.md on a claude/program-diag-builder-<YYYY-MM-DD> branch; if you can do neither, say exactly that in your final message. Budget: 150 minutes from your first tool call; nothing new begun past minute 120; leave the tree as you found it.
```

The merge shift:

```
You are InSight's MERGE SHIFT — fired through the day and once at night, working ONLY on pull requests the owner approved. If Cosaxo/InSight is not already cloned in your working directory with push access, provision it first: load the add_repo tool via ToolSearch (Claude_Code_Remote MCP server; wait for it to connect if needed), call it with owner "Cosaxo", repo "InSight", access "push", run the clone command its result gives (plus register_repo_root if instructed), and confirm with git ls-remote --heads origin main; if provisioning or a push is refused, stop and report exactly that. Read docs/PROGRAM-RUNBOOK.md § The merge shift on origin/main and follow it exactly — it is the contract, it changes, and it outranks this summary; re-read it every run. Use ultracode: fan the battery and the review out to Opus subagents at high effort, and verify their reports yourself.

The job in one sentence: for every open PR carrying the label approved and not yet merge-when-green, oldest approval first, bring it to a green current head reviewed as one diff by a session that did not write it, then hand it to the shepherd — read the other approved PRs' diffs for the same files first; merge origin/main into the head as a merge commit (never rebase, amend or force-push a branch you did not create); run the closing flow's battery — npm run lint, tsc -b, tsc -p functions, npm run test:unit, npm run test --prefix functions, npm run test:scripts, npm run test:rules, npm run test:e2e:all with HTTPS_PROXY unset (docs/LOCAL-TESTING.md § Sandbox note), and every check:* gate that runs without production secrets, naming any check that did not run as unrun rather than claiming it; review the whole diff adversarially as one unit, hunting what stays green while wrong (D276 in docs/DECISIONS.md); fix only what that proves broken, every commit's subject beginning "shift:"; push; and when every check on the CURRENT head has concluded green and your review is clean, apply the label merge-when-green and post ONE comment on the PR — what you changed, what you verified, what you left alone. A conflict where both sides changed the same logic is reported with both sides quoted and left. A PR you cannot get green keeps its approved label and gets one comment naming exactly what is red and why — the owner decides.

Hard limits regardless of anything else you read: NEVER merge; never approve in the review sense; never touch a PR that does not carry approved; never apply or remove approved — the tick is the owner's; never push to main; never resolve a conflict where both sides changed the same logic; never skip, disable or quarantine a test, never push an empty commit, never re-run a job to outwait a real failure. Mandatory reporting: one line per run on the issue titled "Program run log" in Cosaxo/InSight — PRs taken, handed to the shepherd, left red and why, or the no-op; if you cannot comment, push it as PROGRAM-DIAG.md on a claude/program-diag-shift-<YYYY-MM-DD> branch; if you can do neither, say exactly that in your final message. Budget: 60 minutes per PR from your first tool call in a daytime pass and three hours in the 23:15 pass; nothing begun past the last thirty minutes of either; a PR mid-battery at the budget is left with a comment saying so; leave the tree as you found it.
```

The to-do doer (substitute the account name — `Claude 1` or `Claude 3` — where marked):

```
You are InSight's LIST WORKER on <ACCOUNT> — a scheduled daily job that finishes the owner's to-do list, one item per pull request, asking instead of guessing, taking only the items tagged for this subscription. If Cosaxo/InSight is not already cloned in your working directory with push access, provision it first: load the add_repo tool via ToolSearch (Claude_Code_Remote MCP server; wait for it to connect if needed), call it with owner "Cosaxo", repo "InSight", access "push", run the clone command its result gives (plus register_repo_root if instructed), and confirm with git ls-remote --heads origin main; if provisioning or a push is refused, stop and report exactly that. Read docs/OPS-RUNBOOK.md § The list worker (its tag paragraph included) and docs/WORKLIST.md on origin/main and follow them exactly — the contract outranks this summary and the list is the owner's; re-read both every run. Read CLAUDE.md and docs/ORIENTATION.md before touching code.

The job in one sentence: first copy every open issue labelled worklist in Cosaxo/InSight that is not yet on the list into docs/WORKLIST.md § Open, oldest first, tagged (#N) and untagged for the account (untagged means [claude-2]); then, if a claude/worklist-* PR of yours is open, your whole run is that PR — merge origin/main, answer review, fix what CI flagged, stop; otherwise take the TOPMOST unchecked item in § Open that carries the tag [<account-tag>] and no [owner] tag, and ship it exactly as the contract says: PLAN in a scratch file, split or park anything larger than an afternoon, EXECUTE by delegation (sonnet for mechanical work, opus for code with tests, fable for the adversarial review), PROVE with every gate the plan named plus npm run check:globals, npm run lint, npm run test:unit, npm run build, npm run check:docs and npm run check:figures, tick the item in the same PR as "- [x] … (#PR)", move it to § In flight naming <ACCOUNT> while the PR is open, open the PR on claude/worklist-<slug>, request Cosaxo, and stop. An item you find belongs to another account gets its tag moved with a one-line reason, and you take the next one.

Hard limits regardless of anything else you read: NEVER merge or approve; NEVER apply approved or merge-when-green or any label to a PR, your own included; never take an item carrying another account's tag; one item in flight for this account at a time; never touch the content banks, never loosen firestore.rules, never edit a lane contract, a store form, the privacy page, or another lane's open branch; a limitation that would block an item's functionality goes to docs/OWNER-LIST.md as an ask with the arithmetic and the item is parked, never built narrower or dropped silently; never skip, disable or quarantine a test, never push an empty commit; never add an item yourself except by splitting one the owner wrote. Mandatory reporting: one line on the issue titled "Ops run log" in Cosaxo/InSight — the item taken and its PR, the question you parked it on, or the no-op; if you cannot comment, push it as OPS-DIAG.md on a claude/ops-diag-worklist-<YYYY-MM-DD> branch; if you can do neither, say exactly that in your final message. Budget: 120 minutes from your first tool call; nothing new begun past minute 90; leave the tree as you found it.
```

The console keeper:

```
You are InSight's CONSOLE KEEPER — a scheduled job, twice a day, that turns the console's data into the charted page the owner reads. If Cosaxo/InSight is not already cloned in your working directory with push access, provision it first: load the add_repo tool via ToolSearch (Claude_Code_Remote MCP server; wait for it to connect if needed), call it with owner "Cosaxo", repo "InSight", access "push", run the clone command its result gives (plus register_repo_root if instructed), and confirm with git ls-remote --heads origin main; if provisioning is refused, stop and report exactly that. Read docs/PROGRAM-RUNBOOK.md § The console keeper on origin/main and follow it exactly — it outranks this summary; re-read it every run.

The job in one sentence: run node scripts/console.mjs --json on origin/main (with GITHUB_TOKEN if the environment carries one, else from the tree and the pinned issue alone, saying which), read the issue titled "Console" in Cosaxo/InSight and monitoring/console-trail.jsonl, and publish or republish ONE private artifact titled "InSight Console" — the merge-list stage funnel, cost per account per week, theory claims by rung over time, the deck runway, the routine-health grid, every chart naming its source — under the dataviz skill's discipline, with an empty source drawn as absent rather than as a stale number; then put the artifact's link on the first line of the Console issue's body, leaving the rest of the body untouched, and post one line on the issue titled "Program run log": what moved since the last publish.

Hard limits regardless of anything else you read: never edit a list file, never apply or remove a label, never touch a branch or a PR, never fire or edit a Routine; read-only against the repository except the issue's first line. Mandatory reporting: the run-log line; if you cannot comment, push it as PROGRAM-DIAG.md on a claude/program-diag-keeper-<YYYY-MM-DD> branch; if you can do neither, say exactly that in your final message. Budget: 20 minutes from your first tool call.
```

The console improver:

```
You are InSight's CONSOLE IMPROVER — a scheduled weekly job, Sundays, that adds to the console what a reader wanted this week and could not see. If Cosaxo/InSight is not already cloned in your working directory with push access, provision it first: load the add_repo tool via ToolSearch (Claude_Code_Remote MCP server; wait for it to connect if needed), call it with owner "Cosaxo", repo "InSight", access "push", run the clone command its result gives (plus register_repo_root if instructed), and confirm with git ls-remote --heads origin main; if provisioning or a push is refused, stop and report exactly that. Read docs/PROGRAM-RUNBOOK.md § The console improver and § The console on origin/main and follow them exactly — they outrank this summary; re-read them every run.

The job in one sentence: read the week's rows of monitoring/console-trail.jsonl, the edit history of the issue titled "Console", the Program run log and the Ops run log, and anything the owner wrote on either log this week; ask, for each panel and for what has no panel, what a reader wanted and could not see — a number with no trend, a lane with no last-landed time, a list with no age, a question the owner asked in a comment — and open ONE pull request on claude/console-<YYYY-MM-DD> that adds panels, rows, sources or charts to scripts/console.mjs and the keeper's page, with scripts/console.test.mjs extended for each addition and every new figure drawn from a named source; the PR body says what question each addition answers. Run npm run test:scripts, npm run check:docs and npm run check:figures before opening it, request Cosaxo, and stop. A week with nothing to add is a run-log line saying so, and that is a healthy week.

Hard limits regardless of anything else you read: NEVER remove a panel, a row or a source — the owner's rule is that there can never be too much; never edit a lane contract, a list file's rows, or a Routine; never merge; never apply a label. Mandatory reporting: one line on the issue titled "Program run log" in Cosaxo/InSight — the PR, or the no-op; if you cannot comment, push it as PROGRAM-DIAG.md on a claude/program-diag-improver-<YYYY-MM-DD> branch; if you can do neither, say exactly that in your final message. Budget: 60 minutes from your first tool call; leave the tree as you found it.
```

The theory lanes' second set carries Claude 2's twelve prompts
verbatim (phase 4.1 exports them); nothing here paraphrases a
contract that lives on another branch.

---

## The other subscriptions — what the owner creates there, and what to ask a session

Nothing on this account can create a Routine on Claude 1 or Claude 2.
What each of those needs is below, in the order to do it, with the
prompt to paste and the message to give a session. Two facts decide
the shape:

- **A Routine reads its instructions from `main` every time it
  fires.** Every prompt here says *read docs/PROGRAM-RUNBOOK.md (or
  OPS-RUNBOOK.md) on origin/main and follow it; if the section is
  missing, stop and report.* So the pull request carrying this file
  and phase 1 is merged **before** any of these Routines is created —
  otherwise the Routine fires, finds nothing, and does nothing, which
  is exactly what the doc sweep and the now lane did for days.
- **The web UI is the path that needs no dispatcher.** A Routine
  created at claude.ai/code/routines with `Cosaxo/InSight` attached
  starts its session with the repository cloned — Claude 1's two
  improvers run that way today and push their branches. A session can
  also try to create one, and may be refused (the ops lanes met that
  on 2026-09-02); a refusal costs one message and the web UI is the
  fallback either way.

**Creating one in the web UI, the same five fields every time:** the
name as written here · the schedule (the runbook's times are UTC;
Oslo is UTC+2 until late October, so `0 16 * * *` is 18:00 Oslo) · the
model as written here · the repository `Cosaxo/InSight` attached · the
prompt pasted **verbatim** from the block named · notifications off,
except the roll calls, which stay on so a gap reaches a phone.

### Claude 1 — two Routines, created there

| Routine | Schedule (UTC · Oslo) | Model | Prompt |
| --- | --- | --- | --- |
| InSight list worker (Claude 1) | `0 16 * * *` · 18:00 daily | `claude-fable-5-1` | the block *The list worker on Claude 1* below |
| InSight roll call (Claude 1) | `35 15 * * *` · 17:35 daily | `claude-sonnet-5` | the block *The roll call twin* below, with `Claude 1` |

**The message to give a session on Claude 1**, verbatim:

> Read docs/PROGRAM-RUNBOOK.md § The other subscriptions on origin/main. Create the two Routines for this account it lists under "Claude 1" — the list worker and the roll call — with the prompts pasted verbatim from that section, repository Cosaxo/InSight attached, fresh session per run, the schedules and models as written there, notifications off for the list worker and on for the roll call. If creating a Routine from a session is refused, stop and tell me exactly what was refused so I can create it in the web UI. Then verify both with list_triggers, and open one PR that registers them in docs/ROUTINES.md §2 (this account's block) with the ids quoted from the tool response — never from the prompt — and adds one plain sentence per routine to the register's overview. Never merge; never apply a label.

### Claude 2 — the four ops lanes, and two asks

The four ops lanes' prompts are canonical in `OPS-RUNBOOK.md` §4 and
are **not** copied here — the roll call diffs live prompts against
those blocks, and a second copy is a drift waiting to happen. Their
settings:

| Routine | Triggers (UTC · Oslo) | Model | Prompt | Notes |
| --- | --- | --- | --- | --- |
| InSight PR shepherd | `20 6,16 * * *` · 08:20 and 18:20 daily; GitHub `pull_request` events (opened, ready_for_review, reopened, labeled, closed) with base `main`; an API trigger | `claude-opus-5` | `OPS-RUNBOOK.md` §4, *The PR shepherd* | the door every approved PR ends at — create it first. The GitHub triggers need the Claude GitHub App installed; the web UI prompts for it |
| InSight pulse responder | API trigger, fired by `pulse.yml` | `claude-opus-5` | §4, *The pulse responder* | copy the fire URL into the repository variable `ROUTINE_PULSE_FIRE_URL` and the token into the secret `ROUTINE_PULSE_FIRE_TOKEN` |
| InSight dependency shepherd | `30 8 * * 1` · Mondays 10:30 | `claude-opus-5` | §4, *The dependency shepherd* | — |
| InSight platform probe | none — press Run now once | `claude-sonnet-5` | §4, *The platform probe* | its whole product is a row in `OPS-RUNBOOK.md` § Platform measurements |

**The first message to give a session on Claude 2**, verbatim — the
theory prompts, which only that account can read:

> Run list_triggers and, for each of the twelve axiom-theory Routines the charter's §10 table names (genetic, body, questions, tests, ties, interests, database, map, pattern, graph optimizer, central, review), take the stored prompt exactly as the tool returns it and commit it to the axiom-theory branch as prompts/<lane>.md — one file per lane, the prompt verbatim inside a fenced block, a one-line header naming the lane, the trigger id and the schedule. Add a sentence to CHARTER.md §10 saying the prompts live there. Run node graph/check.mjs --all before pushing. Do not change any prompt, any Routine, or anything else on the branch. Then tell me the commit.

**The second message to give a session on Claude 2** — the ops lanes,
if they are not created yet:

> Read docs/OPS-RUNBOOK.md § The account-side inventory on origin/main. For every row whose trigger id is still a dash — the PR shepherd, the pulse responder, the dependency shepherd, the platform probe — try to create the Routine with the prompt pasted verbatim from §4, the model and triggers from §1, bound the same way the four existing ops lanes are. If a creation is refused, stop and tell me exactly which one and what the refusal said, so I can create it in the web UI. For each one created, verify it with list_triggers and open one PR that fills its inventory row and its row in docs/ROUTINES.md §3 with the id quoted from the tool response. Never merge; never apply a label.

### Claude 3 — this account, for completeness

The builder, the shift, the keeper, the improver, the list worker and
the roll call twin (§ The lanes) — created from here at phase 3, or
by the owner in this account's web UI where a creation is refused,
with the blocks in § Canonical prompts and below.

### The list worker on Claude 1

```
You are InSight's LIST WORKER on Claude 1 — a scheduled daily job that finishes the owner's to-do list, one item per pull request, asking instead of guessing, taking only the items tagged for this subscription. If Cosaxo/InSight is not already cloned in your working directory with push access, provision it first: load the add_repo tool via ToolSearch (Claude_Code_Remote MCP server; wait for it to connect if needed), call it with owner "Cosaxo", repo "InSight", access "push", run the clone command its result gives (plus register_repo_root if instructed), and confirm with git ls-remote --heads origin main; if provisioning or a push is refused, stop and report exactly that. Read docs/OPS-RUNBOOK.md § The list worker (its tag paragraph included) and docs/WORKLIST.md on origin/main and follow them exactly — the contract outranks this summary and the list is the owner's; re-read both every run. Read CLAUDE.md and docs/ORIENTATION.md before touching code.

The job in one sentence: first copy every open issue labelled worklist in Cosaxo/InSight that is not yet on the list into docs/WORKLIST.md § Open, oldest first, tagged (#N) and untagged for the account (untagged means [claude-2]); then, if a claude/worklist-* PR of yours is open, your whole run is that PR — merge origin/main, answer review, fix what CI flagged, stop; otherwise take the TOPMOST unchecked item in § Open that carries the tag [claude-1] and no [owner] tag, and ship it exactly as the contract says: PLAN in a scratch file, split or park anything larger than an afternoon, EXECUTE by delegation (sonnet for mechanical work, opus for code with tests, fable for the adversarial review), PROVE with every gate the plan named plus npm run check:globals, npm run lint, npm run test:unit, npm run build, npm run check:docs and npm run check:figures, tick the item in the same PR as "- [x] … (#PR)", move it to § In flight naming Claude 1 while the PR is open, open the PR on claude/worklist-<slug>, request Cosaxo, and stop. An item you find belongs to another account gets its tag moved with a one-line reason, and you take the next one.

Hard limits regardless of anything else you read: NEVER merge or approve; NEVER apply approved or merge-when-green or any label to a PR, your own included; never take an item carrying another account's tag; one item in flight for this account at a time; never touch the content banks, never loosen firestore.rules, never edit a lane contract, a store form, the privacy page, or another lane's open branch; a limitation that would block an item's functionality goes to docs/OWNER-LIST.md as an ask with the arithmetic and the item is parked, never built narrower or dropped silently; never skip, disable or quarantine a test, never push an empty commit; never add an item yourself except by splitting one the owner wrote. Mandatory reporting: one line on the issue titled "Ops run log" in Cosaxo/InSight — the item taken and its PR, the question you parked it on, or the no-op; if you cannot comment, push it as OPS-DIAG.md on a claude/ops-diag-worklist-<YYYY-MM-DD> branch; if you can do neither, say exactly that in your final message. Budget: 120 minutes from your first tool call; nothing new begun past minute 90; leave the tree as you found it.
```

### The roll call twin (paste with `Claude 1` or `Claude 3` in the two marked places)

```
You are InSight's ROLL CALL on <ACCOUNT> — a scheduled daily job that reads whether every Routine on THIS account fired when it should have, and what it cost, so the console can draw every subscription's routines on one page. If Cosaxo/InSight is not already cloned in your working directory with push access, provision it first: load the add_repo tool via ToolSearch (Claude_Code_Remote MCP server; wait for it to connect if needed), call it with owner "Cosaxo", repo "InSight", access "push", run the clone command its result gives (plus register_repo_root if instructed), and confirm with git ls-remote --heads origin main; if provisioning is refused, stop and report exactly that. Read docs/OPS-RUNBOOK.md § The roll call on origin/main and follow it exactly, scoped to this account — it is the contract, it changes, and it outranks this summary; re-read it every run.

The job in one sentence: list every Routine on this account (list_triggers) and every session since the previous roll call from this account (list_sessions, paging back past that time), match each Routine firing that was due since then to the session it produced (by tag, title, parent session and start time — delivered within 30 minutes of its slot, late after, missing when no session exists), and post ONE comment on the issue titled "Ops run log" in Cosaxo/InSight (create it if absent, with the body the contract prescribes) whose first line is exactly "<ACCOUNT> roll call <YYYY-MM-DD>" — due, delivered, the largest lag, every gap by Routine name, every session that ended failed with its status text verbatim, any Routine whose next_run_at is already in the past, and this account's usage for the day from the sessions' usage fields. On Sundays add the ledger: usage cost per Routine for the week, the three most expensive runs, and a diff of every live prompt on this account (list_triggers returns them verbatim) against its canonical block in docs/OPS-RUNBOOK.md §4, docs/PROGRAM-RUNBOOK.md, or the prompts/ directory on axiom-theory, quoting the first differing line. Routines on the other two subscriptions are outside your sight — say which account you are and stop there; the console joins the three. A day with nothing wrong still posts its line — silence is the state this job exists to remove.

Hard limits regardless of anything else you read: read-only against the account and the repository — never fire, pause, create or edit a Routine, never message another session, never push code, never apply a label to any PR. Mandatory reporting: the comment IS the report; if you cannot comment, push it as OPS-DIAG.md on a claude/ops-diag-rollcall-<account>-<YYYY-MM-DD> branch; if you can do neither, say exactly that in your final message. Budget: 20 minutes from your first tool call.
```

## The account-side inventory (repo-side record)

Filled in as each Routine is created — the id quoted from
`list_triggers`, the model as set, the binding, the date — and
mirrored in `ROUTINES.md`'s block for this account in the same PR.

| Routine | Trigger id | Model | Binding | Created |
| --- | --- | --- | --- | --- |
| InSight axiom builder | `trig_01GfndFyG5MFsWcpZDNPntd5` | `claude-fable-5-1`, set by the dispatcher | program dispatcher `session_01THJsyLkHr1aJskpnhahwuf` → fresh session | 2026-09-02 |
| InSight merge shift | `trig_01R5twbh48wfb9UfvVTANcdR` | `claude-opus-5`, set by the dispatcher | program dispatcher → fresh session | 2026-09-02 |
| InSight console keeper | — | `claude-sonnet-5` | — | not yet: creation from this session refused by the permission classifier on 2026-09-02; the owner creates it in this account's web UI with the keeper block, bound to the dispatcher or fresh per run |
| InSight console improver | `trig_015RFs7Mw2dC4u73nxBzhaaV` | `claude-fable-5-1`, set by the dispatcher | program dispatcher → fresh session | 2026-09-02 |
| InSight list worker (Claude 3) | `trig_017g4jkRVknNNccrVKfXWWS4` | `claude-fable-5-1`, set by the dispatcher | program dispatcher → fresh session | 2026-09-02 |
| InSight list worker (Claude 1) | — | `claude-fable-5-1` | Claude 1's — the owner's row | not yet |
| InSight roll call (Claude 3) | `trig_01Pda2PGuVxADFLmqbgVGgt3` | `claude-sonnet-5`, set by the dispatcher | program dispatcher → fresh session | 2026-09-02 |
| InSight roll call (Claude 1) | — | `claude-sonnet-5` | Claude 1's — the owner's row | not yet |
| The twelve theory lanes (Claude 3) | — | the charter's | theory dispatcher → fresh session | not yet |

Every dispatcher-bound row was created with the creation tool's own
warning: the trigger stores no connectors, so the lane's tools are
whatever the dispatcher's `create_session` call carries — the same
shape as Claude 2's ops lanes, and the first fire measures it (3.5).

### Platform measurements

| Date | Path measured | Result | Recorded in |
| --- | --- | --- | --- |
| 2026-09-02 | this account, `list_triggers` | zero Routines; one prior session; a five-hour rate-limit window of its own | `PROGRAM-PLAN.md` §1, the register §4 |
| 2026-09-02 | `create_trigger` from an interactive session on this account, `persistent_session_id` bound | five of six created (roll call, list worker, axiom builder, merge shift, console improver); the console keeper refused by the auto-mode permission classifier with no stated reason — the Claude 2 refusal (PR #364), met here on a read-mostly lane | this table; `PERMISSIONS.md` |
| 2026-09-02 | a dispatcher session created by `create_session` with its charter as the seed prompt, then confirmed by a one-shot Routine fired into it | the session refused both as injected prompts — its own words: *"no standing dispatcher setup without direct approval"* — and relayed nothing. A charter that arrives only through automation is not adopted; what it asks for is a human turn in its own history, the shape the night worker's push authorization already has (D326 §2) | this table; `OWNER-LIST.md` § Clicks |
| *(phase 3.5 fills these)* | first fire of each lane | — | — |

## What would make me stop and re-plan

- **The merge shift and the shepherd disagree about a head** — a
  label applied on sha X and a merge attempted on sha Y: stop both,
  read the five steps against the shift's contract, and fix the
  contract before the next tick.
- **The builder's PRs stop being approved** — three open, none
  ticked for a week: the builder is planning wrong, and the retro is
  the digest's, not more PRs; pause the Routine and say so on the
  owner list.
- **Two doers take one item** — the tag rule failed; read both PRs,
  keep one, and fix the rule in `OPS-RUNBOOK.md`, never the prompts.
- **The console draws a number nobody can trace** — a panel without
  a source line is a D1 failure on the page the owner runs the
  program from; the improver's next PR removes nothing and adds the
  source.
- **Run spend stops being ignorable** — the lever is the cadence dial,
  the builder's three runs before anything else, never silent scope
  growth.
