# The documentation sweep

**Status: tree.** A scheduled lane that fires on odd days of the month
(roughly every second day — § The schedule has the seven back-to-back
firings a year that phrase hides) and lands one dated branch and one PR.
This page is the contract: why the lane exists, what it may prove, what it
structurally cannot, the procedure it runs, and how to turn it down or off.
It is the job, the way `docs/QUESTION-FARM.md` is the farm's job and
`docs/AXES-RUNBOOK.md` is the axes program's — so the lane's behaviour
changes by PR to this file, reviewed like anything else.
`.claude/skills/doc-sweep/SKILL.md` is a pointer at this page plus the
handful of rules a session must obey even if it can read nothing else; when
the two disagree, this page wins and the skill is the thing to fix.

## Why this exists

This repo's static gates are good, and they are cheap. They prove that
`docs/ORIENTATION.md` names every document, README, gate and directory; that
every backticked path in the map pages resolves; that every decision anchor
hits a real heading; that every decision number is claimed exactly once with
no holes; that each gate's *Where* column matches the workflows; that
`docs/DECISIONS-INDEX.md` is byte-current; and that every figure
`check:figures` has been told to hold still equals the tree.

They also say, in their own headers, exactly where they stop.
`scripts/doc-index.mjs`:

> nothing here reads whether a description is TRUE. Rule 2 asks that
> `MIRROR.md` appears in the map, not that the sentence next to it describes
> `MIRROR.md`; rule 5 checks placement, not the reason given for it. Prose
> accuracy is not a static property.

`scripts/check-policy-claims.mjs` says the same about the one file it
guards: matching a phrase proves the sentence is present, not that it is
true — and it names three claims that were all false on that page at once
while the gate would have been green.

So the residual is a specific, named shape: **a sentence that is
structurally perfect and factually stale.** Four live examples, each of
which survived every gate on 2026-08-30.

- **D331 removed `anon` from the profile allowlist and added `consent`.**
  `docs/SCHEMA-V2.md` — the file `docs/ORIENTATION.md` sells as holding
  every field in the core loop — still names the removed key at line 80 and
  has never named the added one (`grep -c consent docs/SCHEMA-V2.md` prints
  0, while `firestore.rules`' `v2_users` allowlist carries `"consent"` and
  annotates `anon`'s removal in the comment directly above it).
  `docs/data-inventory.md`, which the store privacy label derives from, has
  no row for the field either — `check:data-inventory` holds
  **collections**, and this is a **field**.
- **D328 made `job` a real breakdown dim** through the derived `jobField`.
  `CLAUDE.md` and the code comments were corrected; `docs/MIRROR.md`,
  `docs/ORIENTATION.md`, `docs/VISION-V28.md` and `docs/FEATURE-COMPLETE.md`
  still say `window.MapStats` refuses for five anchors because profession is
  free text. `docs/FEATURE-COMPLETE.md` files the now-fixed item under
  *Decided no — do not re-plan*, which actively suppresses the correction.
- **D333 deleted the v1 scheduled aggregators.** `docs/DEPLOYMENT.md`
  records the deletion in its header block and, hundreds of lines later,
  proposes alerting on the same two functions in the present tense.
- **`docs/PEOPLE-MAP.md` §3 is headed BUILT (D214)** and documents three
  function names and a constant value that `src/v2/data/peopleMap.ts` does
  not export.

The shape is consistent enough to be a heuristic: a decision lands in the
code, in `CLAUDE.md` and in the code comments, and the doc corpus lags by
one decision. That is the class this lane hunts.

## What it does, in one paragraph

It reads the commits since a watermark and asks, of each, which documented
claim it invalidated. Three detectors: new decision records, resolved
**backwards** to the predecessor numbers they reverse and grepped for those
(the D328 sites all cite D8 and D72 and not one cites D328, so a forward
join finds nothing); exported symbols added or removed, grepped against the
doc corpus; and changed source files joined to the documents that name them,
worked lowest-fanout first. On top of that it audits exactly two documents
per run from a deterministic rotation, so drift older than the watermark is
covered at a fixed per-run cost rather than by an unbounded read. It edits
only claims a command can recompute, reports everything else, and lands one
branch and one PR.

**Where this lane stops and the night shift starts.** The night shift runs
five flows a night over the same tree, and it is not a documentation lane:
its subject is bugs, risky code and improvements in *code*, it works
`NIGHT_TASKS.md` onto a `night-YYYYMMDD` branch, and it is told in as many
words that deliberate conventions are not findings. It therefore does not
hunt the class this page is about, and the two do not overlap by
construction — but they do touch the same files, so the rule is one-way:
**this lane never edits a file the current night branch has open commits
against.** Check with `git log origin/main..origin/night-<date>` in Phase 0
and drop any candidate whose file appears there; the night shift pushes
several times an hour and this lane cannot win that race. A finding this
lane drops for that reason is reported like any other, not discarded.

## What it cannot catch, so the next reader does not assume more

- **A claim about a REASON.** The most expensive class here and the least
  gate-reachable: the claim is still true and its stated justification
  stopped being true. D328's "profession is free text" blocked a feature for
  months in four copies. D130's `USER_ID` attestation said "The Firebase
  uid." in a build shipping public handles. The lane *reports* one of these;
  it may not edit it, because deciding a reason expired is judgement and
  this lane has no standing to exercise judgement unattended.
- **Which side is wrong.** When a document and the code disagree about
  behaviour and each is internally consistent, the lane edits neither and
  quotes the pair. Editing the document would enshrine a bug in the code,
  and nothing static here can tell the two apart.
- **A `tree` / `mixed` / `past` Status marker.** `check:docs` rule 7
  compares plan-versus-not-plan only, and skips entirely every document that
  declares no Status line — so a wrong marker passes CI in either direction.
  The lane never changes one.
- **Anything on the deploy path.** A merge touching `functions/`,
  `firestore.rules`, `firestore.indexes.json`, `storage.rules`, `web/` or
  `firebase.json` applies rules and functions to production, comment-only
  edits included. A typo must not be able to deploy, so those are
  report-only whatever the finding's quality.
- **A promise, and a claim wearing a word count.** `web/privacy.html`, the
  store forms and the three read-denies are three of `CLAUDE.md`'s four
  things outside the D334 ask — meaning the owner cannot decide them away,
  **not** that the lane stays quiet about drift in them. The lane reports
  there like anywhere else on the no-go list; the page moves first and
  `check:policy-claims` is what proves it. Separately, `docs/COPY.md` §3
  names three things the owner's copy rule does not license shortening away
  — a consent or disclosure clause, an honesty qualifier that names a limit,
  and the blunt public-answers sentence. Those are claims, not captions, and
  the lane may not touch them in either direction.
- **Drift older than the watermark, quickly.** The change lane cannot see it
  by construction. The two-document rotation gets there eventually — under
  two months for a full cycle at the current cadence — and that is the
  deliberate trade: bounded per run beats complete per run, because an
  unbounded run stops being trustworthy at whatever point it ran out of
  budget.

## The two rules that are inverted here, and why

**A green gate is not evidence.** Everywhere else in this repo, a gate going
red to green is the proof a change was needed and worked. This lane's whole
subject is the complement of the gate surface, so every correct edit it
makes is green on both sides. Its evidence is a recomputation command and
its literal output, recorded in the PR body beside the doc line it
contradicts. The gates are the lane's *regression harness*, never its
evidence, and the acceptance test is a **diff of the gates' printed census
numbers**, not their exit codes — because a gate can stay green while
silently ceasing to check. Measured: an unbalanced block-comment opener
inside a line comment blanked 115 code lines from `check:globals` while it
printed OK, and dropped a callable from `check:appcheck`'s census while it
also printed OK.

**A stale count is not fixed by typing the right one.** Typing a fresh
hand-maintained number *is* the drift class, not the remedy —
`scripts/check-figures.mjs`' own header records four instances, one of them
inside the paragraph warning against it. So the lane registers the number in
that file and lets the gate compute it, proved both ways in the same commit:
plant the wrong value, confirm the gate fails and quotes the correction,
restore. At most one such entry per PR, as its own commit, because D336
measured two conflict-free edits to different regions of that file merging
cleanly into a gate that threw before it checked a single figure.

---

## The procedure

A fresh session with no context runs this top to bottom. `CLAUDE.md` is the
conventions and the traps and is not optional; several rules below are only
survivable because it explains them.

### Preconditions

- The container **starts empty and its git is read-only until provisioned**
  (measured 2026-08-25, `docs/AXES-RUNBOOK.md` § The account-side
  inventory). Provision first, exactly as the axes lanes do: load `add_repo`
  via ToolSearch, call it with owner `Cosaxo`, repo `InSight`, access
  `push`, run the clone command its result gives, and `register_repo_root`
  if instructed. **If provisioning or a push is refused, stop and report
  exactly that** — a run that cannot push cannot do this job, and spending
  fifty minutes before discovering it is the failure that cost this program
  about $65 once already.
- `git status --porcelain` prints nothing, and
  `git rev-parse -q --verify MERGE_HEAD` prints nothing. In a fresh clone
  both are formalities; they are asserted anyway because the lane may one
  day be rebound to a shared checkout, and because a stranded merge state is
  the one thing a previous run could leave behind. If either is non-empty,
  log it and exit — **never stash and never revert a file this run did not
  write.**
- `npm ci --no-audit --no-fund` succeeds. Invoke it with those flags: the
  permission allowlist entry is `Bash(npm ci *)`.
- `git fetch origin` succeeds. If it does not, log the command and its
  output verbatim and exit — a range computed against an unrefreshed ref
  fails silently, which is the worst shape a range error can have.
- The evidence gates below are green on `origin/main` before anything is
  edited. If one is already red, the tree arrived broken: the lane did not
  break it and **does not repair it.** Record it verbatim and continue only
  with classes that gate does not touch.

### Shell surface, and the clock

Allowlisted: `git`, `cd`, `mkdir`, `ls`, `cat`, `head`, `tail`, `wc`,
`grep`, `echo`, `jq`, `node`, `npm ci *`, `npm run *`.

**Not** allowlisted, and each will prompt with nobody to answer: `sed`,
`awk`, `find`, `diff`, `sort`, `uniq`, `cut`, `xargs`, `npx`, `curl`, `env`,
`date`. Slice large files with the Read tool's `offset`/`limit`, search with
Grep, enumerate with Glob.

**Two tools are also missing from the list, and this lane is written around
that rather than waiting on it.** `.claude/settings.json` allows `Agent` but
not `Skill` and not `Workflow`, so a run must **read
`docs/DOC-SWEEP.md` directly** rather than invoking `/doc-sweep`, and must
fan out with parallel `Agent` subagents rather than a workflow script.
Both paths reach the same procedure — the skill is a pointer at this file,
and the detectors are independent either way — so the lane is not degraded,
only routed. Adding `Skill` and `Workflow` to the allowlist would let the
run take the shorter path; until somebody does, **an unattended run that
invokes either will hang on a prompt nobody answers**, which is the failure
this paragraph exists to prevent. The gap is deliberate on the tooling side:
the allowlist is hardened by omission, and widening it is the owner's act,
not a lane's.

**There is no `date`, so the clock is node.** The phase budgets below are
enforceable only if the run measures them: record
`node -e "console.log(Date.now())"` as T0 in the first minute, and at every
phase boundary run
`node -e "console.log(Math.round((Date.now()-T0)/60000))"` with T0
substituted. A budget nobody measures is decoration.

**Never pipe a gate into `tail` or `head` and branch on `$?`.** Measured
here: `false | tail -1` exits 0, and a genuinely failing suite was observed
reporting exit 0 through exactly that pipe. Run gates unpiped and read their
printed census line.

### Phase 0 — arm (minutes 0–4)

Provision, then:

```
git fetch origin
git status --porcelain
git rev-parse -q --verify MERGE_HEAD
npm ci --no-audit --no-fund
node -e "console.log(new Date().toISOString().slice(0,10))"
git rev-parse --abbrev-ref HEAD
```

Record the current branch name. **Do not cut the sweep branch yet** —
Phase 6 does that, after there is something to put on it, so an aborted run
leaves the checkout exactly where it found it.

List open pull requests whose head branch starts `claude/doc-sweep-`.

- **If three or more are open and unmerged, stop editing.** Run the
  detectors, report everything on the run log, open no PR. D335 named
  review/merge latency — not fix production — as this program's actual
  bottleneck, and a fourth queued branch makes the identified problem worse.
  Say so in the log.
- **Otherwise record their head branch names.** Every candidate is checked
  against them in Phase 5 so the lane never fixes a line another open PR
  already fixed. `git show origin/<head>:<path>` reads a file off an
  unmerged branch without checking it out.

### Phase 1 — baseline census (minutes 4–7)

Run each of these **unpiped, individually**, and copy the whole printed
census line into scratch notes. Do not type any of those numbers into a
file.

```
npm run check:docs
npm run check:figures
npm run check:globals
npm run check:labels
npm run check:public-copy
npm run check:policy-claims
npm run check:data-inventory
npm run check:store-forms
npm run test:scripts
```

The eight gates together cost about two seconds; `test:scripts` costs about
eleven. There is no cost argument for skipping any of them.

**`check:bundle` is the one gate to leave alone** — it refuses to grade
without a prior build, and this lane never builds. `check:web-firebase`
refuses the same way but exits 0 with an informational line, so it is
harmless rather than forbidden; `check:fn-runtime` grades fully with no
build but is a backend gate that says nothing about prose. **Never touch**
`web/.well-known/assetlinks.json` to green `check:store-copy`: that gate is
red by design on a Play signing hash that cannot be guessed, and is kept off
CI on purpose.

The census just written down is the only "before" side this run gets.
Phase 7 accepts on a diff of those numbers, not on exit codes.

### Phase 2 — resolve the range (minutes 7–9)

**The watermark lives in the run-log issue, not in the tree.** The newest
comment on the `doc-sweep run log` issue that carries a fenced `json` block
tagged `doc-sweep-state` is the state; read it with the issue tools. It
holds four fields:

```json
{
  "doc-sweep-state": 1,
  "lastSweptSha": null,
  "skippedPastSha": null,
  "backlogCursor": 0,
  "docAudit": {}
}
```

It is off-repo on purpose, and the trade is written down rather than
discovered: a committed watermark only advances on a run that lands a
commit, and this lane's own declared-normal outcome is a run that lands
nothing — so a committed watermark would stay frozen through exactly the
runs it exists to track, the range would grow until it hit its own cap, and
the backlog rotation would re-audit the same two documents forever. The run
log is written on **every** terminating run, empty and aborted included, so
the state advances whenever the range was actually swept. The cost is that
the state is not visible in `git log`; the run log is where to look, and
this repo already treats an issue as a lane's real record rather than the
trigger's telemetry.

Then resolve the base:

- **`lastSweptSha` is null (bootstrap).** Do not sweep history. Pick
  mechanically, not by eye: take the oldest first-parent commit on
  `origin/main` whose author date is on or after (today − 2 days), computing
  that boundary date with `node -e`, and print the chosen SHA and its date
  into the run log so the choice is auditable.
- **`lastSweptSha` is set.** Prove it is usable before trusting it:
  `git cat-file -t <sha>` must print `commit`, and
  `git merge-base --is-ancestor <sha> origin/main` must exit 0.
- **Unreachable** (the clone is shallow). `git fetch --deepen 50 origin main`,
  up to three times.
- **Still unreachable, or the range exceeds 400 commits / 250 changed source
  files.** Cap it to the most recent 250 changed files and record in the PR
  body, the run log and `skippedPastSha` *which SHA the run skipped past*. A
  range that did not fully run is named as unrun, never claimed.

**Never use a date-relative revision.** The clone is shallow and its reflog
is empty, so `origin/main@{2 days ago}` and `@{4 days ago}` return the
identical list — a wrong range that fails silently.

### Phase 3 — the three detectors (minutes 9–24)

Each produces *candidates*, never findings. A candidate is a doc line quoted
as `file:line` plus a tree fact.

**A · Reversed decision — highest yield, run first.**

```
git diff <BASE>..origin/main -- docs/DECISIONS.md | grep -E '^\+## D[0-9]+'
```

For each new or amended record, find its line in `docs/DECISIONS-INDEX.md`
(grep for the record's row) and read only the record's first ~40 lines with
the Read tool's `offset`/`limit`. Extract the **predecessor** numbers it
cites — records here name what they reverse in their opening lines.

**Then grep the doc corpus for the PREDECESSOR number, not the new one.**
That inversion is the whole detector.

**B · Symbol churn.** From
`git diff -U0 <BASE>..origin/main -- src functions/src scripts`, pull added
and removed `export const|function|class|interface|type` names and changed
SCREAMING_CASE constants, and grep the doc corpus for each. A removed export
is **not** by itself drift — it may have been renamed, moved or made
private, and Phase 5 requires knowing which. This is the only mechanical
answer to pointer-precision drift, which `check:docs` rule 6 cannot reach:
it resolves backticked *paths* and never symbols.

**C · Changed file joined to the docs that name it, ranked by inverse
fanout.** For each changed source file, count how many docs name its path;
work the **low-fanout** pairs first and take nothing above fanout 3. A file
named by thirty docs is named generically; a file named by exactly one doc
is where the drift lives — `src/v2/data/peopleMap.ts` to
`docs/PEOPLE-MAP.md`, `src/v2/data/cohort.ts` to `docs/MIRROR.md`. Compute
the fanout live in **one** `node -e` invocation that reads the changed-file
list and greps the corpus itself; two hundred sequential `grep` calls is not
a shape this permission surface is built for, and a stored fanout table
would be a hand-maintained figure, which is the error this lane exists to
hunt.

### Phase 4 — the backlog rotation, exactly two documents (minutes 24–32)

The rotation is over the auditable pages: every `docs/*.md` except
`DECISIONS.md` and `DECISIONS-INDEX.md`, plus `CLAUDE.md`, `README.md`,
`SECURITY.md`, `.github/pull_request_template.md` and the gated READMEs,
sorted by path so the order is deterministic and indexed by
`backlogCursor`.

**Skip rule.** Skip a slot if `docAudit[doc]` is set and neither the
document nor any path it names has changed since that SHA; advance the
cursor and take the next. Examine at most eight slots to find two auditable
documents; if all eight skip, that is a legitimately quiet corpus — record
it and spend the budget on Phase 3.

**Oversize documents are audited by section, not skipped.** Eleven pages are
too large to read whole (`DECISIONS.md`, `DECISIONS-INDEX.md`,
`LAUNCH-RUNBOOK.md`, `QUESTION-FARM.md`, `COSTS.md`,
`NEXT-FUNCTIONALITY.md`, `SHIP-CHECKLIST.md`, `DEPLOYMENT.md`,
`data-inventory.md`, `SCHEMA-V2.md`, `VISION-V28.md`). For one of those, the
slot audits a single `##` section, and `docAudit` records the document and
the section index so the next visit takes the next one.

**Do not read a document blind.** Use the citation-graph probe: extract the
`D\d+` citations, look them up in `docs/DECISIONS-INDEX.md`, and read only
those whose *Cited later by* column names a record far newer than the cited
one. That turns "read a document" into "check a handful of citations", and
it is the probe that surfaces D72 to D328. Budget it honestly: an oversize
page carries anywhere from twenty-five to ninety distinct citations, so on
those take the ten most recently added by DECISIONS.md line offset and say
in the run log that the probe was capped.

### Phase 5 — adjudicate (minutes 32–35)

Every candidate needs **four things** before it can be anything but a
finding. All four go in the PR body verbatim.

1. **The doc claim** — `file:line` plus the sentence quoted.
2. **The tree fact** — a `file:line`, or an allowlisted command and its
   literal stdout.
3. **Which side is DERIVED.** A generated artifact is never the authority;
   its generator is.
4. **The causing commit** — SHA plus subject — or the backlog slot that
   produced it. If neither, the candidate is a finding, never an edit.

**The adjudicator ladder — what makes the tree outrank the prose.**

- **A1 — a green test assertion that PREDATES the causing commit pins the
  code fact.** The predating clause is load-bearing: a rename lands with its
  own test renamed in the same diff, so a same-commit test is not
  independent evidence and does not lift a candidate above A0.
- **A2 — a generated artifact plus its generator**, generator as authority.
- **A3 — a gate computes the value**: a `check:figures` entry, a
  `check:globals` census number, `scripts/gate-placement.mjs`.
- **A4 — a second, more recently touched map page agrees with the code
  against the stale one, AND a decision post-dates the stale claim.**
- **A5 — a decision record explicitly reverses the claim and the code
  implements it.** Any anchor written must be COPIED from
  `docs/DECISIONS-INDEX.md`, never composed: records get renumbered on merge
  and a hand-written anchor is likely a 404.
- **A0 — the code fact is bare.** No predating test, no gate, no generator,
  no decision, no corroborating doc. **A0 is terminal.** Bare code does not
  outrank prose. Report it; do not edit it.

**The seven defences — try to save the sentence before changing it.** Work
them in order and write down which was tried and why it failed. A candidate
survives only if all seven fail.

1. **Referent.** Does the subject range over a smaller set than was counted?
   This defence alone saves `CLAUDE.md` §1's "Four of them are deferred past
   first paint via `loadWorldFeed()`" — that function awaits thirteen
   modules, but "them" ranges over an unstated set and a mechanical 4→13
   would write a *new* false sentence. It saves `firestore.rules`' header
   the same way: it enumerates three surviving denies as categories, and
   `allow read: if false` appears at four paths of which one is not among
   them, so the count depends entirely on what "a deny" means. **When the
   referent is ambiguous the defence succeeds and the candidate is
   report-only, however clean the arithmetic looks.**
2. **Tense.** Past tense, a tombstone, a provenance header, a struck
   reversal, or a Measured/Verified/Probed record. D106's standing rule is
   the test: a claim that was historically true is **kept and marked as
   history**; a claim presented as current is replaced by what the code
   does; nothing is deleted silently. Hundreds of comment lines here
   describe code that no longer exists on purpose, and nearly every spec
   file cites prototype files deleted in 2026. **Absence of the referent is
   not evidence of staleness.**
3. **Status.** The document is `plan` or `past`, or the sentence sits in a
   `mixed` document outside a section that document's own header declares
   built.
4. **Direction — the enshrine-a-bug defence.** Assume the DOC is right and
   the CODE is the bug. For any candidate whose tree fact is a symbol, an
   export, a path or a `window` member, **read the causing commit**
   (`git show <sha>`) and require that its message, or a decision record,
   states the change as intended. A commit that moved the doc's referent and
   its test together with no stated intent leaves the candidate report-only
   whatever rung it reached.
5. **Adjudicator.** Is the tree fact actually A0 wearing a better rung?
6. **Blast radius.** Is the target in the no-go list? Would the edit change
   what the app claims about who can read what, or touch a `docs/COPY.md` §3
   claim? A privacy-shaped finding is a D334 **ask to the owner in both
   directions** — do not fix it and do not drop it.
7. **Collateral.** Would the *wording* break something that reads the
   sentence's shape? A `check:figures` regex with deliberate whitespace
   handling for line wraps; a comment that is the sole thing keeping a
   published global alive under `check:globals` rule 5; a
   `docs/ORIENTATION.md` row's exact first-cell lookup key; a `**Status:`
   line's position inside a document's first fourteen lines. Before removing
   any user-facing sentence, run `docs/COPY.md` §4: grep it in the tests,
   ask whether `firestore.rules` or a Cloud Function enforces it, and check
   `web/privacy.html`.

**Editable** — a claim a command can recompute: a count, list membership, an
identifier, a path, a line-number citation, a markdown link target, a
section citation, a gate's placement, a decision anchor.

**Report-only, always** — a stated REASON, an intent or a trade-off; a
Status marker; anything privacy-shaped; a `docs/COPY.md` §3 claim; a count
the tree cannot cheaply recompute (quote the line, quote the source of
truth, and let the owner decide between a literal `check:figures` entry and
a rewording); and any doc-versus-code disagreement where both sides are
internally consistent.

Finally, drop any candidate an open `claude/doc-sweep-*` PR already fixes,
into an "already queued" list.

### Phase 6 — edit (must BEGIN by minute 35)

Cut the branch now, not earlier:
`git checkout -B claude/doc-sweep-<UTC-DATE> origin/main`.

**No new edit begins after minute 35.** Edits in flight finish; Phases 7 and
8 own the rest. One defect per commit.

Order cheapest-risk first: link targets and section citations → line-number
citations → symbol and path citations → list membership → counts.

**A count is never retyped.** Register it as an entry in
`scripts/check-figures.mjs` so the gate computes it off the tree, and prove
it both ways in the same commit: plant the wrong value, confirm the gate
fails *and quotes the correction*, restore, confirm green. If
`check:figures` was already red and printed a replacement string, that
printed string verbatim is the only licensed numeric edit. If the count has
no cheap static recomputation, it is report-only — inventing a computation
into a gate script to satisfy this rule is worse than the stale number.

**At most one `check:figures` entry per PR, in its own commit.** If another
open PR touches `scripts/check-figures.mjs`, do not land the gate edit at
all — put the diff in the PR body as a proposal naming the branch it must
compose with.

**The pair rule.** When one claim lives in two places — a doc sentence and a
source comment stating the same set, two rows of one table, or a sentence
`.github/pull_request_template.md` and `CLAUDE.md` both make — fix every
instance in the same commit or none. Fixing half manufactures a fresh
cross-source contradiction, which is the same defect pointed the other way.
Where one of the instances is on the deploy path or otherwise no-go, the
whole pair is report-only.

**Correct in place and keep a one-line record of what it said**, which is
this repo's own precedent: `CLAUDE.md` §1's convention example carries the
note that it named a different pair until D210 and was false. A silent swap
destroys the finding. Never delete a superseded sentence: keep it and mark
it as history.

Never re-wrap a line not otherwise being changed — a re-wrap can break a
`check:figures` regex and can push a `**Status:` line past the fourteenth
line, silently disabling `check:docs` rule 7.

**The source-comment carve-out.** Source comments are report-only, with
exactly one exception: **at most one comment edit per run**, only under
`src/` or `scripts/`, only a count, and only when the identical count is
being fixed in a document in the same PR — the paired half of the pair rule.
Never in `functions/` and never in `firestore.rules`, both of which are on
the deploy path.

Taking the carve-out adds `check:a11y`, `check:purge`, `check:touch-zoom`,
`check:tap-targets`, `npm run lint` and `npm run test:unit` to Phase 7, and
these absolute rules:

- **Never write the two characters that open a block comment inside a line
  comment.** `scripts/strip-comments.mjs` runs its block regex first and
  non-greedily, so it blanks everything to the next close. Name a file in
  full rather than writing a glob. It is imported by `check:labels`,
  `check:appcheck`, `check:purge` and `scripts/spec-globals.mjs`, which also
  seeds eslint's spec-layer `no-undef`.
- Never touch a line containing `eslint-disable`, `@vitest-environment`, a
  ts-expect-error directive, an edit-mode marker or a generated-file banner
  — and do not reflow the block **above** an `eslint-disable-next-line`,
  which shifts what it covers.
- If a gate reds after a comment edit, **revert the comment.** Do not act on
  the error text; it will tell you to delete live wiring. Never answer an
  eslint `no-undef` on a spec-layer global with an eslint exception — the
  scanner is the thing to fix, and reverting is what a sweep does.

If `src/v2/README.md` is touched, its figures are split four ways:
`check:globals` owns the coupling count, `check:a11y` the suppressions,
`check:panel-suites` the one-suite-each claim, and `check:bundle` the bytes.
A bundle figure there is report-only for this lane, because `check:bundle`
needs a build this lane never runs.

### Phase 7 — verify, then compose (minutes 35–45)

Unpiped: the eight gates from Phase 1, plus `npm run test:scripts` always.
Add `npm run lint`, `check:a11y`, `check:purge`, `check:touch-zoom`,
`check:tap-targets` and `npm run test:unit` if and only if the
source-comment carve-out was taken.

`npm run test:scripts` is mandatory whenever anything under `scripts/`
changed, `check:figures` entries included. It hides on CI's lint job while
`npm run lint` locally is eslint alone, and it has shipped breakage three
times. Reporting "lint passes" from `npm run lint` is the documented
failure.

**Acceptance is the census diff.** Every number from Phase 1 must be
unchanged unless this run intended to move it and can name why. A number
that moved with nobody intending it means something invisible broke —
revert that hunk. **Never move a ratchet baseline** or a debt list to clear
a red: a red ratchet in a docs sweep means the sweep broke something.

If a timing test fails, **re-run it alone** before reporting it. Never call
it a flake — a debouncer regression looks identical under load, and the way
to tell them apart is to re-run, not to reason.

Then compose, because a clean merge is not a working merge — D336 measured
two conflict-free edits to different regions of one gate script merging into
a gate that threw before it checked anything:

```
git merge --no-commit --no-ff origin/main
git rev-parse -q --verify MERGE_HEAD
```

If `MERGE_HEAD` exists, re-run `check:docs`, `check:figures`,
`check:globals` and `test:scripts` **on the composed tree**, record both
census sets, then `git merge --abort`. If it does not exist the merge was a
no-op (the usual case when `origin/main` has not moved) — say so, and do not
call `git merge --abort`, which fails when there is no merge in progress.
**Never complete the merge and never push it — the owner merges.**

`git diff --stat` and enforce the bounds; then
`git diff --name-only origin/main` and check every path against the no-go
list. A hit aborts the PR. Overflow goes to the PR body, never into a wider
PR.

### Phase 8 — land (minutes 45–50)

**Commit shape** — one defect per commit, matching the house convention or
it reads as foreign:

```
The map said two lazy groups over a file that exports three

docs/ORIENTATION.md named `loadWorldFeed` and `loadOverlays` and called
them "the two lazy groups"; spec-index.js has exported loadMapTab since
v28 §5, and CLAUDE.md already documents it — so the map contradicted the
conventions file on a fact one of them enumerates.

Nothing could see it: check:docs rule 6 resolves the backticked path
`src/v2/spec-index.js` and stops there — it reads paths, not exports.

Caused by <sha> <subject>. Measured rather than reasoned:
`grep -c "^export const load" src/v2/spec-index.js` prints 3.

<the gates' census lines as printed in THIS run>

Risk: safe
```

Quote the census lines as they printed in this run. Do not copy a census
number out of this page or any other document: a number typed from memory is
the drift class this lane exists to hunt, and writing one here would make
this page its own first finding. Then the trailers this repo uses.
`Risk: safe` for a recomputable-claim fix; `Risk: review carefully` for
anything touching a `scripts/*.mjs`.

**PR.** Push the dated branch and open one PR against
`.github/pull_request_template.md`. Tick only the gates actually run. Skip
the access-surface block **with its stated reason**: "docs and comments
only; no rules, schema or function changes — nothing on
`firebase-deploy.yml`'s paths list". The template's Decisions checkbox is
answered by pointing at § The record this lane owes below and by listing
every report-only finding in the body — a lane finding is a report, not a
deferral the lane took. Add four sections the template does not have:

- **EVIDENCE** — the four-part record per landed hunk, plus the adjudicator
  rung and the seven defences with why each failed. The reviewer audits the
  reasoning, not the diff; that is what makes review minutes rather than an
  evening.
- **FOUND, NOT FIXED** — every report-only finding, grouped by why:
  ambiguous referent · bare code (A0) · plan/past document · no-go path ·
  D334 owner ask · doc-vs-code direction unresolved. A D334 item carries
  what would be exposed, to whom, which of `CLAUDE.md`'s four exempt things
  it touches, the smallest shape that keeps the value, and what each costs.
- **COMPOSE BEFORE MERGING** — any other open branch touching the same
  files, and the composed-tree census if a merge actually occurred.
- **UNRUN** — every check that did not run, and why. A check that did not
  run is named as unrun, never claimed.

**Run log, every run, no-ops and aborts included.** The lane's run log is
the GitHub issue titled `doc-sweep run log`, the sibling of the farm's #31
and the axes program's #290. If it does not exist, open it once with a body
pointing at this page, and say in the first comment that this run created
it. Every run comments with: the range as `SHA..SHA` (never as a date
range), per-detector candidate counts, what was fixed, what was reported,
which checks did not run, the PR link, **and the updated
`doc-sweep-state` JSON block.** If GitHub tools are unavailable, push the
same report as `DOC-SWEEP-DIAG.md` on a `claude/doc-sweep-diag-<date>`
branch, the farm's and the axes program's fallback; if neither is possible,
say exactly that in the final message. From outside, correctly idle and
silently broken are the same thing.

**Return the checkout.** On every exit path — landed, empty, aborted —
check out the branch recorded in Phase 0 and delete the sweep branch if it
was created and not pushed. `git branch -d` refuses to delete the branch
that is checked out, so the order is check-out-first, delete-second.

**Never merge.** `mcp__github__merge_pull_request` is deliberately absent
from `.claude/settings.json`, so a merge attempt hits a permission prompt
and an unattended run has nobody to answer it. That is the mechanism, and it
is a prompt rather than a denial — the file hardens by omission because it
reaches every session in the repo, and the farm's D212 self-merge is a
different program's contract. Never push to `main`, never touch a branch
this run did not create, and **never append a numbered decision record**:
numbers are claimed on branches and have collided three times in two days,
with two records numbered D297 passing every gate. Findings go in the PR
body; numbering a decision is the owner's act.

**Nothing found is a successful run.** Push nothing, open no PR, return the
checkout, post the run-log comment with the range, the counts and the
advanced state block, stop. This tree is drift-hunted nightly; anything a
name-level or count-level gate can see is already clean, so an empty run is
the gates working. Do not convert an empty run into a marginal edit to
justify the firing.

---

## The no-go list — report, never edit

Checked as defence 6 before any edit, and again against
`git diff --name-only origin/main` before the PR.

- **`functions/`, `firestore.rules`, `firestore.indexes.json`,
  `storage.rules`, `web/`, `firebase.json`** — `firebase-deploy.yml`'s
  paths list. A merge touching any of them applies rules and functions to
  **production**, comment-only edits included.
- **`docs/DECISIONS.md`.** Not a figure, not a typo, not a number that looks
  wrong. A record's arithmetic is the state at the moment it was taken, so a
  figure going stale there is the record working. Both figure gates exclude
  it on purpose and neither will stop an edit.
- **`docs/DECISIONS-INDEX.md`.** Generated and byte-compared. The only legal
  change is `npm run build:doc-index`.
- **`web/privacy.html`, `docs/STORE-FORMS.md`, `design/store/`.** Published
  legal and store claims; the store listing is already live on App Store
  Connect.
- **Every generated artifact**: `functions/src/v2content.ts`,
  `functions/src/pricing.ts`, `content/learn-sample.json`,
  `content/daily-questions.json`, `content/provenance.json`,
  `content/scorecard.json`, `public/cities.txt`, `public/pokedex.txt`,
  `public/elements.txt`, `src/v2/data/pokedex.ts`,
  `src/v2/data/elements.ts`, `src/v2/data/places.ts`.
- **`design/standalone-*`, `design/spec-modules/`,
  `firestore.rules.v1-archive`.** Frozen reference. Being stale is correct.
- **Every ratchet baseline and debt list.**
- **`docs/ORIENTATION.md` §5's Where cell** — computed by
  `scripts/gate-placement.mjs` from the workflows. A hand-corrected value
  fails CI for whoever writes the truth.
- **`docs/ORIENTATION.md` §4 Status cells, and any Status line in a
  document header.** Rule 7 compares plan-versus-not-plan only, so a wrong
  marker passes CI and misleads the next reader — which §4's own preamble
  calls the most expensive mistake that page can cause.
- **Any document whose Status is `plan` or `past`.** Being ahead of the tree
  is what they are for. In a `mixed` document, edit only inside a section
  the document itself declares built.
- **`docs/COPY.md` §3's three protected classes**, in the document and
  wherever the app says them.

## Bounds — all hard

**Per PR:** at most 8 files changed · 150 net changed lines · 40 changed
lines in any one file · 5 hunks in any one file · 1 comment edit ·
1 `scripts/check-figures.mjs` entry.

**Per run:** read at most 25 files · never read a file over 60 KB whole ·
at most 12 change-lane candidates adjudicated · exactly 2 backlog slots ·
range capped at 400 commits / 250 changed files · 50-minute wall clock · no
new edit after minute 35.

The bound is argued from the **single human reviewer** — `.github/CODEOWNERS`
assigns everything to one person, with code-owner review deliberately
disabled — never from CI cost. CI here is under ten job-minutes of free
public-repo runner time, so a cost argument from CI would rest on a false
premise.

## Stop conditions

- Provisioning refused, or `git push` refused → report exactly that and
  exit. Do not start the job.
- Tree dirty, or `MERGE_HEAD` present, at Phase 0 → log and exit. Never
  stash another lane's work.
- `git fetch origin` fails, `npm ci` fails, or any allowlisted command
  returns a permission error → log the command and output verbatim and
  exit. There is nobody to answer a prompt.
- An evidence gate is red on `origin/main` before any edit → report
  verbatim, open no PR, let the owner or the night lane own it.
- Three or more `claude/doc-sweep-*` PRs open → detectors only, no edits,
  escalate on the run log.
- Remaining context cannot cover Phases 7 and 8 → stop editing immediately
  and go straight to verify-and-land. Half a pair-rule edit is the one thing
  the pair rule exists to prevent.
- Any bound reached → stop the edit lane, verify, land what is staged, list
  the overflow in the PR body.
- Minute 35 → no new edit. Minute 50 → land what is verified or push
  nothing.
- A gate reds after an edit and the cause is not immediately obvious →
  revert the hunk. Do not debug it at minute 48.
- Zero candidates survive → open nothing, log everything.

Every one of these paths still returns the checkout and still comments on
the run log.

## The schedule

The Routine fires `17 8 */2 * *` UTC and spawns a **fresh session per
firing** (`create_new_session_on_fire`), which is the one place this lane
departs from the twelve that came before it. They are dispatcher-bound —
each firing wakes the persistent *Axiom dispatcher* session, which forwards
the lane prompt onward. This lane is not, and the reason is measured rather
than stylistic: that dispatcher is configured `claude-fable-5` and was
found in a failed state on 2026-08-30 (`You've reached your Fable 5 limit`),
and a Routine bound to a persistent session inherits **that session's**
model until the binding clears. Binding here would therefore have silently
delivered a Fable session to a lane the owner asked to run on Opus, and
would have parked it behind another lane's rate limit. A fresh session takes
the Routine's own model instead, so the model is a field somebody can read
and change rather than a property inherited from a neighbour.

What the dispatcher bought the other lanes, this lane has to buy for itself:
a cron-spawned container starts empty with read-only git, so **provisioning
is the first phase and a refusal to provision ends the run** — Phase 0 and
the Preconditions above are that cost, and they are why the prompt carries
the `add_repo` instructions verbatim instead of assuming a checkout.

The consequence for the rest of this page: **the lane shares a checkout with
nothing**, so the dirty-tree precondition is a sanity assertion rather than
a collision guard, and the hour is chosen for the owner's clock, not for
file contention.

**The hour.** 08:17 UTC is 10:17 in Oslo under CEST and 09:17 under CET.
There is no cron that is 09:00 Oslo year-round, and the brief carried two
constraints — fire at 09:00 Oslo, and stay inside a 09:00–11:00 Oslo window
— that a fixed UTC cron cannot both satisfy. 08 UTC satisfies the window on
all 186 firings a year and lands on 09:17 for the 79 of them in CET. The
alternative, 07 UTC, is the literal hour for the 107 CEST firings and
08:17 Oslo — outside the window — for the other 79. The satisfiable
constraint won; changing to `17 7 */2 * *` is one field, and the arithmetic
is here so nobody redoes it.

**The minute.** `:17`. The neighbours that could actually contend are the
other Routines, because everything on GitHub Actions or Cloud Scheduler
runs somewhere else entirely and cannot touch a session: the farm block
holds 07:00, 08:00, 09:00, 09:30 and 10:00; the axes lanes hold 11:00 and
12:00; the theory lanes sit at :02 past 08–12 on alternating days; the night
shift holds 21:00, 23:00, 01:00, 03:00 and 05:00. `:17` collides with none
of them, and the theory lane nearest in the clock fires on even days while
this lane fires on odd ones. `:43` is the spare.

**The day field.** `*/2` in day-of-month expands from the range start, so it
fires on **odd days only** and its phase resets every month. Seven times a
common year and eight in a leap year the 31st and the 1st are both odd, so
the lane fires on consecutive days — a shortened interval, not a missed run.
Enumerated: 31 Jan, 31 Mar, 31 May, 31 Jul, 31 Aug, 31 Oct and 31 Dec each
run into the next day, plus 29 Feb in a leap year. It is chosen knowingly:
the exact alternative is a daily fire with an epoch-day parity guard, and
because each firing spins up a fresh provisioned container, 7 shortened
intervals a year is cheaper than 182 empty containers. **Never add a weekday
restriction alongside it** — standard cron ORs the two day fields rather
than intersecting them, so a weekday filter turns this into a near-daily
job.

### The account-side inventory (repo-side record)

The Routine itself — schedule, prompt, binding, enabled state — lives on the
maintainer's claude.ai account. This table is the repo-side record,
extending the farm's five in `docs/QUESTION-FARM.md` § Scheduled runs and
the three in `docs/AXES-RUNBOOK.md` § The account-side inventory; update it
whenever this lane is added, rebound, re-paced or retired.

| Routine | Trigger id | Schedule (UTC) | Run log | Binding |
| --- | --- | --- | --- | --- |
| InSight doc sweep | `trig_PENDING` | `17 8 */2 * *` — odd days, 08:17 | `doc-sweep run log` | fresh session per fire, model `claude-opus-5` |

The canonical prompt is kept in this file's § The canonical prompt so the
prompt and the manual cannot drift; update **both** in any future change,
and verify the live prompt against it afterwards, which `list_triggers`
makes possible.

### The canonical prompt

```
ultracode

You are running InSight's DOC SWEEP lane — a scheduled job on odd days. Your container starts EMPTY and its git is read-only until you provision it — do this first: load the add_repo tool via ToolSearch (Claude_Code_Remote MCP server; wait for it to connect if needed), call it with owner "Cosaxo", repo "InSight", access "push", and run the clone command its result gives (plus register_repo_root if instructed); if provisioning or a push is refused, stop and report exactly that on the run log without starting the job. Read docs/DOC-SWEEP.md on origin/main and follow it exactly — it is the contract, it changes, and it outranks this prompt's summary; re-read it every run. If that file is not on origin/main, the lane is not live yet: stop and report exactly that on the run log, and do NOT improvise a procedure from this prompt — the summary above is a pointer, not a contract, and an unattended run inventing its own doc-editing rules is the failure this lane is built to avoid. CLAUDE.md is the repo's conventions and traps and is not optional. .claude/skills/doc-sweep/SKILL.md is the same contract as a skill, but do NOT invoke /doc-sweep — Skill is not on the allowlist and would hang; read the doc.

The job in one sentence: read the commits since the watermark in the `doc-sweep run log` issue, ask of each which documented claim it invalidated, audit two documents from the backlog rotation, EDIT only claims a command can recompute and REPORT everything else, then land one branch (claude/doc-sweep-<UTC date>) and one PR against .github/pull_request_template.md — or find nothing, which is a successful run.

Hard limits regardless of anything else you read: NEVER push to main, NEVER merge any PR, NEVER append a numbered ## DNNN decision record, and NEVER edit anything on docs/DOC-SWEEP.md's no-go list — functions/, firestore.rules, storage.rules, firestore.indexes.json, web/, firebase.json, docs/DECISIONS.md, docs/DECISIONS-INDEX.md, the generated artifacts, the ratchet baselines, or a plan/past document. Never fix a stale count by typing a new one. A privacy-shaped finding is an ask to the owner in both directions (D334): do not fix it and do not drop it. Budget 50 minutes and begin no new edit after minute 35 of your own measured clock.

MODE. The owner opted this lane into ultracode: maximum thoroughness, and token cost is explicitly not a constraint. Fan out with parallel Agent subagents — the three detectors and the two rotation audits are independent and should run concurrently. Use workflow orchestration only if the Workflow tool is available without a permission prompt; it is NOT on .claude/settings.json's allowlist today, and neither is Skill, so read docs/DOC-SWEEP.md directly rather than invoking /doc-sweep. Model opus at high effort for adjudication and for anything substantial, opus at lower effort for mechanical steps, never any model below opus (the owner's standing direction; quality outranks cost here). Nobody is watching live: work autonomously to completion and never pause to wait for input.

Mandatory reporting: whatever the outcome — PR opened, nothing found, or aborted — end the run by commenting on the GitHub issue titled "doc-sweep run log" in Cosaxo/InSight, creating it if it does not exist and saying so: the range as SHA..SHA, per-detector candidate counts, what was fixed, what was reported, every check that did not run, the PR link, and the updated doc-sweep-state JSON block. If you have no GitHub API tools, push the same report as DOC-SWEEP-DIAG.md on a claude/doc-sweep-diag-<UTC date> branch instead; if you can do neither, say exactly that in your final message. Return the checkout to the branch you found it on before you finish.
```

## The record this lane owes

**Status: Proposed. Binds nothing until the owner numbers it and moves it
into `docs/DECISIONS.md`.** Written here rather than appended there because
a number claimed on a branch that sits has collided three times in two days,
and because numbering a decision is the owner's act. `CLAUDE.md`'s House
style requires that a deferral be recorded with its arithmetic; this section
is that record until it has a number.

**Rejected, with the arithmetic.**

- *A fifth night-audit flow instead of a lane.* D326 refused one on the
  grounds that about 75 of 76 landed fixes survived review across three
  reviewed nights, so more raw fix production is not where the marginal
  value sits. This lane is defensible only because it targets a class the
  audit flows demonstrably miss — a stale prose claim, which no gate reads —
  and because it stops at three open PRs rather than adding a fourth
  unreviewed branch to compose.
- *A corpus scan as the primary detector.* The doc corpus is over 3 MB;
  reading it is not bounded and never will be. Scanning also re-derives the
  identical candidate set every firing and re-litigates the same rejected
  candidates forever. Kept, demoted, as the two-slot backlog rotation.
- *A gate of its own.* Rule 4 would demand a `docs/ORIENTATION.md` row
  and a maintainer for a gate nobody asked for, and the class this lane
  hunts is by definition the class no static gate can hold. The lane's only
  licensed gate-script write is one `check:figures` entry per PR, which is
  this repo's own prescribed remedy for a count.
- *A helper script under `scripts/`.* The detectors are git and node
  one-liners with one caller; a script would be a second thing to maintain
  and its own drift source.
- *A daily fire with an epoch-day parity guard.* Exactly correct as an
  every-second-day schedule, and rejected on cost: each firing provisions a
  fresh container, so 182 empty runs a year is worse than 7 shortened
  intervals.
- *A committed watermark.* Rejected because it only advances on a run that
  lands a commit, and this lane's declared-normal outcome lands none.
- *Self-merge authority.* The farm has it under D212; this lane is asking
  for none. The inability to merge is the last human gate.

**Residual known limits.** (a) The hour satisfies the 09:00–11:00 Oslo
window on every firing and the literal 09:00 on none of them; the
alternative is one field and its cost is stated above. (b) The day field is
knowingly not every-second-day. (c) The backlog rotation takes under two
months for a full cycle, so pre-existing drift is found eventually, not
immediately. (d) The expensive class — an expired REASON — is report-only by
design, so the lane raises it and cannot close it. (e) The state lives in
the run log rather than in the tree, so it is not visible in `git log`.
(f) This page is not one of `check:docs` rule 6's map pages, so the paths it
names — including the no-go list, which is the lane's safety boundary — are
held by nothing. Adding it to that rule's `MAPS` array is one line and is
the obvious follow-up; it is left out here because it changes a gate script
and wants its own both-ways proof and its own `test:scripts` run.
(g) `.claude/skills/doc-sweep/SKILL.md` is outside every doc gate, which is
why it is a pointer rather than the procedure.

## How to change it, and when to stop it

The procedure is this file, so changing the lane is a PR against it —
reviewed like anything else and visible in `git log` afterwards. Changing
the schedule is a change to the Routine, and the reason for whatever it
becomes belongs in this section.

**The retirement condition**, shipped with the lane the way D326 §2 shipped
one for the night's closing flow. Two ways this lane stops earning its slot:

- **It keeps finding nothing.** If a full backlog cycle passes — every
  auditable page audited once — with zero editable drift and zero recurring
  classes, the corpus has caught up with the tree. Halve the cadence, then
  retire the lane. An empty run is a success; a long run of empty runs is a
  lane to turn off, not a lane to loosen until it finds something.
- **Its PRs stop being merged.** If the *found, not fixed* list grows while
  the PRs queue, the bottleneck is review latency — which D335 already named
  as this program's real cost, and which more findings make worse. The lane
  stops editing at three open PRs by rule; if that keeps triggering, retire
  it rather than widening it.

Either reversal belongs in `docs/DECISIONS.md` as a record, and a pointer to
that record belongs in this section.
