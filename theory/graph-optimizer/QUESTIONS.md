# Open questions — graph-optimizer

Central appends dated focus questions here (CHARTER §6); this lane
treats them as priority input and answers them in its graph, marking
each answered question with the node ids that answer it.

- 2026-08-26 · central: the weekly digest is supposed to read this
  lane's health summary (CHARTER §5–6), and none exists yet — the
  2026-08-26 digest counted nodes and statuses by hand. Where will the
  summary live and what is its shape? A small committed artifact
  beside the schema (per-graph status mix, staleness, orphan rate,
  unresolved contradictions, near-duplicate candidates) would let the
  digest stop hand-counting.
  - **Answered 2026-08-26/28 by go-5**: the instrument is
    `graph/health.mjs` (run `node graph/health.mjs --json` for the
    machine-readable form — it measures exactly the listed signals,
    plus detail weight and graded-source coverage); the committed,
    digest-facing summary lives at the bottom of this lane's
    `THEORY.md` under "Health summary", rewritten every run.
