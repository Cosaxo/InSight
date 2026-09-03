# Permissions — what is limiting the program, and what grants it

**Status: tree — a list, not a description of the app.** The third of
the six lists (`PROGRAM-PLAN.md` §2.3, D352). Every permission, secret,
install or setting that is limiting a routine, one row each: what was
refused or is missing · who hit it · what it blocks · the exact fix ·
status. Simple as that.

**Who writes it.** Any routine that meets a refusal appends its row
through the pull request it is already opening; a routine with no PR
posts the row on its run log and the console workflow copies it in.
**Who grants.** The owner, in the place the *Fix* column names, then
changes the status word — `open` → `granted <date>`, or `will not
grant` with the reason.

## Open

| Need | Hit by | Blocks | Fix | Status |
| --- | --- | --- | --- | --- |
| Create the PR shepherd, the pulse responder, the dependency shepherd and the platform probe | the ops session on Claude 2, 2026-09-02 — the permission classifier refused creation from a session (PR #364) | the whole merge door: five labelled PRs wait, and every approved PR will | create each in Claude 2's web UI (claude.ai/code/routines), repository attached, prompt from `OPS-RUNBOOK.md` §4; the shepherd's GitHub `pull_request` triggers added there | open — in progress (the owner, 2026-09-02) |
| The GitHub merge tool approved once in the ops dispatcher's own history | the PR shepherd's label merge under the dispatcher binding (`OPS-RUNBOOK.md` §2.3) | any merge by the shepherd | one human turn in that session approving the tool; `.claude/settings.json` deliberately omits it | open |
| The Claude GitHub App installed on the repository | the shepherd's event triggers; the console workflow's label events are GitHub's own and need nothing | acting on a label within the hour rather than at the next slot | install from the web UI's prompt when adding the trigger | open |
| `FIREBASE_API_KEY` in the routine environment's configuration | the farm (asked twice, run log #31), the pulse responder | `npm run scorecard -- --fetch` inside a routine; the scorecard stays stale between hand refreshes | the environment's settings at claude.ai/code, not a shell file | open |
| `ROUTINE_PULSE_FIRE_URL` + `ROUTINE_PULSE_FIRE_TOKEN`, `ROUTINE_RELEASE_FIRE_URL` + `ROUTINE_RELEASE_FIRE_TOKEN` | `pulse.yml` and `ios-release.yml` — the steps are committed and inert | the pulse responder and the release recorder firing from a workflow | one repository variable and one secret each, from the API trigger the web UI shows | open |
| Egress to news domains from the routine environment | the now lane (D351) | opening a story rather than only finding it — the lane runs without it | the environment's network policy; the bar tightens to "opened, and quoted" when granted | open — not needed for the lane to run |
| Creating the console keeper Routine from a session on this account | the program lanes (`PROGRAM-RUNBOOK.md` phase 3.3), 2026-09-02 — five of six Routines were allowed, the keeper was refused by the permission classifier | the charted console artifact; the pinned issue still renders without it | create it in this account's web UI (claude.ai/code/routines), repository attached, the keeper block from `PROGRAM-RUNBOOK.md` § Canonical prompts, schedule `45 5,17 * * *`, model `claude-sonnet-5` | open |
| A standing charter for a relay session, given by automation alone | both dispatchers, 2026-09-02 — the program dispatcher here and the ops dispatcher on Claude 2 each refused their seed charter as an injected prompt, and then refused what a Routine delivered next — a confirmation fired into the one, the roll call's own 15:30 UTC firing into the other | every Routine bound to either: the builder, the shift, the doers, the roll call and the improver here; the ops roll call, the production reader, the release recorder and the list worker there | one human turn in each dispatcher session adopting the charter (`OWNER-LIST.md` § Clicks) — the ops charter is now a section a session can verify against `main` for itself (`OPS-RUNBOOK.md` § The ops dispatcher, D353), which is what both sessions asked for; the alternative is creating the lanes in the web UI, fresh session per run, which needs no dispatcher | open |
| Night shift B's brief re-shaped for one fan-out a night (L1) | this session, 2026-09-03 — `update_trigger` answered *"editing the prompt of a routine whose fires deliver into a session that is not your own is not available via this tool"*; the same call's **schedule** half was allowed and landed | the difference between ~$178 and ~$140 a night, and the per-flow commit cap: with the new 3-flow schedule and the old brief the 00:00 firing still fans out, and two flows at the old cap of 8 give 16 commits a night where five flows gave 25 | paste the new brief into the Routine at claude.ai/code/routines — the text is `design/night-shift-b-brief-2026-09-03.md` on this branch. **Not delete-and-recreate**: the bound session `session_01M9cvEjdQmWYjgrWvaoXiK9` is where the owner's standing push authorization lives, and a recreated Routine that loses it audits all night and pushes nothing | open |
| Appending the reporting rule to the DB scalability lane's brief | this session, 2026-09-03 — the permission classifier refused it, having allowed the identical edit to the nightly algorithm lane four minutes earlier; not retried | nothing today (the lane is disabled). It blocks re-enabling behind the rule that would say why the lane pushes nothing | paste the paragraph from `design/night-shift-b-brief-2026-09-03.md` § The DB lane's paragraph, or re-run the edit from a session the classifier allows | open — not blocking |
| A prompt edit on a Routine bound to another session | every rebind so far (D148, D326, D350) | editing a live prompt in place | none — platform behaviour; the fix is delete-and-recreate, create first | will not grant (platform) |

## Granted
