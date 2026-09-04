# Owner list — only you can do these

**Status: tree — folded by the console, appended by any lane.** The
fourth of the six lists (`PROGRAM-PLAN.md` §2.4, D352). A to-do item is
something a routine does; an owner item is something only the owner
can — a decision, a click in a web UI, a paste, a design, a signature.
Each row names its source and the routine or record that put it here;
a tick names what it unblocked. The console workflow regenerates the
folded sections from their sources daily (phase 2) and leaves the
appended ones alone; until its first run every row below was folded
by hand, 2026-09-02.

## Decisions

- [ ] **The theory lanes' read budget** — a charter amendment, with the wording and the arithmetic in `AXIOM-THEORY.md` § The read budget. A theory run measures $24.44 against the charter's $20, 77% of every metered dollar goes on re-reading context rather than producing output, and the lanes' inputs grow every run (the branch is 1.27MB; central reads every sibling's graph and costs $39.47 a run). No routine may amend the charter, so this is yours; the cadence has now been halved twice (D359, D363) and that bought time, not a trend reversal — the graphs grow with runs, not with days, so the ~$8 a run stands. *Source:* `USAGE-REDUCTION.md` §§ 1–2, 6, 9.
- [ ] **Rotate the night worker's session — ~$233 a day, the largest single line in the program.** `session_013UfS4opexyJsoD3K9NxqFF` has been alive since 2026-08-24, is woken five times a night, and has metered $2,325.68 against 968.8M cache-read tokens — two thirds of everything the routines on that account have ever spent, and it grows every night. A fresh session per night does the same work off a prefix twenty-five times smaller. The cost of rotating: the lane's push authorization is a human turn in *that session's own history* (D326 §2) and a new session does not inherit it, so a new one needs your sentence before it can push. Keeping it: the arithmetic above, compounding. *Source:* `USAGE-REDUCTION.md` §5.1.
- [ ] **Whether to rotate the axiom dispatcher too — ~$20 a day, and it is the one already rejected.** `session_01D44Wtdu5JfCYMJmYuKmLjc` holds 417k tokens and relays the twelve theory lanes; its own rate-limit status reads `rejected` on the bucket *with* overage. A routine did not touch it because it WORKS: rotating means re-creating fifteen triggers against a new session and adopting its charter before any theory lane runs again. Worth a cycle's outage, at a moment you choose. *Source:* `USAGE-REDUCTION.md` §5.3.
- [ ] **The consented tier's custody decision** — consented tier versus D98-public for watch bands, the store-forms direction, the health-data legal review. Nothing in Phase 2 ships first. *Source:* `AXES-RUNBOOK.md` 2.0.
- [ ] **The D168 carve-out for the genetic axis** — whether applying published weights to your own file, on your device, is distinguishable from the refused "Born or built". G1 does not build without it. *Source:* `AXES-RUNBOOK.md` 3.0.
- [ ] **The genetic legal review** — GDPR Art. 9, the Norwegian Biotechnology Act, both stores' genetic rows, before any G2 code. *Source:* `AXES-RUNBOOK.md` 4.0.
- [ ] **Era-scoped instrument re-serving** — whether instrument items may be served again per era, so trajectories and the ergodicity test can ever be measured. One sentence settles which. *Source:* the bridge, `bridge/VERDICTS.md` 2026-08-28 (needs-owner); the 2026-09-01 digest, item 5.
- [ ] **One landslide predicate or two** — `rank.ts` sinks a question at a raw top share; the scorecard's retire proposal grades on evenness; they disagree both ways, and making them one changes what the feed serves. *Source:* D349 § Two things that are the owner's call.
- [ ] **The functions coverage scope** — whether `paid.ts` or the moderation queue belongs in `functions/vitest.config.ts`'s coverage now that the pre-D98 reason for the old scope is gone. *Source:* D349 § One open question.
- [ ] **Whether the ops dispatcher is retired onto the web-UI path instead** — a Routine created at claude.ai/code/routines with the repository attached starts cloned and needs no relay, and the four ops lanes still to be created are being created that way anyway. Keeping it: one human turn now, one relay per firing, and one queue that can stall four lanes at once — the failure § Platform measurements recorded on another dispatcher on 2026-09-01, and the shape this refusal repeats. Retiring it: four Routines re-created by hand in Claude 2's web UI and rebound. The probe's row measures the fact; the choice is yours. *Source:* `OPS-RUNBOOK.md` §2.2, § The ops dispatcher; D353.
- [ ] **Whether to apply the usage levers, and which** — *you answered 2026-09-03: "do that" to L1 and L2; the tick is yours to make.* Applied on this account: night shift B cut to three firings a night, and both silent lanes disabled. ~$175 a day. One half refused by the tooling and waiting on you — see Clicks. *Source:* `USAGE-REDUCTION.md` §6.
- [ ] **The two silent lanes — disable, or make them report?** — *you chose both, 2026-09-03; the tick is yours to make.* Disabled, and the nightly algorithm improver's brief now ends with the rule that is its condition for coming back: every run says on the Ops run log whether it pushed, and if not, why. The DB lane's copy of that paragraph was refused by the classifier and is staged for a paste. *Source:* `USAGE-REDUCTION.md` §6; `PERMISSIONS.md`.
- [ ] **Two night shifts, or one?** They audit the same tree on the same night from two accounts, and the collision machinery is a cost of running both. On the measured side that is ~$297 a night; the other account is not readable from here. It is a product decision rather than waste — the output merges — which is why the recommendation is to keep both and apply L1 to each. The recommendation is to keep both, apply L1 (audit once, fix four times) first, and re-read the band after one window. *Source:* `USAGE-REDUCTION.md` §4.1.
- [ ] **The merge shift's nine daily firings** — `claude-opus-5` at high effort with ultracode, polling for a label GitHub already pushes as an event. Free to re-shape now (the lane relays nothing yet), expensive later. *Source:* `USAGE-REDUCTION.md` §4.2, L2.
- [ ] **The theory lanes' second set — HELD, and the tick would revive it.** `PROGRAM-PLAN.md` §4.3 prices it at twice the month the twelve cost today, on the bucket no session here can read. Your *"reduce the theory production"* of 2026-09-04 halved the first set (D363), so a phase that doubles it is held rather than started: `PROGRAM-RUNBOOK.md` phase 4, and your answer 1 of 2026-09-02 is marked reversed where it is recorded. *Source:* `USAGE-REDUCTION.md` §4.3, §9, L9.
- [ ] **What a tick on a mirrored row means** — a row the console folded into this file mirrors an unchecked step in a runbook. Ticking it here deletes it from the folded block on the next run (intended: "it is done"), but does not check the step it mirrors, so the console raises it again unticked on the run after. Two ways out, both one sentence: a tick here writes through to the runbook step, or the folded rows are not tickable at all and the tick belongs on the source. Measured 2026-09-03 while fixing the fold's other defect; not decided by a routine, because it is about what your tick is FOR. *Source:* the night shift, 2026-09-03; `PROGRAM-RUNBOOK.md` § The console.
- [ ] **Adoption per earned axis** — a corner door exists only behind a crossed gate; adopting one is a record citing D265's shape. Waits on an axis earning it. *Source:* `AXES-RUNBOOK.md` 5.2.
- [ ] **Anonymous answers and private test results** — the first amendment D98 would notice: does the option exist, on which surfaces (the design draws it on the feed and the daily's world card, never duels), and what may the account panel promise. The surface-value shape and the rejected field shape are written in `VISION-2026-08-26.md` §1; the 2026-09-02 design still draws the toggle. *Source:* D310; `VISION-2026-09-02.md` §6.
- [ ] **The subscription price — a split across seats, or a per-buyer price** — the catalog window prints the answer, so the window (`design/standalone-2026-09-02/catalog-sheet.jsx`, polished again in the 2026-09-02 upload) waits on it, and with it the seat and pledge records. *Source:* `VISION-2026-08-26.md` §2.2; `VISION-2026-09-02.md` §4.2.

## Clicks

- [ ] **Paste the cadence correction into `CHARTER.md` on `axiom-theory`** — the lanes' contract still says *"every lane every other day"* and its §10 table still carries the every-other-day crons, which stopped being true on 2026-09-03 and are now two re-paces behind (D359, D363). Twelve lanes read that file every run. No routine may amend the charter and no session here may push that branch, so the wording is written out as three replacements in `design/charter-cadence-2026-09-04.md` — §2's opening sentence, §2's Review row, §10's cadence paragraph and table. It is a paste, not a drafting job. *Source:* D363; `AXIOM-THEORY.md` § The account-side inventory.
- [ ] **Decide the three model-less theory Routines** — review, ties and interests carry no model on their record where the other nine carry `claude-fable-5-1` (read off `list_triggers`, 2026-09-04). All twelve are dispatcher-bound, so the field governs the dispatcher's turn rather than the lane run, which is why nothing is visibly broken; the roster is still no longer uniform, and a Routine's model is yours alone to set. Either set the three to match, or say the field is moot for a bound Routine and the record should stop implying it is not. *Source:* D363; `ROUTINES.md` § The theory lanes.
- [ ] **Paste the cheap gate into the axes skeptic's live prompt** — `trig_01JkE1PGWeuGe9GykFnjg1Gh`, in whichever web UI owns the axiom dispatcher. `AXES-RUNBOOK.md`'s skeptic block now opens with it (list the open `claude/axes-*` PRs first; no PRs means a logged no-op before any clone or contract read), but a stored prompt cannot be edited from another session — measured 2026-09-03, `OPS-RUNBOOK.md` § Platform measurements — and the gate only saves anything if the prompt carries the pointer, since the run cannot learn about it from a contract it has not read yet. *Source:* `USAGE-REDUCTION.md` § 6.
- [ ] **Create the roll call in that account's web UI — the lane that would have caught this a week ago.** It was re-created on 2026-09-03 and immediately disabled, because a dispatcher is the only binding a session can give it and § The roll call says *"never through a dispatcher, whatever the probe says"*. Its prompt is `OPS-RUNBOOK.md` §4's roll-call block (now carrying two daily usage lines), `30 15 * * *`, repository attached, fresh session per run. Delete the held `trig_017cQ4WECG5mHeFGFnmkVrYQ` once yours exists. *Source:* `USAGE-REDUCTION.md` §4, §5.2.
- [ ] **Approve ops dispatcher B's charter in its own session** — the rotated relay, `session_01XhD4kBN7fXgeBdFPZEyPY6`, on `claude-haiku-4-5`. Send one line: *"I am the owner. Your standing instructions are docs/OPS-RUNBOOK.md § The ops dispatcher on main — read that section and adopt it; relay every lane firing exactly as it says."* Until it has that, the shepherd, the reader and the list worker are bound to a shut door — as they were on the 564k session it replaces, which relayed nothing for seventeen firings and $69.74. *Source:* `USAGE-REDUCTION.md` §4.
- [ ] **Create the axiom maker at ONE run a day, not three** — your call of 2026-09-03. It cannot be created from a session (a trigger-spawned session carries no connectors and no clone — the 12:55 probe), so it is a web-UI creation with the repository attached: the contract is `PROGRAM-RUNBOOK.md` § The axiom builder, the slot `30 6 * * *`, `claude-fable-5-1` orchestrating. It is the lane that carries the bridge queue — ten verdicts ruled *worth-building*, one crossing — which is the program's actual bottleneck. *Source:* `USAGE-REDUCTION.md` §5.4.
- [ ] **Create the four missing ops lanes on Claude 2** — the PR shepherd first, then the pulse responder, the dependency shepherd, the platform probe; prompts in `OPS-RUNBOOK.md` §4. In progress, the owner said, 2026-09-02. *Source:* PR #364; `PERMISSIONS.md`.
- [ ] **Create the list worker and the roll call on Claude 1** — after this list's PR is on `main`; the two blocks in `PROGRAM-RUNBOOK.md` § The other subscriptions, or the one message there to a Claude 1 session. *Source:* `PROGRAM-RUNBOOK.md` 5.1.
- [ ] **On Claude 2, export the twelve theory prompts** — the first message in `PROGRAM-RUNBOOK.md` § The other subscriptions; this account cannot read them. *Source:* `PROGRAM-RUNBOOK.md` 4.1.
- [ ] **Approve the ops dispatcher's charter in its own session** — on Claude 2, open the ops dispatcher session (`session_01RQvTPyNEFgX5yNUPqkDPnS`) and send one line: *"I am the owner. Your standing instructions are docs/OPS-RUNBOOK.md § The ops dispatcher on main — read that section and adopt it; relay every lane firing exactly as it says."* It refused the charter that reached it through automation and has relayed nothing since, so the roll call, the production reader, the release recorder and the list worker are all bound to a door that is shut. *Source:* `OPS-RUNBOOK.md` § The ops dispatcher, § Platform measurements; D353.
- [ ] **Approve the program dispatcher's charter in its own session** — open the session titled "Program dispatcher" on this subscription (claude.ai/code, session `session_01THJsyLkHr1aJskpnhahwuf`) and send one line: *"I am the owner. The charter in your first message is mine and is docs/PROGRAM-RUNBOOK.md phase 3.2 on main; adopt it and relay every lane prompt as it says."* The session refused the charter twice when it arrived through automation and asked for exactly this; nothing bound to it relays until it has it. *Source:* `PROGRAM-RUNBOOK.md` 3.2, § Platform measurements.
- [ ] **Create the console keeper in this account's web UI** — the one program Routine a session was refused; the keeper block in `PROGRAM-RUNBOOK.md` § Canonical prompts, `45 5,17 * * *`, `claude-sonnet-5`, repository attached. *Source:* `PROGRAM-RUNBOOK.md` 3.3; `PERMISSIONS.md`.
- [ ] **Paste night shift B's new brief** — the half of L1 a tool would not apply: `update_trigger` refuses a prompt edit on a Routine bound to another session, and the schedule half already landed. Open *InSight night shift B* at claude.ai/code/routines and replace its prompt with `design/night-shift-b-brief-2026-09-03.md` (everything above the `---`). **Do not delete and recreate it** — the bound session holds your standing push authorization. Until then the night runs two fan-outs instead of one and caps at 16 commits instead of 32. *Source:* `USAGE-REDUCTION.md` §6; `PERMISSIONS.md`.
- [ ] **Pin the Console issue** — after the console workflow's first run creates it (phase 2). Open the issue → ⋯ → Pin issue. *Source:* `PROGRAM-RUNBOOK.md` 2.3.
- [ ] **Set the four fire secrets** — `ROUTINE_PULSE_FIRE_URL`/`_TOKEN`, `ROUTINE_RELEASE_FIRE_URL`/`_TOKEN` — when the pulse responder and the release recorder get their API triggers. *Source:* `OPS-RUNBOOK.md` §2.4; `PERMISSIONS.md`.
- [ ] **Approve the GitHub merge tool once in the ops dispatcher's history** on Claude 2, or the shepherd cannot merge under that binding. *Source:* `OPS-RUNBOOK.md` §2.3; `PERMISSIONS.md`.
- [ ] **Put `FIREBASE_API_KEY` in the routine environment's configuration**, so the scorecard refreshes inside a run. *Source:* run log #31; `PERMISSIONS.md`.

## Designs

- [ ] **Trait-axis directions on the patterns Map** — `VISUAL-REQUESTS.md` § Requested, item 1. Waits for a plan, then a draft, then you.
- [ ] **The corner doors for earned axes** — item 2 there; the grammar is prototyped in a design before it is ported (AXES-PLAN §5.3).
- [ ] **The fit scorecard's reader** — item 3 there; the retro's highest-leverage item, an [ask] on the worklist because its shape is a design question.

## Approvals

The rows in `MERGE-LIST.md` § Open — tick the ones you want merged.

<!-- console:begin -->
- [ ] 18 PR row(s) and 4 branch row(s) waiting for a tick in `docs/MERGE-LIST.md` § Open (2026-09-04).
<!-- console:end -->

## Store and legal

The open boxes in `LAUNCH-RUNBOOK.md`, folded here by the console from
phase 2 on. Three of them today, as examples of the shape: 5.5 the
ninth monitoring alert is committed and silent (reopened by D349) ·
4.4 the privacy nutrition label, the last manual form · 5.13 the
read-only observer (D292). The Play signing SHA-256 placeholder in
`web/.well-known/assetlinks.json` keeps `check:store-copy` red on
`main` until the Play Console issues it (D345).

<!-- console:begin -->
- [ ] **0.3 Put the protection rules on the `production` environment
      (D87)** — *Source:* `docs/LAUNCH-RUNBOOK.md`.
- [ ] **1.1b [PARKED — D42] Register the ENK and apply for the D-U-N-S** — *Source:* `docs/LAUNCH-RUNBOOK.md`.
- [ ] **1.4 Firebase Console → App Check: register web + iOS** — *Source:* `docs/LAUNCH-RUNBOOK.md`.
- [ ] **2.1 [PARKED — D42] Android config** — *Source:* `docs/LAUNCH-RUNBOOK.md`.
- [ ] **2.6 [PARKED — D42] Android signing** — *Source:* `docs/LAUNCH-RUNBOOK.md`.
- [ ] **2.7 The app-link fingerprints — the file is filled, the deploy
      landed 2026-08-20 (see 0.2); the on-device link tap is what
      remains** — *Source:* `docs/LAUNCH-RUNBOOK.md`.
- [ ] **3.1 [PARKED — D42] Upload a signed AAB to a Play testing track** — *Source:* `docs/LAUNCH-RUNBOOK.md`.
- [ ] **3.2 TestFlight with ten testers, not five** — *Source:* `docs/LAUNCH-RUNBOOK.md`.
- [ ] **3.3 Walk the on-device verification list** — *Source:* `docs/LAUNCH-RUNBOOK.md`.
- [ ] **3.4 Only after 24–48h of App Check metrics showing verified
      requests near 100%,** — *Source:* `docs/LAUNCH-RUNBOOK.md`.
- [ ] **4.3b EU trader status (Digital Services Act) — a blocker nothing in
      this repo knew about** — *Source:* `docs/LAUNCH-RUNBOOK.md`.
- [ ] **4.4 The privacy nutrition label — the last form, and it is manual** — *Source:* `docs/LAUNCH-RUNBOOK.md`.
- [ ] **5.5 Apply the nine monitoring alerts — EIGHT VERIFIED ARMED AND
      WIRED 2026-08-27 (D333); the NINTH is committed and not applied** — *Source:* `docs/LAUNCH-RUNBOOK.md`.
- [ ] **5.7 Add a second operator uid** — *Source:* `docs/LAUNCH-RUNBOOK.md`.
- [ ] **5.8 Put back the two access controls that were loosened on
      2026-08-12 to unblock the build-11 release (D117)** — *Source:* `docs/LAUNCH-RUNBOOK.md`.
- [ ] **5.9c The Algolia extension in `europe-west3` — UNINSTALLED
      2026-08-27 (D333), and the box stays open because `ext:list` found
      FOUR MORE** — *Source:* `docs/LAUNCH-RUNBOOK.md`.
- [ ] **5.12 Turn on Cloud Billing export to BigQuery — so the prediction
      can be diffed against the invoice** — *Source:* `docs/LAUNCH-RUNBOOK.md`.
- [ ] **5.13 Stand up the read-only observer (D292)** — *Source:* `docs/LAUNCH-RUNBOOK.md`.
- [ ] **5.11 Install the BigQuery mirror WITH the first real users — not
      before, and not after** — *Source:* `docs/LAUNCH-RUNBOOK.md`.
- [ ] **6.1 Pre-flight, before every archive and every upload:** — *Source:* `docs/LAUNCH-RUNBOOK.md`.
- [ ] **6.2 Submit to App Store review** — *Source:* `docs/LAUNCH-RUNBOOK.md`.
- [ ] **6.3 [PARKED — D42] Apply for Play production access** — *Source:* `docs/LAUNCH-RUNBOOK.md`.
<!-- console:end -->

## Done
