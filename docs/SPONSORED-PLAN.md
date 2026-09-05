# The sponsored question as the one paid product — the plan

**Status: plan only, being built step by step** — the owner's *"go,
yes to the link, keep your picks for the rest"* (2026-09-05). Built
all five steps: §2.1 (D375), §2.3 (D376), §2.2 (D377), §2.4 (D378),
§2.5 (D379) — the plan is the app now, and each step's record is what
binds; this page stays as the reasoning that produced them.
Written 2026-09-05 on the owner's
*"that sounds like a bad system — if I gave you complete creative
freedom how would you remake it"* and *"that sounds better, lay a plan
for building that"*. It reshapes the paid system D313, D315 and
D371–D374 built around the ad lane, and it reverses three recorded
decisions by name (§4). Picking up any step graduates to a record in
`DECISIONS.md`; the four decisions in §5 are the owner's and come
first. The lists are not touched by this page — the steps go on
`WORKLIST.md` when the owner says go, not before.

## 0 · The short version

Sell one thing: a **sponsored question** — a question with a name on
the card, answered like any other, its results public. Give it its
own places in the feed so inventory grows with the app instead of
being one shared card a day. Price it as a **menu by reach** — ask
your city, your country, everyone — with the per-answer bill kept
underneath purely as the guarantee. Give the buyer a **shareable
results page**, which is the payoff that brings them back. And let a
sponsored question carry **one reviewed link**, shown after the
person has answered, with nothing counted — the one thing an
advertiser actually pays for, and the one decision on this page the
owner must make. The text ad, which was an ad nobody could tap, never
counted, shown one day in N, goes.

## 1 · What is wrong now

- **The ad is unsellable by design.** D197 made it text-only,
  link-free and unmeasured so the app stays free of trackers and the
  automated review has nothing to game. The cost is a product no
  rational advertiser wants: nothing to tap, nothing to learn, one
  card a day shared by rotation with everything else the scope sold.
- **Inventory is one.** `SPONSOR_SLOT` is one paid card per phone per
  day, and every campaign in a scope rotates through it. Each sale
  dilutes the last; the crowding price (D373) is the honest reading of
  that and rises as you grow. The number of things you can sell does
  not move with the number of people using the app.
- **Two products where one is native.** The app is questions and
  answers. A text ad in a feed of questions is filler; a question with
  a brand's name on it is the same reach with engagement built in, and
  it already exists (D195, D313).
- **The payoff is buried.** A buyer reads their results in the account
  sheet's room (D288) and nowhere else. Nothing they can post, nothing
  a colleague can open, nothing that makes the next purchase obvious.

## 2 · The five pieces

Each is one pull request, green on its own, in the order of §3.

### 2.1 · Retire the self-serve ad lane — BUILT, D375

**What.** The composer loses its *an ad* switch; `validateAdBooking`,
`adPriceQuote`, the webhook's ad branch, the closer's ad branch, the
room's ad card and the ad copy on the door go. `adBase` leaves the
card. What stays, for now: the committed pen (`content/ads.json`,
`runSeedAds`, `AdCard`, `v2_ads`) — empty, deliberately, and useful
for a hand contract; removing the object entirely is a later sweep
across `firestore.rules`, `data-inventory.md` and `check:content`,
listed in §4 rather than folded in here.

**Why.** §1's first point. And a door with one product is a door a
buyer understands.

**Touches.** `functions/src/paid.ts`, `paid.test.ts`, the e2e's ad
leg (§13), `src/v2/spec/suggestions.jsx`, `src/v2/data/paidBookings.ts`,
`ui/AskedByYouOverlay.tsx`, `content/pricing.json` + `check:pricing`,
`STORE-CUT-PLAN.md`'s table, `data-inventory.md`'s purchases row.

**Size.** A day. **Reverses** D315, and D374's half about ads.

### 2.2 · Paid cards get their own places in the feed — BUILT, D377

**What.** `SPONSOR_SLOT = 1` and `SPONSOR_AT = 6` become one density:
a paid card at every sixth world card — positions 6, 12, 18 … — up to
the pool's size, the pool rotated by day so the order is a property of
the bank and stable per device. A campaign appears at most once per
feed build. `partitionSponsored` returns a list rather than one card;
`world-feed.jsx` interleaves at the positions. Selection stays on the
device, the match stays disclosed, the tail-never-core rule stays.

**Why.** Inventory that grows with users. Sales stop diluting each
other until the pool is longer than what a session scrolls past.

**The price follows.** D373's crowding step applies only past a free
count: `crowdFree` (three, a routine's pick) campaigns in a scope
share nothing, and the multiplier counts the ones beyond. One constant
in the card, one term in `pricingFold.ts`; the door's sentence becomes
*room for three more* rather than *nobody else asking*.

**Touches.** `src/v2/data/sponsored.ts` + its test, `world-feed.jsx`,
`pricingFold.ts` + test, `content/pricing.json`, the door's tokens,
`docs/SCALE-PLAN.md` §5's inventory sentence, `MONETIZATION.md`.

**Size.** A day. **Reverses** D195's *one at a time* (the prototype's
*"a feed with two is a feed for sale"* — the owner's line to retire,
§5).

*Built as written. The multiplier counts the campaigns the NEXT buyer
would push beyond the free places — a card with one free place is
D373's exactly — and the door's sentence reads the crowd strip rather
than the index back: "room for 3 more" until the places are taken,
then "3 in rotation · sharing".*

### 2.3 · The menu — BUILT, D376

**What.** The rate board's three rows print a price per reach — city
€10, country €25, everyone €50 — each with *up to N answers* at the
line in force and *29 days*. Picking a row opens the composer on that
scope with that budget chosen; the budget chips stay for adjusting.
Underneath, nothing changes: per-answer billing at the locked rate,
the refund at close as the guarantee, the estimate where one exists.

**Why.** A buyer reads one number and one promise. The door's law
stays behind its tap.

**Touches.** `suggestions.jsx` (the rows, the composer's initial
budget), `content/pricing.json` (a `menu` block: scope → preset),
`check:pricing`, `smoke-overlays.test.jsx`, `VISUAL-REQUESTS.md`
item 4 (this is its copy half, done; the shape still waits on design).

**Size.** Half a day. Reverses nothing.

*Built as written, with one figure moved: the €20 chip became €25 so
the menu's three prices are three of the composer's chips, and the
window (29) went onto the card so the row and the server read one
number. The per-answer line left the rows for the ruler and the
sheet — the row says the price and what it buys.*

### 2.4 · One reviewed link — the owner's decision — BUILT, D378

**What.** A sponsored question may carry `link`: one `https` URL,
validated for shape, reviewed by the same automated review with a new
clause (the page must be what the ad says it is; no redirects to
stores of harm — the guideline text is the PR's), printed on the
card's results face as the bare domain — *harboursauna.no ↗* — only
after the person has answered, and opened in the system browser. The
app counts nothing: no tap log, no parameters added, no referrer of
ours. `check:content`'s URL nose stays for committed ads; the
validator's refusal for questions goes.

**Why.** It is the thing an advertiser pays for, and its absence is
what made the ad lane a curiosity. After answering rather than
before, so the question is answered as a question and the link is the
buyer's thank-you rather than the card's purpose.

**What it exposes, to whom, and which of the four it touches (D334's
shape).** Nothing about any user: a link is the buyer's public
content, on a card any signed-in user already reads. `web/privacy.html`
gains a sentence — *a sponsored question may carry the buyer's link;
tapping it opens their site, and we count nothing* — pinned by
`check:policy-claims`; its standing claims (no ad identifiers, no
third-party analytics, no data sold) stay true. The store forms move
by nothing: no data is collected and no tracking is added. No consent
requirement in law is reached. What it does reverse is D197's no-link
rule and the review-safety argument behind it, which is why it is the
owner's call and not a routine's (§5).

**Touches.** `paid.ts` (payload, validator, `paidQuestionDoc`),
`REVIEW_GUIDELINES`, `firestore.rules` (the question doc is
server-written; a field-shape line), `data/sponsored.ts`'s `Sponsor`
type, `ui/SponsorMark.tsx` and the card's answered state,
`data-inventory.md`'s bought-question row, `web/privacy.html` +
`check-policy-claims.mjs`, `content/feed-questions.json`'s schema note,
the e2e (a link on the booking, on the doc, refused when malformed).

**Size.** A day of code; the policy lines are the same PR.

*Built as written, on the owner's "yes to the link". Two things the
page could not know: the reviewer reads the ADDRESS and never the
page (the guideline says so, and judges by domain and path — no
shorteners, no redirect services), and `firestore.rules` needed no
line, because the question doc is server-written and the shape is
the validator's. The link also rides on the buyer's purchase record.*

### 2.5 · The shareable results page — BUILT, D379

**What.** A public page per sponsored question — *Oslo said: 62% keep
the harbour bath open* — the question, the buyer's name, the split, the
breakdown by the dims the buyer bought, the window, the PAID mark. An
HTTPS function renders it server-side on the admin SDK (the aggregate
is signed-in-readable, and a public page cannot sign in), cached for
five minutes, at a hosting rewrite `/q/{qid}`. A *share* control in
the buyer's room and on the answered card copies the address. The
report builder (D251, `scripts/report-lib.mjs`) already folds exactly
this from public reads; the page is that fold rendered as one screen.

**Why.** The payoff. A buyer who can post their result buys again, and
every post is the app's own advertisement.

**Touches.** a new `functions/src/share.ts` (App Check exempt — it
serves the open web; `check:appcheck`'s list with the reason),
`firebase.json` rewrites, `web/` (the page's style, reusing
`privacy.html`'s), `scripts/report-lib.mjs` (the fold shared),
`AskedByYouOverlay.tsx`, `check:web-headers`, `DEPLOYMENT.md`.

**Size.** Two days — the largest piece, and the only one with a new
public surface.

*Built as written, with two things the page could not know: the
functions tree cannot import `scripts/report-lib.mjs`, so the page
folds the two public documents directly (a copy of the client's
percentage rule, pinned to its shapes); and `check:appcheck` reads
callables only, so an HTTPS function is outside its list by shape —
the reasoning sits in `share.ts`'s header instead. The breakdown is by
the bought dims, as this section says; whether the page should carry
every published dim is on `OWNER-LIST.md`.*

## 3 · Order of work

1. **2.1 retire the ad lane** — removes the thing that is wrong and
   simplifies everything after it.
2. **2.3 the menu** — half a day, and it is what a buyer sees first.
3. **2.2 places in the feed** — inventory before the link, so the
   link arrives into a feed that can carry more than one buyer.
4. **2.4 the link** — on the owner's yes. Without it, 2.5 is still
   worth building; with it, 2.5 is what the link points back to.
5. **2.5 the results page.**

Roughly five and a half days across five pull requests. For launch
revenue the two that matter are the €10 city ask (2.3) and the link
(2.4): the buyers who exist on day one are small local businesses,
and they buy reach with a way to convert.

## 4 · What this reverses, and what it leaves alone

**Reverses:** D195 §1's one paid card (2.2); D197's no-link rule
(2.4) and its ad product (2.1); D315's self-serve ad lane (2.1); the
ad half of D374 (2.1). Each gets its own record when built, citing
this page.

**Leaves alone:** per-answer billing and the closer's refund (D164,
D313 — the guarantee under the menu); the demand index's shape (D373,
with 2.2's free count); the review loop and Stripe (D313); the
committed ad pen and `v2_ads` (a later sweep, its own record); the
Apple 3.1.1 question of where the door lives (`STORE-CUT-PLAN.md` —
unchanged by any of this, and 2.5's public page is a web surface that
plan already wants); subscriptions and standalone reports
(`PAID-PLAN.md` §5, §2 — still by hand).

## 5 · The owner's four decisions

1. **The link** (2.4) — yes or no. Everything else on this page
   stands without it; revenue at launch largely does not.
2. **The density** (2.2) — one paid card in six is a routine's pick;
   one in four is what the big feeds run; one in eight is quieter.
3. **The menu figures** (2.3) — €10 / €25 / €50 are this page's, on
   the €0.02 line D373 set; the included answers follow from the line.
4. **The ad object** (2.1) — retire the self-serve lane only (this
   page), or the whole object including the committed pen and
   `v2_ads` (a bigger sweep, one more PR).

## 6 · Failure modes, stated

- **A link that lies.** The review is automated; a page can change
  after approval. The guard is the visible domain, the after-answer
  placement, and the report control every card carries (D83) — a
  reported sponsored question is hidden by the same verdict path a
  take is.
- **Density that reads as spam.** One in six is a guess. The number is
  one constant, and the first week of use should re-tune it, not
  defend it.
- **The public page as a scraping surface.** It renders one question's
  public aggregate, which any signed-in user already reads whole; it
  names the buyer, who chose to wear their name (D228). Nothing per
  person, nothing new.
- **A menu price nobody pays.** €10 for a city that yields forty
  answers is the refund doing its job; the estimates (D372) are what
  turn the guarantee into a forecast over time.
