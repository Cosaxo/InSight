# The Patterns standalone — 2026-08-20

The owner's `InSight_1.html` upload of 2026-08-20 (a full `__bundler`
standalone, 170 modules), from which the **Patterns tab's redesign** was
extracted here in three passes: the People lens at D214, the Map and
Oracle at D215, the population chips at D216 — the tab is now ported
whole. The upload is ephemeral; these files are the surviving
description. *(This directory was `standalone-people-2026-08-20/` while
only the People pieces lived in it — D214's record cites that name;
D215 widened the contents and renamed it.)*

| File | What it is | Fate |
| --- | --- | --- |
| `people-lens.jsx` | The People lens: the crowd as a shared map with no centre | **Ported at D214** → `src/v2/ui/PatternsPeople.tsx` + `src/v2/data/peopleMap.ts`; simulated crowd replaced with real voter rows per D167 |
| `question-map.jsx` | The Map lens redrawn: neutral field, topic filter, next-up beacon, tie chain, three spoken links | **Ported at D215** → `src/v2/ui/PatternsMap.tsx` |
| `question-map.js` | The map engine — the archipelago layout (label-propagation islands) is its news; the rest matches what already shipped | **Layout ported at D215** into `src/v2/data/patternsMap.ts` (`planeOf`); the SVD fit stays unported — live loadings come from the nightly server fit |
| `oracle.jsx` | The Oracle as ONE INSTRUMENT: sealed disc on the seam, fills as confidence, verdict as a glyph, the ledger, one-time legends | **Ported at D215** → `src/v2/ui/PatternsOracle.tsx` |
| `patterns.css` + `oracle.css` | The tab shell's and the lenses' sheets | **Ported at D215** → `src/v2/ui/patterns.css` (verbatim but one `:has()` shell rule made an explicit class) |
| `patterns-tab.jsx` | The tab shell: three-lens ruler, one sub-row (topic chips · population chips · oracle progress) | **Ported at D215**, the population chips at **D216** — the People lens narrows to Circle · your country's code · World, membership only (frozen anchor codes, the capped follows list), the arithmetic untouched |

Behaviours the ports refused, each recorded in the shipped files'
comments and in D214–D216: invented names for nameless accounts; a
placement floor ratioed against unbounded simulated activity; counted
sentences with no stated basis (live cards append "of the N in both
samples" — D146); the prototype's "Start over" on the Oracle's done
state (a live answer cannot be unanswered); the tap-anywhere advance on
a clickable `<div>` (the a11y ratchet's exact case — Next does the
job); one anonymous-crowd floor applied to your own named circle (the
circle draws from the first placeable friend — D216 §2); and a
per-population tie share (the clause reads "% overall do" — the fit's
world marginal — in every view, because a per-population share would be
a new small-sample claim).

No app code references this directory; it is provenance, like every
other `design/standalone-*`.
