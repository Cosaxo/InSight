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
- [ ] `[claude-2]` Harden the e2e wait "learn public agg never appeared after 20000ms" in `firestore-tests/e2e-v2-loop.mjs` — the feed lane counted five occurrences and asked for a longer ceiling or retry-on-timeout — done: the wait retries or the ceiling is argued in a comment, three local green runs quoted in the PR — gate: `npm run test:e2e` with `HTTPS_PROXY` unset
- [ ] `[claude-2]` `monitoring/engagement.json` left behind by `npm run scorecard -- --fetch` fails three `pulse.test.mjs` cases locally (run log #31, 08-24) — done: the file is ignored or the tests read a fixture, whichever the pulse script's header argues — gate: `npm run test:scripts`
- [ ] `[claude-2]` `docs/AXES-RUNBOOK.md`'s lane table is headed "Proposed schedule (UTC)" while the file's own status line says the lanes are live — done: the header says what the column is — gate: `npm run check:docs`
- [ ] `[claude-2]` The fit scorecard readable from `main` — the axes retro calls it the highest-leverage item in the queue (run log #290) `[ask]` — the shape of the reader is a design question before it is code
- [ ] `[claude-2]` **Write `docs/DOC-SWEEP.md`, the doc sweep lane's missing contract.** Its Routine fired every second day from 2026-08-30 to 2026-09-03 and correctly refused every time — the prompt says *"if that file is not on origin/main, the lane is not live yet"* — so the lane is now disabled (`OPS-RUNBOOK.md` § 5) and stays disabled until the contract lands. The prompt already names what the contract must cover: the watermark in the `doc-sweep run log` issue, the three detectors, the two-document rotation, the edit-versus-report rule, and the no-go list. Re-enable `trig_01E2bBC1QmYbkkHj3V96k6L1` in the same PR that lands the file.
- [ ] `[claude-3]` Convert one provider module off the spec-layer global bridge, per `src/v2/README.md` § Migration path (transpose the meter, then the guard sweep) — a standing item: when it is the topmost open line, one module per PR — done: `check:globals` rule 4's baseline lowered in the same PR — gate: `npm run check:globals`, `npm run test:unit`, `npm run lint`

## In flight

The worker moves the item it is building here with its PR link, and
back to § Open if the PR is closed unmerged.

## Parked (needs the owner)

Items the worker could not take, each with the one question or the
D334 ask that stops it.

## Done

Ticked items move here when their PR merges, with the PR number and
the date.
