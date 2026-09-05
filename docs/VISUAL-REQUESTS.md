# Visual requests — what needs a design before it is built

**Status: tree — requests, each in the shape Claude Design needs.** The
sixth of the six lists (`PROGRAM-PLAN.md` §2.6, D352), and the rule it
serves, from `CLAUDE.md`: **visuals are designed in Claude Design before
they are built.** A new screen, module, lens, card family, overlay or
visual language is a request here first; a control added to a surface
that already exists — a button, a toggle, a row — is not, and needs no
request. `VISUAL-VISION.md` names the design the tree is built toward.

## The shape of a request

Written so Claude Design understands it whole, without the routine in
the room:

- **title · asked by** — the lane and run, or the owner.
- **surface** — tab · stop · lens, and what is around it.
- **data and basis** — which aggregates or published documents it
  draws, which floors, what D1's empty state shows.
- **states** — empty · loading · live · demo.
- **interaction** — what a tap, a drag, a long press does.
- **vocabulary** — what it must fit: the standalone family in
  `design/`, `src/v2/styles.css`, the two palettes of D302, the copy
  rule D182 (*visual > word > sentence > sentences*).
- **constraints** — the bundle ceiling (`check:bundle`), first paint,
  reads per open, tap targets (`check:tap-targets`).
- **why** — the theory node or axiom that asked for it.
- **status** — `requested` → `planned` (the plan written in full by
  the routine that will draft) → `drafted` (the canvas published with
  the design skill; its link on the row — the owner refines it) →
  `designed` (the owner's canvas accepted, extracted under `design/`)
  → `built` (PR) → crossed out, and `VISUAL-VISION.md` moves.

The owner's rule for the drafting step (2026-09-02): *a routine can
draft it as long as it first makes the plan, then uses Claude Design.*

## Requested

### 1 · Trait-axis directions on the patterns Map

**Re-aimed 2026-09-02** at the ring the current vision draws
(`VISUAL-VISION.md`; `VISION-2026-09-02.md` §1.2, built). What the
request wants is unchanged — *the axes exist to be connected*, drawn on
data that publishes today — and where it can be drawn is not: the plane
this was written against is retired, and on a ring an axis cannot be a
direction. The version below is the whole request, re-stated; the plane
version is in this file's history.

- **asked by** — the program plan, 2026-09-02, ahead of the axes
  build lane reaching step 1.4; the theory it serves is AXES-PLAN §2.
- **surface** — the **patterns** tab, Map lens as it is built: every core
  question a dot on a rim, grouped by topic (the group's own arc outside
  it), a tie a chord bundled through the middle, the hub carrying how
  many you have answered (`ui/PatternsMap.tsx`,
  `design/standalone-2026-09-02/question-map.jsx`). An axis is drawn
  **in that field**, not on a new screen.
- **the shape the ring asks for, and what it costs** — position on the
  rim is topic membership, so an axis cannot be an arrow through the
  plane. Three grammars fit the field it is; the design picks one, and
  the request states the trade rather than hiding it:
  1. **A leaning set.** The axis is a label above the field; tapping it
     lights the questions whose loadings lean with it and recedes the
     rest, thickening the chords between them. Reads as "these
     questions are what Openness is made of" — true of the data, and it
     never claims a geometry the ring does not have.
  2. **An inner arc.** The axis becomes a band drawn INSIDE the rim,
     spanning the questions that lean with it, in its own hue — several
     axes as concentric arcs. Says the same thing plus how much of the
     ring each axis covers; costs the field's quietest area, which the
     hub and the callout share today.
  3. **A polarity split.** The lit questions divide by the SIGN of their
     loading — with the axis and against it — drawn as two arcs, or as
     the chords between the two halves. The most informative and the
     easiest to misread as a left/right politics of the question bank;
     it needs the copy to carry the sign in words.
  Whichever is drafted, the beacon, the callout and the tie card keep
  their places: an axis is a LENS ON the ring, never a second ring.
- **data and basis** — the `axes:` block the nightly fit would
  publish beside the `q:` rows of `v2_patterns/loadings` (AXES-RUNBOOK
  1.1–1.2): per trait axis a direction vector in the same K-space, its
  `n`, its fit quality. "Leans with it" is that vector against each
  question's own loading — a cosine the device already has everything
  for (`data/patternsMap.ts`'s `simOf` is the same arithmetic). An
  absent block draws nothing (D1); a per-column fit-quality floor takes
  an axis back off the map (1.5).
- **states** — no block: the Map exactly as it is today; block present:
  the axis offered above the field, unlit until asked for; lit: the
  leaning questions and their chords at full voice, everything else at
  the ring's resting whisper; demo: never — the block is live only, like
  every other thing this tab draws.
- **interaction** — tap an axis: its questions light, the rest recede,
  and the card underneath states the basis in words the way the tie card
  does ("drawn from the crowd's latest answers · N answers behind this
  axis"). Tap again to release. The horizontal drag still belongs to the
  tab's own axis (`VISION-2026-09-02` §1.5), so an axis control must not
  be a swipeable rail.
- **vocabulary** — `ui/PatternsMap.tsx` and the `.ln-*` instrument in
  `ui/patterns.css` (the shared field: a title, one plain sentence, a
  legend in words, the dusk palette on `--ln-*` tokens); the two
  palettes of D302; the copy rule D182.
- **constraints** — zero extra reads (the block rides the loadings
  document already fetched); the ring's own labels are placed by a
  fitting rule and an axis label must not collide with them; 44 px tap
  targets; and the field is one square — an axis grammar that needs a
  second field is not this request.
- **why** — *"the axes exist to be connected"* (charter §1); AXES-PLAN
  §2: "That is the owner's sentence, drawn, on data that publishes
  today."
- **status** — `requested` (the copy-level half built at D367; the
  shape is what remains).

### 2 · The corner doors for earned axes

- **asked by** — the program plan, 2026-09-02; the theory is
  AXES-PLAN §5, whose own step 3 says *prototype the grammar in the
  standalone first*.
- **surface** — the shell: the two free corners beside the centred tab
  pill (`.tabbar` / `.tab-group`), inside the safe-area inset.
- **data and basis** — a door reads one gate signal through `LIVE`
  (the `patternsReady` shape, D265): consent given, enough of you,
  enough of the crowd; remembered, purge-closed.
- **states** — below the gate: *nothing* — no button, no teaser, no
  "coming soon" (D265, verbatim shape); crossed: the corner appears for
  that account and stays; demo: never.
- **interaction** — a tap asks the shell to navigate (`NAV.goNav`,
  a request with spring-back), the same grammar the daily ruler's
  near-end exit uses.
- **vocabulary** — the corner chrome the Map canvas already speaks
  (`.mmt-zoomctl`); the two-palette rule of D302.
- **constraints** — 44 px (`check:tap-targets`), the native safe-area
  inset, no new eager bytes.
- **why** — the owner's instinct that *connections radiate in every
  direction*, made honest: a corner means "this account carries a
  further axis".
- **status** — `requested`; waits on an axis earning it (AXES-RUNBOOK
  5.2) before it is built, but the design can be drafted any time.

### 3 · The fit scorecard's reader

- **asked by** — the axes retro (run log #290, the highest-leverage
  item in the queue) and the map theory lane's request that crossed at
  D325; on the worklist as an `[ask]`, because the shape is a design
  question before it is code.
- **surface** — open: either an operator page (the pulse console's
  family, `monitoring/pulse.html`) or the patterns tab's Oracle
  "working" card. The design decides; the request is what it must
  show.
- **data and basis** — what the nightly fit publishes on
  `v2_patterns/loadings` since D325: the prequential benchmark (a
  pooled, per-question-floored daily log-loss series — the fit's
  predictive power, not the Oracle's) and the inter-fit displacement
  (loading-space and drawn-plane, reported as two numbers).
- **states** — no history yet (the fit is young): the series as a
  short line with its basis; a per-question floor withholding a cell:
  drawn as withheld, never as zero.
- **interaction** — a question tapped on the Map shows its own series;
  the operator page shows the pooled one with the displacement beside
  it.
- **vocabulary** — the pulse console's panel grammar if operator-side;
  the 08-26 Oracle working card if user-side.
- **constraints** — reads nothing new; the document is fetched already.
- **why** — unlocks the `measured` rung for three theory lanes at once
  (map-3, pat-5, pat-6; the 2026-09-01 digest, bridge item 2).
- **status** — `requested`.

### 4 · The buying door reads as a price, not a formula

**Asked 2026-09-05** — the owner: *"pricing seems unintuitive."* D366
made the numbers behind the door live; this request is for the shape
that lets a buyer read them.

- **asked by** — the owner, 2026-09-05; recorded at D366 §6.
- **surface** — the "Ask a question" overlay (`src/v2/spec/suggestions.jsx`,
  built from `design/standalone-2026-08-24/suggestions.jsx`): the rate
  board (three cohort rows), the scope ruler inside the composer, and
  the contract sheet before "Book it". Reached from the daily tab's
  door and the account sheet's *Asked by you* row.
- **what a buyer reads today, and has to assemble** — per cohort: a
  demand word (*quiet · steady · contested*), the crowding as a sentence
  (*nobody else asking · 1 other in rotation*; it was a booked count, *0 of 14
  booked*), a fourteen-tick strip and — since D371 — the MENU price
  for the reach (*€10 · up to 500 answers · 29 days*; until then a
  per-answer rate, which now lives one tap in on the scope ruler and
  the contract sheet); the law
  (*€0.02 an answer with nobody else asking · +50% per other campaign
  in rotation · over the next 14 days · no ceiling · billed per answer
  · budgets €5 to €50 · unserved answers refund at close*) behind a
  *How the price is set* tap since D367,
  the crowding index since D368. In the composer a budget row (*€5 ·
  €10 · €25 · €50* — the row's own price chosen when a row opened it,
  the smallest from the bare button) says what it buys at the line
  in force; the contract sheet says *Rate · locked at approval*, an
  estimate where a campaign has a measured rate (D288 §3, a served week
  since D367), and *Your budget €25 up front · up to 1 250 answers ·
  unserved answers refund at close*.
  D367 answered the arithmetic half of this request in copy and D371
  the menu half (`SPONSORED-PLAN.md` §2.3: one price per reach, one
  promise under it); what is still asked for is the SHAPE — the
  buyer's one question, *what will this cost me, and what does it
  buy*, as the thing the eye lands on, with the strip, the word and
  the presets around it rather than a column of rows.
- **data and basis** — everything the door prints is on the live card
  (`v2_meta/pricing` over `content/pricing.json`, D366): per cohort the
  idx, the booked strip, the next open day, and an estimate WITH its
  basis or none. A forecast may render only where the card carries a
  completed campaign (D288 §3's honesty), so the design needs a shape
  for *no estimate yet* that is not a blank — the booked strip and the
  open day are always real. (The flat ad lane printed its own figure
  beside this until D370 retired it; one product now.)
- **states** — committed card (before the live half lands, or a demo
  build: the label says *committed*); live with an empty ledger (every
  cohort at the floor, all open); live with demand (one or more
  cohorts lifted, days booked, a sold-out strip of fourteen); with and
  without an estimate; the composer's approved-quote and pay states,
  where `fmtExact` prints the charged figure to the cent.
- **interaction** — pick a cohort → the composer opens on it; the
  scope ruler re-prices as the scope moves; currency switch (D288's
  `CurSwitch`) reformats every figure with ≈ off EUR; the contract
  sheet is the last read before money.
- **vocabulary** — the 2026-09-02 standalone family (`design/
  standalone-2026-09-02/`), `src/v2/styles.css`, D302's two palettes,
  `COPY.md` (*visual > word > sentence*): the price is the visual; the
  law can be one line behind a disclosure, not a token row a buyer
  reads first. The claims that must stay claims (§3): *locked at
  booking*, *billed per answer*, *the unserved part refunds*, and the
  ≈ on any converted figure.
- **constraints** — the overlay is past first paint (no eager bytes;
  `check:bundle` stands at its ceiling); one read per open for the live
  card and none for the committed one; tap targets
  (`check:tap-targets`); the three OWNER-LIST rows D366 opened (the
  floor, the cap's shape, the forward fortnight) may change the numbers
  under this design — design for a buyer-set budget as one of the
  states rather than assuming the flat cap.
- **why** — MONETIZATION path 1 and PAID-PLAN §6: the door is the
  product's one paid surface, and a price a buyer cannot read is a
  price they do not pay.
- **status** — `requested`.

## Planned

## Drafted

## Designed

## Built
