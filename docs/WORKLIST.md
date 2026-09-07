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
- [ ] `[claude-2]` The fit scorecard readable from `main` — the axes retro calls it the highest-leverage item in the queue (run log #290) `[ask]` — the shape of the reader is a design question before it is code
- [ ] `[claude-3]` Convert one provider module off the spec-layer global bridge, per `src/v2/README.md` § Migration path (transpose the meter, then the guard sweep) — a standing item: when it is the topmost open line, one module per PR — done: `check:globals` rule 4's baseline lowered in the same PR — gate: `npm run check:globals`, `npm run test:unit`, `npm run lint`
- [x] `[claude-3]` The facet and position item banks — the compass's 36 position items (verbatim from `design/standalone-2026-09-07/politics-deep.jsx`) into `content/tests.json` with `facet` + `invert` carried on the bank doc, the generator carrying both, `content-parity`'s K per level, `testItemMeta`'s id join (`VISION-2026-09-07.md` §2.1, §2.5); the Big Five's 120 facet items written in the app's voice, four per facet, keyed two each way (the owner's 2026-09-07 ruling, D414) — done: the eager delta quoted (~0), the seed appends and never re-keys — gate: `npm run check:content`, `npm run check:eager-content`, `npm run test:unit`, `npm run test:scripts`, `npm run test --prefix functions` — **built 2026-09-07 (D415)**
- [ ] `[claude-3]` The facet fold — `facets` on `PassiveTest`, the all-items floor (four for a facet, two for a position), the level-one rule (an axis is its facets' mean once every one is measured), the facet norms at D157's floors, the positions inside D331's consent gate (`VISION-2026-09-07.md` §2.3) — gate: `npm run test:unit`
- [ ] `[claude-3]` The Big 5 and Politics tabs in depth, reading — two lazy typed panels under the result cards: domain and axis rows, the 4–20 and 0–100 tracks, the facet and position rows with their counts under the floor, the paragraphs, the norm rings where a norm exists; Mira's in demo, yours live; the 12px floor, 44 px rows, no window global (`VISION-2026-09-07.md` §1.3) — gate: `npm run test:unit`, `npm run check:tap-targets`, `npm run check:a11y`, `npm run check:bundle`, `npm run check:globals`
- [x] `[claude-3]` The in-place questions — *Six questions place them →* on the compass and the same grammar per Big Five domain, each tap a `LIVE.vote` on the bank item, no device key (`VISION-2026-09-07.md` §2.2) — gate: `npm run test:unit`, `npm run check:answer-shape`, `npm run check:purge` — **not built: the owner ruled feed only, 2026-09-07 (D414)**
- [ ] `[claude-3]` The first day of Circle and 1v1 — the Day beats (today sealed, tonight, tomorrow revealed) over `LiveDuelPanel`'s first-run branch, the invitation and link heroes as redresses of `LdInvites` / `LdJoinPending`, the *Start another* row sharing the rail's handler, the six demo states as mount fixtures, today's question as a prop and never a window global (`VISION-2026-09-07.md` §3) — gate: `npm run test:unit`, `npm run check:a11y`, `npm run check:globals`, `npm run check:tap-targets`
- [ ] `[claude-3]` The person overlay on paper — the receipts' first port (the exception side leads, *All N* / *Fewer*), *Play together* as doors, the read-each-other table with the dot runs staying on the 1v1 screen, and the feed's two-option `minWidth` line (`VISION-2026-09-07.md` §4) — gate: `npm run test:unit`, `npm run check:labels`, `npm run check:public-copy`
- [x] `[claude-3]` The 12px microtype floor, app-wide — `tokens.css`'s shared classes (`.kicker`, `.klabel`, `.legend`, `.h-meta`, the tab bar, `.search-group`) to 12px / 0.07em, the sheet sweeps in `src/v2/styles.css` and `ui/patterns.css`, the touched modules' inline sizes (`VISION-2026-09-06.md` §1) — done: eager-bytes delta quoted in the PR (602 → 601 KB) — gate: `npm run check:bundle`, `npm run test:unit`, `npm run lint` — **built 2026-09-06 (D391)**
- [x] `[claude-3]` The Patterns instrument on paper — `lens-paper` by default, the boxless `ln-card`, the guide ⓘ with the moved legends (every basis sentence survives, one tap away), the ring's in-rim labels + serif hub + quiet chords + ink-in, the Oracle's serif halves + 1·2·3 strip, the People rows + rings + tap-names (`VISION-2026-09-06.md` §2) — done: `data/patterns.test.ts` byte-identical — gate: `npm run test:unit`, `npm run check:tap-targets`, `npm run check:a11y`, `npm run check:bundle`, `npm run check:globals` — **built 2026-09-06 (D391)**
- [x] `[claude-3]` The header dial and the docking — the lens state lifted to the shell as props, `DAILY_DOTS` + `PT_DIAL` in the dock slot, the Patterns ruler folding on scroll or use, `hideSwitcher` on the daily (`VISION-2026-09-06.md` §2.5, §3) — done: the two `goNav` pins still green; the dial and the in-page ruler agree — gate: `npm run test:unit`, `npm run check:globals` — **built 2026-09-06 (D392)**
- [x] `[claude-3]` The feed's paper ground and the folded topics — boxed card skins onto the rule ground (the paid card keeps its box), the *all topics* disclosure chip, neutral check chips, the `headHold` guard (`VISION-2026-09-06.md` §4) — gate: `npm run test:unit`, `npm run check:tap-targets` — **built 2026-09-06 (D392)**
- [x] `[claude-3]` The ballot as a hairline row and *why this question* — `.ds-ballot`/`.ds-half` with its own height token (NOT the repo's `--field-size`, which is a font size), the press tint, the ⓘ icon replaced by the underlined word; the *answer anonymously* words wait on their owner row (`VISION-2026-09-06.md` §5) — done: D86's long-press edit still fires — gate: `npm run test:unit`, `npm run check:tap-targets`, `npm run check:answer-shape` — **built 2026-09-06 (D392)**
- [x] `[claude-3]` The paper polish pass — the result card boxless with the serif identity (the rule line and the never-ported Born-or-built deleted), the constellation ink-in, the profile's hairline sections, the mirror field/tab/pops patches, the serif prompts on 1v1 and Circle, the Mirror lens-row hairline (`VISION-2026-09-06.md` §6) — gate: `npm run test:unit`, `npm run check:labels`, `npm run check:public-copy` — **built 2026-09-06 (D392)**
- [x] `[claude-3]` The Patterns lenses take the 2026-09-02 instrument — `lens.css` into the patterns chunk, the Map as a ring, the Oracle in the field, the People lens's agreement colours and "Most like you" rail, the eleven dead selectors in `ui/patterns.css` deleted (`VISION-2026-09-02.md` §1.1–§1.4, §1.6) — done: §1.6's pins green and `src/v2/data/patterns.test.ts` untouched — gate: `npm run test:unit`, `npm run check:tap-targets`, `npm run check:a11y`, `npm run check:bundle`, `npm run check:globals` — **built 2026-09-02 (D362)**
- [x] `[claude-3]` The Patterns shell: the meta line, the topic select, the swipe axis whose far end exits through `NAV.goNav('track:world')` (`VISION-2026-09-02.md` §1.5) — done: the far-end swipe calls `goNav` once and the first-stop swipe springs back, both pinned; the retired oracle hint key gone from the purge list — gate: `npm run test:unit`, `npm run check:purge`, `npm run check:globals` — **built 2026-09-02 (D362)**
- [x] `[claude-3]` The prompt voice: `--serif` + Spectral (one face, 500 latin — the font ceiling, see D362) at the five prompt sites, the tab bar at 500/700 without the inset ring, the `.sg-rise` / `.sg-tick` keyframes (`VISION-2026-09-02.md` §2.1, §2.3) — done: first-paint bytes before and after quoted in the PR — gate: `npm run check:bundle`, `npm run check:public-copy`, `npm run test:unit` — **built 2026-09-02 (D362)**
- [x] `[claude-3]` The split ballot on the daily's world card and every feed vote card (`VISION-2026-09-02.md` §2.2) — done: the `.sd-opt` residue deleted from `src/v2/styles.css`, D86's long-press edit still fires, the eight mount suites green — gate: `npm run test:unit`, `npm run check:tap-targets`, `npm run check:answer-shape` — **built 2026-09-02 (D362)**
- [x] `[claude-3]` Topic-hued answer rows in `ui/LiveAnswerRows.tsx` and `spec/mirror-answers.jsx`, and the quieter Crossroads tree in `spec/paths-card.jsx` (`VISION-2026-09-02.md` §3) — gate: `npm run test:unit`, `npm run check:labels` — **built 2026-09-02 (D362)**
- [x] `[claude-3]` The paid door's rate rows and pricing tokens in `spec/suggestions.jsx` (`VISION-2026-09-02.md` §4.1) — done: every token prints a committed `content/pricing.json` number; the two sub-10.5px labels port at 10.5 — gate: `npm run test:unit`, `npm run check:pricing` — **built 2026-09-02 (D362)**
- [x] `[claude-2]` Re-plan `VISUAL-REQUESTS.md` request 1 (trait-axis directions) against the ring Map the 2026-09-02 vision draws — an axis as a band on the rim or a chord family, not a direction in a plane (`VISION-2026-09-02.md` §1.2) — a plan, not code — gate: `npm run check:docs` — **done 2026-09-02 (D362)**

## In flight

The worker moves the item it is building here with its PR link, and
back to § Open if the PR is closed unmerged.

## Parked (needs the owner)

Items the worker could not take, each with the one question or the
D334 ask that stops it.

## Done

Ticked items move here when their PR merges, with the PR number and
the date.

- [x] `[claude-2]` Harden the e2e wait *"learn public agg never appeared after 20000ms"* — the ceiling is **60 × 500 ms**, matching the FIRST wait in the file rather than the warm ones, and argued in a comment. This file had already made the same call once (30 → 60, for a timeout that "reads as *trigger did not fire*, which is the most misleading message this file can print"), and its argument applies here unchanged: the learn write is the only fold running the answer-key and logic-scoring arm as well as the ledger, and it lands after a deny block that invokes no function at all — so this is a second first-delivery window, not the steady state. **Raised rather than retried**, on that same comment's reasoning: a retry around a poll is a poll with a longer ceiling and harder to read, and a longer ceiling costs nothing on a run that does not need it. The message's own `40 * 500` was a second copy of the bound and is now one constant. Three local green runs, ~65s each. Worth saying plainly: three green runs do not prove a flake fixed — the ceiling argument is the evidence, and the runs only show nothing else broke. **CORRECTION, 2026-09-07 (D411): the ceiling was never the problem, and this row's fix did not fix it — the cause is now found and fixed.** Measured across seven passing runs on a clean `main`: the learn fold commits **6–15 ms BEFORE the poll starts** — ~40 ms after the answer write, against a 30,000 ms ceiling. There was no first-delivery window here too short to fit in, so neither raise (30 → 60, then this one) could have helped. `main` still fails at this assertion roughly one run in four, and when it does the fold is **absent, not late**: the trigger enters its transaction past the ledger guard, logs no error, trips no contention warning, and no aggregate appears. **The mechanism (D411): the aggregate was always in the database — the CLIENT could not see it.** The JS SDK implements `getDoc` and `getDocFromServer` as a one-shot Watch listener, and the two deliberate permission-denied writes immediately above the learn leg tear the write stream, leaving the client's watch resumed at a snapshot version older than the trigger's commit; every later read on it reports the document absent and waiting never converges. Caught with an admin probe: `EXISTS(admin)` beside `absent(client)`, sixty polls all `fromCache: false`. Fixed by reading that assertion through the admin handle — ten consecutive passing runs against a baseline that failed twice in eight. The tick is the owner's and stays as they left it.

- [x] `[claude-2]` `monitoring/engagement.json` failing three `pulse.test.mjs` cases — **already fixed on 2026-08-26, two days after run log #31 reported it, and the row was never ticked.** The suite's own comment records the flip: the two cases that asserted an absent trail were rewritten to read the REAL committed artifact, asserting shape and bounds rather than today's numbers (so an honest `--fetch` refresh cannot fail them), and the honest-absence case is now driven by the collector's fold rather than by deleting the file. `monitoring/engagement.json` is committed (866f4be, 2026-09-03) and all 63 pulse cases pass. Verified by running them, not by reading the comment.

- [x] `[claude-2]` `docs/AXES-RUNBOOK.md`'s lane table headed "Proposed schedule (UTC)" while the file's own status line says the lanes are live — the column now reads **Schedule (UTC)**, which is what it holds. The three schedules in it were already the live ones; only the header lagged.

- [x] `[claude-2]` **Write `docs/DOC-SWEEP.md`, the doc sweep lane's missing contract** — **landed 2026-09-03 in #335**, which this row did not notice. The lane's Routine (`trig_01E2bBC1QmYbkkHj3V96k6L1`) is still disabled and re-enabling it is now an owner click, not a blocked build: the row asked for the re-enable "in the same PR that lands the file", and no PR can flip a trigger on another account's subscription — `list_triggers` returns only the caller's. Carried to `OWNER-LIST.md` § Clicks.
