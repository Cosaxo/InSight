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

### 0 · The web ask door — where a question is bought

- **title · asked by** — *Ask InSight a question* · the owner, 2026-09-05,
  adopting `STORE-CUT-PLAN.md` shape A (D365). **On the release path**:
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
- **states, and the order matters (D365 amendment)** — **composing**, open
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
- **status** — `designed` 2026-09-05, extracted to
  `design/ask-2026-09-05/`. Its README carries the adapter contract the
  build needs: the draft was fed a shaped pricing resource, so eight
  names and two structures differ from `content/pricing.json` — and
  `refundDays` must come from `WINDOW_DAYS` in `functions/src/paid.ts`,
  never from `trailingDays`, which is a different quantity and one day
  shorter than the promise.

### 0b · The interest profile, shown and editable

- **title · asked by** — *Your interests* · a session, 2026-09-04 (D364),
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
- **status** — `requested`.

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

## Planned

## Drafted

## Designed

## Built
