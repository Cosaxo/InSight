# Data inventory (v2)

Everything the app can store, where it lives, and who can read it. This
is the source for the App Store Privacy Nutrition Label / Play Data
Safety answers when store listing time comes.

| Data | Where | Readable by | Notes |
|---|---|---|---|
| Answers (world/feed/test) | `v2_users/{uid}/answers` | owner only | immutable; doc id = question id |
| Sealed duel answers (+ guess) | same, `g_{gid}_{day}` ids | owner only | become part of a member-only reveal doc next day |
| Anchors snapshot | on each answer doc | owner only | empty `{}` until anchor editing ships |
| Display name | `v2_users/{uid}` + `v2_groups.memberNames` | owner; group members | user-entered, for reveals |
| Push tokens | `v2_users/{uid}.fcmTokens` | owner only | native only; used for the single reveal notification |
| Group membership | `v2_groups/{gid}` | members | callable-managed; invite codes server-minted |
| Reveals | `v2_groups/{gid}/reveals/{day}` | members | server-written; names + option picks for that day |
| Aggregates (public) | `v2_question_aggs` | any signed-in user | k-floored (≥5), no per-vote timing |
| Aggregates (exact) | `v2_aggs_private`, `v2_agg_events` | nobody (server only) | trigger internals |
| Auth identity | Firebase Auth | — | anonymous by default; Google via linking |
| Local device state | localStorage (~29 `insight.*` keys) | this device | vote cache, display-name draft, passive-test progress, replies, likes, scenes |
| Offline data cache | Firestore `persistentLocalCache` (IndexedDB) | this device | mirrors the questions and answers fetched for this account |
| Crash reports | Sentry (third party) | Sentry project members | **opt-in, default OFF**; errors carry the **uid** (no email, no name, no session replay, `sendDefaultPii: false`) |

**Not collected:** contacts, photos, free-text from strangers, advertising
or analytics identifiers. No product analytics of any kind ship today.

**Location and sensitive info — read the precondition.** The v2 app asks
for no location: the manifest declares no location permission and nothing
in `src/` writes one. But the retired v1 `insight_discoverable` documents
carry a ~5km geohash alongside a Big Five vector, political coordinates,
age, gender, country and a free-text bio. Client access to them is now
closed (D4), which is not the same as them being gone. **Declare location
and sensitive personal info as "not collected" only after the discoverable
scrub in `docs/SHIP-CHECKLIST.md` has actually run** — the honest scope is
the whole document, not just its location field.

**Deletion.** The `deleteAccount` callable wipes the profile, all answers,
group memberships, this user's votes and names inside shared reveals, the
rate-limit ledgers, cross-user references (impressions they sent,
relations naming them), and the auth user; it also purges every local
`insight.*` key and the offline cache on the device that ran it. Two
things deliberately survive, and both belong on a store form:

- k-floored aggregate tallies (anonymous, no per-user attribution to
  unwind), and
- **the uid attached to any Sentry event already sent.** `deleteAccount`
  does not reach into Sentry, so those reports persist for the Sentry
  project's retention period. Only relevant to users who opted telemetry
  in.

Journal-era (v1) collections (`insight_users/*`, `insight_discoverable`,
aggregates) are no longer reachable by any client — their rules were
retired in D4 and archived in `firestore.rules.v1-archive` — but they are
still written by the v1 Cloud Functions and still wiped by the same
deletion path.
