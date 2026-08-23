# The paid-report standalone — 2026-08-22

The owner's `InSight_2.html` upload of 2026-08-22 (a full `__bundler`
standalone, ~180 modules), from which **the question report's design**
was extracted here — the visual the report builder implements
(D236, `scripts/report-lib.mjs`). The upload is ephemeral; these files
are the surviving description, per this directory family's standing
rule (`design/README.md`).

| File | What it is | Fate |
| --- | --- | --- |
| `paid-report.jsx` | The report page itself — PAID band masthead, the split, answers-over-time with the running-total line, second thoughts, the Who-answered accordion, the logic cut, similar questions, the bundle chips — plus `PaidMineCard`, the buyer's "Questions you asked" shelf | **Report page implemented at D236** → `scripts/report-lib.mjs` `renderReportHtml` (static HTML: `<details>` stands in for the accordion, the polyline and the honesty states carried verbatim). `PaidMineCard` is **§9.3's in-app surface, designed and deliberately not built** — it graduates with "Asked by you" |
| `paid-data.js` | Sample sponsored questions (`pd01`/`pd02`) and the disclosure rule stated as data: who paid → the band, who it was asked of → the window, why you got it → the matched facts, what they receive → counts and cuts, never names | Reference only — the real fields are `sponsor`/`until` (SCHEMA-V2, D195/D228) |

What the implementation deliberately did NOT carry, each with its record:

- **The four instruments' TYPE cuts shipped at D238** (permitted at
  D237, buildable once `archetype-data.js` left the bridge and could
  load under node), **and the per-AXIS five-band rows at D239** — banded
  by the app's own vocabulary (poles from `IS_RULE_ADJ`, edges from
  `RULE_REAL`/`RULE_STRONG` against the authored `IS_TEST_AVG`
  baselines) rather than the mock's population-shaping shares, which
  were shapes for its invented crowd, not a scale.
- **District and field-of-study rows**: no such data exists anywhere.
- **"N answers changed at least once"** (the mock's second-thoughts
  basis): the D226 matrix counts MOVES, not people, so the page says
  that instead — the mock's sentence is one the data cannot make.
