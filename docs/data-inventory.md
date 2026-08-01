# Data inventory (v2)

Everything the app can store, where it lives, and who can read it. This
is the source for the App Store Privacy Nutrition Label / Play Data
Safety answers when store listing time comes.

| Data | Where | Readable by | Notes |
|---|---|---|---|
| Answers (world/feed/test) | `v2_users/{uid}/answers` | owner only | immutable; doc id = question id |
| Sealed duel answers (+ guess) | same, `g_{gid}_{day}` ids | owner only | become part of a member-only reveal doc next day |
| Anchors snapshot | on each answer doc | owner only | age band, gender, country, city, education, profession, relationship — all optional, entered in the profile's Basics card. Snapshotted at vote time so a later edit cannot move a past answer's cohort |
| Anchors (current) | `v2_users/{uid}.anchors` | owner only | the editable copy the snapshot is taken from |
| Core test results | `v2_users/{uid}.testResults` | owner only | Big Five, politics, values, social. **Political results are special-category data under GDPR Art. 9** — they are never sliced by, never published, and never leave the owner doc |
| Lens results | localStorage only (`insight.lenses.v1`) | this device | the nine minor instruments; deliberately not mirrored to the server (D8) |
| Feed memory | localStorage only (`insight.readRoom.v1`) | this device | one bit per answered question, drives the answer strip |
| Display name | `v2_users/{uid}` + `v2_groups.memberNames` | owner; group members | user-entered, for reveals |
| Push tokens | `v2_users/{uid}.fcmTokens` | owner reads; writes only via the `registerPushToken` callable (clients cannot mutate the list) | native only; used for the single reveal notification |
| Group membership | `v2_groups/{gid}` | members | callable-managed; invite codes server-minted |
| Reveals | `v2_groups/{gid}/reveals/{day}` | members | server-written; names + option picks for that day |
| Aggregates (public) | `v2_question_aggs` | any signed-in user | k-floored (≥5), no per-vote timing, published once per 5 answers so no step is attributable |
| Per-anchor breakdowns | `v2_question_aggs.by` | any signed-in user | counts per cohort, floored per cell with complementary suppression; never carries a name or a uid |
| Takes (circle comments) | `v2_takes` | the take's circle; a mod-hidden one, only its author | free text ≤280 chars, D1 — never world-scale. No edit path; author may delete |
| Flags on a take | `v2_flags` | nobody (write-only) | one per (take, user); anonymous to the circle AND to the moderation run, which sees only server-folded counts |
| Moderation queue | `v2_mod_queue` | nobody (server only) | holds a **copy of a flagged take's text**, so the run reads one collection and never the circle around it. Carries no author uid, deliberately. Erased when its take is |
| Moderation verdicts | `v2_mod_verdicts` | nobody (server only) | append-only audit log: take id, verdict, policy line, run id, generation, and the MODERATOR's uid. No author text and no author uid |
| Aggregates (exact) | `v2_aggs_private` | nobody (server only) | trigger internals; exact counts below the public floor |
| Aggregate event ledger | `v2_agg_events` | nobody (server only) | one entry per counted answer: qid, **uid**, timestamp. Dedup for the trigger, plus the attribution that lets a discovered fake-account ring be subtracted from the counts (D28). Duplicates facts the answer docs already hold — no new category. 90-day TTL; a uid's entries are erased with the account |
| Auth identity | Firebase Auth | — | anonymous by default; Google via linking. Accounts that passed device activation carry a `db: 1` custom claim (D29) — one boolean, no device information |
| Device activation bits | **Apple / Google, not us** | nobody (the platforms hold them) | 2–3 bits per device (DeviceCheck / Play Integrity Device Recall) meaning "an account was activated from this device recently". The server receives allow/deny and stores **no device identifier**; there is nothing here for `deleteAccount` to erase because nothing is held (D29) |
| Local device state | localStorage (~29 `insight.*` keys) | this device | vote cache, display-name draft, passive-test progress, replies, likes, scenes |
| Offline data cache | Firestore `persistentLocalCache` (IndexedDB) | this device | mirrors the questions and answers fetched for this account |
| Crash reports | Sentry (third party) | Sentry project members | **opt-in, default OFF**; errors carry the **uid** (no email, no name, no session replay, `sendDefaultPii: false`) |

**Not collected:** contacts, photos, free-text from strangers, advertising
or analytics identifiers. No product analytics of any kind ship today.

**Location — declare Coarse, and read why the old wording was wrong.**
This paragraph used to open "the v2 app asks for no location: the manifest
declares no location permission and nothing in `src/` writes one." Both
halves are now false, and this file is the audited list the store forms are
answered from — so the stale version produced an **under-declaration**,
which `docs/SHIP-CHECKLIST.md` correctly calls the direction that gets an
app pulled.

What is true today, after D9's amendment: `AndroidManifest.xml` declares
`ACCESS_COARSE_LOCATION` outright (plus `ACCESS_FINE_LOCATION` capped at
`maxSdkVersion="30"`, for the reason recorded beside it), `Info.plist`
carries `NSLocationWhenInUseUsageDescription`, and `src/v2/data/locate.ts`
calls `Geolocation.getCurrentPosition`. So: **Coarse location, linked to
user, App Functionality, optional.**

Declare it even though **no coordinate is ever transmitted** — the fix is
resolved to a city name on the device and discarded, so what leaves the
device is a city name. That is still coarse location data. Never tick
Precise: it is unobtainable by construction, not by policy.

**Sensitive info — read the precondition.** The retired v1
`insight_discoverable` documents carry a ~5km geohash alongside a Big Five
vector, political coordinates, age, gender, country and a free-text bio.
Client access to them is now closed (D4), which is not the same as them
being gone. **Declare sensitive personal info as "not collected" only
after the discoverable scrub has actually run** — the honest scope is the
whole document, not just its location field:

```bash
node scripts/scrub-v1-discoverable.mjs --project prvfire33          # report
node scripts/scrub-v1-discoverable.mjs --project prvfire33 --apply  # delete
```

Note that the v2 surface has its own Art. 9 answer regardless: the
politics test result is special-category data, so **Sensitive info stays a
real Yes** even once the scrub has run. The scrub changes the scope of the
claim, not the answer to that row.

**Deletion.** The `deleteAccount` callable wipes the profile, all answers,
group memberships, this user's votes and names inside shared reveals, the
rate-limit ledgers, the aggregate event ledger's entries naming them,
cross-user references (impressions they sent, relations naming them),
their takes and flags, the moderation queue's copy of any take of theirs,
and the auth user; it also purges every local `insight.*` key and the
offline cache on the device that ran it.

That queue copy is worth stating explicitly, because it is the one place a
user's words lived somewhere other than where they wrote them: the
moderation design copies a flagged take's text into `v2_mod_queue` so the
review run reads one collection and never the circle around it, and for a
while deleting the take did not delete the copy. It does now, and the
erasure e2e asserts it — including that someone else's queued take is left
alone.

Three things deliberately survive, and all belong on a store form:

- k-floored aggregate tallies. The counts themselves never name anyone,
  and the one record that could attribute them — the event ledger — is
  swept in the same call, so what survives is anonymous the moment the
  deletion returns. (One bounded exception: an answer still in flight
  through the trigger when the sweep runs can land its ledger entry
  afterwards; it self-erases at the 90-day TTL — D28.) And
- **the uid attached to any Sentry event already sent.** `deleteAccount`
  does not reach into Sentry, so those reports persist for the Sentry
  project's retention period. Only relevant to users who opted telemetry
  in, and
- **moderation verdict rows** (`v2_mod_verdicts`). They record that a take
  id was removed, kept or escalated, under which policy line, by which
  moderator — no author text, no author uid. Once the take, the flags and
  the profile are gone the id resolves to nothing, so what remains is a
  record of a moderator's decision rather than data about the person who
  was moderated. Kept because the log is the audit trail the advisory
  phase's judgement is assessed from, and it is append-only by design.

Journal-era (v1) collections (`insight_users/*`, `insight_discoverable`,
aggregates) are no longer reachable by any client — their rules were
retired in D4 and archived in `firestore.rules.v1-archive` — but they are
still written by the v1 Cloud Functions and still wiped by the same
deletion path.
