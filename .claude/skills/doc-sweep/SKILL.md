---
name: doc-sweep
description: The scheduled documentation-drift sweep for this repo. Reads the commits since a watermark, asks which documented claim each one invalidated, edits only claims a command can recompute, reports the rest, and lands one dated branch and PR. Invoke as /doc-sweep from the scheduled session, or by hand to apply the same discipline to a range.
---

# doc-sweep

**`docs/DOC-SWEEP.md` on `origin/main` is the contract. Read it and follow
it exactly.** It carries the reasoning, the eight phases with their minute
budgets, the three detectors, the adjudicator ladder, the seven defences,
the no-go list, the bounds, the stop conditions and the schedule. It
changes, and it outranks this file — when the two disagree, the doc wins and
this file is the thing to fix by PR.

This file is deliberately thin, because it sits outside every doc gate: no
`check:docs` rule reaches `.claude/`, so nothing here is held to the tree.
Anything load-bearing therefore lives in `docs/DOC-SWEEP.md`, where rules 2,
7 and 9 bind it and the map has a row for it.

`CLAUDE.md` is the repo's conventions and traps and is not optional. Several
rules in the contract are only survivable because it explains them.

## Before you read anything else

Your container may start empty with read-only git. Provision first: load
`add_repo` via ToolSearch (Claude_Code_Remote), call it with owner
`Cosaxo`, repo `InSight`, access `push`, run the clone command it gives, and
`register_repo_root` if instructed. **If provisioning or a push is refused,
stop and report exactly that** — a run that cannot push cannot do this job,
and finding that out at minute fifty is the expensive way to learn it.

## The nine rules that hold even if you can read nothing else

1. **Never push to `main`, never merge any PR, never touch a branch this run
   did not create.** Work lands as one branch `claude/doc-sweep-<UTC date>`
   and one PR against `.github/pull_request_template.md`.
2. **Never append a numbered `## DNNN` decision record.** Numbers are
   claimed on branches and have collided three times in two days. Findings
   go in the PR body; numbering a decision is the owner's act.
3. **Never edit anything on the contract's no-go list**, above all
   `functions/`, `firestore.rules`, `firestore.indexes.json`,
   `storage.rules`, `web/` and `firebase.json` — those are
   `firebase-deploy.yml`'s paths, so a merge touching them applies rules and
   functions to production, comment-only edits included — and
   `docs/DECISIONS.md`, whose arithmetic is a snapshot, and
   `docs/DECISIONS-INDEX.md`, which is generated.
4. **Never fix a stale count by typing a new one.** Register it in
   `scripts/check-figures.mjs` and prove it both ways, or report it.
5. **Only edit a claim a command can recompute.** A stated reason, an
   intent, a Status marker, a `docs/COPY.md` §3 claim, and any doc-versus-
   code disagreement where both sides are internally consistent are
   report-only.
6. **A privacy-shaped finding is an ask to the owner in both directions
   (D334).** Do not fix it, and do not quietly drop it.
7. **Never claim a check you did not run.** Run gates unpiped — `false |
   tail -1` exits 0 — and name every unrun check as unrun.
8. **Comment on the `doc-sweep run log` issue every run**, including a run
   that finds nothing and opens no PR, and including one that aborts. Create
   the issue if it does not exist and say so. That comment carries the
   updated `doc-sweep-state` block, which is where the watermark lives.
9. **Return the checkout to the branch you found it on**, on every exit
   path, and delete an unpushed sweep branch only after checking out
   something else.

## Two things about this lane that are backwards from the rest of the repo

- **A green gate is not evidence here.** This lane's subject is exactly the
  complement of what the gates read, so a correct edit is green on both
  sides. Evidence is a recomputation command and its literal output;
  acceptance is a diff of the gates' printed **census numbers**, not their
  exit codes.
- **Finding nothing is a successful run.** This tree is drift-hunted
  nightly. Do not manufacture an edit to justify the firing.

## Mode

The owner opted this lane into ultracode: maximum thoroughness, token cost
explicitly not a constraint. Orchestrate — the three detectors and the two
rotation audits are independent and should run concurrently. Fan out with
parallel `Agent` subagents: `Workflow` is **not** on
`.claude/settings.json`'s allowlist, so a scheduled run that reaches for it
hangs on a prompt nobody answers. (Nor is `Skill`, which is why the Routine
prompt sends a run to `docs/DOC-SWEEP.md` rather than to `/doc-sweep`.) Opus at
high effort for adjudication and anything substantial, opus at lower effort
for mechanical steps, never a model below opus (the owner's standing
direction; quality outranks cost here). Nobody is watching: work to
completion and never pause for input.

Budget 50 minutes, measured — there is no `date` on the allowlist, so record
`node -e "console.log(Date.now())"` at the start and check elapsed minutes
at each phase boundary. Begin no new edit after minute 35.
