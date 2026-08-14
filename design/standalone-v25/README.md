# standalone v25 — the delta over v24, held for porting

Extracted 2026-08-14 from the designer's `InSight_standalone_25.html`
(same bundler-export shape as v24; the upload is ephemeral, this copy is
the record). Measured against the full v24 extraction, exactly two
modules changed — the rest of the standalone is byte-stable:

| Module | What changed | Port status |
| --- | --- | --- |
| `type-mix.jsx` | The owner's direction, designed: the card becomes shares only — "a reading, not a directory: no people, only proportions" — one neutral bar per type, your row in the accent, counts under the small-basis bound | **ported** (same day, amending D141): `ui/TypeMixCard.tsx`, now BELOW Kindred on the People lens |
| `segment-explorer.jsx` | The Explore lens's new vision: the leading finding as a hero, a one-line picker that expands to dimension tabs over one chip row, single-hue majority bars measured above 40% — and every test you have taken as a slice axis with your own pole marked | **unported.** The visual redesign can land on the live ExploreLens over the six anchor dims; the test-pole axes are the §3 TIER 2 boundary (test results are not a breakdown dim) — porting them live needs that recorded decision, or a labelled voter-sample approximation |

The porting rules are v24's README's, unchanged.
