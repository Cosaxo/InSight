# Where the paid door lives — keeping the store cut

**Status: plan only** — nothing here is built, and nothing here binds.
Adoption is a record in [`DECISIONS.md`](DECISIONS.md), per
[`MONETIZATION.md`](MONETIZATION.md)'s own rule. Opened by the owner
2026-08-31: *"How should we avoid having to pay the cut to Apple and
Google for paid questions? Direct them to a separate website?"*

The short answer is yes, and the reason the question needs a document
rather than a patch is that "direct them to a separate website" names
two different moves. **Linking out from inside the app** is the thing
Apple's anti-steering rules police, and the carve-outs barely reach this
product's market. **Not having the door in the app at all** is a
different move, needs nobody's permission, and costs nothing anywhere.

## 1 · What is at risk, measured

The whole purchase funnel is in the app binary today. `SuggestOverlay`
(`src/v2/spec/suggestions.jsx`) is the door: the rate card
(`SgRateBoard`), the scope ruler with prices riding the same axis
(`SgScopeRuler`), the composer — *"the composer IS the paid flow"*, the
file's own comment at the top of `SgForm` — and the pay tap, which calls
`createPaidCheckoutV2` and opens Stripe in the system browser. It is
entered from `PaidMineCard` in `src/v2/spec/profile-general.jsx`.

D313's *"commerce stays on the web side"* is a true sentence about where
the **payment form renders**. The store rules are about where the **call
to action** lives, and that is the profile tab.

The arithmetic, off `content/pricing.json`:

| | figure |
| --- | --- |
| Question sale | €320 up front (`capEur`), 2222 answers at €0.144 |
| Ad sale | €288 flat (`adBase` €320 × idx 0.9) |
| Store cut at 30% | €96 |
| Store cut at 15% (small-business / first $1M) | €48 |
| Stripe on the same €320, EU card | ≈ €5 |

So the cut is **ten to nineteen times what it costs to process the same
payment**. That is the money question, and it is the smaller half.

### The structural half: IAP cannot express this product's billing

A paid question is **billed on answers** (D164). The buyer pays the cap
up front and the closer refunds `(cap − answers) × rate` through Stripe
29 days later, computed from a public aggregate both sides read.

In-app purchase has no primitive for that. A developer cannot issue a
programmatic partial refund of an IAP — refunds are the store's to
grant, on the customer's request. Routing this through IAP would not
make the closer expensive; it would delete it, and with it the promise
that *"the unserved part refunds automatically at close"* which the
buyer is shown at the moment of payment.

This matters to the plan's framing: the position is not *we would rather
not pay the cut*. It is that **the product's billing model and IAP are
not compatible**, which is a much stronger thing to be able to say.

## 2 · The rule, and why the carve-outs do not reach us

**The strong argument.** What is sold is advertising — distribution to
other people — not a feature unlocked for the buyer. Apple's guideline
3.1.3(e) (Advertising Management Apps) *forbids* IAP for campaign
purchases. Google Play has never required Play Billing for ad spend;
every ads-manager app takes cards. **Google is largely a non-problem;
this is Apple-shaped.**

And here the argument is structurally true rather than asserted:
MONETIZATION.md's *"a buyer gets no read path a signed-in user does not
have"* means the buyer unlocks exactly zero in-app functionality, and
`paidQuestionDoc` writes `surface: "feed"`, never `core`.

**The weak point, which is the one a reviewer sees.** 3.1.3(e) applies
to apps *"for the sole purpose of"* advertiser campaign management,
*"not offered to a general audience."* InSight is a consumer app with a
€320 B2B door in its profile tab. That is Meta's "Boost Post" shape, and
Meta lost that argument. The category argument is strong; the app-shape
argument is weak; the app shape is what gets reviewed.

**Why the link-out entitlement is the wrong fix for this product
specifically.** The post-*Epic* carve-outs are a storefront patchwork,
and this product sits in the worst-covered corner of it:

- **US** — external-link purchases carry no commission after the April
  2025 contempt ruling. Worth the least here: the currency is EUR.
- **EU (DMA)** — link-outs permitted, but Apple charges an initial
  acquisition fee, a store services fee and a Core Technology Commission
  on external purchases. Not free.
- **Norway** — EEA, *not* EU. The DMA is an EU regulation, so the first
  market this product names in its own pricing is likely under Apple's
  standard worldwide terms: no entitlement, anti-steering intact. **This
  is the load-bearing fact and §7 flags it for verification.**

## 3 · The three shapes

| | what it is | cut | cost |
| --- | --- | --- | --- |
| **A — the door is not in the app** | buying lives on the web; the app keeps the results room only | 0% everywhere | a web door, and D337 |
| **B — platform gate** | door hidden on iOS, kept on Android | 0% Apple, Play risk retained | two code paths forever |
| **C — keep it, argue 3.1.3(e)** | ship as-is | 0% if the argument lands | a review cycle, and Meta's precedent says it does not |

**Recommended: A.** It is the Netflix/Spotify reader shape — no
entitlement, no storefront patchwork, no argument to win, and it is the
only one of the three that is also true a year from now whatever the
injunctions do. B is a real option if in-app Android conversion turns
out to matter, but it buys a second code path against a risk Play has
never actually enforced.

**Two facts make A nearly free today, and both expire.** There are
**zero sales** — every `booked` array in `content/pricing.json` is empty
and every cohort sits at the floor index — so nothing migrates and no
revenue is lost. And the app has **not been submitted**: the door has
never been reviewed, so it never has to be *removed*. Doing this after a
rejection costs a review cycle and a flag on the account.

## 4 · The plan

**Phase 1 — decide and record.** The shape (§3), and a `DECISIONS.md`
entry. Everything below assumes A.

**Phase 2 — the app side.** Small, and the chunk boundary is already
clean: the overlay has exactly one purpose, so it leaves whole rather
than being cut out of a mixed file.

- Remove the door entry (`PaidMineCard`, `profile-general.jsx`) and the
  overlay from the `loadOverlays` group.
- `src/v2/spec/suggestions.jsx` (757 lines) leaves the build, with its
  `SuggestOverlay` publication and its `spec-index.js` line.
- `src/v2/data/paidBookings.ts` (240 lines) goes with it — the door is
  its only consumer, both halves.
- **`src/v2/ui/AskedByYouOverlay.tsx` is untouched.** It carries no
  purchase CTA at all (checked, not assumed): it reads this account's
  own purchase docs and the same public aggregates everyone reads. That
  is already the reader shape, which is why A is cheap.
- `src/v2/ui/CurSwitch.tsx` stays — AskedByYou renders it too.
- **A legacy tail to scope:** `SgMine` also draws the old free-suggestion
  rows (`status: 'picked'`, `onResend`). Decide whether those rows have
  anything left to show before deleting their only surface.

Gates this trips, all expected: `check:globals` **rule 4** count falls
and fails asking for its baseline to come down with it (the ratchet
working as designed); `check:figures`;
`src/v2/test/smoke-overlays.test.jsx`, which mutation-checks
`SuggestOverlay`; and `scripts/quote-copy.test.mjs`, whose `FILES` list
names `suggestions.jsx` by path.

**Phase 3 — the web door.** `web/ask.html`, beside the `paid-done*.html`
pages Stripe already returns to.

- **Zero server changes.** `functions/src/paid.ts` is UI-agnostic:
  review, quote lock, checkout, webhook and closer all already run
  server-side. The web page calls the same two callables.
- **Auth is the real design problem.** Accounts are anonymous-first
  (D3), and an anonymous uid cannot be reached from another browser — so
  a buyer's campaign would be invisible in their own app. Forced
  resolution: **buying requires a Google-linked account.** The app
  already has the link path (`linkWithPopup` / `signInWithGoogle`,
  `src/lib/firebaseImpl.ts`), so this is a gate on the web door, not new
  machinery.
- **App Check.** Both callables carry `enforceAppCheck`. A public web
  door needs a real reCAPTCHA provider, not a debug token — see §5.
- **CSP.** `firebase.json` serves `web/` under `default-src 'none'`. The
  door page needs its own header block admitting the Firebase SDK and
  its endpoints, in the shape `join.html`'s block already takes.
- The rate card prints off `content/pricing.json`, which the page needs
  fetched or inlined at deploy.

**Phase 4 — acquisition.** `web/home.html` currently says it is
*"Deliberately NOT the app"*; it becomes where the door is found. The
store listing must not point at it.

**Phase 5 — docs and gates.** §6 below, then `check:docs`,
`check:policy-claims`, `check:public-copy`, `test:scripts`.

## 5 · What it costs

**D337, decided 2026-08-30 — the day before this question was asked.**
Its premise was that *"no Firebase SDK is loaded anywhere in hosting"*
and that the web reCAPTCHA provider *"was for nobody, on the user
side."* A public web door makes both false. Provisioning reCAPTCHA is
the actual bill for avoiding the cut, and it is far cheaper than €48–96
a sale. The App Check enforcement ordering (runbook 3.4) applies.

**The app loses "ask a question" as a capability.** Worth naming
plainly: `SuggestOverlay` is the only asking surface, and it leaves. In
practice nobody was going to spend €320 from a profile tab — which is
the same observation that makes the discoverability loss small, and also
exactly why a reviewer would read the app as a general-audience app
selling in-app.

**Discoverability.** Real, and small at this price point: a city or an
advertiser arrives from a sales page or an email, not from tapping
through a consumer feed.

## 6 · What this reshapes

- **D337** — its premise, above. An amendment, not a reversal: the
  reasoning was right about the tree as it stood.
- **D313 §4** — *"commerce stays on the web side"* becomes true of the
  whole funnel rather than of the payment form.
- **MONETIZATION.md paths 2 and 3** — where the door lives.
- **PAID-PLAN §9.2** — the self-serve loop keeps its shape; only its
  front end moves.
- **`docs/STORE-FORMS.md`** — declares *"In-app purchases: No —
  MONETIZATION.md records no consumer paid tier at launch."* The
  declaration still holds (no StoreKit products); the stated **reason**
  is stale, since there is a paid tier now and it is B2B and
  off-StoreKit. The D179/D183 failure mode exactly.

## 7 · Verify before adopting

Written against knowledge current to May 2026. Both *Epic* injunctions
and Apple's EU terms moved repeatedly through 2025, so confirm each of
these against primary sources before the record is written:

1. Current text of App Store Review Guidelines 3.1.1 and 3.1.3(e).
2. Google Play Payments policy on advertising spend.
3. **Whether the DMA has been incorporated into the EEA Agreement** —
   §2's Norway conclusion turns on it, and it is the fact this plan
   would most like to be wrong about.
4. Status of the *Epic v. Apple* and *Epic v. Google* injunctions.

## 8 · For the owner

1. **Which shape** — A, B or C (§3). The plan above assumes A.
2. **Does buying require a Google-linked account?** Recommended yes;
   §4 Phase 3 argues it is forced rather than chosen.
3. **Do the legacy free-suggestion rows still have anything to show?**
   If not, they leave with the overlay.
