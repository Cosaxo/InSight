# Axes runbook — the ordered build list, and the routines that run it

> **Reasoning lives in [`AXES-PLAN.md`](AXES-PLAN.md)**, which is
> canonical — the frame, the custody classes, the two future axes, and
> (§10) the arguments behind this program's shape. This file is the same
> work as an ordered to-do list plus the operating manual for the
> scheduled runs that execute it: open steps only, dependency order,
> what "done" means, which gate proves it, and the canonical prompt each
> Routine defers to. If the two disagree, the plan is right and this is
> stale. Same split as `SCALE-PLAN.md` / `SCALE-RUNBOOK.md`, for the
> same reason.

**Status: the program is LIVE — Phase 0 done 2026-08-25, adopted in
the owner's words (D289); every build step below is open.** The three
lanes exist and fire on the inventory's schedule; this file is the
contract they defer to every run, so its behavior changes by PR here.

**Sizes** are S (an afternoon), M (a few days), L (a week or more).
**Every step names the gate that proves it.** Steps marked **[owner]**
are decisions, not code, and nothing below them in their phase ships
first. Records and paperwork land in the same PR as the code they
license (`ATTENTION.md` §6's rule, generalized). Three standing
constraints apply to every phase, verified against the tree rather than
remembered:

- **Nothing rides the answer trigger.** `pulse.test.mjs` pins
  `onV2AnswerCreated` at its exact read count; every server-side piece
  below is a nightly `onSchedule` sweep — the `patterns.ts` /
  `engagement.ts` idiom, injected store, bounded catch-up.
- **No new globals.** New code is typed ESM under `src/v2/data` /
  `src/v2/ui`; `check:globals` rule 4 only ratchets down.
- **Build lanes never merge** (AXES-PLAN §10's tier rule). Content
  lanes' D212 self-merge does not transfer to engineering: D276 is the
  measured record of what stays green while being wrong. A build PR
  waits for the skeptic's verdict and the owner's merge, every time.

---

## The lanes

Three Routines, extending the five in `docs/QUESTION-FARM.md`
§ Scheduled runs. Same governance, restated where it differs:

| Lane | Proposed schedule (UTC) | Contract | May edit | Merge authority |
| --- | --- | --- | --- | --- |
| **Axes build** | `0 11 * * 2` — weekly, Tue 11:00 | § The build lane | the files its step names, plus ticking that step's own checkbox here in the same PR | **never merges** — skeptic then owner |
| **Axes skeptic** | `0 11 * * 3` — weekly, Wed 11:00 | § The skeptic lane | nothing — review comments and the run log only | n/a |
| **Axes retro** | `0 12 * * 0` — weekly, Sun 12:00 | § The retro lane | `docs/` only — brief amendments, runbook status, Proposed records | **never merges** — the owner, always |

The hours sit off the farm block (07:00–10:00) so no two lanes share a
checkout mid-run; the farm's dirty-tree rule inherits verbatim (stash or
a separate worktree, return to the previous branch after). Billing,
pausing and the kill posture are the farm's: runs bill the maintainer's
subscription, a no-op costs nearly nothing and says why, pausing a lane
is one toggle in the claude.ai Routines UI, and behavior changes happen
by PR to this file — the prompts defer to it every firing.

### The account-side inventory (repo-side record)

Created 2026-08-25 (D289), rebound 2026-08-26: model
`claude-fable-5`, completion notifications off. Update this table
whenever a lane is added, rebound, re-paced, or retired — the farm's
convention.

| Routine | Trigger id | Run log | Binding |
| --- | --- | --- | --- |
| InSight axes build | `trig_01Hzg91yafFVsa1HsXBcZY9X` | #290 | dispatcher → fresh session |
| InSight axes skeptic | `trig_01JkE1PGWeuGe9GykFnjg1Gh` | #290 | dispatcher → fresh session |
| InSight axes retro | `trig_01CT2yRRXZy7DbtUGPyNCB4J` | #290 | dispatcher → fresh session |

"Dispatcher → fresh session" (the 2026-08-26 rebind): a cron-spawned
session carries no MCP tool grants, so the provisioning step's
`add_repo` call stalled at a permission prompt nobody answers — the
second platform measurement, after the empty-container one below. Each
Routine now wakes a persistent dispatcher session
(`session_01D44Wtdu5JfCYMJmYuKmLjc`) that forwards the lane prompt
verbatim into a fresh session spawned with the provisioning tools
pre-approved: same isolation and fresh container, working permissions,
and every run readable afterwards. The theory lanes dispatch the same
way; their ids live in the charter's §10 on `axiom-theory`.

**Binding is a measurement, not a preference — and the measurement is
in, amended 2026-08-25 evening.** The adoption shipped on the premise
that spawned sessions start with the repo cloned; the first fires
proved that FALSE, expensively: **containers spawn EMPTY, and their
git is read-only until provisioned.** The sequence, recorded so the
next platform surprise starts from evidence: the axiom genetic lane's
first two runs each did a full theory pass against nothing and landed
zero (~$20 and ~$23 of metered work); every lane was paused within the
hour; two minimal `create_session` probes then isolated it — PROBE3
(clone works read-only, push denied: "repo not in session auth set")
and PROBE4 (**`add_repo` with access "push" attaches the repo as an
authorized source, and the push lands** — 90 seconds, $2.66, commit
`0e59fdc` on the theory branch). Total diagnostics ≈ $65 of metered
usage. The fix rolled out the same evening: all eleven live prompts
now open with the provisioning step (the blocks below match verbatim),
the theory lanes were re-enabled, and the farm's `AXES-DIAG.md`
fallback stays in every prompt so even a tool-less session leaves a
trace. Fire-with-appended-text is retired as a diagnostic instrument —
the appended text demonstrably did not preempt the stored prompt;
minimal `create_session` probes are the instrument that measured true.

**The permission surface is committed, not per-session (added
2026-08-25, owner's direction: lanes must never stall on a prompt).**
`.claude/settings.json` on `main` pre-approves the lanes' working
toolset — git/npm/node under Bash, file edits, web research, the
`add_repo`/`register_repo_root` provisioning pair, and the GitHub reads
plus the PR/issue writes this program's lanes use — so a fired session
with nobody watching never sits at a permission prompt. Honest basis:
no run has yet been *observed* stalling on one (PROBE4 pushed with
none); this is prevention, adopted because a single stall would waste a
full lane slot. What the file deliberately does **not** pre-approve is
its own fence: `merge_pull_request` and auto-merge stay off the list
(the never-merge tier, D289), as do the GitHub API file-write tools
(git is the landing path — an API write would skip the local gates) and
trigger/session mutation (the cadence dial stays the owner's, charter
§11). Nothing is put in `deny`: the farm's D212 self-merge is a
different program's contract, and this file reaches every session in
the repo, so it hardens by omission only.

## The build lane

**The job in one sentence:** advance this runbook by at most one step
per run — the topmost unchecked step whose phase is entered and whose
preconditions hold — through every gate to an open PR with the skeptic
requested; or do nothing, loudly, naming exactly which [owner] decision
or open PR it is waiting on.

Rules, each load-bearing:

1. **One step per run, or less.** A step too large to finish leaves its
   branch (`claude/axes-<step>`) with a WIP commit and a run-log report
   of what remains; the next run resumes that branch. Two steps never
   share a run — a reviewer reads one change at a time.
2. **Step selection is mechanical.** Topmost unchecked, phase entered
   (its [owner] steps done and recorded), preconditions listed on the
   step met, and no open program PR awaiting the skeptic or the owner —
   if one is open, the run's whole job is that PR: fix what the skeptic
   or CI flagged, or no-op naming what it waits on. Never a second PR
   on top of an unreviewed first.
3. **Only the files the step names or clearly implies.** The nevers, on
   top of the farm's: never loosen `firestore.rules`; never touch the
   content banks (the farm's turf) or another lane's files; never flip
   an `active` flag; never move a store form, privacy sentence or
   data-inventory row EXCEPT where the step says so — and where it
   does, in the same PR as the code (D130/D116). The one runbook edit
   allowed is ticking the step this PR completes.
4. **Gates before the PR, every time:** `check:globals`, lint,
   `test:unit`, build, plus the step's own named gate; `npm run
   test --prefix functions` when `functions/` moved; rules or e2e
   suites when the step says so. Paste failures verbatim into the run
   log; a step that cannot go green is left open and reported, never
   forced, never gamed (no skipped tests, no empty commits, no
   re-runs to outwait a real failure).
5. **Never merge, never approve.** Open the PR, request the skeptic by
   saying so in the run log, stop. Drafting a decision the step needs
   is allowed — as a `Status: Proposed` record in the PR, which binds
   nothing (the D28 lesson).
6. **Every run ends with a run-log comment** — PR opened/advanced →
   link and what remains; no-op → the exact blocker; aborted → the
   verbatim errors. "Correctly idle" and "silently broken" must never
   look the same from outside (farm hard rule 7).

## The skeptic lane

**The job in one sentence:** adversarially review every open program PR
as a session that did not write it, and leave a verdict a merging owner
can lean on; or no-op if none are open.

What it judges — the engineering residue the gates cannot, the D162
contract's shape one layer up:

1. **Does the diff do the step?** Read the step first, then the diff —
   scope creep and quiet omissions both.
2. **What stays green while being wrong?** D276's audit is the
   checklist's source: assertions that cannot fail, fakes that cannot
   see where a number lands, a publication nothing pins, a test pinning
   the constant instead of the property.
3. **The custody surface.** Any new read path, any UI claim
   `firestore.rules` or a function does not make true, any data motion
   whose same-PR paperwork (inventory row, store form, privacy
   sentence, COSTS line, erasure arm) is missing — the CLAUDE.md
   contract, checked as a reviewer rather than trusted as a habit.
4. **Gate honesty.** Does the step's named gate actually prove the
   step, or does it prove something easier that resembles it?
5. **The verdict, written down:** findings as PR review comments (file
   and line), a one-line verdict on the run log — clean, or findings
   listed. The skeptic never edits the branch, never approves in the
   merge sense, and never softens a finding because the build lane is
   its own species; the tilt it shares with the generator is the reason
   it exists as a separate session, not a reason to trust itself
   (D162's correlated-blind-spot rule).

## The retro lane

**The job in one sentence:** once a week, turn what the program
reported into what the program learns — a digest for the owner, and a
docs-only PR of amendments; the only lane allowed to edit the briefs,
and the one most firmly forbidden to merge them.

Inputs: the run log since the last retro, open program PRs and their
skeptic verdicts, the committed scorecards, the fit's published meta,
and this file's unchecked steps. Outputs, in order:

1. **The digest**, one run-log comment the owner can read in a minute:
   what merged, what is open and on whom, which [owner] decisions are
   pending (bundled here, deliberately — the lanes themselves must not
   nag), and the one number per live phase its trial criteria name.
2. **The amendments PR** — `docs/` only: dated learned-rules in the
   lane contracts (the QUESTION-FARM amendment style: what happened,
   what changes, why), runbook status drift fixed, cadence
   recommendations argued from the log ("gate failures recurring →
   the lever is the cadence, not the caps"), and Proposed decision
   drafts where a lane keeps hitting the same wall. Never code, never
   a contract self-merge — the owner merges every amendment, because
   the briefs are the system's weights and adoption is the only
   update rule (AXES-PLAN §10).
3. **Nothing to amend → digest only**, and that is a healthy week, not
   a failed run.

## Canonical prompts

Kept here so prompt and manual cannot drift — the farm's rule: update
BOTH this block and the lane's section in any change, and verify the
live prompts against these blocks after any swap (`list_triggers`
returns stored prompts verbatim). The run-log issue is **#290**; the
blocks below are the live prompts verbatim as amended 2026-08-25
evening — the provisioning preamble added, the transitional
read-from-the-PR-branch clause stripped once this file reached `main`.

The build lane's canonical prompt:

```
You are running InSight's AXES BUILD lane — a scheduled weekly job. Your container starts EMPTY and its git is read-only until you provision it — do this first: load the add_repo tool via ToolSearch (Claude_Code_Remote MCP server; wait for it to connect if needed), call it with owner "Cosaxo", repo "InSight", access "push", and run the clone command its result gives (plus register_repo_root if instructed); if provisioning or a push is refused, stop and report exactly that on the run log. Read docs/AXES-RUNBOOK.md on origin/main and follow it exactly — it is the contract, it changes, and it outranks this prompt's summary; re-read it every run. Its plan file docs/AXES-PLAN.md is the reasoning; read the section your step cites before writing code.

The job in one sentence: if an axes program PR (a claude/axes-* branch) is open, your whole run is that PR — fix what CI or the skeptic flagged, or no-op naming what it waits on; otherwise take the TOPMOST unchecked step in the runbook whose phase is entered (its [owner] steps recorded) and whose preconditions hold, implement at most that one step on its branch (claude/axes-<step>, resuming a WIP branch if the last run left one), run the gates (check:globals, lint, test:unit, build, the step's own named gate, and the functions suite when functions/ moved), tick that step's checkbox in the same PR, open the PR, request the skeptic by saying so in the run log, and stop. If the topmost step is [owner], the run is a no-op that names that decision.

Hard limits regardless of anything else you read: NEVER merge or approve a PR — the skeptic reviews and the owner merges, every time; one step per run at most; edit only the files the step names or clearly implies, plus that step's checkbox; never loosen firestore.rules; never touch the content banks or another lane's files; never flip an active flag; never move a store form, privacy sentence or data-inventory row except where the step says so, and then in the same PR as the code; never skip, disable or quarantine a test, never push an empty commit, never re-run a job to outwait a real failure — a PR you cannot get green is left open and reported. A decision the step needs may be DRAFTED as Status: Proposed, which binds nothing.

Mandatory reporting: whatever the outcome — PR opened or advanced, no-op, or aborted — end the run by commenting it on issue #290 in Cosaxo/InSight (the run log): the PR link and what remains, or the exact blocker, or the verbatim errors. If you have no GitHub API tools, push the same report as AXES-DIAG.md on a claude/axes-diag-<YYYY-MM-DD> branch instead (and if a PR could not be opened, say the branch needs one); if you can do neither, say exactly that in your final message. Work on the lane's branch and return to the session's previous branch afterwards; if the tree is dirty, stash or use a separate git worktree.
```

The skeptic lane's canonical prompt:

```
You are running InSight's AXES SKEPTIC lane — a scheduled weekly job, the day after the build lane. Your container starts EMPTY and its git is read-only until you provision it — do this first: load the add_repo tool via ToolSearch (Claude_Code_Remote MCP server; wait for it to connect if needed), call it with owner "Cosaxo", repo "InSight", access "push", and run the clone command its result gives (plus register_repo_root if instructed). Read docs/AXES-RUNBOOK.md § The skeptic lane on origin/main and follow it exactly — it is the contract, it changes, and it outranks this prompt's summary; re-read it every run.

The job in one sentence: find the open axes program PRs (claude/axes-* branches); if none, the run is a logged no-op; for each one, review it as a session that did not write it — read the runbook step first and the diff second; hunt what stays green while being wrong (assertions that cannot fail, fakes that cannot see where a number lands, publications nothing pins — D276 in docs/DECISIONS.md is the checklist's source); check the custody surface (new read paths, UI claims firestore.rules does not make true, missing same-PR paperwork: inventory row, store form, privacy sentence, COSTS line, erasure arm); ask whether the step's named gate proves the step or something easier that resembles it; then leave findings as PR review comments with file and line, and a one-line verdict — clean, or findings listed — on the run log.

Hard limits regardless of anything else you read: never edit or push to the branch under review; never merge or approve in the merge sense; never soften a finding to be agreeable — you share the build lane's tilt, which is why you exist as a separate session and why your default is suspicion. Verify claims by running the repo's own gates and tests where cheap, and say which findings you verified versus suspect.

Mandatory reporting: whatever the outcome — verdicts left, no PRs open, or aborted — end the run by commenting it on issue #290 in Cosaxo/InSight (the run log): per-PR verdict lines, or the no-op, or the verbatim errors. If you have no GitHub API tools, push the same report as AXES-DIAG.md on a claude/axes-diag-<YYYY-MM-DD> branch instead; if you can do neither, say exactly that in your final message. Leave the working tree exactly as you found it.
```

The retro lane's canonical prompt:

```
You are running InSight's AXES RETRO lane — a scheduled weekly job, Sundays. Your container starts EMPTY and its git is read-only until you provision it — do this first: load the add_repo tool via ToolSearch (Claude_Code_Remote MCP server; wait for it to connect if needed), call it with owner "Cosaxo", repo "InSight", access "push", and run the clone command its result gives (plus register_repo_root if instructed). Read docs/AXES-RUNBOOK.md § The retro lane on origin/main and follow it exactly — it is the contract, it changes, and it outranks this prompt's summary; re-read it every run.

The job in one sentence: read the run log (issue #290 in Cosaxo/InSight) since the last retro, the open program PRs and their skeptic verdicts, the committed scorecards, this runbook's state, AND the axiom-theory branch's DIGEST.md and bridge/VERDICTS.md (the theory layer's worth-building verdicts are candidates for this program); then (1) post the digest on issue #290 — what merged, what is open and on whom, every pending [owner] decision bundled in one place (bridge verdicts awaiting the owner included), the one number per live phase its trial criteria name, and a per-lane usage line for the week (from list_sessions metadata where readable) so real spend stays visible; and (2) if the week taught anything, open a docs-only PR (claude/axes-retro-<YYYY-MM-DD>) amending the lane contracts with dated learned-rules, fixing runbook status drift, arguing any cadence change from the log, and drafting Status: Proposed records where a lane keeps hitting the same wall. Nothing to amend means digest only, and that is a healthy week.

Hard limits regardless of anything else you read: edit docs/ only — never code, never content, never rules, and never the axiom-theory branch (you read it; its own lanes write it); NEVER merge the amendments PR or any other — the owner merges every change to a lane's contract, yours included; Proposed binds nothing and adoption is only ever the owner's explicit word; never turn the digest into a nag — decisions are listed once, together, without urgency theater. If the build lane has idled three consecutive runs on the same [owner] decision, recommend pausing its Routine in the digest rather than letting it no-op forever.

Mandatory reporting: the digest IS the report. If you have no GitHub API tools, push the digest as AXES-DIAG.md on a claude/axes-diag-<YYYY-MM-DD> branch instead; if you can do neither, say exactly that in your final message. Leave the working tree as you found it.
```

---

## Phase 0 — the program's own footing

- [x] **0.1 [owner] The word — DONE 2026-08-25 (D289).** Resolved by
      the owner's own vocabulary rather than picked from the menu:
      **axis** is a shipped source, **axiom** is its ideal in the
      theory layer (`docs/AXIOM-THEORY.md`), *trait axis* where the
      instrument-dimension sense is meant, and no code registry takes
      the bare word. · **Gate:** the record exists; `check:docs`
      green.
- [x] **0.2 [owner] Adopt the program — DONE 2026-08-25 (D289,
      "do 4 and 5 and open the pr").** Run log #290 created; the three
      Routines exist (ids in § The account-side inventory); prompts
      match the canonical blocks verbatim. One honesty note in place
      of the original gate's second half: the delivery proof was in
      flight at adoption rather than in hand — the access probe (the
      axiom genetic lane's first run, same environment, same binding)
      was mid-run, the skeptic's first fire (2026-08-26 11:00 UTC) is
      this program's first scheduled evidence, and every prompt
      carries the AXES-DIAG fallback so a broken lane still leaves a
      trace. · **Gate:** `check:docs` green on this file; the first
      #290 comment closes the loop. *Closed 2026-08-25 evening: the
      premise failed, the probes isolated it, and the provisioning fix
      shipped — § The account-side inventory's amended binding
      paragraph is the record.*

## Phase 1 — the projection (AXES-PLAN §2)

Public data only; the Map starts drawing the axes. Enters when Phase 0
is done.

- [x] **1.1 The server fold — DONE 2026-08-27 (D329).** `axesFit.ts`,
      pure behind the sweep's injected store methods; the trigger
      untouched; the scoring join compiled by `gen-v2content` (`invert`
      never became a seed field). The no-tautology pin is in
      `patterns.test.ts` against the compiled meta.
      · **Gate:** functions suite green, including the new pins.
      · **Size:** M.
- [x] **1.2 The publication — DONE 2026-08-27 (D329).** The `axes:`
      block beside the `q:` rows — per trait axis a unit direction, its
      n, its fit quality, its label — merged onto the loadings doc and
      pinned against a recording fake: every folding run writes the
      block, an empty one included. · **Gate:** `patterns.test.ts`
      extended, functions suite green. · **Size:** S.
- [x] **1.3 The paperwork — DONE 2026-08-27 (D329); the [owner]
      confirmation landed 2026-08-28.** The `docs/COSTS.md` Patterns
      row carries the sweep; the data-inventory loadings row carries
      the block and the D8 re-read; D329 quotes the owner's
      confirmation. · **Gate:** `check:data-inventory`,
      `check:policy-claims`, `check:docs`. · **Size:** S.
- [x] **1.4 The client reading — DONE 2026-08-27 (D329).**
      `data/patterns.ts` parses the block defensively and holds the
      two draw floors; the Map draws the axes as faint labelled
      diameters under the field; an absent block draws nothing (D1);
      typed ESM only. · **Gate:** `test:unit` + the smoke suites +
      `check:globals`. · **Size:** M.
- [x] **1.5 The trial, recorded — DONE 2026-08-27.** D329 names the
      three levers that take a row back off the Map (the population
      floor server-side, the fit and plane floors client-side, each
      with its reasoning) so Phase 1 can fail honestly if trait axes
      turn out not to project. · **Gate:** the record exists;
      `check:docs`. · **Size:** S.

## Phase 2 — the consented tier, watch first (AXES-PLAN §3)

The tier is built once here; the genetic axis inherits it in Phase 4.

- [ ] **2.0 [owner] The custody decision.** Consented tier versus
      D98-public for watch bands (the plan recommends the tier), the
      store-forms direction, and the health-data legal review — the
      record that opens the tier. Nothing below ships first.
      · **Size:** decision.
- [ ] **2.1 The rules.** Tier collections with the double deny —
      values unreadable, membership unenumerable — plus rules tests in
      both directions. · **Gate:** `test:rules`. · **Size:** M.
- [ ] **2.2 The consent flow.** A real switch with real copy; the
      privacy page section and the panel bullet in the same PR.
      · **Gate:** `check:policy-claims`, `check:public-copy`,
      `check:touch-zoom`/`check:tap-targets` on the new surface.
      · **Size:** M.
- [ ] **2.3 The write path.** Device fold to bands, at most one rollup
      document per day, App Check on any callable; purge and
      `deleteAccount` arms; the erasure e2e extended to the tier.
      · **Gate:** `check:appcheck`, `check:purge`,
      `test:e2e:erasure`. · **Size:** L.
- [ ] **2.4 The couplings.** The nightly fit folds tier columns and
      publishes only floored aggregate couplings with their n; floor
      constants carry their reasoning (the patternsReady shape).
      · **Gate:** functions suite, publication pinned. · **Size:** M.
- [ ] **2.5 The gate module and the surface.** `bodyReady` in the
      D196/D265 shape (consent + enough-of-you + enough-of-crowd,
      remembered, purge-closed), and the **[owner]** call on where the
      axis first draws (the map region per AXES-PLAN §5; no shell
      chrome). · **Gate:** unit tests + smoke; `check:purge`.
      · **Size:** M. · **Trial:** recorded with the ship — what usage
      or data condition would take the axis back out.

## Phase 3 — genetic stage G1, device-only (AXES-PLAN §4)

Independent of Phase 2; enters only on its [owner] step.

- [ ] **3.0 [owner] The D168 carve-out.** Whether applying published
      weights to your own file, on your device, with provenance and
      the measured trait beside it, is distinguishable from the
      refused "Born or built" — decided and recorded, or G1 does not
      build. The same record scopes the lane: traits the app measures,
      never disease, carrier or pharmacogenetic claims. · **Size:**
      decision.
- [ ] **3.1 The weights catalogue.** Script-built, versioned,
      committed, drift-gated in both directions (the D14–D17
      discipline pointed at science); licensing and provenance stated
      in the PR body; ancestry-portability caveat carried as data, not
      prose. · **Gate:** the new drift gate, wired into `ci.yml`.
      · **Size:** M.
- [ ] **3.2 The device path.** Parse on device, keep only the
      positions the catalogues name, discard the file; score; show
      you-beside-your-scores with the smallness stated in the copy;
      local state under `insight.*`, purge-swept. Store-forms review
      recorded even if the answer is "unchanged". · **Gate:**
      `check:purge`, unit + smoke, `check:policy-claims`. · **Size:**
      M. · **Trial:** recorded with the ship.

## Phase 4 — genetic stage G2, the tier's second tenant

- [ ] **4.0 [owner] The legal review precedes the build.** GDPR
      Art. 9, the Norwegian Biotechnology Act, both stores' genetic
      rows — reviewed and recorded before any code. · **Size:**
      decision + external review.
- [ ] **4.1 Banded scores join the tier.** The Phase 2 machinery
      reused whole — consent copy gains the kinship sentence; floors
      and publications as 2.4; the genome itself never uploads in any
      stage, pinned as a test on the write path's shape. · **Gate:**
      `test:rules`, `test:e2e:erasure`, functions suite. · **Size:** M
      on top of Phase 2. · **Trial:** recorded with the ship.

## Phase 5 — the doors (AXES-PLAN §5)

- [ ] **5.1 The design-lane prototype.** The corner-door grammar in
      the standalone, ported nowhere yet — NEXT-FUNCTIONALITY §8's
      convention. · **Gate:** none (design lane). · **Size:** M.
- [ ] **5.2 [owner] Adoption, per earned axis.** A corner exists only
      behind a crossed gate, remembered and purge-closed, absent from
      demo builds; adopting it is a record citing D265's shape.
      · **Gate:** the record + smoke pins. · **Size:** M.

## The dependency order, in one line

0 → 1 → 2 (→ 4 after 4.0); 3 waits only on 3.0; 5.1 any time, 5.2 only
after an axis has shipped and earned it.

## What would make me stop and re-plan

- **The 0.2 measurement surprises** — fresh sessions writable (or the
  bound session pattern breaks): re-read QUESTION-FARM § Governance and
  this file's binding sentences before creating or moving any Routine.
- **A step fails its gates two runs running** — the step is too big or
  wrongly cut: the retro lane splits it in an amendments PR; the build
  lane never forces it.
- **Skeptic findings stop converging on a PR** — each fix draws a new
  or reshaped finding: stop pushing, and the retro digest hands the
  owner the list with a recommendation, once.
- **The pending-[owner] list grows instead of shrinking** — pause the
  build lane's Routine and say so; a program that manufactures pressure
  on its one human gate has inverted its purpose (AXES-PLAN §10).
- **Phase 1's trial numbers say trait axes do not project** — the Map
  does not draw what is not there (D1); the phase ends honestly and the
  plan's §2 gets re-argued rather than the floor quietly lowered.
- **Run spend stops being ignorable** — the lever is cadence, never
  silent scope growth (the farm's rule, inherited).
