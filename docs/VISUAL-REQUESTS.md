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

### 10 · The account-setup sheet — fits the phone, and asks before it lets go

- **title · asked by** — *A few things about you* · the owner, 2026-09-07,
  on build 33: *"the shert for filling in data is scaled wrong an looks
  bad… and some of them should ve requierd before skiping."*
- **surface** — `src/v2/ui/LiveProfileSetup.tsx`, a full-screen sheet
  mounted by `main.jsx` after first paint on any account with no anchors
  and no display name (`profileSetup.tsx` decides). It is the FIRST screen
  after the sign-in gate, so it and
  `design/front-door-2026-09-07/` are read as one arrival — and today
  they do not look like one thing.
- **what is wrong now, measured** — the column is `width: 100%` with 22px
  of padding a side and no `box-sizing`, and `styles.css` has no universal
  `border-box` reset, so the content box was 446px inside a 402px window:
  every field ran 44px off the right edge and the sentence about the
  handle was cut mid-word. **That one property is already fixed** — this
  request is not for the overflow. It is for the sheet the overflow
  revealed: eleven controls stacked at full width, a three-column
  day/month/year grid at `0.9fr 1.5fr 1.1fr`, two paragraphs of
  explanation above the first field, and nothing that says which of it
  matters.
- **data and basis** — every control is a CLOSED vocabulary held equal to
  the server's buckets by `check:anchors`; the city is the catalogue
  picker (D9); the birthday never leaves the device — `anchorsFrom` writes
  the band and the year-resolution age, not the date (D155,
  `profile-vitals.js`). Nothing here is free text except the display name
  and the handle. A handle is claimed once and cannot be changed; every
  other field is editable later in the profile's Basics card.
- **the ask that changes the screen's job** — some fields become
  REQUIRED before the sheet can be skipped. Today nothing is: `canSave`
  is `filled > 0 || newName || typedHandle`, and *Skip for now* always
  works.
  **This reverses half of the file's own stated reasoning and the
  reversal is the owner's to make, not the design's.** That reasoning
  reads: *"It does not block. Every field can be skipped and the whole
  screen can be dismissed, because D3 is anonymous-first and 'never a
  wall' — and because a required demographic form is how you teach people
  to lie to one."* The first clause is already gone: D414 put the wall up,
  so "never a wall" no longer describes this build. **The second clause
  still stands and is the design problem this request is really about** —
  a required field does not produce truth, it produces a value. So the
  question for the canvas is not *where do the asterisks go*, it is **how
  does a screen earn four honest answers**, and the two levers are which
  fields are asked for and what each one visibly buys.
  A proposal to rule on rather than a decision taken: **year of birth,
  gender, country and display name** required; city, education, work and
  relationship optional. That set is chosen from what the product cannot
  work without — the Mirror's City and Country stops need a place, its
  breakdowns need a band, and every reveal needs a name (D190) — not from
  what is nice to have. Country rather than city because a country is
  cheap to answer honestly and a city is where people start being vague.
- **states** — *empty* (the case it exists for: a new account, nothing
  filled) · *partial* (some fields answered, required ones not) ·
  *complete* · *saving* · *handle refused* (taken or malformed — the one
  error state that must survive a save and keep the rest of the writes) ·
  *offline*. There is no loading state: the vocabularies are local.
- **interaction** — every control is a native picker or select, which is
  deliberate on a phone and constrains the visual language more than a
  desktop form would. A tap opens the platform sheet. The hardware back
  button peels this screen as one layer (Android). The primary button
  today reads *Save 3 of 7* / *Answer one to continue*, which is a
  counter; whether a count is still the right primary label once some
  fields are required is a question for the canvas.
- **vocabulary** — `design/front-door-2026-09-07/` is the screen
  immediately before this one and sets the arrival's tone; the standalone
  family in `design/` and `src/v2/styles.css`; the two palettes of D302;
  `--field-size` owns the type size of any text input
  (`check:touch-zoom` fails a literal, 16px floor, because a smaller
  field makes iOS zoom the whole fixed shell and nothing zooms it back).
  Copy follows D182 — and `docs/COPY.md` §3 is the part that matters
  here, because two of the paragraphs on this screen are CLAIMS (what
  each answer is copied into, that a handle cannot be changed) and are
  not shortenable to nothing.
- **constraints** — the whole screen is behind `main.jsx`'s dynamic
  import and must stay there (`check:bundle`'s eager ceiling has no
  headroom, and `profileSetup.tsx`'s header records that even the
  DECISION measured 1 KB over when it lived in an eager gate). Tap
  targets: `check:tap-targets`. No new fetch — every list is local.
- **why** — the anchors are the join. An answer snapshots them at write
  time (D8), and that snapshot is the only thing that lets a vote be
  counted with a city, an age, a field — which is the app's whole first
  sentence, *connecting data and drawing the connection where someone can
  read it*. A sheet that people skip produces answers that belong to no
  cohort, and CLAUDE.md's own test applies to this screen as much as to a
  lens: a surface that collects without joining is unfinished.
- **status** — `requested`.

### 0b · The interest profile, shown and editable

- **title · asked by** — *Your interests* · a session, 2026-09-04 (D367),
  discharging the one row of `SCALE-RUNBOOK.md` Phase 5 that survived
  D317's reversal.
- **surface** — the profile overlay's General panel
  (`src/v2/spec/profile-general.jsx`), below the account rows and beside
  the trait web. Not a Mirror stop: this is a thing about the app's
  behaviour toward you, not a reading of a population.
- **data and basis** — `v2_users/{uid}/taste/profile` `{t, n, at}` —
  per-topic feed-answer counts, folded nightly by the taste fold
  (`functions/src/taste.ts`, inside `digestEngagementV2` since D399),
  owner-readable and client-unwritable. One
  document GET; the same one `bank-pager.ts` already consults, so a
  session-cached read costs nothing extra. The floors are the copy's
  spine, not a footnote: under `TASTE_MIN_TOTAL` (10 answers) the profile
  shapes **nothing** and the panel must say so rather than draw a shape
  it is not using; a topic under `TASTE_TOPIC_MIN` (3) still pages at
  max(4, a third of `FEED_PAGE`) — **never zero, because a cold topic has
  to stay discoverable or the profile could never change.** That last
  clause is the most reassuring true sentence available and should be
  visible, not buried.
- **states** — **empty**: fewer than 10 answers — "we are not shaping your
  feed yet", with the count and what it takes. **loading**: the panel is
  behind a tap, so a spinner is honest. **live**: topics ranked with their
  counts, each editable, and a reset. **demo**: `LIVE.enabled` false means
  no profile exists — say that, never draw an invented one (D1).
- **interaction** — a tap opens it; each topic takes a *less / normal /
  more* nudge rather than a number, because a raw weight invites a
  precision the fold does not have; one reset returns every topic to
  normal. **The edit has to reach the fetch or the panel is a placebo** —
  and the profile document is deliberately client-unwritable (a
  self-writable profile would let a device forge its own fetch weighting,
  a sponsored-targeting hole the day audiences exist), so the write path
  is a callable or a sibling override document, and **which one is a
  design question this request is asking, not assuming.**
- **vocabulary** — the 2026-09-02 standalone family (`design/`), the
  serif prompt voice (D362), `src/v2/styles.css`, D302's two palettes,
  topic hues as the answer rows use them. Copy under D182: the topic name
  and its count carry it; no caption explaining a bar the reader is
  looking at.
- **constraints** — `check:bundle` (the profile overlay is not eager, so
  this rides the lazy chunk), `check:tap-targets`, `check:a11y`, one
  document read per open and none on the profile's first paint.
- **why** — D317 kept exactly one of D163's bullets across the reversal
  and said it binds harder afterwards: *"A Mirror that secretly models you
  is a contradiction in terms."* Today the model is folded nightly and
  already shapes which questions reach you, and there is nowhere to look
  at it. `web/privacy.html` promises *"Your interest profile: only you"* —
  the rules make that true, and no screen makes it useful.
- **status** — `requested`

### 1 · Trait-axis directions on the patterns Map

**Re-aimed 2026-09-02** at the ring the vision draws
(`VISION-2026-09-02.md` §1.2, built). What the
request wants is unchanged — *the axes exist to be connected*, drawn on
data that publishes today — and where it can be drawn is not: the plane
this was written against is retired, and on a ring an axis cannot be a
direction. The version below is the whole request, re-stated; the plane
version is in this file's history. **Noted 2026-09-06**: the current
vision (`VISION-2026-09-06.md` §2.1) quiets the same field — short
topic groups now name themselves INSIDE the rim, idle chords drop to a
whisper, and the standing legend moves behind an ⓘ — so grammar 2
below (the inner arc) shares its area with the new in-rim labels, and
whichever grammar the design picks inherits the guide-ⓘ rule: its key
lives in the legend, not as standing chrome. The three grammars and
their trades stand.

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
- **status** — `requested` (the copy-level half built at D372; the
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
  (loading-space and drawn-plane, reported as two numbers). Since
  D439 (Status: Proposed) the published numbers sit on `main` as the
  `fit` block of `content/scorecard.json` — series, floor, the
  loading-space displacement summary with its movers (the drawn-plane
  number is not published, so it is not there either), the basis
  distribution and a per-question item profile — so an operator page can read the committed copy and
  the user-side card the live document; the block is the data half of
  the worklist row, and this request is the reader half.
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

**Asked 2026-09-05** — the owner: *"pricing seems unintuitive."* D371
made the numbers behind the door live; this request is for the shape
that lets a buyer read them.

- **asked by** — the owner, 2026-09-05; recorded at D371 §6.
- **surface** — since D368 (shape A) the web ask door, `web/ask.html`
  (item 0): the menu card (three rows, D376), the scope ruler, the
  budget chips and the quote panel. This was filed against the in-app
  "Ask a question" overlay (`src/v2/spec/suggestions.jsx`, built from
  `design/standalone-2026-08-24/suggestions.jsx`), which left the
  binary at D368; what it asked for holds one page over.
- **what a buyer reads today, and has to assemble** — per cohort: a
  demand word (*quiet · steady · contested*), the crowding as a sentence
  (*nobody else asking · 1 other in rotation*; it was a booked count, *0 of 14
  booked*), a fourteen-tick strip and — since D376 — the MENU price
  for the reach (*€10 · up to 500 answers · 29 days*; until then a
  per-answer rate, which now lives one tap in on the scope ruler and
  the contract sheet); the law
  (*€0.02 an answer with nobody else asking · +50% per other campaign
  in rotation · over the next 14 days · no ceiling · billed per answer
  · budgets €5 to €50 · unserved answers refund at close*) behind a
  *How the price is set* tap since D372,
  the crowding index since D373. In the composer a budget row (*€5 ·
  €10 · €25 · €50* — the row's own price chosen when a row opened it,
  the smallest from the bare button) says what it buys at the line
  in force; the contract sheet says *Rate · locked at approval*, an
  estimate where a campaign has a measured rate (D288 §3, a served week
  since D372), and *Your budget €25 up front · up to 1 250 answers ·
  unserved answers refund at close*.
  D372 answered the arithmetic half of this request in copy and D376
  the menu half (`SPONSORED-PLAN.md` §2.3: one price per reach, one
  promise under it); what is still asked for is the SHAPE — the
  buyer's one question, *what will this cost me, and what does it
  buy*, as the thing the eye lands on, with the strip, the word and
  the presets around it rather than a column of rows.
- **data and basis** — everything the door prints is on the live card
  (`v2_meta/pricing` over `content/pricing.json`, D371): per cohort the
  idx, the booked strip, the next open day, and an estimate WITH its
  basis or none. A forecast may render only where the card carries a
  completed campaign (D288 §3's honesty), so the design needs a shape
  for *no estimate yet* that is not a blank — the booked strip and the
  open day are always real. (The flat ad lane printed its own figure
  beside this until D375 retired it; one product now.)
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
  (`check:tap-targets`); the three OWNER-LIST rows D371 opened (the
  floor, the cap's shape, the forward fortnight) may change the numbers
  under this design — design for a buyer-set budget as one of the
  states rather than assuming the flat cap.
- **why** — MONETIZATION path 1 and PAID-PLAN §6: the door is the
  product's one paid surface, and a price a buyer cannot read is a
  price they do not pay.
- **status** — `requested`.

### 8 · The logic test's worked example — one solved matrix before item 1

- **title · asked by** — *How a matrix works* · a session, 2026-09-06
  (D402), the one administration step matrix tests take that the Logic
  overlay does not.
- **surface** — the Logic overlay (`src/v2/spec/logic-test.jsx`), between
  opening it and the first puzzle. Today the overlay opens straight into
  item 1; the two weight-1 items double as the instruction, which means
  a first-time taker spends real items learning the format and the
  floor of the scale carries that cost. A verified attempt (D57) opens
  the same way, on the clock.
- **data and basis** — nothing live. One fixed, hand-picked matrix in
  the generator's vocabulary (a shape cycle is the natural one: three
  shapes, each once per row and column), drawn with its answer ALREADY
  in the goal cell and the five distractors shown struck or dimmed, so
  the reader sees a solved one before they are asked to solve one. No
  answer key ships: the example is not a generated item and is never a
  scored one. D1's empty state does not arise.
- **states** — **first open** (no saved result on the device): the
  example, then *Begin*. **Return** (a saved result exists): the result
  screen as today, with the example reachable from a small row —
  *see how a matrix works* — never in the way of Retake or Verified.
  **Verified attempt**: the example is shown BEFORE `logicStartV2` is
  called, so no clock is running while it is read. **Demo**: identical;
  the example depends on nothing live.
- **interaction** — one tap on *Begin* starts the attempt. Optionally,
  tapping the struck options could say in one line why each is wrong
  (*already in this row*, *wrong size*) — the same five words the
  generator's mutant comments use — but the request is for the picture
  first; D182's order.
- **vocabulary** — the overlay's own tiles (`tileBase`, `Matrix`, the
  raised option buttons), the test's accent (`LOGIC_COL`, the Likeness
  colour), the kickers *The pattern* / *Pick what fills the ?* it already
  uses. The standalone family in `design/standalone-2026-08-20/` for the
  card and button shapes. Copy under D182: the picture carries the
  instruction; one sentence at most.
- **constraints** — the overlay is a lazy chunk (`loadOverlays()`), so
  the cost is bytes in that chunk only; `check:bundle`'s ceiling is
  the whole app's, not the chunk's. No reads. Tap targets per
  `check:tap-targets`. The example's matrix must be renderable by
  `Prim` as it stands — no new glyphs for the example alone.
- **why** — the tests axiom (`AXIOMS.md`, operational): tst-3's ability
  link function says guessing and ceilings matter for logic, and a
  format-learning cost on the first items is floor noise that a
  worked example removes. D402 recorded this as the one administration
  step deferred, and as a screen rather than a control, so it is a
  request under D352 rather than a build.
- **status** — `requested`.
### 9 · The front door — one screen, three ways in

- **asked by** — the owner, 2026-09-07: *"i think this app defenenetly
  should have a sigin in wall and not anonymous users"*, then *"make a
  plan for the c plan that is how almost all apps do account"*. The
  build plan is [`SIGNIN-PLAN.md`](SIGNIN-PLAN.md); this request is
  the screen it waits on (§6).
- **surface** — the FIRST thing anyone sees, before the daily tab
  exists. It replaces `ui/LiveSignInGate.tsx`, which today is a
  Google-only wall shown on the test track: the stacked lockup (D302's
  full iris over the wordmark, 44px), a line of copy, one button. The
  shell it keeps — fixed inset, `--surface-2`, centred, `max-width:
  420`, safe-area padding top and bottom — is right and should survive.
  Nothing surrounds it: no tab bar, no back.
- **data and basis** — none. This screen reads nothing and publishes
  nothing. It is the one surface in the app with no aggregate behind
  it, which is why it has to carry its weight on shape and words alone.
- **what it must hold**
  - **Three doors, and Apple's rule sets their order.** Guideline 4.8
    wants Sign in with Apple offered *equivalently* to other social
    logins, so on iOS it leads: **Sign in with Apple** (Apple's own
    black-fill treatment, which is prescribed and not ours to restyle),
    then **Continue with Google**, then email.
  - **Email is progressive, not a fifth of the screen.** The default
    state shows the two one-tap doors and a quiet *Use email instead*.
    Tapping it reveals address, password, and one primary button. The
    calm default is the point: most people will take a one-tap door and
    should not have to read past a form to find it.
  - **Sign up and sign in are one screen, not two.** A single toggle
    below the form — *New here? Create an account* / *Already have an
    account?* — because two near-identical screens is the thing that
    makes people bounce.
  - **The honest sentence.** Answers on InSight are public, and this is
    the screen where someone decides to join. Telling them here is the
    same obligation D98 wrote for the account panel, pointed forward: a
    person who learns it afterwards from a stranger quoting their vote
    is the failure. One line, above the legal footer, not buried in it.
    D182 §3 governs — a claim, not a word count.
  - **The legal footer.** By continuing you agree to the Terms, and the
    Privacy Policy, both linked and both real pages.
- **states** — default (two buttons, email collapsed) · email expanded
  · creating vs signing in · per-button loading, since a tap on Apple
  leaves the app and comes back · error, and it needs four that read
  differently: wrong password, no such account, address already taken,
  and the network being down · forgotten-password sent, which is a
  confirmation with nowhere to go but back to the inbox.
- **interaction** — a tap on Apple or Google leaves for the system
  sheet and returns; the screen must not look broken while it is gone.
  *Forgot password?* sits with the password field, not with the
  toggle. Nothing dismisses this screen: it is a wall, and the only way
  past it is through a door.
- **vocabulary** — the standalone family in `design/`,
  `src/v2/styles.css`, D302's two palettes in both light and dark. The
  gate's existing lockup and shell are the starting point rather than
  a blank page. Apple's button is the one element that obeys someone
  else's rules.
- **constraints** — the screen is dynamic-imported, so it is off the
  first-paint budget, but it is the first thing a new user waits for
  and should feel instant. `check:tap-targets` for every control,
  including the small toggle and the forgot link. Keyboard-safe: the
  password field must not be under the keyboard on a small phone.
- **why** — D219 let the wall go on the owner's condition that
  duplicates be hard to make, and 2026-09-07 showed the condition is
  not met: delete the account, come back, answer again, in one tap. The
  wall is how the Mirror's central claim — that *your* answers say
  something about *you* — stops being undermined by the app itself.
- **status** — `designed` (2026-09-07). The owner's canvas is extracted
  to [`design/front-door-2026-09-07/`](../design/front-door-2026-09-07/) —
  twelve live artboards, and a README that is the readable half because
  the delivered file is a bundle. It settled more than the request asked
  for: every error names its own way out (*no account* offers **Create
  one**, *already has an account* offers **Sign in instead**), Apple's
  label follows the mode where Google's does not, and the toggle and the
  legal footer both hide while the keyboard is up. Next is the build,
  step 3 of `SIGNIN-PLAN.md`.


## Planned

## Drafted

## Designed

_(none — 5 and 6 were built at D437 and moved below)_

## Built

### 13 · A node with more than two answers on the Map ring

- **asked by** — the owner, 2026-09-09 (*"could add the catalog picks to
  the question map"*), through `PATTERNS-PLAN.md` §5. The owner-list row
  on instrument and multi-option items (D395, D396) already said a
  wider Map is a visual and goes through this file; this is that
  request.
- **surface** — the **patterns** tab, Map lens as built: every
  two-option core question a dot on the rim grouped by topic, a tie a
  chord through the middle, and the card under the field saying *Pick
  this here — and 78% pick that* (`ui/PatternsMap.tsx`,
  `design/standalone-2026-09-02/question-map.jsx`). The request is the
  dot and the card for a question whose answers are not two: a
  three-or-four-option choice, a five-, ten- or twelve-point scale, and
  a catalogue pick — one of about a thousand.
- **data and basis** — the candidate engine's rows on
  `v2_patterns/loadings`: `ord` (one row per scale question, with its
  `sd`), `opt` (one row per option), and under the plan's §5 the
  catalogue's per-entity rows above a floor plus one *everyone else*
  row. What the card can say, exactly: for an option or an entity, the
  same 2×2 count as today over the two bounded samples — *Pick Pikachu
  here, and 64% pick tea*, basis stated (D146); for a scale, a lean
  split at the median — *people who rate this high pick tea more often:
  71% against 52%* — and the basis sentence must say it is a split. A
  row under `PATTERNS_MIN_BASIS` draws no chord; an entity under the
  entity floor is in *everyone else* and is never named.
- **states** — the question's dot always; its chords only for rows
  with basis; a catalogue with no entity above the floor: the dot, and
  under it *no pick is common enough to say anything yet*; demo: never
  — live only, like the rest of the tab (D167).
- **interaction** — tap the dot and the card lists its ties. A question
  with several answers first needs to know WHICH answer the ties are
  about: the viewer's own if answered, else the most common, with a
  chip row of the answers and the ties re-read on the chip. A chord's
  sign — solid together, dashed opposite — is per answer, so a
  four-answer question has four chord sets; the design decides whether
  the rim shows the strongest answer's set at rest, or none until a
  chip is chosen. A scale question's chip row is a low · mid · high
  triplet, not twelve chips.
- **vocabulary** — the ring and its ink-in family (`patterns.css`), the
  tap card's rows, the guide ⓘ of 2026-09-06 (a basis sentence may move
  behind it, never be deleted — D146), the copy rule D182.
- **constraints** — no new reads: the rows are on the loadings
  document and the 2×2 comes from the nightly samples the pair card
  already shares; the ring's dot budget (`PATTERNS-PLAN.md` §7.2 — a
  thousand dots on a rim of radius 131 is a line); tap targets
  (`check:tap-targets`).
- **why** — the app connects data and draws the connection where
  someone can read it (CLAUDE.md, the first paragraph); half the core
  corpus and every catalogue pick is invisible on the Map today, and
  the owner's own example — *Pikachu and strawberries* — cannot be
  drawn until this exists.
- **status** — `built` 2026-09-11 (D460). **The canvas:**
  <https://claude.ai/code/artifact/e4f27851-16c6-4250-a6cf-ef82bfdb8523>,
  drafted 2026-09-10 and **accepted by the owner 2026-09-11** — *"its fine
  how it is now"* — with the same word telling the session to build it. The
  eight artboards are extracted at `design/map-ring-2026-09-11/`, which is
  the durable record; the canvas is ephemeral. What the draft chose where
  the plan left the choice to it, all four built as drawn: the You arc
  inside the rim, pictures on the tapped card's chips and not on the rim, a
  trimmed group folded into a `+n` at its place, groups parted by a
  hairline tick. The owner's answers of 2026-09-10 are in it: profile
  values MAY be drawn (the You arc, off by default), and *"lets plan a way
  to include all types in a efficent and smart way"* was the brief.

#### The plan (2026-09-10) — one rule for every type

**The rule: a dot is an answer-axis, which is a row in the fit.** Every
row the nightly fit publishes is one direction people can lean in, with
a vector; the Map's chords are cosines between rows already
(`data/patternsMap.ts`, `edgesOf`). Today the Map draws one dot per
two-option QUESTION, which happens to equal one dot per row. Keeping
the equality and letting every kind of row be a dot is the whole
design, and it costs no new arithmetic and no new read:

| Kind of question | Rows the fit publishes | Dots on the ring | The dot means |
| --- | --- | --- | --- |
| two-option | one (`bin`) | one | the question; its two answers are one axis, the chord's dash says which pairs |
| scale · rating · dial | one (`ord`) | one | the question; low↔high is one axis |
| choice (3–4 options) | one per option (`opt`) | one per option, a bead group | *picked this* |
| catalogue pick | one per popular entity (`pick`, ≤ 10) | one per popular entity, a bead group | *picked this one* |
| profile value (D454) | one per value (`anc`) | one, on the You arc | *is this* |

**Bead groups.** The dots of one question sit together on the rim, in
their topic's arc, with a hairline tick between groups and a plain gap
between topics — so a four-option question reads as one place with
four beads, and a catalogue card as one place with up to ten. A bead
is the size of every other dot; solid if the viewer gave THAT answer,
hollow otherwise (a two-option dot is solid when answered, as today).
A group's beads share the topic hue; the design decides whether a
bead carries a letter, a short answer word on tap, or (for a catalogue)
the entity's own picture from `web/catalog-art/` at bead size (D421 —
the pictures exist; whether they read at 6 px is the design's call,
with a plain bead the fallback).

**The You arc (the owner's yes, 2026-09-10).** The profile values are
rows too, and they are drawn — as a separate arc outside the topics,
labelled *You*, holding one bead per value the crowd carries (age
bands, genders, countries, education, relationship, height, work; at
most 24 per dim, the cube's cap), the viewer's own values solid. Behind
a toggle in the topic control, OFF by default: the map is a map of
questions until asked, and a map of questions and who-gives-them when
asked, and the toggle is the honest way to say which picture is on
screen. A chord from a You bead to a question says *being 65+ goes with
answering this that way*.

**Chords, unchanged in kind.** A line joins two dots when people who
lean one way on one lean a predictable way on the other; solid =
together, dashed = opposite; thicker = stronger; at rest the strongest
ten speak. With beads the ten are over beads, so a catalogue's
strongest entity can be one of them. Tapping a bead lights ITS three
ties (`nearOf` over rows, as today).

**The card under the field, per kind — every sentence with its basis
(D146).** The sentence is the exact count, not the cosine:

- two-option, as today: *Pick Tea here — and 78% pick Morning on "…"* ·
  *usually 61%* · *of the 143 in both samples*.
- choice or catalogue bead: the same 2×2 with *picked this* as the
  side: *Pick Pikachu here — and 64% pick Tea on "…"* — the samples
  carry the entity since D455 (`e` rows), so the count is the same
  fetch the pair card already shares. The chip row above the ties
  restates the group's beads; tapping a chip re-reads the ties for that
  answer.
- scale bead: split at the crowd's median from the sample's `o`
  indexes: *Rate this high — and 71% pick Tea; 52% of the low half do*
  — the basis line must say *split at the middle*.
- You bead: from the cube's own cells, exact and already on the device
  (`agg.by`): *65+ here: 61% pick Tea · of 312 answers from that group*.
  No sample needed.
- a bead under the basis floor (`PATTERNS_MIN_BASIS`) is not drawn; a
  catalogue entity under the entity floor is in *everyone else* and is
  never named; a question none of whose beads has basis is not drawn.

**The hub** keeps counting QUESTIONS answered of the pool, not beads.

**The dot budget (D457) with beads.** Beads count as dots. Over
`MAP_DOT_BUDGET` each topic keeps its strongest hubs in proportion,
and a bead group is trimmed AS A GROUP: its strongest bead stays and a
small *+3* sits at the group's place; tap opens the whole group in the
card. The sentence under the field says *300 of 885 drawn*. Under
"answered" the ring holds the viewer's own beads: the answers they gave,
which for a catalogue card is the one entity they picked.

**States.** Idle: the ring with the strongest ten chords. A topic: that
topic's beads only (D457). You off: no arc; on: the arc with the
viewer's values solid. A bead tapped: its ties, the chip row, the
card. A catalogue group with no entity above the floor: the card says
*no pick is common enough to say anything yet*. Demo: never — live
only, like the rest of the tab (D167).

**Interaction.** Tap a bead: select it (its answer active). Tap a chip
in the card: move the selection to that bead. Tap the field: clear.
The *You* toggle and the topic select are one control row
(`ui/PatternsTab.tsx`, the chip row that exists). A long press on a
bead does nothing new.

**Copy for the guide ⓘ (D182, D146).** *a dot is an answer: a question
with several answers is a row of dots · a line joins two answers when
people who give one tend to give the other · thicker = stronger ·
dashed = go opposite ways · solid dot = you gave it · "You" is who
gives them, when it's on.*

**What it costs to build, after the design.** `PatternsMap.tsx`: the
ring over rows instead of pool items (the pool grows a `rows()` view:
every published row the bank can name, grouped by question — one pure
function beside `pool()`), the bead-group ticks in `ringOf`, the chip
row, the four card sentences (`say()` over `e` rows and the median
split are the two new counts, both on cached samples), the You toggle.
`edgesOf` over ~900 rows is a few million multiplies, under a hundred
milliseconds on a phone; the loadings document is already on the
device. No new reads anywhere.

**What this plan does not decide, for the design.** Whether a bead
carries a picture; how the *+3* fold reads; whether the You arc sits
outside the rim or inside it; the exact tick between groups. Those are
what the canvas is for.

**Artboards to draft.** 1 · the ring at rest with bead groups, You
off. 2 · You on. 3 · a choice question tapped: chip row, three ties.
4 · a catalogue card tapped: beads with pictures, the *+7*, the
Pikachu sentence. 5 · a scale tapped: high/low. 6 · a You bead tapped.
7 · over budget: *300 of 885 drawn*. 8 · the guide legend.


### 5 · The 1v1 and group profile — three instruments, and the pair's card

**Asked 2026-09-06** — the owner: *"how could we make the 1v1 and
groups profile better … assume you have full creative freedom."*
`ROLES-PLAN.md` is the plan; this is the screen half of it, and it
waits on the plan's owner call (`OWNER-LIST.md` § Decisions) before
it is planned here. **Noted 2026-09-07**: the owner's `InSight_10`
upload draws the third surface — the person's page — on paper: *Play
together* as doors whose sub-line carries the named type's one-line
meaning, and the read-each-other card as a two-column hit-rate table
under a sentence (`VISION-2026-09-07.md` §4, its step 6). That is the
pair's card as this request wants it drawn; the plan's owner call still
gates what the doors say. **Noted 2026-09-08**: the owner's `InSight_12`
upload draws the group half — the role votes in packs, the ratings, the
cast, and a group instrument with Standing back and nine types
(`design/standalone-2026-09-08/role-data.js`, `roles-panel.jsx`); D434
built the rounds and Standing as an aside, and the tables are step 2 of
`VISION-2026-09-08.md`.

- **asked by** — the owner, 2026-09-06; the plan is `ROLES-PLAN.md`
  (§3.1 the three objects, §3.4–§3.5 the tables, §3.6 the name rule).
- **surface** — three places, one vocabulary. (1) The profile
  overlay's **Roles** subtab (`ui/LiveRolesPanel.tsx`, D204 — yours,
  live only): today an average rose, a name, a line, a day count, and
  one row per setting with receipts on tap. (2) The **1v1 daily
  card's** done state (`ui/LiveDuelPanel.tsx`, D156): today the two
  runs of dots under the day's answer. (3) The **person's page**
  (`spec/person-overlay.jsx` — its *Play together* card, D310, draws
  a pair type from demo data only).
- **what it draws** — on the Roles tab: *you across 1v1s* (Insight ·
  Legibility · Projection) with the rule that earns the name, the
  runner-up when the match is close (*The Watcher · nearly The Mind
  Reader — if sharper on them*), and the rarity; then one row per
  pair carrying the PAIR's type (The Familiar, The One-Way — who is
  ahead named, The Twins…) beside your role in it, the two runs, and
  on tap the receipts and the domain rows (*everyday · under pressure
  · how they see you*). Then *you in groups* (Independence · Reading
  the room · Standing · Presence) the same way, one row per group
  with the group's cast in miniature (request 6 is the full cast).
  On the 1v1 card: the pair's type and line under the runs. On the
  person's page: the pair's type and their role in each group you
  share, from the record you both already see.
- **data and basis** — `data/roles.ts` over the reveal documents the
  duel panel already fetches (14 per room, `COSTS.md`'s Roles row) or
  the per-member ledger the plan's §3.3 adds to the group document
  (zero reads either way); the tables in `ROLES-PLAN.md` §3.4–§3.5;
  every rate chance-scaled (§3.2: 50 is luck). Floors: a pair at 4
  days both guessed, you-across-pairs at 6, a group at 3 days played,
  Standing at 3 pick days with D224 snapshots, Reading the room at 3
  guessed days. Below a floor a dim is absent and the types it
  defines are out of the running; D1's empty state is the thin row
  with its count, as today.
- **states** — no settings (the sentence, as today); thin (the dashed
  ring and *2 of 4 days both guessed*); one setting (no rows, the
  card alone); several; a close match (the runner-up line present);
  a setting whose history could not be read (*couldn't read this
  one*, as today); demo: never — the tab is not there.
- **interaction** — tap a row: receipts and domains; tap a pair's
  type: the 1v1 card (`data/duelCue`, the daily ruler's licensed
  exit); tap a name in a group's cast: their page; the ⓘ opens the
  explain sheet's instrument entry; long press nothing.
- **vocabulary** — the result card family (`spec/result-card.jsx`:
  `TestRose`, `TypeMark`, the rule line, the nearly chips, the rarity
  field); `RP_TESTS` hues (`--c-people` for a 1v1, `--c-groups` for a
  group, new dims need hues); the 2026-09-02 standalone family and
  `src/v2/styles.css`; D302's palettes; `COPY.md` — a type's line is
  a claim about a person, true and kind at once (§3.5 of the plan).
- **constraints** — the panel stays behind its `React.lazy` boundary
  (first paint untouched; `check:bundle` at its band); zero new
  reads; 44 px targets (`check:tap-targets`); the daily card's done
  state must not grow a screen (D156: a finished circle collapses to
  its content).
- **why** — the ties axiom (D347, tie-1: the pair, the person across
  pairs and the person in a group are three objects); CLAUDE.md's
  first paragraph — a join nothing draws is unfinished, and the
  pair's reading and the group's cast fold from data already on the
  phone.
- **status** — `designed` (2026-09-09, D436): the owner's `InSight_15`
  upload draws all three surfaces — `design/standalone-2026-09-09/roles-panel.jsx`
  (*In 1v1s* and *In groups*, the average card, one row per setting
  with its casts or votes, thin rows *asked at round 4* / *not named
  yet*), `person-overlay.jsx` (the Together tab: *What you are to each
  other*, *How well you read each other* as two rings and the domain
  rows, the groups you share) and `role-data.js` (one idea in two
  settings: casts per axis, votes per seat; ten and eleven types) —
  and answers the plan's owner call with a third shape, neither
  `ROLES-PLAN.md`'s three nor D204's two. The build is step 4 of
  `VISION-2026-09-09.md`, gated on its Q5 (the floor) and Q6.
  **Built 2026-09-09 (D437):** `ui/LiveRolesPanel.tsx` (*In 1v1s* and
  *In groups*, one row per setting, a thin row in the floor's own
  unit — *2 of 3 cast rounds*, *1 of 2 votes*), `data/roles.ts` (the
  two settings: casts per axis, votes per seat; `MIN_DUO` 3 on the
  owner's *"a bit more then two"*), the ten and eleven types in
  `archetype-data.js`, and the person page's Together SECTION in
  `spec/person-overlay.jsx` (the doors as tiles with the named type,
  *What you are to each other*, *How well you read each other* as two
  rings, the reader line and the domain rows). Not ported: the page's
  tab shell (Match · Answers · Together · Map), which is the 09-07
  record's layout rather than this brief's.

### 6 · The cast — the group as roles

- **asked by** — the owner, 2026-09-06, through `ROLES-PLAN.md`
  §2.6 and §3.8.
- **surface** — the Mirror's **Groups** stop, **People** tab
  (`ui/LiveGroupsMirrorBody.tsx`, `LgPeopleCard`): today a
  constellation of the members, a likeness bar per member, and the
  twin / breaks-ranks labels (D277). The prototype's
  `spec/group-role-map.jsx` drew a cast from a scenario generator —
  stars with earned roles orbiting, contested roles between rivals —
  and is the reference for the idea, not the data.
- **what it draws** — every member's role in THIS group (the same
  fold that gives you yours, run for each uid): mark, first name,
  type, line — *Anna · The Anchor · Where the room lands, you were
  already standing*; and the crowns of the pick days where D224
  snapshots exist: *Best advice · 3 of 4*. The twin and breaks-ranks
  labels stay. A member under the floor is listed with their count,
  not omitted.
- **data and basis** — `groupRole` over the stop's own reveals (or the
  ledger), per member; nominations from `pickUid` snapshots, counted
  only when the counted votes agree (`groupPortrait`'s
  `majorityPickUid` rule); the same floors as request 5. Zero reads
  beyond the stop's own.
- **states** — a group under the floor for everyone (today's People
  card, unchanged); some members over it; crowns present or absent
  (pre-D224 reveals carry none); demo: the demo body keeps its sample
  people and never draws this.
- **interaction** — tap a member: their page; tap a crown: the pick
  day's reveal row; the constellation keeps its place above.
- **vocabulary** — `LgPeopleCard` and the stop's tab row; `TypeMark`
  at 20 px beside a name (the Kindred rows' shape, D156 §7); `COPY.md`
  — a role is said to a person in front of their group.
- **constraints** — `LiveGroupsMirrorBody` is a static import in
  `mirror-tab`, so anything with weight goes behind `React.lazy` as
  `LgField` and `GroupCompare` do; zero new reads; 44 px targets;
  the floor is D1's line — no member wears a role the days do not
  earn.
- **why** — the group is a population the Mirror already draws; a
  cast is the group reading itself, which is what a group stop is
  for. Every input is public (D98) and already on screen with names.
- **status** — `designed` (2026-09-08): the owner's `InSight_12`
  upload draws it — `design/standalone-2026-09-08/group-role-map.jsx`
  (the members on a ring, each earned role a satellite on its holder,
  a contested role dashed between two, a tap opening the vote or the
  person's sheet) and `group-mirror.jsx` (*Who the room named* by pack,
  *How the group rates itself*, the crowns as chips) — and D434 built
  the rounds that feed it: three in four a role vote in a scenario
  pack. The build is step 3 of `VISION-2026-09-08.md`; the data it
  draws is the D224 snapshots on role votes and the ratings' steps.
  **Redrawn 2026-09-09** (D436, `design/standalone-2026-09-09/group-mirror.jsx`
  and `group-role-map.jsx`): the stop is Overview (the seat line — *Here,
  you are the one who gets things going · 5 of 15 votes say so* — over
  the role map, each person's seat under their name) · Votes (by pack,
  a row opening who voted for whom) · People (the affinity swarm with
  numbers, the seats list, in-common chips) · Scores (pole rows, five
  ticks, you over the group) · Compare (the crowns as chips, and *the
  room named you N of M* — the one place it appears). The build is step
  5 of `VISION-2026-09-09.md`.
  **Built 2026-09-09 (D437):** `ui/LiveGroupsMirrorBody.tsx` — the ring
  is roles cast over all the roles in the packs; the seat line over
  the role map (`ui/LgRoleMap.tsx` on `data/roleField.ts`, lazy, every
  node a keyboard control); Votes · People · Scores · Compare folded by
  `data/groupCast.ts`; *the room named you N of M votes* in Compare
  alone. The demo twin (`spec/group-mirror.jsx`, `group-role-map.jsx`)
  re-ported from the same record. Not built: the in-common chips, which
  wait on request 0b (a live profile carries no interests).


### 11 · The pictures on the pick tiles — the catalogue's own faces

- **title · asked by** — *Catalogue pictures* · the owner, 2026-09-07,
  directly to a session, on being told what copyright allowed:
  *"i feel if letterbox can do it so can we i think we can atemt it and
  if we recive a complain we take it down."* **Built the same day on the
  direct ask, without the drafted step** — recorded here rather than
  skipped silently, for item 7's reason. D421 is the record.
- **surface** — the pick card's browse row (`ui/PickTiles.tsx`, D308's
  faces) and the reveal's "your pick" / "the crowd" faces
  (`world-feed.jsx` `renderPick`), plus one *Image credits* door under
  each (`ui/PickCredits.tsx`). The search's rows and the demo store's
  invented catalogues draw none.
- **data and basis** — `web/catalog-art/<domain>/<key>.<ext>`, a
  committed thumbnail on our own hosting per catalogue key, and its
  `credits.tsv` row (author, licence, source), written by an operator
  running `scripts/build-catalog-art.mjs` against Wikidata + Commons
  (P18, P41) or TMDB. Nothing at runtime but the file. The generated
  index `src/v2/data/catalogArtIndex.ts` says which keys have one.
- **states** — no picture for the key: the generated face, unchanged;
  a picture: the face, then the picture fading in once decoded; a failed
  load (a takedown, an outage): the face again; a domain with no
  pictures: no door. Credits: a door, then loading, then the list, or
  one sentence when hosting cannot be reached.
- **interaction** — none new on the tiles (a tap is still the pick).
  The credits door toggles the list; each row's *source* is a link out.
- **vocabulary** — `.wf-tileimg`, the duel tile's one treatment (fade
  on decode, the same saturation), shared rather than copied; D308's
  pattern faces as the ground; `.tap44` on the small door.
- **constraints** — zero eager bytes, measured (544 KB before and
  after, against 552; +3 KB in the deferred feed chunk); no hotlink,
  ever; `check:catalog-art` on the directories, `check:tap-targets`
  and `check:a11y` unchanged; the picture is decorative to assistive
  tech because the tile already carries the name.
- **why** — a browse row of patterned rectangles under "the greatest
  athlete who ever lived" was the design's placeholder for portraits,
  and the owner asked why the portraits were not there.
- **status** — `built` 2026-09-07 (D421). **What a canvas would still
  improve:** the reveal's box is 92 px landscape and a poster is
  portrait, so a film reveal crops to the poster's middle third; and
  the credits list is a plain list. Optional, and on `OWNER-LIST.md` §
  Designs as such.

### 12 · The 1v1 and group card, when a round is the unit

- **title · asked by** — *Your turn · their turn* · the owner, 2026-09-08,
  directing `ROUNDS-PLAN.md` (*"lets go with this path"*), and answering
  the screen question in the same message with *"yes"*.
- **surface** — the daily tab's 1v1 and group modes:
  `ui/LiveDuelPanel.tsx`'s `LdCard` and the rail above it, plus the
  first-run branch that `VISION-2026-09-07.md` §3 redraws as *the first
  day*. The card fills the view and snaps, one room per screen (D156).
- **what changes, and why the existing drawing cannot be patched** — the
  card's whole grammar is a clock. Today it draws *answered · reveals in
  04:12* and the first-day screen draws three beats: *Today · sealed*,
  *Tonight* (the reveal clock), *Tomorrow · revealed*. Under rounds a
  **1v1 has no clock at all** — it reveals the moment the other person
  answers — and a group's clock stops being midnight and becomes its
  round deadline. A countdown to a moment that is not what the reveal
  waits on is worse than no countdown.
- **the states to draw** — `your turn` (the round is open and you have
  not answered) · `their turn` (you have answered, they have not; the
  1v1 says *waiting on Ada*, drawn from `roundPlayers`, which is who has
  answered and never what) · `revealed, and the next round is open`
  (the reveal and a fresh question on one card, because that IS the
  loop) · `N rounds waiting for you` (a partner ran ahead; up to the lead
  cap) · `at the lead` (you have run as far ahead as you may — say what
  is waiting, not what is forbidden) · `closed at the deadline` (a group
  round that revealed without everyone) · `late` (you answer a round
  whose table is already published — the answer shows, marked, and
  scores nothing; the screen must say that plainly and without scolding).
- **data and basis** — all of it is on documents the card already holds:
  `round` · `roundPlayers` · `roundDeadlineAt` on the group document the
  client subscribes to, and the reveal. No new read. Nothing on this
  screen may invent a person (D1): an empty seat is a seat, not a name.
- **interaction** — the reveal and the next round on one card means the
  run of rounds is what the day dots used to browse; the dots become a
  run of rounds rather than days. One handler behind the rail's `New`
  tile and any *start another* row (D392 §3.1's finding).
- **vocabulary** — the standalone family in `design/`,
  `src/v2/styles.css`, D302's two palettes, the 12px floor (D391),
  `check:tap-targets`' 44px. **And the word:** these are **groups** and
  **1v1s**. `ROUNDS-PLAN.md` §9 has the collision — Circle is the
  Mirror's follow-graph stop (D101) and the duel panel has been calling a
  group a circle — and this design should not add to it.
- **copy** — D182, and D419 §3: no sentence may name a cadence. *"Until
  the reveal"* is true at any pace; *"until tomorrow"* goes false the day
  this ships. The two halves of the promise stay — unreadable until the
  reveal, then named.
- **constraints** — the panel is lazy behind `daily-split.jsx`'s
  `React.lazy` (D156 §5), so it costs no first paint; `check:bundle`,
  `check:a11y`'s ratchet, and no new window global.
- **why** — the ties axiom (`AXIOMS.md`, operational): rounds are what
  give `tie-2`'s second-person measurement enough shared items per pair
  to decompose at all. The screen is what makes the pace legible.
- **status** — `built` 2026-09-08 (D426's second amendment); **redrawn
  2026-09-09 (D437)** to the owner's `InSight_15` brief: the group's
  ballot is a 2-across grid of faces, its run a record with a caption on
  tap, no call on a role vote, a rating on the fourth by a phase per
  room, the reveal at everyone-played or 48 hours; the 1v1 gains the
  cast round every fourth. The owner's
  canvas of 2026-09-08 — nine states for a 1v1 and a group, light and
  dark — is extracted to
  [`design/rounds-card-2026-09-08/`](../design/rounds-card-2026-09-08/),
  whose README is the readable half of the bundle: every string it
  settled, the behaviours a static reading loses, and where the tree
  departs from the canvas (a 1v1 can still close at its deadline and then
  wears the group's shapes; the next round's ask sits under what you
  sealed; only the open round carries a deadline; the header's run line
  and the *N to play* count are gone). Built as `ui/LiveDuelPanel.tsx`'s
  card, rail, run and first run the same day; `ROUNDS-PLAN.md` §0a has
  the same departures beside the model's own. **Refined 2026-09-09**
  (D436, `design/standalone-2026-09-09/group-daily.jsx` and
  `duo-daily.jsx`): the group's ballot is a 2-across grid of faces, the
  run at the foot is a record with a caption on tap rather than a score,
  no call on a role vote, the reveal says *closed at the deadline*, and
  the 1v1 gains a cast round every fourth — steps 1 and 3 of
  `VISION-2026-09-09.md`, gated on its questions.

### 7 · The first-launch walkthrough — how the app works, before the questions

- **title · asked by** — *How InSight works* · the owner, 2026-09-06,
  directly to a session: *"create a walkthrough for the first time someone
  uses the app that explains how it works."* **Built the same day on the
  direct ask, without the drafted step** — recorded here rather than
  skipped silently, because the rule at the top of this file is the
  owner's and a screen built past it should say so. D393 is the record.
- **surface** — its own root over the app, on a first launch of a live
  build, BEFORE D151's *A few things about you* (`src/v2/main.jsx`
  sequences the two); and the account sheet's *How InSight works · Show
  again* row (`ui/LivePrivacyPanel.tsx`), which re-opens it any time.
- **data and basis** — none. Five pages the same for every account, and
  every claim on them is one the app already makes: the split (D1), the
  three reaches with *sealed until tomorrow* (`web/privacy.html`'s D5
  row), the anchors an answer carries (D8, D151) and the instruments that
  fill from the feed (D121), the Mirror's seven stops (D111), and the
  blunt sentence — *your answers are public, under your name* (D183,
  D98). The Patterns tab is NOT on it (D265: no teaser), pinned by test.
- **states** — first launch: five pages, Next / Back / Skip, *Start* on
  the last; re-opened from the row: the same, ending in *Done*; a live
  build whose boot did not attach: shown (a first launch on a train is a
  first launch); the demo build: never.
- **interaction** — Next and Back, Skip from any page, Escape, a swipe
  either way, the arrow keys; a swipe or a key past the last page stays
  put — a gesture is not a commit. Focus is trapped inside and restored
  to the opener on close (`useDialog`, D24).
- **vocabulary** — the daily ruler's accents for World · Circle · 1v1
  (`app-shell`'s `DOCK_STOPS`), the Mirror's for its seven stops
  (`mirror-tab`'s `MIRROR_POPS`), the iris as the header draws it (D302),
  the serif prompt voice on the example card (D362), the paid door's
  `.sg-rise` entrance, `.kicker`; the copy rule D182 — a picture, a title,
  a sentence or two, no caption for a shape the reader is looking at.
- **constraints** — zero eager bytes (602 KB before and after, against
  607); its own 10.6 KB chunk, after first paint, live builds only;
  46 px buttons (`check:tap-targets`); `check:a11y`'s ratchet unchanged;
  `check:public-copy` and `check:policy-claims` green over the new copy.
- **why** — `CLAUDE.md`'s first paragraph: the daily is the smaller half,
  and nothing on it said so. A person who answers for a week without
  finding the Mirror has used a poll with a streak.
- **status** — `built` 2026-09-06 (D393). **What a canvas would still
  improve:** the five illustrations, which are drawn from the tree's
  vocabulary rather than from a design — a redraw replaces `Art` in
  `src/v2/ui/LiveWalkthrough.tsx` and nothing else; the gate and the
  tests pin claims, not pictures. Optional, and on `OWNER-LIST.md` §
  Designs as such.

### 0 · The web ask door — where a question is bought

- **title · asked by** — *Ask InSight a question* · the owner, 2026-09-05,
  adopting `STORE-CUT-PLAN.md` shape A (D368). **On the release path**:
  the door leaves the app before submission, so this page is what
  replaces it.
- **surface** — `web/ask.html`, a standalone page on the hosting site
  beside the `paid-done.html` / `paid-done-ad.html` / `paid-cancel.html`
  pages Stripe already returns to. Entered from `web/home.html`, which
  today says it is *"Deliberately NOT the app"* and becomes where the
  door is found. **Not reachable from the app, and that is the entire
  point** — a call to action inside the binary is what 3.1.1 polices.
  The eight existing `web/` pages are the visual company it keeps:
  home, join, privacy, terms, delete-account and the three Stripe
  returns.
- **data and basis** — the rate card prints off `content/pricing.json`,
  fetched or inlined at deploy, never retyped: `capEur` **€320** is the
  question cap, `adBase` **€320** the ad base before its index, plus the
  per-cohort floor/ceiling indices, `fx` and `estimates`. Two callables
  and **zero server changes** — `bookPaidQuestionV2` writes the ask and
  an automated review rules on it, then `createPaidCheckoutV2` turns an
  approved quote into a Stripe Checkout session. Both carry
  `enforceAppCheck`.
- **states, and the order matters (D368 amendment)** — **composing**, open
  to anyone with no account at all: the composer IS the paid flow.
  **quoted**: the price locked off the committed card — rate × index, the
  cap, the 29-day window promise. **declined**: the automated review said
  no, with a reason written to be shown — and because no account was ever
  asked for, **a decline costs the visitor nothing**. **sign in**: raised
  at the PAY tap, never before, because the review runs before payment and
  can refuse; asking someone to make an account and then telling them no
  is the worst available order. **paying**: hand off to Stripe.
  **returned**: the three existing pages already handle it. **held**: an
  API outage holds a booking, never declines it.

  Two things the sign-in state must get right. It exists because an
  anonymous uid cannot be reached from another browser, so the buyer's
  campaign would be invisible in their own app — and
  `AskedByYouOverlay` is exactly the surface that stays in the app after
  the door leaves. **A purchase you cannot come back to is not a
  purchase**, least of all one that refunds 29 days later. And it must
  not lose the ask: `linkWithPopup` upgrades an anonymous user **in
  place**, so a booking written under the anonymous web uid keeps its id
  straight through the link.

  **Google first, but not Google only.** The requirement is a reachable
  identity, not a particular provider. Google ships first because it is
  the path the app already has; the sign-in state should be drawn so a
  second provider (Firebase email-link, no password to store) is a row
  rather than a redesign — a city or an agency may well not want a
  personal Google account against a €320 purchase.
- **interaction** — a scope ruler with prices riding the same axis, so
  moving the scope moves the number in one gesture; the composer, open
  from the first visit; one pay tap, which is where the sign-in appears
  and the only place it does. The refund promise is not fine print — the
  buyer pays the cap and the closer refunds `(cap − answers) × rate` 29
  days later off a public aggregate both sides read, and **that sentence
  is the product's differentiator, not a disclaimer.**
- **vocabulary** — it must read as InSight without pretending to be the
  app: this is a sales surface, not a product surface. The 2026-09-02
  standalone family in `design/`, the serif prompt voice (D362), D302's
  two palettes. `web/` today loads **no** Firebase SDK and no app CSS, so
  the page brings its own — it cannot inherit `src/v2/styles.css`.
  Copy under D182.
- **constraints** — **CSP is the one that bites**: `firebase.json` serves
  `web/` under `default-src 'none'`, so this page needs its own header
  block admitting the Firebase SDK and its endpoints, in the shape
  `join.html`'s block already takes. App Check on a public web door needs
  a **real reCAPTCHA provider**, which reverses D337's premise and is the
  actual bill for avoiding the store cut — cheap against €48–96 a sale.
  No app bundle impact at all, because it is not in the app.
- **why** — `STORE-CUT-PLAN.md` §1: the product's billing model and IAP
  are **incompatible**, not merely inconvenient. A developer cannot issue
  a programmatic partial refund of an IAP, so routing this through the
  store would not make the closer expensive — it would delete it, and
  with it the promise shown at the moment of payment. That is a far
  stronger thing to be able to say than a preference about fees.
- **status** — `built` 2026-09-05 (D369). Drafted, extracted to
  `design/ask-2026-09-05/`, and built the same day. The README's adapter
  contract held exactly: `scripts/build-ask-pricing.mjs` generates
  `web/ask-pricing.json` from the committed card, and `refundDays` comes
  from `WINDOW_DAYS` rather than from `trailingDays` — the substitution
  that would have shortened a payment promise by a day, now pinned by a
  test that fails when the card's lookback moves. Two defects the draft
  could not show came out of rendering it: the per-answer rate was a
  fifth too high in kroner, and the currency switch sat inside the half
  of the page the quote panel hides. **The pay tap is not open** — App
  Check, not code, and the owner's call (D369 §5).
