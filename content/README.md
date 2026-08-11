# Launch content

Canonical question banks and taxonomies, extracted from the v9 design
prototype (deleted 2026-07-29; in git history — `design/InSight_standalone_14.html` is the current reference). These files are the source of
truth for seeding Firestore: `scripts/gen-v2content.mjs` flattens them into
`functions/src/v2content.ts` (regenerate with `npm run build:content`),
which the `seedContentV2` callable compiles in. `npm run check:content`
regenerates in memory and compares bytes on the deploy path, so the two can
never drift silently. After launch the live Firestore documents become the
operational copy (editable without a redeploy, per the taxonomies pattern).

| File | Contents |
|---|---|
| `daily-questions.json` | The daily World question pool (90) — scale / binary / choice / rating / dilemma types |
| `feed-questions.json` | Feed questions (73) + topic and channel definitions |
| `duel-questions.json` | Group daily bank (24: classic / pick-a-member / about-us), 1v1 bank (20) and the romantic 1v1 pool (20, `mode: "romantic"` — seeded `active: false` until the mode-aware client is the fleet, D40 part 4). Single source since 2026-08-03: `src/v2/spec/duels-data.js` imports it for the demo layer (the D32 learn-data shape), so demo and seed cannot drift |
| `tests.json` | The four core tests' item banks (big5 · political · values · attachment) |
| `archetypes.json` | Named result types per test — signature vectors, one-liners, population shares |
| `scenes.json` | Scene (community) definitions from the prototype — placeholder list for launch |
| `provenance.json` | Who wrote each daily/feed question and in which vintage (D94) — written by `promote-questions.mjs` and the lane PRs, held in step with the banks by `check:quality`, read by the scorecard's `production` rollup. Measurement metadata, not content — never seeded |

Provenance notes:

- Extracted mechanically from the spec's data modules (`daily-questions.js`,
  `world-feed-data.js`, `duels-data.js`, `test-definitions.js`,
  `archetype-data.js`, `sample-data.js`).
- Synthetic *crowd distributions* from the prototype are intentionally **not**
  extracted — live counts come from real answers. Seeded demo comments are
  excluded per decision D1 (no synthetic users).
- Copy in these files is the canonical product voice; edit deliberately.
