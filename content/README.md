# Launch content

Canonical question banks and taxonomies, extracted from the v9 design
prototype (deleted 2026-07-29; in git history — `design/InSight_standalone_18.html` is the current reference). These files are the source of
truth for seeding Firestore: `scripts/gen-v2content.mjs` flattens them into
`functions/src/v2content.ts` (regenerate with `npm run build:content`),
which the `seedContentV2` callable compiles in. `npm run check:content`
regenerates in memory and compares bytes on the deploy path, so the two can
never drift silently. After launch the live Firestore documents become the
operational copy (editable without a redeploy, per the taxonomies pattern).

**Everything here is read by something, and `check:content` enforces it**
(D137). The six banks below are the generator's inputs — the list lives once,
as `CONTENT_SOURCES` in `gen-v2content.mjs` — and the two files that are not
inputs are named in that script's `NOT_SEEDED` with the reason. A `.json`
that is neither fails the check. It is a real failure, not tidiness:
`archetypes.json` sat here unread long enough to diverge from the live source
it mirrored, so editing it looked like changing the app and changed nothing.

| File | Contents |
|---|---|
| `daily-questions.json` | The daily World question pool (90) — scale / binary / choice / rating / dilemma types |
| `feed-questions.json` | Feed questions (82) + topic (10) and channel (4) definitions. Three optional fields ride here and nowhere else: `until` (the serving window, D179), `core` (the Mirror's corpus — absent means TAIL, D161) and `sponsor` (who paid, and the one coarse audience tag the device matches, D194 — none are set today, deliberately) |
| `duel-questions.json` | Group daily bank (24: classic / pick-a-member / about-us), 1v1 bank (30) and the romantic 1v1 pool (20, `mode: "romantic"` — seeded `active: false` until the mode-aware client is the fleet, D40 part 4); the last two share the `duo` surface, 50 together. Single source since 2026-08-03: `src/v2/spec/duels-data.js` imports it for the demo layer (the D32 learn-data shape), so demo and seed cannot drift |
| `tests.json` | The four core tests' item banks (big5 · political · values · attachment) — 160 items over one shared counter |
| `lenses.json` | The nine lens banks (moral · risk · trust · time · taste · conflict · humor · thinking · culture) — the client minted these ids |
| `learn-questions.json` | Learn subjects, fields and cards (106) |
| `pulse-questions.json` | The daily pulse's TEMPLATE questions (D139) — one doc per pulse question forever, never one per day; answers are keyed `{qid}_{day}` against them. Exactly five ordered steps each, because the trends chart's y-axis IS that scale |
| `call-questions.json` | Foresight CALL, tier A (D193) — sealed predictions graded against this app's own published aggregates. **Every entry is `active: false` (D195)**: the owner wants predictions about real EVENTS, and these predict our own numbers. Kept whole because a real-event rubric is a new `kind` on this schema, not a new feature. `check:calls` still dry-runs every one. Editorial-only, like the pulse bank, so no provenance rows |
| `ads.json` | Feed ads (D196) — docs/MONETIZATION.md **path 3**, and NOT path 2's sponsored questions: an ad is a CARD that takes no answer and produces no data, where a sponsored question is answered like any other and folds into the public aggregate. Text only, no link, one coarse audience tag matched on the device. **Ships empty, deliberately** — writing one means printing a real company's name on a card nobody bought. Seeded to `v2_ads`, its own collection |
| `provenance.json` | Who wrote each daily/feed question and in which vintage (D97) — written by `promote-questions.mjs` and the lane PRs, held in step with the banks by `check:quality`, read by the scorecard's `production` rollup. Measurement metadata, not content — never seeded |
| `scorecard.json` | Generated measurement output for the scorecard renderer (`npm run scorecard`) — an output, never an input to the bank |

Provenance notes:

- Extracted mechanically from the spec's data modules (`daily-questions.js`,
  `world-feed-data.js`, `duels-data.js`, `test-definitions.js`,
  `sample-data.js`).
- Two extractions did NOT survive and were deleted in D137: `archetypes.json`
  and `scenes.json`. Nothing ever read either, and the modules they mirrored
  — `src/v2/spec/archetype-data.js` and `scenes.js` — are the live source,
  hand-edited since. Same call as `design/spec-modules/` (deleted 2026-07-29
  once the copies had diverged); both are in git history.
- Synthetic *crowd distributions* from the prototype are intentionally **not**
  extracted — live counts come from real answers. Seeded demo comments are
  excluded per decision D1 (no synthetic users).
- Copy in these files is the canonical product voice; edit deliberately.
