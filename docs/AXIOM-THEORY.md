# Axiom Theory — the theory layer, and its bridge into the product

**Status: operating since 2026-08-25.** This page is the product-side
record of a system that lives OUTSIDE the product: eight recurring
Claude lanes writing theory on the orphan branch `axiom-theory` of this
repo. **`CHARTER.md` at that branch's root is canonical** for
everything about how the lanes behave; this page records what the
product needs to know — where the system is, what may cross from it
into the tree, and the account-side inventory. If the two disagree,
the charter is right about the lanes and this page is right about the
bridge.

## What it is

An **axiom** is the theory of an axis's perfect form
([`AXES-PLAN.md`](AXES-PLAN.md) §1 defines the axes; the owner's
framing, 2026-08-25). Each lane improves one theory every three hours —
as a claims graph with an evidence ladder (conjecture → argued → cited
→ measured), advanced by bounded runs that must move a claim's status
or prune, never merely grow. The lanes deliberately **disregard the
project's practical limitations** — they seek the perfect system, not
the buildable one — and just as deliberately may not disregard law,
ethics or honesty (charter §9: no medical advice, no invented sources,
consent and privacy as design axioms).

Six of the eight are subject lanes — genetic, body, questions, tests,
plus **map theory** (how everything should be displayed) and **pattern
theory** (how patterns should be found). **Central** synthesizes: the
combination theory, the axiom portfolio, new-axiom proposals, focus
questions into the other lanes, and the weekly `DIGEST.md`. The
**graph optimizer** keeps the graphs themselves healthy, including its
own methods.

## Why the branch shape

`axiom-theory` is an orphan branch: it carries no product code, so a
lane physically cannot touch the app, and `ci.yml` (pull requests and
`main` pushes only) never fires on its ~60 daily theory commits. The
product's history, gates and PR list stay clean by construction rather
than by discipline.

## The bridge — the only path from theory to tree

Nothing on that branch is product truth, and nothing in the app may
ever cite it. The one legitimate crossing:

1. A lane writes a wish in its `REQUESTS.md` — data to track, gather
   or compute; a new feed-borne source; an outside-axiom entry.
2. Central rules on it in `bridge/VERDICTS.md`: **worth-building**
   (with the cost/benefit argument), **not-yet**, or **needs-owner** —
   and worth-building verdicts surface in the weekly `DIGEST.md`.
3. **A person carries it here**, into the governed process:
   [`AXES-RUNBOOK.md`](AXES-RUNBOOK.md)'s lanes and a
   [`DECISIONS.md`](DECISIONS.md) record. Everything this repo already
   holds — custody classes, consent, store forms, gates, the owner's
   adoption — governs from that point exactly as if the idea had been
   born here.

No theory lane implements its own request; no Routine from that branch
opens PRs or touches `main`. The theory layer proposes; this repo
disposes.

## The account-side inventory (product-side copy)

All eight fire a **fresh session per run** on model `claude-fable-5`
(the owner's 2026-08-25 direction: Fable orchestrates, subagents are
Opus at matched effort, never lower), completion notifications off —
the digest is the legibility channel. The charter's §10 carries the
same table and is updated first; ids are recorded because
`update_trigger`/`delete_trigger` need them.

| Lane | Trigger id | Schedule (UTC) |
| --- | --- | --- |
| Genetic | `trig_01FY24wP7QVx6yKtyPySwuCw` | `2 */3 * * *` |
| Body | `trig_01M13uuj3VWVRfQEapN24oET` | `17 */3 * * *` |
| Questions | `trig_01UHsDc9ZzLv9neXq3tq91Z2` | `32 */3 * * *` |
| Tests | `trig_011B7J7eoCCCH5157wFXJPuu` | `47 */3 * * *` |
| Map | `trig_01MBKTtp3GCAjTrCacyxiJYh` | `2 1-23/3 * * *` |
| Pattern | `trig_01XoDDuaeE5een4aviG6D4uU` | `17 1-23/3 * * *` |
| Graph optimizer | `trig_01DmXvzjjQpy394oXjGvz9qk` | `32 1-23/3 * * *` |
| Central | `trig_01Nv8PzPcsB1sayi5CDNkGCz` | `47 1-23/3 * * *` |

Two hour-groups, fifteen minutes apart, so at most four lanes share an
hour and central reads the freshest axiom work; each lane still fires
every three hours.

## The owner's controls

Pause any lane in the claude.ai Routines UI; re-pace with one
`update_trigger` (cadence is the dial for a circling lane — charter
§11); read `DIGEST.md` on the branch weekly. The farm's economics
apply: a run that finds nothing to advance logs that honestly and
costs little; eight lanes at three-hour cadence is roughly sixty-four
runs a day, accepted explicitly by the owner at chartering ("budget is
not an issue"), and the first weeks' digests are what say whether the
cadence earns itself.
