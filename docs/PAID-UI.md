# Paid surfaces — the visual brief

**Status: design notes (2026-08-22), binding nothing.** The owner asked
for the monetization surfaces to be *designed*; this page is the handoff
brief for that pass. The claude.ai/design project draws it, and the
result is ported here deliberately — typed under `src/v2/ui`, never as
new spec-layer globals — the pattern `NEXT-FUNCTIONALITY.md` §8 already
records for every designed surface. [`PAID-PLAN.md`](PAID-PLAN.md) owns
*what* each surface is and the constraints it lives under; this page
owns *how each should look*, in enough detail that an artboard can be
drawn without re-deriving the plan. Where this page proposes copy, the
copy ladder ([`COPY.md`](COPY.md)) and the review decide. Where it
quotes a constraint, the decision record it cites decides.

Two of these surfaces exist in v1 form (the composer's paid door, the
PAID band); three do not exist at all (the buyer's room, the report, the
place page). The brief covers all five because they must read as one
product: the band that discloses on a voter's card is the same object
the buyer's room and the report's cover wear.

## 0 · The ask, in artboards

In leverage order — 1 and 2 are the app screens PAID-PLAN §7 names as
the missing rooms; 3 is the sellable artifact itself.

| # | Artboard | Frame |
| --- | --- | --- |
| 1 | The paid door, open, at the composer's foot (§2) | 393×852 app |
| 2 | Asked by you — the buyer's room, three card states (§4) | 393×852 app |
| 3 | The report — cover · breakdown/series spread · roll + flow matrix · catalog tail (§5) | A4 portrait document |
| 4 | The place-civic decline wearing the paid offer (§3) | 393×852 app |
| 5 | The public place page (§6) | 1200-wide web, note the phone fold |
| 6 | The paid door, closed + the name toggle's two states (§2) | detail crops |
| 7 | The rate card page (§7) — demand-gated, design last or not yet | 1200-wide web |

Sample data in artboards is fine — a design file is not a live body —
but keep it *plausible and marked* (a corner "sample" note per board),
because every number that survives the port must come from the real
aggregates: no invented baselines, absent ≠ zero, every reading shows
its n, thin cells counted rather than placed (D1 and the pulse THIN
discipline; `NEXT-FUNCTIONALITY.md` §8 lists these as inherited by
every designed surface).

## 1 · The language the screens already speak

The app's tokens are the authority — `src/v2/styles.css` `:root` —
and the values quoted here are for the drawing hand, not a second
source of truth.

**Ground and ink.** Warm neutrals: `--surface` oklch(0.965 0.004 75),
cards on `--surface-2` (near-white), sunken fills `--surface-3`,
hairlines `--rule`, text `--ink` / `--ink-2` / `--ink-3`
(oklch ≈ 0.216 / 0.41 / 0.51). One sans throughout: Hanken Grotesk;
no italic exists — `em` renders roman in the accent. The accent
follows the tab (daily = sienna oklch(0.52 0.14 40), mirror = sage);
the composer opens over the daily tab, so its accent is sienna.

**Type ladder** (from the shipped suggestion surfaces, which these
screens sit inside): micro-label 10.5/700, +0.09em, uppercase,
`--ink-3` · chip 12/600 (750 when selected) · body 12.5/600, line 1.5 ·
card prompt 16.5/800, −0.32px, line 1.26 · preview hero 21/800, −0.5px.
Numerals that read as figures set `tabular-nums`.

**Parts already built — reuse, do not redesign:**

- **The PAID band** (`src/v2/ui/SponsorMark.tsx`, D195/D228). An ink
  pill — `--ink` fill, `--surface` text: `PAID` at 10.5/800 +0.16em ·
  the buyer's chosen name at 12.5/700, ellipsised · `· until 21 Aug`
  at 11.5/600, 72% opacity. Tapping opens two quiet lines (12/600,
  `--ink-3`): why you matched, each bought dim named in your own
  vocabulary — or "asked everyone — nothing about you decided this" —
  and *"They get the same public numbers you do. There is no private
  cut."* The band replaces the topic chip on a paid card and is the
  app's own ink in every context; nothing a buyer pays for restyles it.
- **The ad card** (`src/v2/ui/AdCard.tsx`, D197): band + headline +
  one line on the app's own ground, deliberately quieter than a
  question card. Unchanged by this brief; it is here so context strips
  in artboards draw it right.
- **The board's grammar** (`src/v2/spec/suggestions.jsx`): state tags
  as small uppercase pills washed 10% in their tone; support as a 3px
  fill line along a card's bottom edge, round-ended on the right;
  pickers as chip rows where the selected chip inverts to ink; inputs
  at `--field-size` (16px, structural — iOS zooms under it), radius 12,
  0.5px `--rule` border. Cards: `--surface-2`, radius 18, hairline
  border warmed 9% toward the accent, `--shadow-card`.
- **Overlay chrome**: header with a 32px ✕ at left, lowercase h-title
  19/800 with the accented `em` — the suggest board's own is
  "suggest a *question*".

**One deliberate colour rule for everything below:** the paid
vocabulary wears **ink**, never the accent. The band is already ink;
let the door's CTA and the buyer-room tags stay in the same family, so
the accent keeps meaning "the app's own actions" and a paid control
can never be mistaken for a house one.

## 2 · The composer's paid door — the funnel's mouth

Where it lives: the foot of the compose form, after the free submit —
beside the free path, **never instead of it** (the in-code comment at
the door says exactly this; keep it true in the drawing). The free
button keeps the accent and the visual priority; the door is the
quieter object below it.

**As shipped today** (v24 port): a full-width outlined box (1px border
of ink mixed 20% toward `--rule`, radius 14) — a 10px ink square, "Want
it featured?" at 13.5/800, the word "paid" at right in `--ink-3`. Open,
it shows a static mock of the band, two explainer sentences, and — live
— "Arranged directly for now — no self-serve yet."

**What is wrong with it, and must not survive the redesign:** the open
door's second sentence reads *"You get the counts and the standard cuts
— never names."* That is the standalone-v24 promise `SponsorMark.tsx`'s
header documents as **FALSE since D98** — the who-voted roll is named,
and PAID-PLAN §2 sells that roll in the report. It stands in the live
app today because `scripts/check-public-copy.mjs` is a closed
vocabulary and nobody had thought of this phrasing (its own header
warns the gate is only as wide as the phrasings someone thought of).
The redesigned door carries the shipped honest line instead — the
band's own: *they get the same public numbers you do; there is no
private cut* — and when the port lands, the gate should learn the
"never names" shape so it cannot grow back.

**Closed state** — keep the current quiet: one line, outlined, no fill.
Proposed label, in the owner's own phrasing from PAID-PLAN §7: **"Want
it asked — to a place, this week?"**, the right-side word "paid"
staying as the door's only tag. It must not outshout "Submit for
review" directly above it.

**Open state** — five zones, top to bottom. The design's one idea:
**the preview is the sell.** The buyer is shown the exact card they are
buying, wearing the real band, and every control below edits that
preview live — targeting is *explained by being drawn*, which is the
`visual > word` ladder doing the disclosure's work.

1. **The card you are buying.** The composer's existing preview card
   (hero prompt at 21/800, option rows in the side-hue rotation), with
   the topic chip replaced by the real PAID band — because that is what
   serving does (SponsorMark's header: a paid card wearing a topic hue
   reads as house content). The band shows the name choice and the
   window label, updating as the controls change.
2. **The name.** One micro-labelled chip pair — `your name` ·
   `no name` (D228: individuals buy questions; the printed name is the
   buyer's to wear or refuse, the word PAID is not). The band preview
   swaps between "PAID · Olaf S. · until 21 Aug" and "PAID · until
   21 Aug" as it toggles. Default named; one tap out.
3. **The audience.** Chip groups over the published breakdown dims
   only — age band, gender, city, country, education, relationship,
   height band (`src/v2/data/cohort.ts` COHORT_DIMS; profession and
   the politics result are structurally absent, and the logic score is
   fenced by D227 §4 — no artboard may show a "smart ones" chip). At
   most **three** picks, conjunctive (D228); the counter is the
   control: after three, the rest disable. Each pick prints onto the
   band preview immediately, in the user's own vocabulary
   ("city: Oslo · gender: men"). City and country prefill from the
   buyer's own anchors. The free composer's "who should be asked" hint
   row above stays what it is — a *hint to the review* — and the door's
   audience must read as a different object: bought, printed, bounded.
   Untargeted is a first-class choice, shown as "everyone" — the band
   then says "asked everyone", which is information too.
4. **The window and the cadence.** Window chips — `a week` · `a month`
   · `a season` · `a year` — plus a start-day row (`now` · a date).
   There is no beyond-a-year option to grey out: 366 days is the whole
   vocabulary (PAID-PLAN §8), so the cap never needs a sentence.
   Cadence: `once` · `every day` — the second is the pulse lane, and
   its consequence is said in one clause where the price line already
   is ("asked daily, reported monthly").
5. **The price and the handoff.** One line in the board's meta style:
   the cohort, the window, and — once the rate card exists — the
   computed figure with its basis ("Oslo · two weeks · billed per
   answer, cap yours to set"). Until the rate card is built the same
   slot says **"Arranged directly for now"** — the door stays honest
   about its own state, as the live build already does. Below, the
   line of record, kept at full strength (COPY.md §3 — claims are not
   word counts): *"Money buys the window and the queue — never the
   review, never the frame. They get the same public numbers you do;
   there is no private cut."* Then the handoff CTA: a full-width
   **ink** pill (the paid family, §1), label carrying the audience —
   **"Price it for Oslo →"** — which leaves the app for the web
   contract path. The app never runs a payment (PAID-PLAN §1);
   under the CTA, one `--ink-3` line says where the button goes:
   "checkout happens on the web".

States to draw: valid (CTA live), question still empty (door openable,
CTA disabled at `--surface-3` like the free submit), live-unpriced
("arranged directly" replacing the figure), and the refusal — the
server's message verbatim in the composer's existing alert box.

## 3 · The decline that sells

The board's "Yours" tab already renders a decline as: status tag,
prompt, then a ruled-off section — the standard missed at 13.5/800, the
reason at 12.5/600, and where one exists, an offer button in ink. The
place-civic decline (`functions/src/suggestions.ts`: *"questions about
what a city or country should do are the app's paid research path, not
the community board — ask something personal instead"*) is the funnel's
second mouth: it gains one offer button in the same grammar — **"Ask it
as a paid question →"** — opening the door of §2 with the prompt and
place carried over. No other decline gets the button; a decline for
form or safety must never read as an upsell.

## 4 · Asked by you — the buyer's room

PAID-PLAN §7: the account sheet is the natural door, and the room reads
only the buyer's own purchase docs plus the public aggregates everyone
reads. That fact is the design's spine: **there is no privileged view
to draw.** The room is a list of receipts around numbers that are
public; tapping a purchase's split opens the same card any user sees.

**The door.** One row on the account panel
(`src/v2/ui/LivePrivacyPanel.tsx`'s row grammar: title 14.5/800, sub
12.5/500): **"Asked by you"**, sub "your questions and subscriptions,
and their reports". Rendered **only when the account holds a purchase
doc** — for everyone else the row does not exist. No teaser row: the
account panel is a disclosure surface, and an ad for buying questions
sitting beside "your answers are public" would cost that panel its
voice. The funnel lives in §2/§3, not here.

**The room.** The suggest board's overlay chrome, h-title
**"asked by *you*"**. A vertical stack of purchase cards, newest
first. No lenses until a buyer can plausibly hold more than a
screenful; the room starts as a list.

**Purchase card anatomy** (the main new object), top to bottom on a
standard `.card`:

1. **Band row.** The real PAID band, exactly as it serves — the buyer
   sees the disclosure they wear — plus a state tag in the board's tag
   grammar: `running` (sage, the picked tone), `closed` (ink),
   `lapsed` (`--ink-3`).
2. **The prompt** at 16.5/800 (or the metric's prompt for a score
   subscription).
3. **The public split**: the feed's own revealed answer rows at card
   scale — option, rounded rule whose length is the share, numeral at
   the end — with the exact n in the kicker. The rows are a button:
   they open the ordinary question card. This is the D164 shape drawn:
   buyer, seller and voter read one number.
4. **The meter line.** Answers against the buyer's cap, in the board's
   own fill-line grammar (3px along the card's bottom edge, ink-family
   fill, round right end) with the figures above it in meta type:
   `1,284 answers · cap 5,000 · until 21 Aug — 9 days`. The window
   label composes from `until` (one value, `src/v2/data/sponsored.ts`
   — the label and the serving filter cannot disagree). A subscription
   swaps the cap for its cadence: `reports monthly · runs while paid`.
5. **The reports row.** One row per delivered report, newest first:
   `August · report + CSV` with a download glyph, the final report
   tagged `final`. Delivery is web-side; the rows link out.

**Card states to draw:** a running one-shot question mid-window; a
running place-score subscription; a closed question whose final report
is the last row; a lapsed subscription — history kept, series intact,
one quiet ink-outlined `resubscribe` handoff (re-activating continues
the same series, PAID-PLAN §5, so the card must not read as dead).

## 5 · The report — the thing the money actually buys

A rendered HTML document (plus a CSV bundle: the roll, the matrix, the
series — a manifest list at the end, no design needed beyond it). A4
portrait, one column, generous margins; the app's family at document
scale — Hanken Grotesk, the warm-neutral ground, ink figures, hues only
where the app itself would use them (option colours, place accents).
It should look like the app grew a print voice, not like a BI export.

**Cover.** The question wearing the full PAID band — the disclosure
travels into the artifact: who bought, the name they chose (or none),
the audience printed dim by dim, the window's dates. Then the headline
split at hero scale: the option rows with exact counts and the total n.
At the foot, the derivability sentence, which is a claim and not
decoration (PAID-PLAN §2 — held by a test on the builder's read set):
*"Every number in this report is computable from data any signed-in
user can read."*

**Breakdown spread.** The seven dims, one section each, in the app's
breakdown grammar. Thin cells appear in the count and not in the
chart, each with its reason — the pulse THIN discipline; absent is
never drawn as zero.

**Series.** For an over-time question, the per-day split as stacked
bars or a line per option, per-day n under the axis, gap days drawn as
gaps. For a one-shot, the same chart from the public `answeredAt`
stamps.

**The roll.** The named who-voted table: name, chosen option, the
vote-time anchor snapshot, and the logic column — the verified band in
the D227 vocabulary, `untested` printed as untested and never folded
into a band. The page states its own basis once: *names and answers
are public (D98); this is the same list anyone can page in the app,
walked to the end.*

**Second thoughts.** The from→to flow matrix (D226), options² cells
with counts, row = first vote, column = final; the diagonal does not
exist (only moved votes are in it), and the matrix carries its own
since-date — *"edits recorded since 22 Aug 2026"* — because flows
accrue from the deploy and nothing backfills.

**Neighbours and baselines.** Nearest core questions by co-answer
correlation, named with their prompts and the figure; the question's
split against the world's on those neighbours; for a place metric, the
place against country and world in the Scores lens's own comparator
grammar (D187).

**The last page of a place report is the catalog** (PAID-PLAN §7):
the metrics this place has not subscribed, each as a quiet row —
prompt, what it rates, one `subscribe` handoff. The funnel's third
mouth, and the only page of the report that sells anything.

## 6 · The public place page

D228 settled where subscribed metrics live in v1: **the report and a
public place page — the Scores lens waits.** A web page (the
`web/` family), one per subscribed place.

Hero: the place name, country context, the app's wordmark small — this
page is the app speaking, so the base grammar is the app's. Then one
card per **subscribed** metric: the metric's prompt, the latest reading
at hero scale with its n, a series sparkline, country and world
comparators, and — non-negotiable — the sponsor line in the band's own
form, because a paid metric on a public page without its PAID band
would be the covert-card failure with a city's name on it. Below the
subscribed set, the catalog tail from §5. Footer: the derivability
sentence and a link into the app.

Nothing on this page may imply the basic set is buyable or that a paid
metric is the app's own reading — the base scorecard stays editorial
and unbuyable (D228), and if the two ever share a surface it is as
separate, disclosed bands.

## 7 · The rate card — last, and honestly optional

PAID-PLAN §9 gates pricing mechanics on demand evidence, so this
artboard is the one to skip until a buyer has been turned away. When
drawn: a web page rendering the committed pricing file — one row per
cohort cell (dim · bucket · base slot-day rate · demand multiplier
with its floor and ceiling marked), `tabular-nums`, diffable-looking
on purpose — the page's one sentence is the plan's: *the price decides
who gets the scarce window; delivery is identical whatever was paid.*

## 8 · What no artboard may do

The gathered nevers, each owned by a record — a mock that breaks one
is not a taste variant, it is a proposal to reverse a decision:

- **Restyle the band.** No buyer colour, logo, link or creative; the
  word PAID is not declinable; the band replaces the topic chip
  (D195/D197, `SponsorMark.tsx`).
- **Show two paid things at once.** One slot is the unit of sale; a
  mock with two is a pitch for inflating the cap (D195,
  `SPONSOR_SLOT`).
- **Target past the vocabulary.** Three published dims at most, each
  printed; never profession, never politics, never the logic score
  (D8, D227, D228).
- **Put a checkout in the app.** Every money moment is a handoff to
  the web contract path (PAID-PLAN §1).
- **Promise a private cut — or "never names".** The shipped sentence
  is the band's; the report's roll is named because everything is
  (D98, D225).
- **Sell the review or the frame.** The paid door sits beside the free
  path; money buys the window and the queue; declines other than
  place-civic never upsell (`NEXT-FUNCTIONALITY.md` §6).
- **Blend paid metrics into the app's own voice.** Never core, never
  the base scorecard, disclosed wherever they appear (D228,
  MONETIZATION.md's tail rule).
- **Decorate away an honesty rule.** n on every reading, absent ≠
  zero, thin counted-not-placed, no smoothing — in the report exactly
  as in the app (§8 of `NEXT-FUNCTIONALITY.md`).

## 9 · What needs no design

The purchase record and its rules row, the report builder (a scheduled
script, PAID-PLAN §2), checkout/invoicing (outside the repo), the CSV
files themselves, and the band and ad card (built and gated). The
composer's *free* half is shipped v24 design and is context in these
artboards, not subject matter.
