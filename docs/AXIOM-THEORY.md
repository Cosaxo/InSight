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
framing, 2026-08-25). **The axes exist to be connected** — one of the
app's core functions is to use and connect the different axes to
better understand, and get deeper data about, each other (the owner,
2026-08-25) — so cross-axis connection is first-class subject matter
in every lane (charter §1), with genetic and body explicitly charged
with theorizing how the other axes' traits map onto genes and onto the
body's parts and systems. Each lane improves one theory every other
day (re-paced by the owner 2026-08-25 from the initial three-hourly
trial) — as a claims graph with an evidence ladder (conjecture →
argued → cited → measured), advanced by bounded runs that must move a
claim's status or prune, never merely grow. The lanes deliberately **disregard the
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
`main` pushes only) never fires on its theory commits. The
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
the digest is the legibility channel.

The lanes were rebound on the evening of 2026-08-25 (the first day's
measurement: cron-spawned sessions stall on the provisioning step's
permission prompt, so the crons now wake a persistent dispatcher
session that spawns each run with its tools pre-approved), and the
owner re-paced the cadence the same evening: **every lane every other
day** — subject axioms (genetic, body, questions, tests) at
09:02–12:02 UTC on odd dates, reader lanes (map, pattern, graph
optimizer, central) at the same hours on even dates, so readers always
work on subject output at most a day old. **The charter's §10 table
carries the live trigger ids** and is updated first on any change;
this page stopped copying the ids the evening they started moving.

## The owner's controls

Pause any lane in the claude.ai Routines UI; re-pace with one
`update_trigger` (cadence is the dial for a circling lane — charter
§11); read `DIGEST.md` on the branch weekly. The economics were
re-measured on day one: a full theory run is real money (~$20 of
metered value on the first measured runs — the chartering plan's "a
no-advance run costs little" did not survive contact), which is half
of why the owner re-paced the 64-run/day trial to every-other-day
(~4 runs/day) the same evening. A run that finds nothing to advance
still logs that honestly; the weekly digest plus a next-morning
quality peek (2026-08-26) are what say whether the cadence earns
itself.
