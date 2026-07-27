# Launch content

Canonical question banks and taxonomies, extracted from the frozen design
spec (`design/InSight_standalone_9.html`). These files are the source of
truth for seeding Firestore — the seed script (Phase 2) loads them, and
after launch the live Firestore documents become the operational copy
(editable without a redeploy, per the taxonomies pattern).

| File | Contents |
|---|---|
| `daily-questions.json` | The daily World question pool (30) — scale / binary / choice / rating types |
| `feed-questions.json` | Feed questions (73) + topic and channel definitions |
| `duel-questions.json` | Group daily bank (24: classic / pick-a-member / about-us) and 1v1 bank (20) |
| `tests.json` | The four core tests' item banks (big5 · political · values · attachment) |
| `archetypes.json` | Named result types per test — signature vectors, one-liners, population shares |
| `scenes.json` | Scene (community) definitions from the prototype — placeholder list for launch |

Provenance notes:

- Extracted mechanically from the spec's data modules (`daily-questions.js`,
  `world-feed-data.js`, `duels-data.js`, `test-definitions.js`,
  `archetype-data.js`, `sample-data.js`).
- Synthetic *crowd distributions* from the prototype are intentionally **not**
  extracted — live counts come from real answers. Seeded demo comments are
  excluded per decision D1 (no synthetic users).
- Copy in these files is the canonical product voice; edit deliberately.
