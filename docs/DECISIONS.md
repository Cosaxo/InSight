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

**Decision.** The Mirror's Near population is the ~5 km geohash5 cell
system already implemented (`insight_discoverable`, `aggregates_by_geohash5`,
k-anonymity floor). City and country are zoom stops of the World population
driven by profile anchors, not by location.

**Why.** The prototype telescopes Near (5 km) separately from City/Country/
Globe. Location-based Near already has a deployed, k-anonymous, tested
implementation; anchor-based city/country need none of that machinery.

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
