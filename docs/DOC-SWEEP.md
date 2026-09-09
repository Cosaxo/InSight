# Doc sweep — the lane that holds the prose to the tree

> **Status: the lane is LIVE and this file is its contract — but no run has
> yet completed the job.** The Routine has fired once (2026-08-31) and
> aborted correctly, because this file did not exist. The lane defers to
> this document every run, so its behaviour changes by PR here, never by
> editing the prompt alone. Same split as `QUESTION-FARM.md` and
> `AXES-RUNBOOK.md`, for the same reason.

**What this lane is for.** Every gate in this repo proves something
*structural* about the documentation: `check:docs` proves the map names
every doc, every README, every `check:*` script and every directory, and
that no backticked path in a map points at a file that is gone;
`check:figures` proves a listed number equals the tree. None of them reads
whether a **sentence is true**. `scripts/doc-index.mjs` says so in its own
header, under WHAT IT DOES NOT CHECK: rule 2 asks that `MIRROR.md` appears
in the map, not that the sentence beside it describes `MIRROR.md`. That gap
is this lane's entire subject — the sentence that was true when it was
written and that a commit since has quietly made false.

**What it is not.** It is not a writing pass. It does not tighten prose,
restructure documents, or apply `COPY.md` to anything. A lane that runs
unattended and rewrites sentences is how a repository acquires confident
fiction, and this one is built so that it cannot: see §3.

---

## 1 · The one rule

> **A sweep may EDIT a claim only when a command can recompute it. It must
> REPORT everything else.**

Everything below is a consequence of that line, so it is worth stating why
it is the line. Nobody watches these runs. An agent that may retype a
sentence has, in effect, authority to assert a fact on the repository's
behalf with no reviewer between the assertion and `main` — and its
confidence reads exactly like knowledge. When a command can recompute the
claim, the author of the new value is the command, not the agent, and the
edit is checkable by re-running it. When no command can, the agent's
opinion is all there is, and an opinion belongs in a PR body where a human
reads it before it becomes documentation.

The corollary is the one CLAUDE.md already states and this lane inherits
verbatim: **never fix a stale count by typing a new one.** A hand-typed
correction is a hand-maintained figure with a fresh timestamp — the same
error, re-committed, which is precisely the error `check:figures` exists
for. Its header counts at least four instances, two of them inside the
paragraph warning against it.

So the preferred fix for a stale number is not the number. It is **one
entry in `FIGURES` in `scripts/check-figures.mjs`**, which makes the gate
own that figure permanently. The number then updates itself and can never
go stale again. Prefer that to pasting a command's output; prefer pasting a
command's output to typing anything.

---

## 2 · The account-side inventory (repo-side record)

The Routine — schedule, prompt, binding, enabled state — lives on the
maintainer's claude.ai account, not in this repo. This table is the
repo-side record; update it whenever the lane is added, rebound, re-paced
or retired. The farm's convention, `QUESTION-FARM.md` § Scheduled runs.

| Routine | Trigger id | Schedule (UTC) | Binding | Merge authority |
| --- | --- | --- | --- | --- |
| InSight doc sweep | `trig_01E2bBC1QmYbkkHj3V96k6L1` | `17 8 */2 * *` — 08:17, odd days of the month | dispatcher session `session_01NeQGEZcneyKmf5Q4fi4PGj` ("Doc sweep dispatcher"), model `opus`, environment `env_013gTXHYYHNaKBiWe8c4gmtd` | **never merges** — the owner, always |

Created 2026-08-30, first fire 2026-08-31.

**Why dispatcher-bound, not fresh-session.** A cron-spawned fresh session
carries no MCP tool grants, so its `add_repo` call cannot run and the
container has no checkout to work in — a guaranteed no-op. This is the
measurement `AXES-RUNBOOK.md` § The account-side inventory paid ≈$65 to
take; this lane inherits its conclusion rather than repeating the
experiment. The dispatcher is a persistent session that holds those tools
and executes the prompt itself.

**Why its own dispatcher.** The pre-existing Axiom dispatcher was not
reused: it is configured `claude-fable-5` and was found failed on its own
rate limit on 2026-08-30. A shared dispatcher makes one lane's rate limit
every lane's outage.

**A property of `*/2`, not a bug, but know it.** `*/2` in the day-of-month
field means odd days *of the month* — 1, 3, … 31 — so a 31-day month is
followed by two consecutive fires. 2026-08-31 and 2026-09-01 are one such
pair. The cadence dial is the owner's (`AXIOM-THEORY.md`'s charter rule
that trigger mutation stays outside the lanes); this is recorded so a
double fire reads as arithmetic rather than as a fault.

---

## 3 · The run

**Provision first.** The container starts empty and its git is read-only
until `add_repo` attaches the repository with `access: "push"`. Clone once,
inline — the session's git proxy caps concurrent smart-HTTP operations, and
a second clone fails both. If provisioning or a push is refused, the run
**stops and reports that**, without starting the job. A run that cannot
land its work must not do the work.

**The checkout is shallow AND single-branch, so `git status` cannot tell
you whether your work is safe.** `git clone --depth 1` implies
`--single-branch`, which pins `remote.origin.fetch` to `main` alone. A
later depth-bounded fetch then drops the `origin/<branch>` ref that
`push -u` created, and the upstream link goes with it — after which `git
status` reports a fully pushed branch as unpushed with no remote. Measured
2026-08-31 on a branch GitHub already held at the identical SHA.

So **confirm a push with `git ls-remote --heads origin <branch>`**, which
asks the remote, and never re-push on `git status`'s word alone: the second
push is a no-op that hides the cause instead of fixing it. This matters
here more than in an ordinary checkout, because a run that wrongly believes
its branch is unpushed is a run that reports failure after succeeding.

**Budget: 50 minutes, and no new edit after minute 35**, measured from the
run's own first tool call. The last 15 minutes are for landing what exists,
not for starting one more thing. A sweep that runs out of clock mid-edit
leaves a half-corrected document, which is worse than the stale one it
replaced, because it now carries two vintages of claim with nothing
marking the seam.

**That clock is the run's own, and it is not the cron slot.** A
dispatcher-bound lane starts when the dispatcher is free, not when the
Routine fires: the 2026-09-01 firing was created at 08:18:13 UTC and
reached the session at 13:43 UTC, five and a half hours later. Two things
follow. Measure the 50 minutes from your **first tool call**, never from
the schedule — they are different clocks and only one of them is yours.
And do not lean on the hourly staggering `QUESTION-FARM.md` uses to keep
two lanes off one checkout: that spacing is between *fire* times, and
arrival is not fire time, so the guarantee does not transfer to a
dispatcher-bound lane. Check the tree is clean before working, and stash
or use a worktree if it is not. Nothing has collided yet; this is written
down before it does.

**Fan out.** The three detectors (§4) and the two rotation audits (§5) are
independent and should run concurrently as subagents. Adjudication — what
is a real finding, and does it fall on the EDIT or the REPORT side of §1 —
is the run's own, not a subagent's, because §1 is a judgement about
authority and it should be made once, in one place.

**Leave the checkout as you found it.** Return to the branch the run
started on before finishing. Do not disturb uncommitted work: if the tree
is dirty, stash or use a separate worktree.

---

## 4 · The three detectors

Each detector names what an existing gate already covers, so that a run
spends its budget on the part nothing else can see.

### 4.1 · Invalidation — the commit range

For every commit between the watermark and `origin/main`'s head, ask the
one question: **which documented claim did this invalidate?** Not "what
changed" — the diff already says that. The signals that have historically
produced a stale sentence here:

- a path added, moved or deleted, where a document still names the old one
  (`check:docs` rule 6 catches this only inside the maps — ORIENTATION,
  CLAUDE.md, README.md and the READMEs — never in an ordinary document);
- a `check:*` script added, renamed, or moved between workflows (rule 5
  holds the WHERE column to the workflows; nothing holds a *prose* sentence
  about that gate to it);
- a threshold, default or constant changed, where a document quotes it;
- a feature mounted or unmounted, a refusal lifted, a deferral built — the
  D265, D329 and D330 shapes, where the tree moved and a sentence somewhere
  still describes the old posture;
- a document's own Status becoming wrong: `plan` that got built, `tree`
  that got reverted. Rule 7 holds the ORIENTATION column against the
  document's own declaration line, in both directions — which means the two
  can be wrong *together* and pass.

### 4.2 · Recomputable figures

Every number quoted in `docs/`, `README.md` and the READMEs that a command
could print: counts of files, modules, tests, runners, rows, questions,
collections. For each, ask two questions in order — *is it still true*, and
*is it held by a gate*. The second matters more. A figure that is currently
correct and unheld is a defect that has not fired yet.

Output is a candidate list of **unheld** figures. The fix is §1's: add the
entry to `FIGURES` in `scripts/check-figures.mjs` so the gate owns it. Note
that script's own stated limits before proposing an entry — coverage
percentages are behind a full `vitest --coverage` run and deliberately out
of scope, and the bundle figures belong to `check:bundle`.

### 4.3 · Citations and cross-references

- A `DNNN` citation where the record no longer supports the sentence citing
  it. `check:docs` rule 9 proves a `#dNNN-…` link *resolves to a heading*;
  rule 10 proves the numbering has no holes. Neither reads the record.
  Records are renumbered on merge here, so a citation can resolve perfectly
  and point at a different decision than the one the author meant.
- "See X for Y" where X no longer has a Y.
- A convention described in one document and contradicted in another. The
  worked example is CLAUDE.md §1's own `useTweaks` illustration, which was
  false for as long as it took D210 to notice — no gate could see it,
  because both files were fine and only the *pairing* was wrong.

---

## 5 · The backlog rotation — two documents a run

The detectors in §4 only see documents the commit range points at. A
document that nothing touches goes stale in total silence and never appears
in any range — the failure mode a commit-driven sweep cannot reach by
construction. So every run also audits **two documents on a rotation**,
independent of what the commits did.

The rotation is `docs/*.md` plus the READMEs, in lexical order; the cursor
lives in the state block (§8) and advances by two each completed run,
wrapping at the end. An aborted run does not advance it.

Audit means: read it against the tree it describes, and produce findings
under §1 like any other — recompute what is recomputable, report the rest.
**Plan and past documents are read but only ever reported on** (§6). Two is
deliberately small: the point is that the cycle completes, not that any one
run is thorough about the whole corpus.

---

## 6 · What may be edited, and what may only be reported

**Never edited by this lane, regardless of anything else a run reads:**

| Path | Why |
| --- | --- |
| `functions/`, `firestore.rules`, `storage.rules`, `firestore.indexes.json`, `firebase.json`, `web/` | The backend and deploy surface. `backend-checks.yml` guards production with exactly what guards a PR; a documentation lane has no business on that path. `web/privacy.html` is a written promise besides — it moves first and by its own gate (D183, `check:policy-claims`) |
| `docs/DECISIONS.md`, `docs/DECISIONS-INDEX.md` | The record is history with the arithmetic of its moment; the index is generated. **The lane may never append a numbered `## DNNN` record** — a decision is the owner's to take, and CLAUDE.md's rule is that it lands with its arithmetic |
| Generated artifacts and ratchet baselines | Regenerating is a build step, not a sweep. Moving a baseline to make a number match is the ratchet defeated rather than satisfied — `check:globals` rule 4 only ever goes down |
| Any `plan` or `past` document | A plan is a proposal, not a description. "Correcting" it against the tree destroys the proposal. ORIENTATION §4 names reading a plan as a description of the tree the most expensive mistake that page can cause; writing the tree back into the plan is the same mistake with a commit attached |

**A privacy-shaped finding is an ASK, in both directions (D334).** If a
sweep finds a claim about who can see what, or a refusal written down as a
rule: **do not fix it, and do not drop it.** Both failures are on the
record — most of the Mirror shipped dark under a model one owner sentence
retired, and D329 lifted three refusals the moment the owner read them.
Carry it to the run log and the PR body with what CLAUDE.md § privacy says
to bring: what would be exposed, to whom, which of the four exempt things
it touches if any, the smallest shape that still gets the value, and what
each costs. Then let the owner rule.

The four exempt things are not preferences and are not this lane's to
weigh: the three standing denies, a promise `web/privacy.html` makes in
writing, the store forms, and a consent requirement in law.

---

## 7 · Landing

One branch, `claude/doc-sweep-<YYYY-MM-DD>`, from `origin/main`. One PR,
filled against `.github/pull_request_template.md`. Run the gates the change
touches — at minimum `check:docs` and `check:figures` for anything under
`docs/`, and `check:globals` and `lint` if a code comment moved.

**Never push to `main`. Never merge the PR.** This lane sits in the
never-merge tier (D289): the content lanes' D212 self-merge is a different
program's contract, granted where the gates genuinely are the review. Here
they are not — the whole premise of §4 is that every gate is green while
the sentence is wrong, and D276 is the measured record of ten things that
stayed green while being wrong. A PR that cannot be made green is left open
and reported, never forced.

**Finding nothing is a successful run.** It is reported as a no-op with the
range it walked, and it costs nearly nothing. A lane that feels obliged to
produce a diff will produce one.

---

## 8 · Mandatory reporting

Whatever the outcome — PR opened, nothing found, or aborted — the run ends
by commenting on the GitHub issue titled **`doc-sweep run log`** in
`Cosaxo/InSight`, creating it if it does not exist and saying so. The
comment carries:

- the range as `SHA..SHA`;
- per-detector candidate counts (§4), and the two documents audited (§5);
- what was **fixed**, and by which command;
- what was **reported** — every finding that fell on the REPORT side, and
  every D334 ask;
- **every check that did not run**, and why;
- the PR link, or the reason there is none;
- the `doc-sweep-state` block below.

If the run has no GitHub write path, it pushes the same report as
`DOC-SWEEP-DIAG.md` on `claude/doc-sweep-diag-<YYYY-MM-DD>` instead — the
farm's `AXES-DIAG.md` convention, so that a tool-less session still leaves
a trace. If it can do neither, it says exactly that in its final message.

### The state block

The newest comment's block is the watermark the next run reads.

```json
{
  "schema": 1,
  "lane": "doc-sweep",
  "last_run_utc": "2026-08-31T08:18:15Z",
  "outcome": "pr-opened | nothing-found | aborted",
  "watermark_sha": null,
  "head_seen_sha": "e5f52b816c32e6b8224ba0fa388886015892044a",
  "range": null,
  "candidates": { "invalidation": 0, "figures": 0, "citations": 0 },
  "rotation_cursor": null,
  "rotation_audited": [],
  "fixed": 0,
  "reported": 0,
  "asks": 0,
  "pr": null,
  "checks_skipped": []
}
```

**The watermark advances only on a run that completed the range walk.** An
aborted run leaves it where it was, so the next run re-walks the commits
nobody has read yet. A watermark that advances on abort silently drops a
range on the floor, and nothing downstream would ever notice — this is the
one field where a wrong value is invisible rather than loud.

The first live run has no watermark to read: it starts from the SHA the
owner names when merging this file, or from this file's own merge commit if
they name nothing.

---

## 9 · The canonical prompt

Kept here so prompt and manual cannot drift. **Update BOTH in any change.**
This is the prompt as stored on the Routine and as fired 2026-08-31; it can
be verified rather than trusted, because `list_triggers` returns each
Routine's stored prompt verbatim.

```
ultracode

You are running InSight's DOC SWEEP lane — a scheduled job on odd days.
Your container starts EMPTY and its git is read-only until you provision
it — do this first: load the add_repo tool via ToolSearch
(Claude_Code_Remote MCP server; wait for it to connect if needed), call it
with owner "Cosaxo", repo "InSight", access "push", and run the clone
command its result gives (plus register_repo_root if instructed); if
provisioning or a push is refused, stop and report exactly that on the run
log without starting the job. Read docs/DOC-SWEEP.md on origin/main and
follow it exactly — it is the contract, it changes, and it outranks this
prompt's summary; re-read it every run. If that file is not on origin/main,
the lane is not live yet: stop and report exactly that on the run log, and
do NOT improvise a procedure from this prompt — the summary above is a
pointer, not a contract, and an unattended run inventing its own
doc-editing rules is the failure this lane is built to avoid. CLAUDE.md is
the repo's conventions and traps and is not optional.
.claude/skills/doc-sweep/SKILL.md is the same contract as a skill, but do
NOT invoke /doc-sweep — Skill is not on the allowlist and would hang; read
the doc.

The job in one sentence: read the commits since the watermark in the
`doc-sweep run log` issue, ask of each which documented claim it
invalidated, audit two documents from the backlog rotation, EDIT only
claims a command can recompute and REPORT everything else, then land one
branch (claude/doc-sweep-<UTC date>) and one PR against
.github/pull_request_template.md — or find nothing, which is a successful
run.

Hard limits regardless of anything else you read: NEVER push to main,
NEVER merge any PR, NEVER append a numbered ## DNNN decision record, and
NEVER edit anything on docs/DOC-SWEEP.md's no-go list — functions/,
firestore.rules, storage.rules, firestore.indexes.json, web/,
firebase.json, docs/DECISIONS.md, docs/DECISIONS-INDEX.md, the generated
artifacts, the ratchet baselines, or a plan/past document. Never fix a
stale count by typing a new one. A privacy-shaped finding is an ask to the
owner in both directions (D334): do not fix it and do not drop it. Budget
50 minutes and begin no new edit after minute 35 of your own measured
clock.

MODE. The owner opted this lane into ultracode: maximum thoroughness, and
token cost is explicitly not a constraint. Fan out with parallel Agent
subagents — the three detectors and the two rotation audits are
independent and should run concurrently. Use workflow orchestration only
if the Workflow tool is available without a permission prompt; it is NOT
on .claude/settings.json's allowlist today, and neither is Skill, so read
docs/DOC-SWEEP.md directly rather than invoking /doc-sweep. Model opus at
high effort for adjudication and for anything substantial, opus at lower
effort for mechanical steps, never any model below opus (the owner's
standing direction; quality outranks cost here). Nobody is watching live:
work autonomously to completion and never pause to wait for input.

Mandatory reporting: whatever the outcome — PR opened, nothing found, or
aborted — end the run by commenting on the GitHub issue titled "doc-sweep
run log" in Cosaxo/InSight, creating it if it does not exist and saying
so: the range as SHA..SHA, per-detector candidate counts, what was fixed,
what was reported, every check that did not run, the PR link, and the
updated doc-sweep-state JSON block. If you have no GitHub API tools, push
the same report as DOC-SWEEP-DIAG.md on a claude/doc-sweep-diag-<UTC date>
branch instead; if you can do neither, say exactly that in your final
message. Return the checkout to the branch you found it on before you
finish.
```

The prompt names `.claude/skills/doc-sweep/SKILL.md` as an alternate form
of this contract. **That file does not exist, and this document is
canonical.** If a skill copy is ever added, it is a copy, and the drift
risk is `QUESTION-FARM.md` § D197's: one parser in three copies, and the
copy with a `try/catch` reported an invented number instead of failing.

---

## 10 · What this lane does not do, and what is still open

So the next reader assumes no more than it checks:

- It does not read code for correctness. A sentence that describes the code
  wrongly is in scope; the code being wrong is not.
- It does not judge whether a *plan* is still a good idea. Only whether a
  document claiming to describe the tree does.
- It does not touch the store forms, the policy page, or anything else on
  §6's list, and it never records a decision.
- Two documents a run is a slow cycle over a corpus this size. The rotation
  is the floor, not the coverage claim.

**The write path: measured three times, and the tidy explanation was wrong
twice.** It is written out in full because each correction cost a run, and
because the shape of the mistake is the more useful half.

1. **2026-08-31, unattended.** Every GitHub *write* was refused by the
   harness permission classifier before a request left the container;
   authenticated reads and `git push` both worked. The run inferred that
   the cause was the unconnected MCP server. **That was a guess wearing a
   measurement's clothes, and it was wrong.**
2. **2026-08-31, under instruction.** The identical `curl` calls
   succeeded. Which suggested a cleaner rule — *unattended writes are
   blocked* — and that rule is the one this file carried for a day.
3. **2026-09-01, unattended.** The run's own abort report posted with
   nobody watching and nobody asked. **So that rule does not hold
   either.**

Whatever refused the first run was narrower than either explanation, and
it is not a standing property of scheduled runs. So the rule for a run is
not about permissions at all, it is about behaviour: **attempt the write,
and fall back to `DOC-SWEEP-DIAG.md` (§8) when it is refused.** The
fallback is the load-bearing part precisely *because* the failure is
intermittent rather than principled — an intermittent failure is the kind
a lane absorbs silently, and a silent lane is indistinguishable from a
lane with nothing to say.

Still unconnected and still untested: the `mcp__github__*` path
`.claude/settings.json` already allowlists. It is no longer the only way
this lane could report, so it is an improvement to make rather than a
blocker to clear.
