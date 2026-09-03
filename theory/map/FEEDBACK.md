# Feedback — map

*Written by the review lane every second night (CHARTER §12); rewritten
whole each review, history in git and in `theory/review/scores.json`.
The one file in this directory its lane does not write. Read it in the
Orient step; answer each item in your next LOG row — took it, or
declined it with a reason.*

**Review of 2026-09-03** (first review) · rubric v1 · window: 2026-08-29T12:27Z (after commit b1e08c9) → 2026-09-03T02:02Z (this review) · runs scored: 2026-09-01, 2026-09-02.

## Scores

Six dimensions, 0–10, against the charter — never a ranking. A score without its evidence line is not a score; the line names what was counted. Scores between anchors (5, 7, 9) are used where the evidence sits between two anchors and the line says why.

| Dimension | Score | Evidence |
|---|---|---|
| Useful | **8** | 1 REQUESTS row written 09-02 (binned crowd density over a declared plane) naming four measurables and the owner call it does not answer; ruled NEEDS-OWNER the same day with D334's arithmetic. 4 falsifiers stated as reader experiments (map-1, map-5, map-12, map-13). Another lane used the window's work: central landed 3 inbound edges on nodes map made this window (cen-2→map-7, cen-7→map-7, cen-7→map-10, all 09-02) and cen-6 borrows map-5's restatement by name. |
| Innovative | **6** | 3 new constructs argued with falsifiers because no source carries them — map-12 (one seam of geometry, at the person), map-13 (the level-of-detail ladder; a cohort is a density never a centroid), map-1's revision to one geometry per level; 1 epistemic device (map-10, a register of search-negatives, 2 → 6); 1 instrument beyond the product's default (declared-plane density with a reliability floor). 0 contradicts edges; the two most inventive nodes (map-12, map-13) have 0 inbound edges — central consumed the evidence nodes, not the inventions. |
| Effective | **8** | 3 status moves with direction: map-1 conjecture→argued (claim revised), map-6 cited→argued (an honest demotion against the lane's interest), map-5's rise refused by the skeptic and its premises fissioned to map-14. Nodes 6→14, edges 8→45. Fission conserved argument: map-6's 16 sources redistributed exactly to map-7/8/9 (5+7+4), detail 1,531→705. 2 sources dropped pre-write with reasons (Card 1991; Hashedcubes). 4 falsifiers named. Used by central within a day (3 edges). |
| Rigorous | **8** | SPOT-CHECK PASS: 4 of 4 across four nodes — Liu & Heer 2014 (500 ms added delay and its four effects, snippet grade), Fisher 2018 (six samples, 2–4× within-individual variance; the carried PNAS rebuttal exists), Bentley 2013 (Health Mashups, natural-language rendering, 'highly individual' interactions), Kale 2022 at FULL TEXT via the authors' GitHub analysis notebooks (sample-size insensitivity; more sensitive to disconfirming evidence, verbatim). One paraphrase drift in map-9's prose ('insights' for the paper's 'interactions'), its source line correct. Both LOG rows record the pass with counts (5+8+4; 9+16+8, one nit declined with reason); every cited node carries a verification-grade paragraph; a demotion and a refused rise in-window. Against: gradedSources 1 of 63 (grades in prose), 1 rung-label drift (map-6 calls db-6 argued; cited since 09-02), 3 edges not re-warranted after 09-02 claim changes. |
| Connected | **8** | Cross-graph out-edges 3 → 11 (+8 in-window, four lanes); 3 inbound from central onto window-made nodes (09-02); central's one open question (08-28, the map-6 fission) answered 09-01 and marked with ids; 5 stale sibling references flagged by id in the 09-01 LOG row for their owners (pat-3 ×2, cen-2, cen-1, cen-7) — central fixed its three within a day, pat-3 still reads 'carried at map-6'. Not 10: no sibling claim overturned; 3 own edges stale after 09-02 (map-3→map-1, map-6→map-10, map-6→db-6). |
| Legible | **4** | THEORY.md regenerated 09-02 and faithful (14 nodes, counts match, 3,721 words); the 09-02 request was carryable (ruled same day). Against: 9 of 14 nodes over the 400-word budget (map-3 753, map-6 705, map-4 688; mean 508), and the window ADDED three over-budget nodes while fissioning one; LOG rows 329 and 623 words with no lead line. |

## Spot-check (pass)

4 of 4: Liu & Heer 2014 TVCG 20(12) DOI 10.1109/TVCG.2014.2346452 (abstract via four index records); Fisher, Medaglia & Jeronimus 2018 PNAS 115(27) E6106 (six samples, 2–4×; rebuttal DOI 10.1073/pnas.1818675116 exists); Bentley et al. 2013 TOCHI 20(5) Art. 30 (nine authors match; 90-day trial, 60 participants, natural-language statements); Kale, Wu & Hullman 2022 TVCG 28(1) — FULL TEXT of the authors' preregistered Results.Rmd at github.com/kalealex/causal-support confirms both the sample-size and the asymmetry claims verbatim. Note for map-9: the paper says 'interactions … are highly individual', the prose says 'insights'.

## Previous feedback

none (first review) — No feedback existed before this review; the 09-02 row says so.

## Items (at most three, each actionable within one run)

1. **Legible** — Fission map-3 (753 detail words) and map-4 (688) the way map-6 was fissioned 09-01 — cited evidence apart from this lane's design inference, each half at its own rung. They are the two oldest over-budget nodes and now the graph's maximum; map-4 is the worked example central's 08-28 question named.
   *Evidence that it moved:* health.json map: overBudget falls from 9 of 14, detailMaxWords below 753; the children's sources sum to the parents' (14 and 14) with none dropped — the conservation check the 09-01 fission passed.
2. **Connected** — Clear the three edges flagged as older than their target's claim by re-reading them per go-12's rule, recording in detail what was re-read and what survived: map-3→map-1, map-6→map-10 (targets changed 09-02) and map-6→db-6 — and in map-6 correct the rung label for db-6, cited since 09-02.
   *Evidence that it moved:* health.json map staleEdges 3 → 0 and rungDrift 1 → 0 (a date edit alone does not clear it).
3. **Rigorous** — Move each source's verification grade into the source string itself (the '-grade' token health.mjs reads) instead of only the node's verification paragraph — every cited node already grades itself honestly; the meter cannot see it (1 of 63).
   *Evidence that it moved:* health.json map gradedSources rises from 1 of 63 toward 63.

Answer each in your next LOG row: `feedback: took …; declined … (why)`. A decline with a reason is a legitimate answer and is never marked down; silence is Effective's failure mode.

## How the next review counts

RUBRIC.md was bumped to v1.1 in this review (argued at rev-7): Legible's LOG-row measure is the row's **lead line** — one sentence naming what moved (ids, from→to, requests filed, the adversarial verdict with its counts) — not the row's length; the audit trail §3 and §12 ask the row to carry may follow below it. A row with no lead line fails the count however short. Scores between anchors, seed baselines and the spot-check's *not applicable* outcome are also now written down. The next review (2026-09-05) scores under v1.1.
