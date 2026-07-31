# Decision records

Direction-setting decisions for InSight v2 (the daily/mirror app). Each is
binding for v1 of the shipped product unless explicitly overturned — record
the reversal here when that happens.

---

## D1 · Comments and "who voted" are circle-scoped only

**Decision.** Free-text comments and named "who voted" breakdowns exist only
inside Group and 1v1 scopes — i.e. among people who mutually added each
other. World-scale questions show the split, the totals, and the underdog
line; never stranger comments, never stranger identities.

**Why.** World-scale free text reintroduces the moderation surface and the
engagement-loop dynamics the product deliberately avoids. The prototype's
seeded "live takes" (fake named users in `world-feed-comments.js`) exist to
make demo rooms feel alive; shipping synthetic people as real would
contradict the product's honesty posture. No seeded fake users, ever. If
world rooms feel dead, the fix is design (good empty states, the split
itself), not fabricated activity.

## D2 · "Near" means geohash5 (~5 km), reusing the existing geo system

> **Superseded for the Near population by [D9](#d9--near-is-your-city--picked-from-a-list-or-located-on-the-device)
> (2026-07-29).** Near is now the viewer's city, from the same k-floored
> aggregates as everything else. The analysis below stands as the record of
> what the *geohash* route would have cost; nothing in it was ever built end
> to end, and it was not revived.
>
> **The 2026-07-28 amendment below is now a historical snapshot, not a
> description of the app.** It inventories the absence of every location
> API; D9's own amendment added an optional, coarse, on-device one. Points
> 1, 2 and 4 of "what turning Near on would cost" were paid. Point 3 —
> reopening `insight_discoverable` — was not, and remains the reason the
> geohash Near stays dead.

**Decision.** The Mirror's Near population is the ~5 km geohash5 cell
system already implemented (`insight_discoverable`, `aggregates_by_geohash5`,
k-anonymity floor). City and country are zoom stops of the World population
driven by profile anchors, not by location.

**Why.** The prototype telescopes Near (5 km) separately from City/Country/
Globe. Location-based Near already has a deployed, k-anonymous, tested
implementation; anchor-based city/country need none of that machinery.

**Amendment (2026-07-28) — the geohash half was never wired into v2, and
the app collects no location at all.** This record reads as though Near is
live. It is not, and the gap is total rather than partial:

- No location is ever requested. There is no `navigator.geolocation` call,
  no `@capacitor/geolocation` dependency, no `ACCESS_COARSE_LOCATION` or
  `ACCESS_FINE_LOCATION` in the Android manifest, and no `NSLocation*` key
  in `Info.plist`. Even if code asked, the OS would refuse — the purpose
  strings a prompt requires do not exist.
- The rollup still exists and is still deployed: `functions/src/index.ts`
  buckets `insight_discoverable.geohash` into `aggregates_by_geohash5`
  with a k-anonymity floor. But **nothing writes `insight_discoverable`
  any more.** The v1 client that did was deleted under D4; the only
  reference left in the functions is `deleteAccount` removing the doc.
  The aggregator walks a collection that no longer grows.
- So the Mirror's Near population renders from sample data, and says so:
  "Preview · sample people until there's live data here"
  (`mirror-tab.jsx`).

City and country are therefore **typed by the user** in the profile's
Basics card (D8), not derived from where they are. That is why the store
privacy labels answer Location: none — and the answer is accurate today.

**What turning Near on would actually cost**, so this is a decision rather
than an oversight:

1. `@capacitor/geolocation`, plus purpose strings and a runtime permission
   prompt on both platforms.
2. Computing the geohash5 cell **on the device** and sending only the
   cell — never raw coordinates.
3. Writing `insight_discoverable` again, which means **reopening the
   collection D4 deliberately closed.** That is the one that held a Big
   Five vector, political coordinates, age, gender, country, a free-text
   bio and a ~5 km cell keyed by uid, readable by any signed-in user under
   anonymous-first auth. Re-introducing it means re-introducing its rules
   *and* its tests, and `firestore.rules.v1-archive` lists the gaps to fix
   first.
4. Store privacy labels change from "no location" to coarse location, and
   the permission prompt becomes something a user can decline — so Near
   has to degrade gracefully rather than break.

Steps 1-2 are an afternoon. Step 3 is the real cost, and it trades away a
guarantee the product currently makes for free.

## D3 · Anonymous-first auth with account linking

**Decision.** First launch signs the user in anonymously; the full app works
immediately. Google sign-in is an upgrade (Firebase account linking), never
a wall. `deleteAccount` must handle anonymous users. Joining a group via
invite link must work for anonymous users.

**Why.** Never lose a user's history to a login wall. The linking path is
implemented early (Phase 2) because it is hard to retrofit.

**Amendment (2026-07-28) — "invite link" is not what shipped.** Groups are
joined with an 8-character invite code typed into the app
(`joinGroupV2`), not by tapping a link. No deep-link handling exists on
either platform: the Android manifest has only MAIN/LAUNCHER, and iOS has
no associated-domains entitlement.

The record's requirement is unchanged and still correct — an anonymous
user must be able to join without a login wall, and they can. What was
never built is the *link*, which matters because it is the growth loop: a
code has to be read out or copied by hand.

Scope if it gets built: iOS needs the associated-domains entitlement plus
an `apple-app-site-association` file; Android needs a `VIEW` intent-filter
plus `assetlinks.json`. Both need a real domain.

**Update (2026-07-28) — half of that is now done.** `firebase.json` has a
`hosting` block serving `public/` on the project's default Firebase site
(`https://prvfire33.web.app`), deployed as the last, `continue-on-error`
step of the backend workflow. That was driven by the store requirement —
both stores refuse a submission without a reachable privacy-policy URL —
but it is the same origin deep links need, so the domain half of this
record is satisfied without buying anything.

**Update (2026-07-29) — the code half of links is built.** Sharing copies
`https://prvfire33.web.app/join/CODE` (one origin constant in
`src/v2/data/links.ts`, shared with the legal pages). Hosting rewrites
`/join/**` to a static fallback page that shows the code; the Android
`autoVerify` intent-filter and the iOS associated-domains entitlement are
committed, and the app consumes a tapped link via `appUrlOpen` →
prefilled join field (parser unit-tested — server code alphabet only).
What remains is account-gated: the real Play signing SHA-256 in
`web/.well-known/assetlinks.json` and the real Team ID in
`apple-app-site-association` (placeholders ship; until they land, links
open the fallback page, which still works). Note the hosting `ignore`
no longer excludes dotfiles — `.well-known` must deploy. A `.web.app` invite is
serviceable but reads like a phishing link, so a real domain is still
worth buying before invites are a growth loop rather than a test
convenience — it attaches to the same hosting target with no code change
beyond `LP_SITE` in `LivePrivacyPanel.tsx`.

## D7 · Backend scale ceilings — recorded, not engineered around

**Decision.** Fix what breaks at any size; write down what breaks at scale
with its arithmetic, and do not build for it yet. A known limit is
survivable; a surprise is not.

### The per-question write ceiling (the one that matters)

`onV2AnswerCreated` folds every answer into two documents keyed by
question id: `v2_aggs_private/{qid}` and `v2_question_aggs/{qid}`.
Firestore sustains roughly **one write per second per document**.

So the ceiling is ~1 answer/sec on the *same* question. What that means
in users: if a daily question is answered by everyone within a 4-hour
window after they wake up, that is 14,400 seconds, so roughly **14k
answers/day before sustained contention** — call it 5–10k DAU with normal
burstiness, and lower during any spike (a push notification, a shared
link). Past that, transactions retry, latency climbs, and eventually
aggregation drops answers.

**Not sharded, deliberately.** Sharding is an XL change: N shard docs per
question, a periodic roll-up, a new scheduled function, a deploy-allowlist
edit, and it breaks the e2e's exact-count assertions in two places. That
is a lot of new machinery — and new failure modes — to remove a ceiling
of ~5–10k DAU per question for an app with zero users.

**What was done instead** (cheap, no new moving parts): the public mirror
is not rewritten on every answer — it publishes every 5th, cutting writes
to `pubRef` by ~80%. `v2_aggs_private` keeps the exact running total, so
nothing is lost; the public number lags by at most 4 answers.

**Amendment (2026-07-28) — the cadence is now uniform, for a second and
better reason.** It used to be every answer below 50 and every 5th above,
on the reasoning quoted above: a question with 12 answers has no contention
to relieve, and an inexact count there is visible. That reasoning was sound
about contention and wrong about everything else, because it only ever
considered the write ceiling.

Clients hold an `onSnapshot` on `v2_question_aggs/{qid}`. Rewriting per
answer streams `{0:2,1:3} → {0:2,1:4} → {0:3,1:4}`, where every step is one
person's choice, attributable by arrival time. Past the floor that
discloses every individual vote no matter how large the cohort grows — the
k-floor defeated by the update cadence rather than by the numbers. And the
small-question case the old rule carved out is exactly where it is worst,
because there are few enough voters to guess among.

So the same k now applies to the increment: `shouldPublishAgg` publishes
only once `PUBLISH_EVERY` further answers have landed, at any size, so each
observed delta aggregates that many votes. Pinned by unit tests that
measure the minimum gap between publishes across 2,000 totals rather than
spot-checking values — a spot check survives "publish per answer below some
threshold", which is the bug being removed — plus an e2e assertion that an
11th answer does not move the public document off 10.

Residual, stated rather than papered over: this is k-anonymity, so a reader
who already knows 4 of the 5 votes in a step can infer the fifth. That is
the bound the floor itself carries, not a new weakness, and it needs
collusion with almost everyone in the step.

The cost is real: a question now shows nothing until its 5th answer and
then moves in steps of 5, so a small room feels less live. That is the
trade — an attributable count is worse than a lagging one in an app whose
claim is that its counts are honest and its floors are enforced.

**A daily "settle publish" was considered and rejected.** The obvious
complaint about the uniform cadence is the window it creates: with 6-9
answers the public document sits at 5 and does not move, which a small
pilot group reads as broken. The proposed fix was a scheduled function
publishing the exact total once a day.

It does not work, and the arithmetic says why. A settle publishes a step
equal to `total - lastPublished`, which is 1 to 4 answers:

| answers | last published | the settle step would expose |
| --- | --- | --- |
| 6 | 5 | **1 vote — fully attributable** |
| 7 | 5 | **2 votes** |
| 12 | 10 | **2 votes** |
| 1004 | 1000 | 4 votes, mixed into 1004 |

So it reintroduces exactly the channel this amendment removed, and it does
so *worst at the sizes where it was supposed to help*. Where it is safe —
thousands of answers — the ≤4 lag it would correct is already invisible.
Unsafe where it helps, pointless where it is safe.

**What was done instead is a UI change, not a backend one.** The published
count is a lower bound, so live surfaces now say so: the daily reads
"5+ votes" and the breakdown sheet says counts move in steps of five.
That is simply accurate — printing a batched figure as exact was the real
inaccuracy — and it costs no new function, no new schedule and no new
failure mode. The remaining cost is that a pilot smaller than ten sees a
number that rarely moves, which is a reason to invite ten people rather
than a reason to weaken the floor.

The moment this needs revisiting: when a single question regularly clears
a few thousand answers a day, or when `onV2AnswerCreated` starts logging
transaction retries.

### The daily aggregators are staggered, not merged

`scheduledWorldAggregates` and `scheduledCityAggregates` each walk the
whole `insight_inbound_impressions` collection group, so running them
together doubles peak memory. They were both on `every 24 hours`, which
Firebase is free to schedule at any offset — including the same one.

They now run at fixed, non-overlapping times (02:00 and 04:00 UTC).
**Merging them was rejected**: one job doing both walks means one failure
takes out two independent surfaces, and it raises peak memory rather than
lowering it. The real fix at scale is an incremental walk windowed on
`createdAt` (already stored on every impression), not job fusion.

### Two things explicitly NOT built

**A lock between the operator rebuild callables and their scheduled
twins.** `maxInstances: 1` does not prevent it — they are separate Cloud
Run services. But the orphan-delete path is safe under interleaving, so
this is a cost concern, not a correctness one, at zero users. The free
mitigation is a line in the rollback runbook: do not invoke a rebuild
inside its schedule window. A leased advisory lock with TTL semantics, a
new collection and a rules block is more machinery than the problem.

**Closing the `assertMembershipCap` TOCTOU.** The check runs outside the
transaction that commits membership, so two simultaneous joins can both
see 19 groups and both commit. The blast radius is one user a few groups
over a soft anti-fan-out cap — and the emulator cannot prove a fix either
way, since the guarantee would rest on Firestore's index-range locking.
Not worth the change today; noted so it is a decision rather than an
oversight.

## D6 · Android backup off; iPhone-only; no custom crypto

**Decision.** Three store-facing declarations, recorded because each is a
trade rather than an obvious default.

**`android:allowBackup="false"`.** Auto Backup would copy the WebView's
localStorage and the on-disk Firestore cache — every question seen and
answered — into the user's Google Drive. The data inventory tells users
local state stays on their device, and an app whose pitch is that privacy
is enforced rather than promised should not have a silent exception.

The cost is real and users feel it: this also disables device-to-device
transfer, so an anonymous user who never links Google loses their history
on a phone swap. That is why the Google-linking path had to work first
(it was dead on both platforms until the provider config landed), and why
the privacy panel says so in as many words. Revisit only with a
`fullBackupContent` rule set that provably excludes the Firestore cache
and every `insight.*` key.

**`TARGETED_DEVICE_FAMILY = 1` (iPhone only).** The layout is a phone
design — a device mockup at desktop widths, full-bleed at phone widths —
and shipping it as an iPad app invites review against a multitasking
surface it does not support. iPhone orientation is portrait-only for the
same reason; landscape was declared but never designed for. Dropping iPad
support *after* launch reads as abandoning users, so this is much cheaper
to decide now than later.

**`ITSAppUsesNonExemptEncryption = false`.** The app uses HTTPS/TLS
through the platform and Firebase SDKs and implements no cryptography of
its own, which is the standard exemption. **This declaration must be
revisited if the app ever ships custom crypto** — local encryption of
cached answers, for instance — because it is an attestation on every
upload, not a note.

## D4 · The v1 shelf, and the legacy boundary

**Decision.** v1 ships the frozen spec (`design/InSight_standalone_9.html`):
two tabs (daily · mirror), duels (group + 1v1 sealed reveals), the feed with
passive test cards, archetype result cards, scenes, profile, search, relmap.

Shelved for v1 (kept in git history, no UI surface): genome/DNA, letters,
markers, impressions, coach, scrapbook, dreams, almanac, expenses/ledger,
body/wearables, the on-device LLM features, journal-era tracking (moods,
habits, workouts, meals, transactions, weigh-ins).

The journal-era UI in `src/` is **legacy** as of this record. It was
moved to `src/legacy/` in Phase 1 and **deleted after Phase 5 shipped**
(recoverable in git history). The client firebase layer was slimmed to
the v2 surface at the same time. Infrastructure is not legacy and carries forward: the Firebase
data layer, security rules + tests, Cloud Functions (aggregators, rate
limiting, deleteAccount), emulator setup, CI/CD, Capacitor shells, and the
test question banks.

**Why.** One product, not two. The old surfaces stay recoverable; several
shelved concepts (letters, markers, impressions) remain candidates for later
versions.

**Amendment — the v1 *rules* are retired too.** The original record kept
security rules on the "carries forward" side. That was wrong in one
direction: the rules for the deleted *client* surface stayed deployed and
writable with no client to serve. About 77% of `firestore.rules` governed
collections nothing in `src/` referenced — including `insight_discoverable`,
which any signed-in user could enumerate, holding a Big Five vector,
political coordinates, age, gender, country, free-text bio and a ~5km
geohash keyed by uid. Under anonymous-first auth (D3) that is one scripted
sign-in away from the whole user base.

Unused-but-open is strictly worse than absent: live attack surface with no
legitimate traffic to compare against and nobody watching it. Those grants
are now deleted, preserved undeployed in `firestore.rules.v1-archive` with
their reasoning and their known gaps. `firestore.rules` is v2-only plus the
server-owned collections.

What genuinely does carry forward is unchanged: the Cloud Functions
(aggregators, rate limiting, `deleteAccount`), emulator setup, CI/CD,
Capacitor shells, question banks. The v1 functions still write
`insight_*` and `aggregates_*` through the admin SDK, which bypasses rules
entirely — so denying every client grant costs them nothing.

Re-introducing any v1 surface means re-introducing its rules *and* its
tests deliberately: `firestore.rules.v1-archive` lists the gaps to fix
first (unilateral follower self-grant, unvalidated cross-user write bodies,
the stale-friendRequest re-join, the interest-items description hole).
Reading the archive before restoring is the point of keeping it.

## D5 · Sealed answers are owner-only; reveals are materialized server-side

**Decision.** Answer documents are readable by their owner only — always,
including group/1v1 answers and the denormalized anchor snapshot. Group and
1v1 visibility flows exclusively through reveal documents written by a Cloud
Function when the reveal condition is met (group: next day; 1v1: both
played). Reveal docs contain only what the reveal shows (member, chosen
option). Anchors reach analytics via the ingestion path, never via readable
documents.

**Why.** Firestore rules are document-level; circle-readable answers would
leak the full anchor snapshot to groupmates, and time/both-played gating in
rules is subtle and leak-prone. Materialized reveals make the privacy
property structural instead of clever.

**Amendment (2026-07-28) — reveals are gated on their own membership
snapshot, and the backfill set was empty.** The original record described
materialized reveals as making the guarantee structural, and left unsaid
which membership the guarantee was evaluated against. It was the parent
group's *current* `memberUids` — so the property held across users but not
across *time*: joining a group handed you every past day's votes and
display names, including those of members who had since left. That is the
one thing D5 exists to prevent, and it was live.

The read rule now gates on the reveal's own `members` array
(`resource.data.get("members", [])`), written by `revealGroupDay` in the
same `create()` as the votes. Two rules tests pin both directions — a
later joiner is denied, a departed member keeps the days they played — and
both fail against the old rule, so the fix cannot silently regress.

**The backfill decision: no backfill, because the set is provably empty.**
Reveals written before the `members` payload shipped carry no snapshot and
are now denied to everyone. The arithmetic for how many such documents
exist in production:

- A reveal doc is only written by `revealGroupDay`, which requires at least
  one duel answer for that group-day.
- A duel answer cannot be created without a question: `firestore.rules`
  requires `exists(/v2_questions/$(qid))` on every duel answer, and
  `revealGroupDay` reads the bank to resolve the day's question.
- Production's `v2_questions` is **empty**. Seeding is a manual operator
  step (`seedContentV2`) that is still owed — SHIP-CHECKLIST §1, unticked.

Zero questions → zero duel answers → zero reveals. The legacy set is not
small, it is empty, so a backfill function would have nothing to walk.
Writing one would be new machinery, a new operator callable and a new
deploy-allowlist entry to iterate an empty collection.

**Re-check this before seeding** if the backend was ever deployed somewhere
this checklist did not track, or if anyone answered duel questions against
a hand-seeded bank. The check is one console query: any document under
`v2_groups/*/reveals/*` lacking a `members` field. If any exist, they are
unreadable by their own members, and the choice is a one-off backfill from
the group's `memberUids` (accepting that it restores the roster, not the
true historical membership) or deleting them.

## D8 · Per-anchor breakdowns are built; collecting the anchors is not

> **Amended by [D9](#d9--near-is-your-city--picked-from-a-list-or-located-on-the-device)
> (2026-07-29).** Two things below are now out of date. The recommendation
> "country, not city" is reversed — `city` is in `BREAKDOWN_DIMS`, because
> it is no longer free text. And `country`, which this record treated as
> the safe choice, shipped as free text and therefore published **nothing**
> for as long as it existed: "Norway" / "norway" / "NO" were three
> sub-floor cohorts. D9 has the arithmetic.

**Decision.** The aggregation that answers "how did every kind of person
split?" ships now, dimension-agnostic and with its own k-anonymity floor.
Whether InSight ever *asks* a user for their age band, gender or country is
deliberately left open, and nothing collects them today.

**Why this is two decisions and not one.** Implementing the v13 prototype's
breakdown sheet surfaced that the data it slices by does not exist:

- `firestore.rules` validates an `anchors` map on both `v2_users` and every
  answer (`isValidV2Anchors`, seven keys), and a rules test pins the shape.
- `docs/SCHEMA-V2.md` documents anchors as "snapshot at answer time".
- **Every client write path sends `anchors: {}`** (`src/v2/data/live.ts`,
  the daily vote and the duel vote). No UI collects any of the seven fields.
- **No Cloud Function reads anchors at all** — `grep anchors functions/src`
  returns nothing.

So the field is enforced, documented, and empty. The prototype's sheet fills
that vacuum with `hash(qid:dim:bucket)` — invented rows — which is fine for a
demo room and impossible to ship behind a claim of honest counts.

**Asking users for demographics is a product decision, not an engineering
one**, and a pointed one for an app whose pitch is that it collects less. It
was put to the owner and left open, so this record covers only the half that
does not depend on the answer.

### What shipped

`foldAnchors` / `publishableBreakdown` (`functions/src/pure.ts`), called from
`onV2AnswerCreated`. It counts whatever anchor keys arrive rather than
hardcoding dimensions, so the collection decision can land later with no
backend change. With anchors empty it folds to nothing and publishes nothing
— inert, not broken.

**Document growth is bounded, so D7's ceiling does not move.** The slices
live inside the existing `v2_aggs_private/{qid}` document, which the same
transaction already writes, so no new document and no new contention point.
That only holds if the document cannot grow without bound, hence two limits:

- `city` and `profession` are **excluded**. Both are free text up to 80
  chars, so every distinct spelling would mint a permanent key.
- Each dimension caps at `BREAKDOWN_MAX_BUCKETS` (24) distinct values; past
  that, new buckets are dropped while known ones keep counting, so the cap
  degrades the long tail instead of freezing the dimension.

Worst case is 5 dims × 24 buckets × 20 options ≈ 2,400 integers, tens of KB
against Firestore's 1 MiB document limit.

**The floor is per bucket, and it survives subtraction.** Suppressing buckets
below `AGG_MIN_N` is not sufficient alone: if a dimension has exactly one
suppressed bucket and a reader knows the dimension's total, that bucket is
recoverable by subtracting the published ones, and the floor is decorative.
`publishableBreakdown` therefore applies **complementary suppression** — if
suppressing sub-floor buckets would leave exactly one hole, the smallest
surviving bucket goes too, so there are always either zero holes or at least
two. A dimension left with fewer than two publishable buckets is omitted
entirely, because one bucket is a population statement rather than a split.

> **Corrected by [D18](#d18--the-breakdown-floor-bounds-cohort-size-not-the-split-inside-a-cohort)
> (2026-07-30).** This paragraph said "per cell" and used *cell* for both a
> bucket and the per-option counts inside it. Those have different
> guarantees: the floor is tested against the bucket **total**, so a bucket
> published at the floor can still show an option count of 1. D18 has the
> arithmetic and why it is not separately fixable.

Six tests cover this, and all three mutations were checked to fail: removing
complementary suppression, loosening the floor by two, and dropping the
bucket cap.

**Politics is excluded from `BREAKDOWN_DIMS`, and not by oversight.** The
prototype slices by Left/Center/Right. Political opinion is special-category
data under GDPR Article 9: it needs explicit consent, not a silent anchor
inferred from a test result. If it is ever wanted it needs its own consent
flow and its own record here — it must not arrive as a sixth string in an
anchors map.

### What lighting this up requires

1. A product decision on which anchors to ask for, and how (this record's
   open half). Recommended shape if yes: coarse buckets only (age band, not
   birthdate; country, not city), explicit opt-in, skippable, worded so the
   user knows it is what powers the breakdowns.
2. A collection surface, and `live.ts` writing `anchors` on the profile and
   snapshotting them onto each answer instead of `{}`.
3. The breakdown UI, which is the only part the prototype can be lifted from.

Until (1) and (2), (3) would render an empty sheet, so none of it shipped.

### Corrected while here

`docs/SCHEMA-V2.md` carried `← BigQuery extension targets "answers"`. No
extension is configured in `firebase.json`, `DEPLOYMENT.md` or
`SHIP-CHECKLIST.md`; `grep -ri bigquery` across the repo returns nothing.
That line described the intended offline-analytics path for anchors and read
as deployed infrastructure. It now says what is true.

---

## D9 · Near is your city — picked from a list, or located on the device

> **Amended the same day (2026-07-29), and the guarantee changed.** As first
> written this record chose a manual picker *specifically to avoid asking
> for location*, and said so: "no device location is requested or inferred,
> so the store label stays Location: None". The product owner then asked for
> location-based detection. It is built, and the honest consequences are in
> **[Amendment: optional device location](#amendment-optional-device-location-2026-07-29)**
> at the end of this record. Everything between here and there is the
> original reasoning, which still explains why the *city* is the unit and
> why the geohash Near was not revived — but any sentence below claiming
> the app never asks for location is now false. The store label is Coarse
> Location.


**Decision.** The Mirror's Near population is the city the user **picks from
a fixed catalogue** in their profile, and it renders the same k-floored
public aggregates as everything else — counts, never people. `city` is a
canonical key (`"Oslo, NO"`) and joins `BREAKDOWN_DIMS`; `country` becomes
the ISO code derived from that key rather than free text. No device location
is requested or inferred, so the store label stays Location: None and the
privacy panel's "no GPS, no IP lookup" stays true.

This supersedes the Near half of D2. D8's recommendation of "country, not
city" is superseded too, for the reason in *Why a city is now safe* below.

### Why this rather than the geohash Near

D2 priced the geohash route at "an afternoon plus reopening
`insight_discoverable`". Two facts found while implementing this make that
price much worse than recorded, and both were verified rather than reasoned
about:

- **The floor is 20, not 5.** `functions/src/index.ts:45` sets
  `K_ANON_FLOOR = 20` for the geo aggregates. Near would need 20 users
  inside one ~5 km cell before rendering anything at all. The city path
  reuses `AGG_MIN_N = 5`.
- **The geohash aggregator has almost certainly never produced a cell.**
  `index.ts:239` reads `disc.geohash` — a top-level field — while the v1
  writer wrote it nested under `location.geohash`
  (`firestore.rules.v1-archive:135`). So the "deployed, tested
  implementation" D2 leaned on was not merely unwired; the half that was
  wired was reading the wrong path.

So Near was not a feature awaiting a client. Finishing it meant reopening a
collection D4 deliberately closed, adding a permission prompt, changing both
store privacy labels, *and* fixing a latent field-path bug — to reach a
20-per-5 km floor most cities would not clear for a long time.

### Why a city is now safe when D8 said it was not

D8 recommended "country, not city" and `pure.ts` excluded `city` from
`BREAKDOWN_DIMS`, both because it was free text: "every distinct spelling
would mint a key forever". That reasoning was right about free text and
wrong about cities — the fix is to stop the field being free text.

It also missed that **`country` was already in `BREAKDOWN_DIMS` as free
text** and had been since D8 shipped. "Norway", "norway" and "NO" were three
cohorts, each below the 5-person floor, each suppressed. The country
breakdown has been publishing nothing at all. That is fixed here, and it is
the largest single correction in this change.

### The catalogue, and its arithmetic

`public/cities.txt`, generated by `scripts/build-cities.mjs` from GeoNames
(CC BY 4.0, via `all-the-cities`, MIT) and validated by
`scripts/check-cities.mjs` in CI:

| | |
| --- | --- |
| Places | 10,929 |
| Countries | 245 of 246 |
| Rule | population ≥ 50,000, plus every national and admin capital |
| Size | 139 KB raw, 76 KB gzipped |
| Cost at cold start | zero — fetched on first open of the picker |

Known limits, recorded rather than discovered later:

- **99 name collisions merge (0.9%).** Two places sharing a name within one
  country become one cohort; 90 of the 99 pairs are in different admin
  regions. The only disambiguator the dataset carries is GeoNames' numeric
  admin code, and "Springfield (25)" means nothing to a reader. Revisit if
  `admin1CodesASCII` ever ships alongside.
- **One place is dropped.** "Dolores Hidalgo Cuna de la Independencia
  Nacional" (MX, 59k) is 49 characters with no `altName`, and the bucket key
  `Name, CC` must fit `BREAKDOWN_MAX_LABEL` = 40. The build prints it every
  run so the count stays visible if it grows.
- **29 names are normalised.** `.` and `/` are field-path syntax that
  `breakdownBucket()` rejects, so "St. John's" becomes "St John's" and
  "Gasteiz / Vitoria" becomes "Gasteiz - Vitoria". Offering a city in the
  picker and then dropping it from every breakdown is the worse failure.
- **The 24-bucket cap bites hardest here.** A global question can touch far
  more than 24 cities; the long tail degrades rather than the dimension
  freezing. `city` is the first dimension where that is a routine outcome
  rather than a theoretical one.
- **Pre-D9 profiles hold free text** ("oslo"). It does not parse, so those
  users see their old value with a prompt to re-pick and contribute no
  city or country cohort until they do. Their profile is not silently
  blanked.

### One thing the server now enforces that it did not before

`breakdownBucket()` takes the dimension and shape-checks `city` and
`country` against their vocabularies. Anchors are written by the **client**
onto its own answer document, and `firestore.rules` can only cap their
length — so before this, anyone could send 24 nonsense cities and, because
the bucket cap is first-come-first-served, blank the city dimension for
every other user of that question. That is closed, with a test.

### What Near deliberately does not show

People. Not names, not avatars, not "someone near you also said". D5 keeps
the client out of every other user's documents and the aggregates carry
only counts. The six named neighbours the prototype showed
(`sample-data.js`) were never real and are gone from live mode; a field of
strangers would be sample data wearing a live badge, which is the thing
this replaces.

### Still open

Removing sample people from the **other** Mirror populations (Circle,
Groups, World) — they still render seeded names behind the "Preview ·
sample people" badge that D1 requires. Near is done; the rest is tracked
separately.

### Sample people in the rest of the Mirror (2026-07-29)

Near was one of five Mirror populations. Where the others stand in live
mode, so the remaining work is a list rather than a discovery:

| Population | Real backend | Live behaviour now |
| --- | --- | --- |
| You | the viewer's own profile | real |
| Circle | **none** — v2 has no person-to-person graph at all | honest empty state pointing at groups |
| Groups | reveal history (`v2_groups/{gid}/reveals/{day}`) | **real** — see the 2026-07-29 update below |
| Near | city breakdown, floor 5 | real |
| World | country breakdown + overall totals | real |

**Update (2026-07-29, later the same day) — Groups is real now.** The
paragraph below said the statistics "need a server-side source that
reveals alone do not provide". That was wrong, and working out why is
what unlocked the feature: the reveal docs already carry per-member votes
with names, the read rule already scopes each doc to the members who
played that day, and alignment / twin / contrarian are just arithmetic
over those docs. No new collection, no new rules, no new function.

`LiveGroupsMirrorBody` (typed TSX under `ui/`) renders the portrait from
`LIVE.social.revealHistory(gid)`: up to 14 days of reveal docs, fetched
by direct day-key `getDoc`s — never a collection query, which the
member-snapshot rule cannot prove and would deny wholesale. Cost ceiling
is 13 reads per group per session (yesterday rides the existing
listener), paid only when the stop is opened. `permission-denied` on a
day is cached as null: it is the late-joiner rule working, and the doc
will never become readable.

The arithmetic lives in `src/v2/data/groupPortrait.ts` (pure, tested):
a 2–2 tie counts as *with* the majority for every voter in it, alignment
is over days the viewer actually played, and nobody is named "most like
you" on fewer than 2 shared days — one shared day is a coin flip, and a
label built on it would be the fabrication this replacement removes.

What the demo body showed that the live one deliberately does not:
trait axes, compare populations, and "how they see you" crowns. No real
source feeds them, so they are absent rather than faked. Duos are also
excluded on purpose: with two voters any disagreement is a 1–1 tie, so
the alignment ring would read 100% forever; a duo's real mirror is the
1v1 tab's reveal.

The original assessment, kept for the record: `GroupsMirrorBody` (the
demo body, still what non-live builds render) reads `window.DUELS`,
which is entirely local — group definitions in `localStorage`, members
from the 49 seeded people in `relmap-core.js`.

**World's City zoom stop is gone in live mode.** After this change Near IS
your city, and keeping the stop would be the same panel behind two chips.
The demo path keeps all three, since its city view is a different (mock)
thing entirely.

### Amendment: optional device location (2026-07-29)

**Decision.** The profile's city field gains an optional **"Use my
location"**: one coarse fix, resolved to a catalogue city **on the device**,
coordinate discarded. The manual picker stays and is the fallback for every
failure path. Requested by the product owner after the picker shipped.

**What is actually collected.** A city name — `"Oslo, NO"`, the same string
the manual picker produces. `src/v2/data/locate.ts` is the only module that
ever holds a coordinate: `locateCity()` returns a catalogue **key** and a
rounded distance, never a position, so no caller can obtain one even by
accident. Nothing writes latitude or longitude to Firestore, to
localStorage, or to Sentry. The most precise location this system can hold
about a person is the name of a city, by construction rather than by
policy — which is the property that makes the privacy copy checkable.

**Precision is capped at both ends, deliberately.**

| | |
| --- | --- |
| iOS | `NSLocationDefaultAccuracyReduced = true`; no `requestTemporaryFullAccuracy` call exists anywhere |
| Android 12+ | `ACCESS_COARSE_LOCATION` only — FINE is capped at `maxSdkVersion="30"` and cannot be held |
| Android 7–11 | FINE is declared, and the reason is below |
| Catalogue | coordinates stored at 2dp (~1.1 km), so a finer fix could not change which city wins |

The Android 7–11 exception is not a compromise anyone chose. Capacitor's
plugin selects its permission alias by OS version: on API 31+ with
`enableHighAccuracy: false` it requests COARSE alone, but below 31 it
requests the alias `[COARSE, FINE]` — and Capacitor's Bridge resolves a
multi-string alias as *all granted or none*
(`Bridge.getPermissionStates`: "multiple permissions with the same alias
must all be true, otherwise all false"). With COARSE alone declared, that
alias can never reach GRANTED on API 24–30: the prompt appears, the user
accepts, the call still fails, permanently. The WebView's own
`navigator.geolocation` path has the identical check. So FINE is declared
with `maxSdkVersion="30"`, confining it to the versions that structurally
require it — and to the versions that never offered the user an
Approximate/Precise choice in the first place. It goes away when minSdk
reaches 31.

**Store labels change, and the old justification is dead.**
`docs/SHIP-CHECKLIST.md` said "Location: **None** — city/country are
user-entered, not location". That argument does not survive a GPS button.
The row is now **Coarse Location, linked, App functionality** — declared
even though no coordinate is transmitted, because a city name is still
coarse location data and under-declaring is the direction that gets an app
pulled. Precise is **not** ticked, and the table above is why.

**A hang found by running it rather than reasoning about it.** The first
implementation set `PositionOptions.timeout = 12000` and assumed that
bounded the operation. It does not: the Geolocation spec excludes the time
spent acquiring permission from that timeout, so a prompt dismissed without
an answer leaves `getCurrentPosition` pending **forever**. In a browser the
button sat on "Finding your nearest city…" past 14 seconds. There is now a
wall-clock deadline over the whole operation, permission included. All four
failure paths — denied, unavailable, timeout, unsupported — were driven in
a real browser and each returns to a usable picker with its own message;
"we couldn't find you" after a deliberate refusal reads as broken software,
so a refusal says "No problem — search for your city instead."

**What did NOT change.** No reverse-geocoding service and no network call:
the answer comes from the bundled catalogue, offline. No background or
continuous location, no location history, no IP-based lookup. Location is
never requested until the button is tapped, and declining leaves the app
fully functional. `insight_discoverable` stays closed (D4) — this amendment
does not revive the geohash system, and the analysis above for why that
system was not worth reviving is unaffected.

---

## D10 · @capacitor-firebase/app-check is installed under an npm alias

**Decision.** `package.json` installs `@capacitor-firebase/app-check` under
the alias `capacitor-firebase-app-check`, so it lands in
`node_modules/capacitor-firebase-app-check` rather than at its scoped path.
One import in `src/lib/appcheck.ts` uses the alias.
`npm run check:ios-spm` enforces all of it.

**Why.** The iOS build could not resolve its dependencies at all:

```
error: Could not resolve package dependencies:
  product 'AppCheckCore' required by package 'googlesignin-ios'
  target 'GoogleSignIn' not found in package 'app-check'.
Conflicting identity for app-check: dependency 'github.com/google/app-check'
  and dependency '…/node_modules/@capacitor-firebase/app-check' both point
  to the same package identity 'app-check'.
```

SwiftPM derives a package's **identity from the last component of its
path**. Two packages resolve to `app-check`:

| Package | Comes from | Identity |
| --- | --- | --- |
| `@capacitor-firebase/app-check` | direct dependency, local path | `app-check` |
| `github.com/google/app-check` | GoogleSignIn ← `@capacitor-firebase/authentication` | `app-check` |

SwiftPM prefers the local package, so `GoogleSignIn` looks for its
`AppCheckCore` product inside the Capacitor plugin, which has no such
product, and resolution fails before anything compiles. Renaming the install
directory renames the identity, and the two packages stop colliding.
Nothing about either package changes.

### What was rejected, and why the alias won

| Option | Cost |
| --- | --- |
| **npm alias** ✅ | One odd-looking import, one guard script. No feature lost. |
| Migrate iOS to CocoaPods | A native project migration and a CI rewrite, to work around a naming rule. |
| Drop `@capacitor-firebase/app-check` | Loses native App Check attestation — D3 makes it the only control between the public surface and unlimited free anonymous accounts. |
| Drop native Google sign-in | Removes GoogleSignIn and the collision, but D6 turned Android backup off, which makes linking Google the only way an anonymous session survives a lost phone. |
| Hand-edit `ios/App/CapApp-SPM/Package.swift` | The file says `DO NOT MODIFY THIS FILE - managed by Capacitor CLI`; `cap sync` reverts it and `native-sync-drift` reports it. |
| Bump the plugin version | Cannot help. The identity comes from the package *name*, which is the same at every version. |

### The trap this leaves behind

The alias is invisible everywhere except one import line, and the obvious
tidy-up — reinstalling the package under its real scoped name — silently
reverts it. The resulting failure is a macOS-only CI job whose error message
mentions neither `package.json` nor the alias.

So `scripts/check-ios-spm.mjs` asserts three things on every PR, on Linux,
in under a second: the alias is declared and points at the real package, the
scoped name is *not* a direct dependency, the generated `Package.swift`
references the aliased path, and no source file imports the scoped name.
Both regressions were tested by performing them.

### Delete this when

Either `@capacitor-firebase/app-check` renames its published package, or
SwiftPM gains per-dependency identity overrides. Verify by reverting the
alias and watching the iOS job: if it stays green, D10 is obsolete and the
guard should go with it.

**Note.** The alias install moved the plugin from 8.2.0 to 8.3.0 — a minor
bump taken incidentally, not a deliberate upgrade.

---

## D11 · The feed's argument surfaces are demo-only, by structure not by flag

**Decided:** 2026-07-29 · **Status:** binding

The v14 prototype's world feed carries five ideas the live product cannot
publish at world scale: named takes, counter-arguments, "minds moved"
signals, crossfire (your side against the strongest opposing take), and
friend dots on the result tiles. All five are ported and all five are live
today — on demo cards only.

The line is drawn in exactly one place, and it is not a feature flag:

```js
// world-feed.jsx, renderEngage
if (window.LIVE && window.LIVE.demoInProd) return null;
if (q.live) { … return the k-floored breakdown button alone … }
```

Everything else — `renderTakes`, `takeCard`, `WF_COUNTERS`, the sort
toggle, `renderWhy` — hangs below that return and is unreachable from a
live card no matter what `opts` says. `friendSides` is the one exception
that had to be gated at its own call site, so it carries the reasoning
inline. A second layer sits underneath: `live.ts`'s `buildFeedGlobals`
sets `WORLD_FEED_COMMENTS = {}`, so in live mode there is no take data to
render even if the gate were removed.

This was verified rather than assumed. Forcing a demo question to
`live: true`, seeding it a counter with a recognisable string, and voting
it through in a browser leaves the card showing the who-voted button and
the vote scale, and none of: the takes button, the friend dots, the "Why?"
line, the minds-moved counts, or the seeded string.

### Why demo-only rather than dropped

Dropping them would make the prototype and the app diverge in a way nobody
could evaluate — the demo build is how these ideas get judged before
anyone decides whether a rules change is worth it. Keeping them behind a
flag *only* would be worse: a flag is one careless `opts` change away from
publishing free text and named votes at world scale, which is what D1
forbids.

### What it would take to make any of them live

Free-text takes at world scale need a moderation path and a rules change,
and named who-voted needs a reversal of D1. Neither is on the table. The
counters, signals and crossfire additionally need real reply data, which
no collection currently holds.

### The one thing this port did change for live cards

`renderInsight` — the published surprise cut (D8) — was dead code: its
only call site sat *below* `renderEngage`'s `if (q.live)` return, while
`feedInsight` returns null unless `q.live`. So the line could never
render. It now renders on the live branch, where it belongs, and takes
the place of the who-voted button when present (it opens the same sheet).
Confirmed by running the same probe against the unmodified file: same
finding computed, no line drawn.

### Not ported — reversed, same day

This section originally deferred the prototype's v2 **card skin**
(bare/bleed grounds instead of a boxed card) on the grounds that it also
rewrites the duel tiles and the rank list. That was the wrong call, and
it was wrong in a way worth recording: the skin is the single most
visible thing on the screen, so deferring it meant the app still did not
look like the prototype it was being ported from — which was the entire
point of the exercise. "Smallest change that closes the problem" is not
the smallest change that compiles.

The skin is now ported, along with three shell-level differences the
module-by-module comparison never looked at, because it compared modules
and not the shell they render into:

| | was | now |
| --- | --- | --- |
| Daily header | `MH · inSight · 🔍`, tabs on a second row | `MH · World Group 1v1 · ⊙ · 🔍`, one row |
| Mode switcher | rendered inline by `DailySplit` | portaled into `#daily-mode-slot` in the header |
| `PassiveMeter` | led the feed's chip row | rides in the header, where it reports across tabs |
| Feed card | boxed, shadowed, gradient | bare — a hairline and the page ground |
| Duel tiles | generated tile art, label in a blurred pill | flat ground, label at the foot, share rising from the floor |

Verified by rendering the prototype and the app at the same viewport and
measuring: every landmark now lands within 2px of its counterpart, and
the header's text sequence is identical.

### One thing the skin port had to add that the prototype did not need

A duel tile's fill height **is** its share. The prototype has no live
cards, so it draws the fill whenever you have voted; here that would
publish the split geometrically on a card sitting below the k-floor —
the same disclosure as the numeral, in a different alphabet. Both the
fill and the numeral are therefore gated on one `shares` predicate that
includes `!(q.live && q.tooSmall)`.

### The Mirror's scale was the same miss again

The population picker was still the old two-level control: five stops
(You · Circle · Groups · Near · World) with the three world zooms hidden
in a second pill row inside the hero. v14 flattened them onto one
graduated axis of seven — the zooms are stops on the same telescope, so
they belong on the same telescope — leaving the Mirror with exactly two
levels, WHO and WHAT, instead of three.

Ported, with D9 preserved on the new axis rather than on the deleted
control: **live mode drops the City stop**, because Near IS your city
there, and two stops resolving to one cohort is how a scale starts lying
about what it measures. `WorldZoomControl` is deleted — keeping it would
offer the same choice twice.

One edge case the flattening creates, and its fix: a session that
persisted `worldZoom: 'city'` and then goes live lands on a stop the axis
no longer draws, leaving nothing selected. `MirrorTab` resolves city →
country once, for the axis and the panel together. Verified by parking on
City, flipping to live, and confirming Country comes up selected.

### Why there is now a tool, and what it found

Four rounds of "the visuals are wrong" were resolved by comparing
screenshots by eye, one report at a time, with the user acting as the diff.
That method has a floor it cannot get below — it finds what someone
happens to look at — and the misses it left were exactly the ones eyes are
worst at: a 30px headline rendering at 26px, a sort chip carrying a chevron
the prototype does not have, a daily option 2px under its 56px floor, a
rank hint at 12.5/600 instead of 13/500.

`scripts/style-diff.mjs` walks both builds across seven screens and
compares typography, colour and geometry per rendered string. Run once, it
reported **15 distinct differences across 700 elements**; after fixing
them, **0 across 2,891**. That is the whole visual gap, found in one pass
rather than four rounds.

It is not wired into CI: playwright is not a dependency of this repo (the
e2e drives emulators over raw Node), a design reference is not a
correctness gate, and some divergences from the prototype are deliberate.
The script's header lists those.

### The bug it found that no eye would have

The same run reported five strings present in the prototype and absent
from the app. They were five whole feed cards — every lens question, from
all five minor lenses. The cause:

```js
if ((i + 1) % 4 === 0 && ti < tqs.length) feedList.push(tqs[ti++]);
else if ((i + 1) % 8 === 0 && li < lqs.length) feedList.push(lqs[li++]);
```

Every multiple of 8 is a multiple of 4, so with `else if` the test branch
won every lens slot and **not one lens question ever entered the feed**.
Nothing in the tree could catch it: it type-checks, it lints,
`check:globals` is happy, and the feed renders a perfectly plausible stack
of cards. The only symptom was 58 cards where there should have been 63.

Fixed to two independent `if`s with the prototype's cadence of 9, which is
coprime with 4 so the two cadences drift past each other instead of
colliding. `src/v2/data/feed-interleave.test.ts` pins the property — both
streams must drain, and the lens cadence must not be a multiple of the
test cadence — and includes the old shape as a test that asserts it
produces zero lens cards, so the regression cannot come back quietly.

### Deliberate divergence, kept

The prototype offers `skip` on every unanswered card. The app hides it on
test and lens questions: those fill an instrument, so a silent skip reads
as a gap in your own results rather than a question you passed on. That is
the one difference style-diff is told to expect.

---

## D12 · Rank questions are out of the live feed until answers can carry an order

**Decided:** 2026-07-29 · **Status:** binding until the pipeline below exists

The seeded bank carries 8 `type: "rank"` feed questions, and
`buildFeedGlobals` served every feed question as a single-choice vote
card — so "Pure athleticism — rank them" rendered live with a pick-one
UI, folding single options into an aggregate that claims to be a ranking.
Wrong-shaped answers are worse than no card: the counts stop being what
the prompt says they are, which is the same honesty rule that makes
answers immutable (D5). `live.ts` now excludes `type: "rank"` from the
live feed bank (unit-tested; the test fails without the filter). The
demo feed keeps its rank cards — they never touch aggregates.

### What making them live actually costs

1. **Answer shape.** A ranking is an order, not an index: `order:
   number[]` alongside `optionIdx`. Rules can bound the list's size but
   cannot iterate it (no forall), so element validation must live in
   `onV2AnswerCreated` — malformed permutations dropped at fold time,
   the same trust boundary every vote already crosses.
2. **Aggregation.** Per-item position-sum + count is enough to publish a
   crowd order (sort by mean position) and is k-safe at the same
   `AGG_MIN_N`/`PUBLISH_EVERY` cadence as counts. A full permutation
   histogram is NOT publishable — with n! cells, most cohorts put single
   users in identifiable cells.
3. **Client.** `buildFeedGlobals` mapping `type: "rank"` with `items` +
   `crowd`, a `LIVE.vote` variant that sends the order, and the feed's
   existing `renderRank`/`tapRank` (already built for demo) pointed at
   real data.
4. **Tests.** Rules (shape bounds), fold (dropped invalid orders, the
   position-sum arithmetic), floor behaviour, and an e2e leg.

None of it is hard, but every piece touches the enforced-privacy path,
so it ships as one deliberate change or not at all. Until then the live
feed is honest about what it can collect.

---

## D13 · The v1 compute is deleted, for the reason D4 deleted the v1 rules

**Decided:** 2026-07-30 · **Status:** binding

**Decision.** Nine Cloud Functions are deleted from `functions/src/index.ts`:
`rebuildAreaAggregates` / `scheduledAreaAggregates`, `rebuildWorldAggregates` /
`scheduledWorldAggregates`, `rebuildCityAggregates` / `scheduledCityAggregates`,
`sendInboundImpression`, and `seedTaxonomies` / `scheduledTaxonomies`.
`deleteAccount` stays, **including every line that erases a v1 collection**.
The file goes from 1,502 lines to 314; the deployed surface from 18 functions
to 9.

**Why.** D4 retired the v1 *rules* on the argument that "unused-but-open is
strictly worse than absent: live attack surface with no legitimate traffic to
compare against and nobody watching it." It put the Cloud Functions on the
*carries-forward* side of that same boundary. That was right when written and
stopped being right, and no record noticed — D2's own amendment later said the
aggregator "walks a collection that no longer grows" without drawing the
conclusion. This record draws it.

**The arithmetic — every one of the nine could not produce output.** Verified
by tracing writers, not by reasoning about intent:

| Collection | Written by | Read by |
| --- | --- | --- |
| `insight_discoverable` | **nothing** since D4 deleted the v1 client | the three aggregator families |
| `insight_inbound_impressions` | `sendInboundImpression` only | world + city aggregators |
| `taxonomies` | `seedTaxonomies` only | **nothing** (its reader was `src/data/taxonomies.ts`, deleted with the v1 client) |
| `aggregates_by_geohash5` / `_media` / `_world` / `_city` | the aggregators | **nothing** in `src/` |

`sendInboundImpression` had **zero callers** in `src/`. So the chain was
closed at both ends: a callable nothing invoked, writing a collection only
functions read, feeding documents nothing rendered. D9 had already found the
one wired path was reading `disc.geohash` while the v1 writer wrote
`location.geohash` — so even the half that ran was reading a field that never
existed.

Three of the nine were on schedules (02:00, 04:00 and 06:00 UTC), each holding
512 MiB / 480 s per `ops.ts`. They were billed, monitored work with a
guaranteed empty result.

**What deliberately did NOT change.** `deleteAccount` still deletes
`insight_discoverable/{uid}`, the `insight_inbound_impressions` this user sent
into other subtrees, the `relations` naming them, and `insight_ratelimits/{uid}`.
Production may still hold v1 data, and right-to-erasure has to reach it whether
or not anything still reads it. Both `fieldOverrides` in
`firestore.indexes.json` stay for the same reason — they index the two
collection-group queries erasure depends on, not the deleted aggregators.
`firestore-tests/e2e-delete-account.mjs` seeds and asserts all four, unchanged
and still passing, which is what makes that claim checkable rather than stated.

**`meetsKFloor` stays in `pure.ts`.** Its v1 caller is gone but
`publishableBreakdown` uses it, so the k-floor remains one named decision
instead of an inline `>=`. The genuinely orphaned helpers — `topMedia`,
`summarise`, `averagePersonality`, `ageBucket`, `tally`, `topInterests`,
`slugifyCity` and the media types — are deleted with their 16 tests (the
suite goes 51 → 35). They
described a media/personality/demographics API for a product surface that no
longer exists; keeping tested-but-unreachable code is the same failure as
keeping deployed-but-unreachable functions, one layer down.

### The part this does not finish

**Dropping a function from the deploy `--only` list stops deploying it; it does
not delete the deployed copy.** All nine are still live in `prvfire33` until an
operator runs `firebase functions:delete` once — the exact command is in
`docs/DEPLOYMENT.md`. Until then the three schedules keep firing. This is
recorded rather than automated because a `functions:delete` in CI is a
destructive operation triggered by a merge, which is a worse failure mode than
three cheap no-op schedules surviving a few days.

The `aggregates_*` and `taxonomies` documents left behind are inert: nothing
reads them, and they hold k-floored anonymous averages (floor 20) with no
per-user provenance, so they raise no erasure obligation. Dropping them is
console work, not code.

**`insight_discoverable` is the exception, and it is not inert.**
Amendment (2026-07-30). The residue table above holds for the aggregates.
It does not hold for `insight_discoverable`, which this record's own
arithmetic listed as "written by nothing since D4" — a collection with no
writer and, after D13, no reader, still holding one document per v1 user:
`personality` (Big Five vector), `political` (econ/social coordinates),
`age`, `bio`, `role`, `displayName` and a geohash
(`firestore.rules.v1-archive:437-490` is the shape).

`political` is special-category data under GDPR Art. 9. Unlike the
aggregates there is no k-floor and no anonymity to appeal to: the document
key *is* the uid.

**The remedy changed, and the change is the point.** `docs/SHIP-CHECKLIST.md`
carried a "scrub" item that truncated `location.geohash` to 5 chars and
deleted `location.geopoint`, on the stated grounds that "rules now cap
`insight_discoverable` writes to a bare geohash5 cell". That cap is
`isValidDiscoverableWrite()`, which D4 moved to `firestore.rules.v1-archive`
— undeployed. So the sentence justifying a field-level scrub described a
rule that has not been enforced since D4, and the scrub it justified would
have left the Art. 9 payload in place while reading as done.

Field-level truncation is therefore the wrong operation twice over: it
protects against a client read path that no longer exists (the live rules
deny the collection outright, pinned in `rules.test.ts`), and it leaves
standing the fields that actually carry the obligation.
`docs/data-inventory.md` had it right — "the honest scope is the whole
document, not just its location field" — and gates the store privacy
answers on it.

**Decision: delete the documents.** `scripts/scrub-v1-discoverable.mjs`,
dry-run by default, `--apply` to delete. It counts field presence and
never prints a value or a uid, because a report that echoes political
coordinates into a terminal is its own disclosure. Verified against the
Firestore emulator rather than reasoned about.

Kept out of CI and out of the deploy path for the same reason
`functions:delete` is: a merge that can empty a collection is a worse
failure mode than a one-off command someone runs with the dry run in front
of them. `deleteAccount`'s per-uid delete is unaffected and still tested.

### Reversing this

Everything is in git history at `802e361`, the same place D4 left the v1
client. Restoring any of it means restoring its rules *and* its tests
deliberately — and note that the geohash aggregator would need the
`disc.geohash` field-path bug fixed before it could ever have worked
(D9). `firestore.rules.v1-archive` still lists the rules gaps to fix first.

## D14 · Catalog answers are keys into a shipped catalogue; the reveal is a canon

**Decided:** 2026-07-30 · **Status:** binding

docs/CATALOG-QUESTIONS.md graduated from sketch to machinery: the
backend accepts catalog answers and publishes their reveal. The
load-bearing choices, as built:

- **An answer is a catalogue key, never a string.** `entity` is an
  integer: 0 is the "Not listed" bucket, 1..CATALOG_MAX_ENTITY (1,025,
  functions/src/v2.ts) indexes public/pokedex.txt. Three independently
  sufficient reasons rule out free text — entity resolution is never
  finished, the k-floor shreds a long tail of spellings (the pre-D9
  country lesson), and immutable answers (D5) leave no cleanup path.
  The sketch carries the full argument.
- **Rules admit the shape; the trigger validates the key.** A
  thousand-entry `in` list is not a rules construct, so firestore.rules
  checks `entity` is an int in [0, 2048) on a `type == "catalog"`
  question only (create-only, owner-only like every answer), and
  `onV2AnswerCreated` validates against the real ceiling — an unknown
  key never aggregates. scripts/check-pokedex.mjs pins the ceiling to
  the committed catalogue, in ci.yml and backend-checks.yml both.
- **The reveal is a leaderboard with one honest fold** —
  `publishableCanon` (pure.ts): the top 10 entities at/above AGG_MIN_N,
  everything else in a single `rest` bucket. Boundary ties fold whole,
  so equals are never ranked arbitrarily. Exactly one folded entity
  would be recoverable as `total − published`, so the smallest
  published count folds with it — whole tie group at a time.
  Deliberately conservative: a nonzero "Not listed" count inside `rest`
  would often mask the hole, but often is not a floor. v1 also folds
  the "Not listed" count into `rest` rather than publishing it as its
  own number (the sketch allowed a bare count) — nothing about it is
  enumerable until there is a reason to say more.
- **No per-anchor breakdowns for catalog questions.** The arithmetic is
  in docs/CATALOG-QUESTIONS.md: ~1,000 entities × 6 dims × ~4 buckets
  needs ≥ 5 per (entity × bucket) cell, and even 10,000 answers leave
  nearly every cell sub-floor. If demand appears, the viable form is
  breakdowns for the published top-N only.

Live catalog questions are not yet seeded; the feed card is demo-only
behind the demo/live seam. Turning it live is: seed a `type: "catalog"`
question, extend live.ts's vote path with an `entity` variant, and an
e2e leg — each touches the enforced-privacy path, so it ships as one
deliberate change or not at all (the D12 discipline).

**Amended 2026-07-30, same day (D15):** the entity sanity bound in rules
is now [0, 1e9) — QID scale — and validation is per-domain
(`CATALOG_DOMAINS` in v2.ts: a range for pokemon, generated key sets for
films/artists), with the trigger reading the question doc's `domain` to
pick the key space. The [0, 2048) figure above records the
single-domain original.

## D15 · Films/artists catalogues: QID keys, and generation is an operator step

**Decided:** 2026-07-30 · **Status:** binding

The second and third `pick` domains (docs/CATALOG-QUESTIONS.md step 4)
are curated top-1,000 lists from Wikidata (CC0), keyed by **QID numeric
part** (2831 = Q2831). QIDs, not ranks or row numbers, because the
catalogues are curated by popularity and popularity reorders: a
rank-derived key would silently repoint every stored favourite on
refresh, which is the exact failure class the pokedex contiguity gate
exists for, in a form no gate could catch.

Sparse keys change the validation shape. A range bound would admit every
integer between two real QIDs, and each junk key an attacker lands mints
a private-doc bucket forever — so QID domains validate by **membership**
in a generated key set (`functions/src/catalogKeys.ts`), the trigger
learns the domain from the question doc (its only question-doc read,
catalog answers only), and the rules' `entity` sanity bound rises to
QID scale (< 1e9; D14 amended). `scripts/check-catalogs.mjs` pins the
key sets to the committed catalogue files exactly — absence included —
in ci.yml and backend-checks.yml both.

**The catalogues themselves are not in this change, deliberately.** The
generator (`scripts/build-catalog.mjs`, sitelink-ranked SPARQL with the
queries recorded in the script) needs network access to Wikidata, and
the sandboxed session that built this machinery verified it has none —
query.wikidata.org, wikipedia.org and musicbrainz.org are all
unreachable, and no verifiable film/artist dataset exists on the
reachable package registries. Hand-writing ~1,000 QIDs from memory
would trade a network limitation for silent key corruption; refused.
Until an operator runs the builder from a networked machine and commits
the result, the key sets are empty and the domains fail safe: rules
accept nothing the trigger will aggregate, the client catalogues load
as absent, and no demo card ships for them.

Go-live for a QID domain is therefore: `node scripts/build-catalog.mjs
films` (or `artists`) anywhere with network, commit the two generated
files, add the demo card, and later seed a `type: "catalog"` question
carrying `domain` — the same one-deliberate-change discipline as D14.

---

## D16 · The Facebook SDK is stripped from the iOS build, not declared

**Decided:** 2026-07-30 · **Status:** binding

**Decision.** `@capacitor-firebase/authentication` links the Facebook iOS
SDK into every iOS build. A `postinstall` hook
(`scripts/strip-facebook-sdk.mjs`) removes it from the plugin's SwiftPM
manifest; `npm run check:ios-facebook` asserts the removal held, wired into
`ci.yml`'s lint job. Apple's privacy labels and Google's Data safety form
are answered with **no Facebook SDK and no advertising SDK of any kind**.

**Why it was there at all.** Nobody added it. The plugin declares it
unconditionally in its own manifest, inside `node_modules`:

```
node_modules/@capacitor-firebase/authentication/Package.swift
  .package(url: ".../facebook/facebook-ios-sdk.git", from: "18.0.0")
  → products FacebookCore, FacebookLogin
  → swiftSettings: .define("RGCFA_INCLUDE_FACEBOOK")
```

**Android was never affected, and the asymmetry is the trap.** The same
plugin gates each provider behind a Gradle flag on Android, and
`rgcfaIncludeFacebook` defaults to `false` — `android/variables.gradle` sets
only `rgcfaIncludeGoogle`, so Facebook has always been absent there. The iOS
SPM manifest has no equivalent switch. So "we don't use Facebook login" was
true of the product, true of the Android binary, and false of the iOS
binary — and the two stores would have taken different correct answers.

**It is invisible to the obvious checks.** Three greps say it is absent and
all three read the wrong artifact: `package-lock.json` (npm does not model
SwiftPM edges), `ios/App/CapApp-SPM/Package.swift` (names the plugin, not
the plugin's dependencies) and `project.pbxproj` (SPM resolves at build
time). Only the plugin's own manifest shows it. This is why the guard reads
that file rather than anything committed.

**Why strip rather than declare.** Declaring is honest and wrong: it would
tell users the app carries an advertising SDK it does not use, permanently,
to describe dead code. Stripping makes the honest answer "no" and removes
the surface. It also drops a large dependency from every iOS archive and
from `-resolvePackageDependencies` on the macOS runner.

**Why it is safe.** Verified in the plugin source, not assumed: every FBSDK
symbol in `FacebookAuthProviderHandler.swift` sits behind
`#if RGCFA_INCLUDE_FACEBOOK` — import, stored `LoginManager`, initialiser
and every method body. The class shell is unguarded, so
`FirebaseAuthentication.swift`'s reference to it still compiles. Without the
define, `signInWithFacebook` rejects with the plugin's own "provider not
enabled" error, which is correct for a provider we do not offer.
`capacitor.config.ts` declares `providers: ["google.com"]`, and nothing in
`src/` calls the Facebook methods.

### The split between stripper and check, which is load-bearing

**The stripper can never fail the install.** A root `npm ci` runs on the
**production deploy path**: `backend-checks.yml` (rules-tests and e2e) is
called by both `ci.yml` and `firebase-deploy.yml`. A postinstall that exits
non-zero would put an iOS-only, client-only concern in front of an emergency
rules fix — exactly what `docs/DEPLOYMENT.md` says to keep off that path. So
it warns and exits 0, always.

The assertion therefore lives in a separate check on `ci.yml`'s lint job,
which is off the deploy path. It catches what the stripper cannot report:
a plugin upgrade that changes the manifest layout so the patterns match
nothing, a tree where postinstall did not run (`--ignore-scripts`, a
restored `node_modules` cache), or a hand-reinstalled plugin.

**A bug worth recording, because it is the failure mode of the pattern.**
The check imports `MANIFEST` from the stripper so the two cannot drift.
When the stripper's logic sat at top level, that import *ran* it — and hit
its `process.exit(0)` before the check's own assertion. The check passed
vacuously: green, and asserting nothing. Found by running it rather than
reading it. The stripper now guards execution on `process.argv[1]`, and
`check-deploy-targets.mjs` already carries the same lesson in its "found NO
exported functions, which cannot be right" branch.

### What this does not cover, and how it would break

Patching `node_modules` is not a supported extension point. An upgrade that
restructures the manifest silently produces a warning at install and a red
`check:ios-facebook` on the next PR — not a broken build, and not a shipped
SDK, but it does need a human to update `FACEBOOK_PATTERNS`.

The upstream fix is the plugin gaining an SPM-side opt-out to match its
Gradle flags. Delete all of this the day that lands.

**Not yet verified on device.** The macOS CI job (`ios-build.yml`) compiles
the simulator build with the SDK removed, which is the real test of the
`#if` analysis above. Google sign-in itself still cannot be exercised
anywhere in CI — it needs the untracked `GoogleService-Info.plist` and a
real device (see `docs/SHIP-CHECKLIST.md` §4).

## D17 · Catalog breakdowns: each segment orders the board, never a board of its own

**Decided:** 2026-07-30 · **Status:** binding

Demand for per-segment views of catalog questions arrived (product owner,
same day D14 deferred them), so the form D14 named as viable is now
built: **breakdowns for the published top-N only** — how the 18–24
cohort or the Norway cohort orders the global board. 10 entities ×
6 dims is the same cell count a vote question already handles; the full
per-segment re-rank over ~1,000 entities stays impossible under the
floor, and that is arithmetic, not policy.

As built:

- **Write side** — `foldCanonAnchors` (pure.ts): the vote fold
  transposed, cells keyed by entity, with its own per-cell entity cap
  (`CANON_BY_MAX_ENTITIES = 32`). Options are rules-bounded at 20;
  entities are not, so without the cap one (dim, bucket) cell could hold
  the whole catalogue and the document-growth bound collapses. Cap
  semantics match the bucket cap: first come, known entities keep
  counting, the long tail degrades — and a capped-out entity matters
  only if it reaches the global top 10, far below 32.
- **Publish side** — `canonBreakdownFor` restricts every cell to the
  canon's own entities, then the untouched `publishableBreakdown`
  applies: bucket-cohort floor, complementary suppression, ≥2-bucket
  minimum comparison. D8's k-argument carries over exactly — a
  per-entity count of 1 inside a ≥5 cohort says "one of these five",
  never which one.
- **Two recorded conservatisms:** the floor applies to the SHOWN total
  (on-board answers in the bucket), so a bucket can only ever be
  suppressed more than strictly necessary; and a segment's local
  favourite that never made the global board simply does not appear —
  that is the D14 arithmetic doing its job, not a gap.
- **Cross-bucket subtraction** (a reader knows each entity's global
  count): suppressed buckets come in zeros-or-twos per dimension via
  complementary suppression, and anchor-less answers add slack, so no
  single suppressed cell is recoverable from the published row.

Client: the demo reveal gains segment chips that reorder the same board
(`PICKS.segs`/`canonSeg`, per-question demo slices in pick-data.js).
Live rendering of `by` on catalog cards ships with live catalog
questions (D14's one-deliberate-change).

---

## D18 · The breakdown floor bounds cohort size, not the split inside a cohort

**Decided:** 2026-07-30 · **Status:** binding

**Decision.** `AGG_MIN_N` is tested against a **bucket's total**, and that is
the whole of what it guarantees. The per-option counts inside a surviving
bucket are published as they stand, including a count of 1. No per-option
floor is added.

**Why this is a record and not a fix.** D8 described the mechanism as "the
floor is per cell", using *cell* for two different things — the bucket
("Oslo, NO") and the per-option numbers inside it (`{ "0": 4, "1": 1 }`).
The code did the same: `cellTotal()` summed a bucket. Reading either one
naturally suggests a guarantee that was never implemented, namely that no
published number can be one person's answer. It can:

| published | says |
| --- | --- |
| `"Oslo, NO": { "0": 4, "1": 1 }` | exactly one of five Oslo answers chose option 1 |
| `counts: { "0": 4, "1": 1 }`, `total: 5` | the same thing, globally, at the same floor |

That is k-anonymity working as specified rather than failing. The floor
protects **identification** — no cohort is small enough to name someone —
and does not protect **attribute counts** within a cohort that clears it.
Turning the "1" into a person still requires knowing the other four, the
same collusion bound D7 already records for the publish cadence.

**Why a per-option floor was rejected.** It is not a local change, and it
costs the product's one job:

- The second row above is the plain `counts` document, which has the
  identical property. A per-option floor on breakdowns but not on `counts`
  fixes nothing; applying it to both means a question shows no split at all
  until every option it offers has cleared the floor.
- A 4-option question would need ~20 answers **per city** before its city
  breakdown rendered anything.
- Suppressed options do not sum to the bucket total, so the published split
  would visibly not add up — an honest count that reads as a broken one, in
  an app whose claim is that its counts are honest.

**What was done instead.** The terminology now distinguishes the two —
`bucketTotal()`, and "bucket" throughout `pure.ts`, `pure.test.ts` and D8 —
and the residual is stated where the mechanism is defined rather than left
to be inferred. `publishes a lopsided split inside a bucket at the floor`
(`functions/src/pure.test.ts`) pins the behaviour with both directions
asserted: a 4+1 bucket clears the floor, a 4 bucket does not.

Checked rather than assumed: replacing `bucketTotal` with a per-option
minimum fails that test and one other, and both pass again on revert. So
a future change of the floor's unit cannot land quietly.

**Revisit when** a question's options routinely carry real-world
sensitivity — political affiliation is the obvious one, and D8 already
keeps it out of `BREAKDOWN_DIMS` for a stronger reason (Article 9 consent).
At that point the tool is l-diversity on the option distribution, not a
larger k, and it needs its own record.

---

## D19 · The reveal scan asks an indexed question; the ops hook still reads everything

**Decided:** 2026-07-30 · **Status:** binding

**Decision.** `v2_groups` gains `pendingDays: string[]` — the day keys a group
has at least one duel answer for and no reveal yet. `onV2AnswerCreated` adds
to it, the reveal scan removes a day once it settles it, and
`scheduledDuelReveals` finds its work with
`where("pendingDays", "array-contains", day)` instead of reading every group
document. `revealDuelsNowV2` keeps the full scan and is the recovery path.

The `lastCheckedDay` skip-marker is deleted; the absence of a day from
`pendingDays` is the same statement, expressed as a query.

### The arithmetic

The scan runs every 120 minutes, so 12 times a day, and read every group each
time regardless of activity:

| groups | daily activity | reads/day, before | after |
| --- | --- | --- | --- |
| 200 | 10% | 2,400 | 240 |
| 2,000 | 10% | 24,000 | 2,400 |
| 2,000 | 1% | 24,000 | 240 |

The cost of the old scan grew with **registrations**; the new one grows with
**play**. That is the difference that matters — a group created once and
abandoned is now free forever instead of costing 12 reads a day in
perpetuity.

The marker itself is not a new write. The trigger already touched the group
document on every duel answer to run the `lastCheckedDay` compensator, and
that was a read plus a conditional write. It is now one blind
`arrayUnion` — strictly cheaper.

### Why this is also a correctness simplification

`lastCheckedDay` needed a compensating delete from the answer trigger, and
its correctness rested on an ordering argument spelled out over eleven lines
of comment: a late answer either committed before the scan's re-read, or
Firestore's serializability forced it after the marker, in which case the
compensator's later read was *guaranteed* to observe the marker value and
delete it.

`arrayUnion` needs none of that. A late answer re-adds its day
unconditionally, so the day ends up open if and only if an answer exists the
scan did not see — in either commit order, with no argument required. The
repo's most intricate race is gone rather than relocated.

### Why the ops hook keeps the full scan

The indexed query inherits `onV2AnswerCreated`'s at-least-once delivery. In
the steady state that costs nothing: the scan runs every 2h, and a marker
landing late is picked up by the next run, comfortably inside the ≤2h reveal
delay the schedule already promises. A marker that never lands means the
trigger failed permanently, which also means the answer never folded into any
aggregate — a louder problem, already logged.

But it does mean "the query returned nothing" and "nothing played" have
stopped being the same statement. An operator reaching for `revealDuelsNowV2`
is already responding to something being wrong, and that is the worst moment
to hand them a scan that trusts the marker they may be there to repair. So it
defaults to `scan: "full"` and accepts `scan: "indexed"` to exercise the
scheduled path.

That default is also what keeps the e2e honest: it writes duel answers and
calls the hook immediately, so an indexed-only hook would fail on Eventarc
timing rather than on behaviour. The indexed path has its own e2e leg (§8b)
with a bounded wait for the marker, plus an assertion that a settled day
leaves `pendingDays` and that a second indexed run then scans **zero**
groups.

### Bounds and assumptions, recorded rather than discovered

- **The array cannot grow without bound.** A duo whose partner never plays
  would otherwise accrue one day key per day played, forever. Both settle
  paths prune to `PENDING_DAYS_KEEP` (6) days, which is the rules' 4-day
  backfill window plus headroom — a day older than that can never gain
  another answer, so it can never settle and must not linger. Pruning is
  pinned by unit tests, including a 365-entry input.
- **Day keys compare lexicographically.** The cutoff is a string `<`, correct
  only because keys are ISO `YYYY-MM-DD`. Asserted directly in the tests, as
  the assumption that breaks first if the format ever moves.
- **No composite index is declared.** Firestore's automatic single-field
  index for an array field is stored as (value, `__name__`), which should
  already serve `array-contains` + `orderBy(__name__)`. This is an assumption
  about Firestore that the emulator cannot verify — it creates whatever a
  query asks for. If it is wrong, the scheduled run throws
  FAILED_PRECONDITION with a console link, and the full-scan hook keeps
  reveals flowing until the index exists. Loud and recoverable, which is why
  it ships unverified rather than with a speculative index.
- **No backfill.** Groups predating this carry no `pendingDays`, and
  `array-contains` simply does not match them — which is exactly true, since
  a group with no answers owes no reveal. Per D5's amendment, production has
  zero duel answers anyway: the question bank is unseeded.

### The scan ceiling now means something different

`GROUP_SCAN_CAP` (2,000) used to bound "groups that exist" and would have
fired on registration growth alone. It now bounds "groups that played that
day", so hitting it is a real statement about activity. The remedy named in
the log line changed with it: sharding the scan or moving it to a queue,
since the indexed query it used to recommend is what this record built.

---

## D20 · Function runtime options are per-function; the global stays the heavy default

**Decided:** 2026-07-30 · **Status:** binding

**Decision.** `ops.ts` keeps `setGlobalOptions` at 512 MiB / 480 s /
concurrency 1 as the **default**, and individual functions opt down:

| function | memory | timeout | cpu / concurrency |
| --- | --- | --- | --- |
| `createGroupV2`, `joinGroupV2`, `registerPushToken` | 256 MiB | 60 s | — |
| `leaveGroupV2` | 256 MiB | **480 s** | — |
| `onV2AnswerCreated` | 512 MiB | 120 s | **cpu 1, concurrency 20** |
| `deleteAccount`, `seedContentV2`, `scheduledDuelReveals`, `revealDuelsNowV2` | 512 MiB | 480 s | — |

**Why the global is not simply lowered.** The property worth keeping is that
forgetting to think about a new function is *safe*. A lower global would hand
the next full-collection walker the same 60 s wall that killed the last ones
— which is the failure `check:fn-runtime` exists to prevent. So the global
stays sized for the heaviest thing in the deploy and the cheap functions opt
down explicitly, one export at a time.

**Why now.** The comment justifying 512 MiB said "the full-scan aggregators
read whole collections into memory". **D13 deleted every one of them.** What
was left inheriting an aggregator's footprint is five sub-second callables
and `onV2AnswerCreated`, which runs once per answer and is the most-invoked
function in the system. The sizing outlived its reason and no record noticed.

**The two rules of thumb.** Memory is billed on every invocation, so it is
the number to lower. Timeout costs nothing unless consumed, so anything with
genuinely unbounded work keeps a generous one even when it is otherwise
cheap — which is why `leaveGroupV2` drops to 256 MiB but keeps 480 s: it ends
in a `recursiveDelete` of a group's whole reveal history when the last member
leaves, and a timeout mid-delete leaves a half-erased group.

**Why the hot trigger raises concurrency instead of dropping memory.** At
concurrency 1 every simultaneous answer costs a whole instance, and
`maxInstances: 10` then caps the entire system at 10 answers folding at once
— a throughput ceiling nothing had written down. Sharing one instance across
20 events collapses both that ceiling and the per-answer cost. Concurrency
above 1 requires `cpu >= 1` (a Cloud Run constraint), and cpu 1 pairs with
512 MiB rather than 256, so this is the one function that does **not** drop
its memory. It is still far cheaper per answer, because the instance-seconds
are divided by 20 instead of paid whole.

**What is not proven here.** The emulator ignores memory, timeout, cpu and
concurrency entirely, so CI proves only that the values are *set* —
`check:fn-runtime` reads them off the compiled endpoint metadata and passes.
Whether they are *right* is a post-deploy check:

```
gcloud functions describe <name> --gen2 --region us-central1 \
  --format="value(serviceConfig.availableMemory,serviceConfig.timeoutSeconds)"
```

Revisit `onV2AnswerCreated`'s concurrency if its transaction ever starts
holding memory per event; 20 events sharing 512 MiB is comfortable for three
small documents and would not be for a large fold.

---

## D21 · The live-mode branches get a mount test; accessibility gets a ratchet

**Decided:** 2026-07-30 · **Status:** binding

Two frontend gaps, both of the same shape: a property the tree asserted in
prose while nothing executed it.

### The live branches were untested, including two privacy gates

`test/smoke.test.jsx` mounts the app with `window.LIVE` **undefined**. Every
`if (window.LIVE && window.LIVE.enabled)` branch in ~19.8k lines of spec
layer was therefore unreached by the suite — including the two that are
product decisions rather than cosmetics:

- **D9** — live mode drops the Mirror's City stop, because Near IS your city
  there and two stops onto one cohort is how a scale starts lying.
- **D11** — the feed's argument surfaces (takes, counters, minds-moved,
  crossfire, friend dots) are unreachable from a live card, and the
  `demoInProd` fallback suppresses the whole engage row.

D11 says these were "verified rather than assumed" by forcing a demo question
live in a browser and looking. That was true, once, by hand, on one commit.
`test/smoke-live.test.jsx` makes it true on every run, and each gate was
mutation-checked: opening `q.live`, deleting the `demoInProd` return, and
making the Mirror axis unconditional each fail exactly one case.

**Three things the build of it found**, recorded because each is a way this
kind of test lies:

1. **A key-name pin does not pin a signature.** The fixture's first `vote`
   took a question object; the real one takes `(qid, optionId)`. Both satisfy
   `Object.keys(LIVE)`, so the surface pin passed while the tests recorded
   every vote under `undefined`. The member list is now shared
   (`test/live-surface.ts`) so at least the *names* cannot drift.
2. **`renderEngage` only mounts after the card is answered and the reveal
   animation clears `state.beat`.** The first D11 assertion ran on an unvoted
   card and passed against a deliberately opened gate, because the block it
   was checking for was never going to be there either way. Every gate case
   now has a control asserting the row *does* render on the other branch.
3. **The takes control's label is `${n} takes`, and n is 0 in live mode.** A
   text search for a seeded string finds nothing whether the gate holds or
   not; the assertion has to be the button.

### Accessibility: a ratchet, and what it caught about itself

`eslint-plugin-jsx-a11y` was absent. It now runs as its own gate,
`npm run check:a11y`, against a per-file baseline of **69** that may only go
down.

**Why not in `npm run lint`.** That script carries `--max-warnings 0`, which
is load-bearing (four hook warnings had become background noise once). There
is no warn tier to hold existing debt, so the options were fail-on-day-one or
a blanket disable — and `src/v2/README.md` is explicit that a blanket disable
is the failure mode this repo has already been bitten by. A separate ratchet
is the third option: new code cannot add to the number.

**Why per file rather than a total.** A total lets a fix in one file pay for
a regression in another and still report green.

**Why 67 of the 69 are deferred.** They are all in `spec/`, the ported layer.
Adding key handlers and focus behaviour to components no test asserts the
interaction of is precisely the blind change the React Compiler findings are
already deferred for. They get fixed behind interaction tests, not ahead of
them. The remaining two are `autoFocus` on picker search fields the user has
just tapped open — a deliberate keep, recorded in the baseline rather than
silenced inline, because `--report-unused-disable-directives` would turn a
disable comment naming a rule the main config lacks into a lint error.

**The gate caught itself first, which is the part worth recording.** The
initial config matched `src/**/*.{jsx,tsx}` under espree, so every `.tsx`
failed to parse — and a parse failure reports as a fatal message with a null
`ruleId`, which the "count jsx-a11y/* only" filter discarded. It read as
"the hand-written panels have zero findings" when nothing had looked at them.
Found by injecting a clickable `<div>` into `CityPicker` and watching the
ratchet report green. With the TypeScript parser wired in there were four,
and `check-a11y.mjs` now fails on any fatal message: **a file this gate
cannot read is a file it is lying about.**

Of those four, three were fixed rather than baselined, because they are
hand-written code and not the frozen port: `LiveGroupsMirrorBody`'s
expand/collapse row is now a real `<button>` with `aria-expanded` instead of
a clickable `<div>`, which is the difference between a keyboard user being
able to open a day's detail and not.

## D22 · Moderation substrate: confinement is structural, and advisory until trusted

**Decided:** 2026-07-31 · **Status:** binding

docs/MODERATION.md's load-bearing choices, graduated as built:

- **The verdict channel accepts one shape.** `modVerdictError` (pure.ts,
  tested) admits exactly `{ takeId, verdict, policyLine? }`: every
  removal must cite H1–H5, nothing else may carry a line, extra fields
  are rejected — the smuggling channel an injection would use is closed
  at the type level.
- **The server picks the targets.** `buildModQueue` (scheduled) folds
  flag counts into `v2_mod_queue` via the pure, tested
  `buildModQueueFrom`; `submitModVerdict` rejects any takeId not in the
  queue. "Also moderate X" fails structurally, however persuasive the
  text that asked.
- **Least privilege cuts both ways.** The two callables are gated by
  `MOD_UIDS`, deliberately separate from `SEED_ADMIN_UIDS`: an operator
  is not thereby a moderator, and a leaked moderator credential can
  moderate and do nothing else. Empty allowlist = everyone denied —
  fail-safe.
- **Soft-hide, author-visible.** A removed take stays readable by its
  author (rules-enforced) so appeal happens against visible text; the
  circle stops seeing it. No edit path on takes at all: an edited take
  invalidates the flags cast on what it used to say.
- **MOD_ADVISORY = true** until the dry-run phase earns the flip:
  verdicts record and surface but hide nothing. Flipping it is a
  one-line PR that must cite the advisory track record.
- **Blast radius:** 50 verdicts per run (circuit breaker, not
  invariant), flags anonymous to circle and run alike (write-only
  collection, id-pinned one-per-user), `deleteAccount` erases a user's
  takes and flags by uid query.

Found while wiring: `check-deploy-targets` scanned a hardcoded source
list and missed `moderation.ts` entirely — three functions built,
tested, green, and invisible to the gate whose whole job is catching
that. It now discovers `functions/src/*.ts` instead of naming files.

**Amendment (2026-07-31) — the verdict log is keyed per (take, queue
generation), not per take.** As shipped it was `v2_mod_verdicts/{takeId}`,
and the callable's own error text already claimed otherwise ("already has
a verdict *this queue generation*"), as did the e2e leg asserting it. The
key was the thing that did not agree.

The consequence was not the duplicate-verdict refusal it looked like. The
queue is rebuilt **wholesale** every run, and in advisory mode nothing is
hidden and no flags are cleared — so every still-flagged take returns to
the next day's queue by construction. One verdict per take *forever* meant
the second day's judgement died `already-exists` on the first day's
grounds, and the run's daily re-judgement — the evidence the ladder's flip
is supposed to cite — stopped after one round. `escalate` inverted worst
of all: it is the only verdict that deliberately keeps an entry queued for
a human, so "come back to this" was exactly the decision nobody could come
back to.

The generation is the queue entry's own `queuedAt` (`modVerdictId`,
pure.ts), not a counter: an entry is written once per build, so its
timestamp already names the build. No second collection and no shared
sequence — and no change to the verdict channel's shape, which stays the
`{ takeId, verdict, policyLine? }` this record's first bullet fixes. The
run cannot name a generation; the server reads it off the server-picked
entry, so confinement is untouched. An entry with no usable `queuedAt`
keeps the bare-takeId id, which is fail-safe: a verdict already logged
still blocks a second one.

Residual, stated rather than papered over: verdict documents written under
the old bare-takeId id stay where they are. They are an append-only log,
so they are readable history, but they no longer block — a take verdicted
in the deploy window can be verdicted once more in the same generation.
One-time, advisory-mode, and its worst outcome is a duplicate row in a log
the maintainer reads by hand.

Still open, recorded in MODERATION.md: the drafted thresholds (3 flags /
25 queued / 50 cap), escalation latency, the maintainer's pass on the
hard-line wording — and the two later phases, the client report control
(needs a live takes surface first) and the low-privilege Routine.
