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

### 0b · The interest profile, shown and editable

- **title · asked by** — *Your interests* · a session, 2026-09-04 (D367),
  discharging the one row of `SCALE-RUNBOOK.md` Phase 5 that survived
  D317's reversal.
- **surface** — the profile overlay's General panel
  (`src/v2/spec/profile-general.jsx`), below the account rows and beside
  the trait web. Not a Mirror stop: this is a thing about the app's
  behaviour toward you, not a reading of a population.
- **data and basis** — `v2_users/{uid}/taste/profile` `{t, n, at}` —
  per-topic feed-answer counts, folded nightly by `fitTasteV2`
  (`functions/src/taste.ts`), owner-readable and client-unwritable. One
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

### 5 · The 1v1 and group profile — three instruments, and the pair's card

**Asked 2026-09-06** — the owner: *"how could we make the 1v1 and
groups profile better … assume you have full creative freedom."*
`ROLES-PLAN.md` is the plan; this is the screen half of it, and it
waits on the plan's owner call (`OWNER-LIST.md` § Decisions) before
it is planned here.

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
- **status** — `requested` (waits on the plan's owner call).

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
- **status** — `requested` (waits on the plan's owner call).

## Planned

## Drafted

## Designed


## Built

### 7 · The first-launch walkthrough — how the app works, before the questions

- **title · asked by** — *How InSight works* · the owner, 2026-09-06,
  directly to a session: *"create a walkthrough for the first time someone
  uses the app that explains how it works."* **Built the same day on the
  direct ask, without the drafted step** — recorded here rather than
  skipped silently, because the rule at the top of this file is the
  owner's and a screen built past it should say so. D388 is the record.
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
- **status** — `built` 2026-09-06 (D388). **What a canvas would still
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
