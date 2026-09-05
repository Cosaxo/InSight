# Worklist — the owner's queue, which the list worker finishes

**Status: plan notes — a queue, not a description of the app.** Nothing
on this page is built until its line is ticked with the PR that built
it. The list worker (`OPS-RUNBOOK.md` § The list worker) takes the
topmost open item each run, ships it as one pull request, and never
merges. What is on this list is the owner's act; the worker may only
tick, park, split, or copy in an issue.

## How to add an item

Any one of these is enough:

1. **Add a line under § Open**: `- [ ] what you want`. That is the
   whole format. Optional, after a ` — `: `done: what done looks like`
   and `gate: the command that proves it`. Two tags the worker reads:
   `[owner]` means *needs my decision first* (the worker skips it);
   `[ask]` means *ask before building* (the worker parks it with one
   question and moves on).
2. **Open a GitHub issue with the label `worklist`** — from the phone,
   one sentence. The worker copies it here on its next run, tagged
   `(#N)`, and the PR that ships it closes the issue.
3. **Tell any Claude session** "add to the worklist: …". It opens the
   one-line PR.

Items are taken **top to bottom**, so order is priority: move a line up
to move it forward. One item is in flight per account; an item bigger
than an afternoon comes back split into steps rather than half-built.

**The tag (D352).** Every item carries `[claude-1]`, `[claude-2]` or
`[claude-3]` — which subscription's list worker takes it. Untagged
means `[claude-2]`. Three workers, one per subscription, each taking
only its own tag, so nothing is done twice and nothing waits on one
doer; the axiom builder tags what it files and tags untagged items on
each planning run, and your tag is final. `OPS-RUNBOOK.md` § The list
worker has the guide for which account takes what.

## Open

Seeded 2026-09-01 from what the lanes themselves asked for in their
run logs and from doc drift measured that night — delete anything you
do not want.

- [ ] `[claude-2]` A `check:pick-crowds` gate for the pick-card crowd contract — the catalog lane asked three times (run log #31) and the harness that caught pk28 lived only in a scratchpad that was wiped — done: a `scripts/check-pick-crowds.mjs` with its test, on `ci` per ORIENTATION §5 — gate: `npm run test:scripts`, `npm run check:docs`
- [ ] `[claude-2]` **The rules engine is hitting Firestore's 1000-expression evaluation ceiling on the answer-write rules, and two e2e assertions may be green because of it.** Every run of `test:e2e` now logs `Unable to evaluate the expression as the maximum of 1000 expressions to evaluate has been reached` against `allow create` and `allow update` in the answers block; the reported lines moved from L1024/L1086 to L1047/L1109 between the 08:26 and 17:42 runs of 2026-09-04, which is the +38 lines #392 added to `firestore.rules` that morning — the ruleset is growing while sitting on a hard ceiling. Two assertions in that leg (`learn retry refused`, `learn edit refused`) pass by observing a denial, and a denial from the ceiling is indistinguishable from a denial by the rule that is supposed to deny: D276's class exactly, green while wrong. Done: the two assertions prove WHICH rule denied them, and the evaluation cost of the answers block is measured and brought under the ceiling with headroom — gate: `npm run test:rules`, `npm run test:e2e` with `HTTPS_PROXY` unset. Probably the cause of the item below, but that is not yet proved; the aggregate timeout is what a caller sees, this is what the engine says.
- [ ] `[claude-2]` Harden the e2e wait "learn public agg never appeared after 20000ms" in `firestore-tests/e2e-v2-loop.mjs` — the feed lane counted five occurrences and asked for a longer ceiling or retry-on-timeout — done: the wait retries or the ceiling is argued in a comment, three local green runs quoted in the PR — gate: `npm run test:e2e` with `HTTPS_PROXY` unset
- [ ] `[claude-2]` `monitoring/engagement.json` left behind by `npm run scorecard -- --fetch` fails three `pulse.test.mjs` cases locally (run log #31, 08-24) — done: the file is ignored or the tests read a fixture, whichever the pulse script's header argues — gate: `npm run test:scripts`
- [ ] `[claude-2]` `docs/AXES-RUNBOOK.md`'s lane table is headed "Proposed schedule (UTC)" while the file's own status line says the lanes are live — done: the header says what the column is — gate: `npm run check:docs`
- [ ] `[claude-2]` The fit scorecard readable from `main` — the axes retro calls it the highest-leverage item in the queue (run log #290) `[ask]` — the shape of the reader is a design question before it is code
- [ ] `[claude-2]` **Write `docs/DOC-SWEEP.md`, the doc sweep lane's missing contract.** Its Routine fired every second day from 2026-08-30 to 2026-09-03 and correctly refused every time — the prompt says *"if that file is not on origin/main, the lane is not live yet"* — so the lane is now disabled (`OPS-RUNBOOK.md` § 5) and stays disabled until the contract lands. The prompt already names what the contract must cover: the watermark in the `doc-sweep run log` issue, the three detectors, the two-document rotation, the edit-versus-report rule, and the no-go list. Re-enable `trig_01E2bBC1QmYbkkHj3V96k6L1` in the same PR that lands the file.
- [ ] `[claude-3]` Convert one provider module off the spec-layer global bridge, per `src/v2/README.md` § Migration path (transpose the meter, then the guard sweep) — a standing item: when it is the topmost open line, one module per PR — done: `check:globals` rule 4's baseline lowered in the same PR — gate: `npm run check:globals`, `npm run test:unit`, `npm run lint`
- [x] `[claude-3]` The Patterns lenses take the 2026-09-02 instrument — `lens.css` into the patterns chunk, the Map as a ring, the Oracle in the field, the People lens's agreement colours and "Most like you" rail, the eleven dead selectors in `ui/patterns.css` deleted (`VISION-2026-09-02.md` §1.1–§1.4, §1.6) — done: §1.6's pins green and `src/v2/data/patterns.test.ts` untouched — gate: `npm run test:unit`, `npm run check:tap-targets`, `npm run check:a11y`, `npm run check:bundle`, `npm run check:globals` — **built 2026-09-02 (D362)**
- [x] `[claude-3]` The Patterns shell: the meta line, the topic select, the swipe axis whose far end exits through `NAV.goNav('track:world')` (`VISION-2026-09-02.md` §1.5) — done: the far-end swipe calls `goNav` once and the first-stop swipe springs back, both pinned; the retired oracle hint key gone from the purge list — gate: `npm run test:unit`, `npm run check:purge`, `npm run check:globals` — **built 2026-09-02 (D362)**
- [x] `[claude-3]` The prompt voice: `--serif` + Spectral (one face, 500 latin — the font ceiling, see D362) at the five prompt sites, the tab bar at 500/700 without the inset ring, the `.sg-rise` / `.sg-tick` keyframes (`VISION-2026-09-02.md` §2.1, §2.3) — done: first-paint bytes before and after quoted in the PR — gate: `npm run check:bundle`, `npm run check:public-copy`, `npm run test:unit` — **built 2026-09-02 (D362)**
- [x] `[claude-3]` The split ballot on the daily's world card and every feed vote card (`VISION-2026-09-02.md` §2.2) — done: the `.sd-opt` residue deleted from `src/v2/styles.css`, D86's long-press edit still fires, the eight mount suites green — gate: `npm run test:unit`, `npm run check:tap-targets`, `npm run check:answer-shape` — **built 2026-09-02 (D362)**
- [x] `[claude-3]` Topic-hued answer rows in `ui/LiveAnswerRows.tsx` and `spec/mirror-answers.jsx`, and the quieter Crossroads tree in `spec/paths-card.jsx` (`VISION-2026-09-02.md` §3) — gate: `npm run test:unit`, `npm run check:labels` — **built 2026-09-02 (D362)**
- [x] `[claude-3]` The paid door's rate rows and pricing tokens in `spec/suggestions.jsx` (`VISION-2026-09-02.md` §4.1) — done: every token prints a committed `content/pricing.json` number; the two sub-10.5px labels port at 10.5 — gate: `npm run test:unit`, `npm run check:pricing` — **built 2026-09-02 (D362)**
- [x] `[claude-2]` Re-plan `VISUAL-REQUESTS.md` request 1 (trait-axis directions) against the ring Map the 2026-09-02 vision draws — an axis as a band on the rim or a chord family, not a direction in a plane (`VISION-2026-09-02.md` §1.2) — a plan, not code — gate: `npm run check:docs` — **done 2026-09-02 (D362)**
- [ ] `[claude-1]` Export the stored prompts of the Routines this account created in the web UI — `Nightly algorithm improvement`, `InSight DB scalability`, `InSight night shift B` — into the repository as fenced canonical blocks (`list_triggers` returns them verbatim; the register's §2, or a file it names), point each `prompt` in `routines/manifest.json` at its block, regenerate `docs/RECREATE.md` (`node scripts/routines.mjs --write`), and leave `npm run check:routines` green. Read-only against the account; one PR. Until then those three cannot be recreated from GitHub (`RECREATE.md` § Not yet recreatable) — gate: `npm run check:routines`, `npm run test:scripts`
- [ ] `[claude-2]` The same for this account: the **doc sweep's and night shift A's** stored prompts as fenced blocks on `main`, `routines/manifest.json` pointed at each and `docs/RECREATE.md` regenerated. One PR — gate: `npm run check:routines`. **Narrowed 2026-09-05 by D366**: the twelve theory prompts are no longer part of this item. Their branch is discarded by the owner's ruling and the program restarts from a fresh plan, so writing them to `prompts/<lane>.md` on `axiom-theory` would export to a discarded branch, and re-creating the lanes from them would rebuild the ladder gradient D366 names as the cause. Export them to the record if you want them; do not point the manifest's twelve rows at them as a way to restart the lanes.

## In flight

The worker moves the item it is building here with its PR link, and
back to § Open if the PR is closed unmerged.

## Parked (needs the owner)

Items the worker could not take, each with the one question or the
D334 ask that stops it.

## Done

Ticked items move here when their PR merges, with the PR number and
the date.
