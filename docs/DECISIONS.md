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
plus `assetlinks.json`. Both need a real domain — and `firebase.json` has
no `hosting` block today, which is separately why there is no reachable
privacy-policy URL for the store listings. One hosting target unblocks
both.

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
is no longer rewritten on every answer once a question is past 50 answers
— above that it publishes every 5th, cutting writes to `pubRef` by ~80%.
Below 50 it still writes every time, because a question with 12 answers
has no contention to relieve and an inexact count there is visible.
`v2_aggs_private` keeps the exact running total either way, so nothing is
lost; the public number can lag by at most 4 answers, and only where it
is already in the dozens.

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
