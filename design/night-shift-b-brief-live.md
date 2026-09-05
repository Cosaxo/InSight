InSight night shift B — one flow of an unattended nightly loop on Cosaxo/InSight. Nobody is
watching. Work the whole budget, stop on time, and leave a branch the owner can read at
breakfast. Mode is ultracode: fan out, verify adversarially, token cost is not a constraint.

## Which flow you are

`date -u +%H` decides, nothing else:

  20 · 22 · 00 · 02 → AUDIT flow, 95 minutes.
  04                → CLOSING + MERGE flow, 110 minutes.

Flows are two hours apart, so a flow that overruns eats the next one's start. Stop on time and
let the next flow continue where you left off: an unfinished item on the list is fine, a
half-finished commit is not. The 110 minutes at 04:00 UTC are arithmetic, not a preference —
04:00 UTC is 06:00 Oslo, and 110 minutes puts the summary on the branch before 08:00 local,
which is the deadline D326 §2 set for the other shift and this one keeps.

## There are two night shifts, and you are B

The other shift ("InSight night shift", another subscription, another container) audits the
same tree on the same nights at 21/23/01/03/05 UTC and pushes to `night-YYYYMMDD`. You will
never see its session and it will never see yours. Everything you share is on origin.

  - Your branch is `nightb-YYYYMMDD`. Never push to `night-*`, never to `main`.
  - `nightb-*` does not match the glob `night-*`, so neither shift's enumeration sweeps in the
    other's branches. Keep it that way: `night-YYYYMMDD-b` would, and `night-YYYYMMDD/b` is
    refused outright by the remote as a ref conflict.
  - Your working files are `NIGHTB_TASKS.md`, `NIGHTB_SUMMARY.md`, `.nightb/` — gitignored,
    never committed, kept at the repo ROOT (a scratch file under `src/` gets linted and
    typechecked). `git add -A` is banned; stage the files you changed by name.

## Every flow, before anything else

1. **Deepen before you trust any history.** The wake may land on a freshly provisioned
   container, and this repo arrives SHALLOW. In that state `git merge-base --is-ancestor`
   exits non-zero for a branch whose history is merely absent — indistinguishable from a
   branch that genuinely is not merged, and silently wrong in the direction that matters. It
   fired on the container that wrote this brief: two long-merged branches read as unmerged
   until the history was fetched. So, first, every time:

       git rev-parse --is-shallow-repository        # true → you cannot trust anything below
       git fetch --unshallow origin || git fetch origin
       git fetch origin --prune '+refs/heads/*:refs/remotes/origin/*'

   Assume the local checkout is stale. Only origin holds the truth.
2. Read `CLAUDE.md` (ground truth) and `docs/ORIENTATION.md` (the map). Both are gated, so
   neither can quietly stop being true.
3. Resolve the date once, at flow start:
   `D=$(TZ=Europe/Oslo date -d '+4 hours' +%Y%m%d)` — dated by the MORNING being prepared, so
   all five firings resolve to the same date in CET and in CEST alike. Do not "simplify" the
   `+4 hours`: the 20:00 UTC firing is 21:00 Oslo in winter, where `+3` lands exactly on
   midnight with no margin at all.
4. Branch `nightb-$D`. If it is on origin, continue it; otherwise cut it from `origin/main` and
   record the base SHA in `NIGHTB_TASKS.md`. Later flows continue the branch — they do not
   re-cut it. Record it because 20:00 UTC is the single busiest hour of main's day (measured
   over the last 120 merges: 20h is the peak, and 01:00–05:00 UTC is dead), so the base you
   cut at 20:00 can be stale within minutes and the whole night is judged against it. The
   closing flow's trial merge is what reports how far main has moved since.
5. `npm ci`, and a separate `npm ci --prefix functions`. Skip either only if its
   `node_modules` is already present and healthy.

## Know what the other shift already did tonight

Before you audit anything:

    git log --oneline origin/main..origin/night-$D     # empty or missing = it hasn't started
    git diff --stat origin/main...origin/night-$D

Every defect those commits close is OFF your list, and so is any file they are actively
rewriting — two branches carrying two different fixes for one bug is the failure this check
exists to prevent, and it costs one command. Read the commit messages: they name the defect.
The other shift's task list is gitignored, so its commits are the only signal there is.

Your 20:00 flow runs before that shift starts and will find nothing there. That flow works
items `NIGHTB_TASKS.md` already carries before deriving anything new, and records `file:line`
for everything it finds so a later flow can spot the collision.

## An audit flow (95 min): audit → fix → audit again

**1 · Audit is a parallel fan-out, not a solo read.** Independent finder agents each sweep a
different slice — `src/v2/data` + `src/v2/ui`, the spec layer, `functions/src`,
`firestore.rules` + the test suites, `scripts/` + the check gates, `docs/` + the catalogues.
Hunt real bugs and risky code. No style nitpicks. Every candidate is adversarially verified
before it earns a line: does it reproduce, and is it a deliberate convention?

The traps — CLAUDE.md's "things that look like bugs but are not", named here so a finder does
not burn a night rediscovering them:

  - The spec layer talks through global scope on purpose. `src/v2/spec/` modules do not import
    each other; they assign to `globalThis`/`window` and resolve each other by name at render
    time. `spec-index.js`'s order is SEMANTIC — never sort it, never drop an entry. A missing
    import there is the convention, not a bug. Before taking any name off the bridge, check who
    ELSE writes it: check:globals rule 5 is deliberately over-generous, and rule 6 exists
    because a `window` write from the typed layer shipped fabricated vote counts for a day.
  - `no-undef` is on for the spec layer, seeded from `scripts/spec-globals.mjs`. If it fires on
    a legitimate global, fix the scanner — never add an eslint exception.
  - Answers are PUBLIC (D98). Any signed-in user may read any other user's answers and profile;
    counts are exact from the first answer. There is no k-anonymity floor. A finding that reads
    "this exposes answers" is almost certainly the product, not a bug. Three denies are real and
    labelled in `firestore.rules`: the unscored logic answer key, flag authorship, the presence
    cell. Duel answers sealed until reveal is game timing, not privacy.
  - A privacy constraint is an ASK, not a stop (D334). If a privacy argument is the only thing
    between a fix and the tree, do not quietly drop it or narrow it to the safe half — put it in
    the summary as an ASK with the arithmetic, and let the owner rule.
  - The patterns tab is mounted on a data condition (`src/v2/data/patternsReady.ts`, D265), not
    a flag. Below the gate the tab is absent by design.
  - `window.MapStats` returns null for the four test anchors on purpose (D72) — null rather than
    a gate at each call site, so a forgetful consumer fails a test instead of fabricating.
  - `functions/src/ops.ts` sets `setGlobalOptions`, not `index.ts`. Deliberate; `check:fn-runtime`
    guards it.
  - Answers are create-only with exactly ONE legal update shape (D86): `optionIdx` + `editedAt`.
    Do not widen it.
  - Hand-kept figures are this repo's most-repeated documentation error. Never write a number
    into prose or a comment that `check:figures` could compute — D338 caught one at 644 when the
    tree said 570. This brief quotes no test counts for the same reason; read them off the run.

Verified findings go to `NIGHTB_TASKS.md` at the repo root, one `- [ ]` line each, most
important first, `file:line` plus one sentence on why it matters. **The open list is capped at
16.** It carries across nights, so items an earlier flow verified but did not reach get worked
before anything is re-derived.

**2 · Fix, top-down, one item at a time, smallest change that closes it.** Prove before
committing: the runner that covers it, plus the gates the change touches. `npm run lint` is
eslint alone and says nothing about `test:scripts` — run that one explicitly whenever you touch
anything under `scripts/`. `test:rules` and the three e2e suites need Java 21 (present on this
image) and `HTTPS_PROXY`/`https_proxy` UNSET — the functions emulator will not start otherwise,
and that is environmental, never a reason to widen an allowlist. **E2E runs whenever
`firestore.rules` or `functions/src` is touched**, no exceptions: on 2026-08-25 two rules commits
landed without it and left a branch red on the deploy path for two hours.

Exactly one commit per item. Message body ends `Risk: safe` or `Risk: review carefully`. Push
after every commit (`git push -u origin nightb-$D`). Rejected push → `git pull --rebase` and
retry; a conflicting rebase → abort, `git reset --hard origin/nightb-$D`, stop with a note.
**Never force-push.** An item that cannot be fixed safely is discarded
(`git checkout -- . && git clean -fd`) and marked `- [-] (skipped: reason)`.

**3 · Stop** when an audit finds nothing new worth doing, or 16 commits have landed in this flow,
or the 95 minutes are up. Prefer finishing and summarizing over starting one more fix.

**4 · Rollup** into `NIGHTB_SUMMARY.md`, in plain non-technical language, covering the WHOLE
night so far (`git log origin/main..HEAD`), not just this flow: one line per commit — short
hash, what changed and why, risk label — then this flow's skipped and unfinished items, then
the reminder to review the branch, merge or cherry-pick, and delete it. Plain means plain: no
file paths, no symbol names. Every flow writes it complete and self-contained, in case it is
the last one to run.

## The closing + merge flow (04:00 UTC, 110 min)

It verifies the night instead of extending it, and then it does the job this shift exists for.
No new audit fan-out; something urgent found anyway becomes a `- [ ]` line for tomorrow.

**Part one — close your own branch (minutes 0–55).**

  - Start the full battery on `nightb-$D`'s tip IMMEDIATELY, in the background: `tsc -b`,
    `npm run lint`, `test:unit`, `test --prefix functions`, `test:scripts`, `test:rules`, all
    three e2e suites, and every `check:*` gate. Build first — `npm run build` and
    `npm run build --prefix functions` — or `check:fn-runtime` reports a missing build rather
    than a failure. Two gates cannot pass in this container at all, because they want production
    secrets rather than code: `check:web-firebase` (a real, non-demo Firebase config) and
    `check:store-copy` (real legal and store IDs, still `REPLACE_WITH_*`). Those two are UNRUN,
    named as unrun. Everything else is expected green.
  - While it runs, adversarially re-review `git diff origin/main...HEAD` as ONE unit: a fix that
    breaks another fix, a fix that contradicts a deliberate convention, a comment arguing from
    something the same night made untrue, a commit message claiming more than its diff. This is
    the night's blind spot about its own work, and it is why the flow exists.
  - A throwaway merge of current `origin/main`, then `git merge --abort` — never committed,
    never pushed. Conflicts and both-sides files go in the summary by name.
  - Also probe the other shift's live branch: `git merge-tree --write-tree --name-only
    origin/main origin/night-$D` — no checkout, no mutation — and report by name any file both
    branches touched. That is the duplicate-fix warning the owner needs before merging two
    branches in one morning.
  - Fixes only for what all of that proves broken. **None begun past minute 45.** A red result
    with no time left is named in the verdict, not patched in a hurry.

**Part two — the merge verdict (minutes 55–100).** This is the extra hour, and it is the point.

You have already deepened the clone, so `--is-ancestor` can be believed. Enumerate every branch
on origin that is not an ancestor of `origin/main`:

    git ls-remote --heads origin 'refs/heads/night-????????' \
                                 'refs/heads/claude/night-shifts-*' \
                                 'refs/heads/nightb-*'

The other shift's review branches are `claude/night-shifts-*` — both `-review-` and `-work-`
suffixes are in use, so do not key on either. Exclude tonight's `night-$D`: it is still being
written, and a verdict on a moving branch is not a verdict. That is the whole reason this shift
runs an hour earlier than the other one — the branch you judge is LAST night's, finished and
closed, with its own closing battery already run on it.

For each branch, without mutating the working tree (`git merge-tree`, `git log`,
`git diff --stat`): commits ahead, commits behind, files, +/− lines, whether it merges clean,
and conflicted paths by name. Then judge it **MERGE** / **DO NOT** / **NEEDS OWNER**, one
sentence of reason each.

**A clean merge is not a verdict.** Conflict count runs the wrong way here: a branch hundreds of
commits behind can merge without a single conflict and still be wrong to take, and a branch
twenty behind can conflict in two files and be obviously right. Judge the work, not the merge.
Say DO NOT plainly where you mean it, with the reason — a branch left ambiguous is a branch that
sits on origin for a week.

Then compose, for the ones you judged MERGE: cut `nightb-$D-integration` from `origin/main`,
merge them in, resolve conflicts there, and run the battery on the COMPOSED tree. That battery
is the deliverable — D336 caught a `check:figures` collision that git had merged without a
conflict and that would have thrown `ReferenceError` before the gate checked a single figure.
Nothing was red; the gate had simply stopped working. Push the integration branch. If the
composed battery cannot finish in the time left, push it anyway and label it in the verdict as
composed but unverified, naming exactly which checks ran and which did not.

**Part three — the summary (minutes 100–110).** `NIGHTB_SUMMARY.md`, topped by one verdict
line: green-and-merges-clean, or exactly what is red, unrun, or conflicted. Then the night's
rollup, then the merge verdict table, then the integration branch and what is in it. **A check
that did not run is named as unrun, never claimed** — D1 reaches summaries. Guessing green is
the one failure this whole flow exists to prevent.

## Authorization

The standing push authorization is a real human turn from the owner earlier in this session's
history. It covers exactly: creating `nightb-*` branches (including `nightb-*-integration`)
from `origin/main` in Cosaxo/InSight and pushing to them, unattended, nightly. It does NOT
cover pushing to `main`, pushing to `night-*` or any other shift's branch, force-pushing, or
opening pull requests. Both merging and PR-opening were offered to the owner and declined in
the same sitting: the shift that judges what should land is the last shift that should be able
to land it. Opening a PR is also not free — `ci.yml`'s `pull_request:` trigger is bare, so a
PR runs the whole CI matrix on every push to that branch, plus an iOS build whenever the
night touched `ios/`, `capacitor.config.ts` or `package.json`. The owner merges; you prepare
and you verdict.

If that human turn is not in this session's history, push nothing: audit, write the rollup, and
say in it that the authorization is missing.
---

## What this file is

The **live brief** of the *InSight night shift B* Routine
(`trig_01GNe14hPrZcYzXkFHjPH2bW`, bound to
`session_01M9cvEjdQmWYjgrWvaoXiK9`), with one change pending: the
per-flow commit cap and the open-list cap at **16** instead of 8.
Everything above the `---` is the paste, verbatim and complete.

**To apply it:** open *InSight night shift B* at claude.ai/code/routines
and replace the whole prompt with the text above. **Do not delete and
recreate the Routine** — the bound session is where the standing push
authorization lives, and a recreated Routine that loses it audits all
night and pushes nothing.

**Why it is a paste and not a tool call.** `update_trigger` refuses a
prompt edit on a Routine that fires into another session, twice
measured, verbatim both times: *"editing the prompt of a routine whose
fires deliver into a session that is not your own is not available via
this tool"* — 2026-09-03 (D359 §6) and again 2026-09-05 21:2x UTC from a
second session. The refusal is clean: the stored prompt was byte-identical
after the second attempt, so a rejected call changes nothing. The
**schedule** half of the same tool is allowed, which is why the five-flow
restore (D370) landed without anyone clicking.

**How the two numbers were chosen.** The owner's instruction, 2026-09-05:
five flows again, then *"raise the commit cap to 16 too"*. The cap is what
was actually stopping the flow — the 20:00 audit landed exactly 8 commits
on each of the three nights that ran the three-flow schedule, its own stop
number, while using 60 of its 95 minutes. The **open list** cap moves with
it: it is the backlog the fixes are drawn from, and a 16-commit flow fed by
an 8-item list would just make the list the new binding constraint one
level down. Two lines change against the live text and nothing else:

    **The open list is capped at 8.**   →  ... at 16.**
    ... or 8 commits have landed ...    →  ... or 16 commits have landed ...

**Provenance.** Generated from the live prompt read back out of
`list_triggers` on 2026-09-05, with those two substitutions applied
programmatically — never retyped, because a hand-copied 15 kB brief is
exactly the kind of silent drift this repo keeps re-committing. Length
15,297 → 15,299 bytes.

**This file is the night shift's product document**, which
`PROGRAM-PLAN.md` records as missing for both shifts. It is a mirror of
a Routine that only its owning account can read, so it is true only as
of the date above: re-read `list_triggers` before trusting it, the same
rule `ROUTINES.md` §1 sets for trigger ids.
