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
| Local device state | localStorage | this device | vote cache, display-name draft, passive-test progress |

Not collected: location, contacts, photos, free-text from strangers,
analytics identifiers. Account deletion (`deleteAccount` callable) wipes
the profile, all answers, and auth; k-floored aggregate tallies remain
(anonymous, no per-user attribution to unwind).

Journal-era (v1) collections (`insight_users/*`, aggregates, etc.) are
still governed by rules and wiped by the same deletion path; the v1 UI
was removed (decision D4).
