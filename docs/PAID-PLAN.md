# Paid questions, reports and cohort subscriptions — the plan

**Status: plan, except §3's aggregate half
([D226](DECISIONS.md#d226--the-edit-flow-matrix--second-thoughts-become-a-published-number)),
§4's logic cut
([D227](DECISIONS.md#d227--the-logic-cut--the-who-voted-sheet-groups-answers-by-the-verified-score)),
§2's report builder v1
([D251](DECISIONS.md#d251--the-report-builder-ships-and-reads-as-a-signed-in-user))
— the first two built 2026-08-22, the builder 2026-08-23 — and the
selling of §1's paid question itself, which stopped being "by hand" at
[D313](DECISIONS.md#d313--the-paid-question-sells-itself-automated-review-stripe-checkout-and-a-question-that-goes-live-with-nobody-at-the-desk)
(2026-08-26): automated review, Stripe checkout, the question written
live by the webhook, the unserved cap auto-refunded at close. §9.2's
"sell by hand at hand-set prices" is superseded for questions;
subscriptions and standalone reports still sell by hand.** Requested by
the owner 2026-08-21; everything
else below is unbuilt and binds nothing. This page extends the recorded
revenue
paths ([`MONETIZATION.md`](MONETIZATION.md) paths 1–2, re-derived in
[`SCALE-PLAN.md`](SCALE-PLAN.md) §5 and `NEXT-FUNCTIONALITY.md` §6's
paid half) into the shape the owner asked for: **a buyer gets a
downloadable report, place scores become subscribable, and cohorts are
priced by size and demand.** Picking up any piece of it graduates to a
record in `DECISIONS.md`, per MONETIZATION.md's own rule — and two
pieces (§3, §6) *reshape* standing sentences, so those records are not
optional paperwork but the actual decision.

**Where §9.2's door lives is under review (2026-08-31).** The self-serve
loop keeps its shape — review, quote lock, checkout, webhook, closer are
all server-side and none of that is in question. What is in question is
the front end: the composer and pay tap sit in the app binary, which is
what Apple's 3.1.1 addresses. See
[`STORE-CUT-PLAN.md`](STORE-CUT-PLAN.md); nothing is adopted.

## 0 · What this keeps, and the two sentences it reshapes

**Kept, deliberately, because each is what makes the thing sellable at
all:**

- **One paid thing in the feed at a time.** `SPONSOR_SLOT` stays a cap
  on inventory (`data/sponsored.ts`, D195). Demand raises *price*, never
  slot count — the ratchet shape SCALE-PLAN §5 points at revenue.
- **Tail, never core.** A paid question never joins the Mirror's corpus
  (`check:content` refuses `core: true` on a sponsored question). The
  honest aggregate is the asset; a paid-for sample isn't one.
- **Selection on the device, disclosure on the card.** The audience tag
  rides the content, the device matches it, the band says why you got
  it. The server is never asked who should see what.
- **Bill on answers** (D164). Buyer, seller and voter read one public
  number; nobody audits anybody.
- **Buyable cohorts are the published breakdown dims** — `ageBand`,
  `gender`, `city`, `country`, `education`, `relationship`,
  `heightBand` (`data/cohort.ts` COHORT_DIMS). Profession (D8) and the
  politics result (Art. 9) stay out structurally, and §4 keeps the
  logic score out too.

**Reshaped:**

1. **"No demographic report computed server-side for one customer"
   (MONETIZATION.md) — RESOLVED by removal, D225 (2026-08-22).** A day
   after this plan proposed threading the needle (reports allowed iff
   the built artifact also publishes), the owner removed the promise
   instead — an unneeded promise is a standing liability. A report is
   computed for the buyer and delivered privately; whether it also
   publishes, and on what embargo, is a per-contract term. What
   remains is fact rather than pledge, and it is the load-bearing
   half: **every number must be derivable from world-readable data**
   (§2), held by a test on the builder's read set. A report over data
   only the server can see is still refused — that would be a private
   tier of *data*, which D98's model has no place for.
2. **D86's "do not widen the edit surface"** — needs its own record
   when built. §3 adds one *server-written* provenance artifact when
   an answer is edited. The client-writable surface does not move — a
   rules test proves it — but the doc shape grows, and D86 owns that
   doc shape.

## 1 · What is for sale — three products, one window

> **D370 (2026-09-05):** the self-serve feed ad D315 added beside these
> is retired — the sponsored question is the one paid product, per
> [`SPONSORED-PLAN.md`](SPONSORED-PLAN.md). The three below are this
> plan's own and unchanged.

1. **A paid question** — the D195 machinery as shipped: `sponsor`
   provenance, disclosure band, `until` window, at-most-coarse audience
   tag, the single rotating slot. New here: the window is bounded at
   **366 days** (§8), the question may run **over time** (§8), and it
   comes with **reports** (§2).
2. **A place-score subscription** (§5) — a city/country/world metric
   in the Scores vocabulary (`rates`, D187). Subscribing an *existing*
   metric buys its recurring reports; subscribing a *new* one from the
   authored catalog additionally turns its serving on for that cohort.
   Runs as long as it is paid for — the one product with no 366-day
   cap.
3. **The report** (§2) — also sold standalone on any existing public
   aggregate, because packaging public numbers is a product in itself
   and the marginal cost is a build run.

Commerce (checkout, invoicing, VAT) stays on the web/contract side, as
`NEXT-FUNCTIONALITY.md` §6 already recommends — the app displays
disclosed content and (new, §7) the buyer's own list of what they
bought; it never runs a payment.

## 2 · The report — everything the app can honestly gather

One rule decides every line item: **derivable from world-readable data,
or not in the report.** Since D225 removed the delivery promise this
rule is the whole of the line — the report is the buyer's, privately,
but a buyer-only *number* is still refused — and it is testable: the
report builder reads only collections `firestore.rules` grants to any
signed-in user, plus the buyer's own purchase doc, and a test holds its
read set to that list.

Contents, each with its source named:

- **The headline split**, exact, and the **per-dim breakdown** over all
  seven dims — `v2_question_aggs/{qid}` and its `by` map, the same doc
  every card reads.
- **The series over time.** For an over-time question (§8), the per-day
  agg docs (`{qid}_{utcDay}`, the pulse machinery's grain). For a
  one-shot question, bucket the public `answeredAt` stamps on the
  answers themselves — no schema change, the timestamps have been
  public since D98.
- **The full who-voted roll**: name, chosen option, the anchors
  snapshot the answer was cast from (vote-time cohort, D8). In-app the
  sheet stays bounded (`VOTER_FETCH_CAP`) and pages from its cursor —
  the D101 rule; the report builder walks the same cursor to the end at
  build time. Same read path, all pages.
- **Voter attributes, logic score included** — resolved from the
  public profiles the roll already batch-reads (§4). The report gets a
  split × logic-band cut and the roll gets the column.
- **Second thoughts** — what people first voted before they moved
  their vote, as a from→to flow matrix (§3). Included per §3's terms
  and absent with a dated sentence until that ships.
- **Most-similar questions.** For core questions the nightly fit
  already publishes the structure (`functions/src/patterns.ts` →
  `v2_patterns/loadings`): nearest neighbours by loading vector, named
  with their prompts. A paid question is tail (D161: the fit's corpus
  is core-only), so the builder computes its co-answer correlation
  against `PATTERNS_QIDS` at build time, from public answers.
- **Baselines**: the question's split against the world's on its
  nearest core neighbours, and for place metrics the place against
  country and world (the Scores lens's own comparators, D170/D187).

**Form**: a rendered HTML report plus a CSV bundle (the roll, the
matrix, the series), downloadable from the buyer's page (§7). The
report is the buyer's: whether it also publishes, and on what embargo,
is a per-contract term (D225), and when the first report ships,
`web/privacy.html` says plainly that reports over the public data are
sold — the D183 discipline; the page's current sale sentence is scoped
to advertisers and does not cover this.
**Cadence**: monthly while the window runs plus a final report at
close; per billing period for subscriptions. **Build**: a scheduled
job, not a client — the same species as the patterns fit, with its
cost measured into `COSTS.md` when it ships, not estimated in prose
here.

## 3 · Second thoughts — the one line item that needed new data

**The aggregate half is BUILT (D226, 2026-08-22)** — the matrix folds
and publishes, with the trail (privacy sentence, claims pin, inventory
row, runbook carry) landed beside it. The design below is kept as
written; the per-voter half stays the owner's open call (§11).

Before D226 the pre-edit vote survived nowhere: rules allow `optionIdx`
to move with an `editedAt` stamp (D86), and `onV2AnswerUpdated` read the
old value only in the trigger's before-snapshot, folded the −old/+new
delta, and dropped it. Nothing can report what nobody stored — and every
day it waited, more first votes were unrecoverable, which made this
the **dearer-with-time item** (the `core` flag's argument) and the
first code on the list in §9. Flows accrue from the D226 deploy; edits
before it are gone, as priced.

**Proposal, smallest honest version first:**

- The update trigger folds an **`edits` from→to count matrix onto the
  agg doc** it already writes. Aggregate-only, public like the rest of
  the agg, zero per-person data beyond what D98 already publishes, no
  rules change (the trigger is admin-side). The report renders it as
  the flow the owner asked for: "what people originally voted before
  they changed their vote", at the population grain.
- **Optionally, per-voter**: the trigger stamps `firstOptionIdx` on the
  answer doc at its first edit — server-written, written once, and the
  client-writable arm stays exactly D86's (the rules test that proves
  it is the deliverable, not a nicety). This puts an "originally voted
  X" mark on the who-voted roll.

The per-voter half has a real cost the aggregate half does not:
publishing a person's retracted opinion forever, when the edit arm
exists partly so a mis-tap can be fixed. That is the owner's call to
make knowingly, in the D86-amendment record — the recommendation here
is **matrix first, per-voter only if a sold report actually wants it**.
Either way the artifact is public data about people: a
`data-inventory.md` row, one sentence in `web/privacy.html`, and
`check:policy-claims` holding it (D183's discipline).

## 4 · The logic score — filterable, never targetable

**BUILT (D227, 2026-08-22)** — as the Logic cut on the who-voted sheet,
the D146 type-cut shape: bands are quarters of the verified percentile,
drawn in scale order with the type cut's own floors, the untested thin
the basis and are never a band, and the privacy disclosure moved in the
same commit. The boundaries below stand exactly as written.

`testResults.logic` is server-written (D57), world-readable (D98), and
the who-voted sheet already batch-resolves voter profiles — the D112
scores cache rides that same read, so a **logic filter on the voter
panels costs zero extra reads**: filter client-side over what the sheet
already holds, with the absent case shown as "untested", never folded
into a band.

Two boundaries, drawn now so they do not have to be re-argued later:

- **Not a breakdown dim.** `agg.by.logicBand` would publish per-city
  intelligence readings — a new product claim with D8-sized
  consequences, not a filter. Nothing here proposes it.
- **Not in the audience vocabulary.** Buyable cohorts stay the
  published dims (§0). "Ask only the smart ones" is precise targeting,
  the compounding `NEXT-FUNCTIONALITY.md` §6 refuses.

## 5 · Place scores — a basic set, a catalog, and subscriptions

Today the Scores lens draws from the daily bank's rating questions that
declare what they rate (`rates: city | country | world`, D187) — the
**basic set**: free, editorial, always-on, and this plan does not touch
it. The City stop's answer-gating (D205: unconfirmed readers don't
write the city cell) carries over to everything below unchanged.

**The catalog.** Score metrics beyond the basic set are authored ahead
— same form gates (`check:quality`), same ordinal-type rule — and sit
**inactive** until someone subscribes. Authored, not generated: farm
hard rule 6 already keeps place inventory out of the free lanes, and a
catalog is how "a lot of options that could be added" exists without
each one being invented at sale time.

**The two subscription shapes**, exactly as the owner put it:

- **An existing, already-served metric** → the subscription buys its
  recurring reports (§2). Nothing changes in serving; the data was
  already being gathered.
- **A new metric from the catalog** → the subscription turns serving
  ON for the named cohort *and* buys the reports. Serving is the D195
  machinery: `sponsor` provenance (a place metric names who pays for
  it — a city hall, a paper, anyone), audience tag `city: X` /
  `country: Y` / untagged for world, matched on the device, disclosure
  band on the card.

**They ride the same single paid slot, and the slot arithmetic is the
pricing** (§6): the rotation pool is per-device (`pickPaid` filters on
match before rotating), so an Oslo metric occupies only Oslo's
slot-days while a world metric occupies everyone's. "World is much more
expensive because it is to everyone in the world" is not a pricing
posture — it is what the inventory actually costs.

**The Mirror boundary, decided (D228, 2026-08-22):** a paid metric is
never `core`, so it can never enter the base scorecard fold — the basic
set stays editorial and unbuyable. **Subscribed metrics stay out of the
Scores lens in v1**: they live in the report and on a public place
page, and the lens waits. If they ever mount, the recorded shape is a
**separate, disclosed band** under the base card — never mixed into the
rows a reader takes as the app's own reading — and that mounting is its
own decision, taken when a real subscription exists rather than ahead
of one.

**Lapse**: a subscription that stops being paid flips the metric
`active: false` — aggregates persist, the series keeps its history, a
final report closes it out. Re-subscribing reactivates the same qid so
the series continues rather than forking.

## 6 · Pricing — size times desire, on a committed rate card

The unit is the **cohort slot-day** (the slot's rotation share on that
cohort's devices — computable in advance from the bank, no telemetry,
SCALE-PLAN §5's whole point), and the bill is **per answer collected**
against a budget cap the buyer sets. Two factors:

- **Size**: what the cohort's slot-days cost at base rate — a city is
  cheap, a country more, the world most, in proportion to the devices
  whose slot the campaign occupies. Falls out of §5's arithmetic
  rather than being decreed.
- **Desire**: a demand multiplier per cohort cell, recomputed by a
  script from the order book — sold slot-days against available ones,
  trailing window. Men 20–30 in the US coveted → multiplier climbs;
  a cell nobody is buying → floor price. A floor so every cohort stays
  buyable, a ceiling so the multiplier never turns the slot into a
  bidding war in slow motion.

**Auction-priced, never auction-driven** (`NEXT-FUNCTIONALITY.md` §6's
line, kept): price decides *which buyer gets the scarce window*, and
delivery is identical whatever was paid — same slot, same rotation,
same disclosure. The rate card is **committed to the repo**
(`content/pricing.json` or similar), recomputed by script, diffed in
PRs like every other catalog — a price a buyer cannot see is a price
that can be quietly discriminated, and this repo's answer to that
class of problem is always the same: publish the number.

**The demand half folds itself — DECIDED, D366 (2026-09-05).** The
paragraph above shipped as a script run by hand (D288 §3), and once
D313 automated the sale nothing ran it: from 2026-08-26 every
self-serve sale moved the index by nothing. The fold is now
`functions/src/pricingFold.ts`, run by the payment webhook after every
sale and by the nightly closer every day, published onto
`v2_meta/pricing` — readable by any signed-in user, so the number is
as public as the committed file was — and laid over the committed
constants by the door and by the server's quote alike. The constants
(base, floor, ceiling, caps, fx) stay committed and re-priced by PR;
the committed demand fields are the fallback snapshot, and
`scripts/build-pricing.mjs` refreshes it with the same compiled fold.
One amendment to the formula above: the ratio is taken over the
trailing window PLUS the next fourteen days, so a sold fortnight is
demand the moment it is sold rather than a month later — D366 §3 has
the arithmetic and the one-term way back. The owner's other sentence
— *"unintuitive"* — is not settled by that record: three of the
door's numbers are on `OWNER-LIST.md` and the door's shape is
`VISUAL-REQUESTS.md` item 4.

**The buyer sets the budget, the base is the quiet price, and a
served week is a basis — DECIDED, D367 (2026-09-05).** The owner's
*"yeah lets do that"* to the four calls D366 left open, plus *"the
price per answer right now is a bit high"*. The paragraph at the top
of this section — *"against a budget cap the buyer sets"* — is now
built as written: the composer offers the card's presets (€50 · €100 ·
€200 · €320, the smallest chosen), the server holds any figure to
€20–€320, the quote locks the buyer's budget as its cap, and the
closer's per-answer bill and refund are unchanged underneath. The
floor is ×1.0 so `base` IS the quiet price, and `base` is €0.10 (a
routine's pick, on `OWNER-LIST.md`). Estimates fold in a running
campaign once it has served seven days, basis stated. And the law is
behind a tap on the board rather than read first. Per-answer billing
stays, on the owner's question and this argument: it is the honest
model while a scope's yield is unknown — a buyer in a small city pays
for the forty answers they get, not for a window that might deliver
nothing — and a flat window price becomes fair only once these
estimates exist for every scope.

**The index is crowding, with no ceiling; the quiet price is €0.02 —
DECIDED, D368 (2026-09-05).** The owner, on the ceiling above: *"a
demographic doesn't have a cap on how desired it is"* — and it was
right about what the index measured, too: booked days saturate at
"all of them" and then stop moving however many buyers want the same
cohort, so the ceiling was the end of a scale, not a cap on desire.
The multiplier is now `floorX + crowdStep × (campaigns in the cohort's
rotation per day, averaged over the next 14 days)`: nobody else, the
floor; one other campaign across the fortnight, ×1.5; five, ×3.5; no
cap. Running campaigns and the days ahead only — a campaign that ended
last month is in nobody's rotation. Questions share a day's slot by
rotation (and ads too, since D369), so a crowded day is fewer answers
per campaign, and the price rises exactly when the answers are scarce.
The buyer is protected without a ceiling by the two things already
built: the rate locked at booking and the budget bounding the spend.
The "trailing window" term and the floor-and-ceiling mapping in the
paragraph above are retired with it. And on *"isn't that still
ridiculously high?"*: `base` is €0.02 (€10 buys 500 answers with
nobody else asking), budgets €5 · €10 · €20 · €50, a €5 minimum. The
ad window did not follow and is on `OWNER-LIST.md`.

**Ads run from the day after payment and share the rotation; the ad
window follows the cut — DECIDED, D369 (2026-09-05).** The owner:
*"make the ad price follow the same cut, and how do ads work right
now. I don't like that they don't work out of the gate as that
reduces my start revenue when I need it the most."* D315's queue
started a second ad the day after the scope's running one ended —
one ad window per overlapping audience per month, a world ad blocking
every city — so the second advertiser at launch waited weeks. Retired:
an ad starts tomorrow like a question, shares the daily slot by
rotation with every campaign in its scope, and the crowding it joins
is in the flat price it locks (D368's index counts ads). `adBase` €320
→ **€40**, the ÷8 the per-answer price took from €0.16 to €0.02, so
an ad window with nobody else in rotation costs what a €40 question
budget does. What did not move: text only, no link, no tracking
(D197), one audience tag, the automated review, no refund on a flat
window.

**The vocabulary widening this pricing needs — DECIDED, D228
(2026-08-22)**: `sponsor.audience` now takes **one to three dims** (the
owner's example cohort — "men 20–30 in the US" — is exactly three),
matched conjunctively on the device with every matched dim printed on
the band. Three is the recorded coarseness ceiling: past it,
compounding published dims starts shaping a person-sized query. The
same record made the buyer **name** optional and the buyer possibly an
individual — the PAID band stays the app's own either way (§7).

## 7 · Finding it — the slot is not the problem; the missing rooms are

The voter-side placement is already not "the bottom of an endless
scroll": the paid card holds a fixed early slot in the interleave
(`SPONSOR_AT`, `data/sponsored.ts`) on every device it matches, daily,
and search reaches it like any bank entry. What does not exist is
everything around the buyer:

- **"Asked by you"** — a room (account sheet is the natural door)
  listing the buyer's questions and subscriptions: live public split,
  answers-so-far against budget, window remaining, and the report
  downloads. Reads the buyer's own purchase docs plus the same public
  aggregates everyone reads — no privileged read path to build, which
  is the point.
- **A purchase record** — `v2_purchases/{buyerUid}/…` or similar:
  server-written at contract/checkout time, owner-read (a buyer's
  billing state is their own; the card's `sponsor` block still
  discloses the *fact* of payment, and since D228 the name only when
  the buyer chose to wear one — the purchase record is where who-paid
  always lives). New collection → rules, rules tests,
  `data-inventory.md` row, `check:data-inventory`.
- **The funnel** — the suggestion composer's paid door
  (`NEXT-FUNCTIONALITY.md` §6): the free path ends at the community
  gate; "want it asked to a place, this week?" hands off to the web
  contract path. And each report is itself a funnel: the last page of
  a place report is the catalog of metrics the place has not
  subscribed yet.

## 8 · Time — windows, series, and the one-year line

- **A paid question runs at most 366 days.** `until` already enforces
  the stop (serving filter + band label are one value); the new gate is
  `check:content` refusing a sponsored window longer than a year from
  its start — which means sponsored entries gain an explicit start day
  beside `until`, set at seed time. One field, one gate rule.
- **Over-time paid questions ride the pulse machinery** — built at
  D139, designed for exactly this in `NEXT-FUNCTIONALITY.md` §2:
  per-day composite answers, per-day agg docs, the velocity bound's
  pulse term. A paid "ask this daily for a season" is that machinery
  pointed at a sponsored qid, and the report's series section (§2)
  reads the per-day docs that already exist for pulses. The window cap
  above applies — a year of days, then the final report.
- **Score subscriptions have no cap** (§5): the window extends per
  billing period for as long as the subscription pays, and the report
  cadence follows the billing cadence.

## 9 · Order of work — demand-gated, dearest-first

SCALE-PLAN §5's sequencing rule governs: machinery on demand evidence,
not ahead of it. Within that, the one exception is the item losing data
every day it waits.

1. **The edit-flow matrix** (§3, aggregate half) — **DONE, D226
   (2026-08-22)**: decision record, trigger fold with the create-path
   carry, e2e and unit pins, inventory row, policy sentence. Taken
   first because flows only exist from the day the trigger folds them,
   and nothing can backfill the votes already moved.
2. **Report builder v1** (§2) — **DONE, D251 (2026-08-23)**: a script,
   run by hand per contract (`scripts/build-report.mjs`), reading as an
   anonymous signed-in user with the read-set held by test and e2e;
   the page is the 2026-08-22 standalone's design. The four
   instruments' type cuts joined at D253 (D252 retired the promise in
   their way, D253's bridge conversion made the matcher loadable) and
   the per-axis five-band rows at D254, banded by the app's own
   thresholds. Sell by hand at hand-set prices. This plus the existing D195 machinery is a complete sellable
   product with near-zero app code.
3. **"Asked by you" + purchase records** (§7) — the first in-app build.
4. **The score catalog and subscription serving** (§5) — including the
   audience-cap amendment (§6) and the Scores-lens decision.
5. **The rate card and demand multipliers** (§6) — last, and only on
   the demand evidence SCALE-PLAN names: the day a buyer is turned
   away from a full window is the day pricing needs a mechanism.

## 10 · Failure modes

| Failure | Mitigation | Residual |
| --- | --- | --- |
| The report drifts beyond what public data can produce | The §2 rule, held by the read-set test — D225 removed the delivery promise, not this | An operator who widens the read set; the same trust every gate rests on |
| Demand inflates inventory instead of price | `SPONSOR_SLOT` stays the unit of sale; §6 prices the scarcity | Pressure to "just add a second slot" — the cap is one diff away, which is why it is a named constant |
| Paid metrics read as the app's own voice | Never core; base scorecard unbuyable; lens separation disclosed if mounted at all | A reader who does not read bands |
| Edit history chills honest edits | Aggregate matrix first; per-voter mark only by explicit decision | Once public, second thoughts are public — D98's own trade, at its sharpest |
| Desire pricing drifts into targeting | Vocabulary stays the published dims; audience cap moves only by recorded amendment; logic score fenced (§4) | Multi-dim cohorts are finer than one-dim ones — the amendment must say how fine is too fine |
| Reports mis-state thin cells | The report inherits the app's honesty rules: absent ≠ zero, thin cells counted-not-placed (the pulse THIN discipline) | A CSV consumer who averages what the HTML refused to |
| Billing disputes | Bill on answers — one public number all parties read | None; that is why D164 chose it |

## 11 · Open questions for the owner

Each is a decision the build will force; recorded here so they are
chosen rather than defaulted:

1. Per-voter `firstOptionIdx`, or aggregate flow matrix only? (§3) —
   the one still open.

Three others closed within a day of this page existing: the
report-publication question by removal (**D225** — publication and
embargo are per-contract terms), and the audience cap and the
Scores-lens mounting at **D228** (2026-08-22) — one to three dims with
each printed on the band, and report + public place page for v1 with
the lens waiting.
