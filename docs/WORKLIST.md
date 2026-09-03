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
- [ ] `[claude-3]` The fit scorecard's READER — the visual half of the row now in flight below: an operator page or the Oracle's working card drawing `content/scorecard.json`'s `fit` block (`VISUAL-REQUESTS.md` §3) `[ask]` — the shape is a design question before it is code, so this waits for its design; the data half is D358
- [ ] `[claude-1]` The per-instrument joint-density aggregates and the 22-axis cross-axis structure artifact, built as ONE job over `v2_users.testResults` through `report-lib` — the bridge's 2026-09-01 and 2026-09-02 tests verdicts (tst-8, tst-5, tst-1, cen-8) — done: a committed artifact stating population ("answered enough test-surface feed cards", the political six consent-selected apart), precision and floor per instrument (`PATTERNS_MIN_BASIS = 8`, framed as believable-basis reliability, never privacy), suppressed mass reported, the mixture fit's method, component sweep and seed published; dormant at today's population by design — gate: `npm run test:scripts`, `npm run check:data-inventory`
- [ ] `[claude-1]` The pulse sleep/repeat within-person coupling artifact — body's and tests' 2026-08-28 verdicts folded as one (bod-5, bod-3, tst-2, tst-7, que-2) — done: the POPULATION-AVERAGE within-person coupling of pulse `sleep` against same-day answering, labelled as the perception channel, floored at the standing believable-basis figure, the collection-group read over `answers` priced under the read tripwire — gate: `npm run test:scripts`
- [ ] `[claude-1]` The pairing ledger over the published aggregates, weekly through `report-lib`'s anonymous-auth path — pattern's 2026-09-02 verdict (pat-4, pat-12, cen-2, cen-10) — done: per-axis co-observation counts with a UNIT column (persons; pairs for ties), lens rows over lens ITEMS not scores, the genome column absent not zero, Fréchet intervals over single-anchor-dim cells only, `following` added to `REPORT_READ_SET` with its reason — gate: `npm run test:scripts`, `npm run check:data-inventory`
- [ ] `[claude-1]` The per-core-question shape-feature table over the committed bank — questions' 2026-09-02 verdict (que-3) — done: one script reading `content/*.json` (not the generated file, whose `topic` means two things) writing one committed JSON keyed by qid, each row saying when it joins to no fit parameter (dial/field/path/duel), vintage from `provenance.json`; a third-party lexicon (concreteness, Brady, Rathje) is NOT vendored until its licence is cleared — gate: `npm run test:scripts`
- [ ] `[claude-1]` Percept/direct-output items on the core spine — genetic's 2026-08-28 verdict (gen-10, gen-11): PROP-class bitterness, alcohol flush, earwax type, β-ionone smell as the strong set, cilantro and timing only as labelled weak-effect riders — done: core feed questions through the farm's own mechanics, wording about the percept itself (que-4), self-report only, and the flush item's store-forms weighing IN the PR body — gate: `npm run check:quality`, `npm run check:content`, `npm run check:neighbors`
- [ ] `[claude-1]` `[owner]` A five-step illness pulse on the requested construct (the sick day as bod-13's occasion covariate) — body's 2026-09-02 verdict — waits on the Art. 9 reading on `OWNER-LIST.md` § Decisions; if that reading says consent, the consent is BUILT as a sibling of `consent.political` — done: one row in `content/pulse-questions.json`, `STORE-FORMS.md` naming it in the Health row, published as the perception channel — gate: `npm run check:content`, `npm run check:quality`, `npm run check:store-forms`
- [ ] `[claude-2]` The standing replay audit — database's 2026-08-28 verdict (db-3) — done: a nightly `onSchedule` sample of a few questions rebuilt through `replay.ts`'s fold and diffed against the live aggregate, the sample's own design stated (which questions, how chosen — db-8), three numbers on an existing artifact path, the read cost pinned like every sweep — gate: `npm run test --prefix functions`, the `pulse.test.mjs` read pins
- [ ] `[claude-2]` Refit-to-refit loading drift with a refit-noise null — questions' 2026-09-01 verdict (que-8, que-2, map-3) — an admin-SDK offline job replaying from `readLedgerDay`, publishing the window's rotation component and per-item residual BESIDE D325's unaligned displacement (three numbers, each named) and stating which null over what window; **deadline:** from-ledger reproduction of the live model is possible only while the fit's whole history is younger than `LEDGER_RETENTION_DAYS = 90` (first fold ~2026-08-11, so the window closes about 2026-11-09) — build and baseline before then — gate: `npm run test --prefix functions`
- [ ] `[claude-3]` A serving stamp and a ledger-position fold cursor on `v2_question_aggs`, as ONE versioned schema change — database's two 2026-09-02 verdicts (db-8, db-9, cen-7's sixth clause) — done: `{ serving: core|tail, rankDay, rankBasis }` from a compile-time set (the `PATTERNS_QIDS` precedent, never a bank read on the answer path) plus a ledger-position cursor (never a wall-clock stamp — the code's own objection) written on all four `merge: false` fold arms AND `replay.ts`'s three rebuild writes, with a test proving no arm drops it; the seen-denominator joined from `v2_engagement_daily.attn` for feed-rendered surfaces only, null until `ATTENTION_MIN_SEEN` clears — gate: `npm run test --prefix functions`, `npm run test:rules`
- [ ] `[claude-3]` Convert one provider module off the spec-layer global bridge, per `src/v2/README.md` § Migration path (transpose the meter, then the guard sweep) — a standing item: when it is the topmost open line, one module per PR — done: `check:globals` rule 4's baseline lowered in the same PR — gate: `npm run check:globals`, `npm run test:unit`, `npm run lint`

## In flight

The worker moves the item it is building here with its PR link, and
back to § Open if the PR is closed unmerged.

- [ ] `[claude-3]` The fit scorecard readable from `main` — the DATA half: `scorecard --fetch` reads `v2_patterns/loadings` into a `fit` block on `content/scorecard.json` (D358; the bridge's 2026-08-28 map verdict, the digest's highest-leverage item). Taken by the axiom builder, 2026-09-03 — PR `claude/axiom-fit-scorecard`. The reader half is split back to § Open as its own `[claude-3]` line, since its shape is the design question the `[ask]` was about.

## Parked (needs the owner)

Items the worker could not take, each with the one question or the
D334 ask that stops it.

## Done

Ticked items move here when their PR merges, with the PR number and
the date.
