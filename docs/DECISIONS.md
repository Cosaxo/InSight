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

What remains for links is the platform wiring: the entitlement and AASA
file on iOS, the intent-filter and `assetlinks.json` on Android, and a
route that turns a URL into a `joinGroupV2` call. A `.web.app` invite is
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

**The floor is per cell, and it survives subtraction.** Suppressing cells
below `AGG_MIN_N` is not sufficient alone: if a dimension has exactly one
suppressed cell and a reader knows the dimension's total, that cell is
recoverable by subtracting the published ones, and the floor is decorative.
`publishableBreakdown` therefore applies **complementary suppression** — if
suppressing sub-floor cells would leave exactly one hole, the smallest
surviving cell goes too, so there are always either zero holes or at least
two. A dimension left with fewer than two publishable buckets is omitted
entirely, because one bucket is a population statement rather than a split.

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
| Groups | `LIVE.social.groups()` exists | **still sample** — see below |
| Near | city breakdown, floor 5 | real |
| World | country breakdown + overall totals | real |

`GroupsMirrorBody` is the one left. It reads `window.DUELS` (duels-data.js),
which is entirely local: group definitions live in `localStorage` and its
members are the 49 seeded people in `relmap-core.js`. The live group path
(`LIVE.social.groups()`, `revealFor`) exists and is used by the daily's
group card, but the Mirror's group portrait — alignment %, togetherness,
contrarian/twin, the per-member field — is computed from `DUELS`'s local
history and has no live equivalent. Rewiring it is a real piece of work,
not a routing change, because the *statistics* need a server-side source
that reveals alone do not provide.

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
