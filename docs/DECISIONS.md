# Decision records

Direction-setting decisions for InSight v2 (the daily/mirror app). Each is
binding for v1 of the shipped product unless explicitly overturned — record
the reversal here when that happens.

One exception to that default: a record whose Status line says **Proposed**
is a draft awaiting the owner's adoption. It binds nothing until the owner
flips the status — adoption is an explicit act, not a side effect of the
text existing in this file.

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

**Amendment (2026-08-03) — reconsidered against the fake-user worry, and
two facts measured.** The owner asked whether anonymous sign-in is at
odds with the fake-account defense, pre-launch being the last cheap
moment to change course. The analysis, recorded so the question stays
answered: identity requirements are a *weaker* defense than what is
built — emails and Google accounts are farmable in minutes, while D29
binds counted answers to device attestation (one physical device, a
bounded number of accounts) and D36 binds callables to the real app
binary. Requiring accounts would also create the PII surface the product
defines itself against (D1/D8 posture, the store listing's "no account
required", the erasure story) while buying nothing attestation does not
already buy better. D3 stands; the escalation path if attestation ever
proves insufficient is tightening device-bind (D37's levers), not
identity. Measured the same day: the **Anonymous provider was never
enabled in prvfire33** (`accounts:signUp` → `ADMIN_ONLY_OPERATION` with
the valid public key) — every doc that said "keep Anonymous enabled"
assumed a state that did not exist. Runbook step 1.3 and SHIP-CHECKLIST
§2 corrected from "confirm" to "enable"; the scorecard fetch (D33 Phase
A) waits on the same toggle.

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
>
> **Narrowed again by [D92](#d92--a-standing-location-grant-fills-the-city-in--suggested-never-applied-narrows-to-the-no-grant-state)
> (2026-08-11).** "A located city is suggested, never applied" now holds
> only while the Right-now counter (D84) is off. With the counter on — an
> explicit, revocable location grant — Near resolves and applies the city
> itself, still saving only the name.


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

**Amendment (2026-07-31) — escalations carry across the rebuild.** Found
immediately downstream of the above, and the same shape: the wholesale
rebuild was eating a signal aimed at a human. MODERATION.md calls
`escalate` the safety valve and promises escalations reach a human in both
phases, but `submitModVerdict` marked the queue entry and the next build
deleted every entry — so the mark lived until 05:00 and the verdict log
that kept the row is read by nothing yet (the digest is unbuilt). The valve
had no outlet.

In the phase the system is actually in it was not even a 24-hour window.
`MOD_ADVISORY` returns before the `escalated` branch is reached, recording
the verdict under `advisoryVerdict` — so the `escalated` flag
`fetchModQueue` hands the run was permanently false. Both spellings are now
read wherever the signal is.

Each entry carries an `escalations` COUNT forward from the entry it
replaces (`carriedEscalations`, pure.ts), read off the same fetch the
rebuild already does to delete them, so it costs no extra query. A count
rather than a flag because "escalated three builds running" is the signal
the digest wants. The generation still advances, deliberately: an escalated
take stays re-judgeable, and a second escalation is information.

Known limit: the chain is entry-to-entry, so a take pushed out of the
top-`MOD_QUEUE_SIZE` and later re-queued returns at zero. The verdict log
holds the real history whenever the digest is built; the count is the run's
cheap in-queue hint, not the record.

**Amendment (2026-07-31) — `deleteAccount` sweeps the queue's copy of a
take.** The third one found in this subsystem, and the only one on the
erasure path. `v2_mod_queue` holds a COPY of a flagged take's text —
`buildModQueue` copies it so the run reads one collection and never the
circle around it, which is a real privacy win — and `deleteAccount` erased
`v2_takes` and `v2_flags` by uid while touching neither the queue nor its
copy. A deleted account's words survived until the next 05:00 rebuild
happened to drop them. Self-healing, up to ~24h, and the wrong direction
for a right-to-erasure path to fail in.

The sweep keys on the take being **absent** rather than on an author,
because the queue carries no author uid and deliberately should not: a uid
in the run's one readable collection hands it a person to judge instead of
a text. Absence is already the queue's own test for settled
(`buildModQueue` skips a take that no longer exists), so the sweep also
collects entries orphaned by an ordinary author-deletes-their-take, which
nothing collected before. Bounded by `MOD_QUEUE_SIZE`: one query, at most
25 existence checks, one batch.

Found in the same pass: the takes/flags wipe built ONE unbounded batch per
collection against Firestore's 500-write cap, so an account with enough of
either failed the phase — and a failed phase refuses the auth delete, which
turns "talkative" into an account that can never finish deleting itself. It
now uses `deleteQueryDocs`, the paginating helper already in the file.

The verdict log is deliberately NOT swept: a row names a take id, a verdict,
a policy line, a run and the MODERATOR, and once the take, flags and profile
are gone that id resolves to nothing. What remains is a record of a
moderator's decision, and it is the audit trail the advisory phase's
judgement is assessed from. Recorded on the store-facing list
(docs/data-inventory.md) as one of the things deletion deliberately leaves
behind, rather than left for someone to discover.

Still open, recorded in MODERATION.md: the drafted thresholds (3 flags /
25 queued / 50 cap), escalation latency, the maintainer's pass on the
hard-line wording — and the two later phases, the client report control
(needs a live takes surface first) and the low-privilege Routine.

---

## D23 · The mouse-only spec-layer controls become buttons, ahead of the interaction tests D21 wanted

**Decided:** 2026-07-31 · **Status:** binding

`check:a11y`'s baseline drops **69 → 47**. Eleven `div`+`onClick` sites in the
ported layer are now real `<button>`: the Mirror map's graph nodes
(`map-tab.jsx` ×4, `person-mindmap.jsx` ×3), the group-mirror comparison rows
and person chips, the test-picker cards, and the relmap preview tile. Five
files go to zero. `.btn-bare` and the reset on `.mmt-node` are what let a
button lay out like the div it replaced; `.mmt-astat-row` was the precedent.

**This is in tension with D21, which is why it is recorded rather than just
done.** D21 deferred exactly this work with: *"Adding key handlers and focus
behaviour to components no test asserts the interaction of is precisely the
blind change the React Compiler findings are already deferred for. They get
fixed behind interaction tests, not ahead of them."* No interaction test was
written first. What makes this subset defensible is that it is a narrower
class of change than the one D21 was guarding against:

- **No behaviour was hand-rolled.** Not one key handler, focus call or
  `tabIndex` heuristic was added to make a div act like a button. The element
  became a button, and Enter/Space, focus, the role and the disabled
  semantics come from the platform. Every `onClick` body is byte-identical.
- **The residual risk is therefore visual, not behavioural** — a UA style
  leaking into a layout the transform math depends on.

**So the risk that remained was measured rather than argued.** Chromium at
420×880, mock mode, before and after, same seed:

- **Mirror → You (map-tab, 4 sites).** 86 `.mmt-node` both times;
  `button.mmt-node` **0 → 86**; no page errors. Per-pixel diff: **258 of
  1,478,400 pixels differ (0.0175%), max channel delta 12/255**, all in one
  text-antialiasing cluster. A layout shift would be thousands of pixels at
  delta ~255.
- **Test picker (test-overlay, 1 site).** 4 cards, `button.test-pick-card`
  **0 → 4**, **0 of 1,478,400 pixels differ**. Computed style confirms the
  card keeps its surface, 1px border, 18px radius, shadow and inherited font.
- **The remaining 6 sites do not render in mock mode** from any route
  reachable here — `person-mindmap` needs an open person, the group-mirror
  rows and chips need a populated group, the relmap tile needs a circle.
  Their evidence is indirect but specific: `person-mindmap`'s 3 sites carry
  the *same* `.mmt-node mmt-center/mmt-hub/mmt-dotnode` classes proven above,
  so they are the same CSS path; and for the 3 `.btn-bare` sites, a real-
  browser A/B against the app's own stylesheet — div vs `button.btn-bare`,
  in both the flex-row and absolutely-positioned shapes the call sites use —
  returns **identical** width, height, font, size, text-align, background,
  border and padding.

**A bug this caught, worth keeping as the reason the reset is not one class.**
`test-pick-card` first got `.btn-bare` alongside `.card`. Both are single-
class selectors, and `.btn-bare` sits ~300 lines later, so it won the cascade
and took `.card`'s background, border and padding with it — a card with a
box-shadow and no surface. `button.card` is therefore reset next to `.card`
itself, where the ordering is local and visible, and `.btn-bare` deliberately
sets no `width` (a forced 100% breaks the absolutely-positioned chip that
centres itself with `left:%` + `translate(-50%)`).

**What is NOT covered, stated plainly.** There is still no automated render
test for these eleven sites, and adding one to `test/` would be theatre:
measured while trying, `mirror-tab.jsx` mounts `<MapTab />` only for the
retracted "You" population, and even there jsdom renders `.mmt-root` and
`.mmt-canvas` with **zero** nodes — positions come from a layout pass jsdom
does not perform, so every node early-returns. All 186 pre-existing tests
stayed green with these nodes never rendered once. Faking that layout is the
one thing `test/setup-dom.ts` rules out by name: *"A stub that fakes a RESULT
the test then asserts on would be testing the stub."* A test asserting over
an empty set is worse than none — the same argument `check-bundle.mjs` makes
about a budget that passes on zero files. The enforced guard is `check:a11y`
at 47, which reads source and would fail the day a button goes back to a div.
The render-level gate arrives with the browser-based interaction layer D21
already queued; that is the correct home for it.

**The 22 findings left under the click rules are a different bug and will not
yield to the same move.**

- **24 findings across 12 sites are the modal scrim/sheet pair** —
  `.wf-scrim` closes on click, `.wf-sheet` swallows the click so it does not
  (`type-marks`, `passive-meter`, `world-feed`, `duo-daily`, `group-daily`
  ×2). Neither is a button: one is a backdrop, the other is a container, and
  a `<button>` wrapping a whole sheet would nest interactive content inside a
  control and read to a screen reader as one enormous target. These want
  `role="dialog"` + `aria-modal` + Escape + a focus trap. Worth knowing that
  the keyboard path is not actually missing today — every one of these sheets
  already ships a real `<button aria-label="Close">`; it is the *semantics*
  that are absent, and exactly one `aria-modal` exists in the whole spec
  layer (`app-shell.jsx`, the update gate).
- **4 are `onClick={(e) => e.stopPropagation()}`** on the relmap panels: pure
  event plumbing with no interaction to expose.

Both are tracked, neither is a blocker, and the count only moves down.

---

## D24 · Every overlay and sheet is a real modal dialog, and this time the interaction test came with it

**Decided:** 2026-07-31 · **Status:** binding

`check:a11y` drops **47 → 23**. Two helpers in `primitives.jsx` carry it:

- **`useDialog(onClose, label)`** returns the props a dialog container needs
  — `role="dialog"`, `aria-modal`, `aria-label`, `tabIndex={-1}`, a ref, and
  a key handler giving Escape-to-close and a Tab focus trap — plus focus-in
  on mount and focus-restore-to-opener on unmount. Applied to all eight
  full-screen overlays (profile, search, person, city, test, suggest, logic,
  relmap), one line each.
- **`Sheet`** wraps the seven `wf-scrim`/`wf-sheet` bottom sheets into one
  component with the same semantics attached.

Before this, the whole spec layer contained exactly one `aria-modal`:
app-shell's update gate.

**The findings went structurally, not by silencing.** The scrim is
`role="presentation"` — a backdrop that dismisses on click is not a control,
and every one of these sheets already shipped a real
`<button aria-label="Close">`, so the accessible path existed and only the
semantics were missing. And the sheet's `onClick={(e) => e.stopPropagation()}`
is **gone**: it existed solely to stop the scrim's handler, so the scrim now
tests `e.target === e.currentTarget` instead. One check removed both halves
of the pair, which is why 24 findings closed rather than 12.

**D23 owed an interaction test; this pays it.** `test/dialog.test.jsx` is
seven cases over the two overlays reachable from the header — the same two
`smoke.test.jsx` drives, and the reason it stops there is the same. Unlike
the map surfaces in D23, these *do* render in jsdom, so the test is real
rather than an assertion over an empty set. It pins the three things
`check:a11y` structurally cannot see, because they are runtime behaviour and
not source text: that focus actually moves into the dialog, that Escape
reaches the handler, and that focus returns to the opener.

**Escape had to be made to nest, or it would close two things at once.**
Four controls own Escape for their own state — the city and pick dropdowns
(`ui/CityPicker.tsx`, `ui/PickSearch.tsx`) and relmap's rename field. Each
now stops propagation *only when it actually consumes the key*: the pickers
guard on `open`, so with the list already shut Escape belongs to the
overlay, exactly as a user would expect one press to do one thing.

**One jsdom gap, stated because the test comment depends on it.**
`fireEvent.click` does not move focus; a real browser's click on a button
does. So the focus-restore case focuses the opener explicitly, or it would
be asserting jsdom's gap rather than the restore path. Confirmed in Chromium
that this is a jsdom artifact and not a real one: clicking the header
Profile button focuses it, and Escape hands focus back to it.

**Measured, not assumed.** Chromium at 420×880, mock mode: overlay opens
with `aria-label="Your profile"` and focus inside; Escape closes it and
focus returns to the header button; the sheet opens with
`aria-label="Your four profiles"` and `role="presentation"` on its scrim;
Escape closes it and focus returns to its opener; **backdrop click still
dismisses**; no page errors. The `Sheet` refactor moved the grab handle into
the component and changed the scrim's handler, so it was pixel-checked too:
identical bounding box and **0 of 1,478,400 pixels differ**.

**Amendment, same day — 23 → 19: the relmap panels' handlers were dead
code.** The 4 remaining `relmap-panels` findings looked like the same
`stopPropagation` shape the sheets had just shed, and the note here first
said they could not be fixed the same way because those panels have no scrim
to move a target check onto. That was true and beside the point: the correct
fix was to **delete** the handlers, because they were guarding against
something that does not exist.

The map's deselect lives on the `<svg>`'s `onPointerDown`/`onPointerUp`. The
panels are absolutely-positioned **siblings** of that svg, so a pointerdown
on a panel never reaches it — `this.drag` stays null and `onPointerUp`
returns on its first line. And a click handler could not have stopped a
pointer handler regardless: they are different event types, and pointer
events fire first. Nothing in the tree listens for `click` above these
panels; there are no document- or window-level click listeners either.

Verified in Chromium before removing them, on **both** panels — the person
panel and the hub panel (reached by asking `RMCore.buildGraph` which node
ids are hubs, then tapping one twice: the first tap focuses its group, the
second selects it). Open the panel, click inside its body, panel stays open.
Identical with the handler and without it. No pixel check for this one, and
deliberately: removing an event handler changes no style and cannot move
layout.

**What is left at 19.** The 8 `profile-general` findings are
`label-has-associated-control` — real, unrelated, and a form-markup fix. The
remaining 3 click/interaction findings are single sites in
`consequence-beat` and `tweaks-panel`. The rest are the `autoFocus` keeps
recorded in D21. The count only moves down.

---

## D25 · The world feed loads after first paint; the rest of the split waits

**Decided:** 2026-07-31 · **Status:** binding

**Decision.** `spec-index.js` defers `world-feed-comments.js`,
`world-feed-counters.js`, `consequence-beat.jsx` and `world-feed.jsx` to a
memoised `loadWorldFeed()`, called by `main.jsx` once the root has
rendered. Entry chunk 947 → 850 KB (282 → 255 KB gzipped). The Mirror tab
(~168 KB) and the overlays (~176 KB) stay eager, per the SHIP-CHECKLIST
deferral.

**Why the feed and not the biggest thing.** It is the biggest thing, but
that is not the reason. `daily-split.jsx` line 501 already reads
`window.WorldFeed &&` before rendering the feed node, so an unloaded feed
renders as *no feed* — which is the frame a user who has not answered
today's question already sees. No guard was added; the guard was the
existing contract. A split that needs a new guard is a split whose
failure mode is new.

Started after first paint rather than on the frame that wants it: the feed
opens seconds later when today's card is answered, so this is a defer past
first paint, not a defer until needed. `main.jsx` re-renders the root when
it resolves, because a user who answers before the chunk lands would
otherwise sit on a feedless card with nothing scheduled to re-read the
global.

**Two neighbours stay eager, and the reason is the load-order rule this
repo keeps re-learning.** `world-feed-data.js` is read at MODULE scope by
`daily-split.jsx` line 19 (`window.WORLD_TOPICS`), so deferring it swaps
the real topic set for that line's five-entry fallback — a wrong chip row,
silently, with nothing thrown. `feed-read.js` is the feed's memory rather
than the feed, and the Mirror reads its stats on screens the feed never
opens on.

**What this corrects about the gates.** `check-bundle.mjs` asserted that
the spec layer loads in one piece because "check-spec-globals requires
every module stay imported". It does not: rule 2 substring-matches the
`'./spec/…'` strings in `spec-index.js`, and a dynamic import satisfies it
exactly as a static one does. Verified by probe before relying on it.

That cuts both ways, and it is the residual worth recording. Rule 1 is
name-level and rule 2 matches text, so **neither can see load order** — a
`loadWorldFeed()` that dropped a module or stopped resolving would leave
both green and the feed would simply never appear. The mount tests carry
it: `smoke.test.jsx` pins both shapes, the daily tab with `window.WorldFeed`
deleted and the feed present after the load resolves, because either alone
passes while the other half is broken. Any future group split by this
mechanism needs the same pair, and that requirement — not the byte count —
is what should pace the rest of the split.

**What is being bought.** Parse and eval on a cold start, not network: the
bundle ships inside the native package (`firebase.json` hosting serves
only the marketing pages). `MAX_CHUNK_KB` came down 1024 → 900 to hold the
win; the TOTAL is deliberately unchanged, because splitting relocates bytes
rather than removing them.

---

## D26 · The spec layer's dead render code is deleted; the one toolkit is kept

**Decided:** 2026-07-31 · **Status:** binding

The port carried forward render code from prototype generations the v15
reference no longer has. None of it was reachable: **974 lines removed,
13.7 KB off the built bundle** (entry chunk 852 → 839 KB, on top of the
split D25 had just done), no behavioural change and no gate moved.

Each removal had to clear the same bar — no JSX tag, no `window.X` lookup,
no call site anywhere in `src/`, and no counterpart in
`design/InSight_standalone_15.html`. That last check is what separates
"nothing renders it today" from "it belongs to the frozen spec and the app
simply has not wired it yet".

| Removed | Why it was unreachable |
| --- | --- |
| `spec/feeds.jsx` (whole file) | An around/city/world report feed whose `ReportCard` never made it into this repo. Its own header describes a component the file does not contain; v15 has no `LikeButton`, no `AROUND_REPORTS`, no feed at all. Dead since the Phase-1 port. |
| `person-overlay`: `AffinityDial`, `DualCompass`, `TraitBridges`, `InterestVenn`, `GeneticKinship`, `FollowerShares`, `alignmentNotes`, `pRng` | A previous generation of the affinity portrait. `PersonOverlay` now renders `CompareCarousel` + `PersonMindMap`; the surviving `AffinityBreakdown` still carries the comment that says it "replaces the donut" — the donut being `AffinityDial`. |
| `profile-general`: `InterestsTastesCard`, `InterestsCard`, `TastesCard`, `HeroesCard` + `Chips`, `chipStyle`, `tasteLabel`, `TextInput`, `HERO_HUES`, `initials` | `GeneralPanel` renders `BasicsCard`, `MapThumbCard`, `TestArcsCard`, `LensesRowCard`, `LogicCard` — and has not rendered the other four since the panel was restructured. |
| `profile-overlay`: `PoliticsCompass`; `viz-primitives`: `Compass2D` | The compass was superseded by `ResultProfileCard` / `TestRose`. `Compass2D` had no other consumer, so it fell with it. `RadarChart` and `Donut` stay — `city-overlay` uses both. |
| `primitives`: `Bar`, `Pill`, `InterestRun` (+ the `.bar` / `.pill.is-on` CSS) | `InterestRun` was `InterestVenn`'s alone. The `.pill` base rules stay — `mirror-answers` uses the class directly — but the `.is-on` / `.sienna` / `.sage` variants were reachable only through the deleted component. |
| `iOS`: `IOSList`, `IOSListRow` | The one call site (`app-shell`) mounts `IOSDevice`, which has no path to either. `IOSNavBar` / `IOSGlassPill` / `IOSKeyboard` **stay**: `IOSDevice` renders those behind its `title` and `keyboard` props, so they are one prop away, not unreachable. |
| `type-marks`: the `IS_TYPE_ART` alias | A second publish of `TM_ART`, which is already exported under its own name. Zero readers. |

### The one that was hiding behind a guard

`MirrorFieldBody` guarded a `GroupLevelBreakdown` lens on
`pop === 'groups' && gSel && window.GroupLevelBreakdown`. Nothing in the
tree has ever defined that name — so the guard could not pass, and the lens
was as dead as anything above. It survived longer than the rest because
`window.X &&` reads as a feature flag rather than a dangling reference:
`check:globals` did see it, but the name was parked in
`scripts/spec-globals.mjs`'s `RUNTIME_ALLOWLIST` as "known-dead", where its
own comment asked for exactly this deletion.

That allowlist is the lesson, not the lens. **Anything parked there is a
name the checker has agreed to stop checking** — the same silence that let
two `ReferenceError`s ship when `no-undef` was off. The entry is gone and
the comment in its place says to fix the code rather than add another.
`levelTrait` / `levelMarker` went with the branch: they fed nothing else,
and two call sites were still passing them.

### What was deliberately kept

**`tweaks-panel.jsx`'s `TweakSlider` / `TweakText` / `TweakNumber` /
`TweakColor` are unused and stay.** They meet the "no call site" bar and
fail the one that matters: the panel is not product code but a reusable
design-time shell implementing a host protocol (`__activate_edit_mode` /
`__edit_mode_available` over `postMessage`), and its widget set is the
documented API — spelled out in the file's own usage example. Deleting half
the vocabulary of a toolkit because this app happens to use the other half
is a different decision from deleting code nothing can reach, and it is not
one this cleanup should make. `__twkIsLight` and `__TwkCheck` stay with
`TweakColor` for the same reason.

**`profile-general`'s store keeps `interests` / `likes` / `dislikes` /
`heroes`** although nothing renders them now. `GeneralPanel` persists the
*whole* `data` object to `localStorage` on every edit, so dropping the keys
from the seed/load path would make the next basics edit silently overwrite
whatever a user saved under an older build. Inert round-tripping is the
cheaper error. The reasoning sits in the file header, where the next reader
will be standing when they wonder about it.

### The scan, and why the obvious version of it lies

The first pass matched `<Name` and missed everything rendered as
`<window.Name …>` — which is most of this layer — and reported 44 dead
components, at least 30 of them live. The second missed the multi-line
`Object.assign(window, {…})` publish blocks and read them as use sites. The
scan that produced this table blanks publish blocks and the
`;globalThis.X = typeof X === 'undefined' ? …` tails first, then counts JSX
tags, `window.X` lookups, calls and destructures. It was re-run after every
removal, which is how `Compass2D` and `InterestRun` were caught — both were
alive until the thing that used them was deleted in the same pass.

Confirmed by the gates, not by reading: `check:globals` (341 → 311 globals
defined, zero dangling), `lint` at `--max-warnings 0` with `no-undef` on for
the spec layer, `tsc -b`, `check:a11y` unmoved at 19, `check:bundle`,
`test:unit` at 201/201 and `functions` at 62/62.

**And by a mount D25 had just added.** This work was branched before the
overlay tests landed, so for most of it the person and city overlays were
still in the block "nothing executed" — the exact condition under which
deleting from `person-overlay.jsx` is a guess. The rebase closed that:
`smoke.test.jsx`'s "opens a person's profile" and "opens a city's profile"
now render both, and both pass. `PersonOverlay` reaches `AffinityBreakdown`,
`CompareCarousel`, `PersonMindMap`, `Av`/`AnonAv` and `Kicker`, none of
which this touched; `city-overlay` reaches `RadarChart` and `Donut`, which
is why they stayed when `Compass2D` went. The static scan said the same
thing first, but only the mount can say it about a layer whose references
resolve at render time.
## D27 · The v15 revision syncs in whole, and the honesty layer stays where it was

**Date:** 2026-07-31 · **Status:** Adopted

The 2026-07-31 revision of `design/InSight_standalone_15.html` landed as a
full sync: 32 spec modules re-merged three-way (prototype-old → prototype-new
against the repo's hand-edited copies), 11 new modules ported (the Learn
stack, VOTECUTS, world subtopics, demo catalogues, the take-report store, the
map's over-category ladder), `feeds.jsx` deleted with the prototype, and the
style sheet re-merged the same way. Where the revision and this repo had
independently built the same feature, the revision's UI won and the repo's
enforcement stayed:

- **Catalogue picks.** The revision's Favourites channel (`fav`) replaces
  this repo's `games` channel — same guarantee (a pick card is never
  invisible-by-default), one format home instead of a per-subject scatter —
  and `pick-data.js`'s four live cards are retagged to it. The revision's
  two-tile "you vs the crowd" reveal is adopted for the repo's
  domain-keyed cards, but shares stay real fractions of the whole vote and
  a rank exists only on the PUBLISHED board: the prototype's `#n of 1,025`
  and its hash-drifted per-cohort boards (`wfPickGroup`) enumerate what the
  k-floor suppresses, so those stay demo-catalogue-only (`q.catalog`),
  never on a `q.domain` card. The prototype's own catalogue questions ship
  minus `c03` — it duplicates `pk01` against a 20-entry demo head.
- **The surprise line.** The revision routes it through VOTECUTS; this
  repo's `feedInsight` (feed-read.js) still reads only published, floored
  `agg.by` and returns null rather than inventing a cohort. Demo cards
  therefore still show no surprise line — the same refusal recorded in
  feed-read.js's header, unchanged by the new plumbing around it.
- **Lenses.** The chrome-free redesign is adopted wholesale, with the
  null-honesty divergence re-threaded: `LENSES.score()` still returns null
  for an unanswered dimension in live mode, and every new visual draws "no
  reading yet" instead of a zero. The revision's provisional-lean prior
  applies only where the old prior did — demo mode (`PRIOR_W()`).
- **Dark mode.** The revision removes the switch outright (`quiet-ground`
  replaces it in the Aesthetic tweaks). The `.app.dark` variable block goes
  with it; scattered `.dark` rules survive inert. Dark mode remains its own
  tracked piece of work, now meaning prefers-color-scheme wiring, not a key.

**The arithmetic.** The entry chunk went 850 → 918 KB minified: eleven new
modules are eager because `world-catalogs.js` appends to the feed pool at
module scope, SUBTOPICS/LEARN/LEARN_FEED are subscribed from eager screens
(search, map), and D25's own rule stands — any further deferred group needs
the smoke-test pair (absent before load, present after) before it needs a
byte count. `MAX_CHUNK_KB` rises 900 → 940 to hold that line; the total
budget is untouched (1,522 of 1,600 KB). The deferred feed group absorbed
the revision's biggest growth (world-feed.jsx 82 → 145 KB source; its chunk
85 → 107 KB) without touching first paint. The full-app smoke tests moved
from the 5 s default to a 15 s per-file budget for the same reason — the
slowest cases sat at ~4.8 s before the revision.

---

## D28 · Fake accounts: prevention stays partial, the record becomes correctable

**Date:** 2026-08-01 · **Status:** Adopted by the owner, 2026-08-01
(History, kept because the sequence is instructive: first pushed marked
"binding" ahead of the owner's decision, reclassified to Proposed the
same day, then explicitly adopted. The implementation shipped alongside
the proposal and is now standing.)

**Decision.** No identity gate is added — no phone verification, no ID
check, no proof-of-personhood. The defence against fake accounts is the
stack already shipped (App Check attestation on the callables and, once
console enforcement lands, on Firestore; the k-floor; the publish cadence;
one immutable answer per question per account), plus one new property this
record adds: the aggregate event ledger now makes every counted answer
**attributable and therefore subtractable** after the fact.
`v2_agg_events` entries gain the answering `uid` alongside `qid`/`at`, the
TTL window moves 7 → 90 days (`LEDGER_RETENTION_DAYS`, functions/src/v2.ts),
`deleteAccount` sweeps a uid's entries with the account, and the
correction procedure is written down in DEPLOYMENT.md ("Correcting
aggregates") while the system is calm.

**Why prevention cannot be finished, so nobody re-litigates it.** Sybil
resistance without a trusted identity authority is a proven negative
(Douceur 2002). Every "complete" fix relocates trust rather than removing
it — and each costs this product something it cannot pay: KYC binds a
government identity to a stored politics result (Art. 9 data, D8's
exclusion exists for the same reason); phone verification collects a
number from every honest user and is defeated by the SIM-farm tier it
targets; attestation proves a device, never a person. The app's own
arithmetic already prices the payoff: shifting a 50/50 split by 10 points
takes F ≈ R/4 fakes against R real answers (the shift is (F/2)/(R+F)) —
about 10 fakes against a 40-answer question, 250 against 1,000. So the
exposure is worst at launch and decays with every honest vote, and the
cheap tier (scripted Auth REST + direct Firestore writes, config lifted
from the bundle) is exactly the tier App Check's service enforcement
refuses outright. What no tier can be denied is real devices with real
patience — which is why the fallback property matters.

**The reframe this record binds:** the product's claim is not "no fake
accounts" — unprovable, and any vendor selling it is selling a
false-accept rate. The claim is that the published number is **honest,
bounded in how wrong it can silently be, and correctable once an attack
is found**. D5's immutability and the private/public split already gave
two of the three; the attribution window is the missing third. A
discovered ring is now: query its uids' ledger entries, subtract from
`v2_aggs_private`, republish through the same floors. Wrong for a while,
not wrong forever.

**The retention arithmetic.** Dedup alone needs ~7 days (Eventarc's
redelivery horizon). Attribution needs the window in which a human
notices an attack and investigates it — weeks, not days; 90 days is that
plus headroom. Storage at D7's own write ceiling (~14k answers/day
sustained): ~1.26M live entries ≈ tens of MB of documents plus their
single-field indexes — immaterial against Firestore pricing, and D7's
per-document write arithmetic is untouched because the entry rides in the
transaction the trigger already runs, one field heavier.

**The privacy trade, stated rather than papered over.** A ledger entry
duplicates facts the owner's own answer doc already carries (which
question, answered when — the doc id and `answeredAt`), so no new data
category is collected; but it is a second, uid-keyed copy in a collection
whose lifetime is not the account's. That is a real data-minimisation
cost, bought deliberately, and bounded three ways: rules deny all client
access (pinned in firestore-tests/rules.test.ts — the uid an entry names
cannot read it); the TTL bounds retention at 90 days where the answer doc
lives indefinitely; and `deleteAccount` phase 4c sweeps the uid's entries,
asserted by the erasure e2e including the control that another account's
entries survive. After erasure the tallies a user fed are anonymous
again — the inventory's "nothing to attribute" claim stays true, now by
sweep rather than by absence.

**Residuals, so they are decisions rather than surprises:**

- **Vote-then-erase escapes correction.** An attacker who erases their
  accounts takes the attribution with them — right-to-erasure wins over
  forensics, deliberately. Their votes' effect on the tallies persists
  uncorrectably; what bounds it is the account cost (App Check) and one
  vote per question with no update path, so the damage is linear in
  accounts spent and the spent accounts are gone.
- **The in-flight race.** An answer still traversing Eventarc when
  `deleteAccount` runs can land its ledger entry after the sweep — at
  most one entry per in-flight answer, self-erasing at TTL. The same
  race already governs the count itself (an in-flight answer still gets
  counted after erasure), so this adds no new class of residue.
- **The window starts at deploy.** Pre-D28 entries carry no uid and age
  out on their old 7-day `expireAt`; attribution is not retroactive.
- **Detection is out of scope.** The record guarantees correction given
  a uid list, not that a ring will be noticed. The ledger's timestamps
  are the raw material velocity analysis would read, but no analysis
  ships today.

**Deliberately NOT built, with the reasoning:**

- **Warm-up / velocity gating** (delay or down-weight young accounts).
  Hurts most at launch — precisely when cohorts are small and the app
  already reads empty — to deter a tier that App Check has not yet been
  proven insufficient against. Revisit on evidence: correlated bursts in
  the ledger that enforcement didn't stop.
- **The vote choice in the ledger.** Correction reads the choice from
  the ring's answer docs, which exist whenever correction is possible at
  all (see the runbook's "correct before you delete"). A second copy of
  the vote itself would be worse minimisation for zero forensic gain.
- **A correction script.** The runbook is the deliverable; machinery
  written against an imagined incident is untested machinery (D7's
  reasoning). The first real ring shapes the script.

**Sequencing note, not a new decision:** the App Check console
enforcement steps (SHIP-CHECKLIST §"Before-public hardening") are what
close the cheap tier, and the launch window is where the skew arithmetic
is weakest — finish that rollout before the store submission, not after.

---

## D29 · Device-bound activation: one counted account per device per month, silently

**Date:** 2026-08-01 · **Status:** Adopted by the owner, 2026-08-01
**Owner's brief:** avoid fake users, low friction, global.
**Implementation note (2026-08-01):** shipped same day — the callable
(`functions/src/deviceBind.ts`, with the month/epoch logic unit-tested),
the soft-enforce rules switch (`deviceBindEnforced()`, with the flipped
text pre-tested by a second rules-test environment), the client
activation flow wired into the live boot, and the e2e claim leg. What
remains is owner-gated and listed in docs/DEVICE-BIND.md: the Apple key
and Play Console recall opt-in, the two native token bridges (paste-ready
there — not committed blind because this environment cannot compile
them), the staging probe, and then the one-word enforcement flip. The
"verify before building" list below was partially discharged: the
decision logic handles both recall shapes (write dates present or
absent), and the remaining API facts are flagged at their use sites.

**Proposal.** An account starts counting toward aggregates only after a
silent, per-device activation: the app sends a platform attestation token
to a new callable, the backend checks a few bits Apple/Google store on the
device itself, and stamps the account with a custom claim
(`db: 1`) that `firestore.rules` requires on every aggregate-feeding
answer write. The bits' semantics: **one activation per physical device
per calendar month.** No prompt, no code, no wait, no data collected —
the whole exchange is invisible to an honest user on any device in any
country the stores serve.

Anonymous-first auth (D3) is untouched: accounts stay free and instant.
What is gated is *counting*, which has been this backend's stance since
the k-floor — defend the aggregate, not the registry.

### The gap this closes, stated as the correction it is

D28 (and the analysis behind it) said App Check refuses the cheap tier.
That was true of the *scripted* tier — config lifted from the bundle,
Auth REST, direct writes — and wrong about a cheaper one: on a single
genuine device, clear app storage → fresh anonymous uid → vote again.
App Check passes (real app, real device), rules pass (new uid,
create-only per uid), and the loop repeats indefinitely. Hand-driven
that is dozens of duplicate votes a day; driven by adb against a real
phone, hundreds. The k-floor and PUBLISH_EVERY absorb bursts of five,
not patience. Nothing currently shipped or previously proposed bounds
this attack, and it is the cheapest one that remains.

After this proposal: the same device's second account in the same month
attests fine and activates **nothing**. One device buys one counted
account per month. The cycling attack collapses from "unbounded, free"
to "+1 vote per device per month" — below the publish cadence's own
noise floor.

### Mechanism, per platform

Both platforms expose the same unusual primitive: a few bits of state,
stored by the *platform vendor*, keyed to the physical device, surviving
reinstall — designed so the developer can ask "has this device done the
thing?" without ever receiving an identifier for the device. That
no-identifier property is load-bearing for this product (see Privacy).

- **iOS — DeviceCheck two bits.** `DCDevice.generateToken()` on device;
  server exchanges it with Apple for `bit0`/`bit1` plus a
  `last_update_time` at **month** granularity, and can set the bits.
  Survives reinstall and even device erase. Semantics here: allow if
  `bit0 == 0` or `last_update_time != current month`; on allow, set
  `bit0` (the write refreshes the month stamp). Exactly one activation
  per calendar month, no epoch arithmetic needed — Apple's own
  granularity IS the cooldown clock.
- **Android — Play Integrity Device Recall.** Recall values (3 booleans)
  ride the same integrity verdicts App Check already uses, written back
  server-side, persisting across reinstalls. If the verdict's recall
  payload carries write dates (verify against current docs — see the
  checklist below), Android mirrors iOS exactly. If it carries values
  only, encode the month in the three bits: state `s = (monthIndex mod
  7) + 1`, allow if stored state ≠ `s`, write `s` on allow. Cost of the
  encoding: a device whose last activation was exactly 7, 14, …
  calendar months ago collides with the current stamp and waits out the
  month — a rare, bounded, honest-copy case ("this device recently
  activated an account — try again next month"), not a support fire.

### The gate: activation callable + claim + one rules line

- `activateDeviceV2` (callable, App Check enforced — the
  `registerPushToken` pattern): takes the platform token, verifies with
  Apple/Google, applies the month rule, then sets custom claim
  `{ db: 1 }` on the calling uid. Client refreshes its ID token.
  Emulator: sets the claim unconditionally (the `seedContentV2` gating
  pattern), so the e2e loop keeps running without Apple/Google.
- `firestore.rules`: world/feed/test and catalog answer creates gain
  `request.auth.token.get("db", 0) == 1`. **Duel answers deliberately do
  not** — they feed member-only reveals, never aggregates, and a duel
  already requires a real human to have handed you an invite code. No
  friction lands on groups.
- Per-vote cost: zero. The claim rides the ID token the client already
  sends; no new read, no new document, no change to D7's per-document
  write arithmetic. Activation itself is once per account.

### What it costs honest users, with numbers

- **Everyone, everywhere: nothing visible.** One extra callable during
  onboarding, in the background, typically sub-second.
- **Second person on a shared device, same month:** browses everything,
  votes next month. The one real friction case; honest copy, rare.
- **Returning user re-onboarding on a device that held an account
  before:** iOS, fine unless same month. Android under the epoch
  fallback: waits only on an exact multiple-of-7-months return.
- **Bought a used phone:** previous owner's bit survives erase; blocked
  only if they activated that same month.
- **One human, several devices:** unaffected — linking one account
  across devices needs no second activation; only *new accounts* per
  device are bounded.
- **Devices that cannot attest** (rooted, GMS-less, emulators): cannot
  activate — the same population App Check enforcement already excludes,
  now excluded one layer deeper.

### Privacy: the bits are the on-brand version of this control

Nothing new enters the data inventory. The device-side state is two or
three bits held by Apple/Google against the device — the server receives
allow/deny and stores nothing about the device; the account-side state is
one boolean claim carrying nothing about the device. Neither side can
reconstruct the other. There is no identifier to leak, subpoena, or
erase: `deleteAccount` needs no new phase, because we hold nothing —
the claim dies with the auth user, and the platform bits were never
ours. Store labels: unchanged. This is "we rate-limit devices without
the ability to recognise your device," enforced by API shape rather
than promised by policy — the product's own standard.

One deliberate consequence: deletion does **not** clear the device's
month stamp (the server would need a fresh device token at delete time,
and erasure must not depend on the device cooperating). So
create-vote-delete-recreate is bounded by the same month rule as
everything else. A user who deletes in remorse and returns the same
month waits out the month to *vote* (the app itself works); recorded
here as the trade rather than discovered in support.

### What this does not stop, so the layer above stays honest

Device farms. 250 physical attested devices buy 250 counted votes a
month — enough to move a 1,000-answer question ten points once
(F ≈ R/4, D28). At launch sizes the bar is lower: ~10 devices against a
40-answer question. So the launch window remains the soft spot even
after this ships; what covers it is the floor arithmetic (nothing below
5 surfaces at all), the App Check sequencing note in D28, and the
correction ledger as backstop. This proposal prices the attack in
hardware; D28 keeps the record correctable when someone pays it.

### Rollout shape (when adopted)

1. Console/account prerequisites: a DeviceCheck key (.p8) from the
   Apple developer account; Play Integrity + Device Recall opt-in in
   Play Console. Two function secrets. Same "code plus console steps"
   shape as App Check, and the same account-gating.
2. Soft-enforce first: `DEVICE_BIND_ENFORCE=false` deploys the callable
   and claim-stamping with the rules requirement absent — measure
   activation success rates across real devices before any vote is
   refused. Flip by redeploying rules, not by code change.
3. Old clients cannot activate (no client code), so enforcement waits on
   uptake — `v2_meta.latestBuild`/`minBuild` is the existing machinery
   for exactly this.

### Verify before building — API facts this record does not assume

Repo rule: verify rather than assume, and say which it was. The
mechanism above is designed from API knowledge that must be re-checked
against current docs at implementation time, because both APIs are
newer or quieter than App Check:

- Device Recall: min Android/GMS requirements, whether standard
  verdicts include recall **write dates** (decides month-exact vs
  epoch encoding), the server write method's exact shape, and quota
  (default Play Integrity quota is fine for once-per-account calls —
  confirm).
- DeviceCheck: exact `query_two_bits`/`update_two_bits` response fields
  and the `last_update_time` format (recorded here as `YYYY-MM`).
- Capacitor: neither token is exposed by the App Check plugin (D10) —
  both need a small native bridge (tens of lines per platform, no new
  npm dependency, so D10's alias analysis is unaffected). Confirm no
  community plugin has since made this standard.

### Tightening later (owner's note: "later we might tighten this even more")

The claim is the extension point — each step below reuses it, none
requires a schema change:

- Require `db` on take/flag writes too (spam control for circles).
- Risk-tier the activation: Play Integrity verdicts carry device-risk
  detail; a risky verdict could earn a longer cooldown rather than a
  binary allow.
- Velocity analysis over `v2_agg_events` timestamps (D28's ledger),
  feeding manual review rather than automatic denial.
- Per-vote App Attest assertions (iOS) if a farm ever targets the app —
  heavyweight, so only on evidence.

### Test plan (when adopted)

Unit: the month/epoch arithmetic, collision cases pinned. Rules: answer
create without the claim denied, with it allowed — both directions.
E2e: activation step inserted before each voter in the loop (emulator
path), keeping exact-count assertions green. The Apple/Google round
trips themselves cannot run in the emulator; they get a staging probe
script and a line in SHIP-CHECKLIST §4, stated as such rather than
counted as covered.

## D30 · Farm questions may graduate to the live seed; the deck gets an epoch

**Date:** 2026-08-01 · **Status:** Adopted (docs/LAUNCH-PLAN.md, W1.2)

**What this reverses.** QUESTION-FARM.md's out-of-scope list held "the
live seed catalog" closed: the farm deepened the spec-layer archive
only, and feeding generated questions into production was "a separate
decision with its own review." This is that decision. The farm-side
doc's "Promoting questions into the live seed" section is the operating
contract; the shape is **two gates** — the farm PRs into the archive
(gate one, existing), a human promotes archive entries into
`content/daily-questions.json` in a reviewed PR of their own (gate two,
new), and an operator reseeds. The farm itself still never writes
`content/`; a scheduled job with production-bank write access is what
the second gate exists to prevent. D1 is untouched throughout —
questions are content; activity is fabrication.

**Never-repeat arithmetic.** The daily surface consumes 7
questions/week. The farm's budget cap is 12/week. Promotion averaging
≥7/week therefore grows the bank faster than the calendar consumes it —
no user ever sees a repeat — and the launch target of ~90 daily
questions is by itself ~13 weeks of runway if promotion stops entirely.
Every promoted question buys one day.

**The deck epoch.** `computeDeckIds` mapped day → `bank[(today − back)
mod n]` with `today` the absolute local day number (~20,600). That deep
in wrap territory, ANY change of n remaps every visible day — including
the 7-day history pager, where a user's answered card would be replaced
by a question whose vote state (keyed by qid) doesn't match, rendering
unanswered on every weekly promotion reseed. Fixed by rebasing on
`DECK_EPOCH` (20666 = 2026-08-01): while `n ≥ days-since-epoch`, which
the cadence arithmetic guarantees under sustained promotion, the mod
never wraps and appending questions is a pure extension — no served
day's mapping moves. Residual limit, recorded: if promotion lapses past
the bank's runway, the wrap returns and the next reseed remaps history
once. Unit-tested including the growth-preserves-served-days property.
Duels need no epoch: reveal docs store the answered qid and history
resolves by it, so duel-bank growth shifts future rotation only.

**Invariants the promotion leans on, verified rather than assumed:**

- **Reseed is safe by construction.** `runSeedV2` is merge-idempotent,
  writes `active` only on first create (the ops kill switch survives
  reseeds), and bumps `contentRev` so clients refetch once per boot.
- **seq drift is harmless.** Appending daily entries leaves prior seq
  values alone, but test-surface seq shifts on expansion (one counter
  across four tests). seq only sorts the bank client-side; answers key
  on the doc id, so a shifted seq re-orders nothing a user answered.
- **The prompt join.** Live hydration (`liveSync`,
  src/v2/spec/daily-questions.js) attaches seeded bank entries to demo
  questions by prompt-string equality and warns on orphans. Promotion
  copies prompts byte-for-byte; a reworded promotion silently unhooks
  the question from the Map, which is why the farm doc's step 2 shouts.
- **Id discipline (W1.1).** Every content entry carries an explicit id;
  the generator refuses to invent one. Positional ids would re-key
  every later question on an insert — answers are immutable docs keyed
  by qid, so a re-key attaches live answers to the wrong prompt with no
  cleanup path (the D15 failure class, applied to questions).
- **The bank fetch ceiling.** live.ts fetched the bank with
  `limit(400)`; 213 seeded post-W2 + ~35 archive promotion + ~96
  planned learn cards ≈ 344, and promotion adds ≈600/year. Raised to
  1500 (~two years of headroom) with the rule recorded at the call
  site: approach it with pagination, never another raise — a silent
  cap serves users a truncated bank with no error anywhere.

## D31 · The logic test generates its puzzles; nothing ships an answer key

**Date:** 2026-08-01 · **Status:** Adopted (docs/LAUNCH-PLAN.md, W3)

**The problem.** The Logic overlay served 12 hardcoded puzzles in a fixed
order with fixed option positions, and the answer key — literally
`a: 2,4,3,1,4,2,3,1,3,4,0,3` — shipped in the bundle. The same test every
attempt: memorizable, shareable, and Retake was a replay. The owner's
brief asked for "an actual functional Raven's test … not the same every
time so people can cheat it." Real Raven's items (SPM/APM) are
Pearson-copyrighted and cannot be imported; generation is also the only
design where freshness is structural rather than a bigger bank to leak.

**The design.** `src/v2/data/logic-gen.ts` — typed, pure, deterministic
per seed, published to the spec layer as `window.LOGIC_GEN` (the live.ts
pattern). Each attempt draws a fresh 32-bit seed (crypto-sourced) and
generates a 12-item form: 3×3 matrices over the overlay's existing
Layer/Cell glyph vocabulary, so the Prim/Glyph/Matrix renderers are
untouched. Twelve rule families mirror the retired bank motif for motif
(size ramps, dot count/addition, shape cycling, fill deepening,
overlay/decomposition, two Latin-square families, concentric growth)
plus a distribution-of-two family in the hard tail — Carpenter's
taxonomy, which is also the difficulty calibration: family weights are
Carpenter-ordered and the ramp template ends where the old declared
easy→hard ramp did, so `logicPctile`'s logistic (midpoint 62%) keeps its
meaning without pretending to a norm study we do not have. The family
SEQUENCE is deliberately fixed (every attempt comparable, "k of 12"
means the same thing); the parameters, shapes, directions, distractors
and option positions vary per seed. Distractors are principled
corruptions — wrong-rule, incomplete-correlate, repetition of a visible
neighbour, single-attribute perturbation — deduplicated canonically.

**Honesty posture unchanged.** Stated in the module header: a
client-side test is inspectable by a determined user; what this closes
is memorization and the shipped constant, which was the actual hole.
All five result lenses remain models and remain disclaimed once
(LOGIC_FIELD_NOTE) — nothing new pretends to be a measurement.

**Storage.** Same key (`insight.logicTest.v1`), schema v2:
`{v:2, seed, gv, marks, times, diffs, pctile, when}` — the seed plus
`gv` (generator version) mean a saved score's exact form is
reconstructable forever, and a future generator change can never
silently reinterpret an old seed. v1 payloads (marks/times/when) keep
working: loadResult already back-fills `pctile`, the Pace lens already
falls back on missing `times`, and the Answers lens falls back to
index-order ramp positions when `diffs` is absent — pinned by a smoke
case that opens the overlay over a stored v1 payload. Two latent bugs
fixed in passing: the Answers lens hardcoded `/11` and mapped rows over
the puzzle bank rather than the saved marks, so any result whose length
differed from the current bank would have rendered against the wrong
items.

**Verification.** `logic-gen.test.ts` sweeps 200 seeds × 12 items:
determinism, answer-key integrity (options key matches the constructed
answer; all six options pairwise distinct canonically), answer position
covers all six slots, renderability inside Prim's exact vocabulary,
ramp monotonicity, pinned PRNG outputs — and per-family semantic
validators that re-derive each rule's structure from the cells
themselves (dot sums, Latin properties, ring counts, overlay identity)
rather than trusting the construction path. Smoke: fresh start renders
a generated matrix with six labelled answers; v1 payload renders the
result screen.

**Backend sync: deferred, with the arithmetic.** The test stays
device-local — "this test sends nothing anywhere" stays literally true,
and no store privacy form changes. If it ever syncs: the rules cap
`testResults.keys().size() <= 8` currently holds 4 live keys, so a
fifth (`logic`) fits without a rules change — a client-only
`saveTestResult('logic', …)` plus a data-inventory row and a store-form
re-answer. That bundle is exactly why it does not ride along now.

## D32 · Learn's crowd stat is measured — first attempts only, estimates labeled

**Date:** 2026-08-01 · **Status:** Adopted by the owner ("build real
crowd stats now"), docs/LAUNCH-PLAN.md W-Learn

**What changed.** A learn card's "X% of people got this right" was an
authored number (`p`) presented by demo surfaces. At launch it becomes a
measured one: learn cards join the live bank (surface `"learn"`, 96 docs
seeded from the new single source `content/learn-questions.json`), first
attempts aggregate through the existing k-floored pipeline, and the
reveal names its source. The whole workstream is content + rules-lines +
client: **the aggregate trigger is untouched**, verified by the new e2e
leg — the vote fold was already surface-agnostic over `optionIdx`.

**First attempt counts, and D5 is the mechanism.** Learn's scheduler
re-asks cards by design (GAP 4, STREAK 3, 12-day check-ins), which
collides with a people-rate: counting attempts would measure the
scheduler (a struggling user contributes four answers, mostly wrong).
Resolution: the first exposure — the one moment that measures difficulty
— is written as a plain world answer (`v2_users/{uid}/answers/learn-<id>`,
create-only, id == qid); every later attempt is denied as an update by
the same rule that makes every answer immutable. The psychometric policy
and the privacy invariant are one mechanism, enforced at the rules level
(a rules case pins the refused retry) — not client politeness. The
alternative (a separate attempts collection) needs its own trigger,
deploy-allowlist entry and per-event dedup, and its dedup requirement
collapses back into exactly this keying.

**The server never learns the right answer.** Learn docs carry only
prompt/options/topic; `c`, the trap, the estimate and the map label stay
client-side (the bundle ships `c` today regardless). "% got it right" =
`counts[c]/total`, computed on the device from the public agg. The e2e
leg's shape is the proof: counts fold with zero server-side learn code.

**Cold start: the estimate is labeled, always.** Below the floor (or
unfetched), the reveal shows the authored `LEARN_SPLIT` model with "Our
estimate — becomes measured once enough people have answered"; above it,
the measured split with "Real answers from N+ players" (the lower-bound
phrasing the publish cadence already established, D7). The seam is one
function (`LEARN_SPLIT` + `LEARN_SPLIT_SRC`, unit-pinned): an authored
number can never render as a measurement (D1).

**Leveling stays on the authored `p` — display-only measurement for
now.** At n=5..20 answers, one publish step can move a card's rate by
tens of points; leveling on it would re-rank "on your level" between
sittings and make mastery drift. Revisit when cards routinely clear
~100 first attempts (one publish step then moves the rate ≤5 points).

**Demo honesty in live builds.** The first-run fake mastered seed (six
known cards, one mid-streak) is demo-only, gated on the build flag
(module scope runs before the live boot attaches — the same signal as
live.ts's demoInProd); a live build starts Learn at its real zero.
learn-social's synthetic friend standings render honest absence in live
mode (the D11 structural pattern).

**Single source of truth, and the farm's one single-gate lane.** The 96
cards moved to `content/learn-questions.json` (extracted by script,
verified deep-equal); learn-data.js imports it statically — a data
import, not cross-module load-order coupling — so the demo cards and the
seeded docs cannot drift. Consequence, recorded in QUESTION-FARM.md's
learn-lane section: a merged learn-card PR reaches production on the
next reseed, so its review bar is production-level.

**Coverage.** Rules: accept/retry-refused/range/class cases. Unit: bank
fencing (splitBanks allowlists — a learn card in the daily deck would be
an opinion vote with a secretly right answer), the LEARN_SPLIT seam's
three states, the LIVE surface pin (+learnAnswer/learnAgg). E2e (deploy
path): five first attempts cross the floor with exact counts, the retry
refused; erasure seeds and asserts a learn answer beside the daily one
(same subcollection — `recursiveDelete` covers it, now proven not
assumed). Store forms: no new category — the existing "answers, test
results" row's inventory text names learn answers (data-inventory.md).

## D33 · The farm gets eyes and a faster clock: the scorecard, and daily runs

**Date:** 2026-08-01 · **Status:** Adopted by the owner ("evaluate what
questions do well, learn the routines to make better questions, fire
very often")

**The scorecard.** `scripts/question-scorecard.mjs` (Phase A of the
demand-driven wiring plan, now TAKEN) reads the k-floored public
aggregates and writes `content/scorecard.json`: per question, the
published total (draw) and an evenness score — `1 − (maxShare − 1/n) /
(1 − 1/n)`, the product's own "splits, not landslides" bar as a number —
plus per-topic rollups, leaders, laggards, and retirement proposals.
What it can honestly see is bounded by design: only the floored public
mirror (the k-floor did the privacy work before the scorecard existed),
never skip/pass rates (local-only, D-series), never anything per-user.
The deck epoch (D30) is what makes daily draw comparable — under the
no-wrap invariant each daily question has served exactly once, so totals
rank cleanly (DAU drift between days is the recorded confound, flagged
not corrected in v1). Feed totals are cumulative and rank only against
each other. Grades hold their fire on small samples: a landslide verdict
needs ≥20 answers, or it judges the early crowd rather than the
question.

**The artifact is committed, deliberately.** The numbers are already
public by construction, and committing the scorecard is what lets a
scheduled run read signals without holding production credentials — the
`--fetch` step (anonymous auth + Firestore REST; writes nothing) is an
operator or separately-scheduled action, so the farm session's egress
stops mattering. Staleness rules in QUESTION-FARM.md: >14 days →
advisory; >30 days or missing → lane 3 only.

**How runs learn.** Prompt-level, not weights-level: every run reads the
scorecard before writing — imitate the leaders' *shape* (a near-twin of
a winner is a dupe), justify each new question against the laggards'
failure mode (one line per question in the PR body: why this splits
rather than slides), and cite `retireProposals` as `active: false`
candidates. Guardrails that outrank the score, recorded because a
metric this simple invites goodharting: warmth beats evenness whenever
they conflict (no optimizing toward outrage), and the kill switch stays
the operator's — the farm proposes retirements, it never edits the bank.

**The clock.** The farm re-paces from 12/run weekly to **≤4/run daily**
(~28/week potential vs the daily surface's 7/week consumption). Why
this is safe at 2–3× the old volume: the archive is a holding pen —
generation and serving are decoupled by the D30 promotion gate, which
stays human; smaller daily batches are also easier to review well than
a weekly twelve. Why not hourly: review capacity is the binding
constraint, and a queue of unreviewed AI PRs is inventory, not
progress. The daily catalog run is unchanged. One owner step remains,
measured not assumed: a session outside the Routine's bound session
cannot edit it (both prompt and cron refused org-wide from this CCR
session, 2026-08-01), so the re-pace happens from the dev session or
the Routines UI — the canonical daily prompt is checked into
QUESTION-FARM.md's "Scheduled runs" section so prompt and manual
cannot drift. Until that step runs, the farm still fires weekly under
the old 12-question prompt; the manual's 4/run cap already governs
(the prompt defers to the doc), so the only cost of the gap is
cadence, not volume.

## D34 · The seed stops rewriting what it already said, and the bank pages in

**Date:** 2026-08-02 · **Status:** Adopted (cost review; `docs/COSTS.md`)

**The problem, with its arithmetic.** `runSeedV2` rewrote all 369
question documents on every run and closed with an unconditional
`contentRev` bump — a `serverTimestamp()` written whether or not a single
question had moved. `contentRev` keys the client's whole-bank cache
(`live.ts`), so every bump made every returning device re-read the entire
bank: **369 billable reads per returning user per reseed.** At the
promotion cadence D30 sets up, that is `369 × 4/30 × 3` ≈ **148 reads per
active user per day — 70–80% of all Firestore reads below 50k DAU**, and
it is charged against *monthly* users, not daily ones, so the least
engaged users cost the most. It bought nothing: the payload is 80 KiB of
static content that had typically changed by seven questions.

**The decision.** Three changes, all reusing machinery that was already
there:

1. **The seed skips unchanged documents.** It already read every existing
   doc (`db.getAll`) to protect the `active` kill switch, so the diff is
   free — `seedDocMatches` in `pure.ts` compares the nine fields the seed
   owns. `active` and `updatedAt` are deliberately excluded: the first is
   the operator's, and the second is what the skip exists to keep
   meaningful.
2. **`updatedAt` becomes a real cursor.** It was already written on every
   doc, and therefore meant nothing — it moved on every reseed regardless.
   Now it moves only on documents actually rewritten.
3. **The client pages the delta.** `hydrate()` asks
   `where("updatedAt", ">", cursor − 5s)` against its cached bank instead
   of refetching, the same incremental shape the answers path has always
   used. A weekly promotion costs **7 reads instead of 369** — the 148
   drops to ~3.

The 5-second rewind is not superstition: a batch commit stamps every doc
in it with one server timestamp, so a strict `>` against the highest
cursor held can step over a doc committed in the same instant by a later
batch. Re-reading a few rows already held is much the cheaper mistake.

**What `contentRev` is now.** The full-invalidation lever, and nothing
else. It is written on the first seed of an empty project and on an
explicit `seedContentV2({bumpRev: true})`. **New questions deliberately
do not bump it** — a promotion is precisely the case this exists to make
cheap, and creates carry `updatedAt` like any other write.

**The residual limit, recorded.** The cursor cannot see an `active` flag
flipped **by hand in the console**, because that changes no document the
seed writes. So: after a console kill, run `seedContentV2({bumpRev:true})`
to push it. This is a cosmetic gap, not a correctness one —
`firestore.rules` re-checks `active` on every answer write, so a killed
question still on someone's screen is refused server-side rather than
silently accepted. The old behaviour only covered this by accident.

A second residual: a question document hand-created in the console with
no `updatedAt` is invisible to the delta query. Seed properly, or bump.

**What proves it.** `seedDocMatches` unit tests (functions/pure.test.ts)
including the absent-vs-null upgrade case; `src/v2/data/bank-cache.test.ts`
asserts on the *query the module issues*, not its output, because a delta
that silently degrades to a full fetch costs money with no symptom —
both directions were mutation-probed. An e2e leg pins that a reseed writes
0 documents, skips 369, and holds `contentRev`, and that `bumpRev` still
moves it. The null round-trip through real Firestore — the one thing
unit tests could not settle, and the thing that would have made the whole
optimisation inert — was checked against the emulator before this landed.

**Not done, deliberately.** The other read finding in COSTS.md — the deck
listeners' `DAU²/400` fan-out — is left alone. It is invisible below
50k DAU, D7's write-contention ceiling (~14.4k DAU) binds first, and the
fix trades live counts for polled ones. Recorded, not built: same posture
as D7.

## D35 · Label association becomes explicit, and a static gate replaces the render test that would have proved it

**Date:** 2026-08-03 · **Status:** Adopted (follow-on to
[D21](#d21--the-live-mode-branches-get-a-mount-test-accessibility-gets-a-ratchet))

**The problem.** `profile-general.jsx` carried **8 of the ratchet's 19
findings** — the whole of `label-has-associated-control`, in one contiguous
block of the Basics editor. They read as one bug and were two.

Seven were **not defects**. `Select` renders a *native* `<select>`, so
`<label>Day<Select …/></label>` was already valid implicit association; the
rule cannot see through a custom component. The eighth was **real**:
`CityPicker` renders a `<button>` collapsed and an `<input role="combobox">`
open, both labelable, so the wrapping `<label>City …</label>` won the
accessible-name computation and the chosen city never reached a screen
reader. That one had already been found and *worked around* rather than
fixed — `ui/CityPicker.tsx` carried an `aria-label` added for exactly this
wrapper.

**The decision, and what it traded.** The seven were fixed by threading an
`id` to the native `<select>` and pairing it with `htmlFor`; the eighth by
demoting the wrapper to a plain `<span>` caption, so the cause is gone
instead of compensated for.

`controlComponents: ["Select"]` was rejected. It would have made the rule
accept the nesting **on trust**, and kept accepting it if `Select` were ever
rewritten as a div-based dropdown — a name eslint cannot see, which is the
class `scripts/spec-globals.mjs` exists to refuse.

But the fix **traded a structural guarantee for a textual one**, and that is
the part worth recording. A control nested inside its label cannot dangle.
Seven string matches spread across two attributes can — and
`label-has-associated-control` checks only that the attribute is *present*.
Probed before relying on it: a label pointing at `"totally-dangling"` while
the control carries a different id **passes the rule silently**, and passes
`lint`, `check:globals` and `tsc -b` with it. The same failure shape
`data/vote.test.ts` pins `window.LIVE` against.

**Why the guard is static rather than a render.** Both were written. The
runtime test mounts the app, opens the Basics editor, and asserts all seven
captions resolve through `getByLabelText` to a `SELECT` and that
`getByLabelText("City")` is null. It works, and it was used to verify this
change — it is simply not committed.

The arithmetic: that single assertion costs **~18s** wall, against
`smoke.test.jsx`'s **~56s for 15 mount cases**. One screen's labels would
have added roughly a third of the entire mount-test file. `check-labels.mjs`
covers the dangling/rename class **repo-wide** in **~70ms** — about 250×
cheaper — needs no mount, and cannot be broken by unrelated button copy the
way a full-app render can. It also generalises: `aria-labelledby`,
`aria-describedby` and `aria-controls` dangle identically, and
`PickSearch.tsx` / `CityPicker.tsx` already carry a real `aria-controls`
pair. Nine references across 52 files today, all resolving.

References must resolve; definitions are collected permissively — any `id=`
counts, including `<NavGlyph id={id}/>` (a nav key, not a DOM id) and the SVG
gradient ids. Over-collecting can only cause a **missed** failure, never a
false one, and a gate that reds a green tree on a guess is one people learn
to skip.

**The residual limits, recorded — the render test was not free to drop.**

1. A `<label htmlFor={x}>` put back around `CityPicker` with a matching `id`
   **resolves fine**, so `check:labels` passes and `check:a11y` passes, and
   the accessible-name hijack returns exactly as before. This is the case the
   dropped test caught and nothing now does. It is a narrower hole than the
   one that shipped — that one needed no matching id at all, and the ratchet
   catches *that* — but it is a hole.
2. The gate cannot verify an id reaches the DOM. `<Select id={x}/>` satisfies
   it; if `Select` stopped forwarding `id` to its `<select>`, the pair still
   matches here. Only a render sees that.
3. It does not resolve across files, flag duplicate ids, or flag ids nothing
   points at. All three have false-positive shapes (conditional branches, SVG
   defs) that need more than a regex.

The trigger for revisiting: a **second** screen growing `htmlFor` pairs. One
screen does not justify an 18s mount; several would amortise it, and the test
already exists to lift.

**What proves it.** `check:a11y` is the test for the markup change and fails
without it — revert the fix and `profile-general.jsx` goes 0 → 8 against its
new baseline of 0 (total **19 → 11**). `check-labels.mjs` was mutation-checked
in both directions, because a gate that only passes on a green tree proves
nothing: renaming one side of a pair fails; breaking `aria-controls` fails; a
commented-out `id` does **not** satisfy a live `htmlFor`; a dangling `htmlFor`
in prose or a JSX comment does **not** raise a phantom.

The mutation that matters is the fourth: two ids differing only *after* the
`}` of `` `${uid}` ``. Brace matching is **counted, not regexed**, because
`` htmlFor={`${uid}-bornD`} `` contains a `}` inside its own value — a lazy
`/\{([^}]*)\}/` truncates **both** sides to `` `${uid ``, so they still match
and the scanner reports green while checking nothing. That mutation is the
only one that distinguishes a working scanner from a decorative one.

**Not done, deliberately.** The gate has no committed self-test; the five
mutations above were run by hand. Adding fixtures for a 130-line scanner that
CI runs on every PR is machinery guarding machinery — the tree it checks is
the fixture. Recorded so the next reader knows it was weighed, not missed.

---

## D36 · Five callables cannot attest; the uid allowlists are the control, and a gate holds the list

**Date:** 2026-08-03 · **Status:** Adopted

**Decision.** Every callable sets `enforceAppCheck: ENFORCE_APP_CHECK`,
except the five operator and moderator instruments — `seedContentV2`,
`revealDuelsNowV2`, `buildModQueueNow`, `fetchModQueue`, `submitModVerdict`
— which cannot, and are gated on uid allowlists instead.
`npm run check:appcheck` holds that exemption list, on the deploy path via
`backend-checks.yml`.

**Why this is a record and not a fix.** Six of the eleven callables carried
the option and five did not, and nothing anywhere said which of those was a
decision. That is the whole problem with `enforceAppCheck`: it is a
per-function option, so omitting it is **silent** — the function builds,
deploys, passes every test, and serves any caller on the internet. There is
no error, no warning, and no place a reader could look to tell "deliberate"
from "forgotten". App Check is the only control between the public surface
and unlimited free anonymous accounts (D3), and D28/D29 both lean on it as
the tier that prices a fake account in hardware, so an unexplained gap in
its coverage is exactly the thing this file exists to close.

### Why each of the five cannot attest

Both groups share a shape: invoked from **outside the app**, where no App
Check token exists to send.

- `seedContentV2` — called from a browser console as the one remaining step
  of SHIP-CHECKLIST §1, and by the e2e. Adding enforcement here would refuse
  the call that checklist step is written around, which makes this the one
  exemption that must not be "tidied up" without rewriting the seeding
  procedure first.

  > **Amendment, 2026-08-06.** "From a browser console" was never true. The
  > app has no browser build — hosting serves `web/` (home, join, privacy,
  > terms) and the app ships as the native iOS shell — so the caller this
  > exemption was granted for did not exist. **The exemption stands
  > unchanged**, and for the same reason: the seed is now invoked by the
  > *Seed content* workflow (`scripts/seed-content.mjs`), which carries no
  > App Check token either. Only the description was wrong, in all three
  > places it was written down — here, `check-appcheck.mjs` and
  > `functions/src/v2.ts`.
- `revealDuelsNowV2` — the scheduled scan's manual lever, reached from a
  console during an incident (DEPLOYMENT.md → rollback) and by the e2e. A
  control that fails when it is most needed is not a control.
- `buildModQueueNow`, `fetchModQueue`, `submitModVerdict` — the moderation
  Routine runs in a dedicated low-privilege environment with **no repo
  checkout and no app** (D22, docs/MODERATION.md). Confinement is the entire
  point of that environment; there is no attested client for it to call
  from, by construction.

What stands in App Check's place is `assertOperator` (`SEED_ADMIN_UIDS`) and
`assertModerator` (`MOD_UIDS`) — deliberately disjoint lists, because least
privilege cuts both ways: an operator uid is not thereby a moderator, and a
leaked moderator credential cannot seed content or trigger reveals. Both
went live in fail-safe order: the callables deployed first with the
allowlist empty, denying everyone, and the uid was added by a second deploy.

### The residual, stated rather than papered over

These five are protected by **possession of an allowlisted account** and
nothing else — there is no second factor at the function boundary. App Check
would have been that second factor everywhere it is possible, and here it is
not. Blast radius if an allowlisted Google account is compromised:
`seedContentV2` rewrites the question bank (idempotent, and D34 means a
reseed changes only documents whose content moved), `revealDuelsNowV2`
forces reveals a day early, and the moderation three hide takes — today,
nothing at all, because `MOD_ADVISORY = true` means verdicts record and
surface without hiding.

**A shared secret was rejected** as the substitute. It would be a new thing
to store, rotate and leak, standing in for an allowlist that already exists
and is already deployed — and for the moderation three it is worse than
neutral: putting a credential inside the low-privilege environment re-arms
precisely what D22 disarmed by keeping that environment empty.

### Why the gate is a source scan

The natural home is `check-fn-runtime.mjs`, which already walks every
exported function asserting explicit memory and timeout. It cannot live
there, and the reason is worth writing down because it is invisible: that
script sets `FUNCTIONS_EMULATOR=true` to keep the import off the metadata
server, and `ENFORCE_APP_CHECK` is *defined* as
`FUNCTIONS_EMULATOR !== "true"` (`functions/src/ops.ts`) — so under that env
every callable's `__endpoint.callableTrigger` reads `{}`, enforcing and
non-enforcing alike. Checked by printing them, not assumed.

The gate therefore parses source, and demands the shared constant
specifically rather than the presence of the key: `enforceAppCheck: false`
would satisfy a presence check while doing the opposite, and a hardcoded
`true` would break every emulator suite, which is the whole reason the
constant turns itself off there.

**What proves it.** Four mutations, each run and reverted: dropping
enforcement from `createGroupV2` fails; adding enforcement to an exempt
callable fails (an exemption must not outlive its reason); `enforceAppCheck:
true` in place of the constant fails; and reformatting a one-line callable
to multi-line still passes, so the pattern is not brittle about layout.

The fifth guard is the one that earned its place immediately. The script
counts `onCall(` **sites** separately from the option blocks it parses, and
fails when they disagree — and on its first run it did: `deleteAccount`
carries a two-line comment between the paren and the brace, which the first
pattern could not cross. So the gate's very first act was to report that it
was silently skipping the callable whose failure mode is a job the user can
never complete. A gate that cannot read a function is a gate that is lying
about it — the same lesson `check-a11y.mjs` records about files that do not
parse.

**One thing reasoned rather than probed.** SECURITY.md notes that App Check
enforcement is not yet enabled console-side. That toggle governs the App
Check *service* for Firestore, Storage and the rest; the per-function
`enforceAppCheck` option is independent of it, so the six enforcing
callables are understood to be rejecting unattested calls in production
today. That follows from the API shape and has not been driven against
production — worth confirming when the console flip happens, since it
determines whether that flip is a change for callables or a no-op.

---

## D37 · The device-bind flip becomes deterministic, then measured — the trigger is two numbers, not a judgement

**Date:** 2026-08-03 · **Status:** Adopted (amends
[D29](#d29--device-bound-activation-one-counted-account-per-device-per-month-silently)'s
rollout step, not its decision)

**Decision.** `deviceBindEnforced()` flips after two things, in order:
`v2_meta.minBuild` is raised to the first activation-capable build, and the
fleet's activation **error rate** is under 1% (with zero `DeviceCheck auth
rejected`) and Android's `verdict without deviceRecall` rate under 5%, each
over 24h. Procedure and queries in docs/DEVICE-BIND.md §4.

This replaces "after enough client uptake that activation-capable builds
dominate", which named the right levers and then used them as a statistic.

The two percentages are engineering defaults, not physics, and the owner can
move them — but in a known direction each: raising the error-rate ceiling
trades honest users' votes for an earlier flip, and raising the recall
ceiling trades the Android half of the guarantee for the same. The
*structure* — minBuild first, then two separate numbers, `cooldown` counted
as success — is what this record binds.

**Why this is a record.** D29 shipped with a soft-enforce switch and a
pre-tested flipped ruleset — unusually careful, and both halves of the
behaviour are pinned by `rules.test.ts` running a second emulator
environment against the rewritten literal. What it did not carry was a
condition anyone could evaluate. "Dominate" is not a number, and a flip with
no threshold happens either too early or never; both are failures, and only
one of them is visible.

### The cost of an early flip is invisible, which is the whole problem

After the flip, an account without the `db` claim has every
aggregate-feeding answer refused by rules — and **nothing tells the user**.
`live.ts`'s `vote()` catch rolls the optimistic state back and reports to
Sentry: the option takes, then silently un-takes. Duel answers are exempt
(D29), so the app keeps working *partly*, which is worse than failing
cleanly — it reads as flakiness, not refusal.

So the failure mode of flipping early is not a support queue naming the
cause. It is a product that feels broken, discovered from Sentry volume if
anyone is watching it. That asymmetry is the argument for measuring first:
the flip is cheap to delay and expensive to diagnose.

### Why `minBuild` is a change of kind, not of patience

Two populations lack the claim. The first — clients on builds predating the
activation flow — was what "uptake" was about, and it does not need
measuring at all, because `minBuild` already exists and is a **hard** gate:
`LIVE.updateRequired` renders a full-screen dialog over the app, so a client
below it cannot reach a vote. Raising it to the first capable build empties
that population by construction.

Waiting for uptake instead leaves a tail: at 95% capable builds, 5% of
honest voters get the silent rollback above, indefinitely, and the number
never reaches zero on its own. Same lever, used as a guarantee rather than
as encouragement.

`updateUrl` has to be set alongside it — without one the dialog's button
falls back to `location.reload()`, which on a native shell reloads the same
bundle it is trying to replace.

The second population — capable build, activation failed — cannot be driven
to zero, so it is the one that gets a threshold.

### Why two thresholds and not one

They guard opposite failures, and a single number would hide whichever it
was not measuring:

- **Error rate < 1%, zero `DeviceCheck auth rejected`.** This is "are we
  refusing honest users". The second clause is separate because that line is
  *always* a misconfigured key and never a device condition — one occurrence
  is a configuration bug, so a small-percentage allowance would be wrong at
  any volume.
- **`verdict without deviceRecall` < 5% of Android activations.** This is
  "does the flip buy what it is for". That path allows on integrity alone,
  so it refuses nobody and cannot show up in the first number at all — yet a
  high rate means the month bound is not biting on Android, which is the
  entire mechanism D29 exists to install. Passing the safety threshold while
  failing this one means flipping for no benefit.

**`cooldown` is deliberately counted as success.** It is the mechanism
working — a second account on the same device in the same month, correctly
given no claim. Folding it into the error rate would make the metric
deteriorate exactly as the system began doing its job, which is the shape of
a metric that gets a good change reverted.

### Not an alert

DEPLOYMENT.md's "one alert, deliberately" reasoning applies and was not
overridden: an alert nobody acts on trains people to ignore the channel.
These are numbers read **once**, at a deliberate decision, from
`gcloud logging read`. A standing alert on a rate that matters on exactly
one day is the noise that argument warns about.

**Written, not run.** The queries are composed from the log lines in
`deviceBind.ts` and the resource shape in the existing monitoring policy.
They have not been executed against production and cannot be, because
activation has never run there — the native bridges are still not in the
tree (DEVICE-BIND §2). The outcome strings are certain, being read from
source; the log field (`jsonPayload.message` vs `textPayload`) is the part
to expect to adjust on first use.

### The follow-up this names rather than fixes

A refused answer write is silent to the user, today, flip or no flip. That
is a real UX defect independent of D29 — the same rollback happens on a
network failure or a duplicate write from a second device — and fixing it
means deciding what a refused vote should *say*, which is a product
question, not a rollout one. Recorded here because the flip is what makes it
matter, and because discovering it during the flip would misattribute it to
the flip.

---

## D38 · The no-button overlays load after first paint; relmap stays eager because the Mirror reads it

**Date:** 2026-08-03 · **Status:** Adopted (follow-on to
[D25](#d25--the-world-feed-loads-after-first-paint-the-rest-of-the-split-waits))

**Decision.** `loadOverlays()` defers `test-overlay`, `person-mindmap`,
`person-overlay`, `city-overlay`, `suggestions`, `data/logic-gen` and
`logic-test` past first paint, the way D25 deferred the world feed. Entry
chunk **922 → 837 KB**; `check:bundle`'s per-chunk ceiling comes down
940 → 850 with it. `relmap.jsx` is excluded, and that is the interesting
half of this record.

**Why now.** The entry chunk sat 18 KB under its ceiling. That is not a
budget, it is a tripwire waiting for the next revision — D27 alone added
~68 KB. The headroom is now ~13 KB against a ceiling 90 KB lower, which is
the same tightness measuring a much smaller chunk.

### The rule this applies, and what it excludes

D25's argument was not "defer the biggest module". It was: **defer the
module whose absence is already a legitimate frame.** `daily-split` reads
`window.WorldFeed &&` before rendering the feed node, so an unloaded feed
renders as no feed — the guard was already the contract.

Applying that literally selects the five no-button overlays, because nothing
on the first frame can reach any of them: they open only through the
`window.open*` cross-links app-shell installs in an effect.

It also **rejects `relmap.jsx`, the largest candidate at ~43 KB.**
`mirror-field-pops.jsx` reads `typeof RelationshipMap === 'function'` to
decide whether the Mirror's Circle population renders the embedded map or
the generic field canvas. That read happens during a render nothing
re-triggers, so deferring it would silently swap the Circle picture for the
fallback until some later state change — no error, no crash, just a
different picture. Exactly why `world-feed-data.js` stays eager. Excluding
the biggest item on reachability grounds is the rule doing its job rather
than the rule being inconvenient.

### The await is the mechanism; the guards are not

This group differs from the feed in one structural way, and getting it
backwards produces a bug that looks like a fix.

The obvious implementation is to guard each render site
(`{ov === 'test' && window.TestOverlay && …}`) and let the openers stay
synchronous. That is **wrong here**: `setOv('test')` with the chunk still in
flight renders nothing *and schedules nothing to re-read the global*, so the
overlay stays blank until an unrelated state change — a tap that does
nothing, permanently. The feed does not have this problem because its
absence is a frame a user reaches anyway, and `main.jsx` re-renders when the
chunk lands.

So the openers `await loadOverlays()` before setting state, and that await is
the synchronisation. No re-render is needed, unlike the feed. The render
guards remain, downgraded to what they are: the degradation path for a chunk
that never arrives.

### Where the loader is published, and why it is not where it should be

`spec-index.js` sets `globalThis.loadOverlays`. The house pattern would put
it in `data/` — that is how `back.ts` hands `registerBackHandler` to this
same shell. It cannot go there: `data/` is TypeScript with no `allowJs`, so
a module there cannot import `spec-index.js`, and the dynamic imports must
stay in `spec-index.js` because that is the file `check:globals` rule 2
matches its `'./spec/…'` strings against. The one-directional boundary
(`data/` and `ui/` publish globals, `spec/` reads them; never the reverse)
is deliberate and worth more than the symmetry.

`await import('../spec-index.js')` from app-shell also works, and was the
first implementation. It was replaced because it emits
`INEFFECTIVE_DYNAMIC_IMPORT` on **every build** — spec-index is statically
imported by `main.jsx`, so it cannot move to a chunk of its own, nor should
it. check-bundle.mjs's own header records what a warning on every build
becomes: background noise hiding the next real one. Publishing from
spec-index costs no gate, because `scripts/spec-globals.mjs` already scans
that file for definitions alongside `main.jsx`.

### What proves it, and what nothing proves

`smoke.test.jsx` gained five cases that delete each overlay's global and
assert the shell degrades to a blank rather than a `ReferenceError`.
Mutation-checked: restoring any one render site to its bare identifier fails
exactly that row on the boundary assertion and passes again on revert. The
thirteen existing cases already cover the loaded path, and their `openVia`
helper now uses an awaited `act`, without which every assertion would run
against the frame before the overlay rendered — the vacuous pass this file
exists to prevent, in a new shape.

**The ceiling's coverage is measured, not claimed**, by re-adding the static
imports a group at a time: nothing 837 KB, test-overlay 854, person + city +
suggest 887, all of it 922. At 850 the group and every module large enough
to matter go red. `city-overlay` alone would not — it fits under the 13 KB
of headroom, and closing that gap means zero headroom, which reds the tree
on any legitimate growth instead.

**Nothing checks eager-vs-lazy directly.** Re-adding a static import to
`spec-index.js` leaves lint, `check:globals`, `tsc -b` and all 269 unit
tests green; only the ceiling notices, and only above its headroom. Recorded
rather than fixed: the alternative is a gate asserting the shape of the
build's chunk graph, which is more machinery than the ~13 KB it would
protect.

### Driven in a real browser, because jsdom is not the same thing

The mount tests are the coverage, but this is the first change to the spec
layer's **load order**, and jsdom's `import()` is not a network fetch. So
the production build was served with `vite preview` and driven in Chromium.
Both halves, measured rather than assumed:

**Loaded.** All seven modules arrive as seven separate requests — 837 KB
entry, then `person-mindmap` (18.3), `test-overlay` (16.3), `logic-test`
(13.8), `suggestions` (13.7), `person-overlay` (12.6), `city-overlay` (5.8),
`logic-gen` (5.1) — every one after the entry chunk, all seven resolved
754 ms from navigation against a 368 ms first paint. All five overlays open
and render through their real openers, `relmap` as the eager control, with
**zero console errors and zero page errors**.

**Aborted.** With every overlay request failed at the network layer, the
shell still paints in full (13.7k characters of content, tabbar intact), the
`ErrorBoundary` does **not** trip, `openTest()` resolves without opening, and
the Mirror tab still works afterwards. The console carries exactly the two
designed lines and nothing else: `main.jsx`'s `reportError({where:
'loadOverlays'})` and app-shell's `[InSight] overlay chunk failed to load`.
That is the degradation path working end to end, which is more than the
jsdom cases can show — they delete a global, this one breaks the fetch.

Only **one** chunk needed aborting to fail the group: the awaits are
sequential, so the first rejection ends the chain. All-or-nothing is the
intended shape — a half-loaded overlay group has no honest behaviour — and
it is worth knowing that the failure is not per-module.

One thing the run did *not* establish: that every chunk is requested strictly
after first paint. It is not, and that is correct — `main.jsx` calls
`loadOverlays()` immediately after `root.render()`, and React 19 paints
concurrently, so the requests are in flight around the same instant. The
property that matters is that first paint does not *depend* on them, and the
aborted run is the proof: the shell painted completely with all seven
missing.

### Follow-on not taken here: extracting pure logic out of `spec/`

The other half of this work — lifting arithmetic out of the ported JSX into
typed, tested modules under `data/`, the way `feed-interleave.test.ts`
already did after D11's `else if` swallowed every lens question — is
deliberately **not** in this change.

Two reasons, and the second is the load-bearing one. It is a different kind
of change: this one moves modules between chunks and is proved by a bundle
ceiling and five mount cases; that one moves *code* and needs its own tests
per extraction. Bundling them would produce a diff where a regression in
either is hard to attribute.

And the target should now be chosen from evidence rather than from reading.
`npm run test:coverage` exists as of this change, and it already disagrees
with the intuition that named `map-layout.js` and `passive-progress.js` as
the candidates: the data layer's weak spots are `live.ts` (58% statements,
64% branches, the largest module) and the browser-API modules `locate.ts`
and `push.ts` at zero — the latter two by nature, since D9's four location
failure paths were driven in a real browser rather than in jsdom. Extract
against that report, one module per change.

---

## D39 · The spec-layer migration gets a meter, and two figures get a gate

**Date:** 2026-08-03 · **Status:** Adopted

**Decision.** `check:globals` gains a fourth rule: the number of
cross-module shared-global references, counted **per file**, may only go
down. The baseline is 799 sites across 57 files. New coupling fails CI;
removed coupling also fails, asking for the baseline to come down with it.

### Why a ratchet and not a plan

`src/v2/README.md` has carried a "Migration path (Phase 2+)" section since
the port landed, and `CLAUDE.md` calls the shared-global convention
"deliberate and temporary". Thirty-eight records later it is neither
finished nor started. Nothing measured it, so there was never a moment
where anyone had to notice.

The uncomfortable part is that the four existing guards are *why*. Each one
absorbs a class of bug the convention creates — dangling references,
forgotten imports, undefined JSX tags, globals that exist but are wrong at
render time — and together they make the layer survivable enough to keep
indefinitely. That is a good outcome for correctness and a bad one for the
migration: the guards removed the pain that would otherwise have argued for
leaving. Rule 4 is the counterweight, and it is the smallest thing that
could be: not a deadline, not a target number, only a direction.

### What it counts, and why the mechanism needs no bookkeeping

Every site where a file reads a name **another** file in the scanned set
assigns to global scope — `window.LIVE`, `<Chip/>`, `globalThis.DUELS`.
That is the coupling itself rather than a proxy for it.

The scanner already suppresses a JSX reference when the file declares the
name locally, and an `import { Chip }` is a local declaration. So
converting a consumer to a real import drops its sites to zero on its own,
with nothing to update by hand. Verified by performing both mutations
before trusting the rule: adding `window.DUELS` to `vote-cuts.js` fails it
upward (1 → 2), and rewriting `logic-test.jsx`'s `window.LOGIC_GEN` as an
import fails it downward (1 → 0) with the replacement literal printed.

### The order this implies, which is not the order intuition gives

The graph was measured rather than guessed: 81 files, 319 owned globals,
230 file→file edges, 20 cycles. It is not uniformly tangled. **28 files are
pure providers** — consumed by others, depending on nothing themselves —
and those can convert with no load-order risk at all, `primitives.jsx` (22
consumers) first. Each moves as an `export` plus a `globalThis.X = X`
compat line, so unconverted consumers keep working and the count does not
move until they follow.

The cycles are the part to leave alone, and they cluster on
`daily-split.jsx`, `test-definitions.js` and `app-shell.jsx`. ESM handles
cyclic value bindings badly and fails at render, which is this layer's
worst class of bug. Those dissolve by extraction into `data/` — the move
`deck.ts` and `groupPortrait.ts` already demonstrate — not by conversion in
place.

### And the figures gate, for the fourth instance of one error

`npm run check:figures` holds README.md's quoted test counts equal to the
suites. It exists because the count said **40 in two places while the rules
suite ran 44**.

That is the fourth instance of a single failure: the spec layer's
suppression count went stale twice (42, then 27) — the second time inside
the paragraph explaining that it is quoted inline *because* it had gone
stale before — and the a11y baseline once (19 after a pass took it to 11).
D35 closed those three by making `check:a11y` recompute them. The lesson
generalises and had not been generalised: a number that lives in prose and
in the tree needs something holding them equal, and a paragraph asking
people to keep it current is not that something.

It is a separate script rather than a fifth job for `check-a11y.mjs`,
because a doc mismatch reported by a gate named "a11y" reads as an
accessibility regression — the confusion that script's own header warns
about. It is on `ci.yml` and deliberately **not** on `backend-checks.yml`:
a stale README figure says nothing about whether a rules fix is safe to
deploy, and nothing that cannot answer that question gets to block one.

Coverage percentages are out of scope and the script says so — they need a
full coverage run, and the prose already hedges them as "what it says
today".

---

## D7 amendment (2026-08-03) · The retry-logging trigger now has an instrument

D7 names the condition for revisiting the sharding decision: "when
`onV2AnswerCreated` starts logging transaction retries." **It never logged
them**, and `docs/DEPLOYMENT.md` separately claimed the error alert was how
that signal reached anyone. Both were describing a path with no source at
either end.

Contention is not an error. Firestore's SDK retries an ABORTED transaction
inside `runTransaction`; the write commits, nothing is logged above INFO,
and a policy filtering `severity>=ERROR` cannot match the condition however
severe it gets. The only place a retry is visible is inside the callback,
by counting its own invocations — which is what `runAggTransaction`
(`functions/src/v2.ts`) now does, logging at three attempts with the `qid`
attached. Three, not two: one attempt is the normal case and two is
ordinary interleaving.

`monitoring/onV2AnswerCreated-contention.json` and a log-based metric turn
that into an alert; both are applied by hand, like the error policy, and
for the same reason (the deploy service account has no monitoring role).

**A correction to this record's own framing while here.** D7 says of the
uniform publish cadence: "the public mirror is not rewritten on every
answer — it publishes every 5th, cutting writes to `pubRef` by ~80%." True,
and it reads as though the ceiling moved. It did not. `privRef` is written
on **every** answer inside the same transaction, and a transaction is
bounded by its most contended document, so the ~1 write/sec/question
ceiling is exactly where the arithmetic above puts it. `PUBLISH_EVERY`
bought a disclosure fix and a cost reduction, not headroom.

**What would move it**, when the instrument says it is time: shard
`v2_aggs_private/{qid}` alone. D7 priced sharding as XL on the basis of "N
shard docs, a periodic roll-up, a new scheduled function, a deploy-allowlist
edit" — but two of those four fall away if only the private document is
sharded, because the publish path already runs 1-in-5 and is already the
only reader of the total. It sums the shards there. No roll-up job, no new
function, no allowlist entry. At N=10 the cost is ~2 extra reads per answer
amortised for 10× the headroom, and the e2e's exact-count assertions need
one helper rather than two rewrites. Still not worth doing at zero users;
worth recording as an M rather than an XL, so the decision is made against
the real price.

### D39 amendment (2026-08-03) · `primitives.jsx` is converted, and the ratchet had a hole

The first module is off the bridge. `primitives.jsx` — the layer's most
consumed provider, and one that depends on nothing itself — now exports its
eleven names and **publishes nothing to `globalThis` at all**. All 24
consumers import them. **799 → 755.**

**The compat line this record recommended turned out to be unnecessary**,
and that is worth carrying forward rather than quietly dropping. D39 says to
export with `globalThis.X = X` beneath so unconverted consumers keep
working. That is the right shape when the consumer set is open-ended; here
it was closed — 24 files, all in `spec/`, with the only other mentions of
these names being three comments in `ui/` and `test/`. Checking that first
turns a two-step migration into a one-step one, and avoids leaving dead
compat behind. The rule to carry: grep for the full consumer set before
assuming a bridge is needed.

### The hole, found by doing the work rather than by review

`daily-split.jsx` renders `h(Sheet, {…})` — a cross-module reference
written through a `React.createElement` alias. **Rule 3 could not see it**
(not a JSX tag), **rule 1 could not see it** (not `window.X`), and so
**rule 4 did not count it**. Only `no-undef` was watching, and `no-undef`
counts nothing.

That is worse than an undercount by one. A ratchet whose job is that the
number cannot go up was bypassable by writing the reference in a different
syntax. The scanner now matches `h(Capitalised…)` the same way it matches a
tag, with the same local-declaration suppression.

Fixing it exposed a second scanner defect underneath, which is why the
first one mattered: `const st = this.state, h = React.createElement, F =
React.Fragment;` declares `F` locally, but the local-name scan only ever
looked at the **first** declarator in a list, so `h(F, …)` immediately
reported `F` as an undefined global. Per this repo's standing rule — if a
gate fires on a legitimate name, fix the scanner, never add an exception —
the declarator-list case is now handled. Neither defect changed the count
(both names resolve locally), so the baseline is unaffected; what changed
is that the count can no longer be avoided.

### Two gates, and neither covers both reference styles

Verified by deleting an import and watching which gate failed:

| reference | caught by | why not the other |
| --- | --- | --- |
| `<Sheet/>` | `check:globals` rule 1 | base `no-undef` does not treat JSX tag names as identifier references |
| `useDialog(…)` | eslint `no-undef` | rule 1 only matches `window.X`, and rule 3 only capitalised tags |

Worth stating because the obvious assumption — that `npm run lint` going
green means no bare references survive a conversion — is false, and it was
the assumption in play when `result-card.jsx`'s two `window.Av` sites went
unconverted. Lint passed; `check:globals` caught them.

Those two were a defensive guard, `{window.Av ? … <window.Av /> …}`, which
only existed because load order could leave the global unset. An import
cannot be unset, so the guard was deleted rather than rewritten — the
conversion removes the condition, not just the prefix.

**The figure in `src/v2/README.md` is gate-checked**, in
`check-spec-globals.mjs` rather than in `check-figures.mjs`, because that
script owns the count and a second implementation of it would be the drift
the gate exists to prevent.

### D39 amendment (2026-08-03, later) · `sample-data.js` converted — 755 → 726

The second module off the bridge, and the layer's largest data module (719
lines). `IS_DATA` and `fmtPop` are exports; nothing assigns to `window`.
`scenes.js` is now the first file in `spec/` with **no cross-module global
references at all**, which is the shape the migration is aiming at one file
at a time.

Two differences from `primitives.jsx`, both of which generalise:

**The consumer set was not closed.** `test/smoke.test.jsx` reads `IS_DATA`
to pick a real person and city for its overlay cases — using the fixture
rather than hardcoding a name, deliberately, so the test does not silently
stop finding anybody when the sample data is edited. So the conversion
reached into `test/`. The previous amendment's rule stands and gets sharper:
grep `ui/`, `data/`, `test/` and `main.jsx` before assuming a provider's
consumers live only in `spec/`, because that answer is what decides whether
a compat line is needed at all.

**Every reference was `window.IS_DATA`, not a bare name.** Nine carried
`(window.IS_DATA || {})` or `window.IS_DATA?.` — the same
might-not-be-loaded guard `result-card.jsx` had around `Av`, and dead for
the same reason: an imported const cannot be unset, and `sample-data.js`
depends on nothing, so no cycle can put it in TDZ. Removed. The **inner**
`|| []` / `|| {}` on `.groups`, `.people`, `.me` stayed — those guard
missing data rather than a missing module, and conflating the two would
have deleted real defensive code.

That distinction is the one to carry: converting a provider removes the
load-order condition, never the data condition.

**The bundle number moved and it is not a win.** Entry chunk 853 → 818 KB,
because `sample-data` became its own chunk — one that first paint still
preloads, since `app-shell` imports it eagerly. Total JS is unchanged at
1529 KB. This is exactly the case `check:bundle`'s header predicts ("a
per-chunk limit alone is dodged by splitting one large chunk into two
merely-large ones"), and the reason it asserts a total as well. Recorded so
that the extra headroom under the 850 KB ceiling is not read as room that
was earned.

### D39 amendment (2026-08-03, third) · `daily-questions.js` — 726 → 708

The first conversion where the module was **not** a pure provider, and the
first where the conversion removed a real fragility rather than a syntax.

**It is not a leaf, and that did not matter.** `daily-questions.js` reads
`window.LIVE` in three places, so unlike `primitives.jsx` and
`sample-data.js` it carries outgoing coupling of its own — which stays.
Converting what a module *provides* is independent of what it *consumes*;
the earlier records' "providers that depend on nothing" ordering is about
load-order risk being zero, not a precondition. Do not wait for a module to
be a leaf before exporting from it.

**The IIFE.** `window.DAILYQ = api` sat inside a `(function(){…})()`
wrapper, so `api` was not reachable at module top level. The wrapper is
vestigial — an ESM module already has its own scope, and it is what this
file needed when every module shared one — but unwrapping it re-indents 480
lines and would bury four real edits in a whitespace diff. So the binding is
hoisted (`export let DAILYQ;` above, assigned inside) rather than the
wrapper removed. ESM exports are live and the module finishes evaluating
before any importer's body runs, so a consumer never sees the hole. Recorded
because the next IIFE-wrapped module should get the same treatment and not a
reflexive de-indent.

### The fragility this one removed

`map-branches.js` reads `DAILYQ.EMERGENT_CATS` at **module-evaluation
time** — not in a component, not on an event — to merge seven topical
categories into the Map's category list. It worked only because
`spec-index.js` lists `daily-questions.js` fifth and `map-branches.js`
eleventh. Swapping those two lines would have dropped all seven categories
**silently**: the old code was `if (window.DAILYQ && Array.isArray(…))`, so
an unset global meant the merge simply did not happen, with no error
anywhere and a Map that looked plausible.

That is precisely the failure class CLAUDE.md describes the spec layer's
load order as carrying, and it is now a module-graph guarantee instead of a
property of a list nobody may reorder. The presence half of that guard is
gone with it; the `Array.isArray` half stays, per the rule from the
`sample-data.js` amendment — a conversion removes the load-order condition,
never the data one.

**Verified by probe rather than by reasoning**, since a silent no-op is the
exact failure: all seven (`top-sport`, `top-film`, `top-food`, `top-travel`,
`top-mind`, `top-morals`, `top-music`) still merge into `MapLens.CATS`
after the change.

Entry chunk 818 → 793 KB, same relocation-not-saving as the last one —
total JS unchanged at 1529 KB across 34 chunks.

### D39 amendment (2026-08-03, fourth) · `world-catalogs.js` — 708 → 691, and the meter was overcounting

Two independent things, worth separating because only one of them is the
tree improving.

**Half the module converts.** `world-catalogs.js` assigns two names and only
one is its export. `WF_CATALOGS` is a plain data object with a single
writer; it converted like the others, and all six consumer sites in
`world-feed.jsx` carried the same `(window.WF_CATALOGS || {})` load-order
guard, now gone.

`WORLD_FEED_QS` did **not** convert, deliberately. It has four writers:
`world-feed-data.js` creates the pool, this file and `world-subtopics.js`
append to it, and `data/live.ts` replaces it wholesale in live mode — which
is how D11's guarantee that demo catalogue cards never reach live surfaces
is implemented. Making that an ESM export means designing an owning module
with an add/replace API and moving four writers onto it, across the
live/demo boundary. That is a design change, not a conversion, and it does
not belong in a batch of mechanical ones. The append site now carries that
reasoning inline so the next person does not have to re-derive it.

**The ratchet was overcounting, and this is how it surfaced.** `definedBy`
was a first-assignment-wins map, so a multi-writer global got one arbitrary
owner decided by `readdir` order. `world-catalogs.js` sorts before
`world-feed-data.js`, so it was recorded as owning `WORLD_FEED_QS` — and
`world-feed-data.js`'s five reads of **the global it creates itself** were
counted as coupling to a file that merely appends to it. Same for
`world-subtopics.js`.

It is now `Map<name, Set<file>>`, and rule 4 asks "does this file assign
this name?" — a question that still has an answer when several files do.
**11 of this change's 17-site drop are that correction**, not converted
code.

Recorded at this length because of what the failure was: a ratchet
miscounting in the *flattering* direction is the one error it cannot report
about itself. The number went down for a reason that was not progress, and
the only thing standing between that and a quietly wrong meter was someone
reading the attribution while doing an unrelated conversion. The first
multi-writer global to be converted would have moved the count in the wrong
direction and looked like a regression.

### D39 amendment (2026-08-03, fifth) · `follows.js` — 691 → 673, and a guard shape the earlier conversions missed

`FRIENDS` is IIFE-wrapped like `DAILYQ` and took the same hoisted
`export let`. Its 18 sites across four consumers were unusually dense in
presence guards — six of them — and one was another module-scope read:
`duels-data.js` ends with `FRIENDS.subscribe(fire)`, which is what makes a
befriend or unfriend ripple into duos and groups. It was written
`if (window.FRIENDS) window.FRIENDS.subscribe(fire)`, so reordering
`spec-index.js` would have dropped the subscription **silently** — the same
failure `map-branches.js` carried, in a different feature. Probed rather
than reasoned about: inviting a friend still fires the DUELS listeners.

**A miss from the `sample-data.js` conversion, found and fixed here.** That
change removed the `(window.IS_DATA || {})` and `window.IS_DATA?.` shapes by
explicit rewrite and then renamed the rest in bulk. That left four sites
reading `(IS_DATA && IS_DATA.people) || []` — dead for the same reason the
others were, and invisible to every gate in the tree, because a redundant
`&&` is valid code that computes the right answer.

Worth recording as a method correction rather than a typo. The guard shapes
are a **list**, not a pattern:

    (X || {})      X?.        X ? … : …
    !X || …        X && …     if (X) …

Grep the name and read every site. A bulk rename is the right tool for the
reference itself and the wrong tool for the conditions around it, and
nothing downstream will tell you — `check:globals` sees no coupling, eslint
sees valid code, and the tests pass because the guard evaluates true.

### D39 amendment (2026-08-03, sixth) · `result-rose.jsx` — 673 → 657, and the seam is exhausted

Four exports (`RP_TESTS`, `RoseMini`, `PoleRows`, `TestRose`), sixteen
sites, and all seven `(window.RP_TESTS || {})` guards.

**Half its globals had no consumers.** `RosePetals`, `rpPetal`, `rpDeep`
and `rpDot` were on `window` because the port registered every top-level
declaration, not because anything read them. As a real module they are
private, so this removed **eight** names from the global namespace to
export four. That ratio should be expected again: the bridge published
everything, so a converted module usually exports fewer names than it used
to publish. Global count across the layer is now 310, from 334 when the
ratchet landed.

### Where this stops, and why

Six providers converted, 799 → 657 (**18%**). The pure-provider list is now
empty, and the remaining 657 references are not more of the same work.

They are concentrated in files that are **consumers**, not providers:
`world-feed.jsx` (165), `daily-split.jsx` (79), `app-shell.jsx` (51),
`mirror-field-pops.jsx` (33), `map-tab.jsx` (30), `test-overlay.jsx` (27).
Their providers are the cycle cluster — `test-definitions.js`,
`passive-progress.js`, and `daily-split.jsx` itself, which is both. An ESM
cycle fails at render with a temporal-dead-zone error, and a render-time
failure in ported JSX is precisely this layer's worst bug class and the
reason four guards exist.

So the next step is **not** another conversion. It is the extraction this
record already names: `passive-progress` and `test-definitions` are a store
and a schema, neither needs JSX, and moving them to `data/` as typed tested
modules dissolves both cycles as a side effect. That is a different size of
change and wants planning, not momentum.

**What the six conversions actually bought**, stated plainly so the next
decision is made on evidence:

- Three live load-order landmines removed — module-scope reads behind
  presence guards, where reordering `spec-index.js` would have silently
  dropped a feature with no error: `map-branches.js` (seven map
  categories), `duels-data.js` (circle changes rippling into duos and
  groups), and `world-feed-data.js`'s pool ordering, which is now a
  dependency rather than a comment.
- Three defects in the gate itself: the `h(Foo, …)` blind spot, the
  multi-writer mis-attribution that overcounted by 11, and the
  declarator-list local-name miss.
- 24 dead load-order guards deleted, and 24 names off `window`.
- **No behaviour change, no bundle saving, no user-visible effect.** Entry
  chunk moved 858 → ~790 KB and total JS did not move at all; that is
  chunking, not weight.

The honest read: this was worth doing at the price it cost, because each
conversion was an afternoon and each surfaced something real. The next
tranche costs considerably more and surfaces less, and this project's
binding constraint is a launch checklist with unticked device verification,
not the elegance of its module graph. The ratchet is what makes stopping
safe — the number cannot go back up, so the work can resume opportunistically
(**convert on touch**: when a feature takes you into a spec file, convert
the providers it reads first) rather than as a project.

## D40 · Duels get a content lane and a question-level signal

**Date:** 2026-08-03 · **Status:** Adopted (owner-directed, 2026-08-06 —
"do the D40 duel lane"; what shipped and the deltas from this proposal
are in the D40 adoption record at the end of this file)

**Proposal.** Give the group/1v1 duel banks what every other content
surface already has: a growth path (a lane under `docs/QUESTION-FARM.md`
governance) and a feedback signal (a k-floored, cross-group,
question-level aggregate written at reveal time). Four separately
adoptable parts, smallest first.

**Why duels, and why now — the arithmetic.** The 1v1 bank is 20
questions and live rotation is `bank[(hash(gid) + utcDay) % len]`
(`duelQFor`, `src/v2/data/deck.ts`): an active pair sees the whole pool
in 20 days and repeats from day 21. Groups: 24 questions, repeats from
day 25. Compare the daily surface: 90 questions (~13 weeks of runway
with zero promotion, D30), a daily farm lane, a scorecard (D33), and a
promotion path. Duels are the surface whose streak mechanics most
reward daily return, and the only one with no lane, no signal, and no
growth path — before 2026-08-03 the word "duel" did not appear in
QUESTION-FARM.md at all. Meanwhile 20 finished romantic-mode 1v1
questions (`DUO_QS_ROMANTIC`, `src/v2/spec/duels-data.js`) sit
spec-only, unreachable by the live app.

### Part 1 — single-source banks (the read side is taken)

`src/v2/spec/duels-data.js` now imports `content/duel-questions.json`
for `GROUP_QS`/`DUO_QS` instead of carrying hand-duplicated copies —
the D32 learn-data shape, landed alongside this record after verifying
the spec arrays were byte-identical to the JSON (group) or identical
minus the seed's `id` fields (1v1, which the demo never reads: its duo
state keys on the partner, not the question). This is a pure
consolidation, no behavior change, and it is the precondition for any
lane: a lane that writes two copies of a bank is a drift generator.

### Part 2 — a duel lane (single gate, learn-style)

`content/duel-questions.json` seeds production on the next reseed, so —
exactly as D32 recorded for learn cards — a merged duel-question PR IS
the production review; one gate, production-level bar. Lane rules on
adoption (to be written into QUESTION-FARM.md as the contract):
budget-capped (suggest ≤4/run, at most weekly to start), append-only at
the end of each array (group order is rotation order — interleaved,
never sorted; 1v1 order is the spec ladder's light → deep, so deep
questions append naturally), ids continue each series, and every farm
hard rule inherits: dedup against both banks, the product's voice, no
place-scoped questions, PR-only output, run log on issue #31. Duel-bank
growth shifts future rotation only (D30: reveal docs store the answered
qid, so history never remaps).

### Part 3 — the signal (the real decision in this record)

Duel answers never reach `v2_question_aggs` — the aggregate trigger
short-circuits group/duo answers into the sealed reveal path
(`functions/src/v2.ts`), which is correct and stays. The proposal is a
separate, deliberately smaller aggregate written where the answers are
already being read anyway: at reveal time, `revealGroupDay` increments
a per-question document — plays, per-option counts, and for 1v1 the
guess-match count — aggregated across ALL groups, k-floored with the
same `AGG_MIN_N`/`tooSmall` discipline as every published number.

What it may never contain: gids, uids, names, member sets, per-group
anything, or anything below the floor. The privacy arithmetic: every
input is a vote the group's own members already see with names attached
at reveal; the aggregate is strictly less revealing than the reveal
itself, summed across groups and floored — the same "the floor did the
privacy work" argument D33 recorded for the scorecard. The cost
arithmetic: zero extra reads (the reveal transaction already holds
every counted answer) and one extra doc write per group per day.

The guess-match rate is the duel analogue of evenness: matches near
100% mean no tension (a dead duel question), matches near chance mean
the question has no tells (noise) — the good zone is the band between,
"guessable if you truly know them" as a number. With this doc in
`v2_question_aggs` (namespaced ids, e.g. `duel-<qid>`) the scorecard's
`--fetch` already downloads it; scoring duels becomes a small
`score()` extension, and the lane in Part 2 gets leaders and laggards
on day one.

### Part 4 — graduate the romantic pool

Move `DUO_QS_ROMANTIC` into `content/duel-questions.json` under a
`mode: 'romantic'` field, seed it, and let the live 1v1 select its pool
by the pair's chosen mode (the spec layer's `duoMode`/`setDuoMode` is
the reference behavior; live needs a mode on the duo doc and a picker
in `LiveDuelPanel`). Until the mode plumbing exists, romantic entries
must NOT be appended to the shared pool — they would rotate into
friend-pair duels. This part doubles the 1v1 bank with content that is
already written and reviewed.

**What stays true until adoption.** QUESTION-FARM.md hard rule 2 stands:
no scheduled run touches `content/duel-questions.json`; no duel
aggregate exists; the romantic pool stays spec-only. Part 1 alone is
live, because it changes no behavior and closes a real drift seam.

**Alternatives considered.** Mining the sealed reveal docs offline for
question quality — rejected: it needs production credentials and reads
group-scoped documents, exactly what the committed-scorecard shape
(D33) exists to avoid. Client-side duel telemetry — rejected: the
skip/pass line (a pass is local-only; server collection is a privacy
decision this record does not make). Doing nothing — rejected with the
runway numbers above: repeats begin on day 21 for precisely the
most-engaged pairs.

## D41 · The two stores' account types are decided separately — Play as an organization, Apple as an individual

**Date:** 2026-08-03 · **Status:** Adopted (owner-confirmed — the closed-testing
path was rejected outright, and this write-up requested in the same exchange)

**Decision.** The Google Play Console account is opened as an
**organization** account, backed by a Norwegian enkeltpersonforetak (ENK)
and a D-U-N-S number. The Apple Developer Program enrollment stays an
**individual** enrollment (LAUNCH-RUNBOOK 1.1, unchanged). The account
type is decided per store, not once for both.

**Why.** Google's closed-testing requirement — 12 opted-in testers for 14
continuous days before a production-access application, itself reviewed in
up to ~7 days — binds **personal** developer accounts created on or after
2023-11-13. Organization accounts, verified with a D-U-N-S number, are
exempt from it entirely. There is no waiver, no small-developer carve-out,
and no appeal, so the account type at creation is the whole decision.

**The arithmetic.**

| | Personal | Organization |
| --- | --- | --- |
| Closed testing | 14 continuous days, 12 testers who install *and stay opted in* | none |
| Production access review | up to ~7 days | up to ~7 days |
| Setup before either | none | ENK registration + D-U-N-S + Google's org verification |
| Realistic total | 3–4 weeks | 1–3 weeks |
| How it fails | a tester uninstalls on day 11 and the clock restarts | waiting, but nothing resets |

The organization path is not reliably *faster* in the worst case — a
D-U-N-S is free but D&B quotes up to ~30 business days, commonly ~1–2
weeks. It is better on two axes that matter more than the median: the wait
is parallelizable dead time rather than active recruiting, and it has no
reset condition. The 14 days are *continuous*; dropping below 12 opted-in
testers restarts them, which makes the personal path's 3–4 weeks a floor
rather than an estimate.

**The correction this record makes.** SHIP-CHECKLIST §3 read "launching as
a sole trader was chosen instead (LAUNCH-RUNBOOK 1.1 — enrolling as an
organization first costs 1–2 weeks of D-U-N-S verification for nothing
launch needs)". That reasoning is sound and stays true **for Apple**, where
an organization enrollment buys nothing launch needs. It was then carried
across to Play as if it settled both stores. On Play the same 1–2 weeks buy
the removal of a 3–4 week gate, so the trade inverts. Two stores, two
answers, one sentence that had only considered one of them.

**Do not open a personal account first.** Sources disagree on whether Play
Console supports converting personal → organization at all; the ones that
say it does disagree on whether the testing requirement follows the
converted account. The clean move is to pick organization at creation,
which makes the question moot. The account had not been opened when this
was decided (LAUNCH-RUNBOOK 1.2 unchecked), so the option was free — it
would not have been a week later, where the fallback is a second account
plus an app transfer.

**Precondition, and what it does not change.** An ENK is registered by
notifying Brønnøysundregistrene via Altinn; registration in Enhetsregisteret
is free and yields an organisasjonsnummer, which is what a D-U-N-S
application needs. An ENK is not a separate legal person — the operator is
still Olaf Taule — so `web/terms.html`'s operator and jurisdiction values
stand as written. **If the ENK is registered under a business name, revisit
that page**: the operator line should then name the entity a user would
actually be contracting with, and `check:store-copy` cannot see the
difference between a correct name and a stale one.

**Alternatives considered.**

- **Tester-exchange groups and paid tester farms** — rejected. They exist,
  Google actively polices them, and the downside is account termination:
  a bet that risks the account to save 14 days on it.
- **Open testing instead of closed** — rejected as unavailable, not as
  unattractive. The requirement names closed testing specifically; an open
  track does not satisfy it.
- **An existing pre-2023-11-13 developer account** — genuinely exempt, and
  the cheapest path if one exists. Checked and none is held; recorded so
  the option is not rediscovered as new.
- **Shipping iOS first and deciding Play later** — not an alternative but a
  fact that holds under either choice, and the reason this decision is not
  urgent for the iOS date. Apple has no equivalent gate; iOS can be live in
  ~2 weeks regardless.

**Sourcing, stated because it is weaker than this file's norm.** Google's
own support pages could not be read directly — the network policy of the
environment this was researched from returned 403 at the proxy for every
outbound host — so the exemption and the timelines come from search results
and secondary write-ups, not from the primary policy page. That is enough
to choose an account type at creation, when the choice is free; it is not
enough to spend money on. **Confirm the exemption in the Play Console
account-type flow before paying for a D-U-N-S expedite**, and if it turns
out not to hold, the fallback is the 12×14 path with nothing lost but a
wait that overlapped Apple's anyway.

## D42 · InSight launches on iOS alone; Play is deferred, and the path to it gets cheaper while it waits

**Date:** 2026-08-04 · **Status:** Adopted (owner-confirmed: "iphone only
launch is fine for now")

**Decision.** Ship the App Store first and alone. Google Play is deferred
indefinitely and revisited **after** iOS has an installed base, not on a
date. No ENK is registered, no D-U-N-S applied for, and no Play Console
account opened until that review says to.

**Why, and this is the part that is not obvious.** The two routes onto
Play have costs that move in **opposite directions over time**, so
deferring is not merely postponing a bill:

- The **organization route** (D41) costs the same whenever it is taken:
  an ENK, a D-U-N-S wait, and the ongoing obligation of being a
  registered business. Constant.
- The **12 testers × 14 continuous days** route is brutal *cold* — twelve
  people who install and stay opted in, where a drop below twelve
  restarts the clock — and easy once the product has users, some of whom
  carry Android phones and will ask to be let in. **Decaying.**

So a launch that finds an audience may convert the expensive option into
the cheap one and retire D41 unused. A launch that does not find one
saves the cost entirely. Deferring is the dominant move in both branches,
which is why this record exists rather than a date.

**What this does to D41.** Not reversed — **made conditional**. If Play is
opened *before* there is an installed base, organization is still the
right account type and everything in that record stands. If it is opened
*after*, the closed-testing gate may already be satisfiable by asking
existing users, and the organization account becomes optional rather than
the point. Re-read D41 at that moment; do not assume either half.

**The arithmetic, verified 2026-08-04** (searched, not recalled — the
sources are linked at the foot of LAUNCH-RUNBOOK.md):

| Item | Cost | When required |
| --- | --- | --- |
| Enhetsregisteret (the organisasjonsnummer) | free, via Altinn | always, for an ENK |
| Foretaksregisteret | 2,832 kr, or 3,883 kr filed with the above | only for resale of purchased goods, or 5+ employees |
| D-U-N-S | free (5–30 business days; paid expedite ≈8) | for a Play organization account |
| Play Console | $25 one-time | — |

An app resells no purchased goods, so the cash cost of the whole deferred
path is about **$25**, not thousands. That is worth writing down plainly
because "moderately costly" was the reason for deferring, and the fees are
not where the cost lives. **The cost is the ongoing one**: an ENK obliges
an annual business filing whether or not it earns. VAT does not enter yet
— the threshold is NOK 50,000 of turnover over a rolling 12 months, and
docs/MONETIZATION.md records that launch has no consumer paid tier and
"nothing in this document needs to earn before the product is proven."

**One link in that chain is unverified, and it is the load-bearing one.**
Whether Google's organization verification accepts an
Enhetsregisteret-only ENK, or wants what Foretaksregisteret provides. If
it wants the latter, the free path collapses into the fee-bearing one and
the table above is wrong by ~3,000 kr. Check it in the Play Console
account-type flow before spending anything. Nothing turns on it today,
which is exactly why it is recorded rather than resolved.

**What the deferral costs, stated so none of it arrives as a surprise:**

- `npm run check:store-copy` keeps reporting the
  `REPLACE_WITH_PLAY_SIGNING_SHA256` placeholder in
  `web/.well-known/assetlinks.json`. That is now a **known permanent
  non-blocker**, not an unfinished task — and the reason that check is
  deliberately not in CI.
- Android users tapping a `/join/CODE` link get the hosted fallback page.
  Already the designed behaviour; with no Android app it is simply the
  only behaviour.
- The Android shell stays in CI (`android-build`, `native-sync-drift`) so
  it cannot rot while parked. **Do not remove those jobs to tidy up** —
  the whole value of parking rather than deleting is that the shell still
  compiles on the day this is revisited.
- `check:versions` keeps `versionCode` in lockstep with an app nobody is
  shipping. Harmless, and cheaper than special-casing it.

**What it does not cost.** Nothing on the iOS path. Apple has no testing
gate; enrollment is ~1–2 days and review usually 24–48h. The iOS date was
never a function of Play's.

**Alternatives considered.** Registering the ENK now "to have the option"
— rejected: it buys an option whose value falls the longer it is unused,
at the price of a permanent filing obligation. A personal Play account
now, converting later — rejected in D41 and still rejected: conversion
support is disputed and the fallback is a second account plus an app
transfer. Shipping both stores simultaneously — rejected as the thing
this whole record is about: it puts a 3–4 week Android floor in front of
an iOS build that is otherwise ~2 weeks out.

---

## D43 · The v17 sync: what the prototype won, and what this repo kept

**Decided:** 2026-08-04 · **Status:** binding

`design/InSight_standalone_17.html` supersedes v15. The sync was done as a
**three-way merge**, not a re-port: v15 as the base, v17 as theirs, the
tree as ours. That is the only method that can answer the question this
repo actually has — *which* of two differences is the change, and which is
a decision already made here. 59 of the 79 spec modules merged clean; the
20 that conflicted are the ones below.

### What v17 changes

**Navigation.** The daily's three modes leave the header and become a
ruler in flow — World · Circle · 1v1, the same graduated axis the Mirror
wears. Scroll past it and it docks into the header, crossfading with the
wordmark. `navMode` keeps the other two shapes the prototype ships for
comparison (`pill`, the old header switcher; `bar`, a flat four-item bar
with new group/1v1 glyphs). The axis runs past its far end into the
Mirror, and the Mirror swipes back onto 1v1.

**Colour.** Every accent drops `oklch(0.55 …)` → `0.52` (gold `0.53`),
`--ink-3` `0.55` → `0.51`, and `--ochre-ink` / `--accent-ink` arrive for
hues that carry text. World's topic hues now pass through a per-hue
lightness/chroma ramp (`world-palette.js`) measured against the sRGB
boundary.

**Nine new modules**, six of them pure side effects that install one
document listener each: haptics, swipe-back, sheet-escape, sheet-drag,
scroll-memory, edge-fade — plus `world-palette.js`, `explain-sheet.jsx`
(one ⓘ sheet for every instrument) and `read-run.jsx`.

Plus: motion on one `--rv-step` constant, signature-derived type marks,
tests that open their saved result, per-domain 1v1 records, duel tiles
that take photography, and a circle map that collapses to drillable discs
past ~72 people.

### What this repo kept — the twenty conflicts, and the rule behind them

The rule is: **v17 wins on design, this repo wins on enforcement, and
neither wins by default.** Concretely —

| Kept from this tree | Because |
| --- | --- |
| `renderDuel`'s `shares` gate (world-feed) | v17 rewrote the tile around `mine != null`; the fill height IS the share, so both it and the numeral stay gated on the k-anon floor (D1). The new band and riding numeral are v17's. |
| Every live-mode branch in `mirror-tab` | v17 restructured the tab so ONE ruler spans every stop. The four live bodies (D1/D9/D3) were rewritten to pick a *body* instead of returning their own frame — same structure, same guarantees. |
| `mirrorStops(live)` dropping the City stop | D9. v17 has no live mode to drop it for. |
| The `blank` "no reading yet" state (lens-cards) | Live mode has no typical-person prior; drawing null as 0 is a false claim. v17's ⓘ row sits above it. |
| `useDialog` / `Sheet` (D24) | `explain-sheet.jsx` is built on the primitive rather than the prototype's hand-rolled scrim, so the new sheet arrives with the focus trap and Escape the other seven have. |
| `<button>` conversions (D26's a11y pass) | v17 re-divs three of them. Two stay buttons. The **third** — the test picker card — becomes v17's `role="button"` div on purpose: v17 nests the ⓘ inside it, and a button cannot nest in a button. `tabIndex` + `onKeyDown` keep it reachable, and check:a11y is unmoved at 11. |
| `--surface-a` at 98%, blur `saturate(1.4)`, a 320px ground wash | This app's quieter ground. v17 touches none of them; style-diff's header now lists them so nobody chases them as misses. |
| No `Bar` / `Pill` / `InterestRun` / `PoliticsCompass` / `Compass2D` | D26 deleted them as dead. v17 deletes the last two itself — convergent. v17's edit to `.bar > i` therefore has nothing here to apply to. |
| `DUO_QS` from `content/duel-questions.json` | D32's single source. v17's new `d:` (domain) field was added to the JSON, where the live seed reads it too. |
| The 15-question Social test tag | Repo content. Only v17's accent moved. |

**One prototype bug was not copied.** v17 inserts the per-domain tally
between `if (day.byRight) readBy.right++;` and its `else`, which orphans
the `else` onto the new `if (dm)` — so `impressions()` would fill with
every day whose question had no domain instead of every day they misread
you. Fixed here with braces, and the reason is in the code.

### The ratchet went down, not up

D39's rule 4 only moves down, and a sync that adds nine modules is exactly
where it would otherwise be argued with. Nine providers converted on touch
instead: `tweaks-panel`, `archetype-data`, `reveal-clock`, `vote-cuts`,
`relmap-core`, `type-marks`, `result-card`, `mirror-field`,
`person-mindmap` (plus `DuoDomains` out of duo-daily). All nine new modules
publish **named exports**, not globals.

Two settings were inverted rather than converted: the prototype has
`world-palette.js` and `type-marks.jsx` read `window.IS_WPAL` /
`window.IS_MARK_STYLE`; here the shell **pushes** them in (`WPAL.setMode`,
`setMarkStyle`). Same for `window.NAV_AT`, which became `markNav()` /
`navCoasting()` in `swipe-back.js` — the module that owns the gesture owns
its coast timer. A setting is not a module reference, and making it one is
how a global bridge grows back.

**657 → 620 across 52 files.**

### What now proves it

`smoke.test.jsx` gained three cases for the nav, because it is the only
gate that executes a render and every other one is name-level: the ruler is
a tab list under either nav, so `check:globals` and `tsc` cannot tell the
shapes apart, and `data-view` is a string nothing type-checks. All three
were mutation-checked — forcing `ruler={false}` fails the first two.

Verified in a browser as well as in jsdom: the ruler docks on scroll,
edge-fade sets `data-ef` on the profile subnav, the ⓘ sheet opens and
Escape closes it, and the console is clean.

**What this does not cover.** `scripts/style-diff.mjs` now points at v17
but has not been run against it — it needs a browser and a dev server, and
its output is a report to read rather than a gate to pass. The screenshots
above are a smoke check, not that comparison. Running it is the next
cheap thing anyone touching this layer can do.

---

## D44 · Political items never slice — the split publishes, the cross-tab does not

**Date:** 2026-08-05 · **Status:** Adopted

**Decision.** `onV2AnswerCreated` does not fold anchors for any question the
shipped bank marks `test: "political"`. The plain option counts still
publish under the same k-floor as every other question; what is withheld is
the per-anchor breakdown. `POLITICAL_QIDS` in `functions/src/v2.ts` derives
the set from `V2_QUESTIONS` at module load, `slicesDemographics()` is the
predicate, and `functions/src/slicing.test.ts` asserts it against the bank
in both directions.

**What was actually happening.** The eighteen political items ship with
`surface: "test"`. `deck.ts` routes `surface === "test"` into the live feed
alongside `surface === "feed"`, so they are answered as ordinary cards. The
trigger's vote path returns early only for `group`/`duo`, so a political
answer reached `foldAnchors` like any other and folded across all six
breakdown dimensions — ageBand, gender, city, country, education,
relationship. Past the floor those cells publish to
`v2_question_aggs/{qid}`, which `firestore.rules` opens to every signed-in
user. "Markets, left to themselves, distribute fairly" was therefore
published split by city and by education.

**Why this is a contradiction and not merely a risk.** D8 treats political
data as Art. 9 special-category throughout, and `docs/data-inventory.md` —
the document the store privacy forms are answered from — says of it: "never
sliced by, never published, and never leave the owner doc". That row is
scoped to the computed *result vector*, which was and remains owner-only,
so the sentence was not false. It was also not the whole picture: the item
answers the vector is computed from were being sliced by five
quasi-identifiers and published. A reader of that row could not have known,
which is the property that makes it worth a record rather than a commit.

**The arithmetic of what is given up.** Eighteen of 369 questions lose their
breakdown. Nothing else moves: the split, the totals and the underdog line
are the product's actual claim on the daily and feed surfaces and they all
still publish. The other 48 `surface: "test"` items — big5, values,
attachment — continue to slice, and the Mirror's cohort views are built on
that. A guard keyed on the *surface* instead of the marker would have
silently taken those 48 with it, which is why the predicate keys on
`test === "political"` and why the test asserts the non-political items on
that surface still slice.

**Alternatives rejected.**

- *Stop attaching anchors client-side.* The anchors snapshot on a political
  answer is owner-only, so it leaks nothing where it sits, and rules can
  enforce a length but not an absence-of-intent. Enforcement belongs where
  the publish happens — the same reasoning as everywhere else in this file.
- *Suppress at publish time only.* The private doc would still accumulate
  the cross-tab. "Never sliced" should mean never computed, not computed
  and withheld.
- *Read the question doc per answer to check the marker.* The vote path's
  design is that it never reads the question doc — the catalog path's single
  read is the documented exception, and D7's write ceiling is why. Deriving
  the set from the bank already imported for the seed costs one pass over
  369 questions at cold start and no read on the hot path.

**Self-healing, deliberately.** The guard reads `{}` rather than the stored
map, and `privRef` is written with `merge: false`, so the next answer to a
political question also *erases* any breakdown a pre-guard deploy folded.
Nothing has shipped, so there is none — but the property costs one ternary
and means this fix never needs a migration if that stops being true.

**`docs/data-inventory.md` gains a row for the item answers** rather than
having the results row reworded. They are different data with different
handling, and collapsing them is how the gap hid in the first place.

---

## D45 · Erasure follows the reveal, not the membership — and leaving a group is not an erasure request

**Date:** 2026-08-05 · **Status:** Adopted

**Decision.** `deleteAccount` scrubs a uid out of reveals with a
collection-group query on `reveals.members`, in its own phase (1c-bis),
independent of group membership. `leaveGroupV2` continues to leave reveals
alone.

**The gap.** Phase 1c found groups with
`where("memberUids", "array-contains", uid)` and scrubbed reveals by walking
that group's subcollection. `leaveGroupV2` removes the uid from `memberUids`
and `memberNames` and stops. So for any group the account had already left,
phase 1c could not see the group at all, and the reveal kept
`votes.{uid}`, `names.{uid}` and the uid inside `members` — the display name
and the votes, permanently, still readable by whoever stayed, because the
reveal read rule grants every uid listed in `members`. A right-to-erasure
break reachable by two ordinary taps in the ordinary order.

**Why leaving still does not scrub.** A reveal is several people's record of
a day they all played. Leaving a group is not a request to be forgotten; it
is a request to stop receiving it. Scrubbing on leave would rewrite the
remaining members' history, on an action the UI does not present as
destructive. The comment justifying removal of the uid from `members` during
*deletion* — that it costs the deleted user read access to a reveal they can
no longer authenticate for anyway — is true of a deleted account and false
of a member who left. The two paths differ on purpose, and
`e2e-delete-account.mjs` now asserts both halves: that leaving removes the
membership, and that leaving leaves the reveal intact.

**Why the collection-group query rather than making leave scrub.**
Membership is the wrong thing to follow, and scrub-on-leave would still have
followed it: it closes the path through `leaveGroupV2` and leaves open every
other way a uid ends up in a reveal it is no longer a member of — including
the reveals already orphaned by leaves that happened before the fix. Asking
the reveals directly is membership-independent by construction. The cost is
one field override (`reveals.members`, COLLECTION_GROUP / CONTAINS) in
`firestore.indexes.json`, deployed by the existing `--only
firestore:indexes`, and it is the same index dependency phases 3 and 4
already carry.

**Both phases stay, because they miss different things.** The first draft
of this replaced 1c's per-group reveal loop with the sweep. That is a
regression: a query on `members` cannot see a reveal that has no `members`
field, and those exist as a category — D5's backfill amendment reasons the
set to provably empty in production *today* and explicitly asks for it to be
re-checked before seeding. Walking a group's subcollection sees them;
querying by membership snapshot does not. The converse is the gap this
record is about. So 1c keeps its loop for current groups and 1c-bis sweeps
the rest, and they do not double-write: 1c removes the uid from `members`,
so everything it reaches stops matching 1c-bis's filter before 1c-bis runs.

**The loop has no cursor, and that is load-bearing.** The scrub removes the
uid from `members`, the field the query filters on, so each pass returns
only what the previous pass has not reached and the loop drains naturally.
Verified against the Firestore emulator rather than reasoned about: three
reveals across two parent groups, one of them a group the user had left,
drained in a single pass, scrubbed the uid and nothing else, left the
surviving member's vote, name and read access untouched, and a second sweep
found nothing. That last one is the property that makes the phase idempotent
— which matters, because the "Deletion incomplete, please retry" path
invites exactly that retry.

**`PASS_CAP = 500` is a runaway guard, not a bound on the work.** It fires
when the query keeps returning documents the scrub claims to have fixed,
i.e. when writes are not landing, and that has to be loud rather than an
infinite loop against the function timeout. Legitimate work sits far below
it: MEMBERSHIP_CAP is 20 groups at one reveal per day, so 500 passes of 400
is about 27 years of daily duels in every group at once. Sizing it to
"enough for a plausible account" would turn a long-lived account's erasure
into a job that fails identically forever — the same failure the page size
was chosen to avoid.

**What is still not gated.** Nothing checks that a collection-group query
has its index committed; the emulator creates whatever a query asks for, so
the e2e is green either way (`v2social.ts` says as much about its own
queries). The index is committed and on the deploy path, so this is a
standing hazard rather than a live one — and it is the third
collection-group query in `deleteAccount` to carry it.

---

## D46 · The release build's JavaScript half gets the proof its native half already had

**Date:** 2026-08-05 · **Status:** Adopted

**Decision.** `ios-release.yml` builds the web bundle with the production
`VITE_*` environment and runs `npm run check:web-firebase` against `dist/`
before `cap sync`. The Firebase web values are repository **Variables**, not
Secrets.

**What was shipping.** `grep -rn VITE_ .github/` returned nothing across all
six workflows, and `.env` is gitignored, so the release job's `npm run
build` ran with an empty config. `firebaseEnabled` in `src/lib/firebase.ts`
requires four non-empty values; without them `initLive()` returns early and
the app renders the demo deck. The archive that was signed and uploaded to
App Store Connect was therefore the mock-mode demo app — it builds, signs,
uploads, installs, and shows whoever installs it a set of questions nobody
else can see.

**The shape of the miss is the point.** The step immediately below writes
`GoogleService-Info.plist` from a secret, `base64 --decode`s it, runs
`plutil -lint` on the result and prints a key back out, with a comment
saying its absence "is silent in the worst way: the app builds, signs,
uploads, installs, and has no Firebase". That is a precise description of
the failure — and the native plist was the half that was guarded twice while
the JavaScript half, which is what actually talks to Firestore, had no check
at all. The mental model was "Firebase config is a native concern".

**Why the check reads `dist/` and not the environment.** Asserting the
variables are set proves the shell has them, not that the build on disk was
produced with them. Vite inlines `import.meta.env.VITE_X` at build time, so
the honest test is that each required value appears verbatim in the emitted
JavaScript — which a stale `dist/` from a reordered step fails even when the
environment is perfect. Verified by running it against all four states: no
env (fails), env set with a stale build (fails on not-inlined), correct
native build (passes), and `VITE_USE_EMULATOR=true` (fails).

**`CAPACITOR_BUILD=1` was already required and nobody was setting it
either.** `vite.config.ts` refuses a production build that has Firebase
configured but no reCAPTCHA site key, unless that flag marks it a native
bundle — iOS attests through DeviceCheck / App Attest and never reads the
key. The guard had never fired because no release build had ever had a
Firebase config to trip it.

**Variables rather than Secrets**, on the reasoning `APPLE_TEAM_ID` already
carries in this workflow: the Firebase web keys identify a project rather
than authorise anything, they ship inside every binary, and access control
lives in `firestore.rules`. Storing a public value as a secret only makes it
harder to read in a log when a build goes wrong.

**Not wired into `ci.yml`.** PR builds have no production config and should
not need one. This belongs on release paths, next to the plist check it
mirrors — and `check:web-firebase` fails loudly when run without an
environment, which is correct for a release gate and wrong for a PR.

## D47 · Monitoring grows a decision console — and the refusals become part of it

**Date:** 2026-08-04 · **Status:** Adopted (owner-requested: "increase the
scope of the monitoring to include cost and profits and other stats, along
with algorithm effect, question generation stats, user analysis, and have it
presented in some sort of visual tool to help me make decisions")

**Decision.** `npm run pulse` computes a four-panel decision console from
committed artifacts and renders it as one self-contained HTML page.
`monitoring/pulse.json` is committed (the data, so a change in the burn or
the runway is a reviewable diff); `monitoring/pulse-trail.jsonl` appends one
row per day; the HTML is gitignored and regenerated in under a second. The
full argument is [`docs/MONITORING.md`](MONITORING.md).

**The part that needed deciding.** Three of the four requests — cost,
money, question-pipeline stats — are ordinary engineering. The fourth,
"user analysis", is not available here, and the decision is that **the
console displays the refusals rather than omitting them.**

Five things a monitoring dashboard would normally show are structurally
unavailable: per-user funnels and session analytics (no client event
pipeline exists, by design), retention or engagement sliced by anchor
(D8/D18's k-floor and complementary suppression), anything sliced by
political result (D8, Art. 9), skip/pass rates (QUESTION-FARM's out-of-scope
list), and per-user content selection (MONETIZATION's standing posture).
A console that showed four empty charts where those belong would read as
"the data is coming". Each is listed with the record it would reverse,
because "we decided not to" is only useful with the decision attached.

The second row is the one worth sitting with: **the same suppression that
stops a paying city identifying a person stops the owner doing it.** That is
the guarantee working. If the tooling ever grows a way around it, the
guarantee was never enforced.

**What is honestly available, and was built.** The k-floored public mirror
gives floors on real activity — never measurements, since a question below
`AGG_MIN_N` publishes nothing. Everything else in the console computes from
committed files with no credentials: bank inventory, deck runway, promotion
backlog, alert coverage, and the modelled bill.

**What is available and was deliberately NOT built.** DAU and D1–D7
retention need **no new collection**: `v2_agg_events` already holds
`(qid, uid, at)` with a 90-day TTL, erased with the account. Counting
distinct uids per day is a scheduled function over a collection that exists.
But D28 justified that collection as fake-account attribution and trigger
dedup — those two purposes. Counting users with it is a **new purpose for
existing data**, which is a decision record, not a script. It is listed in
the console's "unbuilt" column with that catch stated. Deferred here rather
than taken, because the console's whole point is to make this class of thing
visible rather than to quietly do it.

**The one number whose neglect breaks the product.** Deck runway. D30's
no-wrap invariant holds while the daily bank has at least as many questions
as days elapsed since `DECK_EPOCH`; past zero the next reseed silently
remaps every user's answered history once. `deck.test.ts` pins the property,
but a unit test cannot know today's date relative to the shipped bank — that
is a fact about the calendar and the content, and it changes at midnight
without a commit. At adoption: 90 in the bank, 3 days elapsed, 87 days of
runway, 0 unpromoted in the archive.

**`--check` is a real gate, and it runs on a clock rather than on a diff.**
It exits non-zero below 21 days of runway and on an expired scorecard.
Putting it in a pull-request check would fail unrelated work on a Tuesday
for a reason that pull request cannot fix — the same argument that keeps
`check:figures` off the backend path, pointed the other way. A check whose
subject changes on its own belongs on a schedule, which is the split
`security-audit.yml` already makes for `npm audit`.

`.github/workflows/pulse.yml` (added 2026-08-04, on the owner's answer to
"does it update automatically?" — it did not) runs at 06:00 UTC daily,
commits `pulse.json` and the trail only when they moved, writes the headline
figures to the run summary, and runs `--check` **last** so a bad day still
gets its trail row before the job goes red. It never runs `npm ci`: pulse is
Node stdlib only, verified in a dependency-free clone, because a console
whose job is to report that the ground moved must not be able to fail
because a registry did. Scheduled workflows only run from the default
branch, so it is inert until merged.

**One structural change to existing code, and it was forced.** The cost
arithmetic moved from `scripts/cost-model.mjs` into `scripts/cost-arith.mjs`
so the console and the CLI share one model. The alternative was a second
copy of the price sheet, which is the drift this repo gates against
everywhere else. Same shape as `store-render.mjs`. `npm run costs` output is
byte-identical in both price regions — diffed, not inspected.

**A correction this record makes.** `docs/DEPLOYMENT.md` explains that alert
policies are applied by hand because "the deploy service account has no
monitoring role". Line 103 of the same document says that account holds
`Editor` + `Firebase Admin`, and `Editor` includes
`monitoring.alertPolicies.create`. The stated reason does not hold. The
conclusion still does, for two better ones: a policy is useless without a
notification channel id, which is not in the repo and should not be; and a
pipeline that can silently rewrite an alert policy can silently delete one.
The console therefore reports policies as *committed*, never as *deployed* —
the repo cannot know which.

**Recorded, not fixed.** 1 of 14 deployed functions has an alert policy, and
three of COSTS.md's four walls have no instrument. Both are surfaced by the
console rather than closed here: the uncovered functions are mostly
callables, which fail loudly to a caller who can notice, and the walls with
no instrument bind at sizes this product has not approached.
`onV2AnswerCreated` is alerted precisely because it is the one that fails
*silently* — `retry:true` means a crash accumulates for ~7 days while the
app looks healthy.

**A defect this work found in its own input.** The console's cost panel
reads `scripts/cost-arith.mjs`, and building it surfaced that the model was
still charging every returning user a full 369-document bank refetch per
reseed — the **pre-D34** world. D34 shipped 2026-08-02: `runSeedV2` writes
only changed documents and the client pages `updatedAt > cursor`. COSTS.md's
prose said so; COSTS.md's *tables* did not, because `cost-model.mjs` had no
input for "documents changed per reseed" — only whole-bank or nothing, and
the shipped state is neither. Verified in both halves of the code before
touching the model (the seed's skip count, and `insight.bankCache.v2`'s
cursor query), then fixed with `B.changedPerReseed` (default 7 — D30's
promotion cadence) and COSTS.md's tables regenerated. Worth ~145 reads per
user per day at every size: **$18/mo → $5/mo at 5,000 DAU, $305 → $175 at
50,000, $13,215 → $11,910 at 500,000.** The remaining `staticBank` toggle now
means what it says — the *unbuilt* Hosting fix — rather than doubling as a
stand-in for the one that shipped.

That is the argument for the console in one paragraph: a number nobody looks
at goes stale in the direction of whatever was true when it was written, and
a prose correction the arithmetic beside it does not implement is the failure
`check:figures` exists for, one layer down.

**Amendment (2026-08-04, same day) — four follow-ups from a review of the
above.** Recorded rather than folded in silently, because two of them are
corrections to decisions this record made a few hours earlier.

1. **Only the trail is committed now.** `monitoring/pulse.json` was
   committed on the argument that a change in the burn should be a
   reviewable diff. But `runwayDays` moves at midnight by construction, so
   committing it meant one bot commit per day forever for a file derivable
   from the tree plus the date — and the trail already carries burn, runway
   and alert coverage, so the diff argument is served without the churn.
   `pulse.json` and the rendered page are both gitignored.

2. **The sparkline plots time, not array position.** The first version
   spaced readings evenly by index, which draws a six-week gap exactly like
   a one-day step. That is not cosmetic: GitHub disables a schedule after 60
   days of repository quiet, so the trail WILL gap, and a chart that hides
   when it stopped looking is worse than no chart. X is now the date, and a
   run of missed days gets a hairline under the stretch it covers plus a
   count in the caption.

3. **Four cost constants read from source instead of being retyped.**
   `DECK_DAYS`, `AGG_ID_CAP`, `PUBLISH_EVERY` and `HOT_TRIGGER`'s footprint
   were hand-copied into the model with the real location in a trailing
   comment — the same shape as the D34 defect this record already documents,
   left in place while fixing it. They are now parsed from `deck.ts`,
   `live.ts`, `v2.ts` and `ops.ts`, and throw loudly on a rename rather than
   falling back to whatever was true in August. `TRIG.sec` is the exception
   and cannot be read: 200 ms is an estimate of wall-clock per invocation,
   and it sits beside three hard numbers, which is worth knowing before
   tuning that object.

4. **The console has tests, and `pulse.mjs` was split to allow them.**
   Collection moved to `scripts/pulse-collect.mjs` (pure, no side effects on
   import); `pulse.mjs` is the CLI, the trail's file I/O and `--check`.
   `npm run test:scripts` covers the places where a wrong answer looks like
   a right one: the archive prompt join (which already produced a convincing
   false positive — six phantom orphans, all apostrophes), the trail's
   same-day replacement, the runway arithmetic, that the constants above
   still match their sources, that a gap draws as a gap, and the scorecard
   block — which had **never executed**, since there is no scorecard yet and
   its first run would otherwise have been launch day. On CI's lint job, not
   backend-checks: it is tooling, and nothing it says bears on whether a
   rules fix is safe to deploy.

Three known limits were written into MONITORING.md rather than fixed, all
pre-existing: `boot = 15` is a hand-counted inventory of `hydrate()`'s
queries with no single declaration to read, and is now the likeliest number
in the model to rot; the `+ 0.2` in the writes formula is unsourced; and the
deletes line assumes a Firestore TTL policy that is a hand-run command in
SHIP-CHECKLIST §5, not a deployed artifact — if it was never run, deletes
are zero and storage grows without bound.

**Second amendment (2026-08-04) — the console follows the product, not only
the clock.** Asked whether it could update as the product changes, which the
daily cron did not do: promote twelve questions at noon and the runway tile
was a day behind until the next morning.

`pulse.yml` now also runs on **every push to `main`**, so the two triggers
cover the two ways these numbers move — the clock for the changes nobody
made (the calendar eating runway, a scorecard ageing), the push for the ones
somebody did. `--check` then runs against the change that caused it rather
than against a tree that has since moved on.

**No `paths:` filter, and that is the deliberate half.** A path list would be
a hand-maintained copy of "every file pulse reads" — the content banks, the
four source files it parses constants out of, the archive, the rate card,
the alert policies, the cities header, its own scripts. This record already
documents two costs of exactly that shape of duplicate, and the failure is
the quiet one: pulse grows an input, the filter does not, and the console
stops noticing the thing it exists to notice. The job installs nothing
(Node stdlib only) and takes about twenty seconds, so running it always is
cheaper than maintaining the list that would let it run less. It cannot
loop — a push made with the default `GITHUB_TOKEN` does not trigger
workflows.

**The commit path was made race-safe, because two triggers can now overlap.**
A rejected push is no longer rebased: rebasing two runs that both wrote the
same day's row means conflicting on the same line of the same file, which is
the one case rebase cannot resolve. Instead the tree resets to the branch
head and the row is recomputed against it. The row is a pure function of the
tree and the date, so this always converges, and the losing run finds the row
already written and exits clean. Exercised with two clones racing a real
bare remote — A pushed, B was rejected, reset, recomputed, found nothing to
do; one row, one commit, no conflict.
## D48 · Three limits accepted while closing the reveal-alert, bridge and boot-state gaps

**Date:** 2026-08-06 · **Status:** Adopted

**Decision.** Three things were deferred or traded rather than solved while
landing the reveal-loop alert, the `test-definitions` / `passive-progress`
conversion, and the web boot state. Each is recorded here with what it
costs, because each is invisible in a green tree.

**1. The reveal alert cannot see "it never worked".**
`monitoring/scheduledDuelReveals-silent.json` is a metric-absence condition,
and absence needs a time series that has existed at least once — against a
metric with no points it does not fire. So the policy proves "the scheduled
scan worked and then stopped", never "the scheduled scan has never run".
The arithmetic on what it *does* cover: the schedule is every 120 minutes
and the condition is 6h, so it fires on three consecutive missed runs, well
inside the one-day window a reveal promises. The gap is the first run only,
and it is closed by a human: `npm run monitoring:apply` prints the
`gcloud logging read` that confirms a first heartbeat landed, and the
runbook says to apply this policy after observing one. **Accepted rather
than fixed** because the alternative — a synthetic canary that plays a duel
end to end on a schedule — is a second scheduled function with its own
failure modes, which is a larger thing than the gap it closes at zero users.

**2. Nothing holds the boot state's ground colour equal to the app's.**
`index.html` hard-codes `#15171c`, duplicating `html, body { background }`
at `styles.css:2100`. It cannot read the token: `styles.css` is imported by
`main.jsx`, so it arrives with the bundle whose load the boot state exists
to cover. If that ground moves and `index.html` does not, a cold start
flashes one colour into another — which is the exact defect this change
removed, reintroduced from the other side. **No gate**, deliberately: the
check would have to parse a CSS literal out of two files and compare them,
and the failure it prevents is one frame of wrong colour on a web cold
start. That is the cheapest honest statement of the trade — a gate here
costs more than the flash. Both files carry a comment naming the other.

**3. `test-definitions.js` and `passive-progress.js` stay in `spec/`.**
They came off the shared-global bridge as ordinary ESM modules
(657 → 540 references) but did **not** move to `data/` as typed, tested
modules, which is what `src/v2/README.md` had proposed. The reason the move
was proposed no longer holds: it was going to dissolve two import cycles,
and neither cycle existed (see the README section — one was never there,
the other was a multi-writer artifact of a defensive fallback in
`daily-split.jsx`, deleted with the conversion). What is left is the
ordinary benefit — types and tests. `passive-progress.js` is 77 lines of
pure arithmetic over a store (`pct`, `done`, `passiveDone`, `prefill`) with
no JSX and no test, so it is the better candidate of the two;
`test-definitions.js` is 247 lines that are mostly question banks already
pinned item-for-item against `content/tests.json` by
`test/content-parity.test.jsx`. **Deferred** because the conversion was
already an 18-file change and moving a module across the typed boundary in
the same commit would have put a refactor and a re-typing in one diff.

## D49 · The Skip control becomes a button, the alert chain gets a gate, and the feed's split stops at its arithmetic

**Date:** 2026-08-06 · **Status:** Adopted

**Decision.** Three fixes, and one of them is mostly a correction to what an
earlier survey claimed was there.

**1. The post-vote beat's Skip control is a real `<button>`.** It carried
`role="button"` and `aria-label="Skip"` — everything `check:a11y` can read —
with no `tabIndex` and no key handler. The beat is a 320px animation that
covers the result for several seconds after a vote, and Skip is the only way
past it, so the one control on screen was the one control a keyboard or
switch user could not reach. Every static gate stayed green throughout.

Landed behind an interaction test, which is D21's rule and
`dialog.test.jsx`'s precedent: `test/consequence-beat.test.jsx` pins that the
control takes focus and is a `<button>`, both mutation-checked by reverting
the element. It asserts the ELEMENT rather than a keystroke on purpose —
jsdom does not implement a button's default activation, so
`fireEvent.keyDown(el, {key:'Enter'})` produces no click however correct the
markup is. A first draft hid that behind `if (!called) click()` and passed
against the unfixed div, which is the vacuous-test shape `src/v2/README.md`
warns about. The `<button>` is what carries Enter and Space; that is what is
pinned.

The a11y baseline goes **11 → 9**. What is left is eight `no-autofocus`
findings and one `no-static-element-interactions` in `tweaks-panel.jsx`, the
host-era debug panel rather than a user surface.

**And the count was wrong before this touched it.** `src/v2/README.md` said
"six `no-autofocus` findings and three div-with-onClick sites". There were
eight autofocus findings, and the three were not three sites — they were
three RULES on one element. So work described as three deferred fixes was
one, and it took an afternoon. `check:a11y` did not catch the drift because
it holds the total and the per-file counts, not the breakdown by rule: a
figure can be gate-enforced in one dimension and stale in another.

**2. `check:monitoring` gates the alert chain, and only the half in the
repo.** Alert policies are applied by hand (D47) and nothing here can reach
Cloud Monitoring, so this does not try. It checks that every policy on disk
is in `apply-monitoring`'s list, that every condition resolves to a metric
that script creates, and that every metric's `jsonPayload.metric="X"`
selector matches a `metric: "X"` a function actually emits.

Every link fails the same silent way — the policy exists, the console is
green, and it can never fire — which is `check:deploy-targets`' failure class
with a different noun. Each of the four rules was verified by breaking that
link and watching the gate fail. On `ci.yml` rather than `backend-checks.yml`
on that workflow's own rule: nothing it says bears on whether a rules fix is
safe to deploy, and an alerting mistake must not block an emergency one.

**3. The World feed's split stops at its arithmetic, and the reason is a
measurement.** An earlier survey called `world-feed.jsx` the highest-leverage
file in the repo and said its "23 top-level definitions" meant the seams
already existed. That counted definitions without sizing them. The file is
one class component of ~2,350 lines plus about 30 helpers of 3–28 lines; the
component holds 62 methods, the largest being `render` (160),
`renderPick` (136), `renderCard` (121). There are no leaf components to lift
out — there is one god-component and a band of small functions.

Decomposing that component means threading state and callbacks through JSX
ported verbatim from the prototype, whose only coverage is a smoke mount.
That is the blind change D21's trade refuses, and it is not made safer by
being large. **Deferred**, and deliberately not attempted in the same change
as anything else.

What was taken is the part that is safe and was worth having on its own:
thirteen pure functions move to `world-feed-math.js` as real exports, with
`test/world-feed-math.test.js` behind them. `wfPcts` is why — it is the split
printed on every feed card, it adds the viewer's own vote (the other half of
`data/live.ts`'s "counts exclude the viewer" contract), and it forces the
rounded parts to sum to exactly 100 by pushing the residue onto the largest
bucket. Neither behaviour had a test.

**A note on how that suite was checked, because the first version passed a
mutation it should have caught.** Redirecting the residue to the *smallest*
bucket left all 17 tests green: the cases were `[1,1,1]` (symmetric, so both
rules pick the same bucket) and `[10,3,3]` (residue too small to move the
winner). The cases are now chosen to distinguish the two — `[1,1,4]` gives
`[17,17,66]` under max and `[16,17,67]` under min — plus the general property
those pin, that a maximal bucket stays maximal so rounding never hands the
card's headline to a side that did not win. Five mutations, five failures.

Thirteen names also leave the shared-global namespace, none of which had a
consumer outside the file: the same ratio `result-rose.jsx` found, where the
bridge published everything and a real module exports only what is wanted.
The coupling count is unchanged at 540, correctly — these were file-local
reads, not cross-module ones, and a meter that moved here would be lying.
## D50 · A lens question in a live feed is a self-report item, not a poll

**Date:** 2026-08-06 · **Status:** Adopted — the "acknowledge instead of
aggregate" half reversed by D91

> **Reversed in part by [D91](#d91--lens-questions-are-polls-the-items-are-seeded-and-their-counts-publish)
> (2026-08-11).** Option (b) below — build a real crowd — shipped: the
> lens items are seeded world questions now, and a live lens card against
> a seeded bank is an ordinary live card. Exactly as this entry planned,
> the `selfOnly` flag came off the cards whose questions gained a real
> aggregate — and only those: against a bank with no lens rows the flag
> and the acknowledgment remain, because the authored counts are still
> authored. The two repairs recorded below (the per-liveness pool rebuild
> and the purge listener) stand untouched.

**Decision.** Lens cards woven into a live session's feed carry
`selfOnly: true`, stamped by `LENS_FEED_QS`'s builder — which now rebuilds
per liveness instead of snapshotting at module scope. `world-feed.jsx`
keeps every crowd surface off a `selfOnly` card: no share fill, no
percentage numeral, no votes count, no takes/who-voted row, no consequence
beat, no with-the-majority bit into FEEDREAD, no Mirror ripple, no thin
bar on the collapsed card. After answering, the card says where the answer
actually went — "Saved to your ‹lens› lens — only you see it." — and the
answer records to the on-device store exactly as before.

**What was shipping.** `buildFeedGlobals()` (data/live.ts) replaces
`WORLD_FEED_QS` and `TEST_FEED_QS` with live-shaped cards on boot but
never touched `LENS_FEED_QS` — and every "no fake data" gate in
world-feed keys on `q.live`, which lens cards do not carry. So a real
user answering a lens card saw a split drawn over thousands of authored
votes (`count: 180 + w × 1900` per option — roughly 3–6k "votes" per
card), rendered identically to the real k-floored splits on neighbouring
cards, plus a votes-count line under it. That is fabricated activity
inside a live session — the thing D1 exists to forbid — and the asymmetry
with `TEST_FEED_QS`, which did get the live treatment, marks it as an
oversight rather than a choice.

**Two adjacent repairs in the same seam, found by the same audit.**
First: the module-scope snapshot meant live sessions always wove the DEMO
pool, which excludes each lens's seeded prefix as "already answered" —
but live mode starts every lens at zero, so ~20 of the 48 lens items were
unreachable from a live feed (`moral` capped at 4 of 8 for a feed-only
user, while the blank state promised the feed would fill it in). Second:
`LENSES.reset()` — whose own comment claims the account-deletion/uid-change
wipe contract — had no caller, so the uid-change path purged
`insight.lenses.v1` from localStorage while the store's in-memory state
survived to be written back under the new uid. The purge announces itself
now (`insight:local-purge`) and the store listens.

**Why acknowledge instead of aggregate.** The honest alternatives were
(a) suppress the fake crowd, (b) build a real one. Lens answers are
deliberately device-local (the persistence note in `lens-defs.js`): no
write leaves the device, so there is nothing for a backend to aggregate
without first reversing that decision — a new collection, its k-floor,
rules and their tests, for numbers whose product value is unproven. (a)
is the smallest change that makes the UI true, and it leaves (b) open: if
lens aggregation ever ships, the flag comes off exactly the cards whose
questions gain a real aggregate, and this entry gets its reversal note.

**Enforcement.** `src/v2/test/lens-live.test.ts` re-derives both pool
shapes from `IS_LENSES`' seed arithmetic and pins the `selfOnly` stamp
and the purge listener; `src/v2/test/smoke-live.test.jsx` mounts a live
feed with a lens card, answers it, and asserts the record landed locally
(inverted), nothing reached `LIVE.vote`, and the card shows the
acknowledgment with no split, no votes count and no engage row.

## D51 · Deleting the keys is only half the wipe: every local store hears the purge

**Date:** 2026-08-06 · **Status:** Adopted

**Decision.** Every module-scope store that persists `insight.*` state
drops its in-memory copy to the fresh-boot shape when
`insight:local-purge` fires, notifying its subscribers and **without**
calling its save — a save in the listener would re-create the key the
purge just removed. The two long-mounted components that persist state by
spreading it back (`world-feed.jsx`: votes, passed, takes, replies;
`daily-split.jsx`: dreplies, cats, testProg, votes) carry the same
listener at the component level. `scripts/check-purge-listeners.mjs`
(CI's `check:purge`) holds the set closed: a file that writes an
`insight.*` key must listen or be exempted with a reason, and a stale
exemption fails too.

**The audit that produced this.** D50 found the hole in one store
(lens-defs' uncalled `reset()`); this is the sweep of the other 28 files
that touch localStorage. Fourteen module stores had the same bug —
`feed-read`, `follows`, `learn-progress`, `learn-feed`,
`passive-progress`, `pick-data`, `place-stats`, `scenes`,
`world-subtopics`, `suggestions`, `duels-data`, `world-feed-report`,
`daily-questions`, `test-definitions` — each holding a module-scope map
whose next mutation saved the whole thing back: daily answers, duel
answers and group edits, test progress (inflating the new account's rings
with answers it never gave), authored suggestions rendered as the new
account's "You", follow lists, ratings, picks, reports, the read-room
log. The always-mounted feed and daily components had the same shape in
component state; the feed's votes already healed through its LIVE
reconcile (absent from both store and mirror → dropped), which is the
model the rest now follows.

**Fresh-boot, not empty.** The drop target is what a cold load with no
keys produces, which is not always `{}`: `follows` returns to its seed
circle, `learn-progress` to its demo stagger (empty in live builds — the
same `VITE_V2_LIVE` gate the load uses), `scenes`/`world-subtopics` to
their day-one defaults by nulling the lazy cache so `ensure()` re-derives,
and `IS_TEST_RESULTS` restores a pristine copy of the demo literal taken
before the saved-result overlay. `duels-data` and `learn-progress` got
their load normalisation extracted into one function used by both paths,
so a field added later cannot leave the listener building a stale shape.

**Exemptions, each with its reason in the script.** `live.ts` (the
dispatcher; caches uid-scoped or public), `deviceBind`/`push` (memos
carry the uid and are compared before use), `sentry` (flag read from
storage per check), `test-overlay` (read-modify-write of only its own
kind, fresh from storage), `logic-test` (whole fresh object per save),
`profile-general` (persist effect runs on mount, so a post-purge mount
writes defaults), and the two `ui/` panels (scalar written only on
explicit save of the new value).

**Two observations recorded, not fixed.** `insight.mapCatNames.v1` is
read by `map-tab.jsx` and written by nothing — a dead key. And Sentry
telemetry consent is read per event but an already-started SDK keeps
running across a uid change until restart; the flag itself heals
correctly, the running session is a consent nuance this entry flags for
whoever next touches `lib/sentry.ts`.

**Enforcement.** `check:purge` on the CI lint job (client-only, so
deliberately not on `backend-checks.yml`);
`src/v2/test/purge-wipe.test.ts` drives all fourteen module stores
through seed → purge → remutate and asserts the resurrection never
reaches disk; `smoke-live.test.jsx` proves the component half in a
mounted tree; `vote.test.ts` pins that the announcement fires on the
uid-change path.

## D52 · The content review: what got fixed, what got flagged, and the two lines that held

**Date:** 2026-08-06 · **Status:** Adopted

**The review.** All seven question surfaces read end to end — 90 daily, 73
feed, 44 duel, 96 learn cards, the four core tests, the nine lenses, and
the cross-bank seams. Two invariants shaped every fix: shipped **option
sets are never edited** (answers store `(qid, optionIdx)` forever — the
D30 re-key class), and the **daily list is never shortened mid-epoch**
(the deck maps day→question by position; a removal re-keys every later
day). So fixes took four shapes only: prompt edits that preserve the
question's meaning, metadata edits, `active: false` retirement for feed
items, and appends.

**Fixed.**
- **Six feed duplicates retired** (`active: false`, honoured by deck.ts's
  `active !== false` filter, now passed through the generator): f08, f20,
  f21, f24, f40, f54 — each the same question as a live daily (one
  cuisine, spoilers, lyrics/melody, music-while-working, death date,
  money-buys-happiness), splitting the same crowd twice.
- **D44 extends to opinion cards**: new optional `political: true` marker
  on f45 (mandatory voting), f46 (four-day week), f47 (car-free centres)
  and daily-014 (news trust) joins them to the no-slice set. A second
  marker rather than `test: "political"` because PASSIVE.record and the
  feed's test kicker key off `q.test` — reusing it would count feed cards
  toward the political test's rings. `slicing.test.ts` pins both markers
  and the generator pass-through, non-vacuously. Considered and left
  sliceable: f27 (phones in schools), f32 (tipping), f50 (celebrities in
  politics), daily-015 (AI) — opinions that correlate with politics less
  than they express it; the line is "expresses a political position",
  not "correlates with one".
- **Currency leaves the prompts**: daily-006 "€500" → "a week's pay"
  (scales with the reader, travels), duo-12 "€10k" → "a surprise
  windfall", f39 "$1M" → "a million". The time lens's "€100 today beats
  €160 in a year" became plain numbers — the 60% premium is the
  instrument, the currency was noise.
- **Duel voice unified**: seven 1v1 prompts rewritten you-voice/neutral
  (3, 8, 9, 12, 15, 17, plus 16 gaining its missing direction — hear the
  hard truth, not tell it). The duo overlay renders prompts verbatim in
  both the answer-about-yourself and guess phases, so they-voice items
  read wrong for half the flow.
- **Instrument items replaced in both layers** (tests.json ≡
  test-definitions.js, parity-gated): political-01's motherhood statement
  ("a society is judged…" — near-universal agreement, no discrimination)
  → public-ownership item; values-03's time/circle cross-load → pure
  circle; attachment-11 (drifting groups measured breadth, not loyalty)
  and attachment-14 (noticing withdrawal measured vigilance, not
  un-easygoingness) → maintenance and score-keeping items.
- **The lenses' acquiescence hole closed**: `moral` and `humor` gained
  their first reverse-keyed items, appended (lens answers and feed ids
  are index-keyed; only the tail is safe). A new structural gate
  (`src/v2/test/lens-content.test.ts`) holds every lens to: questions key
  to declared dims, every dim has a question, ids unique, viz known, and
  ≥1 invert per lens — the per-LENS floor, since single-item dims cannot
  carry the core tests' per-dimension rule.
- **Learn**: sol6's stem sharpened to "Demoted from planet to dwarf
  planet in 2006" (Ceres and Eris were also reclassified/designated in
  2006 — the old stem had three defensible answers); cell5's trap
  repointed to the lysis-wordplay distractor already in its options.

**Flagged, not fixed — and why.**
- Authored landslides that need retirement or a rewrite the invariants
  forbid: daily-004 ("okay to do nothing" — double-hedged truism),
  daily-013 ("can give meaning" — the modal concedes it), daily-061,
  daily-081, f53, f15's "always" strawman, f23/f33's missing third camp.
  Daily items wait for an epoch-safe retire lane; option edits wait for
  the farm's replace flow. The scorecard will say which of these the
  crowd actually kills.
- Duel reveal-safety trio (gu3 "loudest wins", gu9 "what would break this
  group", gu11 "new person wants in") — option-level content that can
  land on real people once names attach; retire/replace candidates for
  the duel lane, recorded here so D40's content lane inherits them.
- Duel trait overweight: five of twenty 1v1 items probe
  introvert/extrovert, four probe confront/avoid — variety debt for the
  next duel batch, not an edit to shipped items.
- Learn calibration gaps: `origins` and `capitals` ramp p=26–63 with no
  easy rung — needs appended easy cards (the learn lane's job), not
  edits. Weak traps whose options offer no better candidate (gene8,
  body8, sol7, ear3, ear8) stay as recall cards.
- daily-007's your-life/the-world ambiguity and daily-011's costless
  "find a third way" dodge — meaning-changing fixes deferred to human
  editorial; recorded so they are a decision, not a discovery.
- The daily↔feed near-dup *class* (f36/daily-038 survives this pass):
  worth a similarity warn-tier in check:content the day a third instance
  appears.

**Ops note.** These are bank edits; production picks them up on the next
`seedContentV2` run with `bumpRev` per the deploy runbook — nothing here
re-keys an existing answer, by construction of the four allowed shapes.

## D53 · The logic test measured: zero ambiguity in 60,000 items, and the curve gets pinned

**Date:** 2026-08-06 · **Status:** Adopted

**The review's method.** A matrix test's cardinal risk is an ambiguous
item — a distractor a careful solver could defend. That is measurable, so
it was measured: a per-family completion predicate (the family's line
rules plus the visible grid's uniformities and shape vocabulary), swept
over every option of every item for 5,000 seeds. Three tuning iterations
were needed, each round's false positives being a constraint humans
obviously use that the model had missed — fillRamp's size uniformity,
dist2's exact element identity, ringGrow's outline-only vocabulary.

**What it found.** Zero ambiguous options in 60,000 items, with the
constructed answer passing its predicate 60,000 of 60,000 times. Answer
positions uniform (16.3–17.0% per slot). dist2's degenerate case
(identical absence patterns) occurred 0 times in 2,466. No duplicate
puzzles within a form, no distractor-pool exhaustion, ~0.25ms per form.
Distractor composition matches the design's claim: 72.8% family-authored
wrong-rule mutants, 14.1% neighbour-cell repeats, 13.1% generic
perturbations. This CORRECTS the earlier framing that "distinct is not
wrong" was a live hole — it is a theoretical one only, and the sweep now
lives in logic-gen.test.ts permanently (answers must pass, no distractor
may), so a future family that opens the hole fails CI instead of
shipping. If a new family's ANSWERS fail the sweep, the predicate is
missing that family's grammar: extend the model, never weaken the sweep.

**The curve is a decision now, not an accident.** logicPctile moved to
`data/logic-score.ts` (typed, with loadResult/saveResult/logicSecs) and
its landmarks are pinned: chance (2/12 with six options) reads 4,
6/12 → 30, the load-bearing midpoint 62% → 50, and a perfect 12/12 reads
**94 — deliberately**. A perfect score is the test's ceiling, and a
ceiling cannot distinguish "better than 94%" from "better than 99%"; the
honest claim stops where the instrument does. The floor clamps at 1 for
the symmetric reason.

**The overlay left the bridge.** logic-test.jsx now imports the generator
and the scoring directly; window.LOGIC_GEN is gone (it had exactly one
consumer), loadOverlays() dropped its explicit import line (the ESM graph
carries the generator into the same deferred chunk), and the coupling
ratchet came down 620 → 619 across 51 files. The reveal-delay timeout is
deliberately never cancelled on unmount: it is also the final item's
save, and closing the overlay 200ms after the last pick must keep the
score — a 240ms timer is the whole cost of that guarantee.

**New coverage.** `logic-overlay.test.jsx` drives a full attempt through
the real generator (the seed pinned by stubbing crypto, the overlay's own
seed source), asserting the v2 payload to the millisecond — the 240ms
reveal delay subtracted from every recorded time — plus a wrong-pick run,
all five result lenses (four had never rendered in any test) each showing
the modelled-yardstick disclosure, and an 8-mark result pinning the
Answers lens against the old /11 regression. `logic-score.test.ts` pins
the curve, the v1 back-fill, and the times-fallback.

**Accepted limits, recorded.** Puzzle timing counts backgrounded-tab time
(skews the Pace lens toward "deliberate" — it is a modelled yardstick and
says so). Retake discards the previous attempt's result and seed — one
result, not a history, matches the device-local minimalism of D31. The
test is inherently visual; options are labelled by position for assistive
tech, and a non-visual rendering of a matrix test is out of scope rather
than pending.
---

## D28 amendment (2026-08-06) · Identity verification (passport / driver's licence class) recorded as a possible future requirement

**Date:** 2026-08-06 · **Status:** Owner's forward note, recorded.
Nothing changes today — D28's "no identity gate" clause still governs
everything built and shipped.

**The note.** The owner directs the record to carry this: if the shipped
stack — App Check (D36), device-bound activation (D29/D37), the floors,
the attribution ledger — proves insufficient against fake accounts in
practice, the product will in the future require government identity
verification (passport or driver's licence class) as a condition of
counting. This widens the escalation path D3's 2026-08-03 amendment
recorded: tightening device-bind stays first, and identity verification
now stands recorded behind it, at the owner's option, on evidence.

**What adoption would change, priced now so it is a decision rather than
a surprise later.** D28's reasoning does not dissolve because the feature
is wanted; it is the bill:

- **It reverses the product's defining claim.** "No account required" is
  in the store listing, and the privacy posture (D1/D8/D44) exists
  because the app stores politics- and relationship-class answers. An ID
  check binds a government identity to exactly that data (Art. 9), so
  the data inventory, both stores' privacy labels, SECURITY.md and the
  erasure story (D45/D51) must be rewritten and re-reviewed **before**
  the gate ships, not after.
- **It adds a processor.** Document capture, liveness and retention are
  a vendor relationship — a new breach and subpoena surface, and a real
  per-verification cost paid on every honest user.
- **What it buys is bounded, and the bound is already recorded.**
  Documents are buyable and paid real humans pass any ID check (D28's
  Douceur argument is unchanged) — so the gate re-prices a fake account
  in documents rather than in hardware, which for some attackers is
  cheaper than D29's per-device bar. It trades friction on every honest
  user for a bar that some attackers step over.

**The trigger stays evidence, not mood.** "Insufficient in practice"
means signals from the ledger — the velocity-analysis lever D29 names —
or a discovered ring the correction runbook (DEPLOYMENT.md, "Correcting
aggregates") could not adequately unwind. If adoption is proposed, it
gets its own numbered decision carrying the mechanism, the vendor, the
rollout, and the inventory rewrite sequenced first.

---

## D54 · The ledger gets eyes: a daily velocity scan, feeding manual review

**Date:** 2026-08-06 · **Status:** Adopted

**Decision.** `ledgerVelocityScan` (functions/src/velocity.ts) runs
daily over the `v2_agg_events` entries since its last run and logs —
only logs — four ring-shaped signals: impossible per-uid volume,
scripted answer cadence, Auth creation-time clusters among the window's
voters, and per-question bursts against each question's own trailing
baseline. Flags are WARNING lines carrying uids; the operator reads
them into the D28 correction runbook, whose "identification is
investigative" gap this closes the first pass of. Nothing is denied,
delayed or down-weighted — D29 recorded this lever's shape as "feeding
manual review rather than automatic denial", and that clause is load-
bearing here.

**Why now.** D28's guarantee is correction *given a uid list*, and its
residuals section says plainly that detection was out of scope — "the
ledger's timestamps are the raw material velocity analysis would read,
but no analysis ships today." That left the correction story
conditioned on luck: a ring had to be noticed by someone with no
instrument for noticing. The scan is that instrument, built from the
signals DEPLOYMENT.md's runbook already named as the investigative
step.

**The purpose-limitation check, because D47 makes it a live question.**
D47 deferred DAU counting over this same collection as "a new purpose
for existing data, which is a decision record, not a script." This is
not that: fake-account attribution is the purpose D28 collected the
ledger for, and D29 names this exact analysis as a tightening lever.
Same data, recorded purpose, so a script — this record exists to say
that distinction out loud rather than let the two cases blur.

**The signals, and the honest twin each must spare.** Every threshold
is an exported constant, pinned at its boundary by velocity.test.ts,
and an engineering default in D37's sense — movable, each in a known
direction (raise for quieter logs and later notice, lower for the
reverse):

- **Volume** (> the aggregate-feeding bank size in one window): no
  honest twin. Answers are create-only per question and the sweep-on-
  erase keeps uids single-lived, so exceeding the bank is dedup failure
  or forged writes — the nearest thing to a verdict in the set.
- **Cadence** (15+ answers with gap CV < 0.25 or mean < 2s): the twin
  is the backlog binge, spared by gap variance — humans read at
  question-dependent speeds; scripts must jitter wider than ±40% of
  their own mean to pass, which costs them throughput.
- **Cluster** (5+ of the window's voters created within 10 minutes,
  overlapping windows merged): the twin is a launch spike or press
  mention — a *good* day. This signal is why the output is review, not
  action.
- **Burst** (4× a question's trailing mean, floor 10, needing 3+
  recorded baseline days): the twin is the deck itself — the daily
  question and promoted debuts are bursts by design, excluded by the
  baseline requirement, so the signal sees only the attack shape: an
  old, settled question suddenly stuffed. A ring riding the current
  daily question hides in its crowd; that one belongs to cadence and
  cluster.

**Cost, at the system's own ceilings.** At D7's ~14k answers/day the
scan reads ~14k ledger entries (paginated, projected), ~140 batched
Auth lookups, and one state doc — pennies per month; at launch volumes,
effectively nothing. The state doc (`v2_velocity/state`, cursor plus
seven days of per-question counts) is denied to clients in rules and
pinned so in rules.test.ts: readable it would be a side channel under
`AGG_MIN_N`, writable it would let an attacker inflate their own
baselines. One new deployed function; check:fn-runtime and
check:deploy-targets both hold it, check:appcheck is untouched (no
callable surface).

**Deliberately NOT built, with the reasoning:**

- **Automatic denial or down-weighting.** The false-positive twins
  above are the product's best days; machinery that punishes them on
  pattern-match is worse than an operator reading a log line. D28's
  warm-up-gating rejection stands unchanged.
- **An alert policy.** DEPLOYMENT.md's "applied by hand, once,
  deliberately" reasoning governs: these are numbers read daily during
  calm. The heartbeat and flag lines carry `metric` fields so a
  log-based metric can be attached the day evidence warrants standing
  eyes — plumbing shipped, policy deliberately not.
- **The vote choice in the flags.** Same as D28's ledger reasoning:
  correction reads choices from the ring's answer docs; a copy in the
  log would be worse minimisation for zero forensic gain.

**Limits, so the layer above stays honest.** The scan cannot see the
+1-per-device-per-month drip (designed to sit under the publish
cadence's noise floor), paid humans at human cadence, or a ring patient
enough to mimic organic arrival across days. Its job is narrower and
real: it forces an effective attacker into exactly that slow,
human-shaped posture, and the device-bind month rule then prices that
posture per physical device. Detection latency is up to a day plus the
72h catch-up cap after an outage; entries beyond the cap are never
analysed (logged as a gap, not absorbed). And a scan that runs is not a
scan that is read — the flags are only as good as the operator's habit
of looking, which is the argument the metric-field plumbing exists to
answer when it stops holding.

## D55 · Three guarantees were enforced on a value and not on the way it moves

**Status.** Adopted 2026-08-06. Found by a code review of the tree at
c592042; each was reproduced before it was believed, and each carries a
test that fails against the code as it stood.

**Decision.** Three fixes, one shape between them.

**1 · The publish cadence applies per BUCKET, not only per question.**
`shouldPublishAgg` bounds how often `v2_question_aggs` is rewritten, and
D7's amendment records why: a client holds an `onSnapshot` on that
document, so a step attributable to one person discloses that person's
answer past any floor. The unit it bounds is the QUESTION. `by` — the
per-anchor breakdown added later — is counted per BUCKET, and nothing
bounded that. `steppedBreakdown` (pure.ts) now re-emits a bucket's previous
value until the bucket has gained `AGG_MIN_N`, and the trigger stores the
last released map as `v2_aggs_private/{qid}.byPub` (and `.entByPub` for the
catalog path).

The arithmetic that makes this not theoretical: anchors are empty until the
user fills the Basics card (D8), so a five-answer publish window routinely
carries exactly one anchored answer. Replaying the real fold, two
consecutive published states differed by

```
{"gender":{"f":{"0":5}}}  →  {"gender":{"f":{"0":5,"1":1}}}
```

— one vote, isolated, in a cohort that had cleared the floor. And because
the six anchors travel on the same answer, all six dimensions step together,
so the disclosure is a full {ageBand, gender, city, country, education,
relationship} tuple joined to an option, not a single cell. That is
re-identification, not the residual D18 records.

Cost: a bucket now lags by at most `AGG_MIN_N - 1` answers, the same bound
the cadence already gives `counts`; the private doc keeps exact totals, so
nothing is lost. First publish after deploy sees no stored `byPub` and
releases current state once — identical to the behaviour it replaces, not
worse.

**Corrected 2026-08-06, by CI.** The baseline stored was first written as
`steppedBreakdown`'s own output rather than what `publishableBreakdown`
went on to publish. Those differ whenever a bucket is suppressed — and a
bucket under the floor is suppressed by definition — so a cohort that had
not yet cleared the floor had nonetheless SPENT its step budget on a value
no reader ever saw, and then needed twice the floor to appear. In the shape
`e2e-v2-loop.mjs` drives (two cohorts at 3 and 2, both reaching exactly 5 on
the publish at total 10) it never appeared at all.

The bound belongs to what was OBSERVABLE: a bucket the reader never saw has
no delta to hide, so its next release is a first appearance, disclosing a
cohort of at least the floor arriving together — the floor's own guarantee.
`publishBreakdown` now returns one value that is both what is published and
what is stored, so the two cannot be wired apart again.

Worth recording where it was caught. The unit tests passed throughout: they
pinned the RULE, and the defect was in how the trigger wired it. The e2e —
the leg this record already flagged as unrunnable in the authoring sandbox —
is what found it, on the first CI run. That is the argument for the e2e
staying on the deploy path, made by the e2e.

**2 · An anchor value may not be a key on `Object.prototype`.**
`breakdownBucket` shape-checks `city` and `country`; the other four
dimensions have no closed vocabulary, and `firestore.rules` can only bound
an anchor's LENGTH — the constraint the shape map's own comment already
records. So `anchors: { gender: "__proto__" }` passed the rules (verified in
the emulator, anonymous auth), and `byDim[bucket] || (byDim[bucket] = {})`
then set the PROTOTYPE rather than a property. The counter beneath it landed
on `Object.prototype`, so every breakdown cell created afterwards in that
instance started at 1: five voters published as six, on unrelated questions,
until the instance recycled. `constructor` and `toString` are the same shape
one step weaker — they read back truthy, so they also walk past
`BREAKDOWN_MAX_BUCKETS`.

Rejected by membership in the prototype rather than by a blocklist: a list
of names the language owns is a list this repo would have to maintain
against it.

**3 · A take id may not be tallied on an object literal.** `takeId` is the
take's document id and the CLIENT chooses it — the ruleset constrains a
take's fields, never its name (verified: `v2_takes/constructor` creates, and
another member can flag it). `counts[takeId] = (counts[takeId] || 0) + 1`
therefore read back through the prototype, and ten flags on a take called
`constructor` became the string `"function Object() { [native code]
}1111111111"`. Every comparison in `buildModQueueFrom` against it is
NaN-false, so the take never entered the queue however often it was
flagged — moderation immunity, chosen at post time, nothing logged.
`tallyFlags` (pure.ts) uses a Map; `priorEscalations` likewise, where the
miss path would otherwise have written the Object constructor into a queue
entry's `escalations` field.

**4 · `--force` no longer reaches a firestore target.** Not a fourth bug so
much as the same class in the deploy path — see docs/DEPLOYMENT.md for the
arithmetic. `check:deploy-targets` now fails if the steps are recombined.

**Why these are one record.** Every one of them enforced a guarantee on a
STATE and not on a TRANSITION: the floor is checked in each published
snapshot but never between two of them (1); the anchor is validated for
length and shape but not for what assigning it does (2, 3); the index file
is compared to the project but nothing asks what the comparison is allowed
to delete (4). The guard that would have caught all four is differential —
replay a sequence and assert a property of every adjacent pair, rather than
of any single frame. `steppedBreakdown`'s test is written that way
deliberately: it measures the minimum step over every adjacent pair of
published states across 80 answers, because a spot check survives a policy
that steps by one past some size, which is the bug it closes.

**Amendment (2026-08-06) — two more from the same review, same shape.**
Both were listed below as deferred when this record was written; they are
now closed, and they belong here rather than in a record of their own
because each is again a guarantee enforced on a value and not on the way it
moves.

**5 · The profile's live-mode guard holds on every mount, not the first.**
`GeneralPanel` seeds from `localStorage` and writes the whole blob back on
mount with no edit made, so the first open persisted a record and every open
after it took `loadGen`'s merge path — which spread the sample persona
underneath. The live guard sat past that branch, reachable only when there
was no saved blob, which after the first mount was never. A live user
therefore got `age 34 · Editor · independent press · MA Literature` back as
their own, and the anchors effect wrote it to `v2_users/{uid}`, from where
`answerAnchors()` stamped it onto every later answer. Answers are
create-only (D5): the ones already written have no correction path, and a
fabricated `ageBand` folds into published breakdowns as a real cohort.

So the guard is now the BASE of the merge rather than a branch beside it,
and the storage key moved to `insight.profileGeneral.v2` with a migration
that drops any vital equal to the seed's value for that field. The trade is
explicit: a user who genuinely typed a value the sample persona also has
retypes one field. The alternative was leaving a fabricated anchor to be
stamped onto answers nobody can edit.

The mount-time anchors write is deliberately NOT suppressed, though the
review proposed it as a cost saving. It is the only thing that repairs a
profile whose anchors were already written — opening the profile once
replaces the map wholesale — so gating it behind a first-run flag would have
left every corrupted profile corrupted.

**6 · Erasure reaches the offline mirror.** `firebaseImpl.ts` enables
`persistentLocalCache()` unconditionally and `hydrate()` reads the whole
answers subcollection plus the profile, so a deleted account's votes and
anchors sat in IndexedDB. Nothing evicted them: `hydrate` is a one-shot
`getDocs` rather than a listener, so the server-side delete produces no
remove event, and the cache outlived the account on a device the user may
sell. `deleteAccount` now calls `terminate()` then
`clearIndexedDbPersistence()` — in that order, because the second refuses a
live instance — both best-effort, before the existing `insight.*` purge.

This one was a documentation defect as much as a code defect.
`web/privacy.html` states that deletion "clears the app's data on the device
you ran it from" and `docs/data-inventory.md` says the same; that claim was
true of `localStorage` and of nothing else, in the document both stores
require. D6 already treats this cache as sensitive — it is why Android
backup is off. Fixing the code rather than the copy, because the copy
described the right behaviour.

**Amendment (2026-08-06, second) — the bucket cap and `ownerUid`.**

**7 · The anchor bucket cap is no longer allocated first-come-first-served.**
A dimension holds `BREAKDOWN_MAX_BUCKETS` (24) buckets, nothing evicted one,
and `by` is carried across every publish — so whoever filled the slots first
decided what the dimension could ever show. 24 nonsense values blanked it
permanently, and firestore.rules can only bound an anchor's length. Two
defences, because the six dimensions are two different shapes:

- **Four have a closed vocabulary SHORTER THAN THE CAP.** ageBand, gender,
  education and relationship come from `<select>`s of 7, 4, 15 and 6 values.
  Checking membership means those dimensions cannot be exhausted at all —
  there are fewer legal buckets than slots. That is the complete fix, and it
  is available only in the trigger: the rules layer cannot hold a
  vocabulary, and a client choosing from a list says nothing about what a
  script sends. `npm run check:anchors` holds `BREAKDOWN_DIM_VOCAB` equal to
  the profile's lists, on both the PR and the deploy path.

- **City and country cannot be closed that way** — 10,929 places and ~249
  countries against 24 slots — so the cap itself changed. A bucket below the
  k-floor is published to nobody, so it is now evictable: a new bucket
  displaces the smallest sub-floor one, and a bucket at or above the floor is
  never evicted. Among equals it is oldest-out, and that is required rather
  than tolerated — the attack state IS 24 buckets of one answer each, so a
  rule protecting incumbents there would protect exactly the junk. What it
  costs is the long tail, which the cap was already documented to degrade;
  what it buys is that recurrence wins.

The eviction loss is real and bounded: an evicted bucket's partial count is
discarded, so a value that returns restarts and undercounts by at most
`AGG_MIN_N - 1`. It only ever applies to counts no reader has seen, and it
replaces a dimension that showed nothing at all.

**Found while writing the vocabulary: `Vocational / trade` never counted.**
It shipped as an `<select>` option and `breakdownBucket` rejected it for its
entire life, because a slash is in that function's rejected character class.
The answer wrote; the aggregate silently never counted it. Renamed to
`Vocational or trade` on both sides, and rule 3 of check:anchors is that bug
turned into a check.

**8 · `deleteAccount` removes `ownerUid`.** `createGroupV2` stamps it and
NOTHING reads it — a repo-wide grep finds one write and no reader — which is
exactly why three erasure phases walked past it while scrubbing the two
load-bearing fields beside it. firestore.rules serves the whole group
document to every current member, so it published a deleted account's raw
uid to the circle, and to anyone they invited afterwards, indefinitely. That
is the shape the reveal scrub one screen below already refuses.

Deleted rather than reassigned to a surviving member: nothing reads it, so
inventing a successor would be a fact this codebase has no use for.
`leaveGroupV2` is deliberately NOT changed — D45 settles that leaving a
group is not an erasure request.

The erasure e2e could not see this: its shared-group fixture was owned by
the SURVIVING member, so there was nothing of the deleted user's in it to
miss. The fixture now names the doomed account, which is the ordinary case,
and asserts the field is gone.

**Amendment (2026-08-06, third) — the reveal's membership snapshot.**

**9 · A day's reveal is scoped to the members who were there for that day.**
The reveal doc carries its own `members` array and firestore.rules gates the
read on it, which is what makes the guarantee retroactive in one direction —
joining tomorrow does not hand you every past day, leaving does not retract
the days you played. The array was membership AT REVEAL TIME, which is not
the same thing as membership on the day revealed.

Day D is revealed by the D+1 scan, and that scan runs `every 120 minutes`.
So anyone joining between 00:00 UTC and it was a current member when the
snapshot was taken, went into `members`, and read day D's votes and names
for a day they were not in the group for. Up to two hours, every day.
`revealGroupDay` claimed to have closed this by preferring the page snapshot
to a fresher read — but both reads happen on D+1, so that only ever closed
the seconds between them.

Groups now carry `memberJoinedAt { uid: Timestamp }`, written by
`createGroupV2` and `joinGroupV2` and removed by `leaveGroupV2` and
`deleteAccount` — the same four paths as `memberNames`, because a uid left in
either map is the erasure leak §8 records. `revealMembersFor` (pure.ts)
filters the array to members who joined before the END of the day (someone
who joined midway through it was there for it), plus anyone who actually
played it.

**Why the played-it clause.** Rules accept a duel answer up to four days
late, so a member can legitimately land a vote for a day preceding their
join: an offline client flushing a queue, or a fresh group playing a recent
day. Without the clause the pipeline publishes a reveal containing someone's
own vote that they alone cannot read — and "you see the days you played" is
the invariant the e2e already asserted.

**A member with no recorded join time is included, and that is the answer
rather than a fallback.** The field is written from the day this shipped, so
its absence means the member joined before that, which is before any day the
function will be asked about. Reading absence as "exclude" would blank every
reveal for every group alive on deploy day — which is also why there is no
ordering hazard in the rollout: the read side degrades permissively, so the
field can appear before anything depends on it. The residual is one day
wide: members who joined before the deploy keep the old scope for days not
yet revealed.

**The e2e was asserting the leak.** Its latecomer leg read the reveal as the
LATECOMER — an account that joined three days after the day in question and
never played it — and failed if the read was denied. It now reads as the
creator who played, and asserts the latecomer is denied, so the leg proves
the fix instead of the bug.

**Amendment (2026-08-06, fourth) — three ways a thing stopped happening.**

**10 · The reveal scan asks about the whole pending window.** It asked about
exactly one day, `utcDayKey(-1)`, and the schedule never passed one — so a
group-day was revealable during the single UTC day after it and never again.
That is not the window the rest of the system works in: rules accept a duel
answer four days late, deliberately, and `onV2AnswerCreated` re-adds the day
to `pendingDays` whenever one arrives. An answer syncing on D+2 therefore
re-opened day D, correctly, into a scan that would never ask about day D
again. Nothing errored: both members had answered, the day sat pending
forever, and a duo's streak stayed at whatever the earlier empty settle left
it. Only an operator calling `revealDuelsNowV2({day})` recovered it.

`scanDays` now returns `PENDING_DAYS_KEEP` days, which is the same bound the
pruning uses — a pending day older than that can never gain another answer,
so the scan asks about exactly the days that can still change. Steady-state
cost is five extra indexed queries per run returning nothing. An explicit
`dayKey` still means that day alone, which is what the operator lever and
every e2e leg pass.

**The second cause, independent of the first.** `onV2AnswerCreated`
downgraded any non-NOT_FOUND failure of the `pendingDays` mark to
`logger.warn` and returned normally, which made the trigger's `retry: true`
dead on that branch. The mark is the ONLY thing that puts a day in front of
the scan, so losing it lost the reveal. D19's stated safety net — "the answer
never folded into any aggregate, a louder problem, already logged" — is true
of the vote path and false here: the duel branch returns before any aggregate
work, and `monitoring/onV2AnswerCreated-errors.json` filters severity>=ERROR
while this logged WARNING. It rethrows now; `arrayUnion` is idempotent, so
redelivery is free.

**11 · `runBuildModQueue` pages through `v2_flags`.** It called `.get()` on
the whole collection, and the collection has no upper bound: `MOD_ADVISORY`
makes the keep-verdict sweep the only path that deletes a flag and it is dead
code while advisory is on, `deleteAccount` removes one uid's, nothing else
does, and there is no TTL. On a 256 MiB instance — `LIGHT_UNBOUNDED`, whose
own rationale describes a *streaming* `recursiveDelete` — that is an OOM well
before the 480 s deadline the code reasons about. Silent in-band, too: the
stale queue keeps serving, `queuedAt` never advances, `gen` freezes, and
every re-judgement throws `already-exists`. `buildModQueueNow` shares the
options, so the manual recovery lever died the same way.

What it holds now is one counter per DISTINCT take rather than one object per
flag. **That is not a hard bound and this record does not claim one** — it
grows with the number of takes ever flagged. The real bound is retention, and
choosing one (a flag TTL, or running the sweep in advisory mode) is a
data-policy decision with its own arithmetic. Deliberately not taken here.

**12 · `deleteAccount` unlatches `torndown` when the wipe is refused.** The
latch is set as the callable's first statement, deliberately — work already
in flight must not re-create an `insight.*` key mid-wipe — and nothing ever
reset it. But a refused wipe is an expected outcome, not an exceptional one:
`index.ts` refuses the auth delete whenever any phase failed, every network
timeout lands there too, and `LivePrivacyPanel` keeps the user in the app
afterwards. Left latched, that session was permanently deaf and nothing said
so: `refreshLive()` and `wake()` no-op so it can never reconnect after going
offline, `resubscribeForToday()` no-ops so the midnight rollover renders a
new deck while the previous day's listeners stay attached and billed, and
`subscribeToAuth`'s handler bails — disabling the uid-change guard whose own
comment says it exists to stop one person's answers being shown to another.
`vote()` is not gated, so writes kept flowing. Only a restart cleared it.

**Amendment (2026-08-06, fifth) — the tail of the review.**

**13 · The gates that could not see.** `check:appcheck` and
`check:deploy-targets` read one directory level, so a callable in a
subdirectory was invisible to both — and to their own vacuity counters,
which only count what they read. `check:globals` rule 2 substring-matched
`spec-index.js` without stripping comments, so commenting out a side-effect
import passed; five v17 modules assign no global at all, making that line
their whole wiring. `check:cities` restated `BREAKDOWN_MAX_LABEL` and the
rejected character class instead of reading them. And `npm run lint` applied
ZERO rules to `scripts/` and `firestore-tests/` — measured, against 106 for
`src/lib/firebase.ts` — so `--max-warnings 0` said nothing about the code
whose job is saying things about other code. All four fixed; the last found
one dead import immediately, and then caught a genuine bug in this very
change (an undefined `adb` in the moderation e2e) before it was committed.

**14 · What the UI and the store forms claimed.** `LIVE.social.leaveGroup`
had shipped with **zero call sites in any live surface** — the demo panel's
Leave button is swapped out when live is on — while `STORE-FORMS.md` and
`SHIP-CHECKLIST.md` answered Apple guideline 1.2 with
"`removeGroupMember` / `leaveGroup`". No `removeGroupMember*` callable has
ever existed. A **Leave circle** control is now wired into `LiveDuelPanel`,
two-step because the last member out takes the group and its reveals, and
both documents now describe what ships. **No owner-side remove callable was
added**: ejecting someone is a moderation power in a mutual-consent circle
and needs its own decision, so the forms say so rather than implying one.

**15 · Three claims that were false in the code's own voice.**
`slicing.test.ts` stated in the present indicative that an e2e leg proved
D44; no such leg was ever written, and mutating `slices` to `true` left all
four runners green while eighteen Art. 9 items published their cross-tab.
The enforcement point is now `breakdownFor` in v2.ts with cases of its own.
`feed-interleave.test.ts` declared its own copy of the loop and its own
constants, so nine assertions exercised the test file — and the shipped loop
had meanwhile grown a third stream the copy did not model; the loop now
lives in `data/feed-interleave.ts` and both import it. `e2e-moderation`
step 6 printed a pass for an assertion nobody wrote (`void judged;`), and
the erasure e2e's only client-authored write was denied every run and
swallowed, so it asserted the absence of a document that never existed.

**16 · The rest.** The privacy panel's Sentry OFF is enforced at the two
send sites rather than trusted to a teardown that cannot happen, and
`setSentryUser` is gated too — `wake()` was re-attaching the uid after
opt-out, turning an anonymous residual into an identified one. `linked` is
derived from auth instead of local state seeded to false, which was telling
Google-linked users they were anonymous. `resetForNewUid` publishes
`window.IS_TEST_RESULTS` through a shared helper and clears the two
one-shot flags, which are now per-uid. Retired daily questions stay in the
bank as tombstones so the kill switch stops re-mapping the pager. The
reveal's profile reads carry a `fieldMask` — measured at 50 KB to 42 bytes
on a profile whose `testResults` the rules bound only by key count.
twin/contrarian need a spread, not just a sample: a three-way tie was
crowning one member and calling another "breaks ranks" beside a literal
3/3. And `check:figures` is file-aware, which is how `SCHEMA-V2.md` came to
say the seed writes 191 docs on one line and 369 on another.

**Deliberately NOT done, with the reason.** Invite codes are still permanent
bearer credentials — rotating one inside `leaveGroupV2` would break the
code for every remaining member, and the growth loop is the reason the code
is shared at all; that is a product trade, not a bug fix. `v2_flags` still
has no retention bound (§11). No `content/options.lock.json` gate was added
for question option arrays: it is the right shape, but it needs a decision
about what a legitimate option edit looks like before a ratchet can refuse
the illegitimate ones.

**KNOWN RESIDUAL, stated because it is a real one.** The played-it clause is
also an unlock: join a group, backfill an answer for a day inside the
four-day window, and the reveal admits you. Strictly narrower than what it
replaces — passive joining now reveals nothing, and the unlock costs a
visible vote in the circle's own reveal — but not nothing. Closing it means
bounding the WRITE rather than the read: firestore.rules would have to refuse
a duel answer for a day preceding the member's join. That is a change to the
densest rule in the file, whose failure mode the file itself describes as "a
vote that vanishes", and it would refuse the legitimate fresh-group case
above. It is a decision of its own and is deliberately not taken here.

## D56 · The logic test stops telegraphing its rules: banded families, and every puzzle is on the clock

**Date:** 2026-08-06 · **Status:** Adopted (owner: "the biggest impact"
inside the D31 posture)

**The problem.** D31 made every attempt's puzzles fresh, but deliberately
fixed the family SEQUENCE — item 3 was always a shape cycle, items 9–11
always Latin squares. That fixed order was the one piece of a fresh form a
repeat taker still knew in advance: with thirteen families in a known
order, the test was coachable per slot, which converts fluid reasoning
into partly-practiced pattern matching. Separately, an attempt had no time
bound at all — an item could be held open indefinitely, which is neither
how matrix tests are administered nor neutral against mid-item consulting,
and D53 had already recorded unbounded backgrounded time as an accepted
timing skew.

**What changed (generator v2).** The twelve slot WEIGHTS are untouched —
`1,1,1.5,2,2,2,2.5,2.5,3,3,3,3.5` is the calibration D31 anchored
`logicPctile` to, and it does not move. What varies is which family
occupies a slot: each weight band draws from a pool, without replacement,
on its own seeded stream. Five families joined so every band has a real
pool: `sizeCycle` (w1.5), `dotSub` (w2), `innerGrow` (w2.5), `latinDots`
(w3) and `overlayXor` (w3.5 — Carpenter's figure
addition-and-subtraction, the classic APM tail motif). The arithmetic:
band draws yield 2·2·24·6·24·3 = **41,472 family sequences** (ordered
draws: 2! · C(2,1) · P(4,3) · P(3,2) · P(4,3) · C(3,1)), each then
parameterised per item as before — the sequence is no longer knowledge.
No family repeats within a form.

**The clock.** Every puzzle now has a 90-second budget (>5× the modelled
median of 17s — a careful solver is never rushed). An expired item
settles as unanswered: marked wrong, timed at the full budget. The
countdown renders only inside the final 20 seconds, absolutely
positioned so its appearance never shifts the puzzle mid-solve. Expiry is
deadline arithmetic, not tick counting, so a backgrounded tab cannot buy
unbounded think time — this caps (not fixes) the D53 accepted limit on
Pace timing. Recorded times are clamped to the budget.

**What deliberately did NOT change.** The weight ramp, the percentile
curve and its 94 ceiling (raising the honest ceiling needs harder items
AND measured norms — a curve re-derivation without data would be
model-on-model), the result schema (v2 payloads carry `gv`, which now
reads 2), and the D31 device-local posture: this test still sends nothing
anywhere, and the client-side honesty note in logic-gen.ts still holds —
banding closes advance knowledge and coaching surface, not devtools.
Verified server-scored attempts remain the recorded ticket price for any
social or comparative surface (D31's deferral arithmetic stands).

**Reconstruction survives the version bump.** D31 commits to {seed, gv}
rebuilding a result's exact form forever, so v1 stayed generable:
`generateForm(seed, 1)` dispatches to the frozen template (identical
construction and option streams), and golden tests pin three v1 seeds —
one per tail family, seed 7 down to every visible cell and the full
option order — so drift in the frozen path fails CI rather than quietly
reinterpreting history. An unknown gv throws. The overlay stamps
`gv: form.version` as before; old saved results render unchanged.

**Verification.** The D53 ambiguity sweep now covers the new families —
each got a completion predicate (the family rule plus the grid's visible
uniformities and exact element identities), and the sweep's contract is
unchanged: every answer must satisfy its predicate, no distractor may,
across every seed × item × option in the suite's 200-seed sweep.
`overlayXor`'s construction guarantees a visible row whose operands
overlap — on that row XOR visibly differs from union/intersection/copy,
so the union corruption is a wrong answer, not an ambiguous one — and the
family validator asserts that property from the cells. The banded
template is pinned literally in the test (weights per slot, pool
membership per slot, no-repeat), so moving a family between bands is a
visible recalibration. The overlay suite drives a full expiry: countdown
hidden at 69.5s, visible at 70s, item settled wrong at 90s + reveal
delay, recorded at exactly 90000ms.

**Accepted limits, recorded.** The w1 band holds only two families, so
slots 1–2 vary in order but not membership — acceptable at the easy end,
where coaching buys least. The 90s cap counts real-world interruptions
(a phone call mid-item forfeits that item; Retake exists, and a bounded
loss beats an unbounded hole). The countdown is visual plus a
`role="timer"` label; the test's non-visual scope is unchanged from D53.
Family draws are per-band independent, so cross-band composition (one
item combining two bands' rules) is still future work — it is the honest
route to raising the ceiling past 94, once there are measured norms to
recalibrate against.

## D57 · Verified logic attempts: D31's deferral reversed — the server holds the key

**Date:** 2026-08-06 · **Status:** Adopted (owner: "lets do the backend
verified attempts too, reverse d31") — this reverses the "Backend sync:
deferred" clause of D31. Everything else in D31 (generation over a bank,
the honesty posture, v1 reconstruction) stands.

**The reversal, and what it cost.** D31 priced the sync bundle and
deferred it: a fifth `testResults` key under the ≤8 rules cap, a
data-inventory row, a store-form re-answer. That exact bundle now ships —
plus one thing D31's costing could not have known, because it priced an
UNVERIFIED sync: a verified score cannot ride the client-only
`saveTestResult` path at all. A client-writable key is a forgeable one,
so `testResults.logic` lands with a rules change after all — the
fcmTokens presence-not-mutation pattern, case-for-case — and only the
scoring callable writes it. The store-form re-answer came back clean:
the score is User Content → "Answers and test results", already declared
Yes/linked; the histogram carries no identifier. Practice attempts still
send nothing anywhere, and the result-screen copy now says "practice"
where it used to say "this test", in the same commit that made the
distinction real.

**The design.** Two callables (App Check-enforced, LIGHT_CALLABLE,
us-central1), one attempt doc per account at `v2_logic_attempts/{uid}`,
opaque even to its owner:

- `logicStartV2` mints a crypto seed server-side, stores
  `{seed, gv, status: "open", startedAtMs, deadlineMs, dayKey,
  startsToday, normsCounted}`, and returns the twelve puzzles as
  `{cells, opts, diff}` — the answer index, the family names and the
  seed are withheld. Given cells and options, the only route to the
  answers is solving. Guards: 3 starts per UTC day (an unfinished
  restart is a preview channel, so it is bounded, not free), and a
  30-day re-verify cooldown once scored. A crashed attempt can restart;
  it just burns a start.
- `logicSubmitV2` takes twelve raw pick indexes (-1 = expired),
  regenerates the form from the stored `{seed, gv}`, scores inside the
  deadline (12 × 90s + one item of slack — the D56 cap arithmetic,
  server-enforced in aggregate), and in one transaction: marks the
  attempt scored, writes the canonical result to `testResults.logic`,
  and folds the account's FIRST scored attempt into the norms
  histogram. The response returns marks, score, percentile — and only
  now the seed, which post-scoring is no longer an answer key, so the
  local copy stays reconstructable (the D31 property practice results
  have always had).

**Why the seed never travels, with the arithmetic.** The generator is
public byte-for-byte on every client, so seed → full answer key in
~0.25ms. Recovering the seed from the puzzles means sweeping the 2^32
seed space against the served cells: ≈ 4.3e9 × 0.25ms ≈ 12 CPU-days,
perhaps 10× less with a construction-only matcher — against a ~19.5
minute submission window. Feasible for a cluster, and beside the point:
cracking the seed yields exactly what photographing the puzzles and
asking a strong solver yields, at far higher cost. Solve-by-proxy
strictly dominates, no unproctored test prevents it, and the clock
bounds it. "Verified" therefore claims precisely: scored server-side, on
a form the client could not have seen in advance, within the standard
administration window, one canonical score per account per cooldown.
It does not claim proctored. (The 2^32 space is a generator-inherited
bound; a future gv can widen it if verified scores ever gate something
worth a cluster.)

**Norms, and the flip that has NOT happened.** Exact counts in
`v2_logic_norms_private/global` (13 score buckets + n, no uid, no
anchors, no timing); public mirror at `v2_logic_norms/global`
materialized only at or above AGG_MIN_N and rewritten every
PUBLISH_EVERY-th count — the same floor and the same step-attribution
argument as the question aggregates, imported from the same constants.
Only first scored attempts count (D32's rule, D32's reason: retakes
measure practice). The displayed percentile is STILL the modelled
logistic — the result stores `source: "model"` — because a histogram of
n < floor is not a norm study. Flipping verified percentiles to the
measured distribution once n clears the floor is deliberate future work
and will be its own recorded decision; nothing in the UI claims
measurement today (LOGIC_VERIFIED_NOTE says so explicitly).

**Erasure.** The attempt doc is uid-keyed OUTSIDE the v2_users subtree,
so `deleteAccount` gained a dedicated phase, and the erasure e2e seeds
and asserts the doc like every other per-uid path. The histogram
survives deletion — it was never attributable to begin with, same as
the k-floored question aggregates a deleted account's answers fed.
Deleting your OWN verified score from your profile doc is allowed and
pinned by a rules test (it is your doc; the cooldown and the norms count
live server-side, so deletion resets nothing) — but the door does not
swing back: reintroducing the key is forgery and is refused.

**Enforcement inventory, because a claim needs a test.** Rules: clients
cannot introduce, mutate, or reintroduce `testResults.logic`; the
attempt doc and exact norms are denied to everyone; the mirror is
read-only — all pinned in rules.test.ts, including the post-merge trap
that keeps big5/politics syncs working while the logic key rides along.
Functions: logic.test.ts pins the curve landmark-for-landmark against
the client copy, scoring against the real generator, the cooldown/rate
arithmetic, the wire shape (cells+opts+diff and NOTHING else), and the
foldNorms algebra. The generator ships as two byte-identical copies
(functions/tsconfig compiles only its own src/), held equal by
`check:logic-sync` in ci.yml and on the deploy path via
backend-checks.yml — a drifted server copy would score forms the client
never rendered. check:appcheck counts both callables enforcing;
check:fn-runtime and check:deploy-targets cover the new exports; the
deploy workflow's --only list names them.

**Accepted limits, recorded.**
- The callables' end-to-end leg (emulated functions driving start →
  submit → testResults + norms assertions) is deferred: the functions
  emulator cannot start in this development sandbox (the CLAUDE.md
  environmental note). Coverage today = pure unit + rules + overlay
  tests over a mocked transport; the erasure e2e rows DID land and run
  in CI. Writing an e2e leg that cannot be executed before commit would
  trade a recorded gap for unverified green — the worse deal.
- A failed submit keeps the picks in memory for Retry; killing the app
  between finish and submit loses the attempt (it expires server-side,
  having cost one of the day's three starts). Not persisted to storage
  on purpose — a stored pick queue is a new erasure surface for one
  narrow failure window.
- Per-item timings stay device-local even on verified results; the Pace
  lens reads the local values and the server stores only the duration it
  observed. The verified record makes no claim about per-item speed.
- The `db` device-bind claim (D29) is not demanded by the callables —
  matching the answer rules' soft-enforce state. If D29 step 2 flips,
  revisit here: the claim is the anti-account-cycling control, and the
  3-start/30-day limits are per-ACCOUNT, not per-device, until then.
- No social or comparative surface reads the verified score yet. This
  decision builds the score that could survive one; the surface, its
  k-anonymity story, and the measured-percentile flip are separate
  decisions.

## D58 · The seed refuses to edit a shipped option set

**Date:** 2026-08-06 · **Status:** Adopted

**What was enforced by nothing.** D52 records "shipped option sets are
never edited" as an invariant, because answers store `(qid, optionIdx)`
and nothing else. Swap two options on a live question and every historical
vote silently changes meaning: no count moves, no aggregate recomputes,
nothing anywhere reports it. It is the D30 re-key class applied
retroactively to data already collected — and the enforcement was a human
reading the diff. `runSeedV2` took an edited `options` array straight
through `seedDocMatches` (which returns false on *any* changed field,
including this one) and `batch.set(…, { merge: true })` it over the live
doc.

Every content review so far has got this right. That is a record, not a
mechanism. D55's own review found sixteen things by reading; this is the
class of defect that reading is worst at, because the diff looks like an
ordinary content edit and the damage is invisible in every artifact
afterwards.

**The refusal.** `seedOptionConflict` compares the stored option array
against the one about to be written; a conflict skips that document and
the run throws `failed-precondition` naming every refusal, old set and
new. Per-document rather than per-run: a batch of legitimate prompt fixes
must not be held hostage by one bad edit, and the throw makes sure the
skip cannot be mistaken for success either way. The legitimate writes are
already committed when it throws — holding them back would punish the rest
of the batch for one line.

**Deliberately narrow.** `prompt` edits stay allowed, and that is not an
oversight: D52's own fix list is mostly prompt rewrites preserving a
question's meaning ("€500" → "a week's pay"), and a prompt carries no
index any answer refers to. Only `options` re-keys stored data.

**Appends count as edits.** Adding an option orphans no existing index,
but it changes what the question asked the people who already answered it
without that choice. D52's appends are to *banks* — new questions — never
to a shipped question's option list.

**Creates and pre-`options` docs pass.** A document that does not exist
has no votes to re-key, and neither does one stored without an `options`
array. Refusing either would wedge the seed permanently.

**The operator's two legitimate paths are unchanged**: `active: false` to
retire a question, or append a new qid to replace it. Neither goes through
this code.

**`runSeedV2` takes its `Firestore` as an argument now**, following
`runAggTransaction`'s precedent, and the reason is the whole point of this
record. The guarantee is about what the seed *refuses to write*, and a
`getFirestore()` inside the body would have made that refusal untestable
without an emulator — which is the same shape as the gap being closed
here. `seed.test.ts` drives the real function against a stand-in db and
asserts the refused document is never written, the allowed prompt fix in
the same run still is, a create is never refused, and the run's own log
does not count a refusal as "unchanged". Mutation-checked: deleting the
four-line guard from `runSeedV2` fails four of the six, and the two that
survive are the controls that should pass either way.

Testing the predicate alone would not have been enough, and the
distinction matters: `seedOptionConflict` answering perfectly while
nothing called it looks identical in `pure.test.ts` and still loses every
historical vote on the edited question.

**Not done: the CI-side manifest.** A committed snapshot of every shipped
option set, diffed by `check:content`, would catch the edit one step
earlier — at review rather than at seed. It is redundant with this, needs
a new artifact to maintain, and would go stale in the one direction that
matters (a manifest nobody regenerates passes everything). The
server-side refusal is authoritative because it reads the live documents;
that is where the invariant is actually about to be broken.

## D59 · The deferred chunks stop caching their own failure

**Date:** 2026-08-06 · **Status:** Adopted

**The bug.** `spec-index.js` memoised both deferred groups (D25, D48) into
a plain module-level variable: `if (!p) p = (async () => …)()`. That is
correct for what it was written for — `main.jsx` starts each load once,
every opener awaits the same promise, the mount tests await them in
`beforeAll` — but `if (!p)` cannot tell a resolved promise from a rejected
one. One failed chunk fetch (a dropped connection, a stale asset after a
deploy, a flaky native file read) was therefore **permanent for the
session**: every later call replayed the same rejection. The World feed
and all five cross-link overlays stayed gone until relaunch, and because
app-shell's openers catch and return, the symptom was a tap that did
nothing — no toast, no retry, no report.

**The fix is one helper.** `data/lazy.ts`'s `retryable()` clears the
cached promise on rejection and rethrows. No retry loop, no backoff — the
caller decides whether to ask again. The overlays get recovery for free
precisely because every one is reached through an opener that awaits this
promise: the second tap re-attempts the import. Nothing else changed.

**The success path is unchanged, which matters as much.** Concurrent
callers still receive the same promise object, so this cannot turn one
deferred group into two parallel downloads — pinned by a test asserting
identity, not just equal values.

**Cleared before the rethrow, not in a `finally`.** A caller that catches
and retries synchronously — the exact shape app-shell's openers have —
must find an empty slot rather than the promise it just saw reject.

**Mutation-checked.** Reverting `lazy.ts` to `if (!inflight) inflight =
load()` fails three of the five cases and passes the two success-path
ones. A test suite that only covered the success path would have passed on
the bug, which is how it shipped in the first place.

**The feed still gets one shot.** `main.jsx` calls `loadWorldFeed()` once
and reports a failure to Sentry; nothing re-attempts it, so a failed feed
chunk still costs the feed for the session. Retry is now *possible* there
rather than automatic — wiring a user-visible retry into the daily card is
a UI decision, not a memoisation one, and is left for whoever designs that
affordance.

**One import that is not a spec module.** `spec-index.js` now imports
`./data/lazy`, above the ordered list rather than inside it, because
nothing in that list reads it and the list's order is a contract. The
direction is the allowed one: `spec/` and `spec-index` may import `data/`
(as `main.jsx` and `logic-test.jsx` already do); `data/` may not import
them back.

## D60 · The verified percentile becomes a measurement at one hundred players

**Date:** 2026-08-06 · **Status:** Adopted (owner: "do the measured
percentile flip when we have enough data") — the flip D57 recorded as
future work, built now and gated on data, not on a later deploy.

**What flips, exactly.** `logicSubmitV2` now reads the private norms
histogram on every submit (pre-fold, before any write, as transactions
require). Once it holds at least `LOGIC_NORMS_MIN_N` verified first
attempts, the percentile stops being the logistic and becomes a count:
the share of counted players this score STRICTLY beats — ties are not
beaten, which keeps the claim wording ("share of players this score
beats") identical to the curve it replaces. The result and the response
carry `source: "measured"` and `n`, the population ranked against; the
client says "Sharper than X% of N verified players" and swaps the note
for one that names what is measured and what is not. Below the floor,
nothing changes: same logistic, same `source: "model"`, pinned equal in
both suites.

**The floor, with the arithmetic.** `LOGIC_NORMS_MIN_N = 100`. At
n = 100 the worst-case standard error of an empirical percentile is
√(0.5·0.5/100) ≈ 5 points — comparable to the modelled curve's own
honesty margin — and the k-anonymity floor (AGG_MIN_N = 5) is cleared
twenty times over. Below that, an empirical rank whipsaws by tens of
points per submission: noise wearing a number. One constant; lowering
it is a recorded decision, not a tweak.

**Pre-fold comparison, on purpose.** The population is the players
counted BEFORE this submission, so a submitter is never a member of
their own field, and a re-verifier (who never folds — D32's
first-attempt rule) is ranked against the same kind of population as a
first-timer. `n` is therefore exact in the claim: each counted player
appears once, which is precisely what the first-attempt rule bought.

**The ceiling argument retires — for measured results only.** D53
capped the modelled curve at 94 because a curve cannot rank perfect
scores. A count can: 12/12 among a field where 10% score perfect reads
"sharper than 90%", and among 150 perfects of 200 it reads 25 — the
data speaks, however deflating. The [1, 99] clamp stays at both ends
for display sanity ("top 0%" and "sharper than 100%" are absurd at any
n), and the modelled path keeps its 94 untouched.

**What deliberately did NOT change.** Practice attempts still score
against the modelled curve, on-device — ranking an unlimited-retake
practice run against the verified-first-attempt population would
compare unlike things and muddy both claims. The lens charts (solve
bars, field Gaussian, pace cloud) remain modelled sketches even on a
measured result — the measured note says so explicitly, so one real
number never dresses up four drawn ones. Drawing the Field lens from
the public mirror is the natural next step and is recorded here as NOT
done. The mirror's publish cadence and floor are untouched.

**Verification.** `measuredPctile` is pure and pinned: null below the
floor (the model keeps the job), strictly-below share at it, tie
handling, both clamps, the perfect-among-perfects case, and the
995-of-1000 rounding edge. The overlay suite drives a measured response
end-to-end: the claim names its population, the note declares the
sketches, and the saved result carries `source`/`n`. The submit path's
change is read-always + branch — the emulated e2e leg remains deferred
with D57's environmental reason.

## D61 · Twenty-five items, tail-heavy: the form grows before the norms freeze it

**Date:** 2026-08-06 · **Status:** Adopted (owner: "do 25 items with the
harder tail", against the assistant's 20-item recommendation — 25 sits
inside the owner's original 20–30 range)

**Why now, and why at all.** Twelve items give thirteen raw scores and
squeeze all top-end discrimination into the last two or three; by
Spearman–Brown, a 0.78-reliability 12-item form reaches ≈ 0.87 at 25
items. And D60 froze the clock: the norms histogram buckets scores by
form length, so every verified attempt accumulated under 12 items would
be discarded by a later change. The histogram is empty today — this is
the last cheap moment.

**The v3 ramp.** 25 slots, non-decreasing:
`1,1 · 1.5,1.5 · 2,2,2 · 2.5,2.5,2.5 · 3,3,3,3 · 3.5,3.5,3.5,3.5 ·
4,4,4,4 · 4.5,4.5,4.5` — eleven of twenty-five at 3.5+, against one of
twelve in v2. Ten new families joined so every band draws from a real
pool: `ringLatin` (w3.5); the w4 two-rule compositions
`latinShapeSizeFill`, `outerLatinInnerLatin`, `ringGrowFill`,
`innerGrowCycle`, `fillRampShapeCycle`; and the w4.5 tail —
`dist2Latin` and `xorLatin` (three simultaneous rules), `ringLatinShape`
(double distribution over a low-salience attribute), and `dist2Xor`
(two elements under two DIFFERENT laws) — Carpenter's hardest classes.
28 families total; band draws now yield 2·2·24·6·24·24·120·24 ≈ 9.6e8
family sequences. The sweep caught one real ambiguity during
construction — a skipped-ring distractor satisfying a count-only
reading of the new ring-Latin families — closed the D53 way: the
predicates now demand the exact consecutive ring geometry every visible
cell teaches, the same exact-vocabulary constraint dist2's elements got.
(The legacy `ringGrow` never had the hole live: its column counts are
always 1 or 3, so a two-ring answer cannot occur there.)

**The 25-item curve, re-derived and pinned.** `logicPctileFor(frac,
items)` carries one logistic per form length. The v3 parameters are
midpoint 54 (a modelled median solver clears the low bands and roughly
half the middle: ≈13.5/25) and slope 12; landmarks pinned in both
suites: chance (1/6) → 4, half → 42, 20/25 → 90, perfect → **98** — the
tail-heavy ramp earns the model more ceiling than D53's 94, still
capped below 99 because a curve still cannot rank perfect scores. The
12-item curve keeps its historic name, parameters and pins: v1 payload
back-fills must not re-rank, and unknown legacy lengths fall back to
it. All of this is bootstrap only — D60's measured flip supersedes the
model at n = 100 regardless of parameters.

**Era safety, both directions.** The norms histogram now stamps the
form length it counts (`items`); a stored histogram from another era
ranks nothing and folds nothing, so the first current-era submit starts
the count fresh — 12-item scores can never mix with 25-item ones. An
attempt OPENED under gv 2 and submitted after this deploys is validated
and scored against its own 12-item form (`logicItemsFor(gv)`), scored
by the 12-item curve, and kept out of the 25-item histogram — the
deadline bounds that window to minutes, but a refusal there would
swallow an honest finisher. Reconstruction holds for every era:
generateForm(seed, 1|2) reproduce their frozen generators, pinned by
goldens (v2's captured pre-change, seed 11 down to full option order),
and an unknown gv still throws.

**What it costs the sitting.** Typical runs move from ~3–5 to ~6–8
minutes (modelled median 17s/item); the worst case, every 90s clock run
out, is 37.5 minutes, and the verified deadline is 26 × 90s = 39
minutes. The per-item cap stays flat at 90s across all bands — a
per-band cap would be tighter administration but a second thing to
explain; recorded as not done.

**Accepted limits, recorded.** The w1, w1.5 and w2.5 bands have pool ==
slots, so their family SETS are fixed and only order varies — the
variety budget went to the tail, where coaching pays most. Reliability
numbers quoted here are still Spearman–Brown projections, not
measurements; the odd/even split-half submission idea (D57's reflection)
remains future work. The Answers lens draws 25 rows on a phone screen —
scrollable and legible, but dense; redesigning it is deferred until the
measured Field lens work touches those lenses anyway.

## D62 · The test starts learning its own difficulty: family and slot solve rates

**Date:** 2026-08-06 · **Status:** Adopted (owner: "add some learning to
it so we better learn how hard each question is")

**What is learnable, and from where.** Questions are generated, so there
is no bank to rate — the difficulty-bearing units are the 28 rule
FAMILIES (the Carpenter-prior weights D56/D61 assigned them are exactly
the numbers worth checking) and the 25 SLOTS (same family late in the
sitting may solve less: fatigue and time pressure are real and worth
separating from family hardness). The only place this is honestly
observable is a verified attempt: the server regenerates the form, so it
alone knows which family each item was and whether the pick was right.
Practice attempts still send nothing.

**The fold.** `foldDifficultyStats` counts, per family, appearances and
solves, and per slot, solves (`n` is every slot's exposure). It runs in
`logicSubmitV2`'s transaction under the SAME gate as the histogram —
verified first attempts of the current era only (D32's rule: retakes
measure practice; D61's era stamp: 12-item stats never mix with
25-item ones) — into `v2_logic_norms_private/families`, mirrored to
`v2_logic_norms/families` at the same floor and cadence as everything
else. The two docs ride the existing collections, so ZERO rules changed;
the rules test asserts the new paths anyway, so a future rename cannot
silently split the coverage.

**What is deliberately absent.** Timings: per-item solve times are the
strongest difficulty signal and they stay on the device, because D57
promised exactly that in the data inventory — difficulty is learned from
solve rates alone, and that trade is recorded here rather than quietly
made. Anchors and uids: never attached; the ledger is counts, same
survivability-after-deletion argument as the histogram.

**The loop this exists to close, later.** With measured per-family solve
rates, three recorded futures become data-driven instead of
prior-driven: recalibrating the band weights (a family measurably easier
than its band mis-prices "k of 25"), auditing the ramp's monotonicity in
reality (slot solve rates should broadly fall left to right — if slot 19
outsolves slot 12, the ramp lies), and replacing the Answers lens's
modelled solve-rate bars with real ones. Each is its own decision once
n is meaningful; nothing reads the mirror yet, matching the D60
histogram-mirror precedent.

**Verification.** Pure fold pinned from nothing, over priors, and over a
full real form (25 distinct families seen once each — the no-repeat rule
observed from the data side). `scoreLogicPicks` now returns the families
alongside the marks, asserted against the generator; the wire to the
client is unchanged (families are derivable from the disclosed seed
post-scoring, so nothing new leaks). Rules suite covers the new doc
paths in both collections.
## D63 · Near-duplicate questions get a measured gate

**Date:** 2026-08-06 · **Status:** Adopted

**The problem.** Every content lane's dedup rule is "check the whole
corpus while writing" (QUESTION-FARM.md), and the only automation behind
it is exact prompt-string equality within a surface (`check-content.mjs`).
The corpus grows by up to 4 farm questions plus a catalog card per day
(D33), written by scheduled runs whose recall of the archive is a re-read;
one reworded word defeats the exact check, and the repo's own fixtures
prove the class: "Money can buy happiness." (sg07) and "Money buys
happiness." are the same question sharing not one exact string.

**The gate.** `scripts/question-neighbors.mjs` (`npm run check:neighbors`,
CI lint job) scores token-set Jaccard over prompt + option/item labels —
lowercased, diacritics folded, stopwords dropped, plurals stemmed —
within each surface's dedup domain: the spec daily archive (positional
dq/dqx ids cross-read from `DQ_BASE`, so failures name real ids), the
feed bank, both duel banks together (the D40 dedup rule), and `PICK_QS`.
An in-domain pair ≥ 0.5 fails CI; a pair a human judges genuinely
distinct is recorded in the script's `ALLOW` map with the reason — a
recorded exception, not a convenience.

**The threshold, measured not chosen.** At adoption the closest
legitimate in-domain pairs score 0.286 (daily), 0.222 (feed), 0.300
(duel), 0.333 (pick), while the deliberate suggestion-board twins score
1.000 and 0.667 — the gate sits at 0.5, inside a gap that wide on both
sides. `question-neighbors.test.mjs` (test:scripts, same CI job) pins
the normalization, the id mapping `ALLOW` keys on, and every gated
domain staying under the gate — so the gate holds even for a change that
never ran the check script locally.

**Deliberately outside it, so the next reader does not assume more than
it checks:**

- **Suggestions ↔ daily is report-only.** Two seeds twin dailies BY
  DESIGN — the board depicts the picked → promoted story — so gating
  them would red a green tree. The lookup mode
  (`check:neighbors -- --candidate "…"`) still lists them, which is how
  a farm run sees the collision the manual tells it to check.
- **Learn cards (v1).** Two cards may legitimately share one fact's
  vocabulary; their dupe bar is the fact, which only a human can check
  (D32). Extending the metric there needs its own calibration first.
- **Cross-surface pairs.** Daily and feed may deliberately run the same
  tension at different depths; a cross-surface twin is an editorial
  call, not a mechanical one.
- **Synonym paraphrases.** A lexical metric scores a synonym rewrite at
  0. This gate is the measurable floor under the writing rule, not its
  replacement — the manual's re-read stands, now citing the measured
  top score per question in PR bodies.

## D33 amendment (2026-08-06) · Ordinal splits are measured on their axis

**What was wrong, with the arithmetic.** D33's evenness — `1 − (maxShare
− 1/n) / (1 − 1/n)` — treats every question as categorical. For `binary`
/ `choice` / `dilemma` (and the feed's `vote`/`duel`) that is the right
bar. For the ordinal types it mismeasures both failure modes at once: a
rating whose crowd all answers 5–8 (shares 0,0,0,0,.2,.3,.3,.2,0,0)
spreads over enough slots to score **0.778** — graded a strong split
while being a consensus just above the middle — and a scale at 65%
agree / 15% disagree scores **0.75** while the UI's own headline for the
same distribution says "65% agree". With 21 of the 90 live dailies
ordinal (16 scale + 5 rating), the farm's first real signal would have
learned "write agreeable scale statements" from a number claiming the
opposite.

**The fix** (`scripts/scorecard-metrics.mjs`, extracted so the
arithmetic is testable; `question-scorecard.mjs` routes by type). Scale
and rating score `sideBalance × spread`: sideBalance = 1 − |low − high|
/ (low + high) across the midpoint (an exact-middle slot — scale's
Neutral — sits on neither side; nobody-took-a-side scores 0), spread =
mean distance from the midpoint over (n−1)/4, capped at 1 so
uniform-or-wider counts as fully spread. All-Neutral scores 0 — a crowd
that agrees to shrug is still a crowd that agrees — as does unanimity on
either pole; the polarized 30/15/10/15/30 scale scores 1.0. Under the
fixed metric the two examples above fall to 0.213 and 0.375.
`scorecard-metrics.test.mjs` pins each case against the number the old
formula produced, so re-routing ordinals through the categorical bar
fails loudly.

**What deliberately does not change.** The field stays `evenness` in the
same [0, 1] with the same reading (1.0 = real split, 0.0 = landslide),
so every consumer — grades and their thresholds, leaders/laggards,
`retireProposals`, the topic/type rollups, the pulse console's evenness
buckets — reads on unchanged. The committed scorecard is not
regenerated: the pre-launch baseline has zero scored questions, so no
committed number moves, and the next `--fetch` under the self-refresh
contract picks the metric up. That timing is the point of amending now —
the metric changes before the first measured value exists, instead of
under it.

## D40 adoption (2026-08-06) · All four parts shipped, with five deltas

**What shipped.** Part 1 was already live. Part 2: the duel lane's
contract is now a section of QUESTION-FARM.md (single gate, learn-style,
≤4/run at most weekly, run-on-request — no Routine yet). Part 3:
`foldDuelSignal` (functions/src/v2social.ts) folds each committed reveal
into `v2_aggs_private/duel-<qid>` and mirrors
`v2_question_aggs/duel-<qid>` at the same `AGG_MIN_N` floor as every
published number; the scorecard grew a `duel` section (plays, split,
guess-match rate, `deadDuels`/`noisyDuels` advisories) with no new read
path. Part 4: the 20 romantic questions moved into
`content/duel-questions.json` (ids `020`–`039` — one `duo-NNN` id
namespace across both 1v1 pools), seed as duo docs with
`mode: "romantic"`, and `duelQFor` serves them only to a pair whose duo
doc says `duoMode: "romantic"`; the picker lives in LiveDuelPanel.

**The deltas, each with its reason:**

1. **Pick questions publish plays and total only — no per-option
   counts.** The proposal said "per-option counts"; a pick's optionIdx
   values index each group's OWN member list, so summed across groups
   they are wrong-shaped data wearing numbers (the D12 class). The fold
   bounds counts by the question's option count, which pick's empty
   options make zero.
2. **The fold costs two reads, not zero.** "Zero extra reads" held for
   the delta (the reveal transaction already holds every answer) but not
   for the running state or the option count: the fold is its own small
   transaction reading the private doc and the question doc. It runs
   OUTSIDE the reveal transaction deliberately — the aggregate doc is
   contended across every group revealing the same question, and a
   conflict there must retry a two-read fold, never the reveal. Accepted
   residual, recorded: a crash between reveal commit and fold
   undercounts an advisory floored aggregate by one reveal, permanently
   (the reveal doc's existence settles the day); the fold logs at ERROR
   so monitoring sees a systematic failure.
3. **The publish cadence is crossing-based** (`shouldPublishDuelAgg`),
   not the vote path's `total % PUBLISH_EVERY`: a reveal folds a whole
   group-day at once, so a batch can jump over a multiple and the modulo
   cadence would go silent until it happened to land exactly. Per-reveal
   granularity was already covered by this record's
   strictly-less-revealing argument; the cadence bounds doc rewrites.
   Neither doc carries a timestamp — the vote mirror's attribution rule,
   applied here to "which scan window did a group reveal in".
4. **The romantic pool ships dark** (`active: false` at seed) **until
   the mode-aware client is the fleet.** A pre-mode client's `duelQFor`
   has no pool filter, so an active romantic doc would rotate into
   FRIEND-pair duels. The picker refuses to render for a pool that
   cannot serve (`romanticPoolReady`), so the flip is invisible until
   activation. **The activation step, for the runbook:** flip the 20
   `duo-020`–`duo-039` docs to `active: true` in the Firestore console,
   then run the **Seed content** workflow with `bump_rev: true`
   (`scripts/seed-content.mjs --bump-rev` — the post-D36-amendment
   seeding path; the app itself has no console to type in) — console
   flips touch no `updatedAt`, so without the rev bump returning
   clients' cursors never see the pool.
5. **`duoMode` is written by a rules carve-out, not a callable** — the
   schema's first member-writable field on a group doc: member + duo doc
   + that field alone (affectedKeys) + closed enum. No cap, budget or
   invariant beyond that exists for the field, which is exactly what a
   rule can express; rules tests prove every denial direction. Residual,
   recorded: the picker locks after the local partner seals, but a flip
   while the OTHER partner has already sealed hands the pair two
   different questions for one day — the same class as bank drift, which
   the reveal already survives (it stores the answered qid; the fold's
   in-range bounds keep the mismatched votes out of counts and guess
   scoring), and it self-heals the next day.

One repair rode along: `runSeedV2` hardcoded `active: true` on first
create, silently discarding the `active: false` that `flags()` has
emitted since D52 retired six feed questions at source. Creates now
honor the source flag; reseeds still never touch `active` in either
direction.

---

## D64 · Five findings from a cost & performance audit, and the two gates that had stopped measuring

**Date:** 2026-08-06 · **Status:** Adopted (owner: "yes do 2, 3, 4, 6 and 7").
Five of a nineteen-finding audit; the rest are listed under **Not done** below
so the unclaimed ones stay claimable rather than becoming folklore.

**Why an audit at all.** `docs/COSTS.md` already models this app's bill and
models it well. What it models is **client-issued document reads** — and
nothing else. Security-rule `get()`s, reads issued by Cloud Functions, index
*storage*, and network *egress* are all absent from `scripts/cost-arith.mjs`,
which is why its `cost` object has seven terms and no bytes term. That does
not change the launch answer (still $0 below ~2,000 DAU, still rounding error
at 5,000), and the corrections belong in that document rather than this one.
What follows is only the part that was code.

### 1 · `answers` is indexed on fourteen fields nobody queries

`v2_users/{uid}/answers/{aid}` is written with `qid`, `surface`, `optionIdx`,
`guessIdx`, `gid`, `day`, `entity`, `answeredAt` and an `anchors` map whose
keys `firestore.rules:71-74` closes to exactly seven. Firestore indexes every
scalar leaf ASC and DESC by default, including each map subfield.

Exactly one of them is ever queried: `answeredAt`, at
`src/v2/data/live.ts:463-470`, both as a `where(">")` cursor and as an
`orderBy` — collection-scope, and there is no `collectionGroup("answers")`
anywhere in `src/` or `functions/`. Every other index on that document is
built and stored for nothing.

**The arithmetic.** A world answer whose author filled all seven anchors has
eleven indexed leaves → 22 index entries written per answer, against 2 after
the exemption; a duel answer has fourteen → 30 → 2. An answer with an empty
anchors map is 8 → 2. So the write amplification falls by roughly an order of
magnitude, and the index-storage line falls with it. The *money* is a
derivation rather than a measurement, and it is a derivation the repo's own
model cannot check, because `cost-arith.mjs:206-208` bills storage on document
bytes and has no index term at all — which is the finding underneath the
finding.

**What this costs, stated plainly.** It is a one-way constraint on future
queries: filtering answers by `surface`, `gid` or `day` will not be possible
without re-enabling that field first (and backfilling its index). That is the
right trade today — nothing queries them and the exemptions are reversible —
but it is a trade, and a future feature that wants "my duel answers for group
X" has to notice this file first.

`firestore.indexes.json` cannot carry a comment, which is why the reasoning is
here. The exemptions are additive; the deploy path still runs without
`--force`, so the two hand-made indexes `check:deploy-targets` protects are
untouched.

### 2 · `ledgerVelocityScan` buffered the whole window into a 256 MiB instance

`functions/src/velocity.ts` accumulated every ledger entry in the window into
`rows: LedgerRow[]` before folding once. The window is bounded by
`WINDOW_CAP_MS` (72 h), not by DAU, so a catch-up scan at 50 k DAU is ~450 k
rows — and `LIGHT_UNBOUNDED` (`ops.ts:111`) gives it 256 MiB.

The failure is worse than a lost run. `lastScanAt` is written at the *end* of
the function, so an OOM leaves the cursor unmoved; the next run re-reads the
same capped window and dies in the same place, forever, with D28's only
detector silently dead and no alert (D54 ships none deliberately). The wall
lands somewhere around 44 k DAU — **below** the 50 k row of COSTS.md's own
table, and it is not in that document's list of walls.

Now folded per page: `foldInto(acc, rows)` mutates an accumulator, `foldWindow`
is a one-line wrapper over it so its existing test is unchanged, and peak live
memory is one `PAGE` of rows plus the fold. A row is ~5 machine words; the
fold keeps one packed double per entry and one Map slot per uid.

`velocity.test.ts` gains the assertion that makes this safe rather than merely
smaller: folding page-by-page at every split size produces the same
`perUid`/`perDayQid`/`entries` as folding the window whole, including a uid and
a midnight rollover straddling a page boundary. The old test could not have
caught a paging bug because there was no paging.

**Not fixed here:** the scan's Auth lookups are still serial
(`velocity.ts:350-356`), and the burst baseline is still capped by
`WINDOW_CAP_MS`. Both were in the audit; neither was claimed.

### 3 · Both bundle ceilings had stopped measuring what they claimed

`scripts/check-bundle.mjs` asserts a per-chunk and a total ceiling. Both had
drifted, in opposite directions, and the failure modes are different enough to
be worth separating.

**The per-chunk ceiling had gone slack.** Its header carried a *measured*
table whose baseline row read "nothing (today) 837 KB". The entry chunk is
**723.4 KB** — D39 and D40 took ~116 KB out of it and neither lowered the
ceiling with the win, which is the discipline the D25 and D38 entries in that
same header both name. At 850 the entire D38 overlay group could return to
eager and the script would print OK. Re-measured the way the original was, by
moving one group at a time out of `loadOverlays()` and rebuilding:

| eager again | entry | 735 |
| --- | ---: | --- |
| nothing (today) | 723.4 KB | ok |
| city-overlay | 729.1 KB | ok |
| logic-test | 752.9 KB | RED |
| test-overlay | 782.1 KB | RED |
| person + city + suggest | 821.1 KB | RED |
| the whole group | 941.4 KB | RED |

735 is verified to fire end-to-end, not merely to be arithmetically below
752.9. The city-overlay caveat survives unchanged: 5.7 KB is under any headroom
worth having, so this remains a ceiling on the group, not a per-module
assertion.

**The total ceiling had never once weighed a release build.** `ci.yml`'s
`typecheck-build` job calls itself "the same gate a release goes through" and
ran `npm run build` with no environment. `src/lib/sentry.ts:73` reads
`import.meta.env.VITE_SENTRY_DSN`; Vite replaces that with a literal at build
time, so unset, the whole `import("@sentry/capacitor")` branch is provably dead
and rolldown drops it. Meanwhile `ios-release.yml:132` sets the real DSN and
does not run `check:bundle`. Measured off one tree:

```
no DSN    1577.2 KB across 40 chunks   ← what CI weighed
with DSN  2058.4 KB across 44 chunks   ← what ships (+481.2 KB)
```

The shipping bundle has been ~450 KB over a 1600 KB budget for as long as
Sentry has been in it, and no gate could see it. CI now builds with a dummy
DSN — any non-empty string restores the branch, no secret is needed, nothing
in that job runs the app — and the ceiling moves to 2100 to sit just above what
the shipping graph actually weighs. The number went up; the set of bytes it
covers went up by more.

Sentry does not touch first paint either way — it is dynamically imported and
appears in no `modulepreload` link. The eager graph measured 1211.2 KB with the
DSN and without.

**Why no `check:figures` entry for the 723.4.** The ceiling is the ratchet: at
11.6 KB of headroom, drift announces itself by failing, which is the property
850 had lost at 128 KB. A figure gate here would need a build to exist, which
`check:figures` currently does not require, and the fix for a stale ceiling is
to re-measure it rather than to pin the prose beside it.

### 4 · An uncapped 120 ms retry loop on the Mirror tab's default view

`src/v2/spec/map-tab.jsx` rescheduled `tryFit` every 120 ms with no counter
until the pane became measurable — ~30,000 wake-ups per hour of dwell, each
calling `fitAllTarget`, which reads `clientWidth`/`clientHeight` and forces
layout. `MapTab` is the Mirror tab's **default** `you` population, so this is
the common path rather than a corner.

The sibling copy of the same construct in `person-mindmap.jsx:246-251` was
already capped at 60 tries, with a comment naming exactly this hazard. Now
both are. (The audit's write-up also named `relmap.jsx` as a capped sibling; it
has no such loop — checked before copying the claim.)

### 5 · The agg cache was re-serialised on every fan-out delivery

`saveAggCache` (`src/v2/data/live.ts`) ran `JSON.stringify` over the **whole**
`state.aggs` map synchronously inside the agg snapshot handler. The daily
question is globally shared, so every publish fans out to every listening
client — COSTS.md finding 2's own numbers, 125 and 1,250 deliveries per user
per day, are 0.7 and 6.9 full serialisations per second at 50 k and 500 k DAU,
on the main thread. The map is never pruned, so the per-serialisation cost
grows with the session too.

Now coalesced at 1 s, leading-schedule/trailing-write rather than a restarting
debounce: a steady stream of publishes must still reach disk about once a
second, where a restarting timer would starve and write nothing until the burst
ended. State is read at write time, so nothing in the window is lost.

Two things the coalescing forced:

- **The `visibilitychange` handler flushes on hide.** Its hidden branch was
  empty. Hiding is the last callback a mobile WebView is guaranteed before the
  OS may kill it, so without this a backgrounded app loses up to a second of
  counts that were previously written synchronously. This one is load-bearing:
  drop the flush and exactly one test fails.
- **`purgeLocalTrace` cancels the pending write.** This is hygiene, and the
  first draft of this record said it was more — that it prevented the D50/D51
  resurrection. Mutation-testing the claim refuted it: with the cancel removed,
  **nothing in the tree fails**, because `resetForNewUid` empties `state.aggs`
  before it purges (so a surviving timer can only write `{}`) and `torndown`
  covers the `deleteAccount` path. The key does come back either way — the new
  session's own listener re-creates it empty within the window. The cancel is
  kept because a queued write holding the old map is worth dropping and it
  costs nothing; it is not a leak fix, and the comment on it now says so.

Recorded at this length because the correction is the point: three of the
audit's findings were refuted the same way, and a claim that survives only
because nobody ran the mutation is the failure mode this repo keeps building
gates against.

**What now proves the coalescing.** Three cases in `vote.test.ts`, each pinned
against the mutation it is supposed to catch: a five-snapshot burst produces
zero synchronous writes and exactly one write carrying the *last* state; hiding
flushes synchronously and exactly once; a uid change leaves no previous
account's counts behind. Reverting `saveAggCache` to its synchronous form fails
all three.

### Not done, and still open

Ordered as the audit ranked them, so the next person picks from the top rather
than re-deriving the list.

- **The database region is a one-way door with a deadline.** A Firestore
  location is fixed at creation; `(default)` on `nam5` holds no seeded content
  yet, so today it is a console action and after `LIVE.seedContent()` it is a
  migration. `cost-model.mjs --regional` already prints both columns: $2.53 /
  $86 / $5,931 per month against $5.17 / $175 / $11,910 at 5 k / 50 k / 500 k
  DAU. `COSTS.md:278-281` files it under "what would change these numbers",
  beside engagement rate, as though it can be revisited later. It cannot. This
  was the audit's single highest-value item and it is a decision, not a patch.
- **Nothing gates the eager graph.** 1211.2 KB across 17 files in
  `dist/index.html` governs cold-start parse and eval, and no ceiling watches
  it; D39 and D40 both moved bytes out of the entry chunk into eager siblings
  with every existing gate staying green. D38 declined this gate on two
  grounds that are now both false. ~12 lines.
- **The Firestore SDK is eager** — 290.7 KB, more than everything D25 and D38
  deferred combined — because `live.ts` statically imports `firebase/firestore`
  and `main.jsx` renders downstream of `initLive()`. `src/lib/firebase.ts:1-5`
  describes a lazy design that this defeats; `firebase/auth`, app-check and
  Sentry *are* correctly lazy. Splitting it is a real project, not a patch.
- **`v2_takes` soft-hide is not query-enforceable.** `firestore.rules:377-378`
  hides a take with a per-document predicate; a `where("gid","==",…)` query
  returns the hidden document, text and all, to a non-author member. The suite
  is green because `rules.test.ts:852-863` only exercises `getDoc`. Nothing
  ships on it yet — settle it before any takes UI does, with a boolean `hidden`
  field, a `(gid, hidden, createdAt)` composite index, and a rules test that
  asserts the *query* case.
- **No listener is detached on background** (`live.ts`'s `visibilitychange`
  hidden branch now flushes the cache but still tears down nothing, and there
  is no `appStateChange` listener). The fan-out term in `cost-arith.mjs:116`
  is `onlineMin: 3`, "minutes with the app actually open" — a behaviour guess
  no code bounds. The crossover where fan-out overtakes every other read source
  is `31,200 / X`, so at the model's own X it is 10,400 DAU, already below D7's
  14,400 write wall rather than the 50,000 COSTS.md implies. Any teardown must
  be gated on hidden-for-N-minutes: below ~10 k DAU a re-attach costs more than
  it saves.
- **Also unclaimed, smaller:** `activateDeviceV2` inherits `maxInstances: 10`
  from `LIGHT_CALLABLE`; `revealGroupDay` reads every member's profile before
  the gate that can discard it; `loadRevealHistory` re-reads 13 immutable
  reveal docs per group per session; `cacheVote` never advances `maxTs`, so a
  device re-reads its own immutable answers every boot; `state.aggs` is
  unbounded and every `setItem` failure is a bare `catch {}`, which makes the
  quota cliff silent and self-inflicting; WorldFeed rebuilds all ~109 cards on
  every scroll-threshold crossing with no `React.memo` anywhere in `spec/`.

---

## D65 · A soft-hide that a query walked straight past: `hidden` becomes a required boolean

**Date:** 2026-08-07 · **Status:** Adopted (owner: "fix the v2_takes query leak
too"). Closes the one finding D64's "Not done" list called out as needing to be
settled before any takes UI ships. Amends D22's moderation substrate; nothing
else in D22 changes.

**The bug, and why every existing test was green.** `v2_takes`' read gate was

```
&& (!("hidden" in resource.data) || resource.data.authorUid == request.auth.uid)
```

— a *presence* test against the moderator's annotation map. Every takes
assertion in `firestore-tests/rules.test.ts` used `getDoc`, and `getDoc` was
never the problem: a per-document rule is applied per document, so a member
reading a hidden take by id was correctly denied and the suite said the
soft-hide worked.

A **list** is a different operation. Measured in the emulator against the
shipped rules file:

| operation | result |
| --- | --- |
| member `getDoc` on a hidden take | denied ✓ |
| author `getDoc` on a hidden take | allowed ✓ |
| stranger `where("gid","==",…)` | denied ✓ |
| **member `where("gid","==",…)`** | **allowed — returned the hidden take, text and all** |

The stranger row is the one that makes this a real finding rather than a
guess about Firestore: rules *are* evaluated for queries, and the
group-membership half of this very rule enforces correctly on the same query.
It is specifically the presence test that Firestore cannot hold a list to,
because a query carries no constraint it can compare `"hidden" in resource.data`
against — and the engine's response is to allow, not to refuse.

**Three shapes, all measured, because the obvious fix is also wrong.**

```
presence          !("hidden" in resource.data)        query LEAKS
defaulted getter  data.get("hidden", false) == false  query LEAKS
required boolean  data.hidden == false                query DENIED
```

The middle row is the trap and the reason this record exists. It reads as the
safe, backward-compatible version — no migration, absent field treated as
visible, the same idiom `isValidV2Anchors` and the `active` check already use
elsewhere in this file — and it leaks exactly like the line it would replace.
Nothing distinguishes the working shape from the broken one except running
them.

**What shipped.** `hidden` is a required boolean on every take, the annotation
map moves to `hiddenMeta`, and the gate is a bare equality:

- **Read:** `resource.data.hidden == false || resource.data.authorUid == uid`.
- **Create:** `hidden` joins the `hasOnly` list *and* must equal `false`.
  Required because the read gate is an equality — a take without the field
  could never be read back — and required to be *false* because a client that
  could post `hidden: true` would hide its own words from the circle while
  leaving them in the moderation queue.
- **Flags:** the same presence test in the `v2_flags` create rule became an
  equality too. Not because it leaked — it is a `get()` on another document
  inside a create, never a query predicate — but because once `hidden` is
  always present, `!("hidden" in …)` is false for every take and **no flag
  could ever be created again**. A field's shape is not a local change.
- **`submitModVerdict`** writes `hidden: true` plus `hiddenMeta`. The
  already-hidden skip in `buildModQueue` stays a truthiness test on purpose: a
  take hidden before this change carries the old map, and a map is truthy where
  `=== true` would silently re-queue every one of them.

**The property this buys, which the old rule never had.** The gate now **fails
closed**. A list without `where("hidden","==",false)` is refused outright, so a
client that forgets the filter gets an error rather than other people's hidden
words. That is the difference between the client's filter being a consequence
of the rule and being a promise standing beside it — the distinction this
repo's whole posture rests on. The author escape still serves the appeal path
by id and does not widen a list: an author listing the circle passes the same
filter and reaches their own hidden take only by `getDoc`.

**Cost.** Two billed reads per take on the read path instead of one, since the
gate reads the take and the rule's `get()` reads the group — unchanged from
before, the equality is not what costs. The write path gains one indexed
boolean per take.

**What now proves it.** A list-shaped case in `rules.test.ts` asserting all
three parts, each of which can rot independently: the unfiltered list is
refused, the filtered list succeeds *without* the hidden take, and a stranger
gets nothing either way. Reverting the gate to the presence test fails it.
Two create cases pin the required-and-false shape. 47 → 49 rules tests.

**The composite index, added on the owner's call.** This record's first draft
deferred it, on the grounds that no client queries `v2_takes` yet so the sort
order was a guess. Overruled, and the reasoning was thin anyway: the guess is
not much of one — a circle's comment list is newest-first or it is nothing —
and the deferral traded a known index write per take against a production
query that fails on its first run.

```
v2_takes · COLLECTION · gid ASC, hidden ASC, createdAt DESC
```

`firestore.indexes.json` went from `"indexes": []` to holding this one, which
is worth noting for a reason beyond takes: `check:deploy-targets` forbids
`--force` on any firestore target precisely because that flag deletes every
index the live project holds and this file does not name. That guard now
protects a real entry rather than an empty list.

**What is and is not verified.** The file is accepted by firebase-tools' own
`validateSpec` (run against it directly, not eyeballed). The index's necessity
and sufficiency are **not** emulator-testable: the Firestore emulator does not
enforce composite indexes, which is also why the list case in `rules.test.ts`
passes without one — two equality filters and no `orderBy` is served by
single-field index merging in production too, so that test would not have
needed this index regardless. The first query that adds `orderBy("createdAt")`
is what needs it, and no such query exists yet to run. If the takes UI wants a
different order, the production error names the index to add.

**The general lesson, which is not about takes.** A per-document predicate and
a per-query predicate are different guarantees, and reading this file cannot
tell you which one a rule is enforcing. Any rule shaped "everyone in the set
may read, EXCEPT documents where X" is a candidate list leak unless X is an
equality on a concrete field the client query must also carry.

**The rest of the ruleset was checked against that shape, not assumed safe.**
The other four `in`-tests (`fcmTokens`, `testResults`, `logic`, `qid`) are all
on `request.resource.data` inside write rules — no query, no exposure. The one
genuine sibling is the reveal gate at `v2_groups/{gid}/reveals`
(`uid in resource.data.get("members", [])`), which matters more than it looks
because `firestore.indexes.json` ships a collection-group `CONTAINS` index on
that exact field, so the listing path is not hypothetical. Probed in the
emulator: an unfiltered collection-group query is **denied**, `array-contains`
on another user's uid is **denied**, and a non-member `getDoc` is **denied** —
it fails closed on every shape. No change needed there.

That non-result is the actual finding. The same class of expression leaks in
one rule and fails closed in another, and nothing about reading them predicts
which. So the defence cannot be a style rule about how to write predicates; it
is that a `getDoc` test proves nothing about a `getDocs` path. **Where a
collection can be listed, test the list.**
## D66 · The sample persona reached live mode twice more: the Map's anchor ring, and a hydration that wrote to nobody

**Date:** 2026-08-07 · **Status:** Adopted

D55 removed the sample persona from the profile's Basics card in live
mode and recorded why it matters beyond cosmetics: the anchors effect
writes whatever the profile holds to `v2_users/{uid}`, and
`answerAnchors()` stamps it onto every answer — which are create-only
(D5), so a fabricated cohort has no correction path. That fix was correct
and incomplete. Two more surfaces carried the same persona, and both were
reproduced before they were believed.

**1 · The Map's anchor ring had no live path at all.**
`spec/map-anchors.js` built its seven anchors from `IS_DATA.me` with the
persona as the `||` fallback on every field, and nothing in the file
consulted `LIVE`. Measured, not reasoned — the module run in node with a
fresh live account and no tests taken returns:

```
age 34 · born 1991 | Editor · independent press | MA Literature · Univ. of Oslo
Big Five · taken 10 days ago | Politics · taken 3 weeks ago | …
```

This is the worse of the two placements. `MirrorPreviewTag` returns
`null` for the You stop — deliberately, because nothing there was
supposed to be sample data — so unlike the Mirror's other populations,
this wore no "Preview · sample people" badge.

`list()` now branches on `LIVE.enabled`: live mode reads the viewer's own
anchors (D8) and drops every row with nothing behind it, so a fresh
account gets an empty ring rather than somebody else's. Both callers
already handled a zero-length list — `MapTab` divides by
`anchors.length || 1`, `MapThumbCard` returns null — which is why the
gap survived review: the honest state was already renderable, just
unreachable. Age is the BAND, the only thing the anchor holds; the exact
birthday still never leaves the device.

`relate()`, the other half of that module, is now marked demo-only. It
has no caller, its keys are the prototype's `dq*` ids, and its fallback
lines carry Mira's numbers in prose ("openness 78 sets the playlist") —
so a live question would miss `REL` and land on a sentence about someone
else. Kept for the mock path, fenced against a future wiring.

**2 · `publishTestResults()` had stopped reaching anybody.** Its own
comment states the intent — "Live mode shows only REAL results: purge the
demo's baked test results and rebuild from server + this device's saves"
— and it did that by assigning `window.IS_TEST_RESULTS`. But
`test-definitions.js` left the global bridge (D39, #85) and now EXPORTS
`IS_TEST_RESULTS`; all fifteen consumers import the binding. The global
has had no readers since, so every effect of that function was silently
undone: the demo persona's Big Five, politics, values and attachment
survived into live mode until the user retook each test, and a result
earned on another device never arrived at all.

This is the D39 conversion hazard from the other side. The rule the
README states — a conversion removes the load-order condition, never the
data one — is about the *consumers* of a converted module. This was a
*producer* left writing to the name the conversion retired, and no gate
sees it: `tsc -b` type-checks a global write against nothing,
`check:globals` rule 1 flags dangling reads and not orphaned writes, and
rule 4 counts the write as coupling that is going the right way.

The fix announces instead of assigning — `insight:test-results`, the
same shape as D51's purge, which the same file already listens for. The
module that owns the object mutates it in place, so the consumers holding
a reference see it. The payload REPLACES rather than merges, and that is
the half that removes the seed: a key absent from `{server, …device}`
means the user has not taken that test, and the honest render of that is
nothing.

**What it cost, and what it bought.** `map-anchors.js` needed `LIVE`,
which is a new shared-global reference — so the module was converted off
the bridge on the way past (`window.MapAnchors` → named exports, both
consumers importing), and `LIVE` comes in as an ESM import from
`data/live`, which `main.jsx` already pulls into the entry chunk. Rule 4:
534 across 45 files, down from 539.

**The fixture was hiding it, and now cannot.** `test/live-fixture.ts`
assigned a second object to `window.LIVE` and left `data/live`'s default
export — the same object in production, since live.ts ends with
`window.LIVE = LIVE` — untouched. Invisible while every consumer read the
global; a converted module importing the binding would have seen
`enabled: false` while the tab rendered beside it saw the fixture. The
fixture now defines its members onto the imported singleton and restores
the descriptors afterwards. Two objects that have to agree is the bug
this whole record is about; the fixture no longer creates one.

**Still sample data in live mode**, so the list stays a list rather than
a discovery: the feed's takes, counters and friend dots (demo-only by
design, D1 — not unbuilt); `scenes.js`'s follow list; the catalogue pick
cards carrying `q.catalog`; and `daily-questions.js`'s non-world
audiences, where only the World distribution is swapped for the real
aggregate.


---

## D67 · The cost model was counting one kind of read, and calling it the bill

**Date:** 2026-08-07 · **Status:** Adopted (owner: "now update COSTS.md with
the corrected numbers"). Implements the corrections D64 listed and did not
make; supersedes the read decomposition in `docs/COSTS.md` and the four-source
claim in `scripts/cost-arith.mjs`.

**The defect, in one sentence.** `costModel` counted reads the CLIENT issues —
boot, agg top-up, reseed delta, listener fan-out — and every other read on the
invoice was billed at zero, because there was no term for it.

Zero is a number, and it was the wrong one. Three categories were missing:

- **Security-rule reads.** Every `get()` and `exists()` inside a rule is a
  billed read charged to the project, on top of the operation that triggered
  it. The answer-create paths do four: one distinct document for a world
  answer (`v2_questions/{aid}`, touched three times), three for a duel.
- **Reads issued by Cloud Functions.** The aggregate transaction reads two
  documents per world answer. The nightly velocity scan (D54) reads *every
  ledger entry written that day* — one per world answer, a term the size of
  the top-up and reseed combined, and entirely invisible. The reveal pipeline
  reads `(4 + 3m)/m` per member per group-day.
- **Bytes.** Index entries are billed as storage and the model charged a 1.0
  multiplier; network egress is billed per GiB and the model charged nothing,
  having counted document *count* and never document *size* — which is
  precisely backwards for a fan-out whose every delivery ships the published
  aggregate whole.

Together: **+20 reads per user per day, flat in DAU**, and roughly **+50% on
every billed row** ($5.17 → $7.26 at 5 k DAU, $175 → $247 at 50 k, $11,910 →
$17,166 at 500 k).

**Measured, not estimated, where it mattered.** The two read terms are counts
of call sites in the shipped rules file and the shipped functions, not
guesses. One of them turned on a fact worth writing down: **repeated `get()`
of the same document inside one rule evaluation is free.** Firestore caps
document accesses at 10 per single-document request; a probe rule doing
fifteen `get()`s of one document passes, while eleven `get()`s of eleven
documents is refused. The limit counts distinct documents, so the evaluator's
cache is real and billing sees the same cache. Counted un-deduped the rule
term would be 14 rather than 6 — a 2.3× error in the direction of alarm.

**What D64 got wrong, corrected here.** D64 said the fan-out already overtakes
every other read source at 10,400 DAU — *below* D7's 14,400-DAU write wall —
and that COSTS.md's "wall 1 before wall 2 is the good ordering" claim was
therefore broken. Implementing the very terms D64 said were missing moves the
crossover the **other way**: the flat baseline the fan-out has to beat went
from 26 reads/user/day to 46, so the crossover is at **18,220 DAU** and the
ordering holds with a wider margin than before (3,800 DAU rather than 2,000).
D64's arithmetic was right on its own inputs and wrong on the model's, which
is the argument for implementing a correction rather than recording it.

`cost-model.mjs` now solves for that crossover rather than quoting it. The
50,000 in the old walls list came from nowhere in particular.

**The three things that keep this from rotting.**

1. **The decomposition printer derives its columns from the model's keys.**
   The old one named four; the model grew to six and the totals moved while
   the columns did not — the same defect D47 found, one layer up. A printer
   that cannot go stale is worth six lines.
2. **Tripwires on the hand counts** (`scripts/pulse.test.mjs`). RULE_READS and
   TRIGGER_READS cannot be regex-derived — a regex that tried would be a
   second, silently-wrong implementation of Firestore's evaluator — so they
   are counted by hand and the test watches the *call-site totals* they were
   counted over. Add a `get()` to a rule and the test fails naming the block
   to recount. Verified by adding one.
3. **`docs/COSTS.md` joins `check:figures`.** It was covered by nothing, which
   is how it came to quote a 369-document bank two promotion cycles after the
   bank reached 389. Only the two INPUTS are gated — the bank's document count
   and its wire size — because a dollar figure is an *output* of
   `cost-model.mjs`, and re-deriving it in the figure gate would be the second
   copy of the model that `cost-arith.mjs` exists to prevent.

**The soft numbers, grouped so that they are visible.** `BYTES` holds the
published-aggregate size and the index multiplier, and it is the softest block
in the file: document-size estimates times a price this project has never been
invoiced for. The aggregate's size is not knowable before launch — it depends
on how many users fill the optional Basics card, which is what puts a `by`
breakdown in the document — so egress prints as a **band** (0.3 / 2.4 / 7 KB
per aggregate → $7 / $51 / $147 per month at 50 k DAU) and the headline table
charges the middle. A 20× band is still worth having when the alternative is
billing it at zero.

**What is still not modelled, listed rather than discovered later:** Cloud
Logging volume, the catalog trigger's third read (deliberate — catalog is not
live, D14), function retries under `retry: true`, the moderation jobs, and
callable-response egress. None is believed material at any modelled size.
That is exactly what was believed about rule and server reads before this
record, so the list is in COSTS.md to be checked rather than trusted.

**Not done.** The `answers` index exemptions (D64) cut the index multiplier
from roughly 5 to 1.4, which is why the storage line is small enough to leave
as a single estimated multiplier rather than a per-collection model. And the
engagement sensitivity line in COSTS.md is now the interesting one: three of
the six read sources are charged per *answer*, so doubling answers per user
moves reads +42% / +80% / +97% at 5 k / 50 k / 500 k DAU, where the old model
said "barely moves reads". That was true when the model only counted boots.

---

## D68 · The v18 sync: a revision arrives, and the ratchets price it honestly

**Decided:** 2026-08-07 · **Status:** binding (same standing as D43, which it
extends)

`design/InSight_standalone_18.html` supersedes v17, by the same method D43
made binding: a **three-way merge** — v17 as base, v18 as theirs, the tree as
ours — never a re-port. Fourteen of the 93 modules changed plus the page
styles, so this was a revision, not v17's restructuring; `design/README.md`
carries the change list. What follows is only what required a decision.

### What this repo kept, again

The D43 rule — *the prototype wins on design, this repo wins on enforcement,
and neither wins by default* — resolved every conflict this round too:

| Kept from this tree | Because |
| --- | --- |
| The `noCrowd` width gate on vote fills (world-feed) | v18 re-styles the fill (`WPAL.wash`); the k-floor decides whether it has a width at all (D1). Both landed. |
| Imports over `window.*` for every v18-new cross-module read | v18's Explore reads `IS_TEST_RESULTS`/`IS_DATA` off the bridge; here they are the named exports the D39 conversions already made. Coupling held at 539 — a sync that adds reads is exactly where the ratchet earns its keep. |
| `WORLD_FEED_QS` stays a shared global in the new Explore | Four writers and a live/demo boundary (D39's `world-catalogs.js` note). Converting it is a design change, not a sync. |
| The repo's duel-bank voice and ids (`content/duel-questions.json`, D32/D40) | v18's ten mirror questions and four rebuckets landed in the JSON at their ladder positions with fresh ids (`040`–`049`); the repo's second-person phrasings of existing questions stayed. Mirror prompts keep v18's "they" voice on purpose — in that domain you answer about your partner. |
| Escape-stays-in-the-dialog on the relmap legend input | The add-circle input this tree had already guarded is gone; the guard moved onto v18's rename-in-place input. Escape closing the whole map mid-rename is the bug it existed for. |

**Two prototype slips were not copied**, per the D43 braces precedent, each
with the reasoning at the site: v18's `setScale` rebuilds the roster without
re-applying the name-keyed relation overrides (a persisted drag visibly
reverts on a scale switch), and its drop-ring block reads a variable the
enclosing scope never declares — `no-undef`, ON for this layer since two
`ReferenceError`s shipped, refused it here.

### What the sync moved, mechanically

The ten mirror questions grow the seeded bank 389 → 399. The seed keys docs
by explicit id and only refuses option-set edits (D58), so this is ordinary
content growth: new docs create active, `seq` renumbers behind them, and the
duo rotation remaps under `% bank.length` — the accepted cost of any duel-bank
growth, distinct from the romantic pool's `active: false` arrival, whose
concern was wrong-pool rotation on pre-mode clients, not remapping.
`check:figures` caught all five prose figures; COSTS.md's measured 84.9 KiB
is annotated rather than re-guessed.

### The ratchets moved the right way

Coupling: **539, unchanged** — every v18-new cross-module reference entered as
an import. Accessibility: **9 → 8**, because the deleted add-circle input took
its `autoFocus` with it. Suppressions: 30 → 31 — one `exhaustive-deps` defer
on Explore's cache-invalidation dep, recorded like the rest. Entry chunk 837
KB, under the 850 ceiling.

### What now proves it

`check:globals`, lint (`no-undef` on), `tsc -b`, `check:a11y`,
`check:content`, `check:neighbors`, `check:figures`, `check:bundle`, the 445
client tests (444 + the Explore mount case this sync added) and 195
functions tests — all green at this commit, re-run after merging main's
D66/D67 (which is why this record is D68: both branches minted a D66, and
the merge renumbered this one).
`scripts/style-diff.mjs` now points at v18 and, as with D43, has not been run
against it here (needs a browser and a dev server); it remains the next cheap
thing anyone touching this layer can do.

---

## D69 · EU trader status: a home address on the listing, in exchange for 27 storefronts

**Date:** 2026-08-07 · **Status:** Adopted

**The requirement, and how it was found.** The Digital Services Act obliges
Apple to publish trader details for apps distributed in the EU. App Store
Connect states it plainly: *"your trader status must be provided or your apps
will be removed from the App Store in the EU."* It is a hard gate on EU
availability, not a warning.

It appears nowhere in this repo, and no gate here could have caught it.
`check:store-copy` and `check:store-listing` hold what the **repo** can see —
placeholders in committed files, fields against character limits. A
store-side legal requirement introduced after those scripts were written is
invisible to both, and would have stayed invisible until a submission was
rejected. It was found by reading a console banner on 2026-08-07 while
creating the app record.

**The trade.** Declaring **trader** publishes a name, address, phone number
and email address on the public listing. Declaring **non-trader** keeps them
private and forfeits the 27 EU storefronts.

The address is the sharp end. D41 chose an *individual* Apple enrolment, and
D42 parked the ENK registration when Play was deferred — so there is no
company address to give. LAUNCH-RUNBOOK 0.3 records the operator as a sole
trader in Norway, and a sole trader's business address is a home address.
**Declaring trader publishes it.**

**Norway is EEA, not EU.** The Norwegian storefront is unaffected either way,
so this decision buys the EU 27 specifically. Launching Norway-only and
returning to it later was available and was not taken.

**Decision: declare trader.** The reasoning is that a market this app is
built for should not be given up to avoid a disclosure the law deliberately
requires, and that the alternative is not "launch without deciding" but
"launch to a smaller market and decide anyway".

**What this costs, stated rather than discovered later.** A home address on a
public listing is not retractable — it is scraped, mirrored and archived
within days of publication. The way out is not a form change but an address
change: registering the ENK gives a business address that can replace it, and
that is the one thing that would make this reversible. **D42 parked the ENK
for Play's sake, and this is a second, independent reason to want it.**
Re-read D41, D42 and this record together when either is revisited; none of
the three is the whole picture on its own.

**Not done, deliberately.** No attempt to automate the declaration.
`scripts/asc-push.mjs` fills text and transcribes the privacy label from a
reviewed file; trader status is an identity assertion to a regulator, and the
argument in that script's header for transcribing an attestation does not
extend to declaring one.
## D70 · The two duel indexes were bounded twice and diverged, and a reveal folded votes into a question nobody answered

**Decided:** 2026-08-07 · **Status:** binding

Two defects on the duel path, found by a categorical review of the tree. They
are recorded together because they share a cause: a number that was written
out twice, and a question that was chosen by whichever read arrived first.

### 1. `guessIdx < 20`, beside an `optionIdx` bound that had already been fixed

`firestore.rules` bounded a duel answer's two indexes separately. `optionIdx`
was widened — the per-question expression (`options.size()`, or the group's
member count for `pick` questions, whose options ARE the group) with a `< 64`
outer sanity bound — under a comment naming the exact bug: *"Must clear
GROUP_CAP (32) or members past the 20th become unpickable on every pick day."*
Its sibling three lines below still read `< 20`.

The arithmetic: GROUP_CAP is 32, so a `pick` question in a group of more than
20 has member indexes the `optionIdx` bound admits and the `guessIdx` bound
refuses — members 21–32 could be voted for but not guessed.

**Corrected on review:** that symptom is not reachable by the shipped client.
`LiveDuelPanel` sends `guessIdx` only when `duo` is true, and a duo is capped
at 2 members, so no live client has ever sent a guess index above 1. The bound
was still wrong, and the live effect of fixing it is the other direction: a duo
guess is now held to the question's own option count instead of a flat 20, so a
fabricated index between the two no longer reaches `duelAggDelta` — whose range
check was the only thing standing between it and a published aggregate. The
group-day symptom is what the bound would have cost the first time guessing was
extended past a duo, which the shared `duelIndexSpace()` now prevents by
construction.

`firestore-tests/rules.test.ts` had a case written for precisely this bug
class ("…not just the first 20"). Its fixture never set `guessIdx`, so it
passed throughout. Both bounds now call one `duelIndexSpace()` function, and
the test sets the field. Verified by reverting the rule with the new tests in
place: both fail, which is the only evidence that they test anything.

Repeated `get()`s on one path are deduped within a rules evaluation, so
calling the function twice costs no additional document access.

### 2. The reveal published one member's question over everyone's votes

Members compute the day's duel question independently — `duelQFor`
(`src/v2/data/deck.ts`) is a pure function of (gid, utcDay, bank) and the
**bank length is the modulus**. A promotion, or an `active:false` flip,
remaps the rotation for whoever refreshes their cached bank first, so two
members answering different questions on the same day needs no hacked client.
Rules cannot catch it: they check the qid exists in the bank, and both do.

`revealGroupDay` chose the reveal's question with `qid = qid || s.get("qid")`
— first counted answer wins, i.e. **`memberUids` order decides**. That much
was known and accepted for display (the old `deck.ts` comment said a drifted
client "still reveals coherently, it has just answered a different question").

What the comment predated is `foldDuelSignal` (D40 part 3). Those same votes
were folded into the chosen question's **published, k-floored aggregate**.
`duelAggDelta`'s range check cannot see this: a vote cast on question A with
`optionIdx` 1 lands in bucket "1" of question B whenever 1 is a legal option
of B. Not a dropped count — a wrong one, inside the one surface the whole
disclosure apparatus exists to protect. For a split duo it was worse than a
miscount: `votes.length === 2` let a guess be scored against an answer to a
different question.

Two changes, both in `pure.ts` so they are testable without an emulator:

- `revealQid` picks by **plurality**, ties broken on lexical qid. The drifted
  client is the minority by definition, so plurality names the question the
  group actually played, and the result no longer depends on member order or
  on which read returned first — a retried transaction cannot pick differently.
- `votesMatchingQid` filters the fold to votes actually cast on that question.

**The reveal doc still carries every vote.** Dropping one there is the
"silently discarded" outcome the reveal transaction is built to avoid, and a
member who played belongs in their group's reveal whatever their client's bank
said. Only the cross-group aggregate is filtered, because it is a claim about
one question.

**The accepted cost, stated:** on a split, the minority's votes are folded
into no aggregate at all rather than into their own. Folding them separately
would mint a second `plays: 1` from a single group-day and count one reveal as
two plays of two questions. The aggregate is advisory and floored; a
group-day under-counted by the minority is survivable, a group-day counted
against the wrong question is not.

### What is still true after this

The residual is display-only and unchanged: on a split, the minority sees the
majority's prompt above their own answer in the reveal. Fixing that needs a
per-vote qid on the reveal doc and a client that renders it — a schema change,
not a correctness one, and not worth spending on a case that only occurs
between a bank revision and a cache refresh.

## D71 · A reveal now says which question each answer was to, and nothing compares across that line

**Decided:** 2026-08-07 · **Status:** binding (completes D70)

D70 stopped a vote cast on one question being folded into another question's
published aggregate. It deliberately left the display half: the reveal doc
carried a single `qid`, so a member whose client had drifted still saw their
answer rendered under the group's prompt. That was recorded as a known limit —
"display-only, not worth a schema change". Reviewing it again, that judgment
was wrong about the *scope*, not the severity.

The single `qid` was not only mislabelling one line on the reveal card. Every
consumer downstream compares `optionIdx` values across members, and none of
them could tell that two answers belonged to different questions:

| Surface | What it claimed | Why it was wrong |
| --- | --- | --- |
| Reveal card (`LiveDuelPanel`) | "Ada · Tea" | Ada answered a different prompt; index 1 of hers is not "Tea" |
| Reveal card, duo | "called it" | compared a guess about one question to an answer about another — true by coincidence |
| `portraitRow` | a 3–0 consensus | one of the three answered something else |
| `groupPortrait` people | "your twin" / "breaks ranks" | a day two people answered different questions counted as agreement or dissent |

The last two are the ones that changed the decision. They are not a mislabel,
they are **fabricated relationships between named people** — the exact class D1
forbids, and the twin/contrarian labels put a real person's name to it.

### The change

`RevealVote` gains an optional `qid`, written **only** when that vote was not an
answer to the question the day is published under (`revealVotes`, pure.ts).
Absent means "the revealed question", so:

- the common case writes byte-identical documents to what it wrote before, and
- every reveal written before D71 reads correctly with no migration.

Then everything that compares two indexes goes through one notion of which
question a vote belongs to — `voteQid` in `groupPortrait.ts` on the client,
the stamp itself on the server:

- the reveal card renders each off-question answer under **its own prompt**,
  with that question's option labels, under a "was asked a different question"
  heading;
- a duo guess is scored only when both partners answered the same question;
- `portraitRow` counts only same-question answers and reports `offQuestion`
  rather than hiding the difference — and when the off-question answer is the
  viewer's own, the day stops counting toward their alignment, because they
  have no option in that row's space;
- pairwise agreement skips a day two members did not share a question.

### What this costs

A reveal doc grows by one short string per drifted vote, which is zero in the
common case. Nothing else changes shape.

### Two corrections this review also produced

- **D70 overstated the `guessIdx` bug's field impact.** The shipped client only
  ever sends `guessIdx` in a duo (2 members), so "members 21–32 unguessable"
  was unreachable. D70 now says so. The bound was still wrong and the fix still
  earns its place — see the correction in that record.
- **`firestore.rules` claimed duel answers "never" feed aggregates**, in the
  comment justifying their D29 device-binding exemption. False since D40 part
  3: `foldDuelSignal` publishes `v2_question_aggs/duel-{qid}`. The exemption
  stands on the invite-code argument, which does hold; the comment now says
  what is actually true, because a comment that overstates a carve-out is how
  the carve-out outlives its reason.

## D72 · Two fabrications that outlived the badge: the Map's group stats and the results card's friends

**Date:** 2026-08-07 · **Status:** Adopted

**What was shipping.** Two surfaces drew prototype data in a live build, and
neither wore the Preview tag that D1's honesty posture leans on.

1. **`window.MapStats` — the Map's group statistics.** `map-group-stats.js`
   hashes a question id into a distribution, and `map-bottom-card.jsx` drew it
   with **no live gate at any of its five call sites**. Measured with the
   live fixture before the fix, tapping one answer dot rendered:

   > 48% · You're with the majority · of **people your age** chose the same ·
   > you: **30–39** · Know 48% · Be known 32% · Both 20%

   Every figure is `hash("daily-000|age|0")`. The answer beside them is real
   and the age band is the viewer's own, which is what makes it worse than a
   demo screen: the fabrication is the only part a user cannot tell apart.
   The anchor card added a second claim on the same data — "62% of your
   answers match people your age", with a "where you differ" list under it.

   `MirrorPreviewTag` returns null for `popId === 'you'`, because that badge
   is keyed to **population** and the Map is not one. So this was the one
   Mirror stop where sample data carried no label at all — the same hole D66
   closed for the anchor ring, one layer further in.

2. **The results card's same-type friends.** `result-card.jsx` filtered
   `IS_DATA.people` — the prototype's seven invented friends — through
   `IS_FRIEND_TYPES` and handed up to four of them to `SigEmblem`, which drew
   their avatars on the result. `data/live.ts` replaces `WORLD_FEED_QS`,
   `TEST_FEED_QS` and `WORLD_FEED_COMMENTS`; it has never touched `IS_DATA`.
   Measured: initials **HV** and **IV** — Henrik Vold and Ingrid Vold — on a
   live account's Big Five card. D1's words are *"No seeded fake users,
   ever"*, and this was the last surface still doing it.

**Why it survived.** Both are invisible to every gate this repo has.
`check:globals` is name-level, `no-undef` sees a defined name, `tsc -b` does
not read `.jsx`, and the mount tests assert on the ErrorBoundary — a
fabricated number renders perfectly. The Map case additionally needs a
question answered and a dot tapped before it appears, so no mount walk
reached it. Both were found by reading the live/demo seam file by file and
then rendering the two components against the live fixture; neither would
have been found by reasoning about the code, and the second is documented
nowhere in `docs/` at all.

The first was *known* — `docs/MIRROR.md` §5 has said "the Map's typicality
stats are still synthetic" since the file was written — but it was recorded
as prose rather than as a deferral with arithmetic, which is the difference
this file exists to make. A known limit that no test pins is a limit that
ships.

**Decision.** `MapStats.dist`, `.mode` and `.dimVal` return **null** when
`LIVE.enabled`. `sameType` is empty in live mode.

Returning null rather than gating at the call sites is the load-bearing half:
a consumer that forgets the check throws in `smoke-live.test.jsx` instead of
quietly fabricating, which is the failure mode that produced this entry.
`groupLabel` is exempt — it is a noun for the cohort, not a claim about it,
and the honest empty states still want to name the group.

**What live mode draws instead.** The tapped-answer card and the anchor card
show one line — *"Your answer is on the map. How people your age answered
isn't measured yet — it needs more people on this question first."* The
anchor card keeps `MTAnchorStat`, because your own test scores are a real
measurement; only the "them" marker and its legend key go. Dot placement
needed no change: `map-tab.jsx` already read `MapStats` through a null guard,
and its fallbacks (`typ = 0.5`, `maj = true`) are exactly the neutral
result — every dot at one radius, none marked a rare take.

**The arithmetic on what is deferred.** A real source exists for part of
this and was not wired here, because that is a feature rather than a leak
fix. `v2_question_aggs.by` carries k-floored per-anchor breakdowns on
`BREAKDOWN_DIMS` — so the Map's **age** and **edu** anchors have a real
counterpart today, and could render measured splits the way `LiveCohortBody`
does. The other five cannot: `job` is profession, deliberately not a
breakdown dim (D8 — free text mints a bucket key per spelling), and the four
test anchors are not dims at all. So the honest state is the correct
destination for five of seven regardless, and two are a follow-up with a
known source. With production at zero answers today, all seven would render
the empty state either way.

**Not changed, deliberately.** Learn dots still place by `card.p`, the
authored "% who get this right". That is content shipped with the card — a
difficulty rating — not a statistic about a population that does not exist,
and `LEARN_SPLIT` already labels measured vs estimate at the reveal
(D32). Reconsider it if `p` ever starts being read as a measurement.

**What now proves it.** Four cases in `smoke-live.test.jsx`, each with its
demo-mode control, because "the card stopped rendering" passes every live
assertion on its own. Verified by neutralising both gates and re-running:
the live cases fail with `expected [ 48, 32, 20 ] to be null` and
`expected [ 'HV', 'HV', 'IV', 'IV' ] to deeply equal []`, and the controls
stay green. Coupling held flat at 534 — both gates read `LIVE` through the
module import, not `window.LIVE`.

**Numbered D72, on the third attempt, and the two failures are the point.**
This was first written as D70. D69 landed on main mid-work, so the branch was
rebased onto it and the number re-checked — still D70, now verified rather
than assumed. Then, while CI was green and this was waiting to merge, main
merged **its own D70 and D71** (the duel indexes), and the rebase turned out
to have bought nothing: it proves the number was free when you looked, not
that it stays free while you work. Renumbered to D72 at the merge.

D68 said the same thing after two branches minted a D66, and the correct
reading of it is stronger than "rebase first". **A decision number cannot be
reserved, so it is not settled until the merge that lands it.** Anything that
quotes one before then — a commit message, a code comment, a PR body — is a
claim about another branch's future. The three renumbering passes here each
had to sweep code comments, `CLAUDE.md`, `docs/MIRROR.md` and this file
together, which is the real cost and the reason this paragraph exists.

Nothing enforces it. `check:figures` holds documented figures against the
tree, but a collision is two files agreeing with each other and disagreeing
with a branch nobody has merged yet — invisible to any check that reads one
checkout. Grep `^## D` on freshly-fetched `origin/main` immediately before
merging; that is the whole procedure.

## D73 · The privacy label has no endpoint, so the script prints the form instead

**Decided:** 2026-08-07 · **Status:** binding

`scripts/asc-push.mjs --privacy` no longer writes. It prints
`design/store/app-privacy.json` as the App Privacy web form — row by row, in
the order App Store Connect asks — and a human copies it across. The age
rating next door still pushes; the only difference between the two is which
one Apple exposes.

**This is Apple's constraint, not a scope decision.** The App Store Connect
API has no App Privacy resource of any kind. Verified three independent ways,
because one error message is evidence about one URL and not about what an API
contains:

1. **The live API.** `GET /v1/apps/{id}/appDataUsages` → 404, *"The
   relationship 'appDataUsages' does not exist"*.
2. **Apple's own OpenAPI specification** (4.2, 925 paths). The string
   `DataUsage` does not occur in it anywhere, and the `App` schema's
   relationship list — 43 entries, down to `webhooks` and
   `androidToIosAppMappingDetails` — has nothing privacy-shaped.
3. **The documentation index.** App Store › App Metadata lists app infos,
   localizations, versions, screenshots, previews, categories and age
   ratings. There is no privacy section, and the release notes through 4.4
   never mention one.

**What it cost to learn, which is the part worth recording.** The
reconciliation block shipped three times and failed in production three
times: a 400 on an `?include=` Apple rejects, a 403 on a `GET` of a
write-only resource, then that 404. Every one of them *looked* like a wrong
path — Apple's errors are phrased in terms of paths — so each round produced
a different path rather than the question **"does this resource exist at
all?"**. Asking that question directly took ten minutes and ended it.

The rule, stated so the next person does not pay for it again: **when an API
answers three different 4xx to three different guesses, stop guessing paths
and go read what resources it has.** Three wrong answers in the same place is
not three bugs; it is one wrong model.

**The stub is where this is now enforced.** `scripts/asc-push.test.mjs` used
to answer 200 to `appDataUsages`, which is exactly why a client for a
non-existent resource could ship green — the second time that stub's leniency
hid a real 4xx, after the `include=` 400. It now returns Apple's own 404 for
any path containing `appDataUsage` or `appPrivacy`, and a test asserts that
`--privacy --apply` performs **zero** writes. A rebuilt write path fails on
the bench instead of in production. A lenient stub does not test a client; it
tests itself.

**What did not change, and deliberately.** `app-privacy.json` stays, and so
does `check:store-forms`. The argument for holding an attestation as
reviewed data rather than ~40 remembered clicks never depended on there being
an endpoint — it is about the answers agreeing with `data-inventory.md`, and
that is the failure that put "collects no email or name via Google" in three
documents at once. The printout keeps the transcription mechanical; the gate
keeps it honest.

**One guard was relaxed on purpose.** The block used to `exit 1` when
`tracking.used` was not `false`, on the grounds that turning tracking on
unattended is a decision with an ATT prompt behind it. That was right while
it pushed. A *report* that refuses to print is just a report nobody can read,
so it now prints the tracking answer first and warns that the form will ask a
per-row tracking question this printout does not answer.

**It also corrects D69.** That record's closing paragraph says asc-push
"transcribes the privacy label from a reviewed file", which was true of the
intent and never of the code. D69's actual subject — trader status, and the
refusal to automate an identity assertion to a regulator — is untouched.

## D74 · A tick is a claim, and this one was printed before the write

**Decided:** 2026-08-07 · **Status:** binding

Two defects in `scripts/asc-push.mjs`, found by the first real `--apply` run.
The second is much the worse of them.

**1. `whatsNew` cannot be set on a first release.** "What's New in This
Version" has no meaning when there is no previous version, and Apple answers
the PATCH with a 409 naming the attribute. It now travels in its own request,
so the refusal cannot take anything else with it, and the refusal itself is
reported as a skip rather than thrown.

Split rather than state-modelled, deliberately. The alternative was deciding
up front whether the app has ever had a released version — which means
encoding Apple's version state machine from outside it and guessing whether
`READY_FOR_SALE`, `PENDING_DEVELOPER_RELEASE` and `REPLACED_WITH_NEW_VERSION`
each count. Apple answers that question exactly and for free. D73 is the
whole argument for asking rather than guessing, and it was one day old.

The skip is scoped to one attribute, one status and one message, and a test
proves a 409 on any other field still exits non-zero. It is also conditional
rather than permanent — a second test drives the allowed case, because
"handled" must not come to mean "never sent again" and ship the first real
update with last release's notes.

**2. The report ticked eight fields and wrote three of them.** A PATCH is
atomic. `whatsNew` rode in the same body as `description`, `keywords`,
`promotionalText`, `supportUrl` and `marketingUrl`; Apple refused the one and
dropped all six. The run printed:

```
  ✓ version.description: "" → "One question a day. You answer it blind…"
  ✓ version.keywords:    "" → "poll,opinion,personality,quiz,friends…"
  …
Error: PATCH /v1/appStoreVersionLocalizations/… → 409
```

Every one of those ticks was false, because the loop printed the diff and
*then* wrote it. `+` before a write is a statement of intent and is fine. `✓`
is a statement of fact and has to be earned, so it now prints only after the
call returns.

**This is the third instance of one mistake, which is why it is a record and
not a commit message.** The seed workflow reported Success over a 500 because
`cmd | tee` returns tee's status. The metadata job summary printed "Dry run.
Nothing was written" over a run that had died on a 400, because stderr was
never captured. Now a script ticked fields it had not written. Different
mechanisms, one failure: **a report describing an outcome the run did not
have.** The general rule, stated once here rather than re-derived a fourth
time — *emit the claim after the thing it claims, never before, and prefer a
missing line to a false one.*

**What now proves it.** Five cases in `scripts/asc-push.test.mjs`, and the
stub is a first release by default because production is one. Verified by
neutralising each fix and re-running rather than by reading the diff:
restoring the pre-write tick fails one case (`expected … not to match /✓ app
info\./`), and folding `whatsNew` back into the group body fails five.

## D75 · Apple's eight new age-rating questions, and the half of the form nothing was checking

**Decided:** 2026-08-07 · **Status:** binding

`app-privacy.json` answered fourteen age-rating attributes. Apple requires
twenty-two. The eight it had never heard of rejected the entire PATCH — one
409 error per missing attribute, naming each — so the age rating could not be
written at all, not merely written incompletely.

The eight, with what each is answered from. Types are Apple's, read out of
the App Store Connect OpenAPI spec rather than inferred from the names:
seven booleans and one frequency enum, and guessing boolean for the enum
would have been a 400 that reads like a wrong value.

| Attribute | Answer | From |
| --- | --- | --- |
| `userGeneratedContent` | `true` | Display names in group and duel reveals. The one that actually drives the rating. |
| `messagingAndChat` | `false` | Takes are circle-scoped (D1) and demo-only in a shipping build; Comments and Who-voted are `!S.live`-gated. |
| `advertising` | `false` | No ad SDK. The Facebook SDK is transitive and stripped at postinstall (D16); `check:ios-facebook` asserts it. |
| `lootBox` | `false` | No in-app purchases at all (`MONETIZATION.md`). |
| `parentalControls` | `false` | The app provides none. The question asks what it offers, not what it needs. |
| `ageAssurance` | `false` | No age verification or estimation; anonymous-first auth (D3) collects no birth date. |
| `gunsOrOtherWeapons` | `"NONE"` | **Measured** — zero hits across all five committed banks for fifteen weapon terms. |
| `healthOrWellnessTopics` | `false` | **Measured** — three hits, none of them health content. |

The three health hits are recorded because "no hits" and "three hits I judged
irrelevant" are different claims and only one of them is honest here:
*Medicine* is one of four options on "Humanity's best invention?", and the
other two are Map taxonomy — `CAT_META`'s `Body` category carries `seedId:
'health'` for its palette hue, and one cuisine question files under
`Body / Health`. A category label is not a health topic.

**`messagingAndChat` has a known expiry.** It moves the day takes go live,
together with `EMAILS_OR_TEXT_MESSAGES` in the not-collected list. Same
trigger, and they must move together — which is also when Apple guideline 1.2
stops being comfortable.

**The prediction was right and still did not help.** `$socialMediaQuestions`
was written the same day, from a banner in App Store Connect, and it called
this exactly: Apple has added questions, `asc-push` PATCHes only the listed
keys, so anything new is left unset. It got one thing wrong — it said an
unset required field would "block submission". Apple is stricter: it rejects
the write. Knowing the cause and mispredicting the symptom still cost a
debugging round, because the note read as a thing to check later rather than
a thing that would fail now.

**So the real change is rule 5 of `check:store-forms`.** The privacy half of
`app-privacy.json` had been gated against its prose since the day it was
written. The age-rating half in the same file was gated by nothing, and that
script's own header explained why: those answers "are prose sentences rather
than table cells, and a checker that pretends to parse them would give false
confidence".

True of the prose as it stood, and the wrong conclusion. **The fix for a
table nobody can parse is to write a table.** `STORE-FORMS.md` now carries
every attribute keyed by its API name with the literal JSON value, and the
gate compares key and value in both directions. Twenty-two answers, checked.

What it still cannot do is notice when Apple ADDS a field — no gate reading
this checkout can, and pretending otherwise would repeat the mistake in the
other direction. What it guarantees is narrower and worth having: the answer
a human reviewed and the answer that gets pushed are the same answer.

**And D74 was fixed in one of three places.** That record was one commit old.
The text block reported after its write; the age-rating block still ticked
fourteen fields above a 409 that wrote none of them, and the screenshot block
still ticked all six uploads before a byte moved. Both are now corrected, and
the stub demands the eight attributes so a dropped answer fails on the bench.

The rule that would have caught it, stated plainly: **when a record says a
mistake has a shape, grep the shape.** `APPLY ? "✓" : "+"` was three lines in
one file. Fixing the instance in front of you and writing the record about
the general case is worse than either alone — it leaves the tree broken and
the documentation claiming otherwise.

## D76 · Crash reporting flips to opt-out, and the ErrorBoundary reports what it catches

Decided 2026-08-08. Two changes with one motive: a crash on a phone in the
field was invisible unless its user had first found a toggle and switched
telemetry on, and the app's most user-visible failure never reached the
dashboard even then.

**The default.** `telemetryEnabled()` now reads `insight.telemetry.v1` as
on-unless-`"false"` rather than off-unless-`"true"`. A recorded opt-out
keeps holding — the send-site gates that make the panel's "Off — this app
sends no reports" absolute (reportError and setSentryUser gate on the flag,
not on the SDK being up) are untouched; they just read the new default.
Unreadable storage still reads as OFF, deliberately: a store that cannot be
read is also one that could not have recorded an opt-out, and silence is
the only side that cannot betray a recorded choice. The DSN gate is
untouched too — no `VITE_SENTRY_DSN`, no Sentry — so dev builds and the
emulators stay silent, and the dead-branch build guarantee from the
`check:bundle` entry still holds in DSN-less builds.

**The boundary.** React swallows what an error boundary catches, so
Sentry's global handlers never saw the crashes that end at "This view hit a
snag" — the app-shell `ErrorBoundary` costs a card instead of the app (its
point), and in exchange the failure reported to nobody but the local
console. Its `componentDidCatch` now calls `reportError` with the component
stack. The comment beside the overlay openers claimed the spec layer "has
no import path to src/lib"; spec files have imported `../data/live` and
siblings since the conversions began, and app-shell now imports lib/sentry
the same way. The openers themselves keep their console.error — main.jsx
already reports a loadOverlays failure once when the chunk dies, and one
failure should not re-report on every tap.

**Every prose claim moved in the same commit** — privacy.html (re-dated),
data-inventory.md, STORE-FORMS.md ×3, SHIP-CHECKLIST.md, COSTS.md,
app-privacy.json's `$why`, .env.example, the panel copy, and lib/sentry.ts's
own header. The store ANSWERS do not move: Crash Data was declared
collected even while default-off, because the form asks what the app *can*
collect, and Play's "Optional" survives because the user can still switch
collection off. What moves is only the prose explaining the default.

**Known trade, recorded.** Default-on diagnostics tied to a uid is the kind
of processing EU consent guidance reads narrowly. The mitigations are the
ones already built: uid-only payloads, `sendDefaultPii: false`, no session
replay, an opt-out honoured at every send site, and a privacy policy that
says exactly what happens. The residual flagged in the purge review stands
unchanged (an SDK already running keeps running until restart after an
opt-out mid-session; the close() is best-effort, the gates are the
guarantee). If this ever needs to flip back, it is one comparison in
`telemetryEnabled()` plus this prose, reversed.

## D77 · The app knew why it had failed and told a console nobody could reach

**Decided:** 2026-08-08 · **Status:** binding

The first device this app ever ran on booted into `demoInProd` — a live
build whose boot never attached, showing the prototype's invented people to
a real user behind a "Sample questions · reconnecting…" pill. The label was
correct and D1 required it. It was also the entire diagnostic surface, and
it says *that* something failed while withholding *what*.

Everything else was reachable and none of it was enough. The App Check
console proved nothing was enforced. `identitytoolkit accounts:signUp`
against the production key returned a real token, so anonymous sign-in
worked from outside the app. Firebase's user list showed no account created
that day, which located the failure at the first step of boot and no
further. The reason itself existed, once, in a `console.warn` on a phone —
and an iPhone's console needs a Mac, **the single dependency
`ios-release.yml` was written to remove.**

**So the reason is now a value.** `LIVE.bootError` carries it, the pill is a
button, and one tap shows it. Behind a tap rather than on the face of the
card because both halves are deliberate: someone on a train should read
"reconnecting…", and someone debugging should not need a laptop.

D76 landed the same day and fixes the remote half — telemetry is opt-out
now, so a boot failure reports itself. This is still worth having, because
the two fail differently: Sentry needs a DSN, a network healthy enough to
send on, and someone at a dashboard. **A boot failure whose cause is the
network is exactly the case where the remote path is least likely to
arrive.** The build on the phone also predated D76 — the gap was real for
the one device that mattered.

**A second silence, closed with it.** `anonSignIn` awaited
`onAuthStateChanged` with no clock. That callback normally fires within a
tick, with `null` on a first run, but it is the SDK's persistence layer that
decides — and a WebView whose storage it cannot open owes nobody a
callback. Unguarded, that hangs boot forever: no uid, no error, no Sentry
event, no `bootError` either, and a pill that says "reconnecting…" truthfully
and permanently. It now falls through to `signInAnonymously` after five
seconds. Falling through rather than throwing: the wait exists to avoid
REPLACING a returning session, and after five seconds of silence there is
no session to replace, while refusing to sign in guarantees the demo deck.

`nativeGoogleIdToken` in the same file already had this exact guard, with
the reasoning written out — *"a misconfigured build never opens it at all
and the promise then never settles… Fail loudly instead — a wrong config
should look like a bug, not a hang."* The argument was correct and general
and had been applied to one of the two call sites. **That is the same shape
as D74's tick, three days apart: a rule written down next to one instance
of the thing it describes.** When a comment explains why a hazard matters,
grep for the hazard.

**Not yet known: what the device actually hit.** This does not diagnose it;
it makes the next run diagnose itself. Naming that plainly because a
decision record that implies a fix it did not make is worse than none — the
next build says the reason on screen, and that is the whole claim.

**What proves it.** Two cases in `smoke-live.test.jsx`, the only guard that
executes a render: the reason is absent until the pill is tapped and present
after, and a healthy boot shows no pill at all. Verified by neutralising the
reason and re-running rather than by reading the diff. `bootError` joins the
pinned `window.LIVE` surface in `live-surface.ts`, which caught it being
added — as designed — in both the real store and the fixture.

Converting the banner to the imported `LIVE` took `daily-split.jsx` from 50
cross-module globals to 48 and the tree from 534 to 532 (D39). The other ~48
in that file stay: each `window.LIVE &&` guard has to be re-read rather than
deleted wholesale, because an imported binding cannot be unset but the data
it carries can still be missing.

---

## D78 · The takes surface goes live circle-first, and world takes get a costed proposal

**Decided:** 2026-08-08 · **Status:** part 1 **binding**, part 2 **Proposed**

Two things that had drifted into one question: whether takes exist *at all*
on a live build, and whether they exist at **world scale**. The first was
never a D1 question and had no live client. The second is the one D1
actually decides, and it is proposed here rather than taken.

### Part 1 (binding) — the client half of the moderation chain exists now

The moderation substrate shipped 2026-07-31 (D22) and has been deployed in
advisory mode since: `v2_takes`, `v2_flags`, the queue, the two MOD_UIDS
callables, rules with negative tests, an e2e leg in CI. What it has never
had is a client. `grep -rn v2_takes src/` returned **nothing** — no read, no
write, no report control — so every one of those guarantees has been
enforcing a collection that no device could reach. `docs/MODERATION.md`
named the gap ("the client report control (needs a live takes surface)")
and it stayed named for eight days.

`SOCIAL` now carries six members — `loadTakes`, `takes`, `postTake`,
`deleteTake`, `flagTake`, `flagged` — pinned in `test/live-surface.ts` and
stubbed in the fixture like every other member of that surface. This is
**circle-scoped**, so it needs nothing from D1 that D1 does not already
grant, and no rules change: every gate resolves membership through
`v2_groups/{gid}.memberUids`, exactly as written.

**The list query is the part worth the test file.** The read rule is an
equality on `hidden`, and Firestore holds a list only to a rule it can
compare against the query's own constraints — so a client that drops
`where("hidden", "==", false)` does not read more takes, it gets
permission-denied on every circle on every device (D65). Nothing else in
this tree catches that: `tsc -b` sees a well-typed query, eslint sees
nothing, `check:globals` sees no name, and `firestore-tests` exercise the
*rule* rather than the client that has to match it.

Measured rather than reasoned about, which is the only reason this record
claims it: deleting that one line from `loadTakes` leaves the tree green and
fails exactly three cases in `data/takes.test.ts`.

The same file pins the shapes the rules check literally and a caller cannot
infer: the six keys `hasOnly` permits with `hidden` written **false** rather
than omitted, the flag id `takeId + "_" + uid`, the 280-char cap, and the
client-minted take id the moderation queue keys on. Plus the query's
agreement with the one committed composite index (`gid`, `hidden`,
`createdAt DESC`) — added on the owner's call in D65 for a client that did
not exist yet, and now used by the one that does.

**One bug found by adding the state, not by reasoning about it.**
`resetForNewUid` clears every field derived from the old uid — its own
comment says why: "one account's answers render as the other's." Three new
fields were not on that list. Circle takes are member-gated, so a cached
list belongs to a circle the *new* account may not be in; and a surviving
`myFlags` marks takes "Reported" that this account never reported, against
a collection that is `allow read: if false` by design and therefore cannot
be re-read to correct the claim. Fixed with the rest of the purge, pinned
by a uid-change case, and confirmed the same way as the query filter:
removing the three lines fails it.

**What part 1 does not do.** It adds no UI. The take list and the report
control have a design question in front of them that this record cannot
answer, and inventing a surface to fill the gap is the shape D1 forbids.
The data layer is the half with the rules-shaped hazards in it; the half
with the design decisions in it waits for the design.

**Amendment (same day) — the UI was asked for and built.**
`ui/LiveTakesPanel.tsx`: the circle's takes on one question, a composer,
and the report control. The paragraph above is superseded on the facts and
kept for the reasoning, which held — the design question was answered by
the owner asking for it, not by this record guessing.

Three things in that panel read as styling and are consequences of
`firestore.rules`. Each is commented at its site and pinned in
`LiveTakesPanel.test.tsx`, because each is exactly the kind of thing a
later tidy-up removes:

- **Reporting takes two taps.** `v2_flags` is `allow update, delete: if
  false` — a cast flag cannot be withdrawn by the reporter, the author, or
  a moderator. The demo's one-tap report (`WF_REPORT`) is local and
  undoable; this one is neither. A single tap on an irreversible write
  turns a misplaced thumb into a permanent record.
- **There is no reason picker.** The demo offers four chips. The create
  rule is `hasOnly(["takeId", "gid", "uid", "at"])`, so a reason has no
  field to live in — and nothing would read it if it did: the run derives
  its own policy line (H1–H5) from the take's text. A picker would be a
  form whose answer is discarded on send.
- **A reported take stays on screen.** The demo replaces it with a
  tombstone. Flags are `allow read: if false`, so a local hide has nothing
  to rehydrate from and would reappear on the next load — a worse lie than
  never hiding it. Soft-hide is the moderator's verdict, not the
  reporter's.

And the copy does not promise removal, because `MOD_ADVISORY` is true and
nothing is hidden today. "A moderator reviews flagged takes against the
posted policy" is what is true; a test asserts the string does not drift
into *will be removed*. Measured the same way as the rest: making the
control one-tap fails five cases.

**Mounted on the reveal, and deliberately nowhere else.** `LdReveal`
renders it against yesterday's revealed question; today's card does not
get one. Today's answer is sealed until tomorrow, and free text beside a
sealed answer is the leak the seal exists to prevent — "obviously B"
under a question nobody has answered yet *is* the vote, written out. The
reveal is the first moment a circle has anything to discuss and the first
moment discussing it costs nothing. Three cases pin it: composer present
after a reveal, absent before one, absent when the reveal carries no qid.

On a split day (D71) the thread hangs on the reveal's own `rowQid`, not
on a member's individual qid — one comment thread belongs to one
question, and the alternative is two people talking past each other under
one heading.

`LiveDuelPanel` reaches it by ordinary import rather than the globalThis
bridge (both are typed TSX in `ui/`), so the D39 coupling count is
**unchanged** — a new panel that added its reads through `window.*` would
have raised it, and the ratchet only moves down. The live figure comes
from `npm run check:globals`; this record does not quote one, because a
hand-maintained number in prose is the documentation error D39 exists to
stop re-committing. Its `spec-index.js` entry stays regardless — rule 2
lists every module — but nothing waits on the side effect.

**With that, the client half of docs/MODERATION.md is finished.** What is
left needs no code: the low-privilege Routine (blocked on the platform
gap), the `MOD_ADVISORY` flip (a maintainer judgement on the verdict
log), and the three open questions at the end of that file.

### Part 2 (Proposed) — anonymous world takes, gated on the advisory flip

**Proposal.** Extend takes to world-scale questions, **without author
names**, and only after `MOD_ADVISORY` flips to `false`. Named who-voted at
world scale stays refused, permanently and for a different reason.

**Why this is not the reversal it looks like.** D1's *Why* bundles two
arguments that are not the same argument:

1. World free text reintroduces a moderation surface and engagement-loop
   dynamics. This is about comments as a feature.
2. "Shipping synthetic people as real would contradict the product's
   honesty posture. **No seeded fake users, ever.**" This is about the ~150
   invented people in `world-feed-comments.js`.

The second sentence is the forceful one and it argues against the *demo
data*, not against real users writing real text. Real world takes violate
nothing in it. Conflating the two let the strongest line in D1 do work on a
question it was never about.

**The precedent is already in the tree.** The who-voted half of D1 operates
at world scale *today* — `renderEngage` shows the panel on live cards
because "that panel stopped being a lie: the breakdown is real anchor
counts, floored per cell… **and it carries no names at all**." It got there
by stripping the identity and keeping the substance, without overturning
anything. Part 2 is that same move applied to the other half.

**What it costs, in the order the costs land:**

| Cost | Detail |
| --- | --- |
| `MOD_ADVISORY = false` | Step 3 of the trust ladder. Today verdicts record and hide nothing, so circle scope is doing the work enforcement would. That substitution stops being available the moment the audience is everyone. **This is a maintainer judgement on the verdict log, not a code change, and it is a hard prerequisite rather than a step that can run late.** |
| The Routine | Step 4, and blocked on a real platform gap: a Routine-fired session cannot today carry *only* the verdict credential (`MODERATION.md`). Running it in the dev session trades the whole confinement design for scheduling convenience — explicitly not an option. |
| A rules change | Every `v2_takes` gate resolves through `memberUids`. A world take has no gid, so read, create and flag each need a second shape. This is privacy-surface work and gets the D12/D14 treatment: negatives first. |
| Two store filings become false | `messagingAndChat: false` and Play's untick of *Emails or Text Messages* are both filed and both keyed to takes being circle-scoped. D75 already predicted this expiry and said the two must move together. Add Apple guideline 1.2's obligations for user-generated content, which is the part D75 called "stops being comfortable". |
| An index | The committed one is `gid`-first. World takes key on something else. |

**What part 2 explicitly does not propose: named who-voted.** Two
independent reasons, either sufficient. InSight asks political questions,
and `LAUNCH-RUNBOOK.md` already records the politics result as GDPR
Article 9 special-category data — a percentage and "this named person voted
this way" are different legal objects. And the moderation policy's own hard
line **H4 · Doxxing** covers "names tied to accounts… regardless of
intent"; publishing that as a feature would make the product do the thing
it removes users for. Anonymity is not a softening of this proposal, it is
the whole of it.

**Adoption is an explicit act.** Part 2 binds nothing while its status reads
Proposed. What would settle it is the advisory verdict log — the evidence
the ladder was built to produce, and which no amount of reasoning here
substitutes for.

## D79 · `messagingAndChat` was false for one day, and circle scope does not make chat not-chat

**Decided:** 2026-08-09 · **Status:** binding · **Owner-approved**

`messagingAndChat` is **`true`**. It was filed `false` on 2026-08-08 and
pushed to App Store Connect that day; D78 part 1 shipped the circle takes
client on 2026-08-09, and `postTake` writes free text that other members of
a group read. The filing outlived its premise by about eighteen hours.

**The old reasoning had two clauses and only one survived.** It read "takes
are circle-scoped (D1) **and demo-only in a shipping build**". The second
clause is what D78 ended. The first is still true, and the question is
whether it is enough on its own.

**It is not.** Apple asks whether the app *has* messaging or chat. Scope
limits the **audience**, not the feature — a private group where members
write to each other is chat, and arguably more clearly chat than a public
feed would be. Under-declaring is the direction that pulls an app, and the
honest answer costs nothing here: `userGeneratedContent` already drives the
rating to 12+, so this changes the filing without changing the outcome.

**This overrides D78's own reading, which is why it is a record.** That
decision's cost table files this flip under **part 2** — world takes, still
*Proposed* — implying circle takes leave it alone. Two records now disagreed
about when a live legal filing moves, with the app days from submission.
Settled in the safer direction and written down, rather than left resting on
whichever record a future reader opened first.

**`EMAILS_OR_TEXT_MESSAGES` does NOT move with it, and D75 said it would.**
That prediction bundled the two on one trigger. They come apart because the
forms ask different questions: the age rating asks whether chat exists, the
privacy label asks which category the text lands in. **A take is a post to a
circle, not a message to a person** — Apple files that under *User Content →
Other User Content*, which has been declared **Yes** since the file was
written. The content is declared either way; only the shape differs. That
row moves if a direct person-to-person surface ships.

**Guideline 1.2 got easier on the same day, not harder.** D75 called this
the moment 1.2 "stops being comfortable". The opposite happened: 1.2's
report-mechanism row read "the control exists in the spec layer; the takes
surface it attaches to is demo-only at launch" — a report control attached
to nothing, for eight days — and D78 shipped `flagTake` writing to
`v2_flags` from the panel. The obligations now apply for real *and* are met
for real.

**Five prose sites moved with the value**, because the premise was quoted in
all of them: `app-privacy.json`'s `$messagingAndChat`, `$structural`,
`$socialMediaQuestions`, `$guideline12` and the `EMAILS_OR_TEXT_MESSAGES`
note; `STORE-FORMS.md`'s structural fact 3, its not-collected bullet, its
answer table and its 1.2 table; and `LAUNCH-RUNBOOK.md`'s untick list.
`check:store-forms` catches a value that disagrees across the two files
(D75 rule 5) and caught nothing here, because the value was consistent and
the *reason under it* was stale — which is the failure mode a
key-and-value gate cannot see.

**Runbook 4.5 is unticked again, and stays that way as a shape.** The age
rating is *pushed state*: `check:store-forms` holds the two files to each
other, and **nothing holds either of them to App Store Connect**. A feature
that changes what the app *is* leaves the store holding an answer the repo
no longer makes, and only a human dispatch closes that. This is the second
time in two days that a shipped feature invalidated a filing; the first was
D75's eight missing attributes, discovered by a 409.

## D80 · Two ways to hang on the same line, and the device found both

**Decided:** 2026-08-09 · **Status:** binding

The first device this app ever ran on booted into demo mode and stayed
there. D77 made the reason readable and D-79's predecessor made it name a
stage; the phone then said **"still connecting — signing in"**, which is a
statement that `signInAnonymously` neither resolved nor rejected. Two
independent causes were in those three lines, and either alone produces
exactly that.

### 1. `getAuth()` on a native build

`getAuth()` installs the browser `popupRedirectResolver`, which probes the
environment against the `authDomain`. In a WKWebView served from
`capacitor://localhost` that probe never completes — and because Auth gates
**every** operation on its initialization promise, `signInAnonymously` waits
on it forever. Not rejects. Waits.

Native now uses `initializeAuth(app, { persistence: indexedDBLocalPersistence })`,
which is what `@capacitor-firebase/authentication` documents for native
(`packages/authentication/docs/firebase-js-sdk.md`) and what firebase-js-sdk
**#5615** and **#6504** describe the absence of — *"the promise does not
resolve, neither `.then` nor `.catch` runs"*. Web keeps `getAuth()`: the
resolver it installs is the one `linkWithPopup` actually needs there.

**How this was reached matters, because four earlier rounds guessed.** App
Check was checked and enforced nothing. `accounts:signUp` with the
production key answered **200 in milliseconds** from outside the app.
Firebase's user list showed no account created. `check:web-firebase` proved
the config was inlined verbatim in the shipping bundle. Each of those
removed a hypothesis without producing one; the answer came from the *shape*
of the failure — never settled, rather than failed — which is a property
only D77's label could report, and which named the cause almost uniquely.

### 2. `const unsub = onAuthStateChanged(a, () => unsub())`

Fine while the callback is asynchronous. Fire it **synchronously** — which
an Auth instance whose state has already resolved is entitled to do — and
`unsub()` executes inside its own initialiser and throws
`ReferenceError: Cannot access 'unsub' before initialization`. The throw
lands inside Firebase's observer dispatch, `resolve` on the next line never
runs, and the promise hangs with nothing logged.

**Same symptom, different cause, three lines apart, and it predates every
change in this investigation** — that shape has been in `anonSignIn` since
the deploy-plane batch. `unsub` is now a `let` declared outside the
executor, with a `settled` guard and a trailing idempotent call for the
synchronous case.

**It was found by a test, not by reading.** The mock fires
`onAuthStateChanged` synchronously because that is the honest stand-in for
an initialized instance, and the first run of the new file failed on it.
The case is named in its own `describe` so nobody restores the coverage gap
by making the mock "more realistic".

### The rule these share

Both are an `await` with no clock. D77 wrote that down for the restore wait
and D77's own record said the argument was general; it then went one call
deeper and stopped. `signInAnonymously` now has a 30-second deadline whose
error names `init()`, so whatever the *next* cause turns out to be, the
device says something instead of nothing.

**30 seconds, not 5.** This is a real network call on a phone and a train
tunnel is not a bug. The deadline exists to convert silence into a sentence,
not to fail fast.

**What is not claimed.** Cause 1 is documented upstream and matches the
symptom exactly; cause 2 is proven to hang under a synchronous callback but
whether the device's SDK fired synchronously is unknown and now unknowable,
because both are fixed in the same build. Recorded as two fixes, not as one
diagnosis with a spare.

## D81 · The k-floor is paused at 1 until launch traction

**Decided:** 2026-08-09 · **Status:** binding · **Owner's call**, from
release testing: below five answers every breakdown reads as withheld, and
"we can pause [the floor] as it's no secret what people vote" at the
current userbase.

**Decision.** `AGG_MIN_N` and `PUBLISH_EVERY` (functions/src/v2.ts) drop
from 5 to **1**, together. Counts publish from the first answer, exactly,
per answer. The floor is *paused*, not removed: every piece of the
machinery still runs — `tooSmall`, `publishableBreakdown`, complementary
suppression, the one-bucket rule — it just bites at a size that cannot
occur. The pure suite keeps the whole floor-5 choreography tested as "the
design pair", so the revert is a two-literal edit, not a re-derivation.

**Why.** The floor defends a reader from recovering an individual's answer
out of a small cohort. Pre-launch there is no reader to defend against and
no cohort that will ever reach five: with a tester count in single digits,
*every* figure in the app sat at "You're early — counts appear once 5
people have answered", permanently, on every stop of the Mirror and every
card of the feed. A floor that suppresses 100% of the product's output
protects nobody from nothing while making the release look broken — the
owner hit exactly this on the first TestFlight build
(LAUNCH-RUNBOOK §3.2 predicted it as "expect the k-floor to look like a
bug"; the accurate prediction was the argument for the pause).

**The disclosure this accepts, stated rather than waved at.** While the
pause holds:

- a cohort of one *is* that person's answer, to anyone who can name the
  cohort's membership — "the one person in Bergen who answered" is
  identified by the cohort label itself;
- with the cadence at 1, every observed change to a public aggregate is
  one person's vote, and an observer holding a snapshot listener can
  correlate a step with "my friend just answered" timing;
- the client says so: the privacy panel's floor bullet now reads "while
  the app is small, counts show from the first answer (so a count of 1 is
  that one answer); the ≥5-person floor switches back on as cohorts grow"
  — because a privacy panel still claiming ≥5 would be the UI-says-it,
  server-doesn't failure this product defines itself against.

**What does not pause.** The exact counts stay in `v2_aggs_private`, which
no client may read. Answers stay owner-only and create-only (D5). Political
items still never slice (D44). A one-bucket dimension is still withheld —
it is a population statement, not a split, at any floor (the e2e asserts
this survives the pause). Duel/sealed answers still reveal only to members,
next day. The store privacy labels are unchanged: they never claimed the
floor, and what they do claim (aggregated, no identities) stays true.

**Client copy follows the constant, not the era.** `src/v2/data/floor.ts`
is the client's pinned copy of the pair (`floor.test.ts` regex-reads the
functions source and fails on drift, both directions, plus a paused-
together-or-restored-together coupling test on each side). Every sentence
that mentioned the floor now branches on it: the cohort panel's header
drops the "never a group smaller than N" clause (N=5 would be false, N=1
vacuous), its "withheld" accounting becomes "no answers yet" — at floor 1
an absent cell IS zero, so the absent≠zero doctrine inverts — and the
daily/feed "You're early" note becomes "You're first — the count lands in
a moment", which is what `tooSmall` means when the only wait left is the
trigger's own latency. The "5+" lower-bound suffix goes too: with the
cadence at 1 the count is exact, and a "+" would claim a batching
inaccuracy that is not there (`AGG_COUNT_IS_EXACT`).

**Why literals and not a config knob.** The drift gates
(LiveCohortBody.test, floor.test) regex-match the literals — an expression
would make them vacuous, and they say so. And a remote knob that can flip
a disclosure property without a reviewed commit is strictly worse than a
two-line diff that every gate names. A deploy is the config path here.

**Revert condition.** Restore both constants to 5 (functions/src/v2.ts)
and both client copies to 5 (src/v2/data/floor.ts) in one commit — the
tests enumerate every file that must follow, and the copy flips itself.
When: at public launch, or as soon as cohorts routinely clear five,
whichever the owner calls first. The e2e's floor-5 choreography (first
answer publishes nothing; dims withheld while cells sit at 3/2) is
preserved verbatim in this record's diff and in pure.test.ts, so restoring
it is mechanical.

## D82 · Near by radius (~500 m) — asked for, priced, and deferred

**Status:** Proposed, deferred · **Requested:** 2026-08-09, owner:
"Near should not need a city at all but only be distance based … people
in a 500 m radius or something."

**What is recorded here.** The ask, so it is not lost, and the price, so
taking it later is a decision rather than a slide. Nothing is built.

**Why not now — the arithmetic, updated from D2/D9:**

- **A 500 m radius is finer than anything this product has ever held.**
  D2's geohash Near was ~5 km cells and was rejected; 500 m is geohash6/7
  territory. The product's strongest privacy line — *"the most precise
  location this system can hold about a person is the name of a city, by
  construction"* (D9, quoted in the privacy panel) — is spent the moment
  any per-user cell is written, at any radius.
- **Proximity needs presence, not a profile field.** "People actually
  near you" means fresh location per session (foreground fixes, a
  presence collection with a TTL), not D9's one-tap coarse fix that
  discards the coordinate on-device. That reopens the class of collection
  D4 deliberately closed (`insight_discoverable` — D2 records what it
  leaked and why reviving it was refused), plus store label changes
  (Coarse → Precise, "location" → collected continuously-ish), the
  privacy panel's "no background or continuous location" line, and both
  D75 filings.
- **The floor makes it empty anyway.** The geo system's own floor was 20
  per cell (D9 found it); even at the design floor of 5, a 500 m cell
  needs five simultaneous users on the same block. At the current
  userbase that is zero cells, everywhere, forever — the feature would
  ship as a permanently empty screen that cost the privacy label to
  build. (D81's pause does not help: a 500 m cell with ONE person in it
  is a tracking dot, not a cohort.)

**The shape it would have to take, if traction ever justifies it:** cells
no finer than ~1 km, presence that expires in minutes, opt-in with its
own prompt, floor ≥ 5 with no pause, and the store filings updated in the
same release — D2's four-point cost list still stands, with its step 3
(reopening a discoverable collection) still the expensive one. Its own
project, after launch, never a bugfix-pass rider.

**Until then Near stays D9's city** — which this release made reachable
in place: the needs-a-city empty state now carries the profile's own
picker ("use my location" one-tap suggest + manual search) instead of
prose pointing at the profile.

## D83 · World takes ship — D78 part 2 adopted, anonymous, behind enforcement

**Decided:** 2026-08-10 · **Status:** binding · **Owner's call**:
"Comments should be on world as well, that's where it is most useful —
it has moderation so it's not an issue."

**Decision.** Takes exist at world scale: the sentinel gid `"world"`
carries per-question free text readable and flaggable by any signed-in
user, with **no author names anywhere** and **one take per person per
question**. `MOD_ADVISORY` flips to `false` in the same change — D78 made
that the hard prerequisite, and it holds: at world scale, circle-scope
trust cannot stand in for enforcement. Named who-voted at world scale
stays refused, permanently, for D78's own two reasons (Art. 9, policy
line H4) — anonymity is not a softening of this feature, it is the whole
of it.

**What was built, and where each guarantee lives:**

- **Rules.** `firestore.rules` grew world arms on the takes read/create
  and flag create gates. The sentinel cannot collide with a circle
  (`v2_groups` creates are `if false`; ids are server-minted), reads stay
  fail-closed on the `hidden == false` equality (D65's lesson, re-proved
  for the world list in `rules.test.ts` — 51 → 56 cases), and the create
  bound moves from membership to the DOCUMENT ID: `qid + "_" + uid`, so a
  second take is an update and updates are denied. That id is also the
  flood control — one account cannot stack a question under fresh ids.
- **Index.** A second `v2_takes` composite (gid, qid, hidden, createdAt
  DESC): the world list is per-question, because "every world take ever"
  is unbounded and no surface reads it. The circle query and its index
  are untouched.
- **Client.** The same five `SOCIAL` members, scope as an argument —
  `loadTakes("world", qid)` queries per question and caches under
  `world:{qid}`; `postTake` mints the deterministic id; nothing else on
  the pinned surface moved (takes.test.ts grew the world suite).
  `LiveTakesPanel` gained a world mode: "Someone" instead of names, the
  one-take composer fold, an anonymity kicker, and **Hide author** — the
  per-author local mute (`data/mutes.ts`, purge-aware) that Apple
  guideline 1.2's blocking row expects of a world-scale surface. Mounted
  behind a post-vote "Takes" toggle on live feed cards and the live
  daily: after your own blind vote, never before, because reading the
  discourse before answering is the seal's leak at world scale. The
  toggle is also the cost gate — one query per opened question.
- **Enforcement.** `submitModVerdict`'s enforced branches were already
  coded and dormant: remove now hides (with `hiddenMeta` for the
  appeal) and settles the queue entry; keep clears the flags so a kept
  take re-queues only on fresh ones; escalate alone keeps the entry.
  `e2e-moderation.mjs` was rewritten from the advisory guarantees to the
  enforced ones and grew a world leg — stranger reads, stranger flags,
  queue, remove, hidden from everyone — every leg green in the emulator.

**The deviation, recorded rather than papered over.** moderation.ts asked
the advisory→enforced flip to "cite the advisory phase's track record in
its PR". There is none: the advisory window closed with zero users and an
empty verdict log, because the owner adopted world takes first. The
compensating controls are real — the only verdict source until the
Routine lands is a MOD_UIDS operator acting by hand, `MOD_RUN_CAP` bounds
a bad run, a wrong remove is reversible in data (`hidden` is a field, and
`hiddenMeta` says who and why) — and the blast radius at the current
userbase is a rounding error. The Routine (MODERATION.md step 4) stays
blocked on its platform gap; its absence means enforcement is manual, not
that it is off.

**The linkability trade, stated.** A world take's doc carries
`authorUid` — an opaque anonymous id, now world-readable for the first
time anywhere in the product. Takes by one account are therefore linkable
to each other (and the mute control depends on exactly that), though to
no name, no profile and no answer — every other uid-bearing surface stays
owner- or member-scoped. The alternative (a server-mirrored public copy
with the uid stripped) costs a function, doubles the writes and breaks
author-delete; it is the recorded upgrade path if pseudonym linkage ever
matters at scale. `docs/data-inventory.md` carries the row.

**Filings.** No ticked value moves: `messagingAndChat` is already true
(D79), takes remain posts (Emails/Text Messages stays No), and
`userGeneratedContent` was Yes from the start. The PROSE under those
answers leaned on "no global surface to be abused from", which D83 ends —
app-privacy.json's `$structural`, `$socialMediaQuestions`, `$guideline12`
and STORE-FORMS.md's 1.2 table now answer from what exists: enforced
moderation, report at both scopes, leave-the-circle and hide-the-author
as the two blocking shapes.

**What this deliberately does not add:** author names or avatars at world
scale (refused above), reply threads (a take is one person's take on the
question, not a forum), edit (an edited take invalidates its flags —
delete-and-repost is the rewrite), a reason picker on reports (no field,
by design), or world takes visible before the viewer has answered (the
client mounts the panel post-vote; a determined API reader can pay for
spoiling their own blind vote, which harms nobody else and is recorded
here rather than chased with a rules read-gate that would cost a get()
per list row).

### D82 amendment (2026-08-10) — "what if location only updated while the app is open?"

Asked by the owner as a follow-up, and worth answering in the record
because it is the RIGHT question — it just answers a different cost than
the one that defers this.

Foreground-only updates were already the assumed shape ("presence that
expires in minutes", above): no background location, no history, a fix
taken only while the app is open. What that removes is the worst store
label and the battery objection. What it does not touch:

- **The emptiness.** Near-by-radius shows people who are near you *now*
  (or within the presence TTL). Foreground-only makes the presence set
  STRICTLY SMALLER — it is the people who have the app open around you,
  which at the current userbase is zero in every cell at every radius,
  and stays near-zero until well after launch. The floor argument above
  is unchanged; the sampling makes it stricter.
- **The precision line.** A per-user cell write at ANY cadence spends
  "the most precise location this system can hold about a person is the
  name of a city, by construction" (D9). Foreground-only changes when a
  coordinate exists, not that one does.
- **The collection.** A presence doc keyed by user is still the class
  D4 closed, with its rules, tests, TTL machinery and erasure surface.

So: yes, it helps — it is how the feature would be built if it is ever
built — and it does not move the two things the deferral rests on
(nobody to show, and the privacy line it spends). The revisit trigger
stays what D82 set: launch traction first, own project after, and the
foreground-only design is the recorded starting point when that day
comes.

## D84 · Near by radius ships — presence cells, a count and nothing else

**Decided:** 2026-08-10 · **Status:** binding · **Owner's call**, third
ask and explicit about the trade: "I want the 500m added, it doesn't
matter that it won't work most of the time." D82's deferral rested on two
legs — nobody to show, and the precision line it spends — and the owner
has now knowingly accepted the first and part of the second. This record
is the shape that ships and the one precision decision that deliberately
does NOT ride along.

**Decision.** The Near stop gains a "Right now, around you" counter: how
many opted-in phones are foreground within the viewer's ~1 km grid cell
and its eight neighbors. No city involved — the card renders above the
city ask, so Near is never a dead end again.

**The shape, and where each guarantee lives:**

- **A cell, never a coordinate.** `data/locate.ts` gains `locateCell()`
  under the same containment contract as `locateCity()`: the fix is
  folded to a 0.01° grid id ("5999_1074") inside the module and the
  coordinate is discarded. A plain integer grid rather than geohash: the
  neighbor math is two ±1s, and the precision cap is legible in the id
  itself. The client and server halves of the grid contract are pinned to
  the same vectors (geo.test.ts ↔ pure.test.ts, the floor.ts pattern).
- **`v2_presence/{uid}`: one doc, overwritten, unreadable.** Foreground
  beats every 4 minutes write `{cell, at}`; the rules regex is the
  structural precision cap (raw coordinates cannot be written at all) and
  `allow read: if false` for every client — a readable (uid → cell) pair
  is D2's leak reborn, a script following any uid around town. Opting out
  deletes the doc immediately; `deleteAccount` deletes it too (erasure
  e2e asserts both the wipe and that it stops at this account's edge).
- **The count is the entire read surface.** `nearbyCountV2` (App Check
  enforced) takes the caller's cell, counts fresh presence (10-minute
  window) in the 3×3 neighborhood, excludes the caller, and returns a
  number. It floors on `AGG_MIN_N` like every published count — under
  D81's pause any nonzero count shows, which is this feature's whole
  point at today's scale; when the floor restores, 1–4 becomes `tooFew`
  and the card says "a few people" without a number. Wired through the
  same constant, so the revert carries presence with it.
- **Opt-in is a per-account choice.** The flag lives in its own store
  (`data/near.ts`) with its own purge listener, because an opt-in that
  survived an account switch would turn presence on for whoever signs in
  next. The enable tap carries the OS permission prompt (D9's rule);
  boot resumes the loop only for an account that already chose it.
- **The privacy panel discloses it in full** — what is shared, who can
  read it (no user), when, and both ways out. The store label does NOT
  move: the fix is the same coarse permission the city locate uses, no
  background or continuous location, no history (one doc, overwritten).

**The 500 m that deliberately did not ship.** The owner said 500 m; the
card says "a couple of kilometres", and the gap is the sensor, not
timidity: the app requests COARSE location only
(`NSLocationDefaultAccuracyReduced`, Android COARSE) — a fix accurate to
a kilometre or worse cannot honestly measure a 500 m radius, and D9's
store-label argument ("Precise is NOT ticked, and the table is why")
leans on exactly that ceiling. True 500 m is one decision away: request
precise fixes, flip the App Store label to Precise Location, rewrite the
coarse-only lines in D9's table and the privacy panel. That is a
listing-level change with its own review consequences, and it is left as
the owner's explicit next call rather than smuggled in under this one —
the feature works identically at either precision, only the honest
radius claim changes.

**Costs, priced:** one presence write per opted-in foreground phone per
4 minutes and one callable read of ≤9 cells' fresh docs — at any scale
this product reaches before the floor restores, a rounding error against
the answer pipeline. A new composite index (cell, at). One new callable
in the deploy list (check:deploy-targets held the door until it was).
---

## D85 · The personality tests go to 5 items per dimension, and `cognitive` gets a question bank

**Decided:** 2026-08-10 · **Status:** binding

Two defects on the same surface, found by asking how many questions the
tests actually carry.

### 1. Three items per dimension was thinner than what is read off it

Every dimension of all four tests carried exactly **3** items (W2 raised it
from 2; `content-parity.test.jsx` pinned `K = 3` with the note "possibly 4
later"). A dimension's score is the mean of its items on an 0..4 scale
rescaled to 0..100, so **K items give 4K+1 reachable values** — at K=3,
thirteen of them, with each single answer worth **8.3 points** of the
score.

That is the arithmetic that matters, not the 15/18 headline. The Mirror
reads those scores as cut lines, the Map files answers against them, and
`IS_archScores` matches an archetype on distances of a few points — all
against a number one careless tap moves by eight. For reference in items
per trait: TIPI 2, Mini-IPIP 4, BFI-44 ~9, BFI-2 12.

**K = 5.** Big Five 15→25, Politics 18→30, Values 18→30, Social 15→25,
plus the new test's 20 — **130 test items, 463 seeded questions**. Each
dimension now has 21 reachable values at 4.8 points per answer, and each
carries **2** reverse-keyed items rather than 1, so a straight-line
"agree" response lands every dimension at 55 (a shrug) instead of 75 (a
personality). That last figure is asserted in `smoke.test.jsx`, not
reasoned about.

K = 4 was the increment W2 anticipated and was rejected: it is 38 items of
authoring for a score still coarser than Mini-IPIP. K = 6 puts Politics
and Values at 36 items (~25 min sat down), which is a different product
decision about test length, not a fix for this one.

**Mechanics, per W2.** Appended at the END of each `questions` array in
both `content/tests.json` and `IS_TESTS`, in one commit — appending keeps
the positional `test-<key>-NN` ids stable and in-flight
`insight.testProgress` answer arrays index-aligned. A user mid-test sees
their progress percentage drop as the denominator grows; that is accurate,
not a bug. Saved results are per-dimension 0..100 and item-count-free, so
they survive untouched.

### 2. `cognitive` was a test nobody could take

`IS_TEST_RESULTS.cognitive` shipped with four dims, and
`segment-explorer`, `compare-breakdown`, `group-mirror`, `person-overlay`
and `compare-pop` all read it. `IS_TESTS` had no `cognitive` key, and
`test-overlay.jsx` offers exactly what `IS_TESTS` holds. So the profile
showed you a thinking style with **no way in the app to earn one** — in
live mode, a surface that could only ever be empty.

Nothing failed, and nothing could have: a test nobody can take is not a
name error, so `check:globals`, `no-undef` and `tsc -b` were all blind to
it, and `smoke.test.jsx` never opened a screen that needed it.

It now has a 20-item bank (4 modes × 5, 2 reverse-keyed each) whose dim
ids and meanings are the ones `explain-sheet.jsx` already published. Made
first-class in the same pass: `IS_TEST_AVG` (absent — which is not
neutral, it null'd the rarity readout and flattened archetype matching to
a 50 baseline), `RP_TESTS`, `IS_ARCHETYPES` and the four archetype word
maps, `PASSIVE.META`, the profile's sub-tab and arc ring, and a fifth Map
anchor — `map-anchors.js`'s own header had said "the five test results"
since the port while the list held four.

**The trap the fix introduces, and the guard for it.**
`ResultProfileCard` returns `null` on a missing `RP_TESTS` entry. Without
one, finishing the new test lands on a header, a Done button and blank
space between them — no throw, no boundary trip, every static gate green.
That is `smoke.test.jsx`'s "the cognitive test is takeable end to end" —
four cases: the picker offers it, the profile sub-tab draws it, a saved
result draws it, and all 20 items answered through the real UI land on a
result card.

Mutation-checked rather than argued, and the measured numbers, because
the point is which gate notices: renaming the key in `IS_TESTS` fails 3 of
the 4, renaming it in `RP_TESTS` fails 2. **In both runs every
"without tripping the boundary" case still passed** — which is the whole
claim. The screen goes blank and nothing throws.

### What is deliberately NOT done

**`cognitive` is not a vote-cut line.** `VOTECUTS` reads
`RMLenses.TESTS`, whose entries carry five colour bands per axis, named
types with hues, and the Circle map's people-colouring. That is a design
surface of its own, not a missing key, and inventing one to square the row
is the fabrication D1 forbids (docs/MIRROR.md §3). `TEST_IDS` stays four;
the Mirror's cut list says four tests and means it.

**Existing `seq` values shift.** The test surface runs one counter across
all tests (`gen-v2content.mjs`), so appending to big5 renumbers every
later test's `seq`. Harmless and checked: no answer document references
`seq`, ids are unchanged, and `seq` only sorts the bank client-side
(`live.ts`). The next seed run rewrites those docs, which the D34 delta
cursor picks up via `updatedAt`. **New questions do not bump
`contentRev`** and these do not either.

**Production is further behind than it was.** The last seed wrote 389; the
bank is now 463. Same standing instruction as ever (LAUNCH-RUNBOOK 1.4) —
reseed after merging.

## D86 · Answers become editable — D5 amended, not repealed

**Decided:** 2026-08-10 · **Status:** binding · **Owner's call**, from
release testing: "a way to edit your answer to questions (that is not
knowledge, obviously)".

**Decision.** An answer on the world-scope opinion surfaces — `daily`,
`feed`, `test` — may move its `optionIdx` after the fact. Everything else
about D5 stands, and the amendment is exactly one write shape:
`update` on the owner's own answer doc, changing **only**
`optionIdx` (+ an `editedAt == request.time` audit stamp), bounded by the
question's own option count, refused while the question is inactive,
carrying the same D29 device binding as a create, and rate-limited to
**one edit per answer per 60 s**. `delete` stays closed.

**What stays frozen, and why each does:**

- **Duel answers** (surface `group`/`duo`): the seal *is* the product —
  an editable sealed answer lets a member re-decide after reading the
  room. Excluded by the surface check.
- **Learn answers**: first-attempt-only is D32's whole measurement — the
  crowd stat is a people-rate, and "not knowledge, obviously" is the
  owner drawing this exact line. Excluded by the surface check.
- **Catalog answers**: they carry `entity`, not `optionIdx`, and the
  canon fold has no delta path yet — the rules arm demands the OLD doc
  hold an integer `optionIdx`, which a catalog answer never does.
- **The anchors snapshot and `answeredAt`**: an edit moves which option
  you hold, never which cohort you answered from (D8). This is what
  makes the aggregate delta clean — the same cells that folded the
  create fold the edit.

**The honest-counts half of D5 moves into a trigger.** D5's immutability
was doing two jobs: one-person-one-vote (still done, by the doc id) and
"the aggregate is a plain increment with no reconciliation". The second
job now belongs to `onV2AnswerUpdated`: the same ledger-deduped
transaction as the create path, folding **-old/+new with the total
unchanged** (`retargetCounts`/`retargetAnchors`, pure.ts). Two properties
carry it:

- **Ordering self-heals.** Eventarc orders nothing between a doc's
  create and update deliveries. If the edit arrives first, the old
  option holds no votes; the trigger throws and platform retry redelivers
  it after the create folds. The move and the create commute in every
  order that does not clamp at zero, and the clamp case is exactly the
  one converted into a retry.
- **Bucket totals never move.** The floor's quantity is invariant under
  an edit, so nothing published can be un-earned. Where cap churn means
  the old vote is no longer represented in a cell (evicted bucket,
  create-time cap skip, re-minted bucket), the dimension is **skipped,
  increment included** — a ±1-per-cell approximation the eviction cap's
  documented degradation already covers, self-correcting on churn, and
  strictly better than inflating a bucket with an answer that is not in
  it.

**When an edit may rewrite the public mirror.** An edit's published delta
is always exactly one person — total unchanged means no cadence can
batch it with anything. So `EDITS_REPUBLISH` (v2.ts) publishes edits
directly **only while D81 holds both constants at 1**, i.e. only while
every create already publishes its exact step; the stepped-breakdown
gate is bypassed on that path because it keys on bucket-total growth,
which an edit never produces, and would hold the edited cells stale
forever. When D81 reverts, edits stop touching the public doc entirely
and ride the next create-driven publish, where their -1 hides among
≥ `PUBLISH_EVERY` other people's votes — the same k bound the floor
itself carries. The revert stays a two-literal commit; the edit path
re-disciplines itself.

**The 60 s cooldown is priced, not decorative.** Edits are the one
repeatable answer write, and each runs the aggregate transaction against
two single docs keyed by qid (D7's ~1 write/sec/document). Unbounded,
one hostile client holds a question's aggregate at its write ceiling
indefinitely; at one per minute per answer it cannot. The client mirrors
the cooldown (`LIVE.editVote` returns false without writing) so the UI
says "One change a minute" instead of bouncing.

**Client surface.** `LIVE.editVote(qid, optionId): boolean` — optimistic
flip, rollback on refusal that *restores* the feed-votes mirror rather
than scrubbing it (the doc still holds the previous option, unlike a
refused create). The daily's hold-to-change gesture — which in live mode
used to un-vote the display and silently write nothing — now routes
re-picks through it, and the feed's answered cards grow a Change button
beside Takes. Edits skip the first-vote celebrations (beat, ripple,
reveal haptic): "your vote moved" is not "your vote landed".

**Costs, priced:** one trigger invocation + one transaction per edit,
cooldown-bounded; no new collections, no new indexes, one new function in
the deploy list. The Map re-files the dot under the new option; learn,
duels and the canon are untouched.
---

## D87 · Production writes require an approval; the `production` environment carries protection rules

**Decided:** 2026-08-10 · **Status:** binding · **Applied:** not yet — see
docs/DEPLOYMENT.md § Protection rules for the checkbox

**The state being ended.** A push to `main` touching `functions/**`,
`firestore.rules`, `storage.rules`, `firestore.indexes.json`, `web/**` or
`firebase.json` deploys to production with no human in the loop, and
`seedContentV2` writes `v2_questions` the same way. Both jobs draw
`FIREBASE_SERVICE_ACCOUNT` from the `production` GitHub environment,
which today has no protection rules — the environment exists only to
scope the secret. `firebase-deploy.yml` has said since it was written
that this is "a place to add required reviewers / wait timers later".
Later is now.

**The settings** (GitHub → Settings → Environments → `production`):
required reviewers ON with the repo owner; **prevent self-review OFF**;
wait timer 0; deployment branches restricted to `main`. The full table
and the per-setting reasoning live in docs/DEPLOYMENT.md rather than
here, because that is the document an operator has open.

**Two of them are consequences, not preferences.**

*Prevent self-review stays OFF* because `SEED_ADMIN_UIDS` and `MOD_UIDS`
hold one uid and it is the repo owner's (DEPLOYMENT.md § Operator
continuity). With it on, the only human able to approve is the one who
triggered the run, so every deploy and every seed blocks permanently —
including the emergency rules fix. It flips ON in the same change that
adds a second operator uid, and both documents cross-link so that change
cannot forget it.

*`main`-only deployment branches* is the half that does not depend on
anyone being careful. Required reviewers ask for judgement; the branch
restriction is enforcement — GitHub refuses environment secrets to a run
on a non-permitted ref, so no dispatch from an unreviewed branch can
seed or deploy, whatever the caller's token holds. It costs nothing:
`firebase-deploy` already triggers only on push to `main`, and a seed
should only ever carry merged content.

**The cost, stated rather than sold.** A backend merge stops deploying
unattended and starts waiting for one tap. That is a real tax on the one
path `firebase-deploy.yml` protects hardest — it deliberately keeps
lint, the bundle budget, the Android build and the `npm audit` off the
deploy path because each could block an emergency rules fix. An approval
is much cheaper than any of those and cannot fail on its own, but it is
not free, which is why the wait timer is 0 rather than a thinking pause.

**Why now, and why not optional.** The trigger was asking whether an
agent session could run the reseed itself. It cannot: dispatch needs
`actions: write`, which the GitHub App does not carry. The available
workaround — syncing a personal `gh` token — grants the `workflow` scope
**per account, not per workflow**, so it would cover
`firebase-deploy.yml` exactly as much as `seed-content.yml`. There is no
way to hand out "may run the seed" alone. The approval is what keeps
that grant from turning "can propose a content change" into "can deploy
the backend", and it is worth having before the grant exists rather than
after.

**What this does NOT do, recorded so it is not discovered later.**
Nothing in CI verifies the rules are still in place. They live in
GitHub's UI, no file here describes them, and a rule deleted by hand
leaves no trace in this repo — DEPLOYMENT.md would go on asserting a
gate that had stopped existing. That is a weaker guarantee than this
project holds anywhere else: rules claims are proven by
`firestore-tests/`, and this claim is proven by nothing.

Left open deliberately. A `check:env-protection` gate would need a token
with `administration: read` on every run and would red the tree for any
contributor without one — the failure shape check-labels.mjs's header
warns about, where a gate that fires on a guess is one people learn to
skip. A known limit is survivable; a surprise is not.

And the gate stops *unattended* writes only. It does not stop a careless
approval, and an approver who always clicks approve is worse than no
reviewer, because the audit log then records a gate that was never
closed.

---

## D88 · Seeding chains to the deploy, because the bank it writes is the deployed one

**Decided:** 2026-08-10 · **Status:** binding

**The chore.** Every content change needed a human to remember *Actions →
Seed content → Run workflow* afterwards. Nothing enforced it and its
omission is silent: the repo looks correct, production serves the old
bank, and the only symptom is questions nobody sees. LAUNCH-RUNBOOK 0.1
has been unticked for that reason since 2026-08-07, and D30's promotion
cadence guarantees it recurs.

**The obvious fix is wrong, and this is the part worth recording.** A
`push` trigger on `functions/src/v2content.ts` looks right and races.
`seedContentV2` does not upload a bank — `functions/src/v2.ts` imports
`V2_QUESTIONS` from `./v2content`, so the questions it writes are the ones
compiled into the **deployed** function. Both workflows would fire on the
same commit, and whenever the seed won it would write the PREVIOUS bank
and report success. That is the silent-wrong-success shape this
workflow's `set -o pipefail` already exists to prevent (run 1 printed
`seedContentV2 failed (500)` and reported green), reappearing one layer
up.

**What shipped.** `workflow_run` on **Deploy Firebase backend**,
`types: [completed]`, gated on
`github.event.workflow_run.conclusion == 'success'`. The deploy has
finished before the seed starts, so the ordering is structural rather
than timed — no sleep, no polling, nothing to tune. `workflow_dispatch`
stays, and the `if` names it explicitly because a dispatch carries no
`workflow_run` payload.

**It fires after every backend deploy, not only content ones, and that is
deliberate.** Seeding is idempotent and since D34 rewrites only changed
documents and holds `contentRev`, so a no-op costs one callable and
reports `written: 0`. Running it every time means the bank cannot drift
from the deployed code at all — strictly better than firing only when
somebody noticed content had changed, which is the failure being fixed.

**Verified, not assumed.** The workflow name is matched as a string, and
a typo there fails silently forever — `firebase-deploy.yml`'s `name:` and
this trigger were compared programmatically, not by eye. The YAML parses.
And the `ARGS` block was run under `bash -e` with empty inputs, because on
a `workflow_run` firing there is no `inputs` context: both flags expand to
`""`, both stay off, and `set -e` does not abort on the failed tests
(they are non-final commands in an `&&` list). Empty is the correct
default — `--bump-rev` on every deploy would cost every returning device a
full bank refetch, the exact thing D34 stopped doing.

**Interaction with D87.** Under the protection rules the chained seed
queues at *Review pending* like any other production write, so the human
confirmation survives while the remembering does not have to. It also
retires the argument for granting an agent session workflow-dispatch
rights: the recurring chore that motivated it is gone, so the broad
per-account `workflow` scope buys nothing that is still wanted.

**The limit.** `workflow_run` only fires for the workflow file on the
default branch, so this cannot be exercised from a PR — its first real
run is the first backend deploy after merge. And it inherits the deploy's
path filter: a content change that somehow reaches `main` without
touching `functions/**` triggers no deploy and therefore no seed. Today
that cannot happen — `check:content` fails the build unless
`v2content.ts` matches `/content`, and `v2content.ts` is under
`functions/**` — but the two facts are separate and only the first is
gated.

## D89 · The feed's "knows this best" row is demo furniture — live mode refuses it

**Decided:** 2026-08-11 · **Status:** binding

**Found on a device, not in a review.** Screenshots from a phone running a
live build showed learn reveals headlining "BEd knows this best · 83%" and
"Service knows this best · 81%" — cut-group labels out of `vote-cuts.js`,
ranked by `renderKnowInsight` (world-feed.jsx) on the hash noise that
animates the demo cuts. Directly above each stood D32's line "Our estimate
— becomes measured once enough people have answered", which labels the
*split*. Nothing labelled the cohort headline, because there is nothing to
label it with: no per-cohort learn aggregate exists in either mode.

**Why refusal rather than an "our estimate" tag.** The split's estimate is
an authored model of a question's difficulty — a real editorial claim,
honestly labelled (D32). "BEd knows this best" estimates nothing: the
group, the direction and the margin all come from a hash of the question
id. A modesty tag would dress fabricated activity as an estimate; D1 calls
it fabrication either way, and D72 already answered the same question for
MapStats — return nothing, at the source, so a forgotten call site shows
nothing instead of something invented.

**What shipped.** `renderKnowInsight` opens with the live gate and returns
null; demo builds keep the row exactly as designed, including its own
honesty rules (rank on the noise only, headline only the upward side),
which stay recorded in the comment above the ranking. The gate is pinned
by `learn-split.test.ts` the same last-hop way LiveCohortBody pins its
floor import — mounting the entire feed to reveal one learn card would
test the fixture more than the one-line behaviour.

**What brings it back.** A measured per-cohort learn split. The moment
aggregates exist for learn answers by anchor, this gate is the seam where
noise swaps for measurement — exactly the trade `LEARN_SPLIT` /
`LEARN_SPLIT_SRC` already made for the split itself.

## D90 · The picker's blank state starts at home — the clock's country ranks first

**Decided:** 2026-08-11 · **Status:** binding

**The itch.** With no query the city list is the catalogue in population
order — deliberately the same for everyone, because it reads no personal
signal. The cost shipped in the same screenshot batch as D89: a user in
Norway opens the city ask and the first row under "Use my location" is
Shanghai. Correct, global, and absurd.

**What ships.** `zoneCountry()` (data/places.ts) reads the city out of an
IANA zone id — last path segment, underscores to spaces, folded like the
search so "America/Sao_Paulo" finds São Paulo — and returns that city's
country. The match is exact-or-shortened: IANA writes "America/New_York"
for New York City and "Asia/Kuwait" for Kuwait City, so a word-boundary
prefix matches too (exact first, and the break is required — "london"
does not reach Londonderry); within a rank the most populous namesake
wins, which is how Europe/Dublin means Ireland's Dublin and not Ohio's.
`regionHint()` applies it to the device clock, and `searchPlaces(…,
hint)` ranks that country's cities first in the **blank state only**;
typing anything abandons the hint, because a query is the user answering
for themselves. A zone the catalogue cannot name at all ("Etc/UTC", the
tiny county zones) returns "" and the blank state stays the world's. A
hint may miss; it must not guess.

**Why this is not the location D9 gates.** The zone id is a device
setting every date render already reads — no permission prompt, no
sensor, no network, no IP lookup. It produces a sort order and is
dropped: never stored, never sent, and it cannot reach the profile — the
anchor is still only ever the city the user taps. Granularity is one
country, and wrongness is harmless: a traveller sees their home country
first, and the fix is typing one letter. The NEAREST city — the sensor's
answer — stays behind its tap exactly as D9 records, and the store
privacy labels are untouched.

**The seam is the argument.** The zone reaches `zoneCountry` as a
parameter and the ordering tests pass it explicitly, because
places.test.ts asserts blank-state order on a fixture that contains Oslo
— an Intl read inside `searchPlaces` would make that assertion flip with
the developer's wall clock. The single real Intl read lives in
`regionHint`, spied in its own case, with the same try/catch the
`countryName` Intl guard already carries.

## D91 · Lens questions are polls: the items are seeded, and their counts publish

**Date:** 2026-08-11 · **Status:** Adopted · reverses the
"acknowledge instead of aggregate" half of D50

**Decision.** The 50 minor-instrument items (`IS_LENSES`, lens-defs.js)
are world questions: seeded into `v2_questions` from a new
`content/lenses.json` source (surface `test`, ids `lq-<lens>-<qi>`), so a
lens answer writes the same owner-only doc every card writes, folds
through the same trigger, and publishes the same k-floored counts. A live
lens card is an ordinary live card — measured split, the anonymous
world-takes toggle (D83), the who-voted breakdown (D8), the D86 change
affordance — and the answer still records to the on-device instrument;
world-feed's `setVote` has always done both, the vote half just had
nowhere to go. `selfOnly` (D50) survives as exactly one thing: the
fallback when `LIVE.lensAgg` finds no lens row in the bank (an unseeded
or pre-D91 backend), where rendering the authored counts would be the
fabrication D1 forbids and rules would refuse the answer write anyway.

**Why.** The owner's call (2026-08-11): there is no reason for lens
questions to be quieter than any other question — they should carry the
same breakdown and takes. D50 deferred (b) "build a real one" as "a new
collection, its k-floor, rules and their tests, for numbers whose product
value is unproven" — but that arithmetic priced the wrong shape. Seeded
as ordinary bank rows, the items need **zero** new collections, rules or
floors: `isWorldAnswer` already admits surface `test` against any seeded
question doc, the trigger already folds any qid, and `splitBanks` already
routes the rows to the feed bank. The increment was a content source, one
narrow accessor (`LIVE.lensAgg`), and the flag coming off.

**The order of the scale is load-bearing.** The seeded options are the
client's agree-FIRST five (`LENS_SCALE`, gen-v2content.mjs), the reverse
of every other scale item's LIKERT — because stored `optionIdx` indexes
the options, and the client stores the instrument value as `4 - val`
(world-feed setVote). check:content pins lens rows to LENS_SCALE and
everything else to LIKERT, so neither can drift into the other.

**Ids are the client's, verbatim.** `lq-<lens>-<qi>` with an unpadded
index — minted by lens-defs.js before the items had a backend. Devices
that answered lens cards in the selfOnly era hold feed votes and the
instrument's seen-map under those ids, so re-keying would resurface every
answered card. The cost of keeping them: `check-content`'s id shape for
the test surface admits two families. (Those pre-D91 local answers never
reach the server retroactively — the card reads as answered and nothing
re-offers it — which loses a handful of counts and fabricates none.)

**Two items never slice (D44/D52).** "For one group to gain, another has
to lose" and "Trade between countries leaves both better off"
(`lq-trust-2/3`) state economic-policy opinions — the same class as the
political test's own items — so they carry `political: true` and join the
no-slice set by existing: overall split published, never cross-tabbed by
anchors. The other 48 are instrument items in the values/big5 class,
which slice like the rest of the test surface. The moral-foundations and
tightness-looseness items were considered and left slicing deliberately:
they are standard psychometrics with political *correlates*, same as the
values test D8 already slices; the flag marks items that *are* political
opinions.

**What does not change.** Instrument persistence stays device-local
(lens-defs' persistence note and D50's second repair both stand — the
answer doc is a poll vote, not a restorable instrument mirror). The
Mirror ripple stays off lens cards — a lens answer lands on the profile's
Lenses tab, not the Mirror, so the gate moved from `selfOnly` to `q.lens`
rather than disappearing. And the demo pool is untouched.

**Enforcement.** `lens-content.test.ts` binds `content/lenses.json` to
`IS_LENSES` by index (id, text, dimension, invert — positional drift
re-keys immutable answers) and pins the two political flags;
`check:content` binds the JSON to the compiled bank, pins both scale
orders and the two-family id shape; `lens-live.test.ts` pins both live
pool shapes (seeded → live cards with measured counts, unseeded →
selfOnly) and the per-call rebuild; `smoke-live.test.jsx` mounts both
paths — the seeded card must reach `LIVE.vote`, render a split and carry
the takes toggle, the unseeded card must reach neither crowd nor store;
`slicing.test.ts` picks the two flagged items up by construction.

## D92 · A standing location grant fills the city in — "suggested, never applied" narrows to the no-grant state

**Date:** 2026-08-11 · **Status:** Adopted · narrows D9's amendment

**Decision.** When the Right-now counter (D84) is ON and no city anchor is
set, the Near/Country empty state resolves the city on the device
(`locateCity`, D9's containment: the coordinate never leaves locate.ts)
and **applies** it through `setCityAnchor` — no confirmation tap. The
interim state says what is happening and repeats the guarantee at the
moment it is checkable: only the city NAME is saved, never the
coordinates. One attempt per on-transition; any failure falls back to the
unchanged ask + picker, whose own "Use my location" remains
suggest-then-confirm. With the counter OFF nothing touches the sensor,
and the ask now names the hands-free path ("turning on the count above
fills it in for you").

**Why.** The owner's report (2026-08-11): "Near should not need a city."
The screenshot behind it shows exactly the state this closes — the
counter ON and counting, meaning the person has already granted location
to this feature on this screen, while the panel underneath still demands
they find Oslo in a list. D9's suggest-never-apply rule was written
against a different situation: a profile field silently rewritten from a
sensor the user never engaged, which "makes a location prompt feel like a
trick". A standing, revocable, user-initiated grant is the opposite
situation, and the derived datum — a catalogue key — is strictly LESS
information than the ~1 km presence cell the counter is already sharing
while on. Keeping the ask there was privacy theatre paid for in dead
ends.

**What it does not change.** The picker stays (manual pick and later
change in the profile, exactly as before); the counter-off path is
untouched, so no location is ever requested by this panel — the enable
tap on the counter remains the only prompt carrier (D9/D84); and the
saved shape is the same `vitals.city` + anchors write a manual pick
lands, so the profile mirror keeps re-asserting it rather than blanking
it.

**Enforcement.** `LiveCohortBody.test.tsx` (D92 block): derives and
applies with the counter on, saying so; never touches the resolver with
the counter off or a city set; applies nothing on a failed fix and falls
back to the ask; and the Country stop derives identically.

## D93 · The persona's residue is scrubbed from live anchors at boot, by exact signature

**Date:** 2026-08-11 · **Status:** Adopted

**Decision.** `hydrate()` passes the profile doc's anchors through
`scrubPersonaAnchors` (data/personaResidue.ts): `profession` equal to the
sample persona's "Editor · independent press" is dropped, `education`
equal to "MA Literature · Univ. of Oslo" is dropped, and `ageBand` goes
only when BOTH matched — the whole triple was then the leak's one write.
When anything was dropped, `saveAnchors` writes the cleaned map back, so
the repair is durable and the next answer snapshots clean anchors (D8).
City, gender and relationship are never touched: the seeded vitals never
carried them.

**Why now.** The owner's device showed "Editor · independent press ·
FROM YOUR PROFILE" on the Map's Work anchor today (2026-08-11). The
baseFor merge leak that wrote it is long fixed and migrateV1 filters the
local v1 blob — but the DOC a pre-fix build polluted heals only via the
profile panel's mount mirror, i.e. only when the profile overlay is next
opened. A device that answers daily and never opens the profile keeps
the fabricated cohort forever, stamped onto every immutable answer.
Boot is the one place every device passes through.

**Why exact-match deletion is safe here, and only here.** Neither string
is enterable today: profession and education are closed `<select>`
vocabularies (D8) that do not contain them, so an exact match IS the
residue. `ageBand` fails that test — real people share the persona's
band — hence the both-or-nothing rule for it. The trade is the same one
migrateV1 already recorded: a hypothetical user who genuinely held both
exact strings from the free-text era re-picks two fields, against
fabricated anchors that otherwise cannot be corrected at all.

**Enforcement.** `personaResidue.test.ts` binds the constants to
`sample-data.js` verbatim (a drifted copy scrubs nothing), pins that
`profile-general.jsx` contains neither string anywhere (a reintroduced
default was the original leak), and covers full-triple, partial and
clean-profile behavior.

## D94 · The demo roster grows to 24 — the prototype's social surfaces get a population

**Date:** 2026-08-11 · **Status:** Adopted

**Decision.** `IS_DATA.people` goes 7 → 24 and `IS_DATA.nearby` 6 → 14.
The tables keyed on those ids grow with them: `follows.js` SEED 5 → 12
friends, duels' first-run 1v1 roster 5 → 8, its seeded groups 3 → 4
(sizes 7 · 4 · 2 · 5), `PLAYED` / `READ_SKILL` / `BY_SKILL` /
`PARTNER_TODAY` / `DOMAIN_BIAS` gain entries for the three new partners,
and `IS_FRIEND_TYPES` covers all 24 in all five tests. Demo only: live
mode has no person graph (D3) and never reads this list (D72), so the
blast radius is the prototype.

**Why.** Most of what the daily's social half does only behaves
differently at a population, and at seven none of it was exercised. The
1v1 rail ran five partners, of whom one had a record deep enough for the
per-domain rows — so `domainRows`, `weakDomain` and `ReadRun`'s
span-dependent encoding all had a single subject, and a bug that
hardcoded that subject's shape would have looked correct.
`duoAvailable()` could offer two people. `groupPortrait` averaged three
groups, the largest five members. Seven also contradicted the fixture
in the same file: `aggregates.circle.n` is 24 and its `mbtiDist` sums to
24, so `sample-data.js` already described a circle three times the size
of the one you could open.

**The arithmetic that the new records had to satisfy.** `DOMAIN_MIN` is
4 correct reads EACH way before a lens appears, and the pool assigns a
domain per question, so plays spread across three lenses at roughly a
third each: 16 plays (f12) yields day 5 · heat 6 · mirror 5, 11 plays
(f17) yields two qualifying lenses, 6 plays (f14) yields none — the
"absent rather than thin" state, kept on purpose. Measured, not
predicted: the first `DOMAIN_BIAS` for f12 left `weakDomain` null
because a 0.55 bias over 5 samples did not separate; 0.25 does, and the
roster now carries two differently-shaped records (f1 reads weakest
under pressure, f12 on the everyday) plus one with no clear weakest.

**What this does NOT reach, recorded so it is not a surprise.**

- An existing demo install keeps the old circle. `insight.friends.v1`
  and `insight.duels.v1` are written on first run and read back forever;
  the larger SEED lands on a cleared profile or after the D51 purge.
- The Mirror's Circle stop is unaffected. It embeds the relationship map,
  which draws `RMCore.defaultPeople()` (49) — `mfpConfig('circle')`'s
  nodes are the fallback for when that component is absent.
- `IS_COMPARE_POP.circle.n` is still 9. It is a separate tuning table,
  no consumer renders it, and changing an unread number to chase this
  one would be churn. The pair that CAN be held equal — the roster and
  `aggregates.circle.n` — now is, by test.
- `IS_DATA.connections`, `dailyReports` and per-person `faves` still
  have no consumer. New records carry all three anyway: a fixture with
  second-class rows is worse than one with unused fields.

**Enforcement.** `src/v2/test/sample-people.test.js` (16 cases) holds
what fails silently: ids resolve everywhere they are keyed (SEED, group
members, duo partners, `IS_FRIEND_TYPES`), every type name exists in
`IS_ARCHETYPES`, every `category` is an `MFP_SECTORS` key and every
`dist` a real distance band, every relationship sector is occupied,
`people.length === aggregates.circle.n`, and the size properties the
growth was for — a group ≥ 5, friends still available to duel, two
partners deep enough for domain rows, a non-empty impressions feed.
Mutation-checked: a mistyped archetype name and an unknown SEED id each
fail exactly their own case. `smoke-live.test.jsx`'s demo-initials
guard now derives its alternation from the roster instead of listing
seven pairs, so it keeps covering people added after it was written.

## D95 · A re-served learn card arrives answerable — the feed's vote mirror no longer outlives the serve

**Date:** 2026-08-11 · **Status:** Adopted

**Found on a device (2026-08-11).** Screenshots from a phone running a
live build showed a knowledge card mid-feed already answered: the correct
option green with its ✓ and 61%, the missed pick ✕-marked at 11%, "Three
in a row to earn it." under a reveal the user had not tapped that
session. The card was a re-serve — Learn's scheduler had brought it
back — but the feed had persisted the previous sitting's pick in
`insight.feedVotes.v1` (`lrn-<card>` keys) and `knowOf()` rebuilt a
disabled replay from it. Once answered anywhere, ever, a card could never
be answered again in the feed: the three-in-a-row streak was unreachable,
and the check-in — "miss the check-in and the fact leaves your map" —
could not be answered at all. The spaced-repetition machinery was serving
cards no tap could reach.

**Decision.** A know vote lives exactly as long as its serve:

- **WF_LS carries no `lrn-` entries.** The feed's load and save both pass
  through one strip (`wfStripKnow`): load heals what older builds
  persisted, save keeps the in-memory copy from writing them back — and
  `setKnow` still saves, so the first learn answer scrubs the residue
  durably rather than waiting on the next world vote. The cross-session
  record of a learn answer is LEARN's own store (`insight.learn.v3`),
  which already holds state, streak, position and time; the mirror held
  the same fact with no expiry, and the copy with no expiry won.
- **`knowOf()` rebuilds nothing.** The reveal is this sitting's verdict
  (`knowRes`) or absent. The rebuild path existed for "a reload keeps
  your pick"; after the answered-cards-leave release change, what it
  actually did was render every re-serve frozen.
- **The LIVE reconcile skips `lrn-` ids.** A learn answer is never in
  `myVotes`, and the mirror now deliberately drops it, so "absent from
  both store and mirror" — the reconcile's rollback test — would hold for
  every know reveal on screen and wipe it at each snapshot notify.
- **LEARN_FEED serves fresh or due, nothing else.** `plan()`'s slow/warm
  fallbacks exist so the standalone `next()` never runs dry; in the feed
  they were the supply of frozen replays. `cards()` now keeps a card only
  if it has no state or `LEARN.due()` holds — the new public seam,
  sharing `plan()`'s own predicates (repeat: learning ∧ k<STREAK ∧ pos
  gap ≥ GAP; check-in: known ∧ older than CHECKIN_D ∧ pos gap ≥ 12) so
  the two can never disagree. A thin pool now yields fewer knowledge
  cards instead of unanswerable ones.

**The arithmetic.** GAP=4, STREAK=3, CHECKIN_D=12 are unchanged. What
changes is who enforces the spacing: `answer()` never checked it (it
credits any right answer), the scheduler did — so a serve that could not
be credited honestly must not reach the screen. One visible consequence,
accepted: the demo seed's mid-streak card (sol2, k=1 at pos 7 of 9) now
appears after two more learn answers rather than immediately — and it
appears ANSWERABLE, which the frozen version never was.

**What does not change.** D32's first-exposure rule holds untouched:
`answer()` reports to `LIVE.learnAnswer` only when the card has no prior
state, so re-serves stay device-local and the crowd stat still measures
first attempts only. The Map's mastery record (`LEARN.mastered`) never
read the feed's mirror. And within a sitting nothing moves: the serve
list is planned once per mount (`knowQs`'s cache), and votes/knowRes are
set together, so the reveal being watched survives every re-render.

**Enforcement.** `learn-serve.test.js` pins `due()` at its three
boundaries and `cards()`'s fresh-or-due filter; `learn-reserve.test.jsx`
mounts the real feed against the real scheduler and walks the loop — a
due card served enabled over seeded pre-D95 residue, the tap credits
k=1, and WF_LS ends with no `lrn-` keys — plus the source pin on the
reconcile skip, the one branch the demo harness cannot notify.

## D96 · A live build advertises no demo communities or empty leaves — and every bank subject runs always-on

**Date:** 2026-08-11 · **Status:** Adopted

**Found on a device (2026-08-11).** The add-topic sheet on a live phone
offered "Swimming · 3.2K people · fjord swims, no excuses", "Tennis ·
9.4K people", "Letterpress · 340 people" — sample-data communities,
member counts and vibes invented, each with a working Follow button —
above a Topics section listing the demo leaves as "Tennis · Sport · 0
questions". The feed showed the same fiction as a dashed card:
"Swimming · suggested scene · 3.2K people". D66 removed follows the user
never chose; these were worse — an invitation to choose one. Fabricated
populations offered to a real user (D1), and rooms with nothing in them
(the live boot replaces WORLD_FEED_QS with the bank, which tags nothing
with `sub` or `scene`).

**Decision, in three parts.**

1. **Stores own the offer.** `SCENES.offers()` and `SUBTOPICS.offers()`
   are what a surface may advertise; the add sheet, the feed's
   suggested-scene card and search all read them now. `defs()`/`all()`
   stay whole underneath — they are the dictionaries existing follows and
   tagged cards resolve labels through, and a follow the user really made
   keeps working.
2. **Scenes refuse by session, leaves by stock.** Scene offers are `[]`
   when `LIVE.enabled || LIVE.demoInProd` — a real user in the mock
   fallback is still a real user — because the entity itself is the
   fabrication; no amount of stock could make "3.2K people" honest. A
   leaf is offered exactly when it has questions (`count > 0`), in
   EITHER build: the taxonomy's own rule ("a thin subtopic would feel
   like a broken room") enforced at the offer, so the day live questions
   carry `sub` tags the leaves return with no code change.
3. **A live build widens the always-on channels to every subject its
   bank stocks.** The demo reaches sport, food, movies, music, tech and
   culture through the communities that pull them; with no communities
   to offer, those subjects — 51 of the 73 seeded questions
   (13+9+6+5+6+12), against 22 on the format channels — were reachable
   by nothing: no chip, no follow, no search result. WORLD_CHANNELS in a
   live build is WORLD_TOPICS minus `places` and `fav`, the two formats
   the bank mapper cannot emit (data/live.ts maps every bank doc to a
   plain vote; rate and pick cards never come out of it) — which also
   retires the two dead chips the live row already showed. Build flag
   rather than runtime, for learn-progress.js's reason: the list is read
   at module scope, before boot attaches — and the demoInProd fallback
   needs the same widening, because a live build seeds zero follows and
   its demo pool had the same dark subjects.

**What it does not change.** The demo build is untouched: seeds (D66's
fix), offers and channels all keep their demo shapes, and the smoke
suite's control cases pin it. Existing scene follows on a live device
keep filtering the feed — `mine()` reads the follow list, not
`offers()` — so what disappears is only the invitation to acquire new
fictional ones. The profile's live scenes surface stays LiveScenesCard.

**What brings the offers back.** A scenes backend — real communities
with real member counts — restores `SCENES.offers()` the same way a
measured per-cohort aggregate restores D89's row; `sub`-tagged live
questions restore the leaves by themselves.

**Enforcement.** `follow-seeds.test.js` (D96 block) drives both stores'
`offers()` through the live singleton, demoInProd included, and pins the
dictionaries staying whole; `world-channels.test.js` pins both channel
sets; `smoke-live.test.jsx` asserts the mounted surfaces refuse — no
Communities section, no 0-question rooms, no suggested-scene card, with
Learn and the suggest door intact; `smoke.test.jsx` holds the demo
controls for the sheet and the suggestion card.

## D97 · Question production upscales behind a regulator: computed budgets, a mechanical style gate, and measured vintages

**Date:** 2026-08-11 · **Status:** Adopted (owner's direction: "upscale
question production in a huge way but also a smart way, so the questions
are high quality and improved constantly")

**Decision.** Production scales by raising every lane's *ceiling* while
pinning every lane's *actual* output to what the human gates measurably
absorb — D33's "review capacity is the binding constraint" kept as the
design's spine rather than repealed by enthusiasm. Four parts:

1. **The daily lane's budget is computed, not flat.**
   `scripts/farm-budget.mjs` replaces D33's hard cap of 4/run: up to
   `RUN_CAP` (8) questions per run while the *pen* — unpromoted archive
   entries plus questions sitting unreviewed on the lane's open PR — is
   below `PEN_TARGET` (56, eight weeks of D30's ≥7/week promotion
   floor), zero at the target, and zero whenever the open PR carries
   `OPEN_MAX` (12) unreviewed questions regardless of the pen.
   `farm-budget.test.mjs` pins the property the upscale rests on: at
   steady state, generation equals measured promotion throughput — the
   cap binds only during catch-up, which is what makes doubling it safe.
   `check:figures` holds the constants QUESTION-FARM.md quotes equal to
   the script (that manual is LIVE documentation — scheduled runs obey
   it verbatim, so a drifted figure there is a mis-instructed run).

2. **The style guide's checkable half becomes a gate.**
   `scripts/question-quality.mjs` (`check:quality`, ci.yml lint job —
   content quality, deliberately off the deploy path like
   check:neighbors) holds bounds measured from the corpus on 2026-08-11
   (prompts ≤120 chars against a measured max of 97; option labels ≤32
   against 26; tags ≤4 words; the exact option shapes per type; axis
   required on ordinals; cat/alts against CAT_META), the batch-mix
   rules (tone spread, form variety), and a tripwire for hard rule 6's
   obvious form — a watched place name and a civic cue in one question
   (the conjunction, so "One cuisine, forever?" with Italian in the
   options passes and "Should Oslo ban cars downtown?" fails; the
   watchlist is deliberately small because the 10,929-place city
   catalogue collides with English — "Nice", "Split" — and a gate that
   cries wolf is retired, not obeyed). Candidate/batch modes emit the
   review packet a lane run pastes into its PR body, which is the
   actual attack on the bottleneck: reviewer attention moves from
   re-counting option arrays to warmth, semantic dupes and
   will-it-split — the judgments only a human can make.

3. **Provenance becomes data, and the farm is measured by vintage.**
   `content/provenance.json` records who wrote every daily and feed
   question (editorial / farm / community) and in which batch —
   backfilled from the archive's own dated block comments (53
   prototype-era editorial, the farm's 12 of 2026-07-30 = PR #32, the
   authoring session's 25 of 2026-08-01), maintained by
   `promote-questions.mjs` (new required `--source`, optional
   `--batch`) and the lane PRs, and held exactly in step with the banks
   by `check:quality`, both directions. The scorecard grows a
   `production` section (`rollupProduction`, scorecard-metrics.mjs —
   tested arithmetic, the D33-amendment pattern) cutting the same
   k-floored rows by source and vintage: no new read path, nothing
   per-user, the D40 duel-section precedent. The farm reads its own
   trend every run and cites it in the PR body — "improved constantly"
   as arithmetic. The committed scorecard.json is deliberately NOT
   regenerated here: the pre-launch artifact has zero scored rows, so
   the section lands with the next real `--fetch` (the same call the
   D33 amendment made when it changed the metric before any measured
   value existed).

4. **The feed gets a lane, and cadences are recorded.** The feed is the
   one surface whose consumption scales with users rather than the
   calendar, and it had no production lane; QUESTION-FARM.md gains one
   (single gate, learn-style: ≤6 vote-questions/run, at most twice
   weekly to start, taxonomy topics only, ship active, provenance rows
   required, every farm hard rule inherited). Daily promotion's target
   rises to ≥14/week while the pen has stock — a day of runway gained
   per day. The daily-plus-feed generation ceiling lands at 68/week
   (56 + 12) against the old daily-only 28 — about 2.4×, with learn,
   duel and catalog cadences unchanged; the regulator, the roll-up rule
   and the packet are what keep actual throughput honest against one
   reviewer.

**The arithmetic.** Daily: consumption 7/week, promotion floor 7/week
(D30), target 14/week; pen target 56 = 8 weeks of floor-rate promotion
cover; RUN_CAP 8×7 = 56/week refills a drained pen in a week, after
which output = promotion rate by construction. Headroom, gated rather
than remembered (`check:quality` tripwires): daily seed ids fail at 970
of the 999 the `/^daily-\d{3}$/` shape allows (warn 900); the seeded
bank fails at 1400 of the client's `limit(1500)` fetch ceiling (warn
1200 — D30's rule at that call site is pagination, never another raise).
The dqx archive series crossing dqx99 to three digits was checked, not
assumed: all three id sites share one formula (`padStart(2)` passes
longer suffixes through) and nothing sorts dqx ids lexicographically.

**Not done, deliberately.** No epoch-safe retire lane for daily
questions and no option-edit "replace flow" — D52's flagged items still
wait; retirement stays feed-only `active:false`, and the scorecard keeps
proposing rather than applying. No semantic dedup automation: the
lexical gate (D63) plus the human re-read stands — the metric's 0.5
calibration is measured and a metric change would silently invalidate
it. No new Routine yet for the feed lane (maintainer-asked dev-session
runs, the duel lane's path), and the question-farm Routine's prompt
refresh rides the already-pending D33 re-pace owner step. Scorecard
freshness stays hand-cranked (`--fetch` needs the key); the staleness
rule degrading lanes 1–2 to coverage is the designed failure mode, and
a run against a stale scorecard now says so via `farm:budget`'s output
instead of silently thinning.

**Enforcement.** `check:quality` in ci.yml's lint job (corpus form
rules, provenance join, headroom tripwires — all green at adoption over
247 questions); `check:figures` on the three quoted budget constants;
`farm-budget.test.mjs`, `question-quality.test.mjs` and the
`rollupProduction` pins in `scorecard-metrics.test.mjs` via
`test:scripts`; `pulse-collect` now cross-reads `RUN_CAP` instead of
hand-quoting D30's stale 12/week (the exact stale-copy class D39
names). The farm manual's budget, writing, promotion and feed-lane
sections plus the canonical Routine prompt were rewritten in the same
commit, so contract and machinery cannot describe different worlds.

## D98 · Answers are public — the privacy model is retired, not paused

**Decided:** 2026-08-11 · **Status:** binding · **Owner's call**, stated
directly: *"the answers are NOT private — that should be completely
removed from every doc, every place, that's the whole point of the app"*,
and on the k-floor specifically: *"I don't care if it's k-safe, that
whole principle needs to die."*

**Decision.** A signed-in user may read any other user's answers and
profile. Population statistics are exact and publish from the first
answer. There is no k-anonymity floor, no publish cadence, no
complementary suppression, no `tooSmall`, and no special-category
carve-out. Comments carry author names at every scope.

### What this reverses

| Decision | Was | Now |
| --- | --- | --- |
| **D1** | comments and who-voted are circle-scoped | both are world-scope and named |
| **D5** (read arm) | answers owner-only, always | answers world-readable; the WRITE arm (owner-only, create-only) is untouched |
| **D11** | the feed's argument surfaces are demo-only by structure | the structural gate stands only where the data is *invented*; nothing is hidden for being real |
| **D18** | the floor bounds cohort size | there is no floor |
| **D44** | political items never slice | every question slices |
| **D50/D81** | lens self-reports; floor paused to 1 | moot — the floor is gone rather than paused |
| **D72** | MapStats refuses in live mode | still refuses, for a different reason: it is *invented*, not private. Real typicality is now computable and unbuilt. |
| **D78/D83** | named who-voted refused permanently | reversed; anonymity was the whole of D83's takes and is now none of it |

D9, D8's snapshot mechanic, D86's edit shape, D57's server-scored logic,
D28's correctable ledger and D65's fail-closed `hidden` equality are
**not** touched — none of them was about who may read an answer.

### The reasoning, in the owner's frame

The product's claim was that its privacy guarantees are enforced rather
than promised. That claim was kept, expensively and well — and it was
enforcing the wrong thing. InSight exists to show how one person's
answers link to everyone else's; a model in which no user may read
another user's answer cannot draw that picture, and every surface that
needed it was dark. The Mirror shipped a ruler with no lenses. Circle
showed an empty state. Explore, Compare, People, Scores and the Map's
typicality were all built and all unreachable. The floor made the rest
render as "withheld" at every real cohort size, which is why D81 had
already paused it to 1 — the pause was the first admission that the
principle cost more than it bought.

### What was NOT removed, and why each is a different question

Three denies survive `firestore.rules`, each labelled at its own path:

- **`v2_logic_attempts`** — holds the unscored answer key. Anti-cheat.
- **`v2_flags`** — reporter identity. Anti-retaliation: a reporter
  visible to the reported is a reporter who stops reporting.
- **`v2_presence`** — uid → ~1 km cell. Physical safety. D98 publishes
  what people *answered*; "lives in Oslo" is published, "is at this
  corner of Oslo at 14:02" is not.

Two more, on non-privacy grounds:

- **Duel answers stay sealed until the reveal.** Implemented as a
  `surface` test on the answer read rather than by owner-only-ness. This
  is a game timing rule — a hand of cards is face-down — and publishing
  it early links no data the reveal does not publish a day later.
- **`v2_groups` stays member-gated**, because the document carries
  `inviteCode`, which is a *capability*: world-readable codes let anyone
  join any circle. Opening the roster wants the code split onto its own
  server-only doc first. Follow-on, not a privacy claim.

### The one thing this change had to ADD

Opening `v2_users` published `fcmTokens` — push registration tokens, a
credential — to every signed-in user, handing any script the fan-out list
the reveal sender uses. Tokens moved to `v2_users/{uid}/push/tokens`,
server-only both ways. Moved rather than re-guarded: a field guarded by a
rule is one edit from being readable, a path with no read grant is not.
`deleteAccount`'s recursive delete already covers it.

### Two traps this change walked into, both caught before shipping

1. **`isTooSmall` was fail-closed.** `(agg||{}).tooSmall !== false` hid
   counts unless the server said otherwise. The server stopped writing
   the flag in this same change, so a client still reading it would have
   blanked every count in the app — daily, feed, lens, learn, Mirror.
   Client and server had to move in one commit; the predicate is now
   `hasPublishedCounts`, an existence test, and the field is renamed
   `noCountsYet` so a surface reading the old name fails loudly instead
   of going on saying "withheld".
2. **The bucket eviction used the k-floor as its threshold.**
   `evictForNewBucket(byDim, floor)` made a bucket evictable while it sat
   under `AGG_MIN_N`. Threading 0 or dropping the parameter would have
   made *nothing* evictable, silently restoring the cap-exhaustion attack
   (24 junk `city` values permanently blanking that dimension for a
   question) with every test still green. It now has its own name and its
   own reason: `BUCKET_EVICT_BELOW = 5`, a document-growth bound with
   nothing to do with who may see what.

### Cost accepted

The publish cadence was also relieving write contention: both documents
in the trigger's transaction are keyed by qid, against Firestore's
~1 write/sec/document (D7). Publishing per answer restores that pressure.
Accepted knowingly at launch volume. The mitigation when it bites is
sharding, or collapsing `v2_aggs_private` into `v2_question_aggs` — which
is now trivial, because the private doc has no readers and no secrets. It
is **not** to reintroduce a floor.

### Timing

`answersCounted` has been 0 every day through 2026-08-11 (monitoring/
pulse-trail.jsonl) and the app has not launched, so no answer was ever
collected under the owner-only promise. There is nothing to migrate and
no retroactive disclosure. Had there been, the old rows would have needed
gating rather than republishing.

### What this change does NOT do

D98 removes the model. It does not build the features the model was
blocking — named who-voted, the Kindred people lens, person-to-person
Compare, Explore, the Map's real typicality, the relationship map. Those
need read paths no client module has yet: a collection-group query on
`answers` (the rule and the composite index ship here; the query does
not) and batched uid→name resolution. Sequenced as follow-on work.

## D99 · The Mirror's lens row comes back, on data that was already there

**Decided:** 2026-08-11 · **Status:** binding · Follow-on to D98.

**Decision.** The live Mirror's geographic stops carry a lens row again —
**People**, **Compare**, **Explore** — plus the Map's typicality reading
becomes real for the two anchors that map onto a breakdown dim.

### Why this is a small change and not a large one

Almost nothing here is a new read. `v2_question_aggs.by` — dim → bucket →
option → count — has been published, client-readable and folded from
every answer's anchors snapshot (D8) since long before D98. What D98
removed was the suppression that made it useless: cells below the floor
were dropped, a lone hole took its neighbour with it, and a dimension
with fewer than two surviving buckets vanished entirely. A lens built on
that would have shown holes and called them cohorts.

With the map published whole, three of the five prototype lenses are a
pure fold away, and `src/v2/data/cohort.ts` is that fold: `mixFor`,
`sliceSplit`, `divergence`, `typicality`, `agreement`. No Firebase, no
window, unit-tested directly.

### What each lens rests on

| Lens | Source | New read? |
| --- | --- | --- |
| **People** — the mix | `mixFor` over the deck's aggregates | no |
| **People** — Kindred | `agreement` over the cached voter lists (D98) | only for questions whose who-voted sheet was never opened |
| **Compare** | `pctFor` on your own option, ranked least-typical first | no |
| **Explore** | `divergence` across the six dims | no |

Kindred is the only one that can cost anything, and it is bounded at
`KINDRED_QUESTIONS = 12` of the viewer's own most recent answers. Twelve
shared questions is already a legible likeness claim; unbounded, it would
fan out over every question an account has ever answered, on a screen
someone may open casually. The whole row is collapsed by default, so
opening the Mirror pays for none of it.

### The likeness metric, and why it is the boring one

Agreement is `same / shared` over commonly answered questions. No
weighting by how divisive a question was, no distance over scale options.
Both would be better statistics and both are judgement calls about what
likeness MEANS — a product decision. This one can be explained in one
sentence to the person it is about, and it ships with that sentence
rendered directly beneath it. A likeness number nobody can explain is a
number nobody should trust, least of all on a screen that names people.

### The Map: D72 partially reversed, and precisely which part

`window.MapStats.dist`/`mode` now return real numbers for the `age` and
`edu` anchors, computed by `typicality` from the published breakdown.

Everything else still refuses, and the refusals are structural rather
than pending:

- **`job`** is `profession`, deliberately never a breakdown dim (D8) —
  free text mints a bucket key per spelling, forever.
- **`big5`, `political`, `values`, `attachment`, `cognitive`** are test
  RESULTS. Nothing aggregates them per cohort, so "how did similar
  personalities answer" has no source at all.
- **`dimVal`** — a cohort's score on a test dimension — has no source for
  the same reason, at every anchor.

D72's mechanism is kept exactly: the refusal returns **null** rather than
gating at the call sites, so a consumer that forgets the check fails a
test instead of quietly fabricating. That mechanism is why this change
was findable at all — the null is what made it obvious which readings
were invented and which were merely unbuilt.

`cohortN` is added alongside, so the Map can say "of 6" rather than
present a 50% drawn from two people as though it were a finding.

### What is still NOT built, and why not

- **Scores.** The place scorecard is fed by `rate` questions and the bank
  ships none, so the lens would be an empty frame. Content, not code.
  Building the frame first and filling it later is how a surface ends up
  permanently looking broken.
- **The Answers lens's own depth.** `LiveCohortBody` is the Answers lens,
  and it is thinner than the prototype's: no branch filter, no
  sort-by-divisive, no expand-a-row-into-the-distribution. All three are
  computable from what is already loaded. A gap in a lens that exists.
- **Circle / relmap.** Still no person-to-person graph in v2 (D3). Kindred
  is the nearest honest thing: likeness without a follow.

### One number this row must never be read as

The mix counts **answers, not people** — someone who answered ten
questions appears ten times. It is summed across the deck because a
single question's mix is a fact about that question's audience, and the
copy says so on screen rather than leaving "40% are 25-34" to be read as
a census.

### What it cost, and the thing that finding turned up

This row put the bundle over budget, and `check:bundle` moved 2120 → 2140
to admit it. The arithmetic, measured with CI's own build command one
commit apart rather than estimated:

| tree | total JS |
| --- | ---: |
| main @ the D98 merge | 2119.6 KB |
| + D99's lens row | 2131.0 KB |

D99 is +11.4 KB, but it is not really what spent the budget. The 2120
ceiling was set on 2026-08-10 to sit just above a 2102 KB tree, and D98's
read path — the collection-group query, `data/voters.ts`,
`LiveVotersPanel` — took 17.6 KB of that 18 KB before this row added a
byte. Two features landed in the gap between a ceiling and the thing it
measures; the second one merely tripped it.

**The useful finding is that the standard remedy is now exhausted.** Every
previous squeeze on that budget was answered by deferring a module group
past first paint (D25, D38). Against the *total* that is worth nothing —
it counts every chunk, so splitting relocates bytes and changes the
number by zero. Verified rather than assumed: the lens row is ~9 KB of
the entry chunk, and making it lazy leaves the total at 2131. Only
deleting code moves this ceiling.

So the headroom each raise has left is the number to watch — 41.6 KB
(08-06), 18 KB (08-10), 9 KB now. A fourth raise should not happen; the
untaken candidates D64 named are the Mirror tab's ~168 KB (harder than
the overlays — it renders on the first frame for anyone who opens on that
tab) and an audit of how much of Sentry's ~470 KB is reachable at all.

One correction fell out of that audit and is recorded here because it was
a *figure in a comment*, which is the documentation error this repo keeps
re-committing (D39). `check-bundle.mjs` had claimed for five days that
"156 KB of the Sentry group is @sentry/react's Spotlight dev
integration". That was a chunk name read as chunk contents:
`spotlight-*.js` is Sentry core — `captureException`, the client, the
logger, v10.60.0 — which rolldown named after one of the smaller modules
inside it, and all three esm entries import it. The Spotlight integration
is 1.9 KB of unminified source. The sentence had been sitting there
inviting someone to go chase a 156 KB win that does not exist, and it is
withdrawn in place.

Unmoved on purpose: `MAX_CHUNK_KB` stays 735 against a 732.0 KB entry
chunk. Three kilobytes of headroom means the next eager addition fails
there rather than on the total, and has to defer instead of argue.

## D100 · Scores and the Answers lens, on the archive rather than the week

**Decided:** 2026-08-12 · **Status:** binding · Follow-on to D99.

**Decision.** The Mirror's lens row gains **Scores**, its Answers lens
gains the branch filter, the sort and the expand-a-row it was missing,
and both read every question this device holds an aggregate for instead
of the seven-day deck.

### The enabler is one accessor, and it is why the other two were stuck

`LIVE.aggregated()` returns every active daily question with published
counts — the deck plus everything the user has ever answered, which
`hydrate` already fetches and caches (`AGG_ID_CAP`, 120). No new read:
the same map, walked rather than indexed.

Both features were blocked on the *size of the set*, not on data:

- A branch filter over seven rows offers fourteen subjects holding one
  row each. A sort over seven rows re-orders half a screen. Neither is
  worth the strip it takes to draw.
- Scores could not exist on the deck **at all**. The bank holds five
  `rating` questions in ninety, so the rotation serves a given week none
  about two weeks in three.

### Scores was refused at D99 for a reason that was wrong

D99's note said the place scorecard is fed by `rate` questions, the bank
ships none, so the lens would be an empty frame. The first clause is
true and the conclusion does not follow. `rate` is the *prototype's*
place-scorecard type; the shipping bank carries **five 1-10 `rating`
items and sixteen 5-point `scale` ones**, and an ordinal question is an
ordinal question whether its subject is a city's nightlife or your own
outlook. The lens filters on TYPE (`ORDINAL_TYPES`), so place-rating
questions join it the day someone writes them, with no code change.

What the lens must never do is average a *categorical* question, and
nothing in `counts` could tell it apart from an ordinal one — "Messi"
and "Ronaldo" are different, not ordered, and their mean would render
exactly as confident as a real number. The type filter is the whole
guard, and it has the test that names it.

Two arithmetic choices, both with a case pinning them:

- **Ranked by share of the scale**, not by raw mean. 4/5 must outrank
  7/10; ranking on the mean sorts by which scale a question happened to
  use.
- **The denominator ships with every number.** One list mixes 5-point
  and 10-point questions, and "6.2" means opposite things across them.

### The branch was in `content/` all along, and the seed dropped it

`daily-questions.json` carries `cat: ["Mind", "Outlook"]` — a
[branch, sub-branch] path, the taxonomy the Map files answers under.
`gen-v2content.mjs` emitted `topic: q.tone` and nothing else, so the
seeded doc kept *tone* (light/deep/blend) and lost the subject entirely.
Nothing noticed because the demo layer reads the path from its own copy
of the bank; the first consumer that could only see Firestore was this
filter, and it had three tone buckets to offer instead of fourteen
subjects.

`branch`/`sub` now ride the seed, emitted only when set (the `mode`
rule) — 90 daily entries carry a path and the other 423 do not, so
writing null would rewrite the whole bank to say nothing about four
surfaces out of five. **Every question seeded before today still has no
branch**, and will until the next seed run, so both readers treat it as
undefined and the chip row simply does not render. That is a case, not
an assumption.

Cost: the bank's wire size goes 116.1 → 119.3 KiB, which is +3.2 KiB on
every cold boot's 513 reads. `check:figures` caught the stale figure in
`docs/COSTS.md` before this was committed, which is the third time that
gate has paid for itself.

### "Newest" is in the prototype's sort list and is deliberately absent

The archive spans any day the rotation has reached, and nothing the
client holds dates an answer: the aggregate carries no timestamp, and a
question's bank position is where it entered the bank, not when it was
asked. A "Newest" that silently meant "highest seq" would be a label
that is wrong about six days in seven. Three honest orderings ship
instead — most answers, most divisive, most agreed.

`divisiveness` is normalised by option count, and that is the only
interesting thing about it: a 30/25/25/20 four-way is a divided room and
a 30/70 binary is not, but raw leading share scores them 0.30 and 0.70
and ranks the binary as *more* divided. Scaling against each question's
own even split puts a mixed deck on one axis.

### A fixture that had been proving the wrong thing

`live-fixture`'s aggregate carried `by: {}`. Giving it a real breakdown
so the Mirror's geographic stops have rows turned two `smoke-live` cases
red, and the reason is the finding: a live feed card with a cohort
breakdown renders the **surprise line** and drops the bar-chart button
with it (`world-feed.jsx` gates the button on `!ins` — the line is
already a door to the same sheet). With an empty `by` that line could
never render, so every case in that file had been silently testing the
button-only branch: the one a real user with real data sees *least*
often. The helper now accepts either door, so both are covered.

## D101 · Circle, on a follow graph that needs no handshake

**Decided:** 2026-08-12 · **Status:** binding · Follow-on to D98.

**Decision.** The Mirror's Circle stop draws real people: a one-way
**follow graph** at `v2_users/{uid}/following/{targetUid}`, the accounts
you follow ranked by how alike your answers are, and a fold showing
where your circle splits.

### Why this got easy, and it was not new plumbing

Circle has shown an empty state saying "one-to-one connections aren't
built yet" for the whole life of live mode. D3 is why: v2 has no
person-to-person graph, and groups joined by an invite code were the
only real connection the app could make. The 49 named people in
`relmap-core.js` are prototype data and live mode has never shown them.

What changed is D98, not the plumbing. **A follow is a bookmark, not a
permission grant.** Every answer and profile is already readable by any
signed-in user, so following someone conveys no access they did not
already have — which deletes the hard half of a social graph. There is
no request, no acceptance, no notification, no pending state, and no
state machine: a follow is one document that exists or does not.

Mutual follows are a **reading, not a state**. If both directions exist
the client says so; the server stores two independent rows and knows
nothing about the pair. A friendship that must be agreed is a consent
mechanism, and consent is only owed for access the follower would not
otherwise have.

### The one judgement call, and how to reverse it

**The graph is world-readable.** This does not follow from D98, which
published *answers*, not the social graph — so it is a call rather than
a consequence, and it is flagged here the way D98's four were.

Two reasons it goes this way: the app's thesis is that the links between
people are the interesting part, and public → owner-only is a breaking
change for anything built on it while the reverse is additive. **To
reverse:** change one line in `firestore.rules` to
`request.auth.uid == uid`. Circle itself reads only the viewer's own
list and keeps working; what goes is the followers direction — the
mutual flag, and any "who follows me" surface, neither of which exists
elsewhere yet.

### Three details that are load-bearing

- **`to` duplicates the document id**, pinned equal to it by the rules.
  A collection-group query cannot filter on a document id, so without a
  field `deleteAccount` could not find the follows *other people* hold
  of a deleted account. The rule pins the two together because an
  unpinned copy is a second source of truth about who a row points at —
  and the erasure sweep reads the field, so a mismatched row would
  survive its own target's deletion. Phase 3b, with the `relations`
  sweep as its precedent, plus a control in `e2e-delete-account` proving
  the sweep matched on `to` rather than taking a whole following list.
- **No update, ever.** Create and delete only. Rewriting `at` would
  reorder someone's Circle, which is the one thing the stamp decides —
  `fetchFollowing` sorts oldest-first so `FOLLOW_CAP` is stable across
  sessions.
- **`FOLLOW_CAP` is a bound on fan-out, not a product limit.** Circle is
  the only surface that reads a named individual's whole answer set
  rather than a question's voters, so opening it costs one query per
  member. If it ever binds in the field the answer is to page the fetch,
  not to raise the number quietly.

### The fold excludes you; the Map's includes you

`circleSplit` counts members only. `typicality` (D99) does the opposite
and counts you in your own age band. The difference is the question each
screen asks: "how typical was I" needs the cohort the aggregate folded,
you included, or the Map disagrees with the who-voted sheet beside it.
"What do the people I follow think" does not — and folding yourself in
would let a circle of one reflect your own answer back as consensus.

The ranking's real trap is the tiebreak. Agreement is a percentage, so
one shared question that happened to match scores 100% and heads the
list forever, above someone who matched on forty of fifty. It looks
completely right until somebody answers a single question, so overlap
breaks the tie and a case names it.

### The bundle budget did what the last note said it would

D100 and D101 together took the tree to 743 KB entry / 2147 KB total —
over both ceilings. The D98/D99 note in `check-bundle.mjs` had left
3 KB of headroom under `MAX_CHUNK_KB` specifically so the next eager
addition would have to defer rather than argue, and predicted that the
per-chunk gate would catch it first. It did.

**Neither ceiling moved.** Three deferrals (Circle body and the lens row
via `React.lazy`, `data/circle.ts` via a dynamic import inside
`live.ts`) took the entry chunk to **727 KB** — smaller than the 732 it
was before either feature. And the trim that note asked for by name
turned out to be real: `src/lib/sentry.ts` imported `@sentry/react` and
used exactly one symbol from it (`init`), while `@sentry/capacitor`
depends on `@sentry/browser` directly and lists `@sentry/react` as one
of three framework peers. Sentry's ErrorBoundary, Profiler and router
instrumentation were never wired to anything. Swapping the import took
the total **2147 → 2119**.

One deferral bought nothing measurable — `data/circle.ts` out of
`live.ts`'s static graph left the entry chunk at 738 — and it is kept
anyway, because a dynamic import there is the right shape. Recorded so
the next reader does not re-derive it as a win.

## D102 · The D98 surfaces get their bounds, their index, and their bill

**Decided:** 2026-08-12 · **Status:** binding · Follow-on to D98–D101 —
the optimisation pass over what the reversal brought back.

**Decision.** Four things, one theme: the read family D98 created is now
bounded, indexed, modelled and cheap to render. `fetchVoters` is capped
at `VOTER_FETCH_CAP = 200`, newest first, and the sheet says when the cap
binds. `answers.surface` gets its single-field index back at COLLECTION
scope, which is the index D101's Circle query has needed since the day it
shipped. The cost model gains a `social` term for who-voted, Kindred and
Circle, with all four bounds pinned to source. And the two Mirror bodies
that sorted with `divisiveness` inside the comparator now compute it once
per row.

### The index bug, and why every suite was green

`fetchAnswersOf` (data/circle.ts) filters one user's answers on
`surface` — mandatory, because the rules grant the cross-user read as a
value test on that field (D65). A collection-scope query with a
single-field filter needs the automatic single-field index, and D64's
exemptions had deleted exactly that one: `"indexes": []` on
`answers.surface`. The composite D98 added cannot serve it (its leading
field is `qid`, which this query does not constrain). In production every
member fetch returns FAILED_PRECONDITION; `loadCircle` drops failed
members by design, so a user with thirty follows sees "you follow
nobody" — the failure renders as an empty state, not an error.

Nothing caught it because nothing could: the emulator does not enforce
index configuration, so rules tests and e2e run as if every index
exists, and `circle.test.ts` is Firebase-free. D64 predicted this
precisely — "filtering answers by `surface` … will not be possible
without re-enabling that field first" — and D101 never mentioned indexes.

**The fix** re-enables the one shape the query needs (COLLECTION scope,
ascending; the collection-group and descending shapes stay exempt).
Cost: one more index entry per answer write on the app's hottest write
path, plus a backfill that is free today because the collection is empty
— a launch-window luxury this fix spends deliberately. **The guard** is
`src/v2/data/indexes.test.ts`: every filtered query shape in `data/` is
pinned to its entry in `firestore.indexes.json`, so the next
query-without-index (or re-exemption of a needed field) fails in
`test:unit` instead of in production. It is a name-level guard in the
smoke-test sense: it cannot prove a query runs, only that the two
artifacts that meet in production agree on paper. A new filtered query in
`data/` adds a case there.

### The cap, and its arithmetic

The daily question is globally shared, so its voter list is roughly
"everyone active today". Uncapped, one who-voted open at 5,000 DAU is
~5,000 answer reads plus up to 5,000 profile reads for names — ~10,000
billed reads and a multi-second render of a list nobody scrolls, growing
linearly with DAU forever, on a tap the UI invites. Kindred multiplied
that by twelve. Every sibling fan-out already carried a bound
(`CIRCLE_ANSWER_CAP`, `FOLLOW_CAP`, `KINDRED_QUESTIONS`, `AGG_ID_CAP`);
this was the only unbounded read in the app.

`VOTER_FETCH_CAP = 200` sits inside the query, after `orderBy answeredAt
desc`, so a capped page means "the latest 200" — and the panel says so
("1,234 have answered — these are the newest 200"), because a truncated
list presented as the whole room is the withheld-cell lie pointed the
other way. Below the cap the sheet is exhaustive and claims nothing.
Kindred inherits the bound per list: recency-biased, which is the honest
bias for a ranking recomputed from live lists. If page two is ever worth
having, the ordering already provides the cursor — page, do not raise
the number quietly (D101's rule, restated).

### The model: one term added, one staleness found by adding it

The `social` term charges (docs + names) per open across the three
surfaces, caps read from source (`readNum`, D47's mechanism), open rates
named as guesses in `B`. Re-running the model surfaced the second
finding: **every table in COSTS.md was still the pre-D98 run.** D98 set
the publish cadence to 1 and nobody reran the model, so the fan-out
column sat at a fifth of its true slope — which had silently moved the
read-crossover wall from ~18,200 DAU to ~3,700, *below* the D7 write
wall, inverting the surprise-invoice-before-surprise-outage ordering
COSTS.md exists to protect. The `social` term's flat 385 reads/user/day
pushes the crossover back to ~30,800. Both moves are now in COSTS.md's
walls section, and `pulse.test.mjs` pins the `readsPerUser` key set so
the next added term forces the consumers (READ_SERIES, the COSTS.md
table) to move with it.

### Render cost: measured, one fix taken, one deferred

Probe (node, bank = 513, every aggregate carrying a full 6-dim × 8-bucket
breakdown — the worst case): one `LiveCohortBody` render-equivalent of
the archive pipeline is **~1.9 ms**, of which the `divisiveness`-inside-
comparator sort is ~360 µs and over half the total once per-render
allocations are counted; precomputing it per row takes the pipeline to
**~0.7 ms**. Taken, in `LiveCohortBody` and `LiveCircleBody` — two-line
changes with a measured 2.7× on the pipeline.

Deferred, recorded with its trigger: the pipeline itself
(`LIVE.aggregated()` → rows → lensQs) is O(bank) per store notify with
fresh allocations, ~0.7 ms today and linear in a bank that D97 grows by
~1,300/year. Store-level memoisation (revision counters on aggs/votes)
buys it back but adds an invalidation surface — the exact bug class
(stale Mirror numbers) this repo hates most — so it is not worth its
risk below a few thousand questions. Revisit when the bank passes ~2,000
or a device profile shows the Mirror tab janking on notify, whichever is
first.

### Also deferred, recorded

- **`setFollowing` reloads the whole circle** (members × answer queries)
  to add one row. Correct, simple, and O(circle) reads per tap on the
  sheet where follow-sprees happen. Fine at five follows; an incremental
  insert (one `fetchAnswersOf` + one followers query) is the shape when
  it binds. Not built: pre-launch circles are empty, and the refetch is
  what keeps the no-optimism rule (a member never renders with a
  fabricated 0% likeness) trivially true.
- **Background listener teardown** stays unbuilt with Finding 2's
  polling, same reasoning: D7's wall binds first, and `onlineMin` — the
  input that decides — is measurable from a week of real usage.

## D103 · Four device readings: a retired test, a rail, the topics D96 left dark, and one notch paid for twice

**Decided:** 2026-08-12 · **Status:** binding · Owner's readings on a
TestFlight build, taken in one sitting.

**Decision.** Four fixes, three of them small and one of them a feature
removal, kept in one record because three of the four are the same
mistake in different clothes: a surface that stopped saying anything and
was left standing anyway.

1. **The passive-progress dot rows are a rail.** One dot per question,
   banks 20–32 long, and the dots were flex children with `flex-shrink`
   left at its default — which is the same as declaring no width at all.
   Thirty-two of them in a ~350px sheet rendered as ~5px slivers, and
   "the count IS the visual, no numbers" (passive-meter.jsx's own rule)
   stopped being true at the width where it mattered. `flexShrink: 0`
   plus `.h-scroll`, so the overflow becomes the rail grammar the rest of
   the app uses and `edge-fade.js` marks the cut edge. The rail opens on
   the FRONTIER, not on dot one: filled dots sort first, so a 20-of-32
   row otherwise shows nothing but filled dots and reads as finished.

2. **The Thinking test is retired, everywhere.** `cognitive` got a
   question bank on 2026-08-10 (twelve days after its result surfaces
   shipped) and is now gone from IS_TESTS / IS_TEST_RESULTS /
   IS_TEST_AVG, `PASSIVE.META`, the profile's sub-tab, the Map's anchor
   ring, compare's assessment list, the segment explorer's slice axes,
   the archetype / rose / explain / population data, and
   `content/tests.json` — so the bank regenerates at 493 questions
   (was 513) and the profiles sheet titles itself "Your four profiles"
   off `PASSIVE.KEYS.length`, as D85 built it to.

   **The half a deletion cannot reach, and what was done about it.**
   Retiring a *shipped* question is an operator `active: false` flip
   (functions/src/v2.ts: "the seed must never flip a question ops
   disabled back on, so it is only written on first create"). Deleting
   the source stops the 20 `test-cognitive-*` docs being WRITTEN, not
   served: they stay live, arrive in `TEST_FEED_QS`, and would weave in
   as marked cards for a test with no bank, no result page and no
   progress row. `world-feed.jsx` now filters that pool through
   `PASSIVE.testFor()`, which returns null for any key `META` has
   dropped — so the fence holds for the next retirement without naming
   it, and LAUNCH-RUNBOOK carries the console step that finishes the job
   at the source.

3. **The topics D96 left dark.** D96 was right to stop advertising the
   demo communities — "Writing · 2.1K people · Murakami, Solnit,
   Knausgård" with a Follow button is a population invented about nobody
   (D1), offered to a real user. What it did not do is notice that the
   refusal emptied the room: the sheet the "+" opens held nothing but the
   Learn dial, and the owner read that exactly as it looks — *"interests
   seem to have been removed, only the sample data of fake amounts of
   users."* Both halves of that sentence were true, and the second half
   was the fix.

   The replacement is what D96 part 3 had already made true and never
   showed anyone: a live build runs **every subject its bank stocks**,
   always on. `renderAdd` now opens with those channels — label, the hue
   the chip row uses, how many questions the pool holds, how many you
   have answered, and the mute the chip row has. Every number is counted
   out of `WORLD_FEED_QS`; none is a claim about people. Channels only,
   because scenes and leaves have a follow to remove and surfaces that
   own it, while an always-on channel had no management surface anywhere
   — it is exactly the set that looked deleted. Stockless channels stay
   out, by the same rule `SUBTOPICS.offers()` applies to leaves.

   The profile's empty scenes card stops sending people to a door with
   nothing behind it ("follow one and its questions join your feed") and
   names the topic sheet instead.

4. **One notch, paid for twice.** `.native-shell .app-header` and
   `.native-shell .overlay` each pad by `14px + env(safe-area-inset-top)`
   — and eight overlays draw an `.app-header` INSIDE the padded
   `.overlay`, so both rules fired on the same element tree: ≈146px of
   blank surface above every overlay title on a Dynamic Island phone,
   about a sixth of the screen spent twice on the same notch. The
   overlay's own header goes back to `.app-header`'s base 8px. The
   mockup frame was never affected — there the band is a fixed 62px that
   `.overlay` reproduces and `.app-header` does not add to. The profile's
   identity row was tightened with it (52→42px avatar, 16→10px lead),
   since it was the other half of a screen that opened on "You".

**Enforcement.** `smoke.test.jsx` replaces its end-to-end cognitive block
with the inverse — a half-removal draws a header with nothing under it,
which trips no boundary and no name gate — plus a fourth case pinning the
surviving four, because every other assertion there also passes on an app
with no tests at all. Two new cases pin the channel list and that its
mute moves the chip row's own state. `smoke-live.test.jsx` widens D96's
leak assertion from one sample string to `/\d+ people/`, so the section
cannot reintroduce a population claim, and drops its anchor count 8 → 7.
`world-channels.test.js` gains the invariant underneath the sheet: every
topic the feed bank actually uses is one of the live channels — "every
bank topic is reachable" and "every stocked channel has a row" are the
same sentence from either end, and the mount suites cannot check it
because the flag is read at module scope and both suites are demo builds.

**What is NOT included.** The `thinking` LENS (lens-defs.js, "Thinking
style") is a different instrument with its own questions and stays. Two
names in the same app is worth a look; retiring a live lens is not a
side effect of retiring a test.

## D104 · Test users: a second real account, and what it is allowed to fake

**Decided:** 2026-08-12 · **Status:** binding for the harness ·
Tooling decision — it changes no product surface and no rule.

**Decision.** `scripts/test-users.mjs` (`npm run testuser`) drives
synthetic accounts through the duel loop so 1v1 and groups can be
exercised from one browser. It writes **only through the client SDK**,
under each account's own session. Four deliberate limits, recorded here
because each one is a place where the harness stops resembling a real
device, and a surprise in a test tool is how a real bug gets attributed
to the tool.

### Why a harness at all

docs/LOCAL-TESTING.md answered "test a duo" with a second incognito
window. That covers the join and nothing after it: `shouldReveal` is
both-or-nothing for duos, `groupPortrait` is computed from reveal
**history**, and `nextStreak` needs consecutive revealed days. The cost
of one day of two-member history by hand is two windows, two votes and a
wait for the 2-hourly scan; the cost of three days is that three times.
Those are the surfaces least likely to have been looked at, which is the
argument for the tool rather than for more discipline.

### 1 · Identity is email/password, not anonymous (against D3)

Real devices are anonymous-first. An anonymous session cannot be
re-attached in a later process: re-signing in needs the refresh token,
and the JS SDK exposes no API that takes one. The alternative was
`firebase-admin` minting custom tokens, which adds a credential path to
a client-only tool.

The substitution is invisible to everything a test user touches, and that
is checkable rather than hopeful: no rule reads
`request.auth.token.firebase.sign_in_provider` (grep), no function
branches on it, and the profile's `anon` field has no reader — v2social.ts
names it only as an unbounded field. uid is what every gate keys on.

The cost: the harness cannot exercise anything that *does* depend on
anonymity, and if a future rule starts to, this is the first thing that
would silently stop being representative.

### 2 · Backfill reaches 3 days, not PENDING_DAYS_KEEP's 6

`firestore.rules` admits a duel answer while `timestamp.date(day) >
request.time - duration.value(4, 'd')`. The day key is midnight UTC, so
at 15:00 UTC the -4 key is 2026-08-08T00:00Z against a bound of
2026-08-08T15:00Z and is refused; -3 clears it at any hour. 3 is
therefore the largest offset that does not make the tool's behaviour a
function of when it was run. The reveal scan's window is 6, so a backfill
cannot fill it — accepted, because 3 days is already enough history for
the portrait and the streak to be non-trivial.

### 3 · A duo backfill settles only days the human also played

Both-or-nothing again, and the harness holds no session for the human, so
it cannot supply the other half of a past day. It reports each day it
could not settle and why, rather than writing one-sided history that
would then read as a broken reveal pipeline.

### 4 · `reset --purge` leaves the tallies it fed

`deleteAccount` erases the uid attribution (the D28 ledger) and keeps the
anonymous count, by design — phase 1b. So purged test users stay in every
count they voted in, and the only clean slate is an emulator restart. Said
in the command's own output, because a total that does not drop after a
delete is otherwise indistinguishable from a broken erasure.

### Emulator-only, and why that is structural rather than advisory

The script refuses to run unless `.env` has `VITE_USE_EMULATOR=true`.
Since D98 the public counts are **exact** and publish from the first
answer: there is no floor for a fake account to hide under, so test users
answering world questions on a real project would move numbers real people
are shown. The ledger's uid attribution exists so a discovered ring can be
subtracted after the fact (DEPLOYMENT.md, "Correcting aggregates") — a
cleanup path, not a licence to create the mess. Production also enforces
App Check on every member callable, which a Node process cannot attest to,
so the guard costs nothing that worked anyway.

### What is imported rather than restated, and the bug that argues for it

The day's question comes from the real `duelQFor`; anchors come from the
profile's closed vocabularies and cities from the shipped catalogue via
`placeKey`. Both would otherwise drift into a *plausible* wrong screen: a
drifted question selection seals answers to a prompt the app never asked,
which `revealQid` then publishes as the D70/D71 disagreement on every run,
and an out-of-vocabulary anchor writes fine and folds into no breakdown
bucket, counting in every total while appearing in no cohort cut.

The one thing the harness does compute itself — a per-person conformity
bias, so the splits split — is where this bit. It was first written in
`gHash`'s shape (`h * 31 + c`), whose last round adds the final character
straight into the accumulator, so consecutive inputs give consecutive
outputs. Question ids run `daily-007`, `daily-008`, `daily-009`: measured,
four users' rolls over those three came out .24/.25/.26, .41/.42/.43,
.03/.04/.05 and .46/.47/.48 — the population conforming or dissenting as
one bloc, publishing a unanimous split for **every** question, with real
per-cohort breakdown cells sitting underneath it looking correct. A
SHA-256 digest replaced it: 27 unanimous in 200 where it had been 200 in
200. gHash is fine at its own job (one gid, once); the lesson recorded is
that a hash chosen for a different modulus and input shape is not
transferable, and that the failure surfaced only from probing the output
distribution — reading the code, it looks like a hash.

## D105 · One text field owns the app's scale: every input defers to --field-size

**Decided:** 2026-08-12 · **Status:** binding · Owner's reading on a
device: "I get this error sometimes where it is too zoomed in, not sure
what's triggering it."

**Decision.** Every text-entry field in the app takes its size from a
single token, `--field-size: 16px` in `styles.css`, and may not declare
a font size of its own. `check:touch-zoom` fails the build if one does —
including with a literal `16`, because the bug was fifteen scattered
numbers, not any one of their values.

**What was actually wrong.** WKWebView and Mobile Safari auto-zoom the
page when a text field takes focus whose computed font-size is under
16px, scaling by exactly 16/size so the text lands at the platform's
floor. The app shell is `position: fixed; inset: 0` (spec/iOS.jsx), so
there is nothing to scale it back — no page to scroll to origin, no
browser chrome to reset. The zoom outlives the field, the overlay and
the tab, and every screen after it is cropped on the right.

**The arithmetic, measured rather than reasoned about.** Three device
screenshots eighteen minutes apart — the Mirror's Near stop, the profile
overlay and the World feed — all cropped, all at one scale. Three
independent rulers in them agree: the header search button's left edge,
the profile overlay's centred title, and the avatar box each give
1.067. 16/15 = 1.0667. The 15px was this repo's own `.search-field
input`, and the header search icon that opens it is on every screen in
the app, which is why the trigger looked like nothing in particular.

The layout was never implicated and was checked before anything was
changed: a 393pt render measures `scrollWidth === innerWidth === 393`,
with no element crossing the right edge outside a deliberate horizontal
scroller. Cropping without overflow is a scale, and only a scale.

Every field in the tree was under the floor — 12.5px (the feed's take
and reply composers) to 15.5px — so the fix is all of them, not the one
that fired. Six move by ≤1px, including the culprit; nine move by 2 to
3.5px. 16px is also what iOS wants a form field at: the old sizes were
below what the platform considers readable, which is the whole reason it
zooms.

**The alternative, and why not.** `maximum-scale=1` in index.html's
viewport meta is one line and changes no pixel of the design. It also
disables pinch-zoom in the Capacitor shell and on Android Chrome (iOS
Safari overrides the flag, so only the web-on-iPhone path keeps it) —
a WCAG 1.4.4 regression in a repo that runs an a11y ratchet precisely so
that sort of thing has to be argued for. Rejected on that trade, with
the owner's call on the record.

**Enforcement.** `check:touch-zoom` (client-only, off
`backend-checks.yml` — nothing it says bears on whether a rules fix is
safe to deploy) scans for `<input>`/`<textarea>` tags and for stylesheet
rules that target them, resolving style objects that get spread in. Its
three detection paths were each verified by reintroducing the bug: an
inline literal, a literal reached through a spread style object, and
`.search-field input` restored to 15px — the original defect, which the
gate names by file and line.

A gate rather than a test, for two reasons the tree demonstrates. The
mount suites run in jsdom with vitest's CSS handling off, so a
stylesheet-driven size never resolves there — the 15px that caused this
would have passed a runtime assertion. And the fields sit behind six
overlays and a bottom sheet, so a walk would have to reach every one of
them to say anything, while a source scan sees all of them at once.
`tsc`, `eslint`, `check:globals` and the smoke tests are all blind here:
a small font size is valid CSS.

**What is NOT included.** Non-keyboard inputs — `type="range"`,
checkbox, radio, colour — are exempt and listed in the script: iOS does
not zoom for them, and the map's history scrubber is sized deliberately.
`spec/tweaks-panel.jsx` is skipped: it is `if (!open) return null` with
`open` reachable only from a listener behind `import.meta.env.DEV`, so
it is not in a production bundle and cannot be focused on a device.

Double-tap-to-zoom is also still live outside buttons — `touch-action:
manipulation` is scoped to `button`/`[role=button]`/`[role=tab]`
(styles.css § 2). It is a second way to scale the app that nothing
scales back, but it is user-initiated and was not what these screenshots
measured, so it stays as it is until something says otherwise.
