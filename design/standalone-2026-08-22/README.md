# The paid-report standalone — 2026-08-22

The owner's `InSight_2.html` upload of 2026-08-22 (a full `__bundler`
standalone, ~180 modules), from which **the question report's design**
was extracted here — the visual the report builder implements
(D231, `scripts/report-lib.mjs`). The upload is ephemeral; these files
are the surviving description, per this directory family's standing
rule (`design/README.md`).

| File | What it is | Fate |
| --- | --- | --- |
| `paid-report.jsx` | The report page itself — PAID band masthead, the split, answers-over-time with the running-total line, second thoughts, the Who-answered accordion, the logic cut, similar questions, the bundle chips — plus `PaidMineCard`, the buyer's "Questions you asked" shelf | **Report page implemented at D231** → `scripts/report-lib.mjs` `renderReportHtml` (static HTML: `<details>` stands in for the accordion, the polyline and the honesty states carried verbatim). `PaidMineCard` is **§9.3's in-app surface, designed and deliberately not built** — it graduates with "Asked by you" |
| `paid-data.js` | Sample sponsored questions (`pd01`/`pd02`) and the disclosure rule stated as data: who paid → the band, who it was asked of → the window, why you got it → the matched facts, what they receive → counts and cuts, never names | Reference only — the real fields are `sponsor`/`until` (SCHEMA-V2, D195/D228) |

What the implementation deliberately did NOT carry, each with its record:

- **Politics / Values / Social answer-grouping** (the mock's test-group
  accordions): `web/privacy.html` promises those results are "never
  used to group answers", pinned by `check:policy-claims` — widening
  that is an owner decision, not a renderer's (D231 § what waits).
- **The Big Five type cut**: allowed by that promise (D146), blocked
  technically — `spec/archetype-data.js` reads `window` at module scope
  and cannot load under node. Joins when its bridge migration lands.
- **District and field-of-study rows**: no such data exists anywhere.
- **"N answers changed at least once"** (the mock's second-thoughts
  basis): the D226 matrix counts MOVES, not people, so the page says
  that instead — the mock's sentence is one the data cannot make.
